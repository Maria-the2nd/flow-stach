/**
 * Image Diff
 *
 * Computes pixel-level differences between screenshots using pixelmatch.
 */

import fs from 'fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { DiffStats } from '../types';
import { PIXELMATCH_OPTIONS, SEVERITY_THRESHOLDS, DEFAULT_DIFF_THRESHOLD } from '../config';

/**
 * Compute pixel diff between two PNG images
 */
export async function computeImageDiff(
  originalPath: string,
  sanitizedPath: string,
  diffOutputPath: string,
  threshold: number = DEFAULT_DIFF_THRESHOLD
): Promise<DiffStats> {
  // Read both images
  const originalBuffer = fs.readFileSync(originalPath);
  const sanitizedBuffer = fs.readFileSync(sanitizedPath);

  const originalPng = PNG.sync.read(originalBuffer);
  const sanitizedPng = PNG.sync.read(sanitizedBuffer);

  // Handle size differences by using the larger dimensions
  const width = Math.max(originalPng.width, sanitizedPng.width);
  const height = Math.max(originalPng.height, sanitizedPng.height);

  // Create normalized images with consistent size
  const normalizedOriginal = normalizeImageSize(originalPng, width, height);
  const normalizedSanitized = normalizeImageSize(sanitizedPng, width, height);

  // Create diff image
  const diffPng = new PNG({ width, height });

  // Run pixelmatch
  const diffPixels = pixelmatch(
    normalizedOriginal.data,
    normalizedSanitized.data,
    diffPng.data,
    width,
    height,
    {
      threshold: PIXELMATCH_OPTIONS.threshold,
      includeAA: PIXELMATCH_OPTIONS.includeAA,
      diffColor: [255, 0, 0], // Red for differences
      diffColorAlt: [0, 255, 0], // Green for anti-aliasing
    }
  );

  // Write diff image
  fs.writeFileSync(diffOutputPath, PNG.sync.write(diffPng));

  // Calculate stats
  const totalPixels = width * height;
  const diffRatio = totalPixels > 0 ? diffPixels / totalPixels : 0;
  const passThreshold = diffRatio <= threshold;

  return {
    totalPixels,
    diffPixels,
    diffRatio,
    passThreshold,
  };
}

/**
 * Normalize image to target size (pad with white if smaller)
 */
function normalizeImageSize(png: PNG, targetWidth: number, targetHeight: number): PNG {
  if (png.width === targetWidth && png.height === targetHeight) {
    return png;
  }

  const normalized = new PNG({ width: targetWidth, height: targetHeight });

  // Fill with white
  for (let i = 0; i < normalized.data.length; i += 4) {
    normalized.data[i] = 255; // R
    normalized.data[i + 1] = 255; // G
    normalized.data[i + 2] = 255; // B
    normalized.data[i + 3] = 255; // A
  }

  // Copy original image data
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const srcIdx = (y * png.width + x) * 4;
      const dstIdx = (y * targetWidth + x) * 4;

      normalized.data[dstIdx] = png.data[srcIdx];
      normalized.data[dstIdx + 1] = png.data[srcIdx + 1];
      normalized.data[dstIdx + 2] = png.data[srcIdx + 2];
      normalized.data[dstIdx + 3] = png.data[srcIdx + 3];
    }
  }

  return normalized;
}

/**
 * Determine severity based on diff ratio
 */
export function getDiffSeverity(diffRatio: number): 'low' | 'medium' | 'high' {
  if (diffRatio < SEVERITY_THRESHOLDS.low) {
    return 'low';
  }
  if (diffRatio < SEVERITY_THRESHOLDS.medium) {
    return 'medium';
  }
  return 'high';
}

/**
 * Format diff ratio as percentage string
 */
export function formatDiffPercentage(diffRatio: number): string {
  return `${(diffRatio * 100).toFixed(2)}%`;
}

/**
 * Compare multiple image pairs and aggregate results
 */
export async function computeMultipleDiffs(
  pairs: Array<{
    original: string;
    sanitized: string;
    output: string;
    name: string;
  }>,
  threshold?: number
): Promise<Array<{ name: string; stats: DiffStats }>> {
  const results: Array<{ name: string; stats: DiffStats }> = [];

  for (const pair of pairs) {
    const stats = await computeImageDiff(
      pair.original,
      pair.sanitized,
      pair.output,
      threshold
    );
    results.push({ name: pair.name, stats });
  }

  return results;
}

/**
 * Get aggregate stats across multiple viewports
 */
export function getAggregateStats(
  statsArray: DiffStats[]
): {
  maxDiffRatio: number;
  avgDiffRatio: number;
  totalDiffPixels: number;
  allPassed: boolean;
} {
  if (statsArray.length === 0) {
    return {
      maxDiffRatio: 0,
      avgDiffRatio: 0,
      totalDiffPixels: 0,
      allPassed: true,
    };
  }

  const maxDiffRatio = Math.max(...statsArray.map((s) => s.diffRatio));
  const avgDiffRatio =
    statsArray.reduce((sum, s) => sum + s.diffRatio, 0) / statsArray.length;
  const totalDiffPixels = statsArray.reduce((sum, s) => sum + s.diffPixels, 0);
  const allPassed = statsArray.every((s) => s.passThreshold);

  return {
    maxDiffRatio,
    avgDiffRatio,
    totalDiffPixels,
    allPassed,
  };
}

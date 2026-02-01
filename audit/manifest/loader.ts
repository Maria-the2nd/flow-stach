/**
 * Manifest Loader
 *
 * Auto-discovers and loads test manifests from the tests directory.
 */

import fs from 'fs';
import path from 'path';
import { AUDIT_CONFIG, MANIFEST_PATTERN } from '../config';
import { safeValidateManifest } from './schema';
import type { TestManifest } from '../types';

export interface LoadedManifest {
  filePath: string;
  slug: string;
  manifest: TestManifest;
}

export interface ManifestLoadError {
  filePath: string;
  error: string;
}

export interface ManifestLoadResult {
  manifests: LoadedManifest[];
  errors: ManifestLoadError[];
}

/**
 * Get slug from manifest filename
 * e.g., "my-test.test.json" -> "my-test"
 */
function getSlugFromFilename(filename: string): string {
  return filename.replace(/\.test\.json$/, '');
}

/**
 * Find all manifest files in a directory
 */
function findManifestFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir);
  return files
    .filter((f) => f.endsWith('.test.json'))
    .map((f) => path.join(dir, f));
}

/**
 * Load and validate a single manifest file
 */
function loadManifestFile(filePath: string): LoadedManifest | ManifestLoadError {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const validation = safeValidateManifest(data);

    if (!validation.success) {
      return { filePath, error: validation.error || 'Unknown validation error' };
    }

    const slug = getSlugFromFilename(path.basename(filePath));
    return { filePath, slug, manifest: validation.data! };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { filePath, error: `Failed to load: ${message}` };
  }
}

/**
 * Check if a load result is an error
 */
function isLoadError(
  result: LoadedManifest | ManifestLoadError
): result is ManifestLoadError {
  return 'error' in result;
}

/**
 * Discover and load all test manifests
 */
export function loadAllManifests(
  testsDir: string = AUDIT_CONFIG.testsDir
): ManifestLoadResult {
  const manifestFiles = findManifestFiles(testsDir);
  const manifests: LoadedManifest[] = [];
  const errors: ManifestLoadError[] = [];

  for (const filePath of manifestFiles) {
    const result = loadManifestFile(filePath);
    if (isLoadError(result)) {
      errors.push(result);
    } else {
      manifests.push(result);
    }
  }

  return { manifests, errors };
}

/**
 * Load a single manifest by slug
 */
export function loadManifestBySlug(
  slug: string,
  testsDir: string = AUDIT_CONFIG.testsDir
): LoadedManifest | null {
  const filePath = path.join(testsDir, `${slug}.test.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const result = loadManifestFile(filePath);
  if (isLoadError(result)) {
    console.error(`Error loading manifest ${slug}:`, result.error);
    return null;
  }

  return result;
}

/**
 * Filter manifests by tags
 */
export function filterManifestsByTags(
  manifests: LoadedManifest[],
  includeTags: string[]
): LoadedManifest[] {
  if (includeTags.length === 0) {
    return manifests;
  }

  return manifests.filter((m) => {
    const manifestTags = m.manifest.tags || [];
    return includeTags.some((tag) => manifestTags.includes(tag));
  });
}

/**
 * Filter out skipped manifests
 */
export function filterSkipped(manifests: LoadedManifest[]): {
  active: LoadedManifest[];
  skipped: LoadedManifest[];
} {
  const active: LoadedManifest[] = [];
  const skipped: LoadedManifest[] = [];

  for (const m of manifests) {
    if (m.manifest.skip) {
      skipped.push(m);
    } else {
      active.push(m);
    }
  }

  return { active, skipped };
}

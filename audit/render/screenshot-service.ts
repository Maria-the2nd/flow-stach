/**
 * Screenshot Service
 *
 * Uses Playwright to capture screenshots of HTML bundles at various viewports.
 */

import { chromium, type Browser, type Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import type { ViewportDimensions, BundleResult, ScreenshotResult, DiffStats } from '../types';
import { AUDIT_CONFIG, SCREENSHOT_TIMEOUT } from '../config';
import { mergeViewports } from './viewports';

let browser: Browser | null = null;

/**
 * Get or create browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
    });
  }
  return browser;
}

/**
 * Close browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Take screenshot of a single HTML file at specified viewport
 */
async function takeScreenshot(
  page: Page,
  htmlPath: string,
  outputPath: string,
  viewport: ViewportDimensions
): Promise<void> {
  // Set viewport
  await page.setViewportSize(viewport);

  // Navigate to file
  const fileUrl = `file://${htmlPath}`;
  await page.goto(fileUrl, {
    waitUntil: 'networkidle',
    timeout: SCREENSHOT_TIMEOUT,
  });

  // Wait for fonts and images to load
  await page.waitForLoadState('domcontentloaded');

  // Small delay for any animations to settle
  await page.waitForTimeout(500);

  // Take full-page screenshot
  await page.screenshot({
    path: outputPath,
    fullPage: true,
  });
}

/**
 * Take screenshots of both original and sanitized bundles
 */
export async function takeScreenshots(
  slug: string,
  bundle: BundleResult,
  viewportOverrides?: Record<string, ViewportDimensions>
): Promise<ScreenshotResult[]> {
  const results: ScreenshotResult[] = [];
  const outputDir = path.join(AUDIT_CONFIG.outputDir, slug);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const viewports = mergeViewports(viewportOverrides);
  const b = await getBrowser();
  const context = await b.newContext();
  const page = await context.newPage();

  try {
    for (const [name, dimensions] of Object.entries(viewports)) {
      const originalPath = path.join(outputDir, `original.${name}.png`);
      const sanitizedPath = path.join(outputDir, `sanitized.${name}.png`);
      const diffPath = path.join(outputDir, `diff.${name}.png`);

      // Take original screenshot
      await takeScreenshot(page, bundle.originalBundlePath, originalPath, dimensions);

      // Take sanitized screenshot
      await takeScreenshot(page, bundle.sanitizedBundlePath, sanitizedPath, dimensions);

      results.push({
        viewport: name,
        originalPath,
        sanitizedPath,
        diffPath,
        stats: {
          totalPixels: 0,
          diffPixels: 0,
          diffRatio: 0,
          passThreshold: true,
        },
      });
    }
  } finally {
    await context.close();
  }

  return results;
}

/**
 * Take a single screenshot for quick preview
 */
export async function takeQuickScreenshot(
  htmlContent: string,
  outputPath: string,
  viewport: ViewportDimensions = { width: 1440, height: 900 }
): Promise<void> {
  // Write HTML to temp file
  const tempDir = path.dirname(outputPath);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempHtmlPath = path.join(tempDir, '_temp_preview.html');
  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');

  const b = await getBrowser();
  const context = await b.newContext();
  const page = await context.newPage();

  try {
    await takeScreenshot(page, tempHtmlPath, outputPath, viewport);
  } finally {
    await context.close();
    // Clean up temp file
    if (fs.existsSync(tempHtmlPath)) {
      fs.unlinkSync(tempHtmlPath);
    }
  }
}

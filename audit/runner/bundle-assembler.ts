/**
 * Bundle Assembler
 *
 * Creates HTML bundles from test manifests, supporting:
 * - Single HTML files with embedded CSS/JS
 * - Split files (separate HTML, CSS, JS)
 * - CodePen dumps
 */

import fs from 'fs';
import path from 'path';
import type { TestManifest, BundleResult } from '../types';
import { AUDIT_CONFIG } from '../config';

export interface AssembleOptions {
  manifestPath: string;
  manifest: TestManifest;
  slug: string;
}

/**
 * Assemble HTML bundle from manifest paths
 */
export function assembleBundle(options: AssembleOptions): {
  html: string;
  css?: string;
  js?: string;
  error?: string;
} {
  const { manifest, manifestPath } = options;
  const baseDir = path.dirname(manifestPath);

  try {
    // Load HTML (required)
    const htmlPath = resolveRelativePath(manifest.paths.html, baseDir);
    if (!fs.existsSync(htmlPath)) {
      return { html: '', error: `HTML file not found: ${htmlPath}` };
    }
    const html = fs.readFileSync(htmlPath, 'utf-8');

    // Load optional CSS
    let css: string | undefined;
    if (manifest.paths.css) {
      const cssPath = resolveRelativePath(manifest.paths.css, baseDir);
      if (fs.existsSync(cssPath)) {
        css = fs.readFileSync(cssPath, 'utf-8');
      } else {
        console.warn(`CSS file not found: ${cssPath}`);
      }
    }

    // Load optional JS
    let js: string | undefined;
    if (manifest.paths.js) {
      const jsPath = resolveRelativePath(manifest.paths.js, baseDir);
      if (fs.existsSync(jsPath)) {
        js = fs.readFileSync(jsPath, 'utf-8');
      } else {
        console.warn(`JS file not found: ${jsPath}`);
      }
    }

    return { html, css, js };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { html: '', error: `Failed to load bundle: ${message}` };
  }
}

/**
 * Resolve a relative path from manifest directory
 */
function resolveRelativePath(relativePath: string, baseDir: string): string {
  if (path.isAbsolute(relativePath)) {
    return relativePath;
  }
  return path.join(baseDir, relativePath);
}

/**
 * Create complete HTML document from parts
 */
export function createHtmlBundle(
  html: string,
  css?: string,
  js?: string,
  title: string = 'Audit Test'
): string {
  // Check if HTML is already a full document
  const isFullDocument = /<html/i.test(html) || /<!DOCTYPE/i.test(html);

  if (isFullDocument) {
    let result = html;

    // Inject external CSS if provided
    if (css) {
      result = result.replace(
        /<\/head>/i,
        `<style>\n/* External CSS */\n${css}\n</style>\n</head>`
      );
    }

    // Inject external JS if provided
    if (js) {
      result = result.replace(
        /<\/body>/i,
        `<script>\n/* External JS */\n${js}\n</script>\n</body>`
      );
    }

    return result;
  }

  // Build complete document from fragment
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${css ? `<style>\n${css}\n</style>` : ''}
</head>
<body>
${html}
${js ? `<script>\n${js}\n</script>` : ''}
</body>
</html>`;
}

/**
 * Escape HTML special characters for safe embedding
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Write bundle files to output directory
 */
export function writeBundleFiles(
  slug: string,
  originalHtml: string,
  sanitizedHtml: string
): BundleResult {
  const outputDir = path.join(AUDIT_CONFIG.outputDir, slug);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const originalPath = path.join(outputDir, 'original.bundle.html');
  const sanitizedPath = path.join(outputDir, 'sanitized.bundle.html');

  fs.writeFileSync(originalPath, originalHtml, 'utf-8');
  fs.writeFileSync(sanitizedPath, sanitizedHtml, 'utf-8');

  return {
    originalHtml,
    sanitizedHtml,
    originalBundlePath: originalPath,
    sanitizedBundlePath: sanitizedPath,
  };
}

/**
 * Ensure output directory exists
 */
export function ensureOutputDir(): void {
  if (!fs.existsSync(AUDIT_CONFIG.outputDir)) {
    fs.mkdirSync(AUDIT_CONFIG.outputDir, { recursive: true });
  }
}

/**
 * Clean output directory
 */
export function cleanOutputDir(): void {
  if (fs.existsSync(AUDIT_CONFIG.outputDir)) {
    fs.rmSync(AUDIT_CONFIG.outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(AUDIT_CONFIG.outputDir, { recursive: true });
}

/**
 * External Resource Detection and Warnings
 *
 * Detects external stylesheets (<link rel="stylesheet">) and scripts (<script src="">)
 * that won't be included in the Webflow paste. Generates warnings for users.
 */

import {
  ValidationSeverity,
  ValidationIssue,
  error,
  warning,
  ErrorIssueCodes,
  WarningIssueCodes,
} from './validation-types';

// ============================================
// TYPES
// ============================================

export interface ExternalResource {
  type: 'stylesheet' | 'script';
  url: string;
  isRelative: boolean;
  isCDN: boolean;
  cdnDomain?: string;
  /** @deprecated Use validationIssue.severity instead */
  severity: 'error' | 'warning';
  message: string;
  /** Standardized validation issue */
  validationIssue: ValidationIssue;
}

export interface ExternalResourceResult {
  stylesheets: ExternalResource[];
  scripts: ExternalResource[];
  hasErrors: boolean;
  hasWarnings: boolean;
  /** All resources combined */
  all: ExternalResource[];
  /** Human-readable summary */
  summary: string;
  /** All validation issues in standardized format */
  issues: ValidationIssue[];
}

// ============================================
// KNOWN CDN DOMAINS
// ============================================

const CDN_DOMAINS: Record<string, string> = {
  'cdnjs.cloudflare.com': 'cdnjs',
  'cdn.jsdelivr.net': 'jsDelivr',
  'unpkg.com': 'unpkg',
  'fonts.googleapis.com': 'Google Fonts',
  'fonts.gstatic.com': 'Google Fonts',
  'cdn.tailwindcss.com': 'Tailwind CDN',
  'use.fontawesome.com': 'Font Awesome',
  'kit.fontawesome.com': 'Font Awesome',
  'stackpath.bootstrapcdn.com': 'Bootstrap CDN',
  'cdn.bootcdn.net': 'BootCDN',
  'ajax.googleapis.com': 'Google Hosted Libraries',
  'code.jquery.com': 'jQuery CDN',
  'maxcdn.bootstrapcdn.com': 'Bootstrap CDN',
  'cdn.plyr.io': 'Plyr',
  'polyfill.io': 'Polyfill.io',
  'rawgit.com': 'RawGit',
  'raw.githubusercontent.com': 'GitHub Raw',
  'cdn.statically.io': 'Statically',
  'esm.sh': 'esm.sh',
  'skypack.dev': 'Skypack',
  'cdn.skypack.dev': 'Skypack',
};

// ============================================
// DETECTION FUNCTIONS
// ============================================

/**
 * Check if a URL is relative (no protocol or starts with ./ or ../)
 */
function isRelativeUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;

  // Absolute URLs start with protocol or //
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (trimmed.startsWith('//')) return false;

  // Anything else is relative
  return true;
}

/**
 * Check if a URL is from a known CDN
 */
function detectCDN(url: string): { isCDN: boolean; cdnDomain?: string } {
  try {
    // Handle protocol-relative URLs
    const normalizedUrl = url.startsWith('//') ? `https:${url}` : url;
    const parsed = new URL(normalizedUrl);
    const hostname = parsed.hostname.toLowerCase();

    // Check against known CDN domains
    for (const [domain, name] of Object.entries(CDN_DOMAINS)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return { isCDN: true, cdnDomain: name };
      }
    }

    // Check for common CDN patterns in hostname
    if (
      hostname.includes('cdn.') ||
      hostname.includes('.cdn.') ||
      hostname.includes('static.') ||
      hostname.includes('assets.')
    ) {
      return { isCDN: true, cdnDomain: hostname };
    }

    return { isCDN: false };
  } catch {
    // If URL parsing fails, it's likely relative
    return { isCDN: false };
  }
}

/**
 * Extract external stylesheets from HTML
 */
function extractExternalStylesheets(html: string): ExternalResource[] {
  const stylesheets: ExternalResource[] = [];

  // Match <link> tags with rel="stylesheet"
  // Handles various attribute orders
  const linkRegex = /<link\s+([^>]*?)>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const attributes = match[1];

    // Check if it's a stylesheet
    const isStylesheet = /rel\s*=\s*["']stylesheet["']/i.test(attributes);
    if (!isStylesheet) continue;

    // Extract href
    const hrefMatch = attributes.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;

    const url = hrefMatch[1].trim();
    if (!url) continue;

    const isRelative = isRelativeUrl(url);
    const cdnInfo = detectCDN(url);

    let severity: 'error' | 'warning';
    let message: string;
    let validationIssue: ValidationIssue;

    if (isRelative) {
      severity = 'error';
      message = `Relative stylesheet '${url}' cannot be loaded. Inline the CSS or host it externally.`;
      validationIssue = error(
        ErrorIssueCodes.RELATIVE_RESOURCE,
        message,
        {
          context: url,
          suggestion: 'Inline the CSS content or host it on a CDN and use an absolute URL',
        }
      );
    } else {
      severity = 'warning';
      const cdnLabel = cdnInfo.cdnDomain ? ` (${cdnInfo.cdnDomain})` : '';
      message = `External stylesheet detected: ${url}${cdnLabel}. Add to Webflow custom code or page head.`;
      validationIssue = warning(
        WarningIssueCodes.EXTERNAL_CDN_RESOURCE,
        message,
        {
          context: url,
          suggestion: 'Add this stylesheet to Webflow Project Settings > Custom Code > Head Code',
        }
      );
    }

    stylesheets.push({
      type: 'stylesheet',
      url,
      isRelative,
      isCDN: cdnInfo.isCDN,
      cdnDomain: cdnInfo.cdnDomain,
      severity,
      message,
      validationIssue,
    });
  }

  return stylesheets;
}

/**
 * Extract external scripts from HTML
 */
function extractExternalScripts(html: string): ExternalResource[] {
  const scripts: ExternalResource[] = [];

  // Match <script> tags with src attribute
  const scriptRegex = /<script\s+([^>]*src\s*=\s*["'][^"']+["'][^>]*)>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const attributes = match[1];

    // Extract src
    const srcMatch = attributes.match(/src\s*=\s*["']([^"']+)["']/i);
    if (!srcMatch) continue;

    const url = srcMatch[1].trim();
    if (!url) continue;

    const isRelative = isRelativeUrl(url);
    const cdnInfo = detectCDN(url);

    let severity: 'error' | 'warning';
    let message: string;
    let validationIssue: ValidationIssue;

    if (isRelative) {
      severity = 'error';
      message = `Relative script '${url}' cannot be loaded. Inline the JS or host it externally.`;
      validationIssue = error(
        ErrorIssueCodes.RELATIVE_RESOURCE,
        message,
        {
          context: url,
          suggestion: 'Inline the JavaScript content or host it on a CDN and use an absolute URL',
        }
      );
    } else {
      severity = 'warning';
      const cdnLabel = cdnInfo.cdnDomain ? ` (${cdnInfo.cdnDomain})` : '';
      message = `External script detected: ${url}${cdnLabel}. Ensure it's added to page custom code.`;
      validationIssue = warning(
        WarningIssueCodes.EXTERNAL_CDN_RESOURCE,
        message,
        {
          context: url,
          suggestion: 'Add this script to Webflow Project Settings > Custom Code > Footer Code',
        }
      );
    }

    scripts.push({
      type: 'script',
      url,
      isRelative,
      isCDN: cdnInfo.isCDN,
      cdnDomain: cdnInfo.cdnDomain,
      severity,
      message,
      validationIssue,
    });
  }

  return scripts;
}

// ============================================
// MAIN DETECTION FUNCTION
// ============================================

/**
 * Detect all external resources in HTML that won't be included in Webflow paste
 */
export function detectExternalResources(html: string): ExternalResourceResult {
  if (!html || typeof html !== 'string') {
    return {
      stylesheets: [],
      scripts: [],
      all: [],
      hasErrors: false,
      hasWarnings: false,
      summary: 'No external resources detected',
      issues: [],
    };
  }

  const stylesheets = extractExternalStylesheets(html);
  const scripts = extractExternalScripts(html);
  const all = [...stylesheets, ...scripts];

  const hasErrors = all.some(r => r.severity === 'error');
  const hasWarnings = all.some(r => r.severity === 'warning');

  // Collect all validation issues
  const issues = all.map(r => r.validationIssue);

  // Generate summary
  let summary = '';
  if (all.length === 0) {
    summary = 'No external resources detected';
  } else {
    const errors = all.filter(r => r.severity === 'error');
    const warnings = all.filter(r => r.severity === 'warning');
    const parts: string[] = [];

    if (errors.length > 0) {
      parts.push(`${errors.length} relative resource${errors.length > 1 ? 's' : ''} (cannot be loaded)`);
    }
    if (warnings.length > 0) {
      parts.push(`${warnings.length} external resource${warnings.length > 1 ? 's' : ''} (need manual addition)`);
    }

    summary = parts.join(', ');
  }

  return {
    stylesheets,
    scripts,
    all,
    hasErrors,
    hasWarnings,
    summary,
    issues,
  };
}

// ============================================
// FILTERING FUNCTIONS
// ============================================

/**
 * Filter resources to only relative ones (errors)
 */
export function getRelativeResources(result: ExternalResourceResult): ExternalResource[] {
  return result.all.filter(r => r.isRelative);
}

/**
 * Filter resources to only CDN ones (warnings)
 */
export function getCDNResources(result: ExternalResourceResult): ExternalResource[] {
  return result.all.filter(r => r.isCDN);
}

/**
 * Get only stylesheets that need attention
 */
export function getStylesheetWarnings(result: ExternalResourceResult): string[] {
  return result.stylesheets.map(s => s.message);
}

/**
 * Get only scripts that need attention
 */
export function getScriptWarnings(result: ExternalResourceResult): string[] {
  return result.scripts.map(s => s.message);
}

// ============================================
// INTEGRATION HELPERS
// ============================================

/**
 * Check if external resources should block the import
 * Returns true if there are unresolvable issues (relative paths)
 */
export function hasBlockingResourceIssues(result: ExternalResourceResult): boolean {
  return result.hasErrors;
}

/**
 * Get a consolidated list of all warnings/errors for display
 */
export function getAllResourceMessages(result: ExternalResourceResult): string[] {
  return result.all.map(r => `${r.severity === 'error' ? 'ERROR' : 'WARNING'}: ${r.message}`);
}

/**
 * Generate instructions for the user on how to handle external resources
 */
export function generateResourceInstructions(result: ExternalResourceResult): string[] {
  const instructions: string[] = [];

  // Handle relative resources (errors)
  const relativeStylesheets = result.stylesheets.filter(s => s.isRelative);
  const relativeScripts = result.scripts.filter(s => s.isRelative);

  if (relativeStylesheets.length > 0) {
    instructions.push(
      `${relativeStylesheets.length} relative stylesheet(s) found. Options:`,
      '  1. Copy the CSS content and include it in a <style> tag or Webflow custom code',
      '  2. Host the CSS file externally and use the absolute URL'
    );
  }

  if (relativeScripts.length > 0) {
    instructions.push(
      `${relativeScripts.length} relative script(s) found. Options:`,
      '  1. Inline the JavaScript in your embed code',
      '  2. Host the JS file externally and add to Webflow page settings'
    );
  }

  // Handle CDN resources (warnings)
  const cdnStylesheets = result.stylesheets.filter(s => s.isCDN && !s.isRelative);
  const cdnScripts = result.scripts.filter(s => s.isCDN && !s.isRelative);

  if (cdnStylesheets.length > 0) {
    instructions.push(
      `${cdnStylesheets.length} external stylesheet(s) from CDN. To add to Webflow:`,
      '  1. Go to Project Settings > Custom Code',
      '  2. Add <link> tags to the Head Code section:'
    );
    cdnStylesheets.forEach(s => {
      instructions.push(`     <link rel="stylesheet" href="${s.url}">`);
    });
  }

  if (cdnScripts.length > 0) {
    instructions.push(
      `${cdnScripts.length} external script(s) from CDN. To add to Webflow:`,
      '  1. Go to Project Settings > Custom Code',
      '  2. Add <script> tags to the Footer Code section:'
    );
    cdnScripts.forEach(s => {
      instructions.push(`     <script src="${s.url}"><\/script>`);
    });
  }

  return instructions;
}

// ============================================
// DEDUPLICATION WITH JS-LIBRARY-DETECTOR
// ============================================

/**
 * Filter out scripts that are already handled by js-library-detector
 * This prevents duplicate warnings for libraries we auto-inject
 */
export function filterAutoDetectedScripts(
  result: ExternalResourceResult,
  autoDetectedUrls: string[]
): ExternalResourceResult {
  const autoDetectedSet = new Set(autoDetectedUrls.map(u => u.toLowerCase()));

  const filteredScripts = result.scripts.filter(
    s => !autoDetectedSet.has(s.url.toLowerCase())
  );

  const filteredAll = [...result.stylesheets, ...filteredScripts];
  const filteredIssues = filteredAll.map(r => r.validationIssue);

  return {
    stylesheets: result.stylesheets,
    scripts: filteredScripts,
    all: filteredAll,
    hasErrors: filteredAll.some(r => r.severity === 'error'),
    hasWarnings: filteredAll.some(r => r.severity === 'warning'),
    summary: filteredAll.length === 0
      ? 'No external resources detected'
      : `${filteredAll.length} external resource(s) detected`,
    issues: filteredIssues,
  };
}

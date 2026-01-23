/**
 * Asset URL Validator for Flow Bridge
 * Validates and classifies image URLs, background images, and font references
 * to ensure compatibility with Webflow imports.
 */

// ============================================
// TYPES
// ============================================

export type AssetURLType =
  | 'absolute'
  | 'data-uri'
  | 'relative'
  | 'protocol-relative'
  | 'invalid';

export interface AssetValidation {
  /** The original URL */
  url: string;
  /** The classified type of URL */
  type: AssetURLType;
  /** Whether this URL is valid for Webflow */
  isValid: boolean;
  /** Warning message (non-blocking issue) */
  warning?: string;
  /** Error message (blocking issue) */
  error?: string;
  /** Suggested action to fix the issue */
  suggestedAction?: string;
  /** Line number where the URL was found (if available) */
  lineNumber?: number;
  /** The element or context where URL was found */
  context?: string;
}

export interface AssetManifest {
  /** Image elements (<img src="...">) */
  images: AssetValidation[];
  /** Background images (background-image: url(...)) */
  backgroundImages: AssetValidation[];
  /** Font references (@font-face src) */
  fonts: AssetValidation[];
  /** All error messages */
  errors: string[];
  /** All warning messages */
  warnings: string[];
  /** Summary statistics */
  stats: {
    total: number;
    valid: number;
    invalid: number;
    dataUris: number;
    relativePaths: number;
  };
}

export interface GoogleFontInfo {
  /** Font family names */
  families: string[];
  /** Font weights used */
  weights: string[];
  /** The original link tag */
  linkTag: string;
  /** The Google Fonts URL */
  url: string;
}

// ============================================
// URL CLASSIFICATION
// ============================================

/**
 * Classify a URL by its type.
 *
 * @param url - The URL string to classify
 * @returns The URL type classification
 */
export function classifyURL(url: string): AssetURLType {
  const trimmed = url.trim();

  // Empty or invalid
  if (!trimmed || trimmed === '') {
    return 'invalid';
  }

  // Data URI (base64 encoded images)
  if (trimmed.startsWith('data:')) {
    return 'data-uri';
  }

  // Absolute URL with protocol
  if (/^https?:\/\//i.test(trimmed)) {
    return 'absolute';
  }

  // Protocol-relative URL (//example.com/image.png)
  if (trimmed.startsWith('//')) {
    return 'protocol-relative';
  }

  // Relative paths - various formats
  if (
    trimmed.startsWith('./') ||      // Current directory
    trimmed.startsWith('../') ||     // Parent directory
    trimmed.startsWith('/') ||       // Root-relative
    /^[\w-]+\//.test(trimmed)        // Folder path (images/foo.png)
  ) {
    return 'relative';
  }

  // Bare filename with image extension
  if (/\.(jpg|jpeg|png|gif|svg|webp|avif|ico|bmp|tiff?)$/i.test(trimmed)) {
    return 'relative';
  }

  // Bare filename with font extension
  if (/\.(woff2?|ttf|otf|eot)$/i.test(trimmed)) {
    return 'relative';
  }

  // Check for common CDN patterns that might be missing protocol
  if (/^[\w-]+\.[\w-]+\.(com|net|org|io|co)/i.test(trimmed)) {
    return 'protocol-relative'; // Treat as needing https://
  }

  return 'invalid';
}

/**
 * Validate a single asset URL and return detailed validation info.
 *
 * @param url - The URL to validate
 * @param context - Optional context (e.g., "img src", "background-image")
 * @param lineNumber - Optional line number in source
 * @returns Validation result with actionable information
 */
export function validateAssetURL(
  url: string,
  context?: string,
  lineNumber?: number
): AssetValidation {
  const type = classifyURL(url);

  const baseResult: AssetValidation = {
    url,
    type,
    isValid: false,
    context,
    lineNumber,
  };

  switch (type) {
    case 'absolute':
      return {
        ...baseResult,
        isValid: true,
      };

    case 'protocol-relative':
      return {
        ...baseResult,
        url: `https:${url}`, // Upgrade to HTTPS
        isValid: true,
        warning: 'Protocol-relative URL upgraded to HTTPS',
        suggestedAction: 'Consider using explicit https:// URLs',
      };

    case 'data-uri':
      // Data URIs work but have limitations
      const isLargeDataUri = url.length > 50000; // ~50KB
      return {
        ...baseResult,
        isValid: false, // Can't use directly in Webflow paste
        warning: isLargeDataUri
          ? 'Large data URI detected (>50KB) - may cause performance issues'
          : 'Data URI detected - requires conversion to hosted image',
        suggestedAction: 'Upload to Webflow assets or external CDN and use absolute URL',
      };

    case 'relative':
      return {
        ...baseResult,
        isValid: false,
        error: 'Relative path will not work in Webflow',
        suggestedAction: 'Upload image to a CDN or Webflow assets and replace with absolute URL',
      };

    case 'invalid':
    default:
      return {
        ...baseResult,
        type: 'invalid',
        isValid: false,
        error: url ? 'Invalid URL format' : 'Empty or missing URL',
        suggestedAction: 'Provide a valid absolute URL (https://...)',
      };
  }
}

// ============================================
// ASSET EXTRACTION
// ============================================

/**
 * Count lines before a position in a string.
 */
function getLineNumber(content: string, position: number): number {
  return (content.substring(0, position).match(/\n/g) || []).length + 1;
}

/**
 * Extract all asset URLs from HTML and CSS content.
 *
 * @param html - HTML content to scan
 * @param css - CSS content to scan
 * @returns Asset manifest with all validations
 */
export function extractAndValidateAssets(
  html: string,
  css: string
): AssetManifest {
  const manifest: AssetManifest = {
    images: [],
    backgroundImages: [],
    fonts: [],
    errors: [],
    warnings: [],
    stats: {
      total: 0,
      valid: 0,
      invalid: 0,
      dataUris: 0,
      relativePaths: 0,
    },
  };

  // Track seen URLs to avoid duplicates in error messages
  const seenUrls = new Set<string>();

  // ==========================================
  // Extract <img src="...">
  // ==========================================
  const imgPattern = /<img[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = imgPattern.exec(html)) !== null) {
    const url = match[1];
    const lineNumber = getLineNumber(html, match.index);
    const validation = validateAssetURL(url, '<img src>', lineNumber);
    manifest.images.push(validation);

    const urlKey = `img:${url}`;
    if (!seenUrls.has(urlKey)) {
      seenUrls.add(urlKey);
      if (validation.error) {
        manifest.errors.push(`Line ${lineNumber}: Image src - ${validation.error} "${url}"`);
      }
      if (validation.warning) {
        manifest.warnings.push(`Line ${lineNumber}: Image src - ${validation.warning} "${url}"`);
      }
    }
  }

  // ==========================================
  // Extract <source src="..."> and srcset
  // ==========================================
  const sourcePattern = /<source[^>]+(?:src|srcset)=["']([^"']+)["']/gi;
  while ((match = sourcePattern.exec(html)) !== null) {
    // srcset can have multiple URLs separated by commas
    const srcValue = match[1];
    const lineNumber = getLineNumber(html, match.index);

    // Split srcset entries (e.g., "image1.jpg 1x, image2.jpg 2x")
    const urls = srcValue.split(',').map(entry => {
      // Remove size descriptors (1x, 2x, 300w, etc.)
      return entry.trim().split(/\s+/)[0];
    }).filter(Boolean);

    for (const url of urls) {
      const validation = validateAssetURL(url, '<source>', lineNumber);
      manifest.images.push(validation);

      const urlKey = `source:${url}`;
      if (!seenUrls.has(urlKey)) {
        seenUrls.add(urlKey);
        if (validation.error) {
          manifest.errors.push(`Line ${lineNumber}: Source - ${validation.error} "${url}"`);
        }
        if (validation.warning) {
          manifest.warnings.push(`Line ${lineNumber}: Source - ${validation.warning} "${url}"`);
        }
      }
    }
  }

  // ==========================================
  // Extract <video poster="..."> and <video src="...">
  // ==========================================
  const videoPattern = /<video[^>]+(?:poster|src)=["']([^"']+)["']/gi;
  while ((match = videoPattern.exec(html)) !== null) {
    const url = match[1];
    const lineNumber = getLineNumber(html, match.index);
    const validation = validateAssetURL(url, '<video>', lineNumber);
    manifest.images.push(validation);

    const urlKey = `video:${url}`;
    if (!seenUrls.has(urlKey)) {
      seenUrls.add(urlKey);
      if (validation.error) {
        manifest.errors.push(`Line ${lineNumber}: Video - ${validation.error} "${url}"`);
      }
      if (validation.warning) {
        manifest.warnings.push(`Line ${lineNumber}: Video - ${validation.warning} "${url}"`);
      }
    }
  }

  // ==========================================
  // Extract background-image: url(...)
  // ==========================================
  const bgPattern = /background(?:-image)?:\s*url\(["']?([^"')]+)["']?\)/gi;
  while ((match = bgPattern.exec(css)) !== null) {
    const url = match[1];
    const lineNumber = getLineNumber(css, match.index);
    const validation = validateAssetURL(url, 'background-image', lineNumber);
    manifest.backgroundImages.push(validation);

    const urlKey = `bg:${url}`;
    if (!seenUrls.has(urlKey)) {
      seenUrls.add(urlKey);
      if (validation.error) {
        manifest.errors.push(`CSS Line ${lineNumber}: Background - ${validation.error} "${url}"`);
      }
      if (validation.warning) {
        manifest.warnings.push(`CSS Line ${lineNumber}: Background - ${validation.warning} "${url}"`);
      }
    }
  }

  // Also check for background-image in HTML inline styles
  const inlineBgPattern = /style=["'][^"']*background(?:-image)?:\s*url\(["']?([^"')]+)["']?\)[^"']*["']/gi;
  while ((match = inlineBgPattern.exec(html)) !== null) {
    const url = match[1];
    const lineNumber = getLineNumber(html, match.index);
    const validation = validateAssetURL(url, 'inline background-image', lineNumber);
    manifest.backgroundImages.push(validation);

    const urlKey = `inline-bg:${url}`;
    if (!seenUrls.has(urlKey)) {
      seenUrls.add(urlKey);
      if (validation.error) {
        manifest.errors.push(`Line ${lineNumber}: Inline background - ${validation.error} "${url}"`);
      }
      if (validation.warning) {
        manifest.warnings.push(`Line ${lineNumber}: Inline background - ${validation.warning} "${url}"`);
      }
    }
  }

  // ==========================================
  // Extract @font-face src: url(...)
  // ==========================================
  const fontFacePattern = /@font-face\s*\{[^}]*src:\s*([^;]+)/gi;
  while ((match = fontFacePattern.exec(css)) !== null) {
    const srcValue = match[1];
    const lineNumber = getLineNumber(css, match.index);

    // Extract all url() values from the src property
    const urlInSrcPattern = /url\(["']?([^"')]+)["']?\)/gi;
    let urlMatch: RegExpExecArray | null;

    while ((urlMatch = urlInSrcPattern.exec(srcValue)) !== null) {
      const url = urlMatch[1];
      const validation = validateAssetURL(url, '@font-face src', lineNumber);
      manifest.fonts.push(validation);

      const urlKey = `font:${url}`;
      if (!seenUrls.has(urlKey)) {
        seenUrls.add(urlKey);
        if (validation.error) {
          manifest.errors.push(`CSS Line ${lineNumber}: Font - ${validation.error} "${url}"`);
        }
        if (validation.warning) {
          manifest.warnings.push(`CSS Line ${lineNumber}: Font - ${validation.warning} "${url}"`);
        }
      }
    }
  }

  // ==========================================
  // Calculate statistics
  // ==========================================
  const allAssets = [
    ...manifest.images,
    ...manifest.backgroundImages,
    ...manifest.fonts,
  ];

  manifest.stats.total = allAssets.length;
  manifest.stats.valid = allAssets.filter(a => a.isValid).length;
  manifest.stats.invalid = allAssets.filter(a => !a.isValid).length;
  manifest.stats.dataUris = allAssets.filter(a => a.type === 'data-uri').length;
  manifest.stats.relativePaths = allAssets.filter(a => a.type === 'relative').length;

  return manifest;
}

// ============================================
// GOOGLE FONTS DETECTION
// ============================================

/**
 * Detect Google Fonts links in HTML content.
 *
 * @param html - HTML content to scan
 * @returns Google Fonts info or null if none found
 */
export function detectGoogleFonts(html: string): GoogleFontInfo | null {
  // Match Google Fonts link tags (various formats)
  const linkPatterns = [
    /<link[^>]+href=["']([^"']*fonts\.googleapis\.com\/css2?[^"']*)["'][^>]*>/gi,
    /<link[^>]+href=["']([^"']*fonts\.gstatic\.com[^"']*)["'][^>]*>/gi,
  ];

  const results: GoogleFontInfo[] = [];

  for (const pattern of linkPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const url = match[1];
      const linkTag = match[0];

      // Skip font files (gstatic), only process API URLs
      if (url.includes('fonts.gstatic.com')) {
        continue;
      }

      const info = parseGoogleFontsUrl(url);
      if (info) {
        results.push({
          ...info,
          linkTag,
          url,
        });
      }
    }
  }

  if (results.length === 0) {
    return null;
  }

  // Merge multiple Google Fonts links into one result
  const merged: GoogleFontInfo = {
    families: [],
    weights: [],
    linkTag: results[0].linkTag,
    url: results[0].url,
  };

  for (const result of results) {
    merged.families.push(...result.families);
    merged.weights.push(...result.weights);
  }

  // Deduplicate
  merged.families = [...new Set(merged.families)];
  merged.weights = [...new Set(merged.weights)];

  return merged;
}

/**
 * Parse a Google Fonts URL to extract font families and weights.
 */
function parseGoogleFontsUrl(url: string): { families: string[]; weights: string[] } | null {
  const families: string[] = [];
  const weights: string[] = [];

  try {
    // Handle both encoded and decoded URLs
    const decodedUrl = decodeURIComponent(url);

    // Format 1: CSS2 API - family=Roboto:wght@400;700|Open+Sans:wght@400
    const css2Match = decodedUrl.match(/family=([^&]+)/);
    if (css2Match) {
      const familyStr = css2Match[1];
      // Split by | for multiple families
      const familyParts = familyStr.split('|');

      for (const part of familyParts) {
        // Split by : to separate name from weights
        const [name, weightStr] = part.split(':');
        if (name) {
          // Convert + to spaces
          families.push(name.replace(/\+/g, ' '));
        }

        if (weightStr) {
          // Handle various weight formats
          // wght@400;700 or ital,wght@0,400;1,700
          const weightMatch = weightStr.match(/wght@([\d;,]+)/);
          if (weightMatch) {
            const weightValues = weightMatch[1].split(/[;,]/).filter(w => /^\d+$/.test(w));
            weights.push(...weightValues);
          }
        }
      }
    }

    // Format 2: Legacy CSS API - family=Roboto:400,700|Open+Sans
    const legacyMatch = decodedUrl.match(/family=([^&]+)/);
    if (legacyMatch && families.length === 0) {
      const familyStr = legacyMatch[1];
      const parts = familyStr.split('|');

      for (const part of parts) {
        const [name, weightStr] = part.split(':');
        if (name) {
          families.push(name.replace(/\+/g, ' '));
        }
        if (weightStr) {
          const weightValues = weightStr.split(',').filter(w => /^\d+$/.test(w));
          weights.push(...weightValues);
        }
      }
    }

    if (families.length === 0) {
      return null;
    }

    return {
      families: [...new Set(families)],
      weights: [...new Set(weights)],
    };
  } catch {
    return null;
  }
}

// ============================================
// ASSET REPLACEMENT HELPERS
// ============================================

/**
 * Options for replacing invalid asset URLs.
 */
export interface AssetReplacementOptions {
  /** Placeholder URL to use for invalid images */
  placeholderImage?: string;
  /** Whether to remove invalid images entirely */
  removeInvalid?: boolean;
  /** Whether to convert data URIs to placeholder */
  convertDataUris?: boolean;
}

/**
 * Process HTML and replace/flag invalid asset URLs.
 *
 * @param html - Original HTML content
 * @param options - Replacement options
 * @returns Processed HTML and list of replacements made
 */
export function processAssetUrls(
  html: string,
  options: AssetReplacementOptions = {}
): {
  html: string;
  replacements: Array<{ original: string; replacement: string; reason: string }>;
} {
  const {
    placeholderImage = 'https://via.placeholder.com/400x300?text=Image+Required',
    removeInvalid = false,
    convertDataUris = false,
  } = options;

  const replacements: Array<{ original: string; replacement: string; reason: string }> = [];
  let processedHtml = html;

  // Process <img> tags
  processedHtml = processedHtml.replace(
    /<img([^>]*)src=["']([^"']+)["']([^>]*)>/gi,
    (fullMatch, before, src, after) => {
      const validation = validateAssetURL(src);

      if (validation.isValid) {
        // If protocol-relative, upgrade to https
        if (validation.type === 'protocol-relative') {
          const newSrc = `https:${src}`;
          replacements.push({
            original: src,
            replacement: newSrc,
            reason: 'Upgraded protocol-relative URL to HTTPS',
          });
          return `<img${before}src="${newSrc}"${after}>`;
        }
        return fullMatch;
      }

      if (validation.type === 'data-uri' && !convertDataUris) {
        // Keep data URIs as-is (they work, just with warnings)
        return fullMatch;
      }

      if (removeInvalid) {
        replacements.push({
          original: src,
          replacement: '[removed]',
          reason: validation.error || 'Invalid URL',
        });
        return ''; // Remove the entire img tag
      }

      // Replace with placeholder
      replacements.push({
        original: src,
        replacement: placeholderImage,
        reason: validation.error || 'Invalid URL',
      });
      return `<img${before}src="${placeholderImage}"${after} data-original-src="${src.replace(/"/g, '&quot;')}">`;
    }
  );

  return { html: processedHtml, replacements };
}

// ============================================
// VALIDATION SUMMARY
// ============================================

/**
 * Generate a human-readable validation summary.
 */
export function generateValidationSummary(manifest: AssetManifest): string {
  const lines: string[] = [];

  lines.push(`Asset Validation Summary`);
  lines.push(`========================`);
  lines.push(`Total assets: ${manifest.stats.total}`);
  lines.push(`  Valid: ${manifest.stats.valid}`);
  lines.push(`  Invalid: ${manifest.stats.invalid}`);
  lines.push(`  Data URIs: ${manifest.stats.dataUris}`);
  lines.push(`  Relative paths: ${manifest.stats.relativePaths}`);

  if (manifest.errors.length > 0) {
    lines.push(``);
    lines.push(`Errors (${manifest.errors.length}):`);
    for (const error of manifest.errors) {
      lines.push(`  ❌ ${error}`);
    }
  }

  if (manifest.warnings.length > 0) {
    lines.push(``);
    lines.push(`Warnings (${manifest.warnings.length}):`);
    for (const warning of manifest.warnings) {
      lines.push(`  ⚠️ ${warning}`);
    }
  }

  if (manifest.stats.invalid > 0) {
    lines.push(``);
    lines.push(`Action Required:`);
    lines.push(`  Upload images to a CDN or Webflow Assets and update URLs.`);
  }

  return lines.join('\n');
}

/**
 * CSS Minifier
 *
 * Minifies CSS to reduce size for Webflow embed blocks.
 * Webflow has character limits on embed blocks (~10KB soft limit).
 */

// ============================================
// TYPES
// ============================================

export interface MinificationStats {
  originalSize: number;
  minifiedSize: number;
  reduction: number;        // Bytes saved
  reductionPercent: number; // Percentage reduction
}

export interface MinifyOptions {
  /** Remove comments (default: true) */
  removeComments?: boolean;
  /** Remove whitespace (default: true) */
  removeWhitespace?: boolean;
}

// ============================================
// MINIFICATION
// ============================================

/**
 * Minify CSS for embed blocks to maximize character limit usage
 *
 * Applies aggressive minification including:
 * - Removes comments
 * - Removes newlines and collapses whitespace
 * - Removes spaces around special characters ({, }, :, ;, ,)
 * - Removes trailing semicolons before closing braces
 * - Preserves strings (content, url) with escaped quotes
 * - Preserves spaces in calc() expressions where required
 *
 * @example
 * const minified = minifyCSS(`
 *   .hero::before {
 *     content: "";
 *     position: absolute;
 *     top: 0;
 *     left: 0;
 *     background: rgba(0, 0, 0, 0.5);
 *   }
 * `);
 * // Result: .hero::before{content:"";position:absolute;top:0;left:0;background:rgba(0,0,0,0.5)}
 */
export function minifyCSS(css: string, options: MinifyOptions = {}): string {
  const {
    removeComments = true,
    removeWhitespace = true,
  } = options;

  if (!css || !css.trim()) {
    return '';
  }

  let result = css;

  // Step 1: Preserve strings (content, url) by replacing with placeholders
  const strings: string[] = [];
  result = result.replace(/(["'])(?:(?!\1)[^\\]|\\.)*\1/g, (match) => {
    strings.push(match);
    return `__STRING_${strings.length - 1}__`;
  });

  // Step 2: Remove comments
  if (removeComments) {
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  // Step 3: Remove newlines and collapse whitespace
  if (removeWhitespace) {
    result = result.replace(/\s+/g, ' ');

    // Step 4: Remove spaces around special characters
    result = result.replace(/\s*{\s*/g, '{');
    result = result.replace(/\s*}\s*/g, '}');
    result = result.replace(/\s*;\s*/g, ';');
    result = result.replace(/\s*:\s*/g, ':');
    result = result.replace(/\s*,\s*/g, ',');

    // Step 5: Remove trailing semicolons before closing braces
    result = result.replace(/;}/g, '}');

    // Step 6: Trim
    result = result.trim();
  }

  // Step 7: Restore preserved strings
  result = result.replace(/__STRING_(\d+)__/g, (_, index) => {
    return strings[parseInt(index, 10)];
  });

  return result;
}

/**
 * Minify CSS and return statistics about size reduction
 */
export function minifyCSSWithStats(css: string, options: MinifyOptions = {}): {
  css: string;
  stats: MinificationStats;
} {
  const originalSize = new Blob([css]).size;
  const minified = minifyCSS(css, options);
  const minifiedSize = new Blob([minified]).size;

  return {
    css: minified,
    stats: {
      originalSize,
      minifiedSize,
      reduction: originalSize - minifiedSize,
      reductionPercent: Math.round((1 - minifiedSize / originalSize) * 100),
    },
  };
}

/**
 * Get size reduction statistics (legacy function for compatibility)
 */
export function getMinificationStats(original: string, minified: string): {
  originalSize: number;
  minifiedSize: number;
  savedBytes: number;
  savedPercent: number;
} {
  const originalSize = new TextEncoder().encode(original).length;
  const minifiedSize = new TextEncoder().encode(minified).length;
  const savedBytes = originalSize - minifiedSize;
  const savedPercent = originalSize > 0 ? (savedBytes / originalSize) * 100 : 0;

  return {
    originalSize,
    minifiedSize,
    savedBytes,
    savedPercent: Math.round(savedPercent * 100) / 100, // Round to 2 decimals
  };
}

/**
 * Check if CSS exceeds size limits
 */
export function checkSizeLimit(css: string): {
  size: number;
  exceedsSoftLimit: boolean;
  exceedsHardLimit: boolean;
  warning?: string;
} {
  const size = new TextEncoder().encode(css).length;
  const SOFT_LIMIT = 10 * 1024; // 10KB
  const HARD_LIMIT = 100 * 1024; // 100KB

  const result = {
    size,
    exceedsSoftLimit: size > SOFT_LIMIT,
    exceedsHardLimit: size > HARD_LIMIT,
  };

  if (result.exceedsHardLimit) {
    return {
      ...result,
      warning: `CSS exceeds 100KB hard limit (${Math.round(size / 1024)}KB). Consider splitting into multiple embeds.`,
    };
  }

  if (result.exceedsSoftLimit) {
    return {
      ...result,
      warning: `CSS exceeds 10KB soft limit (${Math.round(size / 1024)}KB). May impact page performance.`,
    };
  }

  return result;
}

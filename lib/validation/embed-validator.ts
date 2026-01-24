/**
 * Embed Validator
 *
 * Validates CSS and JavaScript embeds for Webflow custom code
 * Checks syntax, size limits, and dangerous patterns
 */

export interface EmbedValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  size: number;
  sizeFormatted: string;
}

/**
 * Webflow custom code size limits (approximate)
 */
const SIZE_LIMITS = {
  CSS_SOFT: 10 * 1024, // 10KB - warn
  CSS_HARD: 50 * 1024, // 50KB - error
  JS_SOFT: 20 * 1024, // 20KB - warn
  JS_HARD: 100 * 1024, // 100KB - error
};

/**
 * Dangerous JavaScript patterns that should be avoided
 */
const DANGEROUS_JS_PATTERNS = [
  { pattern: /document\.write\s*\(/gi, message: 'document.write() can break the page' },
  { pattern: /eval\s*\(/gi, message: 'eval() is a security risk' },
  {
    pattern: /new\s+Function\s*\(/gi,
    message: 'new Function() is a security risk (similar to eval)',
  },
  {
    pattern: /<script[^>]*src\s*=\s*["'](?!https:)/gi,
    message: 'Non-HTTPS script sources are not allowed',
  },
];

/**
 * Format file size for display
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
}

/**
 * Basic CSS syntax validation
 */
function validateCSSSyntax(css: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for unclosed braces
  let braceDepth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    const prevChar = i > 0 ? css[i - 1] : '';

    // Track string boundaries
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    // Track brace depth (only outside strings)
    if (!inString) {
      if (char === '{') {
        braceDepth++;
      } else if (char === '}') {
        braceDepth--;
      }
    }

    // Negative depth means more closing than opening
    if (braceDepth < 0) {
      errors.push('Unmatched closing brace "}" found');
      break;
    }
  }

  // Check final depth
  if (braceDepth > 0) {
    errors.push(`${braceDepth} unclosed brace${braceDepth > 1 ? 's' : ''} found`);
  } else if (braceDepth < 0 && errors.length === 0) {
    errors.push('More closing braces than opening braces');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Basic JavaScript syntax validation
 */
function validateJSSyntax(js: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Try to parse with Function constructor (safer than eval)
  try {
    // Wrap in function to allow top-level await, const, etc.
    new Function(js);
  } catch (error) {
    if (error instanceof Error) {
      errors.push(`Syntax error: ${error.message}`);
    } else {
      errors.push('Unknown syntax error');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check for dangerous JavaScript patterns
 */
function checkDangerousPatterns(js: string): string[] {
  const warnings: string[] = [];

  for (const { pattern, message } of DANGEROUS_JS_PATTERNS) {
    if (pattern.test(js)) {
      warnings.push(message);
      // Reset regex state
      pattern.lastIndex = 0;
    }
  }

  return warnings;
}

/**
 * Validate CSS embed
 */
export function validateCSSEmbed(css: string): EmbedValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Calculate size
  const size = new Blob([css]).size;
  const sizeFormatted = formatSize(size);

  // Check size limits
  if (size > SIZE_LIMITS.CSS_HARD) {
    errors.push(`CSS is ${sizeFormatted} - exceeds Webflow limit (~50KB)`);
  } else if (size > SIZE_LIMITS.CSS_SOFT) {
    warnings.push(`CSS is ${sizeFormatted} - consider optimizing (soft limit: 10KB)`);
  }

  // Validate syntax
  const syntaxValidation = validateCSSSyntax(css);
  errors.push(...syntaxValidation.errors);

  // Check for inline <style> tags (shouldn't be there)
  if (/<style/i.test(css)) {
    errors.push('CSS contains <style> tags - embed should only contain CSS content');
  }

  // Check for inline <script> tags (definitely wrong)
  if (/<script/i.test(css)) {
    errors.push('CSS contains <script> tags - this should be in JS embed instead');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    size,
    sizeFormatted,
  };
}

/**
 * Validate JavaScript embed
 */
export function validateJSEmbed(js: string): EmbedValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Calculate size
  const size = new Blob([js]).size;
  const sizeFormatted = formatSize(size);

  // Check size limits
  if (size > SIZE_LIMITS.JS_HARD) {
    errors.push(`JavaScript is ${sizeFormatted} - exceeds Webflow limit (~100KB)`);
  } else if (size > SIZE_LIMITS.JS_SOFT) {
    warnings.push(`JavaScript is ${sizeFormatted} - consider optimizing (soft limit: 20KB)`);
  }

  // Validate syntax (basic check)
  const syntaxValidation = validateJSSyntax(js);
  errors.push(...syntaxValidation.errors);

  // Check for dangerous patterns
  const dangerousWarnings = checkDangerousPatterns(js);
  warnings.push(...dangerousWarnings);

  // Check for inline <script> tags (shouldn't be there)
  if (/<script/i.test(js)) {
    errors.push('JavaScript contains <script> tags - embed should only contain JS content');
  }

  // Check for inline <style> tags (wrong place)
  if (/<style/i.test(js)) {
    warnings.push('JavaScript contains <style> tags - this should be in CSS embed instead');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    size,
    sizeFormatted,
  };
}

/**
 * Validate library import URLs
 */
export function validateLibraryImports(imports: {
  scripts: string[];
  styles: string[];
}): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate script URLs
  for (const url of imports.scripts) {
    if (!url.startsWith('https://')) {
      errors.push(`Script URL must use HTTPS: ${url}`);
    }

    // Check for known CDNs
    const knownCDNs = ['jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com', 'cdn.skypack.dev'];
    const isKnownCDN = knownCDNs.some((cdn) => url.includes(cdn));

    if (!isKnownCDN) {
      warnings.push(`Script from unknown CDN: ${url} - verify it's trustworthy`);
    }
  }

  // Validate style URLs
  for (const url of imports.styles) {
    if (!url.startsWith('https://')) {
      errors.push(`Style URL must use HTTPS: ${url}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format embed validation results for display
 */
export function formatEmbedValidation(
  type: 'CSS' | 'JS',
  result: EmbedValidationResult
): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push(`✅ ${type} embed is valid (${result.sizeFormatted})`);
  } else {
    lines.push(`❌ ${type} embed validation failed`);
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('ERRORS:');
    result.errors.forEach((err) => lines.push(`  • ${err}`));
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('WARNINGS:');
    result.warnings.forEach((warn) => lines.push(`  • ${warn}`));
  }

  return lines.join('\n');
}

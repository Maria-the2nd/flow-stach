/**
 * HTML Structure Validation
 *
 * Detects problematic HTML patterns before Webflow conversion:
 * - Nested forms (invalid HTML that breaks form submission)
 * - Missing alt attributes (accessibility violation)
 * - Empty links (accessibility and SEO issue)
 * - Invalid nesting (e.g., <p> containing block elements)
 * - Deprecated elements (center, font, marquee, etc.)
 */

import {
  ValidationSeverity,
  ValidationIssue,
  ValidationResult,
  ErrorIssueCodes,
  WarningIssueCodes,
  InfoIssueCodes,
  error,
  warning,
  info,
  createValidationResult,
} from "./validation-types";

// ============================================
// TYPES
// ============================================

export interface HTMLValidationResult extends ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Inline elements that cannot contain block elements.
 */
const INLINE_ELEMENTS = new Set([
  'span', 'a', 'strong', 'em', 'b', 'i', 'u', 'small', 'sub', 'sup',
  'abbr', 'cite', 'code', 'kbd', 'mark', 'q', 's', 'samp', 'var',
]);

/**
 * Block elements that should not be inside inline elements.
 */
const BLOCK_ELEMENTS = new Set([
  'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'section', 'article', 'aside', 'header', 'footer', 'nav', 'main',
  'table', 'form', 'fieldset', 'blockquote', 'pre', 'hr', 'figure',
]);

/**
 * Deprecated HTML elements with suggested replacements.
 */
const DEPRECATED_ELEMENTS: Record<string, string> = {
  'center': 'Use CSS text-align: center instead',
  'font': 'Use CSS font properties instead',
  'marquee': 'Use CSS animations instead',
  'blink': 'This element is not supported',
  'big': 'Use CSS font-size instead',
  'strike': 'Use <del> or <s> instead',
  'tt': 'Use <code> or CSS font-family: monospace instead',
  'frame': 'Use <iframe> instead',
  'frameset': 'Framesets are not supported',
  'noframes': 'Not needed - framesets are not supported',
  'applet': 'Use <object> or modern web technologies',
  'basefont': 'Use CSS instead',
  'dir': 'Use <ul> instead',
  'isindex': 'Use <form> and <input> instead',
  'menu': 'Use <ul> with appropriate styling',
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get the approximate line number for a position in the HTML string.
 */
function getLineNumber(html: string, index: number): number {
  const upToIndex = html.slice(0, index);
  return (upToIndex.match(/\n/g) || []).length + 1;
}

/**
 * Truncate a string to a maximum length.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

// ============================================
// DETECTION FUNCTIONS
// ============================================

/**
 * Detect nested form elements.
 * Nested forms are invalid HTML and will cause unpredictable behavior in Webflow.
 */
export function detectNestedForms(html: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Simple approach: count open/close form tags
  let formDepth = 0;
  const formPattern = /<\/?form\b[^>]*>/gi;
  let match;

  while ((match = formPattern.exec(html)) !== null) {
    const tag = match[0].toLowerCase();

    if (tag.startsWith('<form') && !tag.includes('/>')) {
      formDepth++;
      if (formDepth > 1) {
        issues.push(error(
          ErrorIssueCodes.NESTED_FORM,
          'Nested <form> element detected - forms cannot be nested',
          {
            context: 'form',
            lineNumber: getLineNumber(html, match.index),
            suggestion: 'Remove the inner form or restructure to avoid nesting',
          }
        ));
      }
    } else if (tag.startsWith('</form')) {
      formDepth = Math.max(0, formDepth - 1);
    }
  }

  return issues;
}

/**
 * Detect images missing alt attributes.
 * Missing alt is an accessibility violation.
 */
export function detectMissingAlt(html: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Match <img> tags
  const imgPattern = /<img\b[^>]*>/gi;
  let match;

  while ((match = imgPattern.exec(html)) !== null) {
    const imgTag = match[0];

    // Check if alt attribute exists (including empty alt="")
    const hasAlt = /\balt\s*=/i.test(imgTag);

    if (!hasAlt) {
      // Extract src for context
      const srcMatch = imgTag.match(/src\s*=\s*["']([^"']+)["']/i);
      const src = srcMatch ? srcMatch[1] : 'unknown';

      issues.push(warning(
        WarningIssueCodes.MISSING_ALT,
        `Image missing alt attribute: ${truncate(src, 50)}`,
        {
          context: 'img',
          lineNumber: getLineNumber(html, match.index),
          suggestion: 'Add alt="" for decorative images or descriptive text for meaningful images',
        }
      ));
    }
  }

  return issues;
}

/**
 * Detect empty links without accessible text.
 * Empty links are an accessibility and SEO issue.
 */
export function detectEmptyLinks(html: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Match <a>...</a> including content
  const linkPattern = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const [fullMatch, content] = match;
    const anchorTag = fullMatch.match(/<a\b[^>]*>/i)?.[0] || '';

    // Check if has aria-label
    const hasAriaLabel = /\baria-label\s*=\s*["'][^"']+["']/i.test(anchorTag);

    // Check if content has actual text (not just HTML tags)
    // Strip HTML tags and check for remaining text
    const textContent = content.replace(/<[^>]*>/g, '').trim();
    const hasTextContent = textContent.length > 0;

    // Check if contains img with non-empty alt text
    // Note: alt="" means decorative image, which doesn't provide accessible text
    const imgAltMatch = content.match(/<img[^>]*\balt\s*=\s*["']([^"']*)["'][^>]*>/i);
    const hasImgWithAlt = imgAltMatch !== null && imgAltMatch[1].trim().length > 0;

    // Check if contains SVG with title or aria-label
    const hasSvgWithAccessibleName = /<svg[^>]*(?:aria-label|aria-labelledby|role=["']img["'][^>]*aria-label)/i.test(content) ||
      /<svg[^>]*>[\s\S]*?<title>/i.test(content);

    if (!hasAriaLabel && !hasTextContent && !hasImgWithAlt && !hasSvgWithAccessibleName) {
      // Extract href for context
      const hrefMatch = anchorTag.match(/href\s*=\s*["']([^"']+)["']/i);
      const href = hrefMatch ? truncate(hrefMatch[1], 30) : 'unknown';

      issues.push(warning(
        WarningIssueCodes.EMPTY_LINK,
        `Empty link without accessible text: ${href}`,
        {
          context: 'a',
          lineNumber: getLineNumber(html, match.index),
          suggestion: 'Add text content or aria-label for accessibility',
        }
      ));
    }
  }

  return issues;
}

/**
 * Detect invalid nesting (block elements inside inline elements).
 */
export function detectInvalidNesting(html: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const foundIssues = new Set<string>(); // Avoid duplicate reports

  // Pattern to detect inline elements containing block elements
  // This is simplified - a full parser would be more accurate
  const inlineArray = Array.from(INLINE_ELEMENTS);
  const blockArray = Array.from(BLOCK_ELEMENTS);

  for (const inline of inlineArray) {
    const pattern = new RegExp(
      `<${inline}\\b[^>]*>[\\s\\S]*?<(${blockArray.join('|')})\\b`,
      'gi'
    );

    let match;
    while ((match = pattern.exec(html)) !== null) {
      const blockElement = match[1].toLowerCase();
      const issueKey = `${inline}:${blockElement}:${match.index}`;

      // Skip if we've already reported this specific nesting at this location
      if (foundIssues.has(issueKey)) continue;
      foundIssues.add(issueKey);

      issues.push(warning(
        WarningIssueCodes.INVALID_NESTING,
        `Block element <${blockElement}> inside inline element <${inline}>`,
        {
          context: inline,
          lineNumber: getLineNumber(html, match.index),
          suggestion: `Move <${blockElement}> outside of <${inline}> or use <div> instead of <${inline}>`,
        }
      ));
    }
  }

  // Special case: anything inside <p> that's a block element
  const pBlockPattern = /<p\b[^>]*>[\s\S]*?<(div|section|article|header|footer|ul|ol|table|form|blockquote)\b/gi;
  let pMatch;
  while ((pMatch = pBlockPattern.exec(html)) !== null) {
    const blockElement = pMatch[1].toLowerCase();
    const issueKey = `p:${blockElement}:${pMatch.index}`;

    // Skip if we've already reported this specific nesting at this location
    if (foundIssues.has(issueKey)) continue;
    foundIssues.add(issueKey);

    issues.push(warning(
      WarningIssueCodes.INVALID_NESTING,
      `Block element <${blockElement}> inside <p> element`,
      {
        context: 'p',
        lineNumber: getLineNumber(html, pMatch.index),
        suggestion: `Close the <p> before <${blockElement}> or restructure the HTML`,
      }
    ));
  }

  return issues;
}

/**
 * Detect deprecated HTML elements.
 */
export function detectDeprecatedElements(html: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [element, suggestion] of Object.entries(DEPRECATED_ELEMENTS)) {
    const pattern = new RegExp(`<${element}\\b`, 'gi');
    let match;

    while ((match = pattern.exec(html)) !== null) {
      issues.push(info(
        InfoIssueCodes.DEPRECATED_ELEMENT,
        `Deprecated element <${element}> detected`,
        {
          context: element,
          lineNumber: getLineNumber(html, match.index),
          suggestion,
        }
      ));
    }
  }

  return issues;
}

// ============================================
// MASTER VALIDATION FUNCTION
// ============================================

/**
 * Validate HTML structure for common issues.
 * Call this before Webflow conversion to detect problematic patterns.
 */
export function validateHTMLStructure(html: string): HTMLValidationResult {
  if (!html || typeof html !== 'string') {
    return {
      isValid: true,
      canProceed: true,
      issues: [],
      errors: [],
      warnings: [],
      info: [],
      summary: 'No HTML to validate',
    };
  }

  // Run all detectors
  const nestedForms = detectNestedForms(html);
  const missingAlts = detectMissingAlt(html);
  const emptyLinks = detectEmptyLinks(html);
  const invalidNesting = detectInvalidNesting(html);
  const deprecated = detectDeprecatedElements(html);

  // Collect all issues
  const allIssues = [
    ...nestedForms,
    ...missingAlts,
    ...emptyLinks,
    ...invalidNesting,
    ...deprecated,
  ];

  // Sort into severity buckets
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const infoIssues: ValidationIssue[] = [];

  for (const issue of allIssues) {
    switch (issue.severity) {
      case ValidationSeverity.FATAL:
      case ValidationSeverity.ERROR:
        errors.push(issue);
        break;
      case ValidationSeverity.WARNING:
        warnings.push(issue);
        break;
      case ValidationSeverity.INFO:
        infoIssues.push(issue);
        break;
    }
  }

  // Create the standard validation result
  const baseResult = createValidationResult(allIssues);

  return {
    ...baseResult,
    errors,
    warnings,
    info: infoIssues,
  };
}

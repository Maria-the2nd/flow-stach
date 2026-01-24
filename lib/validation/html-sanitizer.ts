/**
 * HTML Sanitizer for Webflow Conversion
 *
 * Fixes HTML patterns that cause React error #137 in Webflow Designer
 * Run this BEFORE sending HTML to Claude API for conversion
 *
 * Based on: docs/cli-prompts/html-sanitizer.ts
 * Enhanced for: Flow Bridge multi-output system
 */

export interface HTMLSanitizationResult {
  sanitizedHTML: string;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  changesApplied: string[];
}

/**
 * Sanitize HTML to be compatible with Webflow's React renderer
 *
 * Fixes:
 * 1. <br> inside inline elements with text: <span>A<br>B</span> → <span>A</span><br><span>B</span>
 * 2. Mixed inline + br at document level
 * 3. Nested inline elements with br children
 *
 * @param html - Raw HTML string
 * @returns Sanitized HTML safe for Webflow conversion
 */
export function sanitizeHTMLForWebflow(html: string): string {
  let sanitized = html;

  // Pattern 1: <span>text<br>text</span> → <span>text</span><br><span>text</span>
  sanitized = fixBrInInlineElements(sanitized);

  // Pattern 2: Multiple <br> in sequence - ensure proper spacing
  sanitized = normalizeBrSequences(sanitized);

  // Pattern 3: Self-closing br variations
  sanitized = normalizeBrTags(sanitized);

  return sanitized;
}

/**
 * Fix <br> inside inline elements that contain text
 */
function fixBrInInlineElements(html: string): string {
  // Match patterns like: <span>text<br>text</span>
  const inlineWithBr = /<(span|a|strong|em|i|b)([^>]*)>([^<]*)<br\s*\/?>([^<]*)<\/(span|a|strong|em|i|b)>/gi;

  return html.replace(inlineWithBr, (match, tag, attrs, beforeBr, afterBr) => {
    // Skip if both parts are empty
    if (!beforeBr.trim() && !afterBr.trim()) {
      return match;
    }

    // Split into: <tag>before</tag><br><tag>after</tag>
    let result = '';

    if (beforeBr.trim()) {
      result += `<${tag}${attrs}>${beforeBr}</${tag}>`;
    }

    result += '<br>';

    if (afterBr.trim()) {
      result += `<${tag}${attrs}>${afterBr}</${tag}>`;
    }

    return result;
  });
}

/**
 * Normalize multiple <br> sequences
 */
function normalizeBrSequences(html: string): string {
  // Replace multiple consecutive <br> with proper spacing
  return html.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
}

/**
 * Normalize <br> tag variations to consistent format
 */
function normalizeBrTags(html: string): string {
  // Convert <br/>, <br />, <BR>, etc. to <br>
  return html.replace(/<br\s*\/?>/gi, '<br>');
}

/**
 * Validate HTML structure before conversion
 *
 * @param html - HTML string to validate
 * @returns Validation result with errors/warnings
 */
export function validateHTMLForWebflow(html: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for <br> inside inline elements with text
  const brInInline = /<(span|a|strong|em|i|b)[^>]*>[^<]*<br[^>]*>[^<]*<\/(span|a|strong|em|i|b)>/gi;
  const matches = html.match(brInInline);

  if (matches) {
    matches.forEach((match) => {
      errors.push(
        `Invalid structure: <br> inside inline element with text - will cause React error #137\n` +
          `  Found: ${match.substring(0, 80)}...`
      );
    });
  }

  // Check for excessive br sequences
  const excessiveBr = /(<br\s*\/?>\s*){4,}/gi;
  if (excessiveBr.test(html)) {
    warnings.push('Multiple consecutive <br> tags found - consider using proper block elements');
  }

  // Check for mixed inline content at root level
  const rootInlineMixed = /^[^<]*<(span|a|strong)[^>]*>.*<br.*<(span|a|strong)/i;
  if (rootInlineMixed.test(html.trim())) {
    warnings.push('Mixed inline elements and <br> at root level - consider wrapping in container');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Quick fix: sanitize and validate in one call
 *
 * @param html - Raw HTML
 * @returns Object with sanitized HTML and validation results
 */
export function prepareHTMLForWebflow(html: string): HTMLSanitizationResult {
  // Track changes
  const changesApplied: string[] = [];

  // Sanitize with tracking
  let sanitized = html;

  // Fix br in inline
  const beforeBrFix = sanitized;
  sanitized = fixBrInInlineElements(sanitized);
  if (beforeBrFix !== sanitized) {
    changesApplied.push('Fixed <br> inside inline elements with text');
  }

  // Normalize br sequences
  const beforeBrNorm = sanitized;
  sanitized = normalizeBrSequences(sanitized);
  if (beforeBrNorm !== sanitized) {
    changesApplied.push('Normalized multiple <br> sequences');
  }

  // Normalize br tags
  const beforeTagNorm = sanitized;
  sanitized = normalizeBrTags(sanitized);
  if (beforeTagNorm !== sanitized) {
    changesApplied.push('Normalized <br> tag format');
  }

  // Validate the sanitized result
  const validation = validateHTMLForWebflow(sanitized);

  return {
    sanitizedHTML: sanitized,
    validation,
    changesApplied,
  };
}

/**
 * Browser-safe version using DOMParser
 * Use this in frontend code where DOMParser is available
 */
export function sanitizeHTMLForWebflowDOM(html: string): string {
  if (typeof DOMParser === 'undefined') {
    // Fallback to regex version
    return sanitizeHTMLForWebflow(html);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Find all inline elements
  const inlineElements = doc.querySelectorAll('span, a, strong, em, i, b');

  inlineElements.forEach((element) => {
    const childNodes = Array.from(element.childNodes);

    // Check if element has both text and <br>
    const hasText = childNodes.some(
      (node) => node.nodeType === Node.TEXT_NODE && (node.textContent?.trim() || '')
    );
    const hasBr = childNodes.some(
      (node) => node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'BR'
    );

    if (!hasText || !hasBr) return;

    // Split the element at <br> boundaries
    const parent = element.parentElement;
    if (!parent) return;

    const parts: Node[] = [];
    let textBuffer = '';

    childNodes.forEach((node) => {
      if (node.nodeName === 'BR') {
        // Flush text buffer
        if (textBuffer.trim()) {
          const clone = element.cloneNode(false) as Element;
          clone.textContent = textBuffer;
          parts.push(clone);
        }
        parts.push(document.createElement('br'));
        textBuffer = '';
      } else if (node.nodeType === Node.TEXT_NODE) {
        textBuffer += node.textContent || '';
      }
    });

    // Flush remaining text
    if (textBuffer.trim()) {
      const clone = element.cloneNode(false) as Element;
      clone.textContent = textBuffer;
      parts.push(clone);
    }

    // Replace element with parts
    parts.forEach((part) => parent.insertBefore(part, element));
    parent.removeChild(element);
  });

  return doc.body.innerHTML;
}

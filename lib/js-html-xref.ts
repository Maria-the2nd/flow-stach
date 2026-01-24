/**
 * JavaScript to HTML Cross-Reference Validation
 *
 * Detects when JavaScript references DOM elements (by ID or class) that don't exist
 * in the HTML. This prevents broken interactivity in pasted Webflow components.
 *
 * Orphan ID references are ERROR level (getElementById will fail)
 * Orphan class references are WARNING level (querySelector may return null)
 */

import {
  ValidationIssue,
  error,
  warning,
  info,
  ErrorIssueCodes,
  WarningIssueCodes,
  InfoIssueCodes,
  createValidationResult,
  type ValidationResult,
} from './validation-types';

// ============================================
// TYPES
// ============================================

export interface XRefResult {
  /** IDs referenced in JavaScript via getElementById, querySelector('#id'), etc. */
  jsIdReferences: string[];
  /** Classes referenced in JavaScript via getElementsByClassName, querySelector('.class'), etc. */
  jsClassReferences: string[];
  /** IDs found in HTML id="" attributes */
  htmlIds: string[];
  /** Classes found in HTML class="" attributes */
  htmlClasses: string[];
  /** IDs referenced in JS but not found in HTML (ERROR level) */
  orphanIds: string[];
  /** Classes referenced in JS but not found in HTML (WARNING level) */
  orphanClasses: string[];
  /** Whether the cross-reference validation passed (no orphan IDs) */
  isValid: boolean;
  /** Dynamic references that were skipped (template literals, variables) */
  skippedDynamic: string[];
  /** Standardized validation issues */
  issues: ValidationIssue[];
  /** Standardized validation result */
  validationResult: ValidationResult;
}

// ============================================
// JAVASCRIPT REFERENCE EXTRACTION
// ============================================

/**
 * Remove JavaScript comments to avoid false positives
 */
function stripJsComments(js: string): string {
  // Remove single-line comments
  let result = js.replace(/\/\/.*$/gm, "");
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");
  return result;
}

/**
 * Check if a reference is dynamic (contains template literal or variable)
 */
function isDynamicReference(ref: string): boolean {
  // Template literal patterns
  if (ref.includes("${") || ref.includes("`")) return true;
  // Variable patterns (not a string literal)
  if (!/^['"]/.test(ref.trim())) return true;
  return false;
}

/**
 * Extract the actual string value from a quoted string
 */
function extractStringValue(quotedStr: string): string | null {
  const trimmed = quotedStr.trim();
  // Single or double quoted string
  const match = trimmed.match(/^['"](.+)['"]$/);
  return match ? match[1] : null;
}

/**
 * Extract ID references from JavaScript code
 */
export function extractJsIdReferences(js: string): { ids: string[]; skipped: string[] } {
  const cleanJs = stripJsComments(js);
  const ids = new Set<string>();
  const skipped: string[] = [];

  // Pattern 1: document.getElementById('xxx') or document.getElementById("xxx")
  const getByIdPattern = /document\.getElementById\s*\(\s*(['"`][^'"`]*['"`]|\w+)\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = getByIdPattern.exec(cleanJs)) !== null) {
    const arg = match[1];
    if (isDynamicReference(arg)) {
      skipped.push(`getElementById(${arg})`);
      continue;
    }
    const value = extractStringValue(arg);
    if (value) ids.add(value);
  }

  // Pattern 2: document.querySelector('#xxx')
  const querySelectorIdPattern = /document\.querySelector(?:All)?\s*\(\s*(['"`])#([^'"`\s,]+)\1\s*\)/g;
  while ((match = querySelectorIdPattern.exec(cleanJs)) !== null) {
    const id = match[2];
    if (id.includes("${")) {
      skipped.push(`querySelector('#${id}')`);
      continue;
    }
    ids.add(id);
  }

  // Pattern 3: jQuery $('#xxx') or jQuery("#xxx")
  const jqueryIdPattern = /\$\s*\(\s*(['"`])#([^'"`\s,]+)\1\s*\)/g;
  while ((match = jqueryIdPattern.exec(cleanJs)) !== null) {
    const id = match[2];
    if (id.includes("${")) {
      skipped.push(`$('#${id}')`);
      continue;
    }
    ids.add(id);
  }

  return { ids: Array.from(ids), skipped };
}

/**
 * Extract class references from JavaScript code
 */
export function extractJsClassReferences(js: string): { classes: string[]; skipped: string[] } {
  const cleanJs = stripJsComments(js);
  const classes = new Set<string>();
  const skipped: string[] = [];

  // Pattern 1: document.querySelector('.xxx')
  const querySelectorClassPattern = /document\.querySelector(?:All)?\s*\(\s*(['"`])\.([^'"`\s,]+)\1\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = querySelectorClassPattern.exec(cleanJs)) !== null) {
    const className = match[2];
    if (className.includes("${")) {
      skipped.push(`querySelector('.${className}')`);
      continue;
    }
    classes.add(className);
  }

  // Pattern 2: jQuery $('.xxx')
  const jqueryClassPattern = /\$\s*\(\s*(['"`])\.([^'"`\s,]+)\1\s*\)/g;
  while ((match = jqueryClassPattern.exec(cleanJs)) !== null) {
    const className = match[2];
    if (className.includes("${")) {
      skipped.push(`$('.${className}')`);
      continue;
    }
    classes.add(className);
  }

  // Pattern 3: document.getElementsByClassName('xxx')
  const getByClassPattern = /document\.getElementsByClassName\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g;
  while ((match = getByClassPattern.exec(cleanJs)) !== null) {
    const classNames = match[2];
    if (classNames.includes("${")) {
      skipped.push(`getElementsByClassName('${classNames}')`);
      continue;
    }
    // Can be space-separated multiple classes
    classNames.split(/\s+/).forEach(c => {
      if (c.trim()) classes.add(c.trim());
    });
  }

  // Pattern 4: element.classList.add/remove/toggle/contains('xxx')
  const classListPattern = /\.classList\.(?:add|remove|toggle|contains)\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g;
  while ((match = classListPattern.exec(cleanJs)) !== null) {
    const classNames = match[2];
    if (classNames.includes("${")) {
      skipped.push(`classList.*('${classNames}')`);
      continue;
    }
    // classList methods can have multiple arguments, but we're capturing one at a time
    classNames.split(/\s*,\s*/).forEach(c => {
      const clean = c.replace(/['"`]/g, "").trim();
      if (clean) classes.add(clean);
    });
  }

  return { classes: Array.from(classes), skipped };
}

// ============================================
// HTML TARGET EXTRACTION
// ============================================

/**
 * Extract all id="" values from HTML
 */
export function extractHtmlIds(html: string): string[] {
  const ids = new Set<string>();
  // Match id="xxx" or id='xxx'
  const idPattern = /\bid\s*=\s*(['"])([^'"]+)\1/gi;
  let match: RegExpExecArray | null;
  while ((match = idPattern.exec(html)) !== null) {
    ids.add(match[2]);
  }
  return Array.from(ids);
}

/**
 * Extract all class names from class="" attributes in HTML
 */
export function extractHtmlClasses(html: string): string[] {
  const classes = new Set<string>();
  // Match class="xxx yyy zzz" or class='xxx yyy zzz'
  const classPattern = /\bclass\s*=\s*(['"])([^'"]+)\1/gi;
  let match: RegExpExecArray | null;
  while ((match = classPattern.exec(html)) !== null) {
    const classValue = match[2];
    // Split by whitespace to get individual classes
    classValue.split(/\s+/).forEach(c => {
      if (c.trim()) classes.add(c.trim());
    });
  }
  return Array.from(classes);
}

// ============================================
// CROSS-REFERENCE VALIDATION
// ============================================

/**
 * Perform cross-reference validation between JavaScript and HTML.
 *
 * @param js - JavaScript code to analyze
 * @param html - HTML content to validate against
 * @returns XRefResult with validation details
 */
export function validateJsHtmlXRef(js: string, html: string): XRefResult {
  // Extract references from JavaScript
  const idExtraction = extractJsIdReferences(js);
  const classExtraction = extractJsClassReferences(js);

  // Extract targets from HTML
  const htmlIds = extractHtmlIds(html);
  const htmlClasses = extractHtmlClasses(html);

  // Build lookup sets
  const htmlIdSet = new Set(htmlIds);
  const htmlClassSet = new Set(htmlClasses);

  // Find orphans
  const orphanIds = idExtraction.ids.filter(id => !htmlIdSet.has(id));
  const orphanClasses = classExtraction.classes.filter(cls => !htmlClassSet.has(cls));

  // Combine skipped dynamic references
  const skippedDynamic = [...idExtraction.skipped, ...classExtraction.skipped];

  // Build standardized validation issues
  const issues: ValidationIssue[] = [];

  // ERROR: Orphan ID references (getElementById will fail)
  for (const id of orphanIds) {
    issues.push(error(
      ErrorIssueCodes.ORPHAN_ID_REFERENCE,
      `JavaScript references ID '${id}' that doesn't exist in HTML`,
      {
        context: `#${id}`,
        suggestion: `Add an element with id="${id}" or remove the JavaScript reference`,
      }
    ));
  }

  // WARNING: Orphan class references (querySelector may return null)
  for (const cls of orphanClasses) {
    issues.push(warning(
      WarningIssueCodes.ORPHAN_CLASS_REFERENCE,
      `JavaScript references class '${cls}' that doesn't exist in HTML`,
      {
        context: `.${cls}`,
        suggestion: `Add an element with class="${cls}" or verify the JavaScript handles null results`,
      }
    ));
  }

  // INFO: Skipped dynamic references
  for (const ref of skippedDynamic) {
    issues.push(info(
      InfoIssueCodes.DYNAMIC_REFERENCE_SKIPPED,
      `Dynamic reference skipped: ${ref}`,
      {
        context: ref,
        suggestion: 'Manually verify this dynamic reference resolves to an existing element',
      }
    ));
  }

  const validationResult = createValidationResult(issues);

  return {
    jsIdReferences: idExtraction.ids,
    jsClassReferences: classExtraction.classes,
    htmlIds,
    htmlClasses,
    orphanIds,
    orphanClasses,
    isValid: orphanIds.length === 0, // Orphan IDs are errors, orphan classes are warnings
    skippedDynamic,
    issues,
    validationResult,
  };
}

/**
 * Format XRef result for display
 */
export function formatXRefResult(result: XRefResult): string {
  const lines: string[] = [];

  if (result.isValid && result.orphanClasses.length === 0) {
    lines.push("JS-HTML Cross-Reference: PASSED");
    lines.push(`  IDs matched: ${result.jsIdReferences.length}`);
    lines.push(`  Classes matched: ${result.jsClassReferences.length}`);
    return lines.join("\n");
  }

  if (result.orphanIds.length > 0) {
    lines.push("JS-HTML Cross-Reference: ERRORS");
    lines.push("  Missing IDs (JavaScript references non-existent HTML IDs):");
    result.orphanIds.forEach(id => {
      lines.push(`    - #${id}`);
    });
  }

  if (result.orphanClasses.length > 0) {
    if (result.orphanIds.length === 0) {
      lines.push("JS-HTML Cross-Reference: WARNINGS");
    }
    lines.push("  Missing Classes (JavaScript references non-existent HTML classes):");
    result.orphanClasses.slice(0, 10).forEach(cls => {
      lines.push(`    - .${cls}`);
    });
    if (result.orphanClasses.length > 10) {
      lines.push(`    ... and ${result.orphanClasses.length - 10} more`);
    }
  }

  if (result.skippedDynamic.length > 0) {
    lines.push("  Skipped (dynamic references):");
    result.skippedDynamic.slice(0, 5).forEach(ref => {
      lines.push(`    - ${ref}`);
    });
    if (result.skippedDynamic.length > 5) {
      lines.push(`    ... and ${result.skippedDynamic.length - 5} more`);
    }
  }

  return lines.join("\n");
}

/**
 * Quick check if JS has any DOM references that need HTML targets
 */
export function hasJsDomReferences(js: string): boolean {
  if (!js || typeof js !== "string") return false;

  const cleanJs = stripJsComments(js);

  // Quick patterns to detect any DOM reference
  const patterns = [
    /document\.getElementById/,
    /document\.querySelector/,
    /document\.getElementsByClassName/,
    /\$\s*\(\s*['"`][#.]/,
    /\.classList\./,
  ];

  return patterns.some(p => p.test(cleanJs));
}

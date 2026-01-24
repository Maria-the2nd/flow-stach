/**
 * CSS Embed Router
 *
 * Separates CSS into native Webflow styles and embed-required styles.
 * Complex CSS that Webflow can't handle natively is extracted into
 * a separate embed block instead of being discarded.
 *
 * CRITICAL: CSS variables (var(--name)) are resolved to actual values
 * when routing to native Webflow styles, since Webflow doesn't support
 * CSS custom properties in its native style system.
 */

import { minifyCSS } from './css-minifier';
import { CSSRoutingTracer } from './css-routing-tracer';
import { CSSRoutingTrace, RoutingReason, BreakpointMapping } from './routing-types';

// Re-export trace types for convenience
export type { CSSRoutingTrace } from './routing-types';
export { CSSRoutingTracer } from './css-routing-tracer';

// ============================================
// TYPES
// ============================================

export interface CSSRoutingResult {
  /** CSS suitable for Webflow native styles */
  native: string;
  /** CSS that must go into an embed block */
  embed: string;
  /** Warnings generated during routing */
  warnings: RouterWarning[];
  /** Statistics about what was routed */
  stats: RoutingStats;
  /** Optional routing trace for debugging */
  trace?: CSSRoutingTrace;
}

export interface CSSRoutingOptions {
  /** Enable tracing for debugging */
  trace?: boolean;
}

export interface RouterWarning {
  type: 'embed_routed' | 'selector_complex' | 'at_rule_extracted' | 'size_warning' | 'size_error';
  selector?: string;
  reason: string;
  severity?: 'info' | 'warning' | 'error';
}

export interface RoutingStats {
  totalRules: number;
  nativeRules: number;
  embedRules: number;
  atRulesExtracted: number;
  embedSizeBytes: number;
}

export interface ExtractedRule {
  selector: string;
  properties: string;
  breakpoint: BreakpointKey | null;
  originalMediaQuery?: string;
}

export type BreakpointKey = 'base' | 'medium' | 'small' | 'tiny' | 'xlarge' | 'xxlarge' | 'xxxlarge';

// ============================================
// CSS VARIABLE TYPES AND RESOLUTION
// ============================================

/**
 * Map of CSS variable names to their values
 * Keys include the -- prefix: '--text-dark': '#1a1a1a'
 */
export interface CSSVariableMap {
  [variableName: string]: string;
}

/**
 * Result of resolving CSS variables in a value
 */
export interface VariableResolutionResult {
  /** The resolved value with var() replaced by actual values */
  resolved: string;
  /** Whether the original value contained var() references */
  hadVariables: boolean;
  /** List of variable names that couldn't be resolved */
  unresolvedVars: string[];
}

/**
 * Extract all CSS variables from :root blocks in CSS
 * Handles multiple :root blocks and merges them (first definition wins)
 */
export function extractCSSVariables(css: string): CSSVariableMap {
  const variables: CSSVariableMap = {};

  // Find all :root blocks - supports multiple blocks
  const rootRegex = /:root\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gi;
  let rootMatch;

  while ((rootMatch = rootRegex.exec(css)) !== null) {
    const content = rootMatch[1];

    // Parse variable declarations: --name: value;
    const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
    let varMatch;

    while ((varMatch = varRegex.exec(content)) !== null) {
      const varName = `--${varMatch[1]}`;
      const varValue = varMatch[2].trim();

      // First definition wins (don't overwrite)
      if (!(varName in variables)) {
        variables[varName] = varValue;
      }
    }
  }

  // Also look for variables in html, body, * selectors
  const globalVarRegex = /(?:html|body|\*)\s*\{[^}]*(--([\w-]+)\s*:\s*([^;]+);)/g;
  let globalMatch;

  while ((globalMatch = globalVarRegex.exec(css)) !== null) {
    const varName = `--${globalMatch[2]}`;
    const varValue = globalMatch[3].trim();
    if (!(varName in variables)) {
      variables[varName] = varValue;
    }
  }

  return variables;
}

/**
 * Resolve all var() references in a CSS value
 * Handles nested var(), fallbacks, and var() inside calc()
 *
 * @example
 * // Simple resolution
 * resolveCSSVariable('var(--text-dark)', {'--text-dark': '#1a1a1a'})
 * // Returns: { resolved: '#1a1a1a', hadVariables: true, unresolvedVars: [] }
 *
 * // With fallback
 * resolveCSSVariable('var(--missing, #000)', {})
 * // Returns: { resolved: '#000', hadVariables: true, unresolvedVars: [] }
 *
 * // Nested fallback
 * resolveCSSVariable('var(--missing, var(--coral))', {'--coral': '#E8524B'})
 * // Returns: { resolved: '#E8524B', hadVariables: true, unresolvedVars: [] }
 */
export function resolveCSSVariable(
  value: string,
  variables: CSSVariableMap,
  maxDepth: number = 10
): VariableResolutionResult {
  // Quick check - if no var(), return immediately
  if (!value.includes('var(')) {
    return { resolved: value, hadVariables: false, unresolvedVars: [] };
  }

  let result = value;
  const unresolvedVars: string[] = [];
  let depth = 0;

  // Keep resolving until no more var() references or max depth reached
  while (result.includes('var(') && depth < maxDepth) {
    depth++;
    let madeProgress = false;

    // Resolve innermost var() first (handles nested vars)
    result = result.replace(
      /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*(?:\([^)]*\)[^)]*)*))?\)/g,
      (match, varName, fallback) => {
        madeProgress = true;

        // Check if variable exists
        if (varName in variables) {
          return variables[varName];
        }

        // Use fallback if provided
        if (fallback !== undefined) {
          return fallback.trim();
        }

        // Track unresolved variable
        if (!unresolvedVars.includes(varName)) {
          unresolvedVars.push(varName);
        }

        // Return original to preserve for debugging
        return match;
      }
    );

    // Prevent infinite loop if no progress made
    if (!madeProgress) break;
  }

  return {
    resolved: result.trim(),
    hadVariables: true,
    unresolvedVars
  };
}

/**
 * Resolve all var() references in a CSS properties string
 * Processes each property individually and returns the resolved string
 *
 * @example
 * resolveVariablesInProperties(
 *   'color: var(--text-dark); background: var(--bg)',
 *   {'--text-dark': '#1a1a1a', '--bg': '#fff'}
 * )
 * // Returns: 'color: #1a1a1a; background: #fff'
 */
export function resolveVariablesInProperties(
  properties: string,
  variables: CSSVariableMap
): { resolved: string; unresolvedVars: string[] } {
  const unresolvedVars: string[] = [];

  // Parse properties, handling values with parentheses
  const parts: string[] = [];
  let current = '';
  let parenDepth = 0;

  for (const char of properties) {
    if (char === '(') parenDepth++;
    else if (char === ')') parenDepth--;
    if (char === ';' && parenDepth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());

  // Resolve each property
  const resolvedParts: string[] = [];

  for (const part of parts) {
    const colonIndex = part.indexOf(':');
    if (colonIndex === -1) {
      resolvedParts.push(part);
      continue;
    }

    const propName = part.slice(0, colonIndex).trim();
    const propValue = part.slice(colonIndex + 1).trim();

    // Resolve variables in the value
    const resolution = resolveCSSVariable(propValue, variables);

    if (resolution.unresolvedVars.length > 0) {
      unresolvedVars.push(...resolution.unresolvedVars);
    }

    resolvedParts.push(`${propName}: ${resolution.resolved}`);
  }

  return {
    resolved: resolvedParts.join('; ') + (resolvedParts.length > 0 ? ';' : ''),
    unresolvedVars: Array.from(new Set(unresolvedVars)) // Dedupe
  };
}

/**
 * Resolve CSS variables that reference other variables (chained references)
 * This pre-processes the variable map to expand any var() in values
 *
 * @example
 * // Input: { '--spacing': 'var(--base)', '--base': '16px' }
 * // Output: { '--spacing': '16px', '--base': '16px' }
 */
export function resolveChainedVariables(
  variables: CSSVariableMap,
  maxIterations: number = 10
): { resolved: CSSVariableMap; circularRefs: string[] } {
  const resolved = { ...variables };
  const circularRefs: string[] = [];

  // Track dependency chain to detect circular references
  function detectCircular(varName: string, visitedArr: string[] = []): boolean {
    if (visitedArr.includes(varName)) return true;

    const value = resolved[varName];
    if (!value || !value.includes('var(')) return false;

    const newVisited = [...visitedArr, varName];

    // Extract referenced variables from value
    const varRefRegex = /var\(\s*(--[\w-]+)/g;
    let match;
    while ((match = varRefRegex.exec(value)) !== null) {
      const refName = match[1];
      if (refName in resolved && detectCircular(refName, newVisited)) {
        return true;
      }
    }

    return false;
  }

  // First pass: detect all circular references
  for (const varName of Object.keys(resolved)) {
    if (detectCircular(varName)) {
      if (!circularRefs.includes(varName)) {
        circularRefs.push(varName);
      }
    }
  }

  // Break circular references before resolution
  for (const varName of circularRefs) {
    resolved[varName] = resolved[varName].replace(/var\([^)]+\)/g, 'unset');
  }

  // Keep resolving until no more changes
  let iteration = 0;
  let hasChanges = true;

  while (hasChanges && iteration < maxIterations) {
    hasChanges = false;
    iteration++;

    for (const [varName, varValue] of Object.entries(resolved)) {
      if (varValue.includes('var(')) {
        const resolution = resolveCSSVariable(varValue, resolved, 1);

        if (resolution.resolved !== varValue) {
          resolved[varName] = resolution.resolved;
          hasChanges = true;
        }
      }
    }
  }

  // Warn about circular references
  if (circularRefs.length > 0) {
    console.warn('[css-embed-router] Circular variable references detected:', circularRefs);
  }

  return { resolved, circularRefs };
}

// ============================================
// PATTERN DEFINITIONS
// ============================================

/**
 * At-rules that MUST go to embed (cannot be represented in Webflow native styles)
 */
const EMBED_AT_RULE_PATTERNS: Record<string, RegExp> = {
  keyframes: /@keyframes\s+[\w-]+\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/gi,
  fontFace: /@font-face\s*\{[^}]+\}/gi,
  supports: /@supports\s*\([^)]+\)\s*\{[\s\S]*?\}(?=\s*(?:@|\.|#|[a-z]|\s*$))/gi,
  layer: /@layer\s+[\w-]+\s*\{[\s\S]*?\}(?=\s*(?:@|\.|#|[a-z]|\s*$))/gi,
  charset: /@charset\s+[^;]+;/gi,
  import: /@import\s+[^;]+;/gi,
  namespace: /@namespace\s+[^;]+;/gi,
};

/**
 * Selectors that require embed (Webflow cannot handle natively)
 */
const EMBED_SELECTOR_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // Pseudo-elements (Webflow has no ::before/::after support)
  { pattern: /::before/, reason: '::before pseudo-element' },
  { pattern: /::after/, reason: '::after pseudo-element' },
  { pattern: /::placeholder/, reason: '::placeholder pseudo-element' },
  { pattern: /::selection/, reason: '::selection pseudo-element' },
  { pattern: /::first-letter/, reason: '::first-letter pseudo-element' },
  { pattern: /::first-line/, reason: '::first-line pseudo-element' },
  { pattern: /::marker/, reason: '::marker pseudo-element' },
  { pattern: /::backdrop/, reason: '::backdrop pseudo-element' },
  { pattern: /::-webkit-/, reason: 'Webkit pseudo-element' },
  { pattern: /::-moz-/, reason: 'Mozilla pseudo-element' },

  // Complex pseudo-classes
  { pattern: /:nth-child\(/, reason: ':nth-child selector' },
  { pattern: /:nth-of-type\(/, reason: ':nth-of-type selector' },
  { pattern: /:nth-last-child\(/, reason: ':nth-last-child selector' },
  { pattern: /:nth-last-of-type\(/, reason: ':nth-last-of-type selector' },
  { pattern: /:first-of-type/, reason: ':first-of-type selector' },
  { pattern: /:last-of-type/, reason: ':last-of-type selector' },
  { pattern: /:only-child/, reason: ':only-child selector' },
  { pattern: /:only-of-type/, reason: ':only-of-type selector' },
  { pattern: /:not\(/, reason: ':not() selector' },
  { pattern: /:has\(/, reason: ':has() selector' },
  { pattern: /:where\(/, reason: ':where() selector' },
  { pattern: /:is\(/, reason: ':is() selector' },
  { pattern: /:empty/, reason: ':empty selector' },
  { pattern: /:target/, reason: ':target selector' },
  { pattern: /:focus-within/, reason: ':focus-within selector' },
  { pattern: /:checked/, reason: ':checked selector' },
  { pattern: /:disabled/, reason: ':disabled selector' },
  { pattern: /:enabled/, reason: ':enabled selector' },
  { pattern: /:required/, reason: ':required selector' },
  { pattern: /:optional/, reason: ':optional selector' },
  { pattern: /:valid/, reason: ':valid selector' },
  { pattern: /:invalid/, reason: ':invalid selector' },
  { pattern: /:in-range/, reason: ':in-range selector' },
  { pattern: /:out-of-range/, reason: ':out-of-range selector' },
  { pattern: /:read-only/, reason: ':read-only selector' },
  { pattern: /:read-write/, reason: ':read-write selector' },
  { pattern: /:default/, reason: ':default selector' },
  { pattern: /:indeterminate/, reason: ':indeterminate selector' },

  // Attribute selectors
  { pattern: /\[[\w-]+=/, reason: 'Attribute value selector' },
  { pattern: /\[[\w-]+\^=/, reason: 'Attribute starts-with selector' },
  { pattern: /\[[\w-]+\$=/, reason: 'Attribute ends-with selector' },
  { pattern: /\[[\w-]+\*=/, reason: 'Attribute contains selector' },
  { pattern: /\[[\w-]+~=/, reason: 'Attribute word selector' },
  { pattern: /\[[\w-]+\|=/, reason: 'Attribute language selector' },
  { pattern: /\[data-[\w-]+\]/, reason: 'Data attribute selector' },

  // Combinators (descendant selectors can't be represented natively)
  { pattern: /\s+>\s+/, reason: 'Child combinator (>)' },
  { pattern: /\s+\+\s+/, reason: 'Adjacent sibling combinator (+)' },
  { pattern: /\s+~\s+/, reason: 'General sibling combinator (~)' },

  // ID selectors (Webflow uses classes, not IDs for styling)
  { pattern: /^#[\w-]+\s*\{/, reason: 'ID selector' },
  { pattern: /\s#[\w-]+/, reason: 'ID selector in compound' },

  // Pure element selectors (without class)
  { pattern: /^(html|body)\s*\{/i, reason: 'html/body element selector' },
  { pattern: /^(div|span|p|a|ul|ol|li|h[1-6]|img|form|input|button|textarea|select|table|tr|td|th|thead|tbody|tfoot|nav|header|footer|main|section|article|aside|figure|figcaption|video|audio|canvas|svg|iframe)\s*\{/i, reason: 'Pure element selector' },

  // Multiple element selectors
  { pattern: /^[\w,\s]+\{/, reason: 'Element selector list' },
];

/**
 * Properties that require vendor prefixes to work correctly
 * These should be preserved in embed
 */
const VENDOR_PREFIX_PROPERTIES = [
  '-webkit-background-clip',
  '-webkit-text-fill-color',
  '-webkit-overflow-scrolling',
  '-webkit-tap-highlight-color',
  '-webkit-font-smoothing',
  '-moz-osx-font-smoothing',
  '-webkit-appearance',
  '-moz-appearance',
  '-webkit-mask',
  '-webkit-mask-image',
  'backdrop-filter', // Often needs -webkit- prefix
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a selector requires embed routing
 */
function selectorNeedsEmbed(selector: string): { needsEmbed: boolean; reason: string | null; routingReasons: RoutingReason[] } {
  const trimmed = selector.trim();
  const routingReasons: RoutingReason[] = [];

  // Check descendant selectors (space-separated classes)
  // e.g., ".parent .child" must go to embed
  if (/\.[a-zA-Z_][\w-]*\s+\.[a-zA-Z_][\w-]*/.test(trimmed)) {
    routingReasons.push({ type: 'descendant-selector' });
    return { needsEmbed: true, reason: 'Descendant selector (.parent .child)', routingReasons };
  }

  // Check compound selectors (multiple classes on same element)
  // e.g., ".class1.class2" must go to embed
  if (/\.[a-zA-Z_][\w-]*\.[a-zA-Z_][\w-]*/.test(trimmed)) {
    routingReasons.push({ type: 'compound-selector' });
    return { needsEmbed: true, reason: 'Compound selector (.class1.class2)', routingReasons };
  }

  // Check against known patterns
  for (const { pattern, reason } of EMBED_SELECTOR_PATTERNS) {
    if (pattern.test(trimmed)) {
      // Determine routing reason type from pattern/reason
      const routingReason = determineRoutingReason(reason, trimmed);
      if (routingReason) {
        routingReasons.push(routingReason);
      }
      return { needsEmbed: true, reason, routingReasons };
    }
  }

  return { needsEmbed: false, reason: null, routingReasons: [] };
}

/**
 * Determine the RoutingReason type from pattern match reason
 */
function determineRoutingReason(reason: string, selector: string): RoutingReason | null {
  if (reason.includes('pseudo-element') || reason.includes('::')) {
    const match = selector.match(/::([\w-]+)/);
    return { type: 'pseudo-element', element: match ? `::${match[1]}` : reason };
  }
  if (reason.includes(':nth-') || reason.includes(':first-of') || reason.includes(':last-of') ||
      reason.includes(':only-') || reason.includes(':not') || reason.includes(':has') ||
      reason.includes(':where') || reason.includes(':is') || reason.includes(':empty') ||
      reason.includes(':target') || reason.includes(':focus-within') || reason.includes(':checked') ||
      reason.includes(':disabled') || reason.includes(':enabled') || reason.includes(':required') ||
      reason.includes(':optional') || reason.includes(':valid') || reason.includes(':invalid')) {
    const match = reason.match(/(:[a-z-]+(?:\([^)]*\))?)/i);
    return { type: 'pseudo-class-complex', class: match ? match[1] : reason };
  }
  if (reason.includes('Attribute')) {
    const match = selector.match(/\[([\w-]+)/);
    return { type: 'attribute-selector', attribute: match ? match[1] : 'attribute' };
  }
  if (reason.includes('combinator')) {
    if (reason.includes('>')) return { type: 'combinator', combinator: '>' };
    if (reason.includes('+')) return { type: 'combinator', combinator: '+' };
    if (reason.includes('~')) return { type: 'combinator', combinator: '~' };
    return { type: 'combinator', combinator: 'combinator' };
  }
  if (reason.includes('ID selector')) {
    return { type: 'id-selector' };
  }
  if (reason.includes('element selector') || reason.includes('Tag selector')) {
    const match = selector.match(/^(\w+)/);
    return { type: 'tag-selector', tag: match ? match[1] : 'element' };
  }
  return null;
}

/**
 * Check if properties contain vendor prefixes that need embed
 */
function propertiesNeedEmbed(properties: string): { needsEmbed: boolean; reason: string | null; routingReasons: RoutingReason[] } {
  const routingReasons: RoutingReason[] = [];

  for (const prop of VENDOR_PREFIX_PROPERTIES) {
    if (properties.includes(prop)) {
      routingReasons.push({ type: 'vendor-prefix', prefix: prop });
      return { needsEmbed: true, reason: `Vendor-prefixed property: ${prop}`, routingReasons };
    }
  }

  // Check for generic vendor prefixes
  if (/-webkit-(?!background-clip)[\w-]+:/.test(properties)) {
    const match = properties.match(/-webkit-([\w-]+):/);
    if (match && !VENDOR_PREFIX_PROPERTIES.includes(`-webkit-${match[1]}`)) {
      routingReasons.push({ type: 'vendor-prefix', prefix: `-webkit-${match[1]}` });
      return { needsEmbed: true, reason: `Webkit prefix: -webkit-${match[1]}`, routingReasons };
    }
  }

  if (/-moz-[\w-]+:/.test(properties)) {
    const match = properties.match(/(-moz-[\w-]+):/);
    routingReasons.push({ type: 'vendor-prefix', prefix: match ? match[1] : '-moz-' });
    return { needsEmbed: true, reason: 'Mozilla vendor prefix', routingReasons };
  }

  if (/-ms-[\w-]+:/.test(properties)) {
    const match = properties.match(/(-ms-[\w-]+):/);
    routingReasons.push({ type: 'vendor-prefix', prefix: match ? match[1] : '-ms-' });
    return { needsEmbed: true, reason: 'Microsoft vendor prefix', routingReasons };
  }

  return { needsEmbed: false, reason: null, routingReasons: [] };
}

/**
 * Detect breakpoint from media query string
 */
function detectBreakpointFromQuery(query: string): BreakpointKey | null {
  const maxMatch = query.match(/max-width:\s*(\d+)/i);
  const minMatch = query.match(/min-width:\s*(\d+)/i);

  if (maxMatch) {
    const width = parseInt(maxMatch[1], 10);
    if (width <= 479) return 'tiny';
    if (width <= 767) return 'small';
    if (width <= 991) return 'medium';
    return null; // Desktop max-width goes to base
  }

  if (minMatch) {
    const width = parseInt(minMatch[1], 10);
    if (width >= 1920) return 'xxxlarge';
    if (width >= 1440) return 'xxlarge';
    if (width >= 1280) return 'xlarge';
    return null; // Below 1280 goes to base
  }

  return null;
}

/**
 * Extract CSS rules using proper brace matching
 */
function extractRulesWithBraceMatching(css: string): Array<{ selector: string; properties: string; fullMatch: string }> {
  const rules: Array<{ selector: string; properties: string; fullMatch: string }> = [];
  const ruleStartRegex = /([^{}@]+)\{/g;
  let match;

  while ((match = ruleStartRegex.exec(css)) !== null) {
    const selector = match[1].trim();
    const startIndex = match.index;
    const openBraceIndex = match.index + match[0].length - 1;

    // Skip if this looks like an at-rule continuation
    if (selector.startsWith('@') || !selector) continue;

    // Find matching closing brace
    let braceCount = 1;
    let i = openBraceIndex + 1;
    while (i < css.length && braceCount > 0) {
      if (css[i] === '{') braceCount++;
      else if (css[i] === '}') braceCount--;
      i++;
    }

    if (braceCount === 0) {
      const properties = css.slice(openBraceIndex + 1, i - 1).trim();
      const fullMatch = css.slice(startIndex, i);
      rules.push({ selector, properties, fullMatch });
    }
  }

  return rules;
}

/**
 * Extract media blocks with their content
 */
function extractMediaBlocks(css: string): Array<{ query: string; content: string; fullMatch: string }> {
  const results: Array<{ query: string; content: string; fullMatch: string }> = [];
  const mediaStartRegex = /@media\s*([^{]+)\s*\{/g;
  let match;

  while ((match = mediaStartRegex.exec(css)) !== null) {
    const query = match[1].trim();
    const startIndex = match.index;
    const openBraceIndex = match.index + match[0].length - 1;

    let braceCount = 1;
    let i = openBraceIndex + 1;
    while (i < css.length && braceCount > 0) {
      if (css[i] === '{') braceCount++;
      else if (css[i] === '}') braceCount--;
      i++;
    }

    if (braceCount === 0) {
      const content = css.slice(openBraceIndex + 1, i - 1);
      const fullMatch = css.slice(startIndex, i);
      results.push({ query, content, fullMatch });
    }
  }

  return results;
}

/**
 * Check if a media query is non-standard (needs embed as-is)
 */
function isNonStandardMediaQuery(query: string): boolean {
  return (
    /orientation/i.test(query) ||
    /prefers-color-scheme/i.test(query) ||
    /prefers-reduced-motion/i.test(query) ||
    /prefers-contrast/i.test(query) ||
    /print/i.test(query) ||
    /screen\s+and/i.test(query) ||
    /hover:\s*hover/i.test(query) ||
    /pointer:/i.test(query) ||
    /@container/i.test(query) ||
    /aspect-ratio/i.test(query) ||
    /resolution/i.test(query) ||
    /color-scheme/i.test(query) ||
    /display-mode/i.test(query)
  );
}

/**
 * Determine the category of a CSS rule based on its selector
 */
function determineRuleCategory(selector: string): 'base' | 'pseudo' | 'combinator' | 'attribute' {
  if (/::/.test(selector) || /:(hover|focus|active|visited|first-child|last-child|nth-|not\(|has\()/.test(selector)) {
    return 'pseudo';
  }
  if (/\s+>\s+|\s+\+\s+|\s+~\s+|\.\w+\s+\.\w+/.test(selector)) {
    return 'combinator';
  }
  if (/\[[\w-]+/.test(selector)) {
    return 'attribute';
  }
  return 'base';
}

/**
 * Get Webflow breakpoint name from internal breakpoint key
 */
function getWebflowBreakpointName(bp: BreakpointKey): string {
  const names: Record<BreakpointKey, string> = {
    base: 'Desktop (base)',
    medium: 'Tablet (991px)',
    small: 'Mobile Landscape (767px)',
    tiny: 'Mobile Portrait (478px)',
    xlarge: 'Large (1280px)',
    xxlarge: 'XLarge (1440px)',
    xxxlarge: 'XXLarge (1920px)',
  };
  return names[bp] || bp;
}

/**
 * Check if a breakpoint was rounded from its original value
 */
function isBreakpointRounded(query: string, detectedBp: BreakpointKey): boolean {
  const maxMatch = query.match(/max-width:\s*(\d+)/i);
  const minMatch = query.match(/min-width:\s*(\d+)/i);

  if (maxMatch) {
    const width = parseInt(maxMatch[1], 10);
    // Check if it matches Webflow breakpoints exactly
    if (detectedBp === 'tiny' && width !== 478) return true;
    if (detectedBp === 'small' && width !== 767) return true;
    if (detectedBp === 'medium' && width !== 991) return true;
  }

  if (minMatch) {
    const width = parseInt(minMatch[1], 10);
    if (detectedBp === 'xlarge' && width !== 1280) return true;
    if (detectedBp === 'xxlarge' && width !== 1440) return true;
    if (detectedBp === 'xxxlarge' && width !== 1920) return true;
  }

  return false;
}

// ============================================
// MAIN ROUTER FUNCTION
// ============================================

/**
 * Route CSS into native Webflow styles and embed-required styles
 *
 * IMPORTANT: CSS variables (var(--name)) are automatically resolved to actual
 * values for rules routed to native Webflow styles, since Webflow doesn't
 * support CSS custom properties in its native style system.
 */
export function routeCSS(rawCSS: string, options?: CSSRoutingOptions): CSSRoutingResult {
  const warnings: RouterWarning[] = [];
  const embedParts: string[] = [];
  const embedRulesByBreakpoint = new Map<BreakpointKey, string[]>();
  let workingCSS = rawCSS;
  let atRulesExtracted = 0;

  // Initialize tracer if tracing enabled
  const tracer = options?.trace ? new CSSRoutingTracer() : null;

  // Initialize breakpoint buckets
  for (const bp of ['base', 'medium', 'small', 'tiny', 'xlarge', 'xxlarge', 'xxxlarge'] as BreakpointKey[]) {
    embedRulesByBreakpoint.set(bp, []);
  }

  // ============================================
  // STEP 0: Extract and resolve CSS variables
  // ============================================
  // Extract all CSS variables from :root blocks
  const rawVariables = extractCSSVariables(rawCSS);

  // Resolve any chained variable references (var(--a) where --a uses var(--b))
  const { resolved: cssVariables, circularRefs } = resolveChainedVariables(rawVariables);

  if (circularRefs.length > 0) {
    warnings.push({
      type: 'size_warning',
      reason: `Circular CSS variable references detected: ${circularRefs.join(', ')}`,
      severity: 'warning',
    });
  }

  // Log variable extraction for debugging
  const varCount = Object.keys(cssVariables).length;
  if (varCount > 0) {
    console.log(`[css-embed-router] Extracted ${varCount} CSS variables for resolution`);
  }

  // ============================================
  // STEP 1: Extract at-rules that must go to embed
  // ============================================

  for (const [name, pattern] of Object.entries(EMBED_AT_RULE_PATTERNS)) {
    // Reset pattern lastIndex
    pattern.lastIndex = 0;
    const matches = workingCSS.match(pattern);
    if (matches) {
      for (const m of matches) {
        embedParts.push(m);
        atRulesExtracted++;

        // Trace the at-rule
        if (tracer) {
          tracer.traceAtRule(`@${name}`, m, name);
        }
      }
      workingCSS = workingCSS.replace(pattern, '');
      warnings.push({
        type: 'at_rule_extracted',
        reason: `@${name} rules moved to embed (${matches.length} found)`,
        severity: 'info',
      });
    }
  }

  // ============================================
  // STEP 2: Extract :root CSS variables block
  // ============================================

  const rootPattern = /:root\s*\{[^}]+\}/gi;
  const rootMatches = workingCSS.match(rootPattern);
  if (rootMatches) {
    for (const m of rootMatches) {
      embedParts.push(m);
      atRulesExtracted++;

      // Trace :root variables
      if (tracer) {
        tracer.traceRootVariables(m);
      }
    }
    workingCSS = workingCSS.replace(rootPattern, '');
    warnings.push({
      type: 'at_rule_extracted',
      reason: ':root CSS variables moved to embed',
      severity: 'info',
    });
  }

  // Mark parse complete
  if (tracer) {
    tracer.markParseComplete();
  }

  // ============================================
  // STEP 3: Process media blocks
  // ============================================

  const mediaBlocks = extractMediaBlocks(workingCSS);

  for (const { query, content, fullMatch } of mediaBlocks) {
    // Remove from working CSS
    workingCSS = workingCSS.replace(fullMatch, '');

    // Check for non-standard media queries
    if (isNonStandardMediaQuery(query)) {
      embedParts.push(fullMatch);
      warnings.push({
        type: 'at_rule_extracted',
        reason: `Non-standard media query moved to embed: ${query}`,
        severity: 'warning',
      });

      // Trace non-standard media query
      if (tracer) {
        tracer.traceMediaRule(
          `@media ${query}`,
          fullMatch,
          'embed',
          [{ type: 'breakpoint-nonstandard', query }]
        );
      }
      continue;
    }

    // Detect breakpoint
    const breakpoint = detectBreakpointFromQuery(query);
    const webflowBreakpoint = breakpoint ? getWebflowBreakpointName(breakpoint) : 'base';

    // Process rules inside the media block
    const rules = extractRulesWithBraceMatching(content);

    for (const rule of rules) {
      const selectorCheck = selectorNeedsEmbed(rule.selector);
      const propsCheck = propertiesNeedEmbed(rule.properties);

      // Build routing reasons
      const reasons: RoutingReason[] = [
        ...selectorCheck.routingReasons,
        ...propsCheck.routingReasons,
      ];

      // Build breakpoint mapping info
      const breakpointMapping: BreakpointMapping | undefined = breakpoint ? {
        original: `@media ${query}`,
        mapped: webflowBreakpoint,
        wasRounded: isBreakpointRounded(query, breakpoint),
      } : undefined;

      if (selectorCheck.needsEmbed || propsCheck.needsEmbed) {
        // Route to embed with breakpoint
        const bp = breakpoint || 'base';
        const bucket = embedRulesByBreakpoint.get(bp)!;
        const embedRule = `${rule.selector} { ${rule.properties} }`;
        bucket.push(embedRule);

        warnings.push({
          type: 'selector_complex',
          selector: rule.selector,
          reason: selectorCheck.reason || propsCheck.reason || 'Complex selector/property',
          severity: 'info',
        });

        // Trace embed rule
        if (tracer) {
          const ruleId = tracer.traceMediaRule(
            rule.selector,
            rule.fullMatch,
            'embed',
            reasons.length > 0 ? reasons : [{ type: 'standard-property' }],
            breakpointMapping
          );
          tracer.setRuleOutput(ruleId, undefined, embedRule);
        }
      } else {
        // Keep in native CSS (re-wrap in media query)
        // IMPORTANT: Resolve CSS variables since Webflow native styles don't support var()
        const { resolved: resolvedProperties, unresolvedVars } = resolveVariablesInProperties(
          rule.properties,
          cssVariables
        );

        // Warn about unresolved variables
        if (unresolvedVars.length > 0) {
          warnings.push({
            type: 'selector_complex',
            selector: rule.selector,
            reason: `Unresolved CSS variables in native styles: ${unresolvedVars.join(', ')}`,
            severity: 'warning',
          });
        }

        const nativeRule = `@media ${query} { ${rule.selector} { ${resolvedProperties} } }`;
        workingCSS += `\n${nativeRule}`;

        // Trace native rule
        if (tracer) {
          const mappingReason: RoutingReason = breakpoint
            ? { type: 'breakpoint-mapped', from: query, to: webflowBreakpoint }
            : { type: 'standard-property' };
          const ruleId = tracer.traceMediaRule(
            rule.selector,
            rule.fullMatch,
            'native',
            [mappingReason],
            breakpointMapping
          );
          tracer.setRuleOutput(ruleId, nativeRule);
        }
      }
    }
  }

  // ============================================
  // STEP 4: Process base rules (outside media queries)
  // ============================================

  const baseRules = extractRulesWithBraceMatching(workingCSS);
  const nativeRules: string[] = [];

  for (const rule of baseRules) {
    const selectorCheck = selectorNeedsEmbed(rule.selector);
    const propsCheck = propertiesNeedEmbed(rule.properties);

    // Build routing reasons
    const reasons: RoutingReason[] = [
      ...selectorCheck.routingReasons,
      ...propsCheck.routingReasons,
    ];

    // Determine category
    const category = determineRuleCategory(rule.selector);

    if (selectorCheck.needsEmbed || propsCheck.needsEmbed) {
      // Route to embed
      const bucket = embedRulesByBreakpoint.get('base')!;
      const embedRule = `${rule.selector} { ${rule.properties} }`;
      bucket.push(embedRule);

      warnings.push({
        type: 'selector_complex',
        selector: rule.selector,
        reason: selectorCheck.reason || propsCheck.reason || 'Complex selector/property',
        severity: 'info',
      });

      // Trace embed rule
      if (tracer) {
        const ruleId = tracer.traceRule(
          rule.selector,
          rule.fullMatch,
          'embed',
          reasons.length > 0 ? reasons : [{ type: 'standard-property' }],
          category
        );
        tracer.setRuleOutput(ruleId, undefined, embedRule);
      }
    } else {
      // Keep native
      // IMPORTANT: Resolve CSS variables since Webflow native styles don't support var()
      const { resolved: resolvedProperties, unresolvedVars } = resolveVariablesInProperties(
        rule.properties,
        cssVariables
      );

      // Warn about unresolved variables
      if (unresolvedVars.length > 0) {
        warnings.push({
          type: 'selector_complex',
          selector: rule.selector,
          reason: `Unresolved CSS variables in native styles: ${unresolvedVars.join(', ')}`,
          severity: 'warning',
        });
      }

      const nativeRule = `${rule.selector} { ${resolvedProperties} }`;
      nativeRules.push(nativeRule);

      // Trace native rule
      if (tracer) {
        const ruleId = tracer.traceRule(
          rule.selector,
          rule.fullMatch,
          'native',
          [{ type: 'standard-property' }],
          category
        );
        tracer.setRuleOutput(ruleId, nativeRule);
      }
    }
  }

  // ============================================
  // STEP 5: Format embed CSS with breakpoints
  // ============================================

  const formattedEmbedCSS = formatEmbedWithBreakpoints(embedRulesByBreakpoint, embedParts);

  // ============================================
  // STEP 6: Minify embed CSS for size optimization
  // ============================================

  const embedCSS = minifyCSS(formattedEmbedCSS);

  // ============================================
  // STEP 7: Calculate stats and size warnings
  // ============================================

  const embedSizeBytes = new TextEncoder().encode(embedCSS).length;
  const totalEmbedRules = Array.from(embedRulesByBreakpoint.values()).reduce((sum, arr) => sum + arr.length, 0);

  if (embedSizeBytes > 50 * 1024) {
    warnings.push({
      type: 'size_error',
      reason: `Embed CSS exceeds 50KB limit (${Math.round(embedSizeBytes / 1024)}KB). Consider splitting into multiple embeds.`,
      severity: 'error',
    });
  } else if (embedSizeBytes > 40 * 1024) {
    warnings.push({
      type: 'size_warning',
      reason: `Embed CSS is large (${Math.round(embedSizeBytes / 1024)}KB). May impact page performance.`,
      severity: 'warning',
    });
  }

  const stats: RoutingStats = {
    totalRules: nativeRules.length + totalEmbedRules,
    nativeRules: nativeRules.length,
    embedRules: totalEmbedRules,
    atRulesExtracted,
    embedSizeBytes,
  };

  // Finalize trace if enabled
  const trace = tracer?.finalize(rawCSS);

  return {
    native: nativeRules.join('\n'),
    embed: embedCSS,
    warnings,
    stats,
    trace,
  };
}

// ============================================
// EMBED FORMATTING
// ============================================

/**
 * Format embed CSS with proper breakpoint media queries
 */
function formatEmbedWithBreakpoints(
  rulesByBreakpoint: Map<BreakpointKey, string[]>,
  atRules: string[]
): string {
  const parts: string[] = [];

  // Add at-rules first (keyframes, font-face, etc.)
  if (atRules.length > 0) {
    parts.push('/* At-rules */');
    parts.push(...atRules);
    parts.push('');
  }

  // Base styles (no media query)
  const baseRules = rulesByBreakpoint.get('base') || [];
  if (baseRules.length > 0) {
    parts.push('/* Base styles */');
    parts.push(...baseRules);
    parts.push('');
  }

  // Max-width breakpoints (cascade DOWN)
  const mediumRules = rulesByBreakpoint.get('medium') || [];
  if (mediumRules.length > 0) {
    parts.push('/* Tablet (max-width: 991px) */');
    parts.push('@media (max-width: 991px) {');
    parts.push(...mediumRules.map(r => '  ' + r));
    parts.push('}');
    parts.push('');
  }

  const smallRules = rulesByBreakpoint.get('small') || [];
  if (smallRules.length > 0) {
    parts.push('/* Mobile Landscape (max-width: 767px) */');
    parts.push('@media (max-width: 767px) {');
    parts.push(...smallRules.map(r => '  ' + r));
    parts.push('}');
    parts.push('');
  }

  const tinyRules = rulesByBreakpoint.get('tiny') || [];
  if (tinyRules.length > 0) {
    parts.push('/* Mobile Portrait (max-width: 478px) */');
    parts.push('@media (max-width: 478px) {');
    parts.push(...tinyRules.map(r => '  ' + r));
    parts.push('}');
    parts.push('');
  }

  // Min-width breakpoints (cascade UP)
  const xlargeRules = rulesByBreakpoint.get('xlarge') || [];
  if (xlargeRules.length > 0) {
    parts.push('/* Large (min-width: 1280px) */');
    parts.push('@media (min-width: 1280px) {');
    parts.push(...xlargeRules.map(r => '  ' + r));
    parts.push('}');
    parts.push('');
  }

  const xxlargeRules = rulesByBreakpoint.get('xxlarge') || [];
  if (xxlargeRules.length > 0) {
    parts.push('/* XLarge (min-width: 1440px) */');
    parts.push('@media (min-width: 1440px) {');
    parts.push(...xxlargeRules.map(r => '  ' + r));
    parts.push('}');
    parts.push('');
  }

  const xxxlargeRules = rulesByBreakpoint.get('xxxlarge') || [];
  if (xxxlargeRules.length > 0) {
    parts.push('/* XXLarge (min-width: 1920px) */');
    parts.push('@media (min-width: 1920px) {');
    parts.push(...xxxlargeRules.map(r => '  ' + r));
    parts.push('}');
    parts.push('');
  }

  // Return empty if nothing to embed
  if (parts.length === 0) {
    return '';
  }

  return parts.join('\n').trim();
}

/**
 * Wrap embed CSS in a <style> tag for HtmlEmbed
 * @param embedCSS - CSS to wrap (may be already minified)
 * @param minify - Whether to minify the CSS (default: false, assumes pre-minified)
 */
export function wrapEmbedCSSInStyleTag(embedCSS: string, minify: boolean = false): string {
  if (!embedCSS || !embedCSS.trim()) {
    return '';
  }

  const processedCSS = minify ? minifyCSS(embedCSS) : embedCSS;

  return `<style>
/* === FLOW BRIDGE: Non-Native CSS === */
/* These styles cannot be represented in Webflow's native style system */
/* Do not modify - regenerate from source HTML if changes needed */

${processedCSS}
</style>`;
}

// ============================================
// UTILITY EXPORTS
// ============================================

/**
 * Check if any CSS will be routed to embed
 */
export function willRouteToEmbed(css: string): boolean {
  // Quick check for obvious patterns
  if (/@keyframes/i.test(css)) return true;
  if (/@font-face/i.test(css)) return true;
  if (/:root\s*\{/.test(css)) return true;
  if (/::before|::after/i.test(css)) return true;
  if (/:nth-child\(|:nth-of-type\(/i.test(css)) return true;
  if (/\[data-[\w-]+\]/.test(css)) return true;
  if (/\.\w+\s+\.\w+/.test(css)) return true; // Descendant selectors

  return false;
}

/**
 * Get a summary of what would be routed to embed
 */
export function getRoutingSummary(css: string): string[] {
  const features: string[] = [];

  if (/@keyframes/i.test(css)) features.push('@keyframes animations');
  if (/@font-face/i.test(css)) features.push('@font-face declarations');
  if (/:root\s*\{/.test(css)) features.push('CSS custom properties (:root)');
  if (/::before|::after/i.test(css)) features.push('::before/::after pseudo-elements');
  if (/:nth-child\(|:nth-of-type\(/i.test(css)) features.push(':nth-child/:nth-of-type selectors');
  if (/:not\(|:has\(|:where\(|:is\(/i.test(css)) features.push('Complex pseudo-classes (:not, :has, etc.)');
  if (/\[[\w-]+=/.test(css)) features.push('Attribute selectors');
  if (/\s+>\s+/.test(css)) features.push('Child combinators (>)');
  if (/\s+\+\s+/.test(css)) features.push('Adjacent sibling combinators (+)');
  if (/\s+~\s+/.test(css)) features.push('General sibling combinators (~)');
  if (/\.\w+\s+\.\w+/.test(css)) features.push('Descendant selectors');
  if (/\.\w+\.\w+/.test(css)) features.push('Compound selectors');

  return features;
}

/**
 * Merge embed CSS from multiple sources
 */
export function mergeEmbedCSS(...embedCSSSources: string[]): string {
  const nonEmpty = embedCSSSources.filter(s => s && s.trim());
  if (nonEmpty.length === 0) return '';
  if (nonEmpty.length === 1) return nonEmpty[0];

  return nonEmpty.join('\n\n');
}

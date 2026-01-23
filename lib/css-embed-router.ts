/**
 * CSS Embed Router
 *
 * Separates CSS into native Webflow styles and embed-required styles.
 * Complex CSS that Webflow can't handle natively is extracted into
 * a separate embed block instead of being discarded.
 */

import { minifyCSS } from './css-minifier';

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
function selectorNeedsEmbed(selector: string): { needsEmbed: boolean; reason: string | null } {
  const trimmed = selector.trim();

  // Check descendant selectors (space-separated classes)
  // e.g., ".parent .child" must go to embed
  if (/\.[a-zA-Z_][\w-]*\s+\.[a-zA-Z_][\w-]*/.test(trimmed)) {
    return { needsEmbed: true, reason: 'Descendant selector (.parent .child)' };
  }

  // Check compound selectors (multiple classes on same element)
  // e.g., ".class1.class2" must go to embed
  if (/\.[a-zA-Z_][\w-]*\.[a-zA-Z_][\w-]*/.test(trimmed)) {
    return { needsEmbed: true, reason: 'Compound selector (.class1.class2)' };
  }

  // Check against known patterns
  for (const { pattern, reason } of EMBED_SELECTOR_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { needsEmbed: true, reason };
    }
  }

  return { needsEmbed: false, reason: null };
}

/**
 * Check if properties contain vendor prefixes that need embed
 */
function propertiesNeedEmbed(properties: string): { needsEmbed: boolean; reason: string | null } {
  for (const prop of VENDOR_PREFIX_PROPERTIES) {
    if (properties.includes(prop)) {
      return { needsEmbed: true, reason: `Vendor-prefixed property: ${prop}` };
    }
  }

  // Check for generic vendor prefixes
  if (/-webkit-(?!background-clip)[\w-]+:/.test(properties)) {
    const match = properties.match(/-webkit-([\w-]+):/);
    if (match && !VENDOR_PREFIX_PROPERTIES.includes(`-webkit-${match[1]}`)) {
      return { needsEmbed: true, reason: `Webkit prefix: -webkit-${match[1]}` };
    }
  }

  if (/-moz-[\w-]+:/.test(properties)) {
    return { needsEmbed: true, reason: 'Mozilla vendor prefix' };
  }

  if (/-ms-[\w-]+:/.test(properties)) {
    return { needsEmbed: true, reason: 'Microsoft vendor prefix' };
  }

  return { needsEmbed: false, reason: null };
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

// ============================================
// MAIN ROUTER FUNCTION
// ============================================

/**
 * Route CSS into native Webflow styles and embed-required styles
 */
export function routeCSS(rawCSS: string): CSSRoutingResult {
  const warnings: RouterWarning[] = [];
  const embedParts: string[] = [];
  const embedRulesByBreakpoint = new Map<BreakpointKey, string[]>();
  let workingCSS = rawCSS;
  let atRulesExtracted = 0;

  // Initialize breakpoint buckets
  for (const bp of ['base', 'medium', 'small', 'tiny', 'xlarge', 'xxlarge', 'xxxlarge'] as BreakpointKey[]) {
    embedRulesByBreakpoint.set(bp, []);
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
    }
    workingCSS = workingCSS.replace(rootPattern, '');
    warnings.push({
      type: 'at_rule_extracted',
      reason: ':root CSS variables moved to embed',
      severity: 'info',
    });
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
      continue;
    }

    // Detect breakpoint
    const breakpoint = detectBreakpointFromQuery(query);

    // Process rules inside the media block
    const rules = extractRulesWithBraceMatching(content);

    for (const rule of rules) {
      const selectorCheck = selectorNeedsEmbed(rule.selector);
      const propsCheck = propertiesNeedEmbed(rule.properties);

      if (selectorCheck.needsEmbed || propsCheck.needsEmbed) {
        // Route to embed with breakpoint
        const bp = breakpoint || 'base';
        const bucket = embedRulesByBreakpoint.get(bp)!;
        bucket.push(`${rule.selector} { ${rule.properties} }`);

        warnings.push({
          type: 'selector_complex',
          selector: rule.selector,
          reason: selectorCheck.reason || propsCheck.reason || 'Complex selector/property',
          severity: 'info',
        });
      } else {
        // Keep in native CSS (re-wrap in media query)
        workingCSS += `\n@media ${query} { ${rule.selector} { ${rule.properties} } }`;
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

    if (selectorCheck.needsEmbed || propsCheck.needsEmbed) {
      // Route to embed
      const bucket = embedRulesByBreakpoint.get('base')!;
      bucket.push(`${rule.selector} { ${rule.properties} }`);

      warnings.push({
        type: 'selector_complex',
        selector: rule.selector,
        reason: selectorCheck.reason || propsCheck.reason || 'Complex selector/property',
        severity: 'info',
      });
    } else {
      // Keep native
      nativeRules.push(`${rule.selector} { ${rule.properties} }`);
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

  if (embedSizeBytes > 100 * 1024) {
    warnings.push({
      type: 'size_error',
      reason: `Embed CSS exceeds 100KB limit (${Math.round(embedSizeBytes / 1024)}KB). Consider splitting into multiple embeds.`,
      severity: 'error',
    });
  } else if (embedSizeBytes > 10 * 1024) {
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

  return {
    native: nativeRules.join('\n'),
    embed: embedCSS,
    warnings,
    stats,
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

/**
 * Smart CSS Analyzer
 *
 * Analyzes what's ACTUALLY lost vs what's transformed to BEM classes.
 * The pipeline intentionally:
 *   - Converts element selectors (body, h1) to BEM classes (.wf-body, .heading-h1)
 *   - Resolves CSS variables to literal values
 *
 * This analyzer identifies what's TRULY lost, not just transformed.
 */

export interface CssRule {
  selector: string;
  properties: Map<string, string>;
}

export interface AnalysisResult {
  testSlug: string;

  // Properties that exist in sanitized output (transformed, not lost)
  preserved: {
    property: string;
    originalSelector: string;
    newSelector: string;
    originalValue: string;
    newValue: string;
  }[];

  // Properties that are TRULY lost (not in sanitized at all)
  trulyLost: {
    property: string;
    selector: string;
    value: string;
  }[];

  // Selectors that were converted to BEM
  selectorMappings: {
    original: string;
    bem: string;
  }[];

  // Variables that were resolved
  variableResolutions: {
    variable: string;
    value: string;
    occurrences: number;
  }[];

  // Summary counts
  summary: {
    totalOriginalProperties: number;
    preservedCount: number;
    trulyLostCount: number;
    preservationRate: number;
  };
}

/**
 * Parse CSS from HTML content
 */
export function parseCssFromHtml(html: string): CssRule[] {
  const rules: CssRule[] = [];

  // Extract style content
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  if (!styleMatch) return rules;

  const cssContent = styleMatch.map(s => s.replace(/<\/?style[^>]*>/gi, '')).join('\n');

  // Parse rules (simplified - handles most cases)
  // Match selectors and their property blocks
  const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
  let match;

  while ((match = ruleRegex.exec(cssContent)) !== null) {
    const selector = match[1].trim();
    const propertiesStr = match[2].trim();

    // Skip @rules like @media, @keyframes for now
    if (selector.startsWith('@')) continue;

    const properties = new Map<string, string>();
    const propParts = propertiesStr.split(';').filter(Boolean);

    for (const part of propParts) {
      const colonIdx = part.indexOf(':');
      if (colonIdx === -1) continue;

      const prop = part.slice(0, colonIdx).trim().toLowerCase();
      const val = part.slice(colonIdx + 1).trim();

      if (prop && val) {
        properties.set(prop, val);
      }
    }

    if (properties.size > 0) {
      rules.push({ selector, properties });
    }
  }

  return rules;
}

/**
 * Known selector to BEM mappings (element -> class)
 */
const SELECTOR_TO_BEM: Record<string, string[]> = {
  'body': ['.wf-body'],
  'h1': ['.heading-h1'],
  'h2': ['.heading-h2'],
  'h3': ['.heading-h3'],
  'h4': ['.heading-h4'],
  'h5': ['.heading-h5'],
  'h6': ['.heading-h6'],
  'p': ['.text-body'],
  'a': ['.link'],
  'ul': ['.list-ul'],
  'ol': ['.list-ol'],
  'li': ['.list-item'],
  'img': ['.image'],
  'button': ['.btn'],
  'input': ['.input'],
  'textarea': ['.textarea'],
  'select': ['.select'],
  'label': ['.label'],
  'form': ['.form'],
  'nav': ['.wf-nav'],
  'header': ['.wf-header'],
  'footer': ['.wf-footer'],
  'main': ['.wf-main'],
  'section': ['.wf-section'],
  'article': ['.wf-article'],
  'aside': ['.wf-aside'],
  'blockquote': ['.blockquote'],
};

/**
 * Derive flattened BEM class name from descendant selector.
 * Mirrors the logic in webflow-normalizer.ts deriveDescendantClassName().
 */
function deriveDescendantClassName(parentClass: string, target: string): string {
  // Anchor tags: context-aware link naming
  if (target === 'a') {
    if (parentClass.endsWith('links')) return parentClass.replace(/links$/, 'link');
    if (parentClass.endsWith('link')) return parentClass;
    if (parentClass.endsWith('s')) return `${parentClass.slice(0, -1)}-link`;
    return `${parentClass}-link`;
  }
  // All other tags: create modifier class
  return `${parentClass}-${target}`;
}

/**
 * Find BEM equivalent selectors for a given selector.
 * Handles element selectors, descendant selectors, and class selectors.
 */
function findBemEquivalents(selector: string): string[] {
  const trimmed = selector.trim();

  // Direct element mapping
  const direct = SELECTOR_TO_BEM[trimmed.toLowerCase()];
  if (direct) return direct;

  // Combined selectors like "h1, h2, h3"
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map(s => s.trim());
    const bemParts: string[] = [];
    for (const part of parts) {
      bemParts.push(...findBemEquivalents(part));
    }
    return bemParts;
  }

  // DESCENDANT SELECTORS: .parent element → .parent-element
  // This is the key fix - the normalizer flattens these to BEM classes
  const descendantElementMatch = trimmed.match(
    /^\.([a-zA-Z_-][\w-]*)\s+(h[1-6]|p|a|ul|ol|li|blockquote|section|nav|header|footer|main|article|aside|span|div|img)$/i
  );
  if (descendantElementMatch) {
    const parentClass = descendantElementMatch[1];
    const element = descendantElementMatch[2].toLowerCase();
    const flattenedClass = deriveDescendantClassName(parentClass, element);
    return [`.${flattenedClass}`];
  }

  // DESCENDANT CLASS SELECTORS: .parent .child → .parent-child
  const descendantClassMatch = trimmed.match(
    /^\.([a-zA-Z_-][\w-]*)\s*[> ]\s*\.([a-zA-Z_-][\w-]*)$/
  );
  if (descendantClassMatch) {
    const parentClass = descendantClassMatch[1];
    const childClass = descendantClassMatch[2];
    const flattenedClass = deriveDescendantClassName(parentClass, childClass);
    return [`.${flattenedClass}`];
  }

  // GENERAL DESCENDANT: .parent tag → .parent-tag
  const generalDescendantMatch = trimmed.match(
    /^\.([a-zA-Z_-][\w-]*)\s*[> ]\s*([a-zA-Z][\w-]*)$/
  );
  if (generalDescendantMatch) {
    const parentClass = generalDescendantMatch[1];
    const tag = generalDescendantMatch[2].toLowerCase();
    const flattenedClass = deriveDescendantClassName(parentClass, tag);
    return [`.${flattenedClass}`];
  }

  // Simple class selector - look for it directly
  if (trimmed.startsWith('.') && !trimmed.includes(' ') && !trimmed.includes('>')) {
    return [trimmed];
  }

  // Unhandled selector pattern - return empty (will be marked as truly lost)
  return [];
}

/**
 * Check if a property value contains CSS variables
 */
function containsVariable(value: string): boolean {
  return value.includes('var(');
}

/**
 * Extract variable name from var() expression
 */
function extractVariableName(value: string): string | null {
  const match = value.match(/var\(([^)]+)\)/);
  return match ? match[1].trim() : null;
}

/**
 * Analyze original vs sanitized HTML
 */
export function analyzeTransformation(
  testSlug: string,
  originalHtml: string,
  sanitizedHtml: string
): AnalysisResult {
  const originalRules = parseCssFromHtml(originalHtml);
  const sanitizedRules = parseCssFromHtml(sanitizedHtml);

  // Build lookup map for sanitized rules
  const sanitizedMap = new Map<string, Map<string, string>>();
  for (const rule of sanitizedRules) {
    // Normalize selector for lookup
    const normalized = rule.selector.toLowerCase().trim();
    sanitizedMap.set(normalized, rule.properties);
  }

  const preserved: AnalysisResult['preserved'] = [];
  const trulyLost: AnalysisResult['trulyLost'] = [];
  const selectorMappings: AnalysisResult['selectorMappings'] = [];
  const variableResolutions = new Map<string, { value: string; count: number }>();

  let totalOriginalProperties = 0;

  for (const originalRule of originalRules) {
    const bemEquivalents = findBemEquivalents(originalRule.selector);

    for (const [prop, originalValue] of originalRule.properties) {
      totalOriginalProperties++;

      // Check if property exists in sanitized output
      let found = false;
      let foundSelector = '';
      let foundValue = '';

      // First check if the original selector exists (class selectors)
      const normalizedOriginal = originalRule.selector.toLowerCase().trim();
      if (sanitizedMap.has(normalizedOriginal)) {
        const props = sanitizedMap.get(normalizedOriginal)!;
        if (props.has(prop)) {
          found = true;
          foundSelector = originalRule.selector;
          foundValue = props.get(prop)!;
        }
      }

      // Check BEM equivalents
      if (!found) {
        for (const bem of bemEquivalents) {
          const normalizedBem = bem.toLowerCase().trim();
          if (sanitizedMap.has(normalizedBem)) {
            const props = sanitizedMap.get(normalizedBem)!;
            if (props.has(prop)) {
              found = true;
              foundSelector = bem;
              foundValue = props.get(prop)!;

              // Track selector mapping
              if (!selectorMappings.find(m => m.original === originalRule.selector && m.bem === bem)) {
                selectorMappings.push({
                  original: originalRule.selector,
                  bem: bem,
                });
              }
              break;
            }
          }
        }
      }

      // Track variable resolutions
      if (containsVariable(originalValue)) {
        const varName = extractVariableName(originalValue);
        if (varName && found) {
          const existing = variableResolutions.get(varName);
          if (existing) {
            existing.count++;
          } else {
            variableResolutions.set(varName, { value: foundValue, count: 1 });
          }
        }
      }

      if (found) {
        preserved.push({
          property: prop,
          originalSelector: originalRule.selector,
          newSelector: foundSelector,
          originalValue,
          newValue: foundValue,
        });
      } else {
        trulyLost.push({
          property: prop,
          selector: originalRule.selector,
          value: originalValue,
        });
      }
    }
  }

  const preservationRate = totalOriginalProperties > 0
    ? preserved.length / totalOriginalProperties
    : 1;

  return {
    testSlug,
    preserved,
    trulyLost,
    selectorMappings,
    variableResolutions: Array.from(variableResolutions.entries()).map(([variable, data]) => ({
      variable,
      value: data.value,
      occurrences: data.count,
    })),
    summary: {
      totalOriginalProperties,
      preservedCount: preserved.length,
      trulyLostCount: trulyLost.length,
      preservationRate,
    },
  };
}

/**
 * Aggregate truly lost properties across tests
 */
export function aggregateTrulyLost(results: AnalysisResult[]): {
  property: string;
  testsAffected: string[];
  totalOccurrences: number;
  examples: { selector: string; value: string; test: string }[];
}[] {
  const lostMap = new Map<string, {
    tests: Set<string>;
    occurrences: number;
    examples: { selector: string; value: string; test: string }[];
  }>();

  for (const result of results) {
    for (const lost of result.trulyLost) {
      if (!lostMap.has(lost.property)) {
        lostMap.set(lost.property, { tests: new Set(), occurrences: 0, examples: [] });
      }
      const entry = lostMap.get(lost.property)!;
      entry.tests.add(result.testSlug);
      entry.occurrences++;
      if (entry.examples.length < 3) {
        entry.examples.push({
          selector: lost.selector,
          value: lost.value,
          test: result.testSlug,
        });
      }
    }
  }

  return Array.from(lostMap.entries())
    .map(([property, data]) => ({
      property,
      testsAffected: Array.from(data.tests),
      totalOccurrences: data.occurrences,
      examples: data.examples,
    }))
    .sort((a, b) => b.testsAffected.length - a.testsAffected.length);
}

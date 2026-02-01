/**
 * Issue Classifier - Detailed CSS Property Extraction
 *
 * Extracts EVERY CSS change without truncation for cross-test analysis.
 */

export interface CssChange {
  property: string;
  selector: string;
  action: 'removed' | 'added' | 'changed';
  originalValue?: string;
  newValue?: string;
  line: string;
}

export interface SelectorChange {
  selector: string;
  action: 'removed' | 'added';
  properties: string[];
}

export interface TestIssues {
  testSlug: string;
  cssChanges: CssChange[];
  selectorChanges: SelectorChange[];
  removedProperties: Map<string, number>; // property -> count
  addedProperties: Map<string, number>;
  removedSelectors: string[];
  addedSelectors: string[];
}

/**
 * Extract all CSS changes from a diff patch
 */
export function extractAllCssChanges(patch: string): {
  cssChanges: CssChange[];
  selectorChanges: SelectorChange[];
} {
  const cssChanges: CssChange[] = [];
  const selectorChanges: SelectorChange[] = [];

  const lines = patch.split('\n');
  let currentSelector = '';
  let inStyleBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track if we're inside a <style> block
    if (/<style/i.test(line)) inStyleBlock = true;
    if (/<\/style/i.test(line)) inStyleBlock = false;

    // Skip non-change lines
    if (!line.startsWith('+') && !line.startsWith('-')) {
      // Track current selector from context lines
      const selectorMatch = line.match(/^\s*([.#\w\-\[\]="':,\s>+~*]+)\s*\{/);
      if (selectorMatch) {
        currentSelector = selectorMatch[1].trim();
      }
      continue;
    }

    const sign = line[0];
    const content = line.slice(1).trim();

    // Detect selector changes (lines with { )
    const selectorMatch = content.match(/^([.#\w\-\[\]="':,\s>+~*@]+)\s*\{/);
    if (selectorMatch) {
      currentSelector = selectorMatch[1].trim();
      selectorChanges.push({
        selector: currentSelector,
        action: sign === '-' ? 'removed' : 'added',
        properties: [],
      });
      continue;
    }

    // Detect CSS property changes
    const propertyMatch = content.match(/^([a-z\-]+)\s*:\s*(.+?);?\s*$/i);
    if (propertyMatch && inStyleBlock) {
      const [, property, value] = propertyMatch;

      // Skip CSS custom property definitions (--var-name)
      if (property.startsWith('--')) continue;

      cssChanges.push({
        property: property.toLowerCase(),
        selector: currentSelector || 'unknown',
        action: sign === '-' ? 'removed' : 'added',
        originalValue: sign === '-' ? value : undefined,
        newValue: sign === '+' ? value : undefined,
        line: content,
      });
    }

    // Also detect inline style changes
    const inlineMatch = content.match(/style="([^"]+)"/i);
    if (inlineMatch) {
      const styleContent = inlineMatch[1];
      const props = styleContent.split(';').filter(Boolean);
      for (const prop of props) {
        const [propName, propValue] = prop.split(':').map(s => s?.trim());
        if (propName && propValue) {
          cssChanges.push({
            property: propName.toLowerCase(),
            selector: 'inline-style',
            action: sign === '-' ? 'removed' : 'added',
            originalValue: sign === '-' ? propValue : undefined,
            newValue: sign === '+' ? propValue : undefined,
            line: content,
          });
        }
      }
    }
  }

  return { cssChanges, selectorChanges };
}

/**
 * Analyze a single test's changes
 */
export function analyzeTestChanges(testSlug: string, patch: string): TestIssues {
  const { cssChanges, selectorChanges } = extractAllCssChanges(patch);

  const removedProperties = new Map<string, number>();
  const addedProperties = new Map<string, number>();

  for (const change of cssChanges) {
    if (change.action === 'removed') {
      removedProperties.set(change.property, (removedProperties.get(change.property) || 0) + 1);
    } else if (change.action === 'added') {
      addedProperties.set(change.property, (addedProperties.get(change.property) || 0) + 1);
    }
  }

  const removedSelectors = selectorChanges
    .filter(s => s.action === 'removed')
    .map(s => s.selector);

  const addedSelectors = selectorChanges
    .filter(s => s.action === 'added')
    .map(s => s.selector);

  return {
    testSlug,
    cssChanges,
    selectorChanges,
    removedProperties,
    addedProperties,
    removedSelectors,
    addedSelectors,
  };
}

/**
 * Group CSS properties by category for reporting
 */
export function categorizeProperty(property: string): string {
  const categories: Record<string, string[]> = {
    'spacing': ['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
                'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
                'gap', 'row-gap', 'column-gap'],
    'layout': ['display', 'flex', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink',
               'grid', 'grid-template', 'grid-template-columns', 'grid-template-rows',
               'align-items', 'justify-content', 'align-content', 'place-items'],
    'positioning': ['position', 'top', 'right', 'bottom', 'left', 'z-index', 'inset'],
    'sizing': ['width', 'height', 'min-width', 'max-width', 'min-height', 'max-height'],
    'typography': ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
                   'text-align', 'text-transform', 'text-decoration', 'color'],
    'background': ['background', 'background-color', 'background-image', 'background-size',
                   'background-position', 'background-repeat'],
    'border': ['border', 'border-radius', 'border-width', 'border-color', 'border-style',
               'outline'],
    'animation': ['animation', 'animation-name', 'animation-duration', 'transition',
                  'transform', 'opacity'],
    'overflow': ['overflow', 'overflow-x', 'overflow-y'],
  };

  for (const [category, props] of Object.entries(categories)) {
    if (props.some(p => property.startsWith(p))) {
      return category;
    }
  }

  return 'other';
}

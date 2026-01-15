/**
 * Gradient-Transform Decoupler for Webflow Import
 * 
 * Webflow's import engine has a race condition when processing elements that combine:
 * - background-image: linear-gradient(...)
 * - transform: scale(), translateZ(), etc.
 * - transition properties
 * 
 * This module detects and structurally separates gradient-bearing elements from
 * transform-bearing elements before Webflow ever sees them, preventing gradient loss.
 */

import { extractGradientFromValue } from './gradient-sanitizer';

// ============================================
// TYPES
// ============================================

export interface PotentialConflict {
  className: string;
  hasGradient: boolean;
  hasTransform: boolean;
  hasWillChange: boolean;
  hasTransition: boolean;
  gradientValue: string | null;
  transformValue: string | null;
  transitionValue: string | null;
  selectors: string[];
  /** Properties that should move to gradient layer */
  gradientProperties: Map<string, string>;
  /** Properties that should stay on transform layer */
  transformProperties: Map<string, string>;
  /** Properties that need duplication (border-radius, overflow, etc.) */
  sharedProperties: Map<string, string>;
}

export interface DecouplingOptions {
  /** Preserve original structure in data attributes for debugging */
  preserveDebugInfo?: boolean;
  /** Class suffix for gradient layer (default: "-bg") */
  gradientLayerSuffix?: string;
  /** Only process specific class names */
  filterClasses?: Set<string>;
}

export interface DecouplingResult {
  html: string;
  css: string;
  rewriteCount: number;
  decoupledClasses: string[];
  warnings: string[];
}

// ============================================
// PROPERTY CATEGORIZATION
// ============================================

const TRANSFORM_PROPERTIES = new Set([
  'transform',
  'transform-origin',
  'transform-style',
  'perspective',
  'perspective-origin',
  'will-change',
  'transition',
  'transition-property',
  'transition-duration',
  'transition-timing-function',
  'transition-delay',
]);

const GRADIENT_PROPERTIES = new Set([
  'background',
  'background-image',
  'background-color',
  'background-size',
  'background-position',
  'background-repeat',
  'background-attachment',
  'background-origin',
  'background-clip',
]);

const SHARED_PROPERTIES = new Set([
  'border-radius',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'overflow',
  'overflow-x',
  'overflow-y',
]);

// ============================================
// DETECTION
// ============================================

/**
 * Check if a styleLess string has both gradient and transform properties
 */
export function hasGradientTransformConflict(styleLess: string): boolean {
  if (!styleLess) return false;

  // Check for gradient
  const hasGradient = /(?:linear|radial|conic|repeating-linear|repeating-radial)-gradient\s*\(/i.test(styleLess);
  if (!hasGradient) return false;

  // Check for transform indicators
  const hasTransform = /\btransform\s*:/i.test(styleLess);
  const hasWillChange = /\bwill-change\s*:\s*[^;]*transform/i.test(styleLess);
  const hasTransition = /\btransition\s*:/i.test(styleLess);

  return hasTransform || hasWillChange || hasTransition;
}

/**
 * Parse CSS properties string into a map
 */
function parsePropertiesToMap(propertiesStr: string): Map<string, string> {
  const props = new Map<string, string>();
  if (!propertiesStr) return props;

  const properties: string[] = [];
  let current = '';
  let parenDepth = 0;

  for (const char of propertiesStr) {
    if (char === '(') parenDepth++;
    else if (char === ')') parenDepth--;
    if (char === ';' && parenDepth === 0) {
      if (current.trim()) properties.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) properties.push(current.trim());

  for (const prop of properties) {
    const colonIndex = prop.indexOf(':');
    if (colonIndex === -1) continue;
    const name = prop.substring(0, colonIndex).trim().toLowerCase();
    const value = prop.substring(colonIndex + 1).trim();
    if (name && value) {
      props.set(name, value);
    }
  }

  return props;
}

/**
 * Check if a property value contains a gradient
 */
function hasGradientInProperty(propName: string, propValue: string): boolean {
  // Check background-image and background properties
  if (propName === 'background-image' || propName === 'background') {
    return extractGradientFromValue(propValue) !== null;
  }
  return false;
}

/**
 * Check if transition involves transform
 */
function transitionInvolvesTransform(transitionValue: string): boolean {
  if (!transitionValue) return false;
  // Check if transition property includes transform
  const transitionPropertyMatch = transitionValue.match(/transform\b/i);
  if (transitionPropertyMatch) return true;
  
  // If no specific property mentioned, assume it might affect transform
  // (common pattern: "transition: all 0.3s")
  return true; // Conservative: assume yes if transition exists
}

/**
 * Detect all gradient-transform conflicts in CSS
 */
export function detectGradientTransformConflicts(css: string): PotentialConflict[] {
  const conflicts: PotentialConflict[] = [];
  const conflictMap = new Map<string, PotentialConflict>();

  // Remove comments
  const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // Parse CSS rules: selector { properties }
  const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
  let match;

  while ((match = ruleRegex.exec(cleanCss)) !== null) {
    const selector = match[1].trim();
    const propertiesStr = match[2].trim();

    // Skip @-rules and non-class selectors
    if (selector.startsWith('@') || !selector.includes('.')) continue;

    // Extract class name from selector (use last class)
    const classMatches = selector.match(/\.([a-zA-Z_-][\w-]*)/g);
    if (!classMatches || classMatches.length === 0) continue;

    const className = classMatches[classMatches.length - 1].substring(1); // Remove dot

    // Skip pseudo-elements (::before, ::after) - they don't have the same conflict
    if (selector.includes('::before') || selector.includes('::after')) continue;

    // Parse properties
    const props = parsePropertiesToMap(propertiesStr);

    // Check for gradient
    let hasGradient = false;
    let gradientValue: string | null = null;
    const gradientProps = new Map<string, string>();

    for (const [name, value] of props.entries()) {
      if (GRADIENT_PROPERTIES.has(name) && hasGradientInProperty(name, value)) {
        hasGradient = true;
        gradientValue = extractGradientFromValue(value) || value;
        gradientProps.set(name, value);
      }
    }

    // Check for transform indicators
    let hasTransform = false;
    let transformValue: string | null = null;
    let hasWillChange = false;
    let hasTransition = false;
    let transitionValue: string | null = null;
    const transformProps = new Map<string, string>();
    const sharedProps = new Map<string, string>();

    for (const [name, value] of props.entries()) {
      if (TRANSFORM_PROPERTIES.has(name)) {
        if (name === 'transform') {
          hasTransform = true;
          transformValue = value;
        } else if (name === 'will-change' && /transform/i.test(value)) {
          hasWillChange = true;
        } else if (name === 'transition' || name.startsWith('transition-')) {
          hasTransition = true;
          if (name === 'transition') {
            transitionValue = value;
          }
          if (transitionInvolvesTransform(value)) {
            hasTransition = true;
          }
        }
        transformProps.set(name, value);
      } else if (SHARED_PROPERTIES.has(name)) {
        sharedProps.set(name, value);
      }
    }

    // If we have both gradient and transform indicators, it's a conflict
    if (hasGradient && (hasTransform || hasWillChange || hasTransition)) {
      let conflict = conflictMap.get(className);
      if (!conflict) {
        conflict = {
          className,
          hasGradient: false,
          hasTransform: false,
          hasWillChange: false,
          hasTransition: false,
          gradientValue: null,
          transformValue: null,
          transitionValue: null,
          selectors: [],
          gradientProperties: new Map(),
          transformProperties: new Map(),
          sharedProperties: new Map(),
        };
        conflictMap.set(className, conflict);
        conflicts.push(conflict);
      }

      // Merge properties
      conflict.hasGradient = true;
      if (hasTransform) conflict.hasTransform = true;
      if (hasWillChange) conflict.hasWillChange = true;
      if (hasTransition) conflict.hasTransition = true;
      if (gradientValue) conflict.gradientValue = gradientValue;
      if (transformValue) conflict.transformValue = transformValue;
      if (transitionValue) conflict.transitionValue = transitionValue;

      if (!conflict.selectors.includes(selector)) {
        conflict.selectors.push(selector);
      }

      // Merge all properties
      for (const [name, value] of gradientProps.entries()) {
        conflict.gradientProperties.set(name, value);
      }
      for (const [name, value] of transformProps.entries()) {
        conflict.transformProperties.set(name, value);
      }
      for (const [name, value] of sharedProps.entries()) {
        conflict.sharedProperties.set(name, value);
      }
    }
  }

  return conflicts;
}

// ============================================
// CSS SPLITTING
// ============================================

/**
 * Convert properties map to CSS string
 */
function propertiesToCss(properties: Map<string, string>): string {
  return Array.from(properties.entries())
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ');
}

/**
 * Split CSS rules to separate gradient from transform
 * Handles base rules, media queries, and pseudo-classes
 */
function splitCssForDecoupling(
  css: string,
  conflicts: PotentialConflict[],
  gradientLayerSuffix: string
): string {
  if (conflicts.length === 0) return css;

  let result = css;

  // Process each conflict
  for (const conflict of conflicts) {
    const className = conflict.className;
    const bgClassName = `${className}${gradientLayerSuffix}`;
    const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Process base rules (not in media queries)
    const baseRuleRegex = new RegExp(
      `(\\.${escapedClassName}(?:\\.[\\w-]+)*(?::[\\w-]+(?:\\([^)]*\\))?)?(?:\\s*,\\s*\\.${escapedClassName}(?:\\.[\\w-]+)*(?::[\\w-]+(?:\\([^)]*\\))?)?)*)\\s*\\{([^{}]+)\\}`,
      'g'
    );

    result = result.replace(baseRuleRegex, (match: string, selectorPart: string, propertiesStr: string) => {
      // Skip if this selector has pseudo-elements
      if (selectorPart.includes('::before') || selectorPart.includes('::after')) {
        return match;
      }

      return splitRule(selectorPart, propertiesStr, bgClassName);
    });

    // Process media queries
    const mediaRegex = /@media\s*([^{]+)\{([\s\S]*?)\}\s*\}/g;
    result = result.replace(mediaRegex, (mediaMatch, query, mediaContent) => {
      // Process rules inside media query
      const innerRuleRegex = new RegExp(
        `(\\.${escapedClassName}(?:\\.[\\w-]+)*(?::[\\w-]+(?:\\([^)]*\\))?)?(?:\\s*,\\s*\\.${escapedClassName}(?:\\.[\\w-]+)*(?::[\\w-]+(?:\\([^)]*\\))?)?)*)\\s*\\{([^{}]+)\\}`,
        'g'
      );

      const processedContent = mediaContent.replace(innerRuleRegex, (match: string, selectorPart: string, propertiesStr: string) => {
        // Skip if this selector has pseudo-elements
        if (selectorPart.includes('::before') || selectorPart.includes('::after')) {
          return match;
        }

        return splitRule(selectorPart, propertiesStr, bgClassName);
      });

      return `@media ${query}{${processedContent}}`;
    });
  }

  return result;
}

/**
 * Split a single CSS rule into parent and child rules
 */
function splitRule(
  selectorPart: string,
  propertiesStr: string,
  bgClassName: string
): string {
  const props = parsePropertiesToMap(propertiesStr);
  
  // Separate properties
  const parentProps = new Map<string, string>();
  const childProps = new Map<string, string>();
  const sharedProps = new Map<string, string>();

  for (const [name, value] of props.entries()) {
    if (TRANSFORM_PROPERTIES.has(name)) {
      parentProps.set(name, value);
    } else if (GRADIENT_PROPERTIES.has(name)) {
      childProps.set(name, value);
    } else if (SHARED_PROPERTIES.has(name)) {
      sharedProps.set(name, value);
    } else {
      // Other properties stay on parent
      parentProps.set(name, value);
    }
  }

  // Extract pseudo-class from selector if present
  const pseudoMatch = selectorPart.match(/(:[\w-]+(?:\([^)]*\))?)\s*$/);
  const pseudoClass = pseudoMatch ? pseudoMatch[1] : '';
  const baseSelector = pseudoMatch ? selectorPart.slice(0, -pseudoMatch[0].length).trim() : selectorPart;

  // Only split if we actually have both gradient and transform properties
  // OR if we have a pseudo-class (hover, focus, etc.) - we need to create matching rules
  const hasBothProps = childProps.size > 0 && parentProps.size > 0;
  const isPseudoClass = pseudoClass !== '';

  if (!hasBothProps && !isPseudoClass) {
    // No split needed, return original
    return `${selectorPart} { ${propertiesStr} }`;
  }

  // Add positioning to parent if it doesn't have it
  if (!parentProps.has('position')) {
    parentProps.set('position', 'relative');
  }

  // Add positioning to child (only if we have gradient properties or it's a pseudo-class)
  if (childProps.size > 0 || isPseudoClass) {
    childProps.set('position', 'absolute');
    childProps.set('inset', '0');
    childProps.set('z-index', '-1');
  }

  // Add shared properties to child (parent already has them via other properties)
  for (const [name, value] of sharedProps.entries()) {
    childProps.set(name, value);
  }

  // Build new CSS
  const parentCss = propertiesToCss(parentProps);
  const childCss = propertiesToCss(childProps);

  // For pseudo-classes, apply to both parent and child
  if (pseudoClass) {
    // Even if child has no properties, create the rule for consistency
    return `${baseSelector}${pseudoClass} { ${parentCss} }\n.${bgClassName}${pseudoClass} { ${childCss} }`;
  }

  // Return both rules
  return `${selectorPart} { ${parentCss} }\n.${bgClassName} { ${childCss} }`;
}

// ============================================
// HTML REWRITING
// ============================================

/**
 * Rewrite HTML to inject gradient layer elements
 */
function rewriteHtmlForDecoupling(
  html: string,
  conflicts: PotentialConflict[],
  options: DecouplingOptions
): { html: string; rewriteCount: number } {
  if (conflicts.length === 0) return { html, rewriteCount: 0 };

  const gradientLayerSuffix = options.gradientLayerSuffix || '-bg';
  const filterClasses = options.filterClasses;
  let rewriteCount = 0;

  // Filter conflicts if needed
  const activeConflicts = filterClasses
    ? conflicts.filter(c => filterClasses.has(c.className))
    : conflicts;

  if (activeConflicts.length === 0) return { html, rewriteCount: 0 };

  // Use DOMParser if available, otherwise regex fallback
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div data-wf-root="true">${html}</div>`, 'text/html');
      const wrapper = doc.body.firstElementChild;

      if (wrapper) {
        for (const conflict of activeConflicts) {
          const className = conflict.className;
          const bgClassName = `${className}${gradientLayerSuffix}`;

          // Find all elements with this class
          const elements = wrapper.querySelectorAll(`.${className}`);
          
          for (const element of Array.from(elements)) {
            // Check if already has the bg element
            if (element.querySelector(`.${bgClassName}`)) continue;

            // Create gradient layer element
            const bgElement = doc.createElement('div');
            bgElement.className = bgClassName;
            
            if (options.preserveDebugInfo) {
              bgElement.setAttribute('data-decoupled-from', className);
            }

            // Insert as first child
            if (element.firstChild) {
              element.insertBefore(bgElement, element.firstChild);
            } else {
              element.appendChild(bgElement);
            }

            rewriteCount++;
          }
        }

        wrapper.removeAttribute('data-wf-root');
        const newHtml = wrapper.innerHTML;
        return { html: newHtml, rewriteCount };
      }
    } catch (error) {
      console.warn('[gradient-transform-decoupler] DOMParser failed, using regex fallback:', error);
    }
  }

  // Regex fallback for environments without DOMParser
  let result = html;
  for (const conflict of activeConflicts) {
    const className = conflict.className;
    const bgClassName = `${className}${gradientLayerSuffix}`;
    
    // Match opening tag with the class
    const classRegex = new RegExp(
      `(<[^>]+class="[^"]*\\b${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[^"]*"[^>]*>)`,
      'gi'
    );

    result = result.replace(classRegex, (match, openingTag) => {
      // Check if this element already has the bg class
      if (openingTag.includes(bgClassName)) {
        return match;
      }

      // Insert bg element right after opening tag
      const bgElement = `<div class="${bgClassName}"></div>`;
      return `${openingTag}${bgElement}`;
    });

    rewriteCount += (result.match(new RegExp(`class="${bgClassName}"`, 'g')) || []).length;
  }

  return { html: result, rewriteCount };
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Decouple gradients from transforms in HTML and CSS
 */
export function decoupleGradientsFromTransforms(
  html: string,
  css: string,
  options: DecouplingOptions = {}
): DecouplingResult {
  const warnings: string[] = [];
  const gradientLayerSuffix = options.gradientLayerSuffix || '-bg';

  // Step 1: Detect conflicts
  let conflicts = detectGradientTransformConflicts(css);
  
  if (conflicts.length === 0) {
    return {
      html,
      css,
      rewriteCount: 0,
      decoupledClasses: [],
      warnings: [],
    };
  }

  // Apply filter classes if specified
  if (options.filterClasses) {
    conflicts = conflicts.filter(conflict => options.filterClasses!.has(conflict.className));
  }

  if (conflicts.length === 0) {
    return {
      html,
      css,
      rewriteCount: 0,
      decoupledClasses: [],
      warnings: [],
    };
  }

  // Check for existing -bg classes to avoid collisions
  for (const conflict of conflicts) {
    const bgClassName = `${conflict.className}${gradientLayerSuffix}`;
    const bgClassExists = new RegExp(`\\.${bgClassName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(css);
    
    if (bgClassExists) {
      warnings.push(
        `Class "${bgClassName}" already exists. Skipping decoupling for "${conflict.className}" to avoid collision.`
      );
    }
  }

  // Filter out conflicts with existing -bg classes
  const validConflicts = conflicts.filter(conflict => {
    const bgClassName = `${conflict.className}${gradientLayerSuffix}`;
    const bgClassExists = new RegExp(`\\.${bgClassName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(css);
    return !bgClassExists;
  });

  if (validConflicts.length === 0) {
    return {
      html,
      css,
      rewriteCount: 0,
      decoupledClasses: [],
      warnings,
    };
  }

  // Step 2: Split CSS
  const splitCss = splitCssForDecoupling(css, validConflicts, gradientLayerSuffix);

  // Step 3: Rewrite HTML
  const { html: rewrittenHtml, rewriteCount } = rewriteHtmlForDecoupling(
    html,
    validConflicts,
    options
  );

  const decoupledClasses = validConflicts.map(c => c.className);

  return {
    html: rewrittenHtml,
    css: splitCss,
    rewriteCount,
    decoupledClasses,
    warnings,
  };
}

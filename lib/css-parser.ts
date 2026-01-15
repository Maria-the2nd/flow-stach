/**
 * CSS Parser Module
 * Deterministic CSS → Webflow styleLess conversion
 */

import type { WebflowStyle } from "./webflow-converter";

// ============================================
// TYPES
// ============================================

export interface ClassIndexEntry {
  className: string;
  selectors: string[];
  baseStyles: string;
  hoverStyles?: string;
  focusStyles?: string;
  activeStyles?: string;
  visitedStyles?: string;
  mediaQueries: {
    desktop?: string;
    medium?: string;
    small?: string;
    tiny?: string;
  };
  isComboClass: boolean;
  parentClass?: string;
  children: string[];
  /**
   * Parent classes this class appears under in descendant selectors.
   * E.g., for ".card-grid .card", card would have parentClasses: ["card-grid"]
   * This helps identify layout dependencies.
   */
  parentClasses: string[];
  /**
   * Indicates this class is used as a layout container (has display: flex/grid).
   * Used to ensure explicit layout properties are present.
   */
  isLayoutContainer: boolean;
}

export interface ClassIndex {
  classes: Record<string, ClassIndexEntry>;
  mediaBreakpoints: {
    desktop: string;
    medium: string;
    small: string;
    tiny: string;
  };
  warnings: CssWarning[];
}

export interface CssWarning {
  type: "unsupported_property" | "unsupported_selector" | "complex_selector" | "animation" | "variable_unresolved" | "breakpoint_unmapped";
  message: string;
  selector?: string;
  property?: string;
}

export interface ParsedCssResult {
  classIndex: ClassIndex;
  tokensCss: string;
  cleanCss: string;
  cssVariables: Map<string, string>;
  /** Typography styles extracted from element selectors (body, h1-h6, p, a) */
  elementTypography: ElementTypographyMap;
}

/**
 * Typography properties extracted from element selectors.
 * These need to be merged into the corresponding class styles.
 */
export interface ElementTypography {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: string;
  lineHeight?: string;
  letterSpacing?: string;
  color?: string;
  textTransform?: string;
  textDecoration?: string;
}

/**
 * Map of element selector → typography properties.
 * Keys: body, h1, h2, h3, h4, h5, h6, p, a
 */
export type ElementTypographyMap = Record<string, ElementTypography>;

/**
 * Mapping from element selectors to Webflow class names.
 * This is the canonical mapping used throughout the converter.
 */
export const ELEMENT_TO_CLASS_MAP: Record<string, string> = {
  // Typography elements
  body: "wf-body",
  h1: "heading-h1",
  h2: "heading-h2",
  h3: "heading-h3",
  h4: "heading-h4",
  h5: "heading-h5",
  h6: "heading-h6",
  p: "text-body",
  a: "link",
  // Structural elements (for spacing preservation)
  section: "wf-section",
  nav: "wf-nav",
  header: "wf-header",
  footer: "wf-footer",
  main: "wf-main",
  article: "wf-article",
  aside: "wf-aside",
};

/** Structural elements that can have spacing extracted */
const STRUCTURAL_ELEMENTS = new Set([
  "section", "nav", "header", "footer", "main", "article", "aside"
]);

/** Spacing properties we want to extract from structural element selectors */
const SPACING_PROPERTIES = new Set([
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "gap", "row-gap", "column-gap",
]);

/**
 * Spacing properties extracted from structural element selectors.
 */
export interface ElementSpacing {
  padding?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  margin?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  gap?: string;
  rowGap?: string;
  columnGap?: string;
}

export type ElementSpacingMap = Record<string, ElementSpacing>;

/** Typography properties we want to extract from element selectors */
const TYPOGRAPHY_PROPERTIES = new Set([
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "color",
  "text-transform",
  "text-decoration",
]);

// ============================================
// WEBFLOW PROPERTY WHITELIST
// ============================================

const WEBFLOW_SUPPORTED_PROPERTIES = new Set([
  "display", "flex-direction", "flex-wrap", "justify-content", "align-items", "align-content",
  "align-self", "flex", "flex-grow", "flex-shrink", "flex-basis", "order", "gap", "row-gap", "column-gap",
  "grid-row-gap", "grid-column-gap",
  "grid-template-columns", "grid-template-rows", "grid-column", "grid-row",
  "grid-column-start", "grid-column-end", "grid-row-start", "grid-row-end",
  "grid-auto-rows", "grid-auto-columns", "grid-auto-flow",
  "width", "height", "min-width", "max-width", "min-height", "max-height", "aspect-ratio",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "position", "top", "right", "bottom", "left", "z-index", "float", "clear",
  "background", "background-color", "background-image", "background-size", "background-position", "background-repeat",
  "background-clip", "-webkit-background-clip", "-webkit-text-fill-color",
  "color", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing",
  "text-align", "text-decoration", "text-transform", "text-indent", "text-shadow", "white-space",
  "border", "border-width", "border-style", "border-color",
  "border-top", "border-top-width", "border-top-style", "border-top-color",
  "border-right", "border-right-width", "border-right-style", "border-right-color",
  "border-bottom", "border-bottom-width", "border-bottom-style", "border-bottom-color",
  "border-left", "border-left-width", "border-left-style", "border-left-color",
  "border-radius", "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
  "opacity", "box-shadow", "filter", "backdrop-filter", "mix-blend-mode",
  "overflow", "overflow-x", "overflow-y",
  "transform", "transform-origin",
  "visibility", "cursor", "pointer-events", "user-select",
  "list-style", "list-style-type", "list-style-position",
  "object-fit", "object-position",
  "outline", "outline-width", "outline-style", "outline-color", "outline-offset",
]);

const STRIP_PROPERTIES = new Set([
  "transition", "transition-property", "transition-duration", "transition-timing-function", "transition-delay",
  "animation", "animation-name", "animation-duration", "animation-timing-function",
  "-webkit-transition", "-webkit-animation", "-moz-transition", "-moz-animation",
  "-webkit-font-smoothing", "-moz-osx-font-smoothing",
]);

const SHORTHAND_EXPANSIONS: Record<string, string[]> = {
  padding: ["padding-top", "padding-right", "padding-bottom", "padding-left"],
  margin: ["margin-top", "margin-right", "margin-bottom", "margin-left"],
  "border-radius": ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"],
  gap: ["row-gap", "column-gap"],
};

// ============================================
// CSS VARIABLE RESOLUTION
// ============================================

export function extractCssVariables(css: string): Map<string, string> {
  const variables = new Map<string, string>();

  // Find all :root blocks (there might be multiple)
  const rootRegex = /:root\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
  let rootMatch;

  while ((rootMatch = rootRegex.exec(css)) !== null) {
    const content = rootMatch[1];

    // Parse variable declarations - handle complex values with quotes and parens
    const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
    let match;
    while ((match = varRegex.exec(content)) !== null) {
      const varName = `--${match[1]}`;
      const varValue = match[2].trim();
      // Don't overwrite if already set (first definition wins)
      if (!variables.has(varName)) {
        variables.set(varName, varValue);
      }
    }
  }

  // Also look for variables defined outside :root (in html, body, etc.)
  const globalVarRegex = /(?:html|body|\*)\s*\{[^}]*(--([\w-]+)\s*:\s*([^;]+);)/g;
  let globalMatch;
  while ((globalMatch = globalVarRegex.exec(css)) !== null) {
    const varName = `--${globalMatch[2]}`;
    const varValue = globalMatch[3].trim();
    if (!variables.has(varName)) {
      variables.set(varName, varValue);
    }
  }

  return variables;
}

export function resolveCssVariables(
  value: string,
  variables: Map<string, string>,
  maxDepth = 5,
  propertyName?: string
): { resolved: string; hasUnresolved: boolean } {
  let result = value;
  let hasUnresolved = false;
  let depth = 0;

  // Font-family values need quotes preserved for font names with spaces
  const isFontFamily = propertyName?.toLowerCase() === "font-family";

  const stripQuotes = (val: string) => {
    const trimmed = val.trim();
    // NEVER strip quotes for font-family - quotes are semantically meaningful
    if (isFontFamily) {
      return trimmed;
    }
    if (trimmed.length < 2) return trimmed;
    const first = trimmed.charAt(0);
    const last = trimmed.charAt(trimmed.length - 1);
    if ((first === '"' || first === "'") && first === last) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  };

  while (result.includes("var(") && depth < maxDepth) {
    depth++;
    result = result.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_, varName, fallback) => {
      const resolved = variables.get(varName);
      if (resolved !== undefined) {
        // Strip any surrounding quotes from resolved value (shouldn't have them, but defensive)
        return stripQuotes(resolved);
      }
      if (fallback) {
        return stripQuotes(fallback);
      }
      hasUnresolved = true;
      return `var(${varName})`;
    });
  }

  // Final cleanup: ensure no unexpected quotes in the final result
  // This catches cases where variable values themselves contained quotes
  result = result.trim();

  return { resolved: result, hasUnresolved };
}

// ============================================
// SHORTHAND EXPANSION
// ============================================

function parseSpacingValues(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let parenDepth = 0;

  for (const char of value) {
    if (char === "(") parenDepth++;
    else if (char === ")") parenDepth--;
    if (char === " " && parenDepth === 0 && current.trim()) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());

  switch (parts.length) {
    case 1: return [parts[0], parts[0], parts[0], parts[0]];
    case 2: return [parts[0], parts[1], parts[0], parts[1]];
    case 3: return [parts[0], parts[1], parts[2], parts[1]];
    case 4: return parts;
    default: return [value, value, value, value];
  }
}

export function expandShorthand(property: string, value: string): Record<string, string> {
  const expansion = SHORTHAND_EXPANSIONS[property];
  if (!expansion) return { [property]: value };

  if (property === "gap") {
    const parts = parseSpacingValues(value);
    return { "row-gap": parts[0], "column-gap": parts[1] || parts[0] };
  }

  const values = parseSpacingValues(value);
  const result: Record<string, string> = {};
  expansion.forEach((prop, index) => { result[prop] = values[index] || values[0]; });
  return result;
}

// ============================================
// CSS PARSING
// ============================================

/**
 * Convert a CSS length value to pixels.
 * Handles px, rem, em units (assumes 16px base for rem/em).
 */
function cssLengthToPixels(value: number, unit: string): number {
  const lowerUnit = unit.toLowerCase();
  if (lowerUnit === "px") return value;
  if (lowerUnit === "rem" || lowerUnit === "em") return value * 16;
  // For other units (%, vh, vw, etc.), we can't reliably convert
  return NaN;
}

function detectBreakpoint(query: string): "desktop" | "medium" | "small" | "tiny" | null {
  // Match max-width with any common unit (px, rem, em)
  const maxWidth = query.match(/max-width:\s*([\d.]+)(px|rem|em)/i);
  if (!maxWidth) return null;
  const value = parseFloat(maxWidth[1]);
  const unit = maxWidth[2];
  const width = cssLengthToPixels(value, unit);
  if (isNaN(width)) return null;
  if (width <= 479) return "tiny";
  if (width <= 767) return "small";
  if (width <= 991) return "medium";
  if (width <= 1200) return "desktop";
  return null;
}

function detectMinWidth(query: string): number | null {
  // Match min-width with any common unit (px, rem, em)
  const minWidth = query.match(/min-width:\s*([\d.]+)(px|rem|em)/i);
  if (!minWidth) return null;
  const value = parseFloat(minWidth[1]);
  const unit = minWidth[2];
  const pixels = cssLengthToPixels(value, unit);
  if (isNaN(pixels)) return null;
  return pixels;
}

function expandFlexShorthand(value: string): Record<string, string> {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return {};

  // Keyword forms
  if (trimmed === "none") {
    return { "flex-grow": "0", "flex-shrink": "0", "flex-basis": "auto" };
  }
  if (trimmed === "auto") {
    return { "flex-grow": "1", "flex-shrink": "1", "flex-basis": "auto" };
  }
  if (trimmed === "initial") {
    return { "flex-grow": "0", "flex-shrink": "1", "flex-basis": "auto" };
  }

  const parts = trimmed.split(" ");

  // Single number: flex-grow; default shrink=1; basis=0%
  if (parts.length === 1 && /^-?\d*\.?\d+$/.test(parts[0])) {
    return { "flex-grow": parts[0], "flex-shrink": "1", "flex-basis": "0%" };
  }

  // Two-part forms:
  // - "<grow> <shrink>"
  // - "<grow> <basis>"
  if (parts.length === 2) {
    const [a, b] = parts;
    const aIsNum = /^-?\d*\.?\d+$/.test(a);
    const bIsNum = /^-?\d*\.?\d+$/.test(b);
    if (aIsNum && bIsNum) {
      return { "flex-grow": a, "flex-shrink": b, "flex-basis": "0%" };
    }
    if (aIsNum) {
      return { "flex-grow": a, "flex-shrink": "1", "flex-basis": b };
    }
    return {};
  }

  // Three-part form: "<grow> <shrink> <basis>"
  if (parts.length >= 3) {
    const [grow, shrink, ...basisParts] = parts;
    const basis = basisParts.join(" ");
    if (/^-?\d*\.?\d+$/.test(grow) && /^-?\d*\.?\d+$/.test(shrink)) {
      return { "flex-grow": grow, "flex-shrink": shrink, "flex-basis": basis };
    }
  }

  return {};
}

function expandBorderShorthand(value: string): Record<string, string> {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "none" || trimmed === "0") {
    return {
      "border-width": "0",
      "border-style": "none",
      "border-color": "transparent",
    };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};

  const borderStyles = new Set([
    "none", "hidden", "dotted", "dashed", "solid", "double",
    "groove", "ridge", "inset", "outset"
  ]);

  let width: string | undefined;
  let style: string | undefined;
  let color: string | undefined;

  for (const part of parts) {
    // Check if it's a width (has units or is a number)
    if (/^\d+(\.\d+)?(px|em|rem|pt|pc|in|cm|mm|ex|ch|vw|vh|vmin|vmax|%)$/.test(part) || 
        /^(thin|medium|thick)$/.test(part)) {
      if (!width) width = part;
      continue;
    }

    // Check if it's a style keyword
    if (borderStyles.has(part.toLowerCase())) {
      if (!style) style = part;
      continue;
    }

    // Otherwise, treat as color
    if (!color) color = part;
  }

  const result: Record<string, string> = {};
  if (width) result["border-width"] = width;
  if (style) result["border-style"] = style;
  if (color) result["border-color"] = color;

  // If no explicit values, use defaults
  if (!width && !style && !color && parts.length === 1) {
    // Single value could be any of the three - most common is width
    if (/^\d/.test(parts[0])) {
      result["border-width"] = parts[0];
      result["border-style"] = "solid";
      result["border-color"] = "currentColor";
    } else if (borderStyles.has(parts[0].toLowerCase())) {
      result["border-width"] = "medium";
      result["border-style"] = parts[0];
      result["border-color"] = "currentColor";
    } else {
      result["border-width"] = "medium";
      result["border-style"] = "solid";
      result["border-color"] = parts[0];
    }
  } else {
    // Set defaults for missing parts
    if (!width) result["border-width"] = "medium";
    if (!style) result["border-style"] = "none";
    if (!color) result["border-color"] = "currentColor";
  }

  return result;
}

function parseProperties(propertiesStr: string, variables: Map<string, string>, warnings: CssWarning[]): Record<string, string> {
  const result: Record<string, string> = {};
  const properties: string[] = [];
  let current = "";
  let parenDepth = 0;

  for (const char of propertiesStr) {
    if (char === "(") parenDepth++;
    else if (char === ")") parenDepth--;
    if (char === ";" && parenDepth === 0) {
      if (current.trim()) properties.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) properties.push(current.trim());

  for (const prop of properties) {
    const colonIndex = prop.indexOf(":");
    if (colonIndex === -1) continue;

    const name = prop.substring(0, colonIndex).trim().toLowerCase();
    let value = prop.substring(colonIndex + 1).trim().replace(/\s*!important\s*$/i, "");

    if (STRIP_PROPERTIES.has(name)) continue;

    const { resolved, hasUnresolved } = resolveCssVariables(value, variables, 5, name);
    if (hasUnresolved) {
      warnings.push({ type: "variable_unresolved", message: `Unresolved CSS variable in: ${name}: ${value}`, property: name });
    }
    value = resolved;

    // Expand flex shorthand into explicit props (Webflow is more reliable with longhands)
    if (name === "flex") {
      const expanded = expandFlexShorthand(value);
      if (Object.keys(expanded).length > 0) {
        Object.assign(result, expanded);
      } else {
        warnings.push({ type: "unsupported_property", message: `Unparsed flex shorthand: ${value}`, property: name });
      }
      continue;
    }

    // Expand border shorthand into explicit props (Webflow handles longhands more reliably)
    if (name === "border") {
      const expanded = expandBorderShorthand(value);
      if (Object.keys(expanded).length > 0) {
        Object.assign(result, expanded);
      } else {
        warnings.push({ type: "unsupported_property", message: `Unparsed border shorthand: ${value}`, property: name });
      }
      continue;
    }

    if (!WEBFLOW_SUPPORTED_PROPERTIES.has(name) && !SHORTHAND_EXPANSIONS[name]) {
      warnings.push({ type: "unsupported_property", message: `Unsupported CSS property: ${name}`, property: name });
      continue;
    }

    if (SHORTHAND_EXPANSIONS[name]) {
      Object.assign(result, expandShorthand(name, value));
    } else {
      if (name === "grid-column" || name === "grid-row") {
        const placement = parseGridPlacement(value);
        if (placement) {
          if (name === "grid-column") {
            result["grid-column-start"] = placement.start;
            result["grid-column-end"] = placement.end;
          } else {
            result["grid-row-start"] = placement.start;
            result["grid-row-end"] = placement.end;
          }
          continue;
        }
      }
      result[name] = value;
    }
  }

  return result;
}

function parseGridPlacement(value: string): { start: string; end: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("span ")) {
    const spanValue = trimmed.replace(/\s+/g, " ");
    return { start: "auto", end: spanValue };
  }

  if (trimmed.includes("/")) {
    const parts = trimmed.split("/").map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const start = parts[0];
      const end = parts[1];
      return { start, end };
    }
  }

  if (/^-?\d+$/.test(trimmed)) {
    return { start: trimmed, end: "auto" };
  }

  return null;
}

export function propertiesToStyleLess(properties: Record<string, string>): string {
  return Object.entries(properties).map(([prop, val]) => `${prop}: ${val};`).join(" ");
}

function mergeStyleLess(existing: string | undefined, newStyles: string): string {
  if (!existing) return newStyles;
  if (!newStyles) return existing;

  const existingProps = new Map<string, string>();
  existing.split(";").forEach((prop) => {
    const parts = prop.split(":");
    if (parts.length >= 2) {
      const name = parts[0]?.trim();
      const value = parts.slice(1).join(":").trim();
      if (name && value) existingProps.set(name, value);
    }
  });

  newStyles.split(";").forEach((prop) => {
    const parts = prop.split(":");
    if (parts.length >= 2) {
      const name = parts[0]?.trim();
      const value = parts.slice(1).join(":").trim();
      if (name && value) existingProps.set(name, value);
    }
  });

  return Array.from(existingProps.entries()).map(([prop, val]) => `${prop}: ${val};`).join(" ");
}

function styleLessToMap(styleLess: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!styleLess) return map;
  styleLess.split(";").forEach((prop) => {
    const parts = prop.split(":");
    if (parts.length >= 2) {
      const name = parts[0]?.trim();
      const value = parts.slice(1).join(":").trim();
      if (name && value) map.set(name, value);
    }
  });
  return map;
}

function mapToStyleLess(map: Map<string, string>): string {
  return Array.from(map.entries()).map(([prop, val]) => `${prop}: ${val};`).join(" ");
}

/**
 * Validate styleLess string format - ensure no quoted property names or values.
 * Webflow expects unquoted CSS property format: "property: value;"
 * This function detects and strips any unexpected quotes.
 */
function validateStyleLess(styleLess: string): string {
  if (!styleLess) return styleLess;
  
  // Check for quoted property names (e.g., "'background': '#08090b'")
  // This pattern matches property names or values wrapped in single or double quotes
  const quotedPattern = /(['"])([^'"]+)\1\s*:\s*(['"])([^'"]+)\3/g;
  
  if (quotedPattern.test(styleLess)) {
    // Strip quotes from property names and values
    return styleLess.replace(quotedPattern, (match, quote1, prop, quote2, val) => {
      return `${prop}: ${val};`;
    });
  }
  
  return styleLess;
}

/**
 * Merge styleLess but preserve existing properties (existing wins).
 * Useful when backfilling mobile values into breakpoint variants.
 */
function mergeStyleLessPreserveExisting(existing: string | undefined, incoming: string): string {
  if (!existing) return incoming;
  if (!incoming) return existing;
  const existingMap = styleLessToMap(existing);
  const incomingMap = styleLessToMap(incoming);
  for (const [k, v] of incomingMap.entries()) {
    if (!existingMap.has(k)) existingMap.set(k, v);
  }
  return mapToStyleLess(existingMap);
}

function minWidthToOverrideBreakpoints(minWidth: number): Array<"medium" | "small" | "tiny"> {
  // Webflow is desktop-first (base + max-width breakpoints).
  // For mobile-first CSS (min-width), we promote those rules into base (desktop),
  // and we "backfill" the previous base (mobile) values into the breakpoints that are BELOW minWidth.
  //
  // Breakpoint ranges (Webflow):
  // - base: >= 992px
  // - medium: <= 991px
  // - small: <= 767px
  // - tiny: <= 479px
  if (minWidth >= 992) return ["medium", "small", "tiny"];
  if (minWidth >= 768) return ["small", "tiny"];
  if (minWidth >= 480) return ["tiny"];
  return [];
}

function applyMinWidthPropertiesToEntry(args: {
  entry: ClassIndexEntry;
  properties: Record<string, string>;
  minWidth: number;
}): void {
  const { entry, properties, minWidth } = args;
  const overrideBreakpoints = minWidthToOverrideBreakpoints(minWidth);
  
  if (overrideBreakpoints.length === 0) {
    // Applies everywhere; just merge into base.
    entry.baseStyles = mergeStyleLess(entry.baseStyles, propertiesToStyleLess(properties));
    return;
  }

  const baseMap = styleLessToMap(entry.baseStyles);

  for (const [propName, nextVal] of Object.entries(properties)) {
    const prevVal = baseMap.get(propName);
    if (prevVal) {
      const backfill = `${propName}: ${prevVal};`;
      for (const bp of overrideBreakpoints) {
        entry.mediaQueries[bp] = mergeStyleLessPreserveExisting(entry.mediaQueries[bp], backfill);
      }
    }
    // Promote desktop/tablet value into base (desktop-first).
    baseMap.set(propName, nextVal);
  }

  entry.baseStyles = mapToStyleLess(baseMap);
}

interface ParsedSelectorResult {
  className: string | null;
  pseudoClass: string | null;
  isCombo: boolean;
  comboParentClass: string | null;
  /** Parent classes from descendant selectors (e.g., ".parent .child" -> ["parent"]) */
  parentClasses: string[];
  /** Whether this is a descendant selector */
  isDescendant: boolean;
}

/**
 * Extract the last class name from a selector and check for pseudo-class.
 * Also extracts parent classes from descendant selectors.
 */
function parseSelector(selector: string): ParsedSelectorResult {
  // Find all classes in the selector
  const classMatches = selector.match(/\.([a-zA-Z_-][\w-]*)/g);
  if (!classMatches || classMatches.length === 0) {
    return {
      className: null,
      pseudoClass: null,
      isCombo: false,
      comboParentClass: null,
      parentClasses: [],
      isDescendant: false,
    };
  }

  // Check for pseudo-class (remove it for class analysis)
  const pseudoMatch = selector.match(/:(\w+(?:-\w+)*)(?:\([^)]*\))?\s*$/);
  const pseudoClass = pseudoMatch ? pseudoMatch[1] : null;

  // Check if it's a combo class (e.g., .btn.primary - no space between)
  const isCombo = /\.[a-zA-Z_-][\w-]*\.[a-zA-Z_-][\w-]*/.test(selector);

  // Check if it's a descendant selector (has space or > between classes)
  const isDescendant = /\.[a-zA-Z_-][\w-]*[\s>]+/.test(selector);

  const comboParentClass =
    isCombo && !isDescendant && classMatches.length >= 2
      ? classMatches[classMatches.length - 2].substring(1)
      : null;

  // Extract parent classes (all classes except the last one in descendant selectors)
  const parentClasses: string[] = [];
  if (isDescendant && classMatches.length > 1) {
    for (let i = 0; i < classMatches.length - 1; i++) {
      parentClasses.push(classMatches[i].substring(1)); // Remove the dot
    }
  }

  // Use the LAST class (most specific target)
  const className = classMatches[classMatches.length - 1].substring(1);

  return { className, pseudoClass, isCombo, comboParentClass, parentClasses, isDescendant };
}

/**
 * Detect if properties indicate a layout container (flex or grid).
 */
function isLayoutContainerProps(properties: Record<string, string>): boolean {
  const display = properties["display"]?.toLowerCase();
  return display === "flex" || display === "inline-flex" || display === "grid" || display === "inline-grid";
}

/**
 * Process a single CSS rule and add to classes map
 */
function processRule(
  selector: string,
  propertiesStr: string,
  variables: Map<string, string>,
  classes: Record<string, ClassIndexEntry>,
  warnings: CssWarning[],
  breakpoint?: "desktop" | "medium" | "small" | "tiny"
): void {
  const { className, pseudoClass, isCombo, comboParentClass, parentClasses, isDescendant } =
    parseSelector(selector);
  if (!className) return;

  const properties = parseProperties(propertiesStr, variables, warnings);
  const styleLess = propertiesToStyleLess(properties);
  if (!styleLess) return;

  // Detect if this is a layout container
  const isLayoutContainer = isLayoutContainerProps(properties);

  if (!classes[className]) {
    classes[className] = {
      className,
      selectors: [],
      baseStyles: "",
      mediaQueries: {},
      isComboClass: isCombo,
      children: [],
      parentClasses: [],
      isLayoutContainer: false,
    };
  }

  const entry = classes[className];
  entry.selectors.push(selector);
  if (isCombo) entry.isComboClass = true;
  if (isLayoutContainer) entry.isLayoutContainer = true;

  if (comboParentClass) {
    entry.parentClass = comboParentClass;
    if (!classes[comboParentClass]) {
      classes[comboParentClass] = {
        className: comboParentClass,
        selectors: [],
        baseStyles: "",
        mediaQueries: {},
        isComboClass: false,
        children: [],
        parentClasses: [],
        isLayoutContainer: false,
      };
    }
    if (!classes[comboParentClass].children.includes(className)) {
      classes[comboParentClass].children.push(className);
    }
  }

  // Track parent-child relationships for descendant selectors
  if (isDescendant && parentClasses.length > 0) {
    for (const parentClass of parentClasses) {
      if (!entry.parentClasses.includes(parentClass)) {
        entry.parentClasses.push(parentClass);
      }
      // Also ensure parent class entry exists and tracks this as a child
      if (!classes[parentClass]) {
        classes[parentClass] = {
          className: parentClass,
          selectors: [],
          baseStyles: "",
          mediaQueries: {},
          isComboClass: false,
          children: [],
          parentClasses: [],
          isLayoutContainer: false,
        };
      }
      if (!classes[parentClass].children.includes(className)) {
        classes[parentClass].children.push(className);
      }
    }
    // Warn about descendant selectors that may not work in Webflow
    if (!breakpoint && !pseudoClass) {
      warnings.push({
        type: "complex_selector",
        message: `Descendant selector "${selector}" flattened to .${className}. Parent context from .${parentClasses.join(", .")} may be lost.`,
        selector,
      });
    }
  }

  if (breakpoint) {
    // Media query styles
    if (!pseudoClass) {
      entry.mediaQueries[breakpoint] = mergeStyleLess(entry.mediaQueries[breakpoint], styleLess);
    }
    // TODO: handle pseudo + breakpoint variants if needed
  } else {
    // Base styles
    if (pseudoClass === "hover") {
      entry.hoverStyles = mergeStyleLess(entry.hoverStyles, styleLess);
    } else if (pseudoClass === "focus" || pseudoClass === "focus-visible") {
      entry.focusStyles = mergeStyleLess(entry.focusStyles, styleLess);
    } else if (pseudoClass === "active") {
      entry.activeStyles = mergeStyleLess(entry.activeStyles, styleLess);
    } else if (pseudoClass === "visited") {
      entry.visitedStyles = mergeStyleLess(entry.visitedStyles, styleLess);
    } else if (!pseudoClass) {
      entry.baseStyles = mergeStyleLess(entry.baseStyles, styleLess);
    }
  }
}

/**
 * Extract @media blocks using proper brace matching.
 * Returns array of { query, content, fullMatch } for each @media block.
 */
function extractMediaBlocks(css: string): Array<{ query: string; content: string; fullMatch: string }> {
  const results: Array<{ query: string; content: string; fullMatch: string }> = [];
  const mediaStartRegex = /@media\s*([^{]+)\s*\{/g;
  let match;

  while ((match = mediaStartRegex.exec(css)) !== null) {
    const query = match[1].trim();
    const startIndex = match.index;
    const openBraceIndex = match.index + match[0].length - 1;

    // Find the matching closing brace using brace counting
    let braceCount = 1;
    let i = openBraceIndex + 1;
    while (i < css.length && braceCount > 0) {
      if (css[i] === "{") braceCount++;
      else if (css[i] === "}") braceCount--;
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

export function parseCSS(css: string): ParsedCssResult {
  const warnings: CssWarning[] = [];
  const classes: Record<string, ClassIndexEntry> = {};
  const variables = extractCssVariables(css);

  const rootMatch = css.match(/:root\s*\{[^}]+\}/);
  const tokensCss = rootMatch ? rootMatch[0] : "";
  const cleanCss = css.replace(/:root\s*\{[^}]+\}/g, "").trim();

  // ============================================
  // STEP 1: Extract element typography and spacing FIRST
  // ============================================
  const elementTypography = extractElementTypography(cleanCss, variables, warnings);
  const elementSpacing = extractElementSpacing(cleanCss, variables, warnings);

  // Generic rule regex that matches selector { properties }
  const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;

  // Parse media queries - use a proper brace-matching approach
  let cssWithoutMedia = cleanCss;
  const mediaBlocks = extractMediaBlocks(cleanCss);

  // Remove all media blocks from CSS for base rule parsing (mobile-first base)
  for (const { fullMatch } of mediaBlocks) {
    cssWithoutMedia = cssWithoutMedia.replace(fullMatch, "");
  }

  // Parse base rules (outside media queries) FIRST so min-width blocks can promote overrides
  let baseMatch;
  while ((baseMatch = ruleRegex.exec(cssWithoutMedia)) !== null) {
    const selectors = baseMatch[1].trim();
    const propertiesStr = baseMatch[2].trim();

    // Skip @-rules and non-class selectors
    if (selectors.startsWith("@") || !selectors.includes(".")) continue;

    // Handle comma-separated selectors
    for (const sel of selectors.split(",")) {
      processRule(sel.trim(), propertiesStr, variables, classes, warnings);
    }
  }

  // Now parse media blocks
  for (const { query, content } of mediaBlocks) {
    const maxBreakpoint = detectBreakpoint(query);
    const minWidth = detectMinWidth(query);

    // Parse rules inside media query
    let ruleMatch;
    const innerRegex = /([^{}]+)\{([^{}]+)\}/g;
    while ((ruleMatch = innerRegex.exec(content)) !== null) {
      const selectors = ruleMatch[1].trim();
      const propertiesStr = ruleMatch[2].trim();

      // Skip non-class selectors
      if (!selectors.includes(".")) continue;

      if (maxBreakpoint) {
        for (const sel of selectors.split(",")) {
          processRule(sel.trim(), propertiesStr, variables, classes, warnings, maxBreakpoint);
        }
        continue;
      }

      if (typeof minWidth === "number") {
        // Mobile-first (min-width) → Webflow desktop-first:
        // promote these properties into base, and backfill previous base values into smaller breakpoints.
        const props = parseProperties(propertiesStr, variables, warnings);
        for (const sel of selectors.split(",")) {
          const parsed = parseSelector(sel.trim());
          if (!parsed.className) continue;
          // Only handle non-pseudo min-width rules for now.
          if (parsed.pseudoClass) continue;

          if (!classes[parsed.className]) {
            classes[parsed.className] = {
              className: parsed.className,
              selectors: [],
              baseStyles: "",
              mediaQueries: {},
              isComboClass: parsed.isCombo,
              children: [],
              parentClasses: [],
              isLayoutContainer: false,
            };
          }

          const entry = classes[parsed.className];
          entry.selectors.push(sel.trim());
          applyMinWidthPropertiesToEntry({ entry, properties: props, minWidth });
        }
        continue;
      }

      warnings.push({ type: "breakpoint_unmapped", message: `Unmapped media query: ${query}` });
    }
  }

  // ============================================
  // STEP 2: Merge element typography and spacing into class styles
  // ============================================
  mergeElementTypographyIntoClasses(elementTypography, classes, warnings);
  mergeElementSpacingIntoClasses(elementSpacing, classes, warnings);

  // ============================================
  // STEP 3: Enforce explicit layout properties on containers
  // ============================================
  enforceExplicitLayoutProperties(classes, warnings);

  return {
    classIndex: {
      classes,
      mediaBreakpoints: {
        desktop: "max-width: 1200px",
        medium: "max-width: 991px",
        small: "max-width: 767px",
        tiny: "max-width: 479px",
      },
      warnings,
    },
    tokensCss,
    cleanCss,
    cssVariables: variables,
    elementTypography,
  };
}

/**
 * Extract typography properties from element selectors (body, h1-h6, p, a).
 * These selectors don't have classes but we need their typography.
 */
function extractElementTypography(
  css: string,
  variables: Map<string, string>,
  warnings: CssWarning[]
): ElementTypographyMap {
  const result: ElementTypographyMap = {};
  const elementSelectors = Object.keys(ELEMENT_TO_CLASS_MAP);

  // Match rules: selector { properties }
  const ruleRegex = /([^{}@]+)\{([^{}]+)\}/g;
  let match;

  while ((match = ruleRegex.exec(css)) !== null) {
    const selectorPart = match[1].trim();
    const propertiesStr = match[2].trim();

    // Handle comma-separated selectors (e.g., "h1, h2, h3 { ... }")
    const selectors = selectorPart.split(",").map(s => s.trim());

    for (const selector of selectors) {
      // Check if this is a pure element selector (no classes, no descendants)
      const normalizedSelector = selector.toLowerCase();

      // Match exact element selectors only (body, h1, p, etc.)
      // Also match grouped like "h1" from "h1, h2, h3"
      if (elementSelectors.includes(normalizedSelector) && !selector.includes(".") && !selector.includes(" ")) {
        const typography = parseTypographyProperties(propertiesStr, variables, warnings);

        if (Object.keys(typography).length > 0) {
          // Merge into existing or create new
          result[normalizedSelector] = {
            ...result[normalizedSelector],
            ...typography,
          };
        }
      }
    }
  }

  return result;
}

/**
 * Parse CSS properties string and extract only typography-related properties.
 * Resolves CSS variables to actual values.
 */
function parseTypographyProperties(
  propertiesStr: string,
  variables: Map<string, string>,
  warnings: CssWarning[]
): ElementTypography {
  const result: ElementTypography = {};

  // Split properties, handling values with parentheses
  const properties: string[] = [];
  let current = "";
  let parenDepth = 0;

  for (const char of propertiesStr) {
    if (char === "(") parenDepth++;
    else if (char === ")") parenDepth--;
    if (char === ";" && parenDepth === 0) {
      if (current.trim()) properties.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) properties.push(current.trim());

  for (const prop of properties) {
    const colonIndex = prop.indexOf(":");
    if (colonIndex === -1) continue;

    const name = prop.substring(0, colonIndex).trim().toLowerCase();
    let value = prop.substring(colonIndex + 1).trim().replace(/\s*!important\s*$/i, "");

    // Only process typography properties
    if (!TYPOGRAPHY_PROPERTIES.has(name)) continue;

    // Resolve CSS variables (pass property name to preserve font-family quotes)
    const { resolved, hasUnresolved } = resolveCssVariables(value, variables, 5, name);
    if (hasUnresolved) {
      warnings.push({
        type: "variable_unresolved",
        message: `Unresolved CSS variable in typography: ${name}: ${value}`,
        property: name
      });
    }
    value = resolved;

    // Map to ElementTypography keys (camelCase)
    switch (name) {
      case "font-family":
        result.fontFamily = value;
        break;
      case "font-size":
        result.fontSize = value;
        break;
      case "font-weight":
        result.fontWeight = value;
        break;
      case "font-style":
        result.fontStyle = value;
        break;
      case "line-height":
        result.lineHeight = value;
        break;
      case "letter-spacing":
        result.letterSpacing = value;
        break;
      case "color":
        result.color = value;
        break;
      case "text-transform":
        result.textTransform = value;
        break;
      case "text-decoration":
        result.textDecoration = value;
        break;
    }
  }

  return result;
}

/**
 * Merge element typography into corresponding class entries.
 * Creates class entries if they don't exist.
 *
 * This is the KEY fix: typography from `h1 { font-family: ... }`
 * becomes `.heading-h1 { font-family: ... }` in Webflow.
 */
function mergeElementTypographyIntoClasses(
  elementTypography: ElementTypographyMap,
  classes: Record<string, ClassIndexEntry>,
  _warnings: CssWarning[]
): void {
  void _warnings;
  for (const [element, typography] of Object.entries(elementTypography)) {
    const className = ELEMENT_TO_CLASS_MAP[element];
    if (!className) continue;

    // Convert ElementTypography to styleLess format
    const typographyStyles = typographyToStyleLess(typography);
    if (!typographyStyles) continue;

    // Create or merge into class entry
    if (!classes[className]) {
      classes[className] = {
        className,
        selectors: [`.${className}`],
        baseStyles: typographyStyles,
        mediaQueries: {},
        isComboClass: false,
        children: [],
        parentClasses: [],
        isLayoutContainer: false,
      };
      // Log that we created a typography class from element selector
      console.log(`[css-parser] Created .${className} from ${element} selector with: ${typographyStyles}`);
    } else {
      // Merge typography into existing class, typography takes precedence for font properties
      classes[className].baseStyles = mergeTypographyIntoStyles(
        classes[className].baseStyles,
        typographyStyles
      );
    }
  }
}

/**
 * Convert ElementTypography to styleLess format.
 */
function typographyToStyleLess(typography: ElementTypography): string {
  const parts: string[] = [];

  if (typography.fontFamily) parts.push(`font-family: ${typography.fontFamily};`);
  if (typography.fontSize) parts.push(`font-size: ${typography.fontSize};`);
  if (typography.fontWeight) parts.push(`font-weight: ${typography.fontWeight};`);
  if (typography.fontStyle) parts.push(`font-style: ${typography.fontStyle};`);
  if (typography.lineHeight) parts.push(`line-height: ${typography.lineHeight};`);
  if (typography.letterSpacing) parts.push(`letter-spacing: ${typography.letterSpacing};`);
  if (typography.color) parts.push(`color: ${typography.color};`);
  if (typography.textTransform) parts.push(`text-transform: ${typography.textTransform};`);
  if (typography.textDecoration) parts.push(`text-decoration: ${typography.textDecoration};`);

  return parts.join(" ");
}

// ============================================
// STRUCTURAL ELEMENT SPACING EXTRACTION
// ============================================

/**
 * Extract spacing properties from structural element selectors (section, nav, header, footer, etc.).
 * These selectors don't have classes but we need their spacing to be preserved.
 */
function extractElementSpacing(
  css: string,
  variables: Map<string, string>,
  warnings: CssWarning[]
): ElementSpacingMap {
  const result: ElementSpacingMap = {};

  // Match rules: selector { properties }
  const ruleRegex = /([^{}@]+)\{([^{}]+)\}/g;
  let match;

  while ((match = ruleRegex.exec(css)) !== null) {
    const selectorPart = match[1].trim();
    const propertiesStr = match[2].trim();

    // Handle comma-separated selectors (e.g., "section, nav { ... }")
    const selectors = selectorPart.split(",").map(s => s.trim());

    for (const selector of selectors) {
      const normalizedSelector = selector.toLowerCase();

      // Match exact structural element selectors only (no classes, no descendants)
      if (STRUCTURAL_ELEMENTS.has(normalizedSelector) && !selector.includes(".") && !selector.includes(" ")) {
        const spacing = parseSpacingProperties(propertiesStr, variables, warnings);

        if (Object.keys(spacing).length > 0) {
          // Merge into existing or create new
          result[normalizedSelector] = {
            ...result[normalizedSelector],
            ...spacing,
          };
        }
      }
    }
  }

  return result;
}

/**
 * Parse CSS properties string and extract only spacing-related properties.
 * Resolves CSS variables to actual values and expands shorthands.
 */
function parseSpacingProperties(
  propertiesStr: string,
  variables: Map<string, string>,
  warnings: CssWarning[]
): ElementSpacing {
  const result: ElementSpacing = {};

  // Split properties, handling values with parentheses
  const properties: string[] = [];
  let current = "";
  let parenDepth = 0;

  for (const char of propertiesStr) {
    if (char === "(") parenDepth++;
    else if (char === ")") parenDepth--;
    if (char === ";" && parenDepth === 0) {
      if (current.trim()) properties.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) properties.push(current.trim());

  for (const prop of properties) {
    const colonIndex = prop.indexOf(":");
    if (colonIndex === -1) continue;

    const name = prop.substring(0, colonIndex).trim().toLowerCase();
    let value = prop.substring(colonIndex + 1).trim().replace(/\s*!important\s*$/i, "");

    // Only process spacing properties
    if (!SPACING_PROPERTIES.has(name)) continue;

    // Resolve CSS variables
    const { resolved, hasUnresolved } = resolveCssVariables(value, variables, 5, name);
    if (hasUnresolved) {
      warnings.push({
        type: "variable_unresolved",
        message: `Unresolved CSS variable in spacing: ${name}: ${value}`,
        property: name
      });
    }
    value = resolved;

    // Handle shorthand expansion for padding/margin
    if (name === "padding" || name === "margin") {
      const expanded = parseSpacingValues(value);
      if (expanded.length === 4) {
        if (name === "padding") {
          result.paddingTop = expanded[0];
          result.paddingRight = expanded[1];
          result.paddingBottom = expanded[2];
          result.paddingLeft = expanded[3];
        } else {
          result.marginTop = expanded[0];
          result.marginRight = expanded[1];
          result.marginBottom = expanded[2];
          result.marginLeft = expanded[3];
        }
      }
      continue;
    }

    // Map to ElementSpacing keys (camelCase)
    switch (name) {
      case "padding-top": result.paddingTop = value; break;
      case "padding-right": result.paddingRight = value; break;
      case "padding-bottom": result.paddingBottom = value; break;
      case "padding-left": result.paddingLeft = value; break;
      case "margin-top": result.marginTop = value; break;
      case "margin-right": result.marginRight = value; break;
      case "margin-bottom": result.marginBottom = value; break;
      case "margin-left": result.marginLeft = value; break;
      case "gap": result.gap = value; break;
      case "row-gap": result.rowGap = value; break;
      case "column-gap": result.columnGap = value; break;
    }
  }

  return result;
}

/**
 * Merge element spacing into corresponding class entries.
 * Creates class entries if they don't exist.
 *
 * This preserves spacing from `section { padding: 80px 0; }`
 * as `.wf-section { padding-top: 80px; padding-bottom: 80px; }` in Webflow.
 */
function mergeElementSpacingIntoClasses(
  elementSpacing: ElementSpacingMap,
  classes: Record<string, ClassIndexEntry>,
  _warnings: CssWarning[]
): void {
  void _warnings;
  for (const [element, spacing] of Object.entries(elementSpacing)) {
    const className = ELEMENT_TO_CLASS_MAP[element];
    if (!className) continue;

    // Convert ElementSpacing to styleLess format
    const spacingStyles = spacingToStyleLess(spacing);
    if (!spacingStyles) continue;

    // Create or merge into class entry
    if (!classes[className]) {
      classes[className] = {
        className,
        selectors: [`.${className}`],
        baseStyles: spacingStyles,
        mediaQueries: {},
        isComboClass: false,
        children: [],
        parentClasses: [],
        isLayoutContainer: false,
      };
      console.log(`[css-parser] Created .${className} from ${element} selector with spacing: ${spacingStyles}`);
    } else {
      // Merge spacing into existing class
      classes[className].baseStyles = mergeTypographyIntoStyles(
        classes[className].baseStyles,
        spacingStyles
      );
    }
  }
}

/**
 * Convert ElementSpacing to styleLess format.
 */
function spacingToStyleLess(spacing: ElementSpacing): string {
  const parts: string[] = [];

  if (spacing.paddingTop) parts.push(`padding-top: ${spacing.paddingTop};`);
  if (spacing.paddingRight) parts.push(`padding-right: ${spacing.paddingRight};`);
  if (spacing.paddingBottom) parts.push(`padding-bottom: ${spacing.paddingBottom};`);
  if (spacing.paddingLeft) parts.push(`padding-left: ${spacing.paddingLeft};`);
  if (spacing.marginTop) parts.push(`margin-top: ${spacing.marginTop};`);
  if (spacing.marginRight) parts.push(`margin-right: ${spacing.marginRight};`);
  if (spacing.marginBottom) parts.push(`margin-bottom: ${spacing.marginBottom};`);
  if (spacing.marginLeft) parts.push(`margin-left: ${spacing.marginLeft};`);
  if (spacing.gap) parts.push(`gap: ${spacing.gap};`);
  if (spacing.rowGap) parts.push(`row-gap: ${spacing.rowGap};`);
  if (spacing.columnGap) parts.push(`column-gap: ${spacing.columnGap};`);

  return parts.join(" ");
}

/**
 * Merge typography styles into existing styleLess.
 * Typography properties (font-family, font-size, etc.) from element selectors
 * should fill in missing values but not override explicit class values.
 */
function mergeTypographyIntoStyles(existingStyles: string, typographyStyles: string): string {
  if (!existingStyles) return typographyStyles;
  if (!typographyStyles) return existingStyles;

  // Parse existing properties
  const existingProps = new Map<string, string>();
  existingStyles.split(";").forEach((prop) => {
    const parts = prop.split(":");
    if (parts.length >= 2) {
      const name = parts[0]?.trim();
      const value = parts.slice(1).join(":").trim();
      if (name && value) existingProps.set(name, value);
    }
  });

  // Parse typography properties - only add if NOT already defined
  typographyStyles.split(";").forEach((prop) => {
    const parts = prop.split(":");
    if (parts.length >= 2) {
      const name = parts[0]?.trim();
      const value = parts.slice(1).join(":").trim();
      // Only add typography if not already defined in the class
      if (name && value && !existingProps.has(name)) {
        existingProps.set(name, value);
      }
    }
  });

  return Array.from(existingProps.entries())
    .map(([prop, val]) => `${prop}: ${val};`)
    .join(" ");
}

/**
 * Enforce explicit layout properties on flex/grid containers.
 *
 * Webflow doesn't infer browser defaults. If CSS says `display: flex` without
 * `flex-direction`, the browser uses `row` - but Webflow needs it explicit.
 *
 * This ensures all layout containers have complete, explicit property sets.
 */
function enforceExplicitLayoutProperties(
  classes: Record<string, ClassIndexEntry>,
  warnings: CssWarning[]
): void {
  for (const entry of Object.values(classes)) {
    if (!entry.isLayoutContainer || !entry.baseStyles) continue;

    // Parse existing properties
    const props = new Map<string, string>();
    entry.baseStyles.split(";").forEach((prop) => {
      const parts = prop.split(":");
      if (parts.length >= 2) {
        const name = parts[0]?.trim();
        const value = parts.slice(1).join(":").trim();
        if (name && value) props.set(name, value);
      }
    });

    const display = props.get("display")?.toLowerCase();
    const added: string[] = [];

    // Flex container defaults
    if (display === "flex" || display === "inline-flex") {
      if (!props.has("flex-direction")) {
        props.set("flex-direction", "row");
        added.push("flex-direction: row");
      }
      // NOTE: We intentionally do NOT inject flex-wrap: nowrap
      // Browser default is nowrap, so explicit injection is redundant
      // AND it blocks responsive designs where wrapping should occur naturally
      if (!props.has("justify-content")) {
        props.set("justify-content", "flex-start");
        added.push("justify-content: flex-start");
      }
      if (!props.has("align-items")) {
        props.set("align-items", "stretch");
        added.push("align-items: stretch");
      }
    }

    // Grid container defaults
    if (display === "grid" || display === "inline-grid") {
      const hasTemplate =
        props.has("grid-template-columns") ||
        props.has("grid-template-rows") ||
        props.has("grid-auto-columns") ||
        props.has("grid-auto-rows");
      if (!hasTemplate) {
        props.set("grid-template-columns", "1fr");
        added.push("grid-template-columns: 1fr");
      }
      // If grid has columns but no row definition, add explicit row defaults for Webflow UI
      if (
        props.has("grid-template-columns") &&
        !props.has("grid-template-rows") &&
        !props.has("grid-auto-rows")
      ) {
        props.set("grid-template-rows", "auto");
        props.set("grid-auto-rows", "auto");
        props.set("grid-auto-flow", "row");
        added.push("grid-template-rows: auto");
        added.push("grid-auto-rows: auto");
        added.push("grid-auto-flow: row");
      }
      if (!props.has("justify-items")) {
        props.set("justify-items", "stretch");
        added.push("justify-items: stretch");
      }
      if (!props.has("align-items")) {
        props.set("align-items", "stretch");
        added.push("align-items: stretch");
      }
    }

    // Update entry if we added properties
    if (added.length > 0) {
      entry.baseStyles = Array.from(props.entries())
        .map(([name, value]) => `${name}: ${value};`)
        .join(" ");

      warnings.push({
        type: "complex_selector",
        message: `Layout container .${entry.className} missing explicit properties: ${added.join(", ")}. Injected browser defaults.`,
        selector: `.${entry.className}`,
      });
    }
  }
}

// ============================================
// WEBFLOW STYLE CONVERSION
// ============================================

export function classEntryToWebflowStyle(entry: ClassIndexEntry): WebflowStyle {
  const variants: Record<string, { styleLess: string }> = {};

  if (entry.hoverStyles) variants["hover"] = { styleLess: entry.hoverStyles };
  if (entry.focusStyles) variants["focus"] = { styleLess: entry.focusStyles };
  if (entry.activeStyles) variants["pressed"] = { styleLess: entry.activeStyles };
  if (entry.visitedStyles) variants["visited"] = { styleLess: entry.visitedStyles };
  if (entry.mediaQueries.desktop) {
    variants["desktop"] = { styleLess: normalizeGridStyleLess(entry.mediaQueries.desktop, entry.isLayoutContainer) };
  }
  if (entry.mediaQueries.medium) {
    variants["medium"] = { styleLess: normalizeGridStyleLess(entry.mediaQueries.medium, entry.isLayoutContainer) };
  }
  if (entry.mediaQueries.small) {
    variants["small"] = { styleLess: normalizeGridStyleLess(entry.mediaQueries.small, entry.isLayoutContainer) };
  }
  if (entry.mediaQueries.tiny) {
    variants["tiny"] = { styleLess: normalizeGridStyleLess(entry.mediaQueries.tiny, entry.isLayoutContainer) };
  }

  const baseStyles = normalizeGridStyleLess(entry.baseStyles, entry.isLayoutContainer);
  const validatedBaseStyles = validateStyleLess(baseStyles);
  logGridStyle(entry.className, validatedBaseStyles, entry.isLayoutContainer);
  
  // Validate variant styleLess strings as well
  const validatedVariants: Record<string, { styleLess: string }> = {};
  for (const [key, variant] of Object.entries(variants)) {
    validatedVariants[key] = { styleLess: validateStyleLess(variant.styleLess) };
  }
  
  return {
    _id: entry.className,
    fake: false,
    type: "class",
    name: entry.className,
    namespace: "",
    comb: entry.isComboClass ? "&" : "",
    styleLess: validatedBaseStyles,
    variants: validatedVariants,
    children: entry.children,
  };
}

// Grid placement is now handled purely through CSS parsing, not class name matching

function logGridStyle(className: string, styleLess: string, isLayoutContainer: boolean): void {
  if (!isLayoutContainer || !styleLess) return;
  const props = styleLessToMap(styleLess);
  const display = props.get("display")?.toLowerCase();
  if (display !== "grid" && display !== "inline-grid") return;
  console.info("[grid-style]", {
    className,
    gridTemplateColumns: props.get("grid-template-columns") || "",
    gridTemplateRows: props.get("grid-template-rows") || "",
    gridRowGap: props.get("grid-row-gap") || "",
    gridColumnGap: props.get("grid-column-gap") || "",
  });
}

function normalizeGridStyleLess(styleLess: string, isLayoutContainer: boolean): string {
  if (!styleLess) return styleLess;
  const props = styleLessToMap(styleLess);
  const display = props.get("display")?.toLowerCase();

  const opacity = (props.get("opacity") || "").trim();
  if (opacity === "0" || opacity === "0%" || opacity === "0.0") {
    props.set("opacity", "1");
  }
  const visibility = (props.get("visibility") || "").trim().toLowerCase();
  if (visibility === "hidden") {
    props.set("visibility", "visible");
  }

  if (!isLayoutContainer || (display !== "grid" && display !== "inline-grid")) {
    return mapToStyleLess(props);
  }

  const rowGap = props.get("row-gap") || props.get("gap");
  const columnGap = props.get("column-gap") || props.get("gap");
  if (rowGap && !props.has("grid-row-gap")) {
    props.set("grid-row-gap", rowGap);
  }
  if (columnGap && !props.has("grid-column-gap")) {
    props.set("grid-column-gap", columnGap);
  }
  props.delete("gap");
  props.delete("row-gap");
  props.delete("column-gap");

  normalizeGridTemplateProperty(props, "grid-template-columns");
  normalizeGridTemplateProperty(props, "grid-template-rows");

  return mapToStyleLess(props);
}

function normalizeGridTemplateProperty(props: Map<string, string>, key: string): void {
  const template = props.get(key);
  if (!template) return;
  if (/(auto-fit|auto-fill|minmax\()/i.test(template)) {
    const explicit = buildExplicitGridTemplate(template);
    if (explicit) {
      console.warn(`[grid-normalize] Simplified complex ${key}: ${template} -> ${explicit}`);
      props.set(key, explicit);
    }
    return;
  }
  const expanded = expandRepeatTemplate(template);
  if (expanded) {
    props.set(key, expanded);
  }
}

function buildExplicitGridTemplate(template: string): string | null {
  const trimmed = template.trim();

  // Handle repeat(N, X) - expand to explicit columns
  const repeatMatch = trimmed.match(/repeat\(\s*(\d+)\s*,\s*([^)]+)\)/);
  if (repeatMatch) {
    const count = parseInt(repeatMatch[1], 10);
    const value = repeatMatch[2].trim();
    if (count > 0 && count <= 12) {
      return Array(count).fill(value).join(" ");
    }
  }

  // Handle auto-fit/auto-fill with minmax - estimate columns based on container width
  if (trimmed.includes("auto-fit") || trimmed.includes("auto-fill")) {
    const minPx = extractMinmaxPixels(trimmed);
    if (minPx !== null) {
      const targetContainerPx = 1024;
      const rawEstimate = Math.floor(targetContainerPx / minPx);
      const estimatedColumns = Math.max(1, Math.min(6, rawEstimate));
      return Array(estimatedColumns).fill("1fr").join(" ");
    }
  }

  // Pass through explicit values (1fr 1fr 1fr, 200px 1fr, etc.)
  return trimmed;
}

function extractMinmaxPixels(template: string): number | null {
  // Match minmax() with common units (px, rem, em)
  const match = template.match(/minmax\(\s*([\d.]+)\s*(px|rem|em)\s*,/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  if (Number.isNaN(value)) return null;
  const unit = match[2];
  return cssLengthToPixels(value, unit);
}

function expandRepeatTemplate(template: string): string | null {
  const match = template.match(/repeat\(\s*(\d+)\s*,\s*([^)]+)\)/i);
  if (!match) return null;
  const count = Number.parseInt(match[1], 10);
  if (!Number.isFinite(count) || count <= 0) return null;
  const track = match[2].trim();
  if (!track) return null;
  return Array(count).fill(track).join(" ");
}

// NOTE: styleLessToMap / mapToStyleLess are defined earlier in this module and are reused here.

export function classIndexToWebflowStyles(classIndex: ClassIndex, filterClasses?: Set<string>): WebflowStyle[] {
  const styles: WebflowStyle[] = [];

  for (const [className, entry] of Object.entries(classIndex.classes)) {
    if (filterClasses && !filterClasses.has(className)) continue;
    if (!entry.baseStyles && !entry.hoverStyles && !entry.focusStyles && !entry.activeStyles &&
      !entry.visitedStyles && !entry.mediaQueries.medium && !entry.mediaQueries.small && !entry.mediaQueries.tiny) {
      continue;
    }
    styles.push(classEntryToWebflowStyle(entry));
  }

  return styles;
}

export function getClassNames(classIndex: ClassIndex): string[] {
  return Object.keys(classIndex.classes);
}

export function hasStyles(entry: ClassIndexEntry): boolean {
  return !!(entry.baseStyles || entry.hoverStyles || entry.focusStyles || entry.activeStyles ||
    entry.visitedStyles || entry.mediaQueries.desktop || entry.mediaQueries.medium ||
    entry.mediaQueries.small || entry.mediaQueries.tiny);
}

export function getStyledClasses(classIndex: ClassIndex): string[] {
  return Object.entries(classIndex.classes).filter(([, entry]) => hasStyles(entry)).map(([className]) => className);
}

/**
 * Webflow JSON Converter
 * Converts HTML + CSS into Webflow's @webflow/XscpData clipboard format
 */

import type { DetectedSection } from "./html-parser";
import type { TokenManifest, TokenExtraction } from "./token-extractor";
import { generateTokenManifest } from "./token-extractor";
import type { ClassIndex, ClassIndexEntry } from "./css-parser";
import {
  parseCSS,
  classIndexToWebflowStyles,
  classEntryToWebflowStyle,
} from "./css-parser";
import type { Component } from "./componentizer";
import { normalizeHtmlCssForWebflow } from "./webflow-normalizer";
import type { AssetManifest, GoogleFontInfo } from "./asset-validator";
import { extractAndValidateAssets, detectGoogleFonts } from "./asset-validator";
import {
  runPreflightValidation,
  validateCanvasWebGLRequirements,
  validateJsHtmlReferences,
  detectExternalResources,
  type PreflightResult,
  type XRefValidation,
  type ExternalResourceResult,
} from "./preflight-validator";
import { routeCSS, wrapEmbedCSSInStyleTag } from "./css-embed-router";
import { generateWebflowScriptEmbed } from "./js-library-detector";

// ============================================
// TYPES
// ============================================

export interface WebflowNode {
  _id: string;
  type?: "Block" | "Link" | "Image" | "Video" | "HtmlEmbed" | "Heading" | "Paragraph" | "Section" | "List" | "ListItem";
  tag?: string;
  classes?: string[];
  children?: string[];
  text?: boolean;
  v?: string;
  data?: {
    tag?: string;
    text?: boolean;
    xattr?: Array<{ name: string; value: string }>;
    link?: { mode: string; url: string; target?: string };
    attr?: { src?: string; alt?: string; loading?: string };
    embed?: {
      type: string;
      meta: {
        html: string;
        div: boolean;
        iframe: boolean;
        script: boolean;
        compilable: boolean;
      };
    };
    insideRTE?: boolean;
  };
}

/**
 * CSS property shorthand to longhand mapping for Webflow compatibility.
 * Webflow requires longhand properties for certain CSS properties.
 */
const SHORTHAND_TO_LONGHAND: Record<string, string> = {
  "row-gap": "grid-row-gap",
  "column-gap": "grid-column-gap",
  "gap": "grid-gap",  // Note: grid-gap is deprecated but Webflow still uses it
};

/**
 * Sanitize styleLess for Webflow compatibility.
 * Removes unsupported constructs and normalizes property names.
 */
function sanitizeStyleLess(styleLess: string): { sanitized: string; warnings: string[] } {
  if (!styleLess) return { sanitized: styleLess, warnings: [] };

  const warnings: string[] = [];
  const parts = styleLess.split(";").map((s) => s.trim()).filter(Boolean);
  const map = new Map<string, string>();

  for (const part of parts) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    let key = part.slice(0, idx).trim();
    let val = part.slice(idx + 1).trim();

    // 1. Skip CSS custom properties (--var-name)
    if (key.startsWith("--")) {
      continue;
    }

    // 2. Remove !important flags
    if (val.includes("!important")) {
      val = val.replace(/!important/gi, "").trim();
      warnings.push(`Removed !important from ${key}`);
    }

    // 3. Remove unresolved CSS variables
    if (val.includes("var(--")) {
      warnings.push(`Skipped property "${key}" with unresolved CSS variable`);
      continue;
    }

    // 4. Convert shorthand to longhand properties
    if (SHORTHAND_TO_LONGHAND[key]) {
      key = SHORTHAND_TO_LONGHAND[key];
    }

    // 5. Remove vendor prefixes that Webflow doesn't support
    // Keep -webkit-background-clip for text gradients, but remove most others
    if (key.startsWith("-moz-") || key.startsWith("-ms-") || key.startsWith("-o-")) {
      continue;
    }

    // 6. Handle visibility/opacity defaults
    if (key === "opacity" && (val === "0" || val === "0%" || val === "0.0")) {
      val = "1";
    }
    if (key === "visibility" && val.toLowerCase() === "hidden") {
      val = "visible";
    }

    map.set(key, val);
  }

  return {
    sanitized: Array.from(map.entries()).map(([k, v]) => `${k}: ${v};`).join(" "),
    warnings,
  };
}

/**
 * Simple version for backwards compatibility - just returns sanitized string
 */
function sanitizeStyleLessVisibility(styleLess: string): string {
  return sanitizeStyleLess(styleLess).sanitized;
}

export interface WebflowStyleVariant {
  styleLess: string;
}

export interface WebflowStyle {
  _id: string;
  fake: boolean;
  type: "class";
  name: string;
  namespace: string;
  comb: string;
  styleLess: string;
  variants: Record<string, WebflowStyleVariant>;
  children: string[];
}

export interface WebflowPayload {
  type: "@webflow/XscpData";
  payload: {
    nodes: WebflowNode[];
    styles: WebflowStyle[];
    assets: unknown[];
    ix1: unknown[];
    ix2: {
      interactions: unknown[];
      events: unknown[];
      actionLists: unknown[];
    };
  };
  /** Complete <style> block for CSS that cannot be represented natively */
  embedCSS?: string;
  /** Complete <script> block(s) with CDN libraries and user code */
  embedJS?: string;
  meta: {
    unlinkedSymbolCount: number;
    droppedLinks: number;
    dynBindRemovedCount: number;
    dynListBindRemovedCount: number;
    paginationRemovedCount: number;
    tokenManifest?: TokenManifest;
    /** Asset validation results - present when assets were validated */
    assetValidation?: {
      /** All asset errors (blocking issues) */
      errors: string[];
      /** All asset warnings (non-blocking issues) */
      warnings: string[];
      /** Summary statistics */
      stats: AssetManifest['stats'];
      /** Google Fonts info if detected */
      googleFonts?: GoogleFontInfo;
    };
    /** Pre-flight validation results - present when payload was validated */
    preflightValidation?: {
      /** Whether payload passed all critical validations */
      isValid: boolean;
      /** Whether payload can be safely pasted (may have warnings) */
      canProceed: boolean;
      /** Human-readable summary of validation results */
      summary: string;
      /** Detailed validation results */
      details?: PreflightResult;
    };
    /** JS-HTML cross-reference validation - present when JS was provided */
    xrefValidation?: XRefValidation;
    /** External resource detection - present when HTML was parsed */
    externalResources?: ExternalResourceResult;
    /** Quick check flags for embed requirements */
    hasEmbedCSS: boolean;
    hasEmbedJS: boolean;
    /** Size of embed blocks in bytes */
    embedCSSSize: number;
    embedJSSize: number;
  };
}

// ============================================
// ID GENERATOR
// ============================================

class IdGenerator {
  private counters: Map<string, number> = new Map();
  private prefix: string;

  constructor(prefix: string = "wf") {
    this.prefix = prefix;
  }

  generate(baseName: string): string {
    const key = baseName || "node";
    const count = (this.counters.get(key) || 0) + 1;
    this.counters.set(key, count);
    return `${this.prefix}-${key}-${String(count).padStart(3, "0")}`;
  }

  reset(): void {
    this.counters.clear();
  }
}

function splitValues(str: string): string[] {
  const out: string[] = [];
  let cur = "";
  let depth = 0;
  for (const ch of str) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === " " && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function toRem(value: string): string {
  const parts = splitValues(value);
  const conv = parts.map((p) => {
    const m = p.match(/^(-?\d*\.?\d+)(px|rem|em|vw|vh|%)$/i);
    if (!m) return p;
    const num = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === "px") return `${(num / 16).toFixed(4).replace(/\.?0+$/,"")}rem`;
    if (unit === "rem") return `${num.toFixed(4).replace(/\.?0+$/,"")}rem`;
    return p;
  });
  return conv.join(" ");
}

/**
 * Convert px values to rem in a single CSS value string.
 * Keeps 1px values as px (common for thin borders).
 * Preserves values already in rem, em, %, vw, vh, etc.
 *
 * @param value - CSS value string (e.g., "100px", "16px 24px")
 * @param basePx - Base pixel value for conversion (default: 16)
 * @returns Converted value string
 */
function convertValuePxToRem(value: string, basePx = 16): string {
  const parts = splitValues(value);
  const converted = parts.map((part) => {
    // Match numeric value with unit
    const match = part.match(/^(-?\d*\.?\d+)(px|rem|em|%|vw|vh|vmin|vmax|ch|ex|pt|pc|in|cm|mm)$/i);
    if (!match) return part;

    const num = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    // Only convert px, skip other units
    if (unit !== "px") return part;

    // Keep 1px as-is (common for thin borders)
    if (Math.abs(num) === 1) return part;

    // Convert px to rem
    const rem = num / basePx;
    // Format: remove trailing zeros, max 4 decimal places
    const formatted = rem.toFixed(4).replace(/\.?0+$/, "");
    return `${formatted}rem`;
  });

  return converted.join(" ");
}

/**
 * Convert px values to rem in an inline style string.
 * Parses style="width: 100px; padding: 16px 24px;" and converts px to rem.
 *
 * Exceptions:
 * - 1px values are kept as px (common for thin borders)
 * - Values already in rem, em, %, vw, vh, etc. are preserved
 *
 * @param styleString - Inline style string (e.g., "width: 100px; padding: 16px")
 * @param basePx - Base pixel value for conversion (default: 16)
 * @returns Converted style string
 */
export function convertInlineStylePxToRem(styleString: string, basePx = 16): string {
  if (!styleString) return styleString;

  const parts = styleString.split(";").map((p) => p.trim()).filter(Boolean);
  const converted: string[] = [];

  for (const part of parts) {
    const colonIdx = part.indexOf(":");
    if (colonIdx === -1) continue;

    const property = part.slice(0, colonIdx).trim().toLowerCase();
    const value = part.slice(colonIdx + 1).trim();

    if (!property || !value) continue;

    // Convert the value
    const convertedValue = convertValuePxToRem(value, basePx);
    converted.push(`${property}: ${convertedValue}`);
  }

  return converted.join("; ");
}

function scaleRem(value: string, factor: number): string {
  const parts = splitValues(value);
  const scaled = parts.map((p) => {
    const m = p.match(/^(-?\d*\.?\d+)(rem)$/i);
    if (!m) return p;
    const num = parseFloat(m[1]) * factor;
    return `${num.toFixed(4).replace(/\.?0+$/,"")}rem`;
  });
  return scaled.join(" ");
}

function appendVariant(style: WebflowStyle, variant: string, extra: string): void {
  const existing = style.variants[variant]?.styleLess || "";
  const next = existing ? `${existing} ${extra}` : extra;
  style.variants[variant] = { styleLess: next };
}

function parseStyleLessMap(styleLess: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!styleLess) return map;
  const props = styleLess.split(";").map((s) => s.trim()).filter(Boolean);
  for (const prop of props) {
    const i = prop.indexOf(":");
    if (i === -1) continue;
    const k = prop.slice(0, i).trim().toLowerCase();
    const v = prop.slice(i + 1).trim();
    map.set(k, v);
  }
  return map;
}

function mapToStyleLess(map: Map<string, string>): string {
  return Array.from(map.entries())
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ");
}

function applyResponsiveGridFixes(styles: Map<string, WebflowStyle>): void {
  for (const style of styles.values()) {
    const base = parseStyleLessMap(style.styleLess);
    const display = (base.get("display") || "").toLowerCase();
    
    // Only target grid containers
    if (!display.includes("grid")) continue;

    // Fix 1: Ensure minimum one row exists (fixes "zero rows" issue)
    // If no row templates are defined, Webflow often imports as 0 rows, locking the UI.
    // We add 'auto' to ensure at least one implicit row exists.
    if (!base.has("grid-template-rows") && !base.has("grid-auto-rows")) {
      const currentStyle = (style.styleLess || "").trim();
      const suffix = currentStyle.endsWith(";") ? "" : ";";
      style.styleLess = `${currentStyle}${suffix} grid-template-rows: auto;`;
    }

    // Fix 2: Responsive grid column adjustment for better mobile experience
    // Reduce columns on smaller breakpoints for grids with repeat(n, 1fr) patterns
    const gridTemplateColumns = base.get("grid-template-columns");
    if (gridTemplateColumns) {
      // Also handle expanded repeat patterns like "1fr 1fr 1fr 1fr"
      const expandedPattern = gridTemplateColumns.match(/^(1fr\s+)+1fr$/);
      let columnCount = 0;
      let repeatMatch = null;

      // Match repeat(n, 1fr) or repeat(n, minmax(...))
      repeatMatch = gridTemplateColumns.match(/repeat\((\d+),\s*(1fr|minmax\([^)]+\))\)/);
      if (repeatMatch) {
        columnCount = parseInt(repeatMatch[1], 10);
      }
      // If no repeat() but has expanded pattern, count the columns
      else if (expandedPattern) {
        columnCount = gridTemplateColumns.split(/\s+/).length;
      }

      if (columnCount >= 2) {
        // For 4+ columns: reduce to 3 on small, 1 on tiny
        if (columnCount >= 4) {
          // Small breakpoint (tablet): reduce to 3 columns
          if (!style.variants.small) {
            style.variants.small = { styleLess: "" };
          }
          const smallMap = parseStyleLessMap(style.variants.small.styleLess);
          if (!smallMap.has("grid-template-columns")) {
            smallMap.set("grid-template-columns", "repeat(3, minmax(0, 1fr))");
            style.variants.small.styleLess = mapToStyleLess(smallMap);
          }

          // Tiny breakpoint (mobile): reduce to 1 column
          if (!style.variants.tiny) {
            style.variants.tiny = { styleLess: "" };
          }
          const tinyMap = parseStyleLessMap(style.variants.tiny.styleLess);
          if (!tinyMap.has("grid-template-columns")) {
            tinyMap.set("grid-template-columns", "1fr");
            style.variants.tiny.styleLess = mapToStyleLess(tinyMap);
          }
        }
        // For 2-3 columns: reduce to 1 on tiny only
        else if (columnCount >= 2) {
          if (!style.variants.tiny) {
            style.variants.tiny = { styleLess: "" };
          }
          const tinyMap = parseStyleLessMap(style.variants.tiny.styleLess);
          if (!tinyMap.has("grid-template-columns")) {
            tinyMap.set("grid-template-columns", "1fr");
            style.variants.tiny.styleLess = mapToStyleLess(tinyMap);
          }
        }
      }
    }
  }
}

// ============================================
// HTML PARSER
// ============================================

interface ParsedElement {
  tag: string;
  id?: string;
  classes: string[];
  attributes: Record<string, string>;
  children: (ParsedElement | string)[];
}

/**
 * Parse HTML using DOMParser when available
 */
function parseHtmlWithDomParser(html: string): ParsedElement | null {
  if (typeof DOMParser === "undefined") return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return null;

  return elementToParsedElement(root);
}

function elementToParsedElement(element: Element): ParsedElement {
  const tag = element.tagName.toLowerCase();
  const id = element.getAttribute("id") || undefined;
  const classes = Array.from(element.classList);
  const attributes: Record<string, string> = {};

  for (const attr of Array.from(element.attributes)) {
    attributes[attr.name] = attr.value;
  }

  const children: (ParsedElement | string)[] = [];
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      children.push(elementToParsedElement(node as Element));
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\s+/g, " ").trim();
      if (text) children.push(text);
    }
  }

  return { tag, id, classes, attributes, children };
}

/**
 * Parse HTML string into element tree
 * Uses regex-based parsing (no DOM required)
 */
function parseHtmlString(html: string): ParsedElement | null {
  const trimmed = html.trim();
  if (!trimmed) return null;

  const parsedDom = parseHtmlWithDomParser(trimmed);
  if (parsedDom) return parsedDom;

  // Match opening tag
  const tagMatch = trimmed.match(/^<(\w+)([^>]*)>/);
  if (!tagMatch) return null;

  const tag = tagMatch[1].toLowerCase();
  const attrString = tagMatch[2];

  // Parse attributes
  const attributes: Record<string, string> = {};
  const attrRegex = /([^\s=]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let attrMatch;
  while ((attrMatch = attrRegex.exec(attrString)) !== null) {
    const name = attrMatch[1];
    const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
    attributes[name] = value;
  }

  // Extract classes
  const classes = attributes.class?.split(/\s+/).filter(Boolean) || [];
  const id = attributes.id;

  // Find content between opening and closing tags
  const closingTag = `</${tag}>`;
  const openingTagEnd = tagMatch[0].length;

  // Handle self-closing tags
  if (
    ["img", "br", "hr", "input", "meta", "link", "area", "base", "col", "embed", "param", "source", "track", "wbr"].includes(
      tag
    ) ||
    attrString.endsWith("/")
  ) {
    return { tag, id, classes, attributes, children: [] };
  }

  const closingIndex = trimmed.lastIndexOf(closingTag);
  if (closingIndex === -1) return null;

  const innerContent = trimmed.substring(openingTagEnd, closingIndex);

  // Parse children
  const children = parseChildren(innerContent);

  return { tag, id, classes, attributes, children };
}

/**
 * Parse inner content into children array
 */
function parseChildren(content: string): (ParsedElement | string)[] {
  const children: (ParsedElement | string)[] = [];
  let remaining = content.trim();
  let textBuffer = "";

  while (remaining.length > 0) {
    // Check for HTML tag
    const tagStart = remaining.indexOf("<");

    if (tagStart === -1) {
      // Rest is text
      textBuffer += remaining;
      break;
    }

    if (tagStart > 0) {
      // Text before tag
      textBuffer += remaining.substring(0, tagStart);
      remaining = remaining.substring(tagStart);
    }

    // Check for comment
    if (remaining.startsWith("<!--")) {
      const commentEnd = remaining.indexOf("-->");
      if (commentEnd !== -1) {
        remaining = remaining.substring(commentEnd + 3).trim();
        continue;
      }
    }

    // Match opening tag
    const openTagMatch = remaining.match(/^<(\w+)([^>]*)>/);
    if (!openTagMatch) {
      // Not a valid tag, treat as text
      textBuffer += remaining[0];
      remaining = remaining.substring(1);
      continue;
    }

    // Flush text buffer
    if (textBuffer.trim()) {
      children.push(textBuffer.trim());
      textBuffer = "";
    }

    const tagName = openTagMatch[1].toLowerCase();
    const fullOpenTag = openTagMatch[0];
    const attrString = openTagMatch[2];

    // Self-closing tags
    if (
      ["img", "br", "hr", "input", "meta", "link", "area", "base", "col", "embed", "param", "source", "track", "wbr"].includes(
        tagName
      ) ||
      attrString.endsWith("/")
    ) {
      const selfClosingHtml = fullOpenTag;
      const parsed = parseHtmlString(selfClosingHtml.replace(/\/$/, "") + `></${tagName}>`);
      if (parsed) children.push(parsed);
      remaining = remaining.substring(fullOpenTag.length).trim();
      continue;
    }

    // Find matching closing tag (handling nesting)
    const closingTag = `</${tagName}>`;
    let depth = 1;
    let searchPos = fullOpenTag.length;
    let foundClose = -1;

    while (depth > 0 && searchPos < remaining.length) {
      const nextOpen = remaining.indexOf(`<${tagName}`, searchPos);
      const nextClose = remaining.indexOf(closingTag, searchPos);

      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        // Found another opening tag first
        depth++;
        searchPos = nextOpen + tagName.length + 1;
      } else {
        // Found closing tag
        depth--;
        if (depth === 0) {
          foundClose = nextClose;
        } else {
          searchPos = nextClose + closingTag.length;
        }
      }
    }

    if (foundClose === -1) {
      // Malformed HTML, skip this tag
      remaining = remaining.substring(fullOpenTag.length).trim();
      continue;
    }

    const elementHtml = remaining.substring(0, foundClose + closingTag.length);
    const parsed = parseHtmlString(elementHtml);
    if (parsed) children.push(parsed);

    remaining = remaining.substring(foundClose + closingTag.length).trim();
  }

  // Flush remaining text
  if (textBuffer.trim()) {
    children.push(textBuffer.trim());
  }

  return children;
}

// ============================================
// NODE CONVERTER
// ============================================

/**
 * Convert parsed HTML tree to Webflow nodes
 */
function convertToWebflowNodes(
  element: ParsedElement,
  idGen: IdGenerator,
  collectedClasses: Set<string>,
  classIndex: ClassIndex,
  inlineStyles?: Map<string, string>,
  spanClasses?: Set<string>
): { nodes: WebflowNode[]; rootId: string; spanClasses: Set<string> } {
  const nodes: WebflowNode[] = [];
  // Track classes used on span elements to ensure they have display: inline
  const localSpanClasses = spanClasses || new Set<string>();
  const dropTags = new Set([
    "head",
    "meta",
    "link",
    "title",
    "script",
    "style",
    "noscript",
    "base",
    "iframe",
    "canvas",
    "input",
  ]);

  const normalizeTagForWebflow = (tag: string): string => {
    if (tag === "html" || tag === "body" || tag === "main") return "div";
    if (tag === "form" || tag === "label" || tag === "button") return "div";
    return tag;
  };

  // Map HTML tags to Webflow node types
  // IMPORTANT: Based on Webflow's actual expected types (not intuitive mappings)
  // - Container elements (section, div, nav, etc.) should be "Block", NOT "Section"
  // - Span elements should use "Block" with tag="span" for inline behavior
  // - Only use types that exist in Webflow's schema: Block, Link, Image, Video, HtmlEmbed, Heading, Paragraph, Section, List, ListItem
  const mapTagToType = (tag: string): WebflowNode["type"] => {
    switch (tag) {
      // Headings
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        return "Heading";
      // Text
      case "p":
        return "Paragraph";
      // Links & Media
      case "a":
        return "Link";
      case "img":
        return "Image";
      case "video":
        return "Video";
      // Lists
      case "ul":
      case "ol":
        return "List";
      case "li":
        return "ListItem";
      // All other elements use "Block" with their original tag preserved
      // This includes: section, div, nav, header, footer, main, article, aside, span,
      // blockquote, figure, figcaption, etc.
      default:
        return "Block";
    }
  };

  /**
   * Serialize a ParsedElement (especially SVG) back to HTML string
   */
  function serializeElementToHtml(el: ParsedElement): string {
    const attrs = Object.entries(el.attributes)
      .map(([name, value]) => {
        if (name === "class" && el.classes.length > 0) {
          return `class="${el.classes.join(" ")}"`;
        }
        if (name === "id" && el.id) {
          return `id="${el.id}"`;
        }
        if (value) {
          return `${name}="${value.replace(/"/g, "&quot;")}"`;
        }
        return name;
      })
      .join(" ");

    const openTag = attrs ? `<${el.tag} ${attrs}>` : `<${el.tag}>`;
    
    if (el.children.length === 0) {
      // Self-closing for SVG elements that can be self-closing
      if (["line", "polyline", "path", "circle", "rect", "ellipse", "polygon"].includes(el.tag)) {
        return attrs ? `<${el.tag} ${attrs} />` : `<${el.tag} />`;
      }
      return openTag;
    }

    const childrenHtml = el.children
      .map((child) => {
        if (typeof child === "string") {
          return child;
        }
        return serializeElementToHtml(child);
      })
      .join("");

    return `${openTag}${childrenHtml}</${el.tag}>`;
  }

  function normalizeSvgSize(value: string | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/\d(px|em|rem|%|vh|vw)$/i.test(trimmed)) return trimmed;
    if (/^\d+(\.\d+)?$/.test(trimmed)) return `${trimmed}px`;
    return trimmed;
  }

  function getSvgSizeFromClassIndex(classes: string[]): { width?: string; height?: string } {
    for (const className of classes) {
      const entry = classIndex.classes[className];
      if (!entry?.baseStyles) continue;
      const props = parseStyleLessMap(entry.baseStyles);
      const width = normalizeSvgSize(props.get("width"));
      const height = normalizeSvgSize(props.get("height"));
      if (width || height) {
        return { width: width || undefined, height: height || undefined };
      }
    }
    return {};
  }

  function parseViewBoxDimensions(viewBox: string | undefined): { width: number; height: number } | null {
    if (!viewBox) return null;
    const parts = viewBox.trim().split(/\s+/).map((part) => Number.parseFloat(part));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
    const width = parts[2];
    const height = parts[3];
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    return { width, height };
  }

  function normalizeInlineStyle(style: string | undefined): string | null {
    if (!style) return null;
    const parts = style.split(";").map((p) => p.trim()).filter(Boolean);
    const entries: Array<[string, string]> = [];
    for (const part of parts) {
      const idx = part.indexOf(":");
      if (idx === -1) continue;
      const rawName = part.slice(0, idx).trim();
      const rawValue = part.slice(idx + 1).trim();
      if (!rawName || !rawValue) continue;
      const name = rawName.startsWith("--") ? rawName : rawName.toLowerCase();
      // Convert px values to rem (except 1px which is kept for thin borders)
      const convertedValue = convertValuePxToRem(rawValue, 16);
      entries.push([name, convertedValue]);
    }
    if (entries.length === 0) return null;
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    return entries.map(([name, value]) => `${name}: ${value};`).join(" ");
  }

  function applyInlineStyleClass(el: ParsedElement, baseClasses: string[]): void {
    if (!inlineStyles) return;
    const styleLess = normalizeInlineStyle(el.attributes.style);
    if (!styleLess) return;

    let className: string | undefined;
    for (const [existingClass, existingStyle] of inlineStyles.entries()) {
      if (existingStyle === styleLess) {
        className = existingClass;
        break;
      }
    }

    if (!className) {
      className = `inline-${inlineStyles.size + 1}`;
      inlineStyles.set(className, styleLess);
    }

    if (!baseClasses.includes(className)) {
      baseClasses.push(className);
    }

    delete el.attributes.style;
  }

  function processElement(el: ParsedElement): string {
    if (dropTags.has(el.tag)) return "";

    // If this is an SVG element, convert to HtmlEmbed to preserve inline SVG behavior
    if (el.tag === "svg" || el.tag === "SVG") {
      const baseName = el.classes[0] || el.id || "svg";
      const embedId = idGen.generate(`${baseName}-embed`);
      const wrapperId = idGen.generate(baseName);

      // Ensure SVG class styles are exported (e.g., .icon width/height)
      el.classes.forEach((c) => collectedClasses.add(c));

      const classSize = getSvgSizeFromClassIndex(el.classes);
      let width = normalizeSvgSize(el.attributes.width) || classSize.width;
      let height = normalizeSvgSize(el.attributes.height) || classSize.height;
      if (!width && !height) {
        const viewBoxDims = parseViewBoxDimensions(el.attributes.viewBox);
        if (viewBoxDims) {
          width = `${viewBoxDims.width}px`;
          height = `${viewBoxDims.height}px`;
        }
      }

      let svgHtml = serializeElementToHtml(el);
      svgHtml = svgHtml.replace(/<svg\b([^>]*)>/i, (match, attrs) => {
        let nextAttrs = attrs;
        if (width && !/width=/.test(attrs)) nextAttrs += ` width="${width}"`;
        if (height && !/height=/.test(attrs)) nextAttrs += ` height="${height}"`;
        return `<svg${nextAttrs}>`;
      });

      nodes.push({
        _id: embedId,
        type: "HtmlEmbed",
        tag: "div",
        children: [],
        v: svgHtml,
        data: {
          tag: "div",
          text: false,
          xattr: [],
          embed: {
            type: "html",
            meta: {
              html: svgHtml,
              div: false,
              iframe: false,
              script: false,
              compilable: false,
            },
          },
          insideRTE: false,
        },
      });

      if (el.classes.length === 0 && !el.id) {
        return embedId;
      }

      nodes.push({
        _id: wrapperId,
        type: "Block",
        tag: "div",
        classes: el.classes,
        children: [embedId],
        data: { tag: "div", text: false, xattr: el.id ? [{ name: "id", value: el.id }] : [] },
      });
      return wrapperId;
    }

    const normalizedTag = normalizeTagForWebflow(el.tag);
    const baseClasses = [...el.classes];

    // Add Webflow class for typography elements if they don't have classes
    // This handles cases where CSS has descendant selectors like ".hero h1"
    // which creates styles for "heading-h1" class
    if (baseClasses.length === 0) {
      const elementMap: Record<string, string> = {
        h1: "heading-h1",
        h2: "heading-h2",
        h3: "heading-h3",
        h4: "heading-h4",
        h5: "heading-h5",
        h6: "heading-h6",
        p: "text-body",
        a: "link",
      };
      const webflowClass = elementMap[el.tag];
      if (webflowClass && classIndex.classes[webflowClass]) {
        baseClasses.push(webflowClass);
      }
    }

    applyInlineStyleClass(el, baseClasses);
    const hasGrid = baseClasses.some((cls) => isGridClass(cls, classIndex));
    const nodeClasses = hasGrid && !baseClasses.includes("w-layout-grid")
      ? [...baseClasses, "w-layout-grid"]
      : baseClasses;

    // Collect classes for style extraction (skip w-layout-grid)
    baseClasses.forEach((c) => collectedClasses.add(c));

    // Track classes used on span elements (they need display: inline)
    if (el.tag === "span") {
      baseClasses.forEach((c) => localSpanClasses.add(c));
    }

    // Determine node type
    const nodeType = mapTagToType(normalizedTag);

    // Generate ID based on first class or tag
    const baseName = el.classes[0] || el.id || normalizedTag;
    const nodeId = idGen.generate(baseName);

    // Build xattr from non-standard attributes
    const xattr: Array<{ name: string; value: string }> = [];
    const skipAttrs = ["class", "id", "href", "src", "alt", "target"];
    for (const [name, value] of Object.entries(el.attributes)) {
      const lowerName = name.toLowerCase();
      if (skipAttrs.includes(lowerName)) continue;
      if (!value) continue;
      if (lowerName.startsWith("on")) continue;
      if (lowerName.startsWith("aria-")) continue;
      if (lowerName === "role") continue;
      if (lowerName === "tabindex") continue;
      if (!lowerName.startsWith("data-")) continue;
      xattr.push({ name, value });
    }
    // Add id as xattr if present
    if (el.id) {
      xattr.push({ name: "id", value: el.id });
    }

    // Process children
    const childIds: string[] = [];
    for (const child of el.children) {
      if (typeof child === "string") {
        // Text node
        const textId = idGen.generate("text");
        nodes.push({
          _id: textId,
          text: true,
          v: child,
        });
        childIds.push(textId);
      } else {
        // Element node
        const childId = processElement(child);
        if (childId) childIds.push(childId);
      }
    }

    let data: WebflowNode["data"] | undefined;

    if (nodeType === "Link") {
      data = {
        link: {
          mode: "external",
          url: el.attributes.href || "#",
          target: el.attributes.target,
        },
      };
    } else if (nodeType === "Image") {
      data = {
        attr: {
          src: el.attributes.src || "",
          alt: el.attributes.alt || "",
          loading: el.attributes.loading,
        },
      };
    } else {
      data = {
        tag: normalizedTag,
        text: false,
        xattr,
      };
    }

    // Build node
    const node: WebflowNode = {
      _id: nodeId,
      type: nodeType,
      tag: normalizedTag,
      classes: nodeClasses,
      children: childIds,
      data,
    };

    nodes.push(node);
    return nodeId;
  }

  const rootId = processElement(element);

  // Reverse to get correct order (root first, then children)
  return { nodes: nodes.reverse(), rootId, spanClasses: localSpanClasses };
}

// ============================================
// CSS PARSER
// ============================================

function isGridClass(className: string, classIndex: ClassIndex): boolean {
  const entry = classIndex.classes[className];
  if (!entry || !entry.baseStyles) return false;
  const props = styleLessToMap(entry.baseStyles);
  const display = props.get("display")?.toLowerCase();
  if (display === "grid" || display === "inline-grid") return true;
  return props.has("grid-template-columns") || props.has("grid-template-rows");
}

function styleLessToMap(styleLess: string): Map<string, string> {
  const props = new Map<string, string>();
  styleLess.split(";").forEach((prop) => {
    const parts = prop.split(":");
    if (parts.length >= 2) {
      const name = parts[0]?.trim();
      const value = parts.slice(1).join(":").trim();
      if (name && value) props.set(name, value);
    }
  });
  return props;
}



/**
 * Convert ClassIndex to Webflow styles (using unified parser)
 */
function convertToWebflowStyles(
  classIndex: ClassIndex,
  usedClasses: Set<string>
): WebflowStyle[] {
  const styles = classIndexToWebflowStyles(classIndex, usedClasses);
  const styleMap = new Map<string, WebflowStyle>();
  
  // Convert array to map for easier manipulation
  for (const style of styles) {
    styleMap.set(style.name, style);
  }

  applyResponsiveGridFixes(styleMap);
  return Array.from(styleMap.values());
}

/**
 * Valid tag-to-type mappings for Webflow nodes.
 * Based on actual Webflow behavior:
 * - Container elements (section, div, nav, etc.) should be "Block"
 * - Only use types that exist in Webflow's schema
 */
const VALID_TAG_TYPE_MAPPINGS: Record<string, WebflowNode["type"][]> = {
  // Headings
  h1: ["Heading", "Block"],
  h2: ["Heading", "Block"],
  h3: ["Heading", "Block"],
  h4: ["Heading", "Block"],
  h5: ["Heading", "Block"],
  h6: ["Heading", "Block"],
  // Text
  p: ["Paragraph", "Block"],
  // Links
  a: ["Link", "Block"],
  // Media
  img: ["Image"],
  video: ["Video"],
  // Lists
  ul: ["List", "Block"],
  ol: ["List", "Block"],
  li: ["ListItem", "Block"],
  // Generic containers - must be Block, NOT Section
  div: ["Block"],
  section: ["Block"],  // CRITICAL: section tag uses Block type, not Section
  nav: ["Block"],
  header: ["Block"],
  footer: ["Block"],
  main: ["Block"],
  article: ["Block"],
  aside: ["Block"],
  span: ["Block"],
  figure: ["Block"],
  figcaption: ["Block"],
  blockquote: ["Block"],
  form: ["Block"],
  label: ["Block"],
  button: ["Block"],
};

/**
 * Validate payload integrity - ensure all classes referenced in nodes exist in styles
 * and check for critical Webflow errors.
 */
function validatePayloadIntegrity(
  nodes: WebflowNode[],
  styles: WebflowStyle[]
): string[] {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Build lookup maps
  const styleNames = new Set(styles.map(s => s.name));
  const styleIds = new Set<string>();
  const nodeIds = new Set<string>();
  const childIds = new Set<string>();

  // 1. Check for duplicate style IDs
  for (const style of styles) {
    if (styleIds.has(style._id)) {
      errors.push(`Duplicate style ID: ${style._id}`);
    }
    styleIds.add(style._id);

    // 2. Validate styleLess - no CSS variables or !important
    if (style.styleLess) {
      if (style.styleLess.includes("var(--")) {
        errors.push(`Style "${style.name}" contains unresolved CSS variable`);
      }
      if (style.styleLess.includes("!important")) {
        errors.push(`Style "${style.name}" contains !important (not supported)`);
      }
      // Check for shorthand properties that should be longhand
      if (/(?:^|[\s;])row-gap:/.test(style.styleLess) && !style.styleLess.includes("grid-row-gap")) {
        warnings.push(`Style "${style.name}" uses "row-gap" - should be "grid-row-gap"`);
      }
      if (/(?:^|[\s;])column-gap:/.test(style.styleLess) && !style.styleLess.includes("grid-column-gap")) {
        warnings.push(`Style "${style.name}" uses "column-gap" - should be "grid-column-gap"`);
      }
    }

    // Also check variants
    for (const [variant, entry] of Object.entries(style.variants)) {
      if (entry.styleLess?.includes("var(--")) {
        errors.push(`Style "${style.name}" variant "${variant}" contains unresolved CSS variable`);
      }
    }
  }

  // 3. Collect all node IDs and child references
  for (const node of nodes) {
    if (nodeIds.has(node._id)) {
      errors.push(`Duplicate node ID: ${node._id}`);
    }
    nodeIds.add(node._id);

    // Track all child references
    for (const childId of node.children || []) {
      childIds.add(childId);
    }
  }

  // 4. Check for orphan child references (child ID not in nodes)
  for (const childId of childIds) {
    if (!nodeIds.has(childId)) {
      errors.push(`Orphan child reference: ${childId} not found in nodes`);
    }
  }

  // 5. Check for undefined class references
  for (const node of nodes) {
    for (const cls of node.classes || []) {
      if (!styleNames.has(cls) && cls !== "w-layout-grid") {
        warnings.push(`Node references undefined class: ${cls}`);
      }
    }
  }

  // 6. Check for circular references using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const nodeMap = new Map<string, WebflowNode>();

  for (const node of nodes) {
    nodeMap.set(node._id, node);
  }

  function hasCycle(nodeId: string): boolean {
    if (recursionStack.has(nodeId)) {
      return true; // Found a cycle
    }
    if (visited.has(nodeId)) {
      return false; // Already processed, no cycle from this path
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (node?.children) {
      for (const childId of node.children) {
        if (hasCycle(childId)) {
          return true;
        }
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node._id)) {
      if (hasCycle(node._id)) {
        errors.push(`Circular reference detected involving node: ${node._id}`);
      }
    }
  }

  // 7. Validate text node structure
  // Text nodes MUST have: { _id, text: true, v: "content" }
  // Text nodes MUST NOT have: children, type, tag, classes
  for (const node of nodes) {
    if (node.text === true) {
      // This is a text node - validate structure
      if (typeof node.v !== "string") {
        errors.push(`Text node ${node._id} missing "v" property`);
      }
      if (node.children && node.children.length > 0) {
        errors.push(`Text node ${node._id} has children (text nodes must be leaf nodes)`);
      }
      if (node.type) {
        warnings.push(`Text node ${node._id} has type="${node.type}" (should be omitted)`);
      }
      if (node.classes && node.classes.length > 0) {
        warnings.push(`Text node ${node._id} has classes (text nodes typically don't have classes)`);
      }
    }
  }

  // 8. Validate node type/tag consistency
  for (const node of nodes) {
    // Skip text nodes (already validated)
    if (node.text === true) continue;

    // Block nodes should have a valid tag
    if (node.type === "Block" && !node.tag) {
      warnings.push(`Block node ${node._id} missing tag attribute`);
    }

    // Validate tag/type mapping
    if (node.tag && node.type) {
      const validTypes = VALID_TAG_TYPE_MAPPINGS[node.tag.toLowerCase()];
      if (validTypes && !validTypes.includes(node.type)) {
        // CRITICAL: section tag with Section type is a common error
        if (node.tag.toLowerCase() === "section" && node.type === "Section") {
          errors.push(`Node ${node._id}: tag="section" should use type="Block", not type="Section"`);
        } else {
          warnings.push(`Node ${node._id}: tag="${node.tag}" with type="${node.type}" - expected one of: ${validTypes.join(", ")}`);
        }
      }
    }

    // HtmlEmbed nodes should have proper embed data
    if (node.type === "HtmlEmbed") {
      if (!node.data?.embed?.meta?.html && !node.v) {
        warnings.push(`HtmlEmbed node ${node._id} missing embed content`);
      }
      // Check for size limit (50KB is Webflow hard limit)
      const embedContent = node.data?.embed?.meta?.html || node.v || "";
      if (embedContent.length > 50000) {
        errors.push(`HtmlEmbed node ${node._id} exceeds 50KB limit (${Math.round(embedContent.length / 1024)}KB)`);
      } else if (embedContent.length > 40000) {
        warnings.push(`HtmlEmbed node ${node._id} is large (${Math.round(embedContent.length / 1024)}KB) - may cause issues`);
      }
    }

    // Image nodes should have src
    if (node.type === "Image") {
      if (!node.data?.attr?.src) {
        warnings.push(`Image node ${node._id} missing src attribute`);
      }
    }

    // Link nodes should have link data
    if (node.type === "Link") {
      if (!node.data?.link?.url) {
        warnings.push(`Link node ${node._id} missing url`);
      }
    }
  }

  // Return errors first, then warnings
  return [...errors, ...warnings];
}

// ============================================
// MAIN CONVERTER
// ============================================

export interface ConvertOptions {
  /** Prefix for generated node IDs (default: class prefix or 'wf') */
  idPrefix?: string;
}

/**
 * Build a Webflow payload for design tokens as utility classes.
 * Creates actual CSS classes (not CSS variables) that can be applied in Webflow.
 * Accepts either TokenManifest or TokenExtraction (only uses namespace + variables).
 *
 * KEY FEATURE: Creates a page-wrapper class with site margins/padding that should
 * wrap all page content to ensure consistent spacing from page edges.
 */
export function buildTokenWebflowPayload(manifest: TokenManifest | TokenExtraction): WebflowPayload {
  const fullManifest: TokenManifest =
    "schemaVersion" in manifest ? manifest : generateTokenManifest(manifest);
  const namespace = fullManifest.namespace;
  const styles: WebflowStyle[] = [];
  const classNames: string[] = [];

  // Helper to create a style object
  const createStyle = (name: string, styleLess: string): WebflowStyle => ({
    _id: name,
    fake: false,
    type: "class",
    name,
    namespace: "",
    comb: "",
    styleLess,
    variants: {},
    children: [],
  });

  // Group tokens by type
  const colorTokens = manifest.variables.filter(t => t.type === "color");
  const fontTokens = manifest.variables.filter(t => t.type === "fontFamily");
  const spacingTokens = manifest.variables.filter(t => t.type === "spacing");

  // Find main background color (light-bg or dark-bg)
  const mainBgToken = colorTokens.find(t =>
    t.cssVar === "--light-bg" || t.cssVar === "--dark-bg" || t.cssVar.includes("page-bg")
  );
  const mainBgValue = mainBgToken?.values?.light ?? mainBgToken?.value ?? "";

  const pagePaddingToken = spacingTokens.find(t =>
    t.cssVar.includes("page-padding") ||
    t.cssVar.includes("section-padding") ||
    t.cssVar.includes("container-padding")
  );
  const pageMarginToken = spacingTokens.find(t =>
    t.cssVar.includes("page-margin") ||
    t.cssVar.includes("section-margin")
  );

  const wrapperPaddingX = pagePaddingToken?.value ?? "";
  const wrapperPaddingY = pageMarginToken?.value ?? "";

  // =========================================
  // 1. PAGE WRAPPER CLASS (most important!)
  // =========================================
  // This class should wrap ALL page content to ensure consistent margins
  const pageWrapperClass = `${namespace}-page-wrapper`;
  const pageWrapperStyles = [
    wrapperPaddingX ? `padding-left: ${wrapperPaddingX};` : "",
    wrapperPaddingX ? `padding-right: ${wrapperPaddingX};` : "",
    wrapperPaddingY ? `padding-top: ${wrapperPaddingY};` : "",
    wrapperPaddingY ? `padding-bottom: ${wrapperPaddingY};` : "",
    `width: 100%;`,
    mainBgValue ? `background-color: ${mainBgValue};` : "",
  ].filter(Boolean).join(" ");

  const pageWrapperStyle = createStyle(pageWrapperClass, pageWrapperStyles);
  pageWrapperStyle.variants = {};
  styles.push(pageWrapperStyle);
  classNames.push(pageWrapperClass);

  // =========================================
  // 2. COLOR UTILITY CLASSES
  // =========================================
  for (const token of colorTokens) {
    const lightValue = token.values?.light ?? token.value ?? "";
    const darkValue = token.values?.dark;
    if (!lightValue) continue;

    const tokenName = token.cssVar.replace(/^--/, "");

    // Background color class
    const bgClassName = `${namespace}-bg-${tokenName}`;
    const bgStyle = createStyle(bgClassName, `background-color: ${lightValue};`);
    if (darkValue) {
      bgStyle.variants = {};
    }
    styles.push(bgStyle);
    classNames.push(bgClassName);

    // Text color class
    const textClassName = `${namespace}-text-${tokenName}`;
    styles.push(createStyle(textClassName, `color: ${lightValue};`));
    classNames.push(textClassName);

    // Border color class for commonly used border tokens
    if (tokenName.includes("border") || tokenName.includes("accent") || tokenName.includes("coral")) {
      const borderClassName = `${namespace}-border-${tokenName}`;
      styles.push(createStyle(borderClassName, `border-color: ${lightValue};`));
      classNames.push(borderClassName);
    }
  }

  // =========================================
  // 3. SPACING UTILITY CLASSES
  // =========================================
  for (const token of spacingTokens) {
    const raw = token.value ?? "";
    const value = toRem(raw);
    if (!value) continue;

    const tokenName = token.cssVar.replace(/^--/, "");

    // Padding class
    const paddingClassName = `${namespace}-p-${tokenName}`;
    const padStyle = createStyle(paddingClassName, `padding: ${value};`);
    appendVariant(padStyle, "tiny", `padding: ${scaleRem(value, 0.85)};`);
    appendVariant(padStyle, "small", `padding: ${scaleRem(value, 0.9)};`);
    appendVariant(padStyle, "medium", `padding: ${scaleRem(value, 1)};`);
    appendVariant(padStyle, "desktop", `padding: ${scaleRem(value, 1.1)};`);
    styles.push(padStyle);
    classNames.push(paddingClassName);

    // Margin class
    const marginClassName = `${namespace}-m-${tokenName}`;
    const marStyle = createStyle(marginClassName, `margin: ${value};`);
    appendVariant(marStyle, "tiny", `margin: ${scaleRem(value, 0.85)};`);
    appendVariant(marStyle, "small", `margin: ${scaleRem(value, 0.9)};`);
    appendVariant(marStyle, "medium", `margin: ${scaleRem(value, 1)};`);
    appendVariant(marStyle, "desktop", `margin: ${scaleRem(value, 1.1)};`);
    styles.push(marStyle);
    classNames.push(marginClassName);

    // Gap class (for flex/grid)
    const gapClassName = `${namespace}-gap-${tokenName}`;
    const gapStyle = createStyle(gapClassName, `gap: ${value};`);
    appendVariant(gapStyle, "tiny", `gap: ${scaleRem(value, 0.85)};`);
    appendVariant(gapStyle, "small", `gap: ${scaleRem(value, 0.9)};`);
    appendVariant(gapStyle, "medium", `gap: ${scaleRem(value, 1)};`);
    appendVariant(gapStyle, "desktop", `gap: ${scaleRem(value, 1.1)};`);
    styles.push(gapStyle);
    classNames.push(gapClassName);
  }

  // =========================================
  // 4. FONT UTILITY CLASSES
  // =========================================
  for (const token of fontTokens) {
    const value = token.values?.light ?? token.value ?? "";
    if (!value) continue;
    const tokenName = token.cssVar.replace(/^--/, "");
    const fontClassName = `${namespace}-${tokenName}`;
    styles.push(createStyle(fontClassName, `font-family: ${value};`));
    classNames.push(fontClassName);
  }

  // =========================================
  // 5. PREVIEW STRUCTURE (with page wrapper demo)
  // =========================================
  const swatchNodes: WebflowNode[] = [];
  const swatchIds: string[] = [];

  // Create color swatches
  for (const token of colorTokens) {
    const value = token.values?.light ?? token.value ?? "";
    if (!value) continue;
    const tokenName = token.cssVar.replace(/^--/, "");
    const bgClassName = `${namespace}-bg-${tokenName}`;

    const swatchId = `${namespace}-swatch-${tokenName}`;
    const labelId = `${namespace}-label-${tokenName}`;

    swatchNodes.push({
      _id: labelId,
      text: true,
      v: tokenName,
    });

    swatchNodes.push({
      _id: swatchId,
      type: "Block",
      tag: "div",
      classes: [bgClassName],
      children: [labelId],
      data: { tag: "div", text: false },
    });
    swatchIds.push(swatchId);
  }

  // Create font samples
  for (const token of fontTokens) {
    const value = token.values?.light ?? token.value ?? "";
    if (!value) continue;
    const tokenName = token.cssVar.replace(/^--/, "");
    const fontClassName = `${namespace}-${tokenName}`;

    const sampleId = `${namespace}-font-sample-${tokenName}`;
    const textId = `${namespace}-font-text-${tokenName}`;

    swatchNodes.push({
      _id: textId,
      text: true,
      v: `${tokenName}: ${value}`,
    });

    swatchNodes.push({
      _id: sampleId,
      type: "Block",
      tag: "div",
      classes: [fontClassName],
      children: [textId],
      data: { tag: "div", text: false },
    });
    swatchIds.push(sampleId);
  }

  // Token grid container (inner)
  const tokenGridId = `${namespace}-token-grid`;
  const tokenGridNode: WebflowNode = {
    _id: tokenGridId,
    type: "Block",
    tag: "div",
    classes: [`${namespace}-token-grid`],
    children: swatchIds,
    data: { tag: "div", text: false },
  };

  // Instruction text
  const instructionTextId = `${namespace}-instruction-text`;
  swatchNodes.push({
    _id: instructionTextId,
    text: true,
    v: `Design Tokens - Use ${pageWrapperClass} to wrap your page content for consistent margins`,
  });

  const instructionId = `${namespace}-instruction`;
  const instructionNode: WebflowNode = {
    _id: instructionId,
    type: "Block",
    tag: "div",
    classes: [],
    children: [instructionTextId],
    data: { tag: "div", text: false },
  };

  // PAGE WRAPPER containing the token grid (demonstrates proper usage)
  const pageWrapperId = `${namespace}-page-wrapper-demo`;
  const pageWrapperNode: WebflowNode = {
    _id: pageWrapperId,
    type: "Block",
    tag: "div",
    classes: [pageWrapperClass],
    children: [instructionId, tokenGridId],
    data: { tag: "div", text: false },
  };

  const tokenGridStyles: string[] = [
    "display: flex;",
    "flex-wrap: wrap;",
  ];
  const firstSpacing = spacingTokens[0]?.value ?? "";
  const firstSpacingRem = firstSpacing ? toRem(firstSpacing) : "";
  if (firstSpacingRem) {
    tokenGridStyles.push(`gap: ${firstSpacingRem};`);
    tokenGridStyles.push(`padding: ${firstSpacingRem};`);
  }
  styles.push(createStyle(`${namespace}-token-grid`, tokenGridStyles.join(" ")));

  const finalNodes = [pageWrapperNode, instructionNode, tokenGridNode, ...swatchNodes.reverse()];

  // Validate payload integrity (legacy validation)
  const integrityWarnings = validatePayloadIntegrity(finalNodes, styles);
  if (integrityWarnings.length > 0) {
    console.warn("[webflow-converter] Token payload integrity issues:", integrityWarnings);
  }

  // Build the payload
  const payload: WebflowPayload = {
    type: "@webflow/XscpData",
    payload: {
      nodes: finalNodes,
      styles,
      assets: [],
      ix1: [],
      ix2: { interactions: [], events: [], actionLists: [] },
    },
    meta: {
      unlinkedSymbolCount: 0,
      droppedLinks: 0,
      dynBindRemovedCount: 0,
      dynListBindRemovedCount: 0,
      paginationRemovedCount: 0,
      tokenManifest: fullManifest,
      hasEmbedCSS: false,
      hasEmbedJS: false,
      embedCSSSize: 0,
      embedJSSize: 0,
    },
  };

  // Run pre-flight validation
  const preflightResult = runPreflightValidation(payload);
  payload.meta.preflightValidation = {
    isValid: preflightResult.isValid,
    canProceed: preflightResult.canProceed,
    summary: preflightResult.summary,
  };

  if (!preflightResult.canProceed) {
    console.error("[webflow-converter] CRITICAL: Token payload pre-flight validation failed!", preflightResult.summary);
  }

  return payload;
}

/**
 * Ensure content is wrapped in a page-wrapper div with default styles
 */
function ensurePageWrapper(html: string, css: string): { html: string; css: string } {
  const wrapperClass = "page-wrapper";
  let newHtml = html;
  let newCss = css;

  // Check if wrapper already exists in HTML
  if (!newHtml.includes(`class="${wrapperClass}"`) && !newHtml.includes(`class='${wrapperClass}'`)) {
    newHtml = `<div class="${wrapperClass}">\n${newHtml}\n</div>`;
  }

  // Check if wrapper style already exists in CSS
  // NOTE: We no longer inject hardcoded padding - spacing must come from source CSS
  const wrapperRegex = /\.page-wrapper\s*\{/;
  if (!wrapperRegex.test(newCss)) {
    newCss = `${newCss}\n
.page-wrapper {
  width: 100%;
  max-width: 100%;
  margin-left: auto;
  margin-right: auto;
}`;
  }

  return { html: newHtml, css: newCss };
}

/**
 * Convert a DetectedSection to Webflow JSON payload
 */
export function convertSectionToWebflow(
  section: DetectedSection,
  options: ConvertOptions = {}
): WebflowPayload {
  // Determine ID prefix from first class or use default
  const prefix = options.idPrefix || extractPrefix(section.className) || "wf";
  const idGen = new IdGenerator(prefix);
  const collectedClasses = new Set<string>();
  const inlineStyles = new Map<string, string>();

  // Ensure page wrapper exists
  const { html, css } = ensurePageWrapper(section.htmlContent, section.cssContent);

  // ==========================================
  // CSS ROUTING - CRITICAL: Route BEFORE normalization
  // ==========================================
  // The normalizer strips pseudo-elements and other non-native CSS.
  // We must route FIRST to capture embed-worthy CSS before it's removed.
  const cssRouting = routeCSS(css);
  const nativeCSS = cssRouting.native;
  const embedCSSRaw = cssRouting.embed;

  // Now normalize only the NATIVE CSS
  const normalized = normalizeHtmlCssForWebflow(html, nativeCSS);
  if (normalized.warnings.length > 0) {
    console.warn("[webflow-normalizer]", normalized.warnings.join(" | "));
  }

  // Wrap embed CSS in <style> tags if present
  const embedCSS = embedCSSRaw ? wrapEmbedCSSInStyleTag(embedCSSRaw, true) : '';

  // Log routing stats
  if (cssRouting.stats.embedRules > 0) {
    console.log(`[css-routing] Routed ${cssRouting.stats.embedRules}/${cssRouting.stats.totalRules} rules to embed`);
  }

  // ==========================================
  // JS DETECTION & EMBED GENERATION
  // ==========================================
  let embedJS = '';
  if (section.jsContent) {
    const jsResult = generateWebflowScriptEmbed(section.jsContent, {
      detectLibs: true,
      wrapInDOMContentLoaded: true,
    });
    embedJS = jsResult.embedHtml;

    // Log detected libraries
    if (jsResult.detectedLibraries.names.length > 0) {
      console.log(`[js-detection] Detected libraries: ${jsResult.detectedLibraries.displayNames.join(', ')}`);
    }

    // Warn about paid plugins
    if (jsResult.paidPluginWarnings.length > 0) {
      console.warn('[js-detection] Paid plugins detected:', jsResult.paidPluginWarnings.map(p => p.displayName).join(', '));
    }
  }

  // ==========================================
  // ASSET VALIDATION - Early in pipeline
  // ==========================================
  const assetManifest = extractAndValidateAssets(normalized.html, nativeCSS);
  const googleFonts = detectGoogleFonts(normalized.html);

  // Log asset issues for debugging
  if (assetManifest.errors.length > 0) {
    console.warn("[webflow-converter] Asset errors:", assetManifest.errors);
  }
  if (assetManifest.warnings.length > 0) {
    console.warn("[webflow-converter] Asset warnings:", assetManifest.warnings);
  }

  // ==========================================
  // CANVAS/WEBGL VALIDATION
  // ==========================================
  const canvasValidation = validateCanvasWebGLRequirements(normalized.html, section.jsContent);
  if (canvasValidation.hasIssues) {
    console.warn("[webflow-converter] Canvas/WebGL warnings:");
    canvasValidation.warnings.forEach(w => {
      console.warn(`  ${w.type.toUpperCase()}: ${w.message}`);
      if (w.suggestion) {
        console.warn(`  Suggestion: ${w.suggestion}`);
      }
    });
  }

  // ==========================================
  // EXTERNAL RESOURCE DETECTION
  // ==========================================
  const externalResources = detectExternalResources(section.htmlContent);
  if (externalResources.hasErrors) {
    console.warn("[webflow-converter] External resource errors:");
    externalResources.all.filter(r => r.severity === 'error').forEach(r => {
      console.warn(`  ERROR: ${r.message}`);
    });
  }
  if (externalResources.hasWarnings) {
    console.warn("[webflow-converter] External resource warnings:");
    externalResources.all.filter(r => r.severity === 'warning').forEach(r => {
      console.warn(`  WARNING: ${r.message}`);
    });
  }

  // Parse HTML
  const parsed = parseHtmlString(normalized.html) ?? parseHtmlString(`<div>${normalized.html}</div>`);
  if (!parsed) {
    // Return empty payload if parsing fails
    return createEmptyPayload();
  }

  // Use ClassIndex from normalization if available, otherwise parse NATIVE CSS
  // IMPORTANT: We parse the native CSS (after routing) so only Webflow-compatible styles are included
  let classIndex = normalized.classIndex;
  if (!classIndex) {
    const parsedResult = parseCSS(nativeCSS);
    classIndex = parsedResult.classIndex;
  }

  // Convert HTML to nodes
  const { nodes, spanClasses } = convertToWebflowNodes(parsed, idGen, collectedClasses, classIndex, inlineStyles);

  const styles = convertToWebflowStyles(classIndex, collectedClasses);

  // Ensure span classes have display: inline to maintain inline text flow
  for (const style of styles) {
    if (spanClasses.has(style.name) && !style.styleLess.includes("display:")) {
      style.styleLess = `display: inline; ${style.styleLess}`;
    }
  }

  for (const [className, styleLess] of inlineStyles.entries()) {
    styles.push({
      _id: className,
      fake: false,
      type: "class",
      name: className,
      namespace: "",
      comb: "",
      styleLess,
      variants: {},
      children: [],
    });
  }

  // Validate payload integrity (legacy validation)
  const integrityWarnings = validatePayloadIntegrity(nodes, styles);
  if (integrityWarnings.length > 0) {
    console.warn("[webflow-converter] Integrity issues:", integrityWarnings);
  }

  // Calculate embed sizes
  const embedCSSSize = embedCSS ? new Blob([embedCSS]).size : 0;
  const embedJSSize = embedJS ? new Blob([embedJS]).size : 0;

  // Build the payload
  const payload: WebflowPayload = {
    type: "@webflow/XscpData",
    payload: {
      nodes,
      styles,
      assets: [],
      ix1: [],
      ix2: {
        interactions: [],
        events: [],
        actionLists: [],
      },
    },
    // Include embed blocks if present
    embedCSS: embedCSS || undefined,
    embedJS: embedJS || undefined,
    meta: {
      unlinkedSymbolCount: 0,
      droppedLinks: 0,
      dynBindRemovedCount: 0,
      dynListBindRemovedCount: 0,
      paginationRemovedCount: 0,
      assetValidation: {
        errors: assetManifest.errors,
        warnings: assetManifest.warnings,
        stats: assetManifest.stats,
        googleFonts: googleFonts ?? undefined,
      },
      externalResources: externalResources.all.length > 0 ? externalResources : undefined,
      // Quick check flags for embed requirements
      hasEmbedCSS: embedCSSSize > 0,
      hasEmbedJS: embedJSSize > 0,
      embedCSSSize,
      embedJSSize,
    },
  };

  // Run JS-HTML cross-reference validation if JS content is present
  if (section.jsContent) {
    const xrefResult = validateJsHtmlReferences(normalized.html, section.jsContent);
    payload.meta.xrefValidation = xrefResult;

    if (!xrefResult.isValid) {
      console.error("[webflow-converter] JS-HTML cross-reference validation failed:",
        `${xrefResult.orphanIds.length} orphan ID(s): ${xrefResult.orphanIds.slice(0, 3).join(", ")}`);
    } else if (xrefResult.orphanClasses.length > 0) {
      console.warn("[webflow-converter] JS-HTML cross-reference warnings:",
        `${xrefResult.orphanClasses.length} orphan class(es): ${xrefResult.orphanClasses.slice(0, 3).join(", ")}`);
    }
  }

  // Run pre-flight validation (includes xref if HTML and JS provided)
  const preflightResult = runPreflightValidation(payload, {
    html: normalized.html,
    jsCode: section.jsContent,
  });
  payload.meta.preflightValidation = {
    isValid: preflightResult.isValid,
    canProceed: preflightResult.canProceed,
    summary: preflightResult.summary,
    details: preflightResult,
  };

  if (!preflightResult.canProceed) {
    console.error("[webflow-converter] CRITICAL: Pre-flight validation failed!", preflightResult.summary);
  } else if (!preflightResult.isValid) {
    console.warn("[webflow-converter] Pre-flight validation passed with warnings:", preflightResult.summary);
  }

  return payload;
}

/**
 * Convert raw HTML + CSS strings to Webflow JSON
 */
export function convertHtmlCssToWebflow(
  html: string,
  css: string,
  options: ConvertOptions = {}
): WebflowPayload {
  const section: DetectedSection = {
    id: "converted",
    name: "Converted",
    tagName: "div",
    className: "",
    htmlContent: html,
    cssSelectors: [],
    cssContent: css,
  };
  return convertSectionToWebflow(section, options);
}

/**
 * Extract prefix from class name (e.g., 'fp-hero' -> 'fp')
 */
function extractPrefix(className: string): string | null {
  if (!className) return null;
  const match = className.match(/^([a-z]+)-/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Create empty Webflow payload
 */
function createEmptyPayload(): WebflowPayload {
  return {
    type: "@webflow/XscpData",
    payload: {
      nodes: [],
      styles: [],
      assets: [],
      ix1: [],
      ix2: {
        interactions: [],
        events: [],
        actionLists: [],
      },
    },
    meta: {
      unlinkedSymbolCount: 0,
      droppedLinks: 0,
      dynBindRemovedCount: 0,
      dynListBindRemovedCount: 0,
      paginationRemovedCount: 0,
      hasEmbedCSS: false,
      hasEmbedJS: false,
      embedCSSSize: 0,
      embedJSSize: 0,
    },
  };
}

/**
 * Validate a Webflow payload structure
 */
export function isValidWebflowPayload(json: unknown): boolean {
  if (!json || typeof json !== "object") return false;
  const payload = json as Record<string, unknown>;

  if (payload.type !== "@webflow/XscpData") return false;
  if (!payload.payload || typeof payload.payload !== "object") return false;

  const inner = payload.payload as Record<string, unknown>;
  if (!Array.isArray(inner.nodes)) return false;
  if (!Array.isArray(inner.styles)) return false;

  return true;
}

// ============================================
// NEW: CSS-BASED TOKEN/COMPONENT PAYLOADS
// ============================================

export interface TokenPayloadResult {
  /** Webflow payload to paste for establishing global styles */
  webflowPayload: WebflowPayload;
  /** Set of class names established by this payload */
  establishedClasses: Set<string>;
  /** Warnings generated during conversion */
  warnings: string[];
}

export interface ComponentPayloadResult {
  /** Webflow payload to paste for this component */
  webflowPayload: WebflowPayload;
  /** Warnings generated during conversion */
  warnings: string[];
  /** Classes that were referenced but not in established set */
  missingClasses: string[];
}

/**
 * Build a Webflow payload that establishes all CSS classes as global styles.
 * This should be pasted ONCE before pasting any components.
 *
 * The key insight: Webflow doesn't understand CSS files. We must convert
 * CSS rules into Webflow class definitions with styleLess format.
 */
export function buildCssTokenPayload(
  css: string,
  options: {
    /** Optional namespace prefix for generated classes */
    namespace?: string;
    /** Include a preview wrapper div */
    includePreview?: boolean;
  } = {}
): TokenPayloadResult {
  const { namespace = "fp", includePreview = true } = options;
  const warnings: string[] = [];

  // Validate asset URLs in CSS (background images, fonts)
  const assetManifest = extractAndValidateAssets('', css);
  if (assetManifest.errors.length > 0) {
    warnings.push(...assetManifest.errors.map(e => `Asset Error: ${e}`));
  }
  if (assetManifest.warnings.length > 0) {
    warnings.push(...assetManifest.warnings.map(w => `Asset Warning: ${w}`));
  }

  // Parse CSS using the new deterministic parser
  const { classIndex } = parseCSS(css);

  // Convert all classes to Webflow styles
  const styles = classIndexToWebflowStyles(classIndex);

  // Apply sanitization to all styles
  for (const style of styles) {
    const sanitizeResult = sanitizeStyleLess(style.styleLess);
    style.styleLess = sanitizeResult.sanitized;
    if (sanitizeResult.warnings.length > 0) {
      warnings.push(...sanitizeResult.warnings);
    }
    // Sanitize variants too
    for (const [variant, entry] of Object.entries(style.variants)) {
      const variantResult = sanitizeStyleLess(entry.styleLess);
      style.variants[variant] = { styleLess: variantResult.sanitized };
      if (variantResult.warnings.length > 0) {
        warnings.push(...variantResult.warnings.map(w => `${style.name}@${variant}: ${w}`));
      }
    }
  }

  // Collect all established class names
  const establishedClasses = new Set<string>(
    styles.map((s) => s.name)
  );

  // Add CSS parser warnings
  warnings.push(...classIndex.warnings.map((w) => w.message));

  // Build nodes that USE each class - Webflow only creates classes that are used by nodes
  const nodes: WebflowNode[] = [];
  const classNodeIds: string[] = [];

  const buildComboChain = (className: string): string[] => {
    const chain: string[] = [];
    const seen = new Set<string>();
    let current: string | undefined = className;

    while (current && !seen.has(current)) {
      seen.add(current);
      chain.unshift(current);
      const entry: ClassIndexEntry | undefined = classIndex.classes[current];
      current = entry?.parentClass;
    }

    return chain.length > 0 ? chain : [className];
  };

  // Create a node for each class so Webflow actually creates the class
  let classIdx = 0;
  for (const className of establishedClasses) {
    const nodeId = `${namespace}-class-${classIdx}`;
    classNodeIds.push(nodeId);

    const classes = buildComboChain(className);
    nodes.push({
      _id: nodeId,
      type: "Block",
      tag: "div",
      classes,
      children: [],
      data: { tag: "div", text: false },
    });
    classIdx++;
  }

  if (includePreview) {
    // Create instruction text
    const instructionTextId = `${namespace}-style-instruction-text`;
    const instructionId = `${namespace}-style-instruction`;
    const wrapperId = `${namespace}-style-wrapper`;

    nodes.push({
      _id: instructionTextId,
      text: true,
      v: `CSS Styles Established - ${establishedClasses.size} classes. Delete this wrapper after pasting.`,
    });

    nodes.push({
      _id: instructionId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [instructionTextId],
      data: { tag: "div", text: false },
    });

    // Wrapper contains instruction + all class nodes
    nodes.push({
      _id: wrapperId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [instructionId, ...classNodeIds],
      data: { tag: "div", text: false },
    });
  }

  // Validate payload integrity (legacy validation)
  const integrityWarnings = validatePayloadIntegrity(nodes, styles);
  if (integrityWarnings.length > 0) {
    warnings.push(...integrityWarnings);
    console.warn("[webflow-converter] CSS token payload integrity issues:", integrityWarnings);
  }

  // Build the webflow payload
  const webflowPayload: WebflowPayload = {
    type: "@webflow/XscpData",
    payload: {
      nodes,
      styles,
      assets: [],
      ix1: [],
      ix2: { interactions: [], events: [], actionLists: [] },
    },
    meta: {
      unlinkedSymbolCount: 0,
      droppedLinks: 0,
      dynBindRemovedCount: 0,
      dynListBindRemovedCount: 0,
      paginationRemovedCount: 0,
      hasEmbedCSS: false,
      hasEmbedJS: false,
      embedCSSSize: 0,
      embedJSSize: 0,
    },
  };

  // Run pre-flight validation
  const preflightResult = runPreflightValidation(webflowPayload);
  webflowPayload.meta.preflightValidation = {
    isValid: preflightResult.isValid,
    canProceed: preflightResult.canProceed,
    summary: preflightResult.summary,
  };

  if (!preflightResult.canProceed) {
    warnings.push(`CRITICAL: Pre-flight validation failed - ${preflightResult.summary}`);
    console.error("[webflow-converter] CRITICAL: CSS token payload pre-flight validation failed!", preflightResult.summary);
  } else if (!preflightResult.isValid) {
    warnings.push(`Pre-flight validation warnings: ${preflightResult.summary}`);
  }

  return {
    webflowPayload,
    establishedClasses,
    warnings,
  };
}

export interface ComponentPayloadOptions extends ConvertOptions {
  /**
   * If true, skip styles for classes that are in establishedClasses.
   * Use this if you've already pasted the token payload and want to avoid "-2" duplicates.
   * Default: false (include all styles for safety)
   */
  skipEstablishedStyles?: boolean;
}

/**
 * Build a Webflow payload for a single component.
 *
 * By default, includes ALL styles the component uses (safest option).
 * Set skipEstablishedStyles=true if you've already pasted the token payload
 * and want to avoid "-2" class duplicates.
 */
export function buildComponentPayload(
  component: Component,
  classIndex: ClassIndex,
  establishedClasses: Set<string>,
  options: ComponentPayloadOptions = {}
): ComponentPayloadResult {
  const { skipEstablishedStyles = false } = options;
  const warnings: string[] = [];
  const missingClasses: string[] = [];
  const skippedClasses: string[] = [];

  // Validate asset URLs in component HTML
  const assetManifest = extractAndValidateAssets(component.htmlContent, '');
  if (assetManifest.errors.length > 0) {
    warnings.push(...assetManifest.errors.map(e => `Asset Error: ${e}`));
  }
  if (assetManifest.warnings.length > 0) {
    warnings.push(...assetManifest.warnings.map(w => `Asset Warning: ${w}`));
  }

  // Determine ID prefix
  const prefix = options.idPrefix || extractPrefix(component.primaryClass) || "wf";
  const idGen = new IdGenerator(prefix);
  const collectedClasses = new Set<string>();
  const inlineStyles = new Map<string, string>();

  // Parse component HTML
  const parsed = parseHtmlString(component.htmlContent) ?? parseHtmlString(`<div>${component.htmlContent}</div>`);
  if (!parsed) {
    warnings.push(`Failed to parse HTML for component: ${component.name}`);
    return {
      webflowPayload: createEmptyPayload(),
      warnings,
      missingClasses,
    };
  }

  const { nodes, spanClasses } = convertToWebflowNodes(parsed, idGen, collectedClasses, classIndex, inlineStyles);

  // Build styles array based on options
  const componentStyles: WebflowStyle[] = [];

  // Track which styles are for span classes
  const spanClassSet = spanClasses;

  for (const className of collectedClasses) {
    if (inlineStyles.has(className)) {
      continue;
    }
    // Optionally skip classes that were already established (user's choice)
    if (skipEstablishedStyles && establishedClasses.has(className)) {
      skippedClasses.push(className);
      continue;
    }

    // Check if class exists in our classIndex
    const entry = classIndex.classes[className];
    if (entry) {
      componentStyles.push(classEntryToWebflowStyle(entry));
    } else {
      // Class used in HTML but not defined in CSS
      missingClasses.push(className);
    }
  }

  for (const [className, styleLess] of inlineStyles.entries()) {
    if (skipEstablishedStyles && establishedClasses.has(className)) {
      skippedClasses.push(className);
      continue;
    }
    componentStyles.push({
      _id: className,
      fake: false,
      type: "class",
      name: className,
      namespace: "",
      comb: "",
      styleLess,
      variants: {},
      children: [],
    });
  }

  if (skippedClasses.length > 0) {
    warnings.push(`Skipped ${skippedClasses.length} established classes (assumed already in Webflow)`);
  }

  if (missingClasses.length > 0) {
    warnings.push(
      `${missingClasses.length} classes used but not defined: ${missingClasses.slice(0, 5).join(", ")}${missingClasses.length > 5 ? "..." : ""}`
    );
  }

  // Apply sanitization to all styles
  for (const style of componentStyles) {
    style.styleLess = sanitizeStyleLessVisibility(style.styleLess);
    // Ensure span classes have display: inline to maintain inline text flow
    if (spanClassSet.has(style.name) && !style.styleLess.includes("display:")) {
      style.styleLess = `display: inline; ${style.styleLess}`;
    }
    for (const [variant, entry] of Object.entries(style.variants)) {
      style.variants[variant] = { styleLess: sanitizeStyleLessVisibility(entry.styleLess) };
    }
  }

  // Validate payload integrity (legacy validation)
  const integrityWarnings = validatePayloadIntegrity(nodes, componentStyles);
  if (integrityWarnings.length > 0) {
    warnings.push(...integrityWarnings);
    console.warn(`[webflow-converter] Component "${component.name}" integrity issues:`, integrityWarnings);
  }

  // Build the webflow payload
  const webflowPayload: WebflowPayload = {
    type: "@webflow/XscpData",
    payload: {
      nodes,
      styles: componentStyles,
      assets: [],
      ix1: [],
      ix2: { interactions: [], events: [], actionLists: [] },
    },
    meta: {
      unlinkedSymbolCount: 0,
      droppedLinks: 0,
      dynBindRemovedCount: 0,
      dynListBindRemovedCount: 0,
      paginationRemovedCount: 0,
      assetValidation: assetManifest.stats.total > 0 ? {
        errors: assetManifest.errors,
        warnings: assetManifest.warnings,
        stats: assetManifest.stats,
      } : undefined,
      hasEmbedCSS: false,
      hasEmbedJS: false,
      embedCSSSize: 0,
      embedJSSize: 0,
    },
  };

  // Run pre-flight validation
  const preflightResult = runPreflightValidation(webflowPayload);
  webflowPayload.meta.preflightValidation = {
    isValid: preflightResult.isValid,
    canProceed: preflightResult.canProceed,
    summary: preflightResult.summary,
  };

  if (!preflightResult.canProceed) {
    warnings.push(`CRITICAL: Pre-flight validation failed for "${component.name}" - ${preflightResult.summary}`);
    console.error(`[webflow-converter] CRITICAL: Component "${component.name}" pre-flight validation failed!`, preflightResult.summary);
  } else if (!preflightResult.isValid) {
    warnings.push(`Pre-flight validation warnings for "${component.name}": ${preflightResult.summary}`);
  }

  return {
    webflowPayload,
    warnings,
    missingClasses,
  };
}

/**
 * Partition styles between token (global) and component (local) payloads.
 *
 * Returns which classes should be in each payload to avoid duplication.
 */
export function partitionStyles(
  componentClasses: string[],
  establishedClasses: Set<string>,
  classIndex: ClassIndex
): {
  /** Classes that are already established (just reference them) */
  tokenClasses: string[];
  /** Classes that need to be included in component payload */
  componentClasses: string[];
  /** Classes used but not defined anywhere */
  undefinedClasses: string[];
} {
  const tokenClasses: string[] = [];
  const componentOnlyClasses: string[] = [];
  const undefinedClasses: string[] = [];

  for (const className of componentClasses) {
    if (establishedClasses.has(className)) {
      tokenClasses.push(className);
    } else if (classIndex.classes[className]) {
      componentOnlyClasses.push(className);
    } else {
      undefinedClasses.push(className);
    }
  }

  return {
    tokenClasses,
    componentClasses: componentOnlyClasses,
    undefinedClasses,
  };
}

/**
 * Build complete import result with token and component payloads.
 * This is the main entry point for the new import workflow.
 */
export function buildImportPayloads(
  cleanHtml: string,
  fullCss: string,
  components: Component[],
  options: {
    namespace?: string;
    includeTokenPreview?: boolean;
  } = {}
): {
  tokenPayload: TokenPayloadResult;
  componentPayloads: Map<string, ComponentPayloadResult>;
  classIndex: ClassIndex;
} {
  const { namespace = "fp", includeTokenPreview = true } = options;

  // Build token payload first
  const tokenPayload = buildCssTokenPayload(fullCss, {
    namespace,
    includePreview: includeTokenPreview,
  });

  // Parse CSS for class index
  const { classIndex } = parseCSS(fullCss);

  // Build component payloads
  const componentPayloads = new Map<string, ComponentPayloadResult>();

  for (const component of components) {
    const result = buildComponentPayload(
      component,
      classIndex,
      tokenPayload.establishedClasses
    );
    componentPayloads.set(component.id, result);
  }

  return {
    tokenPayload,
    componentPayloads,
    classIndex,
  };
}

/**
 * Validate that styles will paste correctly into Webflow.
 * Returns warnings about potential issues.
 */
export function validateForWebflowPaste(
  classIndex: ClassIndex,
  components: Component[]
): string[] {
  const warnings: string[] = [];

  // Check for complex selectors that Webflow may not handle
  for (const entry of Object.values(classIndex.classes)) {
    if (entry.isComboClass && entry.children.length > 1) {
      warnings.push(
        `Combo class "${entry.className}" has multiple children. Webflow may create duplicate classes.`
      );
    }
  }

  // Check for missing class definitions
  const definedClasses = new Set(Object.keys(classIndex.classes));
  for (const component of components) {
    for (const className of component.classesUsed) {
      if (!definedClasses.has(className)) {
        warnings.push(
          `Class "${className}" used in ${component.name} but not defined in CSS.`
        );
      }
    }
  }

  // Check for CSS parser warnings
  warnings.push(...classIndex.warnings.map((w) => `CSS: ${w.message}`));

  return [...new Set(warnings)]; // Dedupe
}

// ============================================
// RE-EXPORTS FROM ASSET VALIDATOR
// ============================================

// Re-export asset validator types and functions for convenience
export {
  classifyURL,
  validateAssetURL,
  extractAndValidateAssets,
  detectGoogleFonts,
  processAssetUrls,
  generateValidationSummary,
} from "./asset-validator";

export type {
  AssetURLType,
  AssetValidation,
  AssetManifest,
  GoogleFontInfo,
  AssetReplacementOptions,
} from "./asset-validator";

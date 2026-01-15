/**
 * Webflow JSON Converter
 * Converts HTML + CSS into Webflow's @webflow/XscpData clipboard format
 */

import type { DetectedSection } from "./html-parser";
import type { TokenManifest, TokenExtraction } from "./token-extractor";
import type { ClassIndex, ClassIndexEntry } from "./css-parser";
import {
  parseCSS,
  classIndexToWebflowStyles,
  classEntryToWebflowStyle,
} from "./css-parser";
import type { Component } from "./componentizer";
import { normalizeHtmlCssForWebflow } from "./webflow-normalizer";

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
  };
}

function sanitizeStyleLessVisibility(styleLess: string): string {
  if (!styleLess) return styleLess;
  const parts = styleLess.split(";").map((s) => s.trim()).filter(Boolean);
  const map = new Map<string, string>();
  for (const part of parts) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    map.set(key, val);
  }
  const opacity = (map.get("opacity") || "").trim();
  if (opacity === "0" || opacity === "0%" || opacity === "0.0") {
    map.set("opacity", "1");
  }
  const visibility = (map.get("visibility") || "").trim().toLowerCase();
  if (visibility === "hidden") {
    map.set("visibility", "visible");
  }
  return Array.from(map.entries()).map(([k, v]) => `${k}: ${v};`).join(" ");
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
  meta: {
    unlinkedSymbolCount: number;
    droppedLinks: number;
    dynBindRemovedCount: number;
    dynListBindRemovedCount: number;
    paginationRemovedCount: number;
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

function countGridColumns(template: string | undefined): number {
  if (!template) return 0;
  const m = template.match(/repeat\(\s*(\d+)\s*,/i);
  if (m) return parseInt(m[1], 10);
  const tokens = template.trim().split(/\s+/);
  return tokens.filter((t) => /1fr|minmax\(/i.test(t)).length;
}

function applyResponsiveGridFixes(styles: Map<string, WebflowStyle>): void {
  for (const style of styles.values()) {
    const base = parseStyleLessMap(style.styleLess);
    const display = (base.get("display") || "").toLowerCase();
    if (!display.includes("grid")) continue;
    const cols = countGridColumns(base.get("grid-template-columns"));
    if (cols < 3) continue;
    appendVariant(style, "small", "grid-template-columns: repeat(3, minmax(0, 1fr));");
    appendVariant(style, "tiny", "grid-template-columns: 1fr;");
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
  classIndex: ClassIndex
): { nodes: WebflowNode[]; rootId: string } {
  const nodes: WebflowNode[] = [];
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

  const mapTagToType = (tag: string): WebflowNode["type"] => {
    switch (tag) {
      case "section":
        return "Section";
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        return "Heading";
      case "p":
        return "Paragraph";
      case "a":
        return "Link";
      case "img":
        return "Image";
      case "video":
        return "Video";
      case "ul":
      case "ol":
        return "List";
      case "li":
        return "ListItem";
      default:
        return "Block";
    }
  };

  function processElement(el: ParsedElement): string {
    if (dropTags.has(el.tag)) return "";

    const normalizedTag = normalizeTagForWebflow(el.tag);
    const baseClasses = [...el.classes];
    const hasGrid = baseClasses.some((cls) => isGridClass(cls, classIndex));
    const nodeClasses = hasGrid && !baseClasses.includes("w-layout-grid")
      ? [...baseClasses, "w-layout-grid"]
      : baseClasses;

    // Collect classes for style extraction (skip w-layout-grid)
    baseClasses.forEach((c) => collectedClasses.add(c));

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
  return { nodes: nodes.reverse(), rootId };
}

// ============================================
// CSS PARSER
// ============================================

interface ParsedCssRule {
  selector: string;
  className: string;
  pseudoClass?: string;
  properties: string;
}

interface ParsedMediaQuery {
  query: string;
  breakpoint: string | null;
  rules: ParsedCssRule[];
}

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

function detectWebflowBreakpoint(query: string): string | null {
  const maxWidthMatch = query.match(/max-width:\s*(\d+)px/i);
  if (maxWidthMatch) {
    const width = parseInt(maxWidthMatch[1], 10);
    if (width <= 479) return "tiny";
    if (width <= 767) return "small";
    if (width <= 991) return "medium";
    if (width <= 1200) return "desktop";
  }

  const minWidthMatch = query.match(/min-width:\s*(\d+)px/i);
  if (minWidthMatch) {
    const width = parseInt(minWidthMatch[1], 10);
    if (width >= 1920) return "xxl";
    if (width >= 1440) return "xl";
  }

  return null;
}

/**
 * Parse CSS into rules and media queries
 */
function parseCss(css: string): { rules: ParsedCssRule[]; mediaQueries: ParsedMediaQuery[] } {
  const rules: ParsedCssRule[] = [];
  const mediaQueries: ParsedMediaQuery[] = [];

  // Remove comments
  const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, "");

  // Extract media queries first
  const mediaRegex = /@media\s*([^{]+)\{([\s\S]*?)\}\s*\}/g;
  let mediaMatch;

  while ((mediaMatch = mediaRegex.exec(cleanCss)) !== null) {
    const query = mediaMatch[1].trim();
    const content = mediaMatch[2];

    // Determine breakpoint name
    const breakpoint = detectWebflowBreakpoint(query);
    if (!breakpoint && /max-width|min-width/i.test(query)) {
      console.warn(`[webflow-converter] Unmapped media query: ${query}`);
    }

    const mediaRules = parseRulesFromContent(content);
    if (mediaRules.length > 0) {
      mediaQueries.push({ query, breakpoint, rules: mediaRules });
    }
  }

  // Remove media queries from CSS to parse remaining rules
  const cssWithoutMedia = cleanCss.replace(mediaRegex, "");

  // Parse base rules
  rules.push(...parseRulesFromContent(cssWithoutMedia));

  return { rules, mediaQueries };
}

/**
 * Parse CSS rules from content string
 * Handles both direct class selectors and descendant/child selectors
 */
function parseRulesFromContent(content: string): ParsedCssRule[] {
  const rules: ParsedCssRule[] = [];
  const supportedPseudoClasses = new Set([
    "hover",
    "focus",
    "active",
    "visited",
    "focus-visible",
    "first-child",
    "last-child",
  ]);

  // More permissive regex that matches any rule containing a class
  // Captures: selector { properties }
  const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
  let match;

  while ((match = ruleRegex.exec(content)) !== null) {
    const selector = match[1].trim();
    const properties = match[2].trim();

    // Skip @-rules, element-only selectors
    if (selector.startsWith("@") || !selector.includes(".")) continue;

    // Handle comma-separated selectors
    const selectors = selector.split(",").map(s => s.trim());

    for (const sel of selectors) {
      if (/::|:(?:before|after|first-letter|first-line|marker|placeholder|backdrop)\b/i.test(sel)) {
        continue;
      }

      // Find all classes in this selector
      const classMatches = sel.match(/\.([a-zA-Z_-][\w-]*)/g);
      if (!classMatches || classMatches.length === 0) continue;

      // Use the LAST class in the selector (most specific target)
      const lastClass = classMatches[classMatches.length - 1].substring(1); // Remove the dot

      // Check for pseudo-class on this selector
      const pseudoMatch = sel.match(/:(\w+(?:-\w+)*)(?:\([^)]*\))?\s*$/);
      const pseudoClass = pseudoMatch ? pseudoMatch[1] : undefined;
      if (pseudoClass && !supportedPseudoClasses.has(pseudoClass)) {
        continue;
      }

      rules.push({
        selector: sel,
        className: lastClass,
        pseudoClass,
        properties,
      });
    }
  }

  return rules;
}

/**
 * Convert CSS properties to styleLess format
 * Removes transitions (causes Webflow paste issues)
 */
function toStyleLess(properties: string): string {
  // Split into individual properties
  const props = properties
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);

  // Filter out transitions and transform properties
  const filtered = props.filter((prop) => {
    const propName = prop.split(":")[0]?.trim().toLowerCase();
    // Remove transition (causes paste issues)
    if (propName === "transition") return false;
    return true;
  });

  // Rejoin with proper formatting
  return filtered.map((p) => (p.endsWith(";") ? p : p + ";")).join(" ");
}

/**
 * Map pseudo-class to Webflow variant name
 */
function pseudoToVariant(pseudo: string | undefined): string | null {
  if (!pseudo) return null;
  const mapping: Record<string, string> = {
    hover: "hover",
    focus: "focus",
    active: "pressed",
    visited: "visited",
    "focus-visible": "focus-visible",
    "first-child": "first-child",
    "last-child": "last-child",
  };
  return mapping[pseudo] || null;
}

/**
 * Convert parsed CSS to Webflow styles
 */
function convertToWebflowStyles(
  css: string,
  usedClasses: Set<string>
): WebflowStyle[] {
  const { rules, mediaQueries } = parseCss(css);
  const styleMap = new Map<string, WebflowStyle>();

  // Process base rules
  for (const rule of rules) {
    if (!usedClasses.has(rule.className)) continue;

    let style = styleMap.get(rule.className);
    if (!style) {
      style = {
        _id: rule.className,
        fake: false,
        type: "class",
        name: rule.className,
        namespace: "",
        comb: "",
        styleLess: "",
        variants: {},
        children: [],
      };
      styleMap.set(rule.className, style);
    }

    const styleLess = toStyleLess(rule.properties);
    const variant = pseudoToVariant(rule.pseudoClass);

    if (variant) {
      style.variants[variant] = { styleLess };
    } else {
      // Merge base styles
      style.styleLess = style.styleLess
        ? style.styleLess + " " + styleLess
        : styleLess;
    }
  }

  // Process media query rules
  for (const mq of mediaQueries) {
    if (!mq.breakpoint) continue;

    for (const rule of mq.rules) {
      if (!usedClasses.has(rule.className)) continue;

      let style = styleMap.get(rule.className);
      if (!style) {
        style = {
          _id: rule.className,
          fake: false,
          type: "class",
          name: rule.className,
          namespace: "",
          comb: "",
          styleLess: "",
          variants: {},
          children: [],
        };
        styleMap.set(rule.className, style);
      }

      const styleLess = toStyleLess(rule.properties);
      const variant = rule.pseudoClass
        ? `${mq.breakpoint}_${pseudoToVariant(rule.pseudoClass)}`
        : mq.breakpoint;

      style.variants[variant] = { styleLess };
    }
  }

  applyResponsiveGridFixes(styleMap);
  return Array.from(styleMap.values());
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
  const namespace = manifest.namespace;
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

  // Find page/section spacing tokens for wrapper
  const pagePaddingToken = spacingTokens.find(t =>
    t.cssVar.includes("page-padding") ||
    t.cssVar.includes("section-padding") ||
    t.cssVar.includes("container-padding")
  );
  const pageMarginToken = spacingTokens.find(t =>
    t.cssVar.includes("page-margin") ||
    t.cssVar.includes("section-margin")
  );

  // Default wrapper padding if no spacing tokens found
  const wrapperPaddingX = pagePaddingToken?.value ?? "5vw";
  const wrapperPaddingY = pageMarginToken?.value ?? "0";

  // =========================================
  // 1. PAGE WRAPPER CLASS (most important!)
  // =========================================
  // This class should wrap ALL page content to ensure consistent margins
  const pageWrapperClass = `${namespace}-page-wrapper`;
  const pageWrapperStyles = [
    `padding-left: ${wrapperPaddingX};`,
    `padding-right: ${wrapperPaddingX};`,
    `padding-top: ${wrapperPaddingY};`,
    `padding-bottom: ${wrapperPaddingY};`,
    `width: 100%;`,
    `min-height: 100vh;`,
    mainBgValue ? `background-color: ${mainBgValue};` : "",
  ].filter(Boolean).join(" ");

  const pageWrapperStyle = createStyle(pageWrapperClass, pageWrapperStyles);
  // Add responsive variants for wrapper
  pageWrapperStyle.variants = {
    medium: { styleLess: "padding-left: 4vw; padding-right: 4vw;" },
    small: { styleLess: "padding-left: 5vw; padding-right: 5vw;" },
    tiny: { styleLess: "padding-left: 4vw; padding-right: 4vw;" },
  };
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

  // Add grid style
  styles.push(createStyle(`${namespace}-token-grid`, "display: flex; flex-wrap: wrap; gap: 1rem; padding: 2rem;"));

  return {
    type: "@webflow/XscpData",
    payload: {
      nodes: [pageWrapperNode, instructionNode, tokenGridNode, ...swatchNodes.reverse()],
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
    },
  };
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

  const normalized = normalizeHtmlCssForWebflow(section.htmlContent, section.cssContent);
  if (normalized.warnings.length > 0) {
    console.warn("[webflow-normalizer]", normalized.warnings.join(" | "));
  }

  // Parse HTML
  const parsed = parseHtmlString(normalized.html) ?? parseHtmlString(`<div>${normalized.html}</div>`);
  if (!parsed) {
    // Return empty payload if parsing fails
    return createEmptyPayload();
  }

  const { classIndex } = parseCSS(normalized.css);

  // Convert HTML to nodes
  const { nodes } = convertToWebflowNodes(parsed, idGen, collectedClasses, classIndex);

  // Convert CSS to styles
  const styles = convertToWebflowStyles(normalized.css, collectedClasses);

  return {
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
    meta: {
      unlinkedSymbolCount: 0,
      droppedLinks: 0,
      dynBindRemovedCount: 0,
      dynListBindRemovedCount: 0,
      paginationRemovedCount: 0,
    },
  };
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

  // Parse CSS using the new deterministic parser
  const { classIndex } = parseCSS(css);

  // Convert all classes to Webflow styles
  const styles = classIndexToWebflowStyles(classIndex);

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

  return {
    webflowPayload: {
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
      },
    },
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

  // Determine ID prefix
  const prefix = options.idPrefix || extractPrefix(component.primaryClass) || "wf";
  const idGen = new IdGenerator(prefix);
  const collectedClasses = new Set<string>();

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

  // Convert HTML to nodes (this collects all class names used)
  const { nodes } = convertToWebflowNodes(parsed, idGen, collectedClasses, classIndex);

  // Build styles array based on options
  const componentStyles: WebflowStyle[] = [];

  for (const className of collectedClasses) {
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

  if (skippedClasses.length > 0) {
    warnings.push(`Skipped ${skippedClasses.length} established classes (assumed already in Webflow)`);
  }

  if (missingClasses.length > 0) {
    warnings.push(
      `${missingClasses.length} classes used but not defined: ${missingClasses.slice(0, 5).join(", ")}${missingClasses.length > 5 ? "..." : ""}`
    );
  }

  for (const style of componentStyles) {
    style.styleLess = sanitizeStyleLessVisibility(style.styleLess);
    for (const [variant, entry] of Object.entries(style.variants)) {
      style.variants[variant] = { styleLess: sanitizeStyleLessVisibility(entry.styleLess) };
    }
  }

  return {
    webflowPayload: {
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
      },
    },
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

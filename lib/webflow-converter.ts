/**
 * Webflow JSON Converter
 * Converts HTML + CSS into Webflow's @webflow/XscpData clipboard format
 */

import type { DetectedSection } from "./html-parser";
import type { TokenManifest, TokenExtraction } from "./token-extractor";

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
  collectedClasses: Set<string>
): { nodes: WebflowNode[]; rootId: string } {
  const nodes: WebflowNode[] = [];

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
    // Collect classes for style extraction
    el.classes.forEach((c) => collectedClasses.add(c));

    // Determine node type
    const nodeType = mapTagToType(el.tag);

    // Generate ID based on first class or tag
    const baseName = el.classes[0] || el.id || el.tag;
    const nodeId = idGen.generate(baseName);

    // Build xattr from non-standard attributes
    const xattr: Array<{ name: string; value: string }> = [];
    const skipAttrs = ["class", "id", "href", "src", "alt", "target"];
    for (const [name, value] of Object.entries(el.attributes)) {
      if (!skipAttrs.includes(name) && value) {
        xattr.push({ name, value });
      }
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
        childIds.push(childId);
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
        tag: el.tag,
        text: false,
        xattr,
      };
    }

    // Build node
    const node: WebflowNode = {
      _id: nodeId,
      type: nodeType,
      tag: el.tag,
      classes: el.classes,
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
    let breakpoint: string | null = null;
    if (query.includes("max-width: 991px")) breakpoint = "medium";
    else if (query.includes("max-width: 767px")) breakpoint = "small";
    else if (query.includes("max-width: 479px")) breakpoint = "tiny";
    else if (query.includes("min-width: 1920px")) breakpoint = "xxl";
    else if (query.includes("min-width: 1440px")) breakpoint = "xl";

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
 */
function parseRulesFromContent(content: string): ParsedCssRule[] {
  const rules: ParsedCssRule[] = [];

  // Match class selectors: .class-name { properties } or .class-name:hover { properties }
  const ruleRegex = /\.([a-zA-Z_-][\w-]*)(?::(\w+(?:-\w+)*))?(?:\s*,\s*\.[a-zA-Z_-][\w-]*(?::\w+(?:-\w+)*)?)*\s*\{([^}]+)\}/g;
  let match;

  while ((match = ruleRegex.exec(content)) !== null) {
    const className = match[1];
    const pseudoClass = match[2];
    const properties = match[3].trim();

    rules.push({
      selector: match[0].split("{")[0].trim(),
      className,
      pseudoClass,
      properties,
    });
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
    const value = token.value ?? "";
    if (!value) continue;

    const tokenName = token.cssVar.replace(/^--/, "");

    // Padding class
    const paddingClassName = `${namespace}-p-${tokenName}`;
    styles.push(createStyle(paddingClassName, `padding: ${value};`));
    classNames.push(paddingClassName);

    // Margin class
    const marginClassName = `${namespace}-m-${tokenName}`;
    styles.push(createStyle(marginClassName, `margin: ${value};`));
    classNames.push(marginClassName);

    // Gap class (for flex/grid)
    const gapClassName = `${namespace}-gap-${tokenName}`;
    styles.push(createStyle(gapClassName, `gap: ${value};`));
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

  // Parse HTML
  const parsed = parseHtmlString(section.htmlContent);
  if (!parsed) {
    // Return empty payload if parsing fails
    return createEmptyPayload();
  }

  // Convert HTML to nodes
  const { nodes } = convertToWebflowNodes(parsed, idGen, collectedClasses);

  // Convert CSS to styles
  const styles = convertToWebflowStyles(section.cssContent, collectedClasses);

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

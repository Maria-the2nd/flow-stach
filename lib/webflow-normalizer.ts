/**
 * Webflow normalization pass.
 * Rewrites HTML + CSS into class-only selectors that Webflow can import cleanly.
 */

import { ELEMENT_TO_CLASS_MAP } from "./css-parser";
import { sanitizeGradientsForWebflow } from "./gradient-sanitizer";
import { decoupleGradientsFromTransforms } from "./gradient-transform-decoupler";

export interface NormalizationOptions {
  /** Throw when layout-critical properties are missing (default: false). */
  strictLayout?: boolean;
}

export interface NormalizationResult {
  html: string;
  css: string;
  warnings: string[];
}

interface RawRule {
  selector: string;
  properties: string;
}

interface NormalizedRule {
  selectors: string[];
  properties: Map<string, string>;
}

interface MediaBlock {
  query: string;
  rules: RawRule[];
}

interface NormalizedMediaBlock {
  query: string;
  rules: NormalizedRule[];
}

interface DescendantMapping {
  parentClass: string;
  target: string;
  targetType: "tag" | "class";
  className: string;
  combinator: " " | ">";
}

interface NormalizationContext {
  needsBodyWrapper: boolean;
  bodyExtraClasses: Set<string>;
  descendantMappings: DescendantMapping[];
}

interface HtmlNormalizationResult {
  html: string;
  requiredTypographyClasses: Set<string>;
  hasBtnClass: boolean;
}

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"];
const SELF_CLOSING_TAGS = new Set([
  "img",
  "br",
  "hr",
  "input",
  "meta",
  "link",
  "area",
  "base",
  "col",
  "embed",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * Normalize self-closing tags to XHTML format for Webflow compatibility.
 * Webflow's React parser requires void elements to be properly self-closed.
 * 
 * Converts:
 * - <br> → <br />
 * - <hr> → <hr />
 * - <img src="..."> → <img src="..." />
 * etc.
 */
function normalizeSelfClosingTags(html: string): string {
  // List of void elements that must be self-closing
  const voidElements = [
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
  ];

  let normalized = html;

  for (const tag of voidElements) {
    // Pattern 1: <tag> (no slash, no closing tag)
    // Replace with <tag />
    const pattern1 = new RegExp(`<${tag}(\\s[^>]*)?(?<!/)>`, 'gi');
    normalized = normalized.replace(pattern1, (match, attrs) => {
      const attributes = attrs || '';
      // Remove any trailing slash that might exist
      const cleanAttrs = attributes.replace(/\s*\/\s*$/, '');
      return `<${tag}${cleanAttrs} />`;
    });

    // Pattern 2: <tag/> (slash without space)
    // Replace with <tag />
    const pattern2 = new RegExp(`<${tag}(\\s[^>]*)?/>`, 'gi');
    normalized = normalized.replace(pattern2, (match, attrs) => {
      const attributes = attrs || '';
      const cleanAttrs = attributes.replace(/\s*\/\s*$/, '').trim();
      return cleanAttrs ? `<${tag} ${cleanAttrs} />` : `<${tag} />`;
    });
  }

  return normalized;
}

/**
 * Remove problematic attributes that cause Webflow paste issues.
 * Strips inline event handlers and other attributes that React doesn't like.
 */
function removeProblematicAttributes(html: string): string {
  let cleaned = html;

  // Remove inline event handlers (onclick, onload, etc.)
  cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Remove contenteditable attributes (can cause issues)
  cleaned = cleaned.replace(/\s+contenteditable\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  return cleaned;
}

/**
 * Normalize HTML + CSS to class-only selectors and inject required classes.
 */
export function normalizeHtmlCssForWebflow(
  html: string,
  css: string,
  options: NormalizationOptions = {}
): NormalizationResult {
  const warnings: string[] = [];
  const context: NormalizationContext = {
    needsBodyWrapper: false,
    bodyExtraClasses: new Set(),
    descendantMappings: [],
  };

  // CRITICAL: Normalize self-closing tags FIRST before any parsing
  // This prevents React error #137 in Webflow's paste handler
  let normalizedHtml = normalizeSelfClosingTags(html);
  normalizedHtml = removeProblematicAttributes(normalizedHtml);

  // Sanitize gradients for Webflow compatibility
  // This resolves CSS vars inside gradients and rounds percentages
  const gradientResult = sanitizeGradientsForWebflow(css);
  if (gradientResult.sanitizedCount > 0) {
    warnings.push(`Sanitized ${gradientResult.sanitizedCount} gradients for Webflow compatibility`);
  }
  warnings.push(...gradientResult.warnings);
  let sanitizedCss = gradientResult.css;

  // Decouple gradients from transforms to prevent Webflow import race condition
  // This structurally separates gradient-bearing elements from transform-bearing elements
  const decoupledResult = decoupleGradientsFromTransforms(normalizedHtml, sanitizedCss);
  if (decoupledResult.rewriteCount > 0) {
    warnings.push(
      `Decoupled ${decoupledResult.rewriteCount} gradient+transform elements for Webflow compatibility (${decoupledResult.decoupledClasses.join(", ")})`
    );
    normalizedHtml = decoupledResult.html;
    sanitizedCss = decoupledResult.css;
  }
  warnings.push(...decoupledResult.warnings);

  const defaultFontFamily = findDefaultFontFamily(sanitizedCss);
  const parsed = parseCssBlocks(sanitizedCss);

  const baseRules = normalizeRuleSet(parsed.baseRules, context, warnings, options);
  const mediaRules = parsed.mediaBlocks.map((block) => ({
    query: block.query,
    rules: normalizeRuleSet(block.rules, context, warnings, options),
  }));

  const htmlResult = normalizeHtml(normalizedHtml, context, warnings);
  ensureTypographyFontRules(
    baseRules,
    htmlResult.requiredTypographyClasses,
    htmlResult.hasBtnClass,
    defaultFontFamily,
    warnings
  );

  const normalizedCss = serializeCss(baseRules, mediaRules);

  return {
    html: htmlResult.html,
    css: normalizedCss,
    warnings,
  };
}

function parseCssBlocks(css: string): { baseRules: RawRule[]; mediaBlocks: MediaBlock[] } {
  const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const mediaBlocks: MediaBlock[] = [];
  const mediaRegex = /@media\s*([^{]+)\{([\s\S]*?)\}\s*\}/g;

  let mediaMatch;
  while ((mediaMatch = mediaRegex.exec(cleanCss)) !== null) {
    const query = mediaMatch[1].trim();
    const content = mediaMatch[2];
    const rules = parseRulesFromContent(content);
    mediaBlocks.push({ query, rules });
  }

  const baseContent = cleanCss.replace(mediaRegex, "");
  const baseRules = parseRulesFromContent(baseContent);

  return { baseRules, mediaBlocks };
}

function parseRulesFromContent(content: string): RawRule[] {
  const rules: RawRule[] = [];
  const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
  let match;

  while ((match = ruleRegex.exec(content)) !== null) {
    const selector = match[1].trim();
    const properties = match[2].trim();
    if (!selector || selector.startsWith("@")) continue;
    rules.push({ selector, properties });
  }

  return rules;
}

function normalizeRuleSet(
  rules: RawRule[],
  context: NormalizationContext,
  warnings: string[],
  options: NormalizationOptions
): NormalizedRule[] {
  const normalized: NormalizedRule[] = [];

  for (const rule of rules) {
    const selectors = splitSelectors(rule.selector);
    const normalizedSelectors: string[] = [];

    for (const selector of selectors) {
      const result = normalizeSelector(selector, context);
      if (result) normalizedSelectors.push(result);
    }

    if (normalizedSelectors.length === 0) continue;

    const properties = parseProperties(rule.properties);

    const hasClassSelector = normalizedSelectors.some((selector) => selector.includes("."));
    if (hasClassSelector) {
      enforceLayoutProperties(properties, normalizedSelectors, warnings, options);
    }

    for (const selector of normalizedSelectors) {
      if (/[>~+]/.test(selector) || /\s{1,}/.test(selector)) {
        warnings.push(`Unflattened selector remains: "${selector}"`);
      }
    }

    normalized.push({ selectors: normalizedSelectors, properties });
  }

  return normalized;
}

function normalizeSelector(selector: string, context: NormalizationContext): string | null {
  const trimmed = selector.trim();
  if (!trimmed) return null;

  const { base, pseudo } = splitPseudo(trimmed);
  const baseLower = base.toLowerCase();

  // Check if this is a pure element selector that maps to a class
  if (ELEMENT_TO_CLASS_MAP[baseLower] && !base.includes(".") && !base.includes(" ")) {
    if (baseLower === "body") {
      context.needsBodyWrapper = true;
    }
    return `.${ELEMENT_TO_CLASS_MAP[baseLower]}${pseudo}`;
  }

  // body with additional classes: body.dark-mode -> .wf-body.dark-mode
  const bodyClassMatch = base.match(/^body((?:\.[\w-]+)+)$/);
  if (bodyClassMatch) {
    context.needsBodyWrapper = true;
    const classPart = bodyClassMatch[1];
    classPart.split(".").filter(Boolean).forEach((name) => context.bodyExtraClasses.add(name));
    return `.${ELEMENT_TO_CLASS_MAP["body"]}${classPart}${pseudo}`;
  }

  // h1.custom-class -> .custom-class (keep the class, drop the element)
  const headingClassMatch = base.match(/^(h[1-6])((?:\.[\w-]+)+)$/);
  if (headingClassMatch) {
    return `${headingClassMatch[2]}${pseudo}`;
  }

  // p.custom-class -> .custom-class (keep the class, drop the element)
  const paragraphClassMatch = base.match(/^p((?:\.[\w-]+)+)$/);
  if (paragraphClassMatch) {
    return `${paragraphClassMatch[1]}${pseudo}`;
  }

  // Descendant selectors: .parent .child -> .parent-child (flatten + inject class on child)
  const descendantClassMatch = base.match(/\.([a-zA-Z_-][\w-]*)\s*(>|\s)\s*\.([a-zA-Z_-][\w-]*)$/);
  if (descendantClassMatch) {
    const parentClass = descendantClassMatch[1];
    const combinator = descendantClassMatch[2] === ">" ? ">" : " ";
    const childClass = descendantClassMatch[3];
    const className = deriveDescendantClassName(parentClass, childClass);
    context.descendantMappings.push({
      parentClass,
      target: childClass,
      targetType: "class",
      className,
      combinator,
    });
    return `.${className}${pseudo}`;
  }

  // Descendant selectors: .parent h1 -> .parent-h1 (flatten to single class)
  const descendantMatch = base.match(/\.([a-zA-Z_-][\w-]*)\s*(>|\s)\s*([a-zA-Z][\w-]*)$/);
  if (descendantMatch) {
    const parentClass = descendantMatch[1];
    const combinator = descendantMatch[2] === ">" ? ">" : " ";
    const tag = descendantMatch[3].toLowerCase();
    const className = deriveDescendantClassName(parentClass, tag);
    context.descendantMappings.push({
      parentClass,
      target: tag,
      targetType: "tag",
      className,
      combinator,
    });
    return `.${className}${pseudo}`;
  }

  return trimmed;
}

function splitSelectors(selectorText: string): string[] {
  return selectorText
    .split(",")
    .map((selector) => selector.trim())
    .filter(Boolean);
}

function splitPseudo(selector: string): { base: string; pseudo: string } {
  const pseudoMatch = selector.match(/(:{1,2}[\w-]+(?:\([^)]*\))?)$/);
  if (!pseudoMatch) return { base: selector, pseudo: "" };
  const pseudo = pseudoMatch[1];
  const base = selector.slice(0, -pseudo.length);
  return { base: base.trim(), pseudo };
}

function deriveDescendantClassName(parentClass: string, target: string): string {
  if (target === "a") {
    if (parentClass.endsWith("links")) return parentClass.replace(/links$/, "link");
    if (parentClass.endsWith("link")) return parentClass;
    if (parentClass.endsWith("s")) return `${parentClass.slice(0, -1)}-link`;
    return `${parentClass}-link`;
  }
  return `${parentClass}-${target}`;
}

function parseProperties(propertiesStr: string): Map<string, string> {
  const result = new Map<string, string>();
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
    const rawName = prop.substring(0, colonIndex).trim();
    const name = rawName.startsWith("--") ? rawName : rawName.toLowerCase();
    const value = prop.substring(colonIndex + 1).trim();
    if (!name) continue;
    result.set(name, value);
  }

  return result;
}

function serializeProperties(properties: Map<string, string>): string {
  return Array.from(properties.entries())
    .map(([name, value]) => `${name}: ${value};`)
    .join(" ");
}

function enforceLayoutProperties(
  properties: Map<string, string>,
  selectors: string[],
  warnings: string[],
  options: NormalizationOptions
): void {
  const display = properties.get("display");
  const hasGap = properties.has("gap") || properties.has("row-gap") || properties.has("column-gap");
  const hasFlexHints = ["flex-direction", "justify-content", "align-items"].some((prop) => properties.has(prop));
  const hasGridHints = ["grid-template-columns", "grid-template-rows"].some((prop) => properties.has(prop));

  let layoutType: "flex" | "grid" | null = null;
  if (display === "flex" || display === "inline-flex") layoutType = "flex";
  else if (display === "grid" || display === "inline-grid") layoutType = "grid";
  else if (hasGridHints) layoutType = "grid";
  else if (hasFlexHints) layoutType = "flex";
  else if (hasGap) layoutType = "flex";

  if (!layoutType) return;

  const missing: Array<{ prop: string; value: string }> = [];

  if (layoutType === "flex") {
    if (!properties.has("display")) missing.push({ prop: "display", value: "flex" });
    if (!properties.has("flex-direction")) missing.push({ prop: "flex-direction", value: "row" });
    if (!properties.has("justify-content")) missing.push({ prop: "justify-content", value: "flex-start" });
    if (!properties.has("align-items")) missing.push({ prop: "align-items", value: "stretch" });
  }

  if (layoutType === "grid") {
    if (!properties.has("display")) missing.push({ prop: "display", value: "grid" });
    if (!properties.has("grid-template-columns")) missing.push({ prop: "grid-template-columns", value: "1fr" });
  }

  if (missing.length === 0) return;

  const selectorList = selectors.join(", ");
  for (const item of missing) {
    properties.set(item.prop, item.value);
    warnings.push(`Layout property missing on "${selectorList}": ${item.prop} → injected "${item.value}"`);
  }

  if (options.strictLayout) {
    throw new Error(`Missing layout properties on "${selectorList}".`);
  }
}

function normalizeHtml(
  html: string,
  context: NormalizationContext,
  warnings: string[]
): HtmlNormalizationResult {
  if (typeof DOMParser !== "undefined") {
    return normalizeHtmlWithDomParser(html, context, warnings);
  }

  return normalizeHtmlWithFallback(html, context, warnings);
}

function normalizeHtmlWithDomParser(
  html: string,
  context: NormalizationContext,
  warnings: string[]
): HtmlNormalizationResult {
  const requiredTypographyClasses = new Set<string>();
  let hasBtnClass = false;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div data-wf-root="true">${html}</div>`, "text/html");
  const wrapper = doc.body.firstElementChild as HTMLElement | null;

  if (!wrapper) {
    warnings.push("Failed to parse HTML for normalization.");
    return { html, requiredTypographyClasses, hasBtnClass };
  }

  let bodyTarget: HTMLElement | null = wrapper;
  const elementChildren = Array.from(wrapper.children);
  if (context.needsBodyWrapper && elementChildren.length === 1 && elementChildren[0].classList.contains("wf-body")) {
    bodyTarget = elementChildren[0] as HTMLElement;
  }

  if (context.needsBodyWrapper) {
    bodyTarget.classList.add("wf-body");
    context.bodyExtraClasses.forEach((name) => bodyTarget.classList.add(name));
  }

  for (const mapping of context.descendantMappings) {
    const targetSelector =
      mapping.targetType === "class" ? `.${mapping.target}` : mapping.target;
    const selector = mapping.combinator === ">"
      ? `.${mapping.parentClass} > ${targetSelector}`
      : `.${mapping.parentClass} ${targetSelector}`;
    wrapper.querySelectorAll(selector).forEach((el) => {
      const element = el as HTMLElement;
      element.classList.add(mapping.className);
    });
  }

  for (const tag of HEADING_TAGS) {
    wrapper.querySelectorAll(tag).forEach((el) => {
      const element = el as HTMLElement;
      const headingClasses = Array.from(element.classList).filter((name) => name.startsWith("heading-"));
      if (headingClasses.length === 0) {
        const injected = `heading-${tag}`;
        element.classList.add(injected);
        requiredTypographyClasses.add(injected);
      } else {
        headingClasses.forEach((name) => requiredTypographyClasses.add(name));
      }
      if (element.classList.contains("btn")) hasBtnClass = true;
    });
  }

  wrapper.querySelectorAll("p").forEach((el) => {
    const element = el as HTMLElement;
    const textClasses = Array.from(element.classList).filter((name) => name.startsWith("text-"));
    if (textClasses.length === 0) {
      element.classList.add("text-body");
      requiredTypographyClasses.add("text-body");
    } else {
      textClasses.forEach((name) => requiredTypographyClasses.add(name));
    }
    if (element.classList.contains("btn")) hasBtnClass = true;
  });

  wrapper.querySelectorAll(".btn").forEach(() => {
    hasBtnClass = true;
  });

  wrapper.removeAttribute("data-wf-root");
  const htmlOutput = context.needsBodyWrapper && bodyTarget === wrapper ? wrapper.outerHTML : wrapper.innerHTML;

  return { html: htmlOutput, requiredTypographyClasses, hasBtnClass };
}

export interface ParsedElement {
  tag: string;
  id?: string;
  classes: string[];
  attributes: Record<string, string>;
  children: (ParsedElement | string)[];
}

export function normalizeHtmlWithFallback(
  html: string,
  context: NormalizationContext,
  warnings: string[]
): HtmlNormalizationResult {
  const requiredTypographyClasses = new Set<string>();
  let hasBtnClass = false;

  const wrapped = `<div data-wf-root="true">${html}</div>`;
  const parsed = parseHtmlString(wrapped);
  if (!parsed) {
    warnings.push("Failed to parse HTML for normalization.");
    return { html, requiredTypographyClasses, hasBtnClass };
  }

  let bodyTarget: ParsedElement | null = parsed;
  const elementChildren = parsed.children.filter((child): child is ParsedElement => typeof child !== "string");
  if (context.needsBodyWrapper && elementChildren.length === 1 && elementChildren[0].classes.includes("wf-body")) {
    bodyTarget = elementChildren[0];
  }

  if (context.needsBodyWrapper && bodyTarget) {
    if (!bodyTarget.classes.includes("wf-body")) bodyTarget.classes.push("wf-body");
    context.bodyExtraClasses.forEach((name) => {
      if (!bodyTarget?.classes.includes(name)) bodyTarget?.classes.push(name);
    });
  }

  for (const mapping of context.descendantMappings) {
    applyDescendantMapping(parsed, mapping, () => {
      hasBtnClass = true;
    });
  }

  walkElements(parsed, (element) => {
    if (HEADING_TAGS.includes(element.tag)) {
      const headingClasses = element.classes.filter((name) => name.startsWith("heading-"));
      if (headingClasses.length === 0) {
        const injected = `heading-${element.tag}`;
        element.classes.push(injected);
        requiredTypographyClasses.add(injected);
      } else {
        headingClasses.forEach((name) => requiredTypographyClasses.add(name));
      }
    }

    if (element.tag === "p") {
      const textClasses = element.classes.filter((name) => name.startsWith("text-"));
      if (textClasses.length === 0) {
        element.classes.push("text-body");
        requiredTypographyClasses.add("text-body");
      } else {
        textClasses.forEach((name) => requiredTypographyClasses.add(name));
      }
    }

    if (element.classes.includes("btn")) {
      hasBtnClass = true;
    }
  });

  delete parsed.attributes["data-wf-root"];
  const htmlOutput = context.needsBodyWrapper && bodyTarget === parsed ? serializeElement(parsed) : serializeChildren(parsed.children);

  return { html: htmlOutput, requiredTypographyClasses, hasBtnClass };
}

function applyDescendantMapping(
  root: ParsedElement,
  mapping: DescendantMapping,
  onBtnDetected: () => void
): void {
  walkElements(root, (element) => {
    if (!element.classes.includes(mapping.parentClass)) return;

    const match = (child: ParsedElement): boolean => {
      if (mapping.targetType === "class") {
        return child.classes.includes(mapping.target);
      }
      return child.tag === mapping.target;
    };

    if (mapping.combinator === ">") {
      for (const child of element.children) {
        if (typeof child === "string") continue;
        if (match(child)) {
          if (!child.classes.includes(mapping.className)) child.classes.push(mapping.className);
          if (child.classes.includes("btn")) onBtnDetected();
        }
      }
    } else {
      walkElements(element, (child) => {
        if (child === element) return;
        if (!match(child)) return;
        if (!child.classes.includes(mapping.className)) child.classes.push(mapping.className);
        if (child.classes.includes("btn")) onBtnDetected();
      });
    }
  });
}

export function walkElements(root: ParsedElement, onElement: (element: ParsedElement) => void): void {
  onElement(root);
  for (const child of root.children) {
    if (typeof child === "string") continue;
    walkElements(child, onElement);
  }
}

export function parseHtmlString(html: string): ParsedElement | null {
  const trimmed = html.trim();
  if (!trimmed) return null;

  const tagMatch = trimmed.match(/^<(\w+)([^>]*)>/);
  if (!tagMatch) return null;

  const tag = tagMatch[1].toLowerCase();
  const attrString = tagMatch[2];

  const attributes: Record<string, string> = {};
  const attrRegex = /([^\s=]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let attrMatch;
  while ((attrMatch = attrRegex.exec(attrString)) !== null) {
    const name = attrMatch[1];
    const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
    attributes[name] = value;
  }

  const classes = attributes.class?.split(/\s+/).filter(Boolean) || [];
  const id = attributes.id;

  if (SELF_CLOSING_TAGS.has(tag) || attrString.endsWith("/")) {
    return { tag, id, classes, attributes, children: [] };
  }

  const closingTag = `</${tag}>`;
  const openingTagEnd = tagMatch[0].length;
  const closingIndex = trimmed.lastIndexOf(closingTag);
  if (closingIndex === -1) return null;

  const innerContent = trimmed.substring(openingTagEnd, closingIndex);
  const children = parseChildren(innerContent);

  return { tag, id, classes, attributes, children };
}

function parseChildren(content: string): (ParsedElement | string)[] {
  const children: (ParsedElement | string)[] = [];
  let remaining = content.trim();
  let textBuffer = "";

  while (remaining.length > 0) {
    const tagStart = remaining.indexOf("<");

    if (tagStart === -1) {
      textBuffer += remaining;
      break;
    }

    if (tagStart > 0) {
      textBuffer += remaining.substring(0, tagStart);
      remaining = remaining.substring(tagStart);
    }

    if (remaining.startsWith("<!--")) {
      const commentEnd = remaining.indexOf("-->");
      if (commentEnd !== -1) {
        remaining = remaining.substring(commentEnd + 3).trim();
        continue;
      }
    }

    const openTagMatch = remaining.match(/^<(\w+)([^>]*)>/);
    if (!openTagMatch) {
      textBuffer += remaining[0];
      remaining = remaining.substring(1);
      continue;
    }

    if (textBuffer.trim()) {
      children.push(textBuffer.trim());
      textBuffer = "";
    }

    const tagName = openTagMatch[1].toLowerCase();
    const fullOpenTag = openTagMatch[0];
    const attrString = openTagMatch[2];

    if (SELF_CLOSING_TAGS.has(tagName) || attrString.endsWith("/")) {
      const selfClosingHtml = fullOpenTag;
      const parsed = parseHtmlString(selfClosingHtml.replace(/\/$/, "") + `></${tagName}>`);
      if (parsed) children.push(parsed);
      remaining = remaining.substring(fullOpenTag.length).trim();
      continue;
    }

    const closingTag = `</${tagName}>`;
    let depth = 1;
    let searchPos = fullOpenTag.length;
    let foundClose = -1;

    while (depth > 0 && searchPos < remaining.length) {
      const nextOpen = remaining.indexOf(`<${tagName}`, searchPos);
      const nextClose = remaining.indexOf(closingTag, searchPos);

      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        searchPos = nextOpen + tagName.length + 1;
      } else {
        depth--;
        if (depth === 0) {
          foundClose = nextClose;
        } else {
          searchPos = nextClose + closingTag.length;
        }
      }
    }

    if (foundClose === -1) {
      remaining = remaining.substring(fullOpenTag.length).trim();
      continue;
    }

    const elementHtml = remaining.substring(0, foundClose + closingTag.length);
    const parsed = parseHtmlString(elementHtml);
    if (parsed) children.push(parsed);

    remaining = remaining.substring(foundClose + closingTag.length).trim();
  }

  if (textBuffer.trim()) {
    children.push(textBuffer.trim());
  }

  return children;
}

function serializeElement(element: ParsedElement): string {
  const attrs = { ...element.attributes };
  if (element.classes.length > 0) {
    attrs.class = element.classes.join(" ");
  } else {
    delete attrs.class;
  }

  const attrString = Object.entries(attrs)
    .filter(([name]) => name !== "class")
    .map(([name, value]) => `${name}="${value}"`)
    .concat(attrs.class ? [`class="${attrs.class}"`] : [])
    .join(" ");

  const openTag = attrString ? `<${element.tag} ${attrString}>` : `<${element.tag}>`;

  if (SELF_CLOSING_TAGS.has(element.tag)) {
    return openTag;
  }

  const childrenHtml = serializeChildren(element.children);
  return `${openTag}${childrenHtml}</${element.tag}>`;
}

function serializeChildren(children: (ParsedElement | string)[]): string {
  return children
    .map((child) => (typeof child === "string" ? child : serializeElement(child)))
    .join("");
}

function ensureTypographyFontRules(
  baseRules: NormalizedRule[],
  requiredTypographyClasses: Set<string>,
  hasBtnClass: boolean,
  defaultFontFamily: string | null,
  warnings: string[]
): void {
  const ruleIndex = new Map<string, NormalizedRule>();

  for (const rule of baseRules) {
    for (const selector of rule.selectors) {
      const classMatch = selector.match(/^\.(\w[\w-]*)$/);
      if (!classMatch) continue;
      ruleIndex.set(classMatch[1], rule);
    }
  }

  const required = new Set(requiredTypographyClasses);
  if (hasBtnClass || ruleIndex.has("btn")) required.add("btn");

  for (const className of required) {
    const rule = ruleIndex.get(className);
    if (rule) {
      if (!rule.properties.has("font-family")) {
        if (defaultFontFamily) {
          rule.properties.set("font-family", defaultFontFamily);
        } else {
          warnings.push(`Missing font-family for ".${className}" and no default font found.`);
        }
      }
    } else {
      if (defaultFontFamily) {
        baseRules.push({
          selectors: [`.${className}`],
          properties: new Map([["font-family", defaultFontFamily]]),
        });
      } else {
        warnings.push(`Missing font-family for ".${className}" and no default font found.`);
      }
    }
  }
}

function findDefaultFontFamily(css: string): string | null {
  const parsed = parseCssBlocks(css);
  let fallback: string | null = null;

  for (const rule of parsed.baseRules) {
    const selectors = splitSelectors(rule.selector);
    const properties = parseProperties(rule.properties);
    const fontFamily = properties.get("font-family");
    if (!fontFamily) continue;
    if (selectors.some((selector) => selector.trim() === "body" || selector.trim() === ".wf-body")) {
      return fontFamily;
    }
    if (!fallback) fallback = fontFamily;
  }

  return fallback;
}

function serializeCss(baseRules: NormalizedRule[], mediaBlocks: NormalizedMediaBlock[]): string {
  const baseOutput = baseRules.map((rule) => serializeRule(rule)).filter(Boolean);
  const mediaOutput = mediaBlocks
    .filter((block) => block.rules.length > 0)
    .map((block) => {
      const rules = block.rules.map((rule) => serializeRule(rule)).filter(Boolean).join("\n");
      return rules ? `@media ${block.query} {\n${rules}\n}` : "";
    })
    .filter(Boolean);

  return [...baseOutput, ...mediaOutput].join("\n\n");
}

function serializeRule(rule: NormalizedRule): string {
  const selectorText = rule.selectors.join(", ");
  const propertiesText = serializeProperties(rule.properties);
  if (!selectorText || !propertiesText) return "";
  return `${selectorText} { ${propertiesText} }`;
}

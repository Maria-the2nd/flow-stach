/**
 * Flowbridge semantic repair helpers (client-safe).
 */

import type { ClassIndex } from "./css-parser";
import type { Component, ComponentTree } from "./componentizer";
import { extractClassNames } from "./html-parser";

export interface FlowbridgeDomOutlineNode {
  nodeId: string;
  tag: string;
  classes: string[];
  id?: string;
  text?: string;
}

export interface FlowbridgeComponentSplit {
  componentId: string;
  name: string;
  rootNodeIds: string[];
}

export interface FlowbridgeSemanticPatchRequest {
  domOutline: FlowbridgeDomOutlineNode[];
  components: FlowbridgeComponentSplit[];
  warnings: string[];
  tokens: Record<string, string>;
  fullHtml: string;
  componentHtml: Array<{
    componentId: string;
    html: string;
  }>;
  componentFullHtml: Array<{
    componentId: string;
    html: string;
  }>;
}

export interface FlowbridgeSemanticPatchResponse {
  componentRenames: Array<{
    id: string;
    name: string;
  }>;
  htmlPatches: Array<{
    componentId: string;
    op: "replaceHtml";
    html: string;
  }>;
  cssPatches: Array<{
    op: "replaceFinalCss";
    css: string;
  }>;
  notes: string[];
}

export interface FlowbridgeSemanticPatchMeta {
  mode: "mock" | "live" | "fallback";
  model?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  outputSize?: number;
  reason?: string;
  /** True when mock mode was triggered by an error/fallback, not intentional testing */
  isFallback?: boolean;
}

export interface FlowbridgeSemanticPatchResult {
  patch: FlowbridgeSemanticPatchResponse | null;
  meta: FlowbridgeSemanticPatchMeta;
}

export interface ComponentSummary {
  textSnippets: string[];
  classHints: string[];
}

export function inferComponentName(summary: ComponentSummary): string {
  const text = (summary.textSnippets || []).join(" ").toLowerCase();
  const classes = (summary.classHints || []).join(" ").toLowerCase();

  if (classes.includes("nav") || classes.includes("nav-links")) return "Nav";
  if (classes.includes("hero")) return "Hero";
  if (classes.includes("pricing") || classes.includes("pricing-grid")) return "Pricing";
  if (classes.includes("footer") || text.includes("copyright")) return "Footer";
  if (
    classes.includes("bento") ||
    classes.includes("card-grid") ||
    text.includes("features") ||
    text.includes("make it yours")
  ) {
    return "Bento/Features";
  }
  if (text.includes("3 steps") || classes.includes("steps-grid") || text.includes("how it works")) {
    return "How it works";
  }
  if (text.includes("the problem") || classes.includes("problem-grid") || classes.includes("problem")) {
    return "Problem";
  }
  if (classes.includes("faq") || text.includes("questions")) return "FAQ";
  if (classes.includes("cta") || text.includes("get started")) return "CTA";

  return "Section";
}

export function applyDeterministicComponentNames(
  componentTree: ComponentTree
): { componentTree: ComponentTree; applied: number; warnings: string[] } {
  let applied = 0;
  const warnings: string[] = [];
  const usedNames = new Set<string>();

  componentTree.components.forEach((component) => {
    if (!isGenericComponentName(component.name)) {
      usedNames.add(component.name);
      return;
    }

    const summary = buildComponentSummary(component);
    const inferred = inferComponentName(summary);
    if (inferred === "Section") return;

    let finalName = inferred;
    let counter = 2;
    while (usedNames.has(finalName)) {
      finalName = `${inferred} ${counter}`;
      counter += 1;
    }

    component.name = finalName;
    usedNames.add(finalName);
    applied += 1;
  });

  if (applied === 0) {
    warnings.push("Deterministic naming did not update any components.");
  }

  return { componentTree, applied, warnings };
}

export const FLOWBRIDGE_LLM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["componentRenames", "htmlPatches", "cssPatches", "notes"],
  properties: {
    componentRenames: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
      },
    },
    htmlPatches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["componentId", "op", "html"],
        properties: {
          componentId: { type: "string" },
          op: { type: "string", enum: ["replaceHtml"] },
          html: { type: "string" },
        },
      },
    },
    cssPatches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["op", "css"],
        properties: {
          op: { type: "string", enum: ["replaceFinalCss"] },
          css: { type: "string" },
        },
      },
    },
    notes: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

interface DomElement {
  nodeId: string;
  tag: string;
  classes: string[];
  attributes: Record<string, string>;
  children: Array<DomElement | string>;
}

interface DomState {
  rootNodeIds: string[];
  rootOrder: string[];
  nodesById: Map<string, DomElement>;
  rootElement: DomElement;
}

interface ParsedElement {
  tag: string;
  classes: string[];
  attributes: Record<string, string>;
  children: Array<ParsedElement | string>;
}

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

export function buildSemanticPatchRequest(
  html: string,
  componentTree: ComponentTree,
  classIndex: ClassIndex,
  cssVariables: Map<string, string>
): {
  request: FlowbridgeSemanticPatchRequest;
  domState: DomState;
  componentRoots: Map<string, string[]>;
  warnings: string[];
} {
  const domState = parseHtmlToDomState(html);
  const componentRoots = mapComponentsToRoots(componentTree.components, domState);
  const warnings = classIndex.warnings.map((warning) => warning.message);

  const components: FlowbridgeComponentSplit[] = componentTree.components.map((component) => ({
    componentId: component.id,
    name: component.name,
    rootNodeIds: componentRoots.get(component.id) || [],
  }));

  const tokens: Record<string, string> = {};
  for (const [key, value] of cssVariables.entries()) {
    tokens[key] = value;
  }

  const domOutline = buildDomOutline(domState);
  const componentHtml = componentTree.components.map((component) => ({
    componentId: component.id,
    html: component.htmlContent,
  }));
  const componentFullHtml = componentTree.components.map((component) => {
    const rootIds = componentRoots.get(component.id) || [];
    const html = rootIds
      .map((nodeId) => {
        const node = domState.nodesById.get(nodeId);
        return node ? serializeDomElement(node) : "";
      })
      .filter(Boolean)
      .join("");
    return { componentId: component.id, html };
  });

  return {
    request: {
      domOutline,
      components,
      warnings,
      tokens,
      fullHtml: html,
      componentHtml,
      componentFullHtml,
    },
    domState,
    componentRoots,
    warnings,
  };
}

export function applySemanticPatchResponse(params: {
  componentTree: ComponentTree;
  patch: FlowbridgeSemanticPatchResponse;
}): {
  componentTree: ComponentTree;
  patchedHtml: string;
  applied: { renames: number; htmlPatches: number };
  warnings: string[];
} {
  const warnings: string[] = [];
  const applied = { renames: 0, htmlPatches: 0 };

  const componentMap = new Map<string, Component>();
  params.componentTree.components.forEach((component) => {
    componentMap.set(component.id, component);
  });

  for (const rename of params.patch.componentRenames) {
    const component = componentMap.get(rename.id);
    if (!component) {
      warnings.push(`Rename target not found: ${rename.id}`);
      continue;
    }
    component.name = rename.name;
    applied.renames += 1;
  }

  for (const htmlPatch of params.patch.htmlPatches) {
    const component = componentMap.get(htmlPatch.componentId);
    if (!component) {
      warnings.push(`HTML patch target not found: ${htmlPatch.componentId}`);
      continue;
    }
    if (htmlPatch.op !== "replaceHtml") {
      warnings.push(`Unsupported HTML patch op: ${htmlPatch.op}`);
      continue;
    }
    component.htmlContent = htmlPatch.html;
    component.classesUsed = extractClassNames(htmlPatch.html);
    component.primaryClass = extractPrimaryClass(htmlPatch.html);
    applied.htmlPatches += 1;
  }

  for (const component of params.componentTree.components) {
    if (!component.classesUsed?.length) {
      component.classesUsed = extractClassNames(component.htmlContent);
    }
    if (!component.primaryClass) {
      component.primaryClass = extractPrimaryClass(component.htmlContent);
    }
  }

  const patchedHtml = params.componentTree.rootOrder
    .map((id) => componentMap.get(id)?.htmlContent || "")
    .join("");

  if (warnings.length > 0) {
    params.componentTree.warnings = [...params.componentTree.warnings, ...warnings];
  }

  return {
    componentTree: params.componentTree,
    patchedHtml,
    applied,
    warnings,
  };
}

export function validateSemanticPatchResponse(
  value: unknown
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isPlainObject(value)) {
    return { ok: false, errors: ["Response is not an object"] };
  }

  const root = value as Record<string, unknown>;
  const requiredKeys = ["componentRenames", "htmlPatches", "cssPatches", "notes"];
  const rootKeys = new Set(requiredKeys);
  Object.keys(root).forEach((key) => {
    if (!rootKeys.has(key)) errors.push(`Unexpected key: ${key}`);
  });
  for (const key of requiredKeys) {
    if (!(key in root)) errors.push(`Missing key: ${key}`);
  }

  const checkString = (value: unknown, field: string): void => {
    if (typeof value !== "string") errors.push(`${field} must be string`);
  };

  const checkExactKeys = (value: Record<string, unknown>, allowed: string[], field: string): void => {
    const allowedSet = new Set(allowed);
    Object.keys(value).forEach((key) => {
      if (!allowedSet.has(key)) errors.push(`${field} has unexpected key: ${key}`);
    });
  };

  const componentRenames = root.componentRenames;
  if (!Array.isArray(componentRenames)) {
    errors.push("componentRenames must be array");
  } else {
    componentRenames.forEach((item, index) => {
      if (!isPlainObject(item)) {
        errors.push(`componentRenames[${index}] must be object`);
        return;
      }
      const entry = item as Record<string, unknown>;
      checkExactKeys(entry, ["id", "name"], `componentRenames[${index}]`);
      checkString(entry.id, `componentRenames[${index}].id`);
      checkString(entry.name, `componentRenames[${index}].name`);
    });
  }

  const htmlPatches = root.htmlPatches;
  if (!Array.isArray(htmlPatches)) {
    errors.push("htmlPatches must be array");
  } else {
    htmlPatches.forEach((item, index) => {
      if (!isPlainObject(item)) {
        errors.push(`htmlPatches[${index}] must be object`);
        return;
      }
      const entry = item as Record<string, unknown>;
      checkExactKeys(entry, ["componentId", "op", "html"], `htmlPatches[${index}]`);
      checkString(entry.componentId, `htmlPatches[${index}].componentId`);
      checkString(entry.op, `htmlPatches[${index}].op`);
      if (entry.op !== "replaceHtml") {
        errors.push(`htmlPatches[${index}].op must be replaceHtml`);
      }
      checkString(entry.html, `htmlPatches[${index}].html`);
    });
  }

  const cssPatches = root.cssPatches;
  if (!Array.isArray(cssPatches)) {
    errors.push("cssPatches must be array");
  } else {
    cssPatches.forEach((item, index) => {
      if (!isPlainObject(item)) {
        errors.push(`cssPatches[${index}] must be object`);
        return;
      }
      const entry = item as Record<string, unknown>;
      checkExactKeys(entry, ["op", "css"], `cssPatches[${index}]`);
      checkString(entry.op, `cssPatches[${index}].op`);
      if (entry.op !== "replaceFinalCss") {
        errors.push(`cssPatches[${index}].op must be replaceFinalCss`);
      }
      checkString(entry.css, `cssPatches[${index}].css`);
    });
  }

  const notes = root.notes;
  if (!Array.isArray(notes)) {
    errors.push("notes must be array");
  } else {
    notes.forEach((item, index) => {
      if (typeof item !== "string") {
        errors.push(`notes[${index}] must be string`);
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

function buildDomOutline(domState: DomState): FlowbridgeDomOutlineNode[] {
  const outline: FlowbridgeDomOutlineNode[] = [];
  const queue: DomElement[] = [...domState.rootElement.children].filter(isDomElement) as DomElement[];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) continue;
    const id = node.attributes.id;
    outline.push({
      nodeId: node.nodeId,
      tag: node.tag,
      classes: node.classes,
      id: id || undefined,
      text: getTextSnippet(node),
    });
    node.children.forEach((child) => {
      if (isDomElement(child)) queue.push(child);
    });
  }

  return outline;
}

function parseHtmlToDomState(html: string): DomState {
  const wrapped = `<div data-flowbridge-root="true">${html}</div>`;
  const parsed = parseHtmlFragment(wrapped);
  const rootElement = parsed;
  if (!rootElement) {
    throw new Error("Failed to parse HTML for semantic repair.");
  }

  const nodesById = new Map<string, DomElement>();
  let counter = 0;

  const assignIds = (node: DomElement) => {
    counter += 1;
    node.nodeId = `n${counter}`;
    nodesById.set(node.nodeId, node);
    node.children.forEach((child) => {
      if (isDomElement(child)) assignIds(child);
    });
  };

  assignIds(rootElement);

  const rootChildren = rootElement.children.filter(isDomElement) as DomElement[];
  const rootNodeIds = rootChildren.map((child) => child.nodeId);

  return {
    rootNodeIds,
    rootOrder: [...rootNodeIds],
    nodesById,
    rootElement,
  };
}

function mapComponentsToRoots(components: Component[], domState: DomState): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const topLevelNodes = domState.rootElement.children.filter(isDomElement) as DomElement[];
  const topLevelHtml = topLevelNodes.map((node) => ({
    nodeId: node.nodeId,
    html: normalizeHtmlForMatch(serializeDomElement(node)),
  }));
  const usedNodeIds = new Set<string>();

  for (const component of components) {
    const componentRoots: string[] = [];
    const componentFragments = parseHtmlFragment(`<div>${component.htmlContent}</div>`);
    const fragmentChildren = componentFragments
      ? componentFragments.children.filter(isDomElement)
      : [];

    for (const child of fragmentChildren) {
      const normalized = normalizeHtmlForMatch(serializeDomElement(child));
      const match = topLevelHtml.find((entry) => entry.html === normalized && !usedNodeIds.has(entry.nodeId));
      if (match) {
        componentRoots.push(match.nodeId);
        usedNodeIds.add(match.nodeId);
      }
    }

    if (componentRoots.length === 0) {
      const fallback = topLevelHtml.find((entry) => !usedNodeIds.has(entry.nodeId));
      if (fallback) {
        componentRoots.push(fallback.nodeId);
        usedNodeIds.add(fallback.nodeId);
      }
    }

    map.set(component.id, componentRoots);
  }

  return map;
}

function normalizeHtmlForMatch(html: string): string {
  return html.replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();
}

function parseHtmlFragment(html: string): DomElement | null {
  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const root = doc.body.firstElementChild as HTMLElement | null;
    if (!root) return null;
    return elementToDomElement(root);
  }

  const parsed = parseHtmlString(html);
  if (!parsed) return null;
  return parsedElementToDomElement(parsed);
}

function elementToDomElement(element: Element): DomElement {
  const tag = element.tagName.toLowerCase();
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    attributes[attr.name] = attr.value;
  }
  const classes = attributes.class ? attributes.class.split(/\s+/).filter(Boolean) : [];
  const children: Array<DomElement | string> = [];

  element.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      children.push(elementToDomElement(node as Element));
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text.trim()) children.push(text.trim());
    }
  });

  return {
    nodeId: "",
    tag,
    classes,
    attributes,
    children,
  };
}

function parsedElementToDomElement(element: ParsedElement): DomElement {
  return {
    nodeId: "",
    tag: element.tag,
    classes: element.classes,
    attributes: element.attributes,
    children: element.children.map((child) =>
      typeof child === "string" ? child : parsedElementToDomElement(child)
    ),
  };
}

function parseHtmlString(html: string): ParsedElement | null {
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

  if (SELF_CLOSING_TAGS.has(tag) || attrString.endsWith("/")) {
    return { tag, classes, attributes, children: [] };
  }

  const closingTag = `</${tag}>`;
  const openingTagEnd = tagMatch[0].length;
  const closingIndex = trimmed.lastIndexOf(closingTag);
  if (closingIndex === -1) return null;

  const innerContent = trimmed.substring(openingTagEnd, closingIndex);
  const children = parseChildren(innerContent);

  return { tag, classes, attributes, children };
}

function parseChildren(content: string): Array<ParsedElement | string> {
  const children: Array<ParsedElement | string> = [];
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
      const selfClosingHtml = fullOpenTag.replace(/\/$/, "") + `></${tagName}>`;
      const parsed = parseHtmlString(selfClosingHtml);
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

function serializeDomChildren(children: Array<DomElement | string>): string {
  return children
    .map((child) => (typeof child === "string" ? child : serializeDomElement(child)))
    .join("");
}

function serializeDomElement(element: DomElement): string {
  const attrs: Record<string, string> = { ...element.attributes };
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

  return `${openTag}${serializeDomChildren(element.children)}</${element.tag}>`;
}

function extractPrimaryClass(html: string): string {
  const match = html.match(/class="([^"]+)"/);
  if (!match) return "";
  return match[1].split(/\s+/)[0] || "";
}

function buildComponentSummary(component: Component): ComponentSummary {
  const textSnippets = extractTextSnippets(component.htmlContent);
  const classHints = component.classesUsed.length > 0 ? component.classesUsed : extractClassNames(component.htmlContent);

  return {
    textSnippets,
    classHints,
  };
}

function extractTextSnippets(html: string): string[] {
  const snippets: string[] = [];
  const headingRegex = /<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi;
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    const text = match[1].trim();
    if (text) snippets.push(text);
    if (snippets.length >= 3) break;
  }

  if (snippets.length < 2) {
    const paragraphRegex = /<p[^>]*>([^<]+)<\/p>/gi;
    while ((match = paragraphRegex.exec(html)) !== null) {
      const text = match[1].trim();
      if (text) snippets.push(text);
      if (snippets.length >= 3) break;
    }
  }

  return snippets;
}

function isGenericComponentName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return true;
  if (/^(section|block|article|main content|sidebar)\s*\d*$/i.test(name)) return true;
  if (/^(navigation|header|footer)\s*\d*$/i.test(name)) return true;
  return false;
}

function getTextSnippet(node: DomElement): string | undefined {
  const buffer: string[] = [];
  const walk = (child: DomElement | string) => {
    if (typeof child === "string") {
      buffer.push(child);
      return;
    }
    child.children.forEach((grand) => walk(grand));
  };
  node.children.forEach((child) => walk(child));
  const text = buffer.join(" ").replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  return text.length > 80 ? text.slice(0, 80) + "..." : text;
}

function isDomElement(child: DomElement | string): child is DomElement {
  return typeof child !== "string";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

// ============================================
// BEM CLASS NAMING SYSTEM
// ============================================

/**
 * BEM (Block__Element--Modifier) naming configuration
 */
export interface BEMClassRenamingOptions {
  /** Enable BEM class renaming */
  enabled: boolean;
  /** Namespace prefix (e.g., "fb-" becomes "fb-hero__heading") */
  namespace: string;
  /** Classes to preserve (whitelist) */
  preserveClasses: string[];
  /** Detect high-risk generic names that may collide with Webflow */
  detectHighRisk: boolean;
  /** Update JavaScript class references */
  updateJSReferences: boolean;
  /** Output format for class names */
  outputFormat: 'kebab-case' | 'camelCase' | 'PascalCase';
}

export const DEFAULT_BEM_OPTIONS: BEMClassRenamingOptions = {
  enabled: true,
  namespace: 'fb-',
  preserveClasses: [],
  detectHighRisk: true,
  updateJSReferences: true,
  outputFormat: 'kebab-case',
};

/**
 * BEM class mapping result
 */
export interface BEMClassMapping {
  original: string;
  bem: {
    block: string;
    element?: string;
    modifier?: string;
  };
  formatted: string;
  isHighRisk: boolean;
}

/**
 * Result of class renaming operation
 */
export interface ClassRenameResult {
  /** Map of original class name to new BEM class name */
  mapping: Map<string, string>;
  /** Classes detected as high-risk for Webflow collision */
  highRiskDetected: string[];
  /** Detailed mappings with BEM breakdown */
  detailedMappings: BEMClassMapping[];
  /** Human-readable report */
  report: string;
}

/**
 * Context for inferring element role in BEM naming
 */
export interface ElementContext {
  tagName: string;
  parentBlock?: string;
  textContent?: string;
  classList: string[];
  attributes: Record<string, string>;
  childTags?: string[];
}

// ============================================
// HIGH-RISK GENERIC NAME DETECTION
// ============================================

/**
 * Generic class names that commonly conflict with Webflow's built-in classes
 * or are too ambiguous for reliable styling
 */
const HIGH_RISK_GENERIC_NAMES = new Set([
  // Layout containers
  'container', 'wrapper', 'section', 'box', 'block', 'inner', 'outer',
  'content', 'main', 'aside', 'sidebar',
  // Structure
  'header', 'footer', 'nav', 'navbar', 'menu', 'navigation',
  // Grid/Flex
  'row', 'col', 'column', 'grid', 'flex', 'stack',
  // Common components
  'card', 'hero', 'cta', 'banner', 'modal', 'popup', 'dropdown',
  // Typography
  'title', 'heading', 'text', 'paragraph', 'label', 'caption', 'description',
  // Interactive
  'button', 'btn', 'link', 'input', 'field', 'form',
  // Media
  'image', 'img', 'icon', 'logo', 'video', 'media',
  // Lists
  'list', 'item', 'items',
  // States
  'active', 'visible', 'hidden', 'disabled', 'selected', 'current', 'open', 'closed',
  // Variants
  'primary', 'secondary', 'tertiary', 'success', 'error', 'warning', 'info',
  // Sizes
  'large', 'lg', 'small', 'sm', 'medium', 'md', 'tiny', 'xl', 'xs',
  // Colors (basic)
  'dark', 'light', 'white', 'black',
  // Position
  'left', 'right', 'top', 'bottom', 'center',
  // Animation
  'fade', 'slide', 'animate', 'transition',
]);

/** Webflow's reserved class prefix */
const WEBFLOW_RESERVED_PREFIX = 'w-';

/** Additional Webflow reserved classes */
const WEBFLOW_RESERVED_CLASSES = new Set([
  'w-layout-grid', 'w-layout-hflex', 'w-layout-vflex',
  'w-container', 'w-row', 'w-col', 'w-clearfix',
  'w-button', 'w-slider', 'w-slide', 'w-nav', 'w-nav-menu',
  'w-dropdown', 'w-dropdown-toggle', 'w-dropdown-list',
  'w-tab-menu', 'w-tab-link', 'w-tab-content', 'w-tab-pane',
  'w-form', 'w-input', 'w-select', 'w-checkbox', 'w-radio',
  'w-richtext', 'w-embed', 'w-video', 'w-background-video',
  'w-lightbox', 'w-lightbox-thumbnail', 'w-lightbox-group',
]);

/**
 * Check if a class name is high-risk for Webflow collisions
 */
export function isHighRiskClass(className: string): boolean {
  // Check Webflow reserved
  if (className.startsWith(WEBFLOW_RESERVED_PREFIX)) return true;
  if (WEBFLOW_RESERVED_CLASSES.has(className)) return true;

  // Normalize: remove dashes/underscores and lowercase
  const normalized = className.toLowerCase().replace(/[-_]/g, '');

  // Check against high-risk generics
  if (HIGH_RISK_GENERIC_NAMES.has(normalized)) return true;

  // Check if it's just a number or very short
  if (/^\d+$/.test(className)) return true;
  if (className.length <= 2) return true;

  return false;
}

/**
 * Detect all high-risk classes in a list
 */
export function detectHighRiskClasses(classes: string[]): string[] {
  return classes.filter(isHighRiskClass);
}

/**
 * Get the reason why a class is high-risk
 */
export function getHighRiskReason(className: string): string {
  if (className.startsWith(WEBFLOW_RESERVED_PREFIX)) {
    return 'Webflow reserved prefix (w-)';
  }
  if (WEBFLOW_RESERVED_CLASSES.has(className)) {
    return 'Webflow reserved class';
  }
  const normalized = className.toLowerCase().replace(/[-_]/g, '');
  if (HIGH_RISK_GENERIC_NAMES.has(normalized)) {
    return 'Generic name may conflict with Webflow or other components';
  }
  if (/^\d+$/.test(className)) {
    return 'Numeric-only class name';
  }
  if (className.length <= 2) {
    return 'Too short, ambiguous';
  }
  return 'Unknown risk';
}

// ============================================
// BEM FORMATTING
// ============================================

/**
 * Format a BEM class name
 * @param block - The block name (component)
 * @param element - Optional element name (part of component)
 * @param modifier - Optional modifier (variant/state)
 * @returns Formatted BEM class name
 */
export function formatBEM(block: string, element?: string, modifier?: string): string {
  // Sanitize and format block
  let result = sanitizeBEMPart(block);

  // Add element with double underscore
  if (element) {
    result += `__${sanitizeBEMPart(element)}`;
  }

  // Add modifier with double dash
  if (modifier) {
    result += `--${sanitizeBEMPart(modifier)}`;
  }

  return result;
}

/**
 * Sanitize a BEM part (remove invalid characters, convert to kebab-case)
 */
function sanitizeBEMPart(part: string): string {
  return part
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase to kebab
    .replace(/[^a-z0-9-]/g, '-') // Replace invalid chars
    .replace(/-+/g, '-') // Collapse multiple dashes
    .replace(/^-|-$/g, ''); // Trim leading/trailing dashes
}

/**
 * Parse an existing class name into potential BEM parts
 */
export function parseToBEMParts(className: string): {
  block: string;
  element?: string;
  modifier?: string;
} {
  // Already BEM format?
  const bemMatch = className.match(/^([a-z0-9-]+)(?:__([a-z0-9-]+))?(?:--([a-z0-9-]+))?$/i);
  if (bemMatch) {
    return {
      block: bemMatch[1],
      element: bemMatch[2],
      modifier: bemMatch[3],
    };
  }

  // Try to infer from common patterns
  const parts = className.split(/[-_]+/).filter(Boolean);
  if (parts.length === 1) {
    return { block: parts[0].toLowerCase() };
  }

  if (parts.length === 2) {
    // Check if second part is likely a modifier
    const modifierKeywords = ['active', 'disabled', 'selected', 'large', 'small', 'primary', 'secondary', 'dark', 'light'];
    if (modifierKeywords.includes(parts[1].toLowerCase())) {
      return { block: parts[0].toLowerCase(), modifier: parts[1].toLowerCase() };
    }
    // Otherwise treat as element
    return { block: parts[0].toLowerCase(), element: parts[1].toLowerCase() };
  }

  // Three or more parts: block, element, modifier
  return {
    block: parts[0].toLowerCase(),
    element: parts.slice(1, -1).join('-').toLowerCase() || undefined,
    modifier: parts[parts.length - 1].toLowerCase(),
  };
}

// ============================================
// ELEMENT ROLE INFERENCE
// ============================================

/** Map HTML tags to typical BEM element names */
const TAG_TO_ELEMENT: Record<string, string> = {
  'h1': 'heading',
  'h2': 'heading',
  'h3': 'subheading',
  'h4': 'subheading',
  'h5': 'label',
  'h6': 'label',
  'p': 'text',
  'a': 'link',
  'button': 'button',
  'img': 'image',
  'picture': 'image',
  'figure': 'figure',
  'figcaption': 'caption',
  'ul': 'list',
  'ol': 'list',
  'li': 'item',
  'input': 'input',
  'textarea': 'input',
  'select': 'select',
  'label': 'label',
  'form': 'form',
  'nav': 'nav',
  'span': 'text',
  'div': 'container',
  'section': 'section',
  'article': 'article',
  'header': 'header',
  'footer': 'footer',
  'aside': 'sidebar',
  'main': 'main',
  'video': 'video',
  'audio': 'audio',
  'svg': 'icon',
  'table': 'table',
  'thead': 'header',
  'tbody': 'body',
  'tr': 'row',
  'td': 'cell',
  'th': 'header-cell',
};

/** Size modifier keywords */
const SIZE_MODIFIERS: Array<[RegExp, string]> = [
  [/\b(large|lg|big)\b/i, 'large'],
  [/\b(small|sm|tiny)\b/i, 'small'],
  [/\b(medium|md)\b/i, 'medium'],
  [/\b(xl|extra-?large)\b/i, 'xl'],
  [/\b(xs|extra-?small)\b/i, 'xs'],
];

/** State modifier keywords */
const STATE_MODIFIERS: Array<[RegExp, string]> = [
  [/\b(active|current)\b/i, 'active'],
  [/\b(disabled)\b/i, 'disabled'],
  [/\b(selected)\b/i, 'selected'],
  [/\b(open)\b/i, 'open'],
  [/\b(closed)\b/i, 'closed'],
  [/\b(loading)\b/i, 'loading'],
  [/\b(error)\b/i, 'error'],
  [/\b(success)\b/i, 'success'],
  [/\b(hidden)\b/i, 'hidden'],
  [/\b(visible)\b/i, 'visible'],
];

/** Variant modifier keywords */
const VARIANT_MODIFIERS: Array<[RegExp, string]> = [
  [/\b(primary)\b/i, 'primary'],
  [/\b(secondary)\b/i, 'secondary'],
  [/\b(tertiary)\b/i, 'tertiary'],
  [/\b(dark)\b/i, 'dark'],
  [/\b(light)\b/i, 'light'],
  [/\b(outline|outlined)\b/i, 'outline'],
  [/\b(filled)\b/i, 'filled'],
  [/\b(ghost)\b/i, 'ghost'],
  [/\b(inverse|inverted)\b/i, 'inverse'],
];

/**
 * Infer BEM element and modifier from context
 */
export function inferElementRole(ctx: ElementContext): { element?: string; modifier?: string } {
  const { tagName, classList, textContent, attributes } = ctx;
  const classStr = classList.join(' ');

  // Infer element from tag
  let element = TAG_TO_ELEMENT[tagName.toLowerCase()];

  // Infer modifier from classes
  let modifier: string | undefined;

  // Check size modifiers
  for (const [pattern, mod] of SIZE_MODIFIERS) {
    if (pattern.test(classStr)) {
      modifier = mod;
      break;
    }
  }

  // Check state modifiers (override size)
  for (const [pattern, mod] of STATE_MODIFIERS) {
    if (pattern.test(classStr)) {
      modifier = mod;
      break;
    }
  }

  // Check variant modifiers (override state)
  for (const [pattern, mod] of VARIANT_MODIFIERS) {
    if (pattern.test(classStr)) {
      modifier = mod;
      break;
    }
  }

  // Refine element from text content
  if (textContent) {
    const text = textContent.toLowerCase();

    // CTA detection
    if (tagName === 'a' || tagName === 'button') {
      if (/learn more|read more|see more|view more/i.test(text)) element = 'cta';
      if (/sign up|register|subscribe|join/i.test(text)) element = 'cta';
      if (/get started|start now|try|begin/i.test(text)) element = 'cta';
      if (/buy|purchase|order|shop/i.test(text)) element = 'cta';
      if (/download|install/i.test(text)) element = 'download';
      if (/submit|send/i.test(text)) element = 'submit';
      if (/cancel|close|dismiss/i.test(text)) element = 'cancel';
    }

    // Logo detection
    if ((tagName === 'img' || tagName === 'svg') && /logo/i.test(text + (attributes.alt || '') + (attributes.class || ''))) {
      element = 'logo';
    }
  }

  // Check attributes for hints
  if (attributes.type) {
    const type = attributes.type.toLowerCase();
    if (type === 'submit') element = 'submit';
    if (type === 'reset') element = 'reset';
    if (type === 'search') element = 'search';
  }

  if (attributes.role) {
    const role = attributes.role.toLowerCase();
    if (role === 'navigation') element = 'nav';
    if (role === 'banner') element = 'header';
    if (role === 'contentinfo') element = 'footer';
    if (role === 'main') element = 'main';
    if (role === 'complementary') element = 'sidebar';
  }

  return { element, modifier };
}

// ============================================
// CLASS RENAMING ENGINE
// ============================================

/**
 * Generate BEM class renames for a set of elements
 */
export function generateBEMClassRenames(
  elements: ElementContext[],
  options: {
    namespace: string;
    blockName: string;
    preserveClasses?: string[];
    detectHighRisk?: boolean;
  }
): ClassRenameResult {
  const mapping = new Map<string, string>();
  const highRiskDetected: string[] = [];
  const detailedMappings: BEMClassMapping[] = [];
  const preserveSet = new Set(options.preserveClasses || []);

  // Track used names to avoid duplicates
  const usedNames = new Set<string>();

  // First pass: detect all high-risk classes
  if (options.detectHighRisk !== false) {
    for (const el of elements) {
      for (const originalClass of el.classList) {
        if (isHighRiskClass(originalClass) && !highRiskDetected.includes(originalClass)) {
          highRiskDetected.push(originalClass);
        }
      }
    }
  }

  // Second pass: generate renames
  for (const el of elements) {
    for (const originalClass of el.classList) {
      // Skip if already mapped or preserved
      if (mapping.has(originalClass)) continue;
      if (preserveSet.has(originalClass)) {
        mapping.set(originalClass, originalClass);
        continue;
      }

      // Infer BEM parts
      const { element, modifier } = inferElementRole(el);

      // Generate BEM name
      const bemName = formatBEM(
        `${options.namespace}${options.blockName}`,
        element,
        modifier
      );

      // Ensure uniqueness
      let counter = 2;
      let uniqueName = bemName;
      while (usedNames.has(uniqueName)) {
        uniqueName = `${bemName}-${counter}`;
        counter++;
      }
      usedNames.add(uniqueName);

      mapping.set(originalClass, uniqueName);
      detailedMappings.push({
        original: originalClass,
        bem: {
          block: `${options.namespace}${options.blockName}`,
          element,
          modifier,
        },
        formatted: uniqueName,
        isHighRisk: highRiskDetected.includes(originalClass),
      });
    }
  }

  const report = generateClassRenameReport(detailedMappings, highRiskDetected);

  return {
    mapping,
    highRiskDetected,
    detailedMappings,
    report,
  };
}

/**
 * Generate a human-readable report of class renames
 */
function generateClassRenameReport(
  mappings: BEMClassMapping[],
  highRisk: string[]
): string {
  const lines: string[] = [];

  lines.push('CLASS RENAMING REPORT');
  lines.push('═'.repeat(50));
  lines.push('');

  if (highRisk.length > 0) {
    lines.push('⚠️  HIGH-RISK GENERIC NAMES DETECTED:');
    lines.push('These class names may conflict with Webflow or other components:');
    lines.push('');
    for (const cls of highRisk) {
      const reason = getHighRiskReason(cls);
      lines.push(`   ⚠ ${cls}`);
      lines.push(`     └─ ${reason}`);
    }
    lines.push('');
    lines.push('─'.repeat(50));
    lines.push('');
  }

  lines.push('ORIGINAL CLASS → BEM CLASS');
  lines.push('─'.repeat(50));
  lines.push('');

  for (const m of mappings) {
    const arrow = m.isHighRisk ? '→ ⚠' : '→';
    const original = m.original.padEnd(30);
    lines.push(`${original} ${arrow} ${m.formatted}`);
    if (m.bem.element || m.bem.modifier) {
      const parts: string[] = [`block: ${m.bem.block}`];
      if (m.bem.element) parts.push(`element: ${m.bem.element}`);
      if (m.bem.modifier) parts.push(`modifier: ${m.bem.modifier}`);
      lines.push(`${''.padEnd(30)}   (${parts.join(', ')})`);
    }
  }

  lines.push('');
  lines.push('─'.repeat(50));
  lines.push(`Total: ${mappings.length} classes renamed`);
  if (highRisk.length > 0) {
    lines.push(`High-risk: ${highRisk.length} classes flagged`);
  }

  return lines.join('\n');
}

// ============================================
// JAVASCRIPT CLASS REFERENCE UPDATING
// ============================================

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Update JavaScript code to use renamed classes
 */
export function updateJSClassReferences(
  jsCode: string,
  mapping: Map<string, string>
): { updated: string; replacements: number } {
  let updated = jsCode;
  let replacements = 0;

  for (const [original, renamed] of mapping) {
    if (original === renamed) continue;

    const escapedOriginal = escapeRegex(original);

    // querySelector/querySelectorAll patterns: '.class-name'
    const selectorPattern = new RegExp(
      `(['"\`])\\.${escapedOriginal}(['"\`\\s,\\[\\]:>+~])`,
      'g'
    );
    updated = updated.replace(selectorPattern, (match, q1, after) => {
      replacements++;
      return `${q1}.${renamed}${after}`;
    });

    // classList.add/remove/toggle/contains patterns
    const classListPattern = new RegExp(
      `classList\\.(add|remove|toggle|contains)\\((['"\`])${escapedOriginal}\\2\\)`,
      'g'
    );
    updated = updated.replace(classListPattern, (match, method, quote) => {
      replacements++;
      return `classList.${method}(${quote}${renamed}${quote})`;
    });

    // className assignment: className = 'class-name'
    const classNameAssignPattern = new RegExp(
      `className\\s*=\\s*(['"\`])${escapedOriginal}\\1`,
      'g'
    );
    updated = updated.replace(classNameAssignPattern, (match, quote) => {
      replacements++;
      return `className = ${quote}${renamed}${quote}`;
    });

    // className concatenation: className + ' class-name'
    const classNameConcatPattern = new RegExp(
      `(['"\`])\\s*${escapedOriginal}\\s*\\1`,
      'g'
    );
    // Only replace if it looks like a class context
    updated = updated.replace(
      new RegExp(`(className|class|addClass|removeClass|hasClass)([^'"\`]*?)(['"\`])${escapedOriginal}\\3`, 'g'),
      (match, prefix, middle, quote) => {
        replacements++;
        return `${prefix}${middle}${quote}${renamed}${quote}`;
      }
    );

    // jQuery/Zepto: $('.class-name')
    const jQueryPattern = new RegExp(
      `\\$\\((['"\`])\\.${escapedOriginal}\\1\\)`,
      'g'
    );
    updated = updated.replace(jQueryPattern, (match, quote) => {
      replacements++;
      return `$(${quote}.${renamed}${quote})`;
    });

    // document.getElementsByClassName('class-name')
    const getByClassPattern = new RegExp(
      `getElementsByClassName\\((['"\`])${escapedOriginal}\\1\\)`,
      'g'
    );
    updated = updated.replace(getByClassPattern, (match, quote) => {
      replacements++;
      return `getElementsByClassName(${quote}${renamed}${quote})`;
    });
  }

  return { updated, replacements };
}

// ============================================
// HTML CLASS REFERENCE UPDATING
// ============================================

/**
 * Update HTML to use renamed classes
 */
export function updateHTMLClassReferences(
  html: string,
  mapping: Map<string, string>
): { updated: string; replacements: number } {
  let updated = html;
  let replacements = 0;

  // Replace class attributes
  updated = updated.replace(/class="([^"]+)"/g, (match, classStr) => {
    const classes = classStr.split(/\s+/);
    const newClasses = classes.map((cls: string) => {
      const renamed = mapping.get(cls);
      if (renamed && renamed !== cls) {
        replacements++;
        return renamed;
      }
      return cls;
    });
    return `class="${newClasses.join(' ')}"`;
  });

  // Also handle single-quoted class attributes
  updated = updated.replace(/class='([^']+)'/g, (match, classStr) => {
    const classes = classStr.split(/\s+/);
    const newClasses = classes.map((cls: string) => {
      const renamed = mapping.get(cls);
      if (renamed && renamed !== cls) {
        replacements++;
        return renamed;
      }
      return cls;
    });
    return `class='${newClasses.join(' ')}'`;
  });

  return { updated, replacements };
}

// ============================================
// CSS CLASS REFERENCE UPDATING
// ============================================

/**
 * Update CSS to use renamed classes
 */
export function updateCSSClassReferences(
  css: string,
  mapping: Map<string, string>
): { updated: string; replacements: number } {
  let updated = css;
  let replacements = 0;

  for (const [original, renamed] of mapping) {
    if (original === renamed) continue;

    const escapedOriginal = escapeRegex(original);

    // Match class selectors: .class-name
    // Be careful not to match partial class names
    const classPattern = new RegExp(
      `\\.${escapedOriginal}(?=[\\s,{\\[:>+~.]|$)`,
      'g'
    );

    updated = updated.replace(classPattern, () => {
      replacements++;
      return `.${renamed}`;
    });
  }

  return { updated, replacements };
}

// ============================================
// COMBINED RENAMING OPERATION
// ============================================

export interface FullRenameResult {
  mapping: Map<string, string>;
  highRiskDetected: string[];
  report: string;
  html: { updated: string; replacements: number };
  css: { updated: string; replacements: number };
  js: { updated: string; replacements: number };
}

/**
 * Perform a full class renaming operation across HTML, CSS, and JS
 */
export function performFullClassRename(
  html: string,
  css: string,
  js: string,
  options: BEMClassRenamingOptions & { blockName: string }
): FullRenameResult {
  // Extract all classes from HTML
  const classes = extractClassNames(html);

  // Build element contexts (simplified - just class list per element)
  const elements: ElementContext[] = [];
  const classPattern = /class="([^"]+)"/g;
  const tagPattern = /<(\w+)[^>]*class="([^"]+)"[^>]*>/g;

  let match;
  while ((match = tagPattern.exec(html)) !== null) {
    const tagName = match[1];
    const classStr = match[2];
    const classList = classStr.split(/\s+/).filter(Boolean);

    elements.push({
      tagName,
      classList,
      attributes: {},
    });
  }

  // Generate BEM renames
  const renameResult = generateBEMClassRenames(elements, {
    namespace: options.namespace,
    blockName: options.blockName,
    preserveClasses: options.preserveClasses,
    detectHighRisk: options.detectHighRisk,
  });

  // Update HTML
  const htmlResult = updateHTMLClassReferences(html, renameResult.mapping);

  // Update CSS
  const cssResult = updateCSSClassReferences(css, renameResult.mapping);

  // Update JS
  const jsResult = options.updateJSReferences
    ? updateJSClassReferences(js, renameResult.mapping)
    : { updated: js, replacements: 0 };

  return {
    mapping: renameResult.mapping,
    highRiskDetected: renameResult.highRiskDetected,
    report: renameResult.report,
    html: htmlResult,
    css: cssResult,
    js: jsResult,
  };
}

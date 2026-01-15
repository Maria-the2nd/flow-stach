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

/**
 * Componentizer Module
 * Splits clean HTML into semantic components for Webflow paste
 */

import { extractClassNames } from "./html-parser";

// ============================================
// TYPES
// ============================================

export type ComponentType = "nav" | "header" | "hero" | "section" | "footer" | "subcomponent" | "wrapper";

export interface Component {
  id: string;
  name: string;
  type: ComponentType;
  tagName: string;
  primaryClass: string;
  htmlContent: string;
  classesUsed: string[];
  assetsUsed: string[];
  jsHooks: string[];
  parentComponent?: string;
  children: string[];
  order: number;
}

export interface RepeatedSibling {
  pattern: string;
  count: number;
  shouldExtract: boolean;
  samples: string[];
}

export interface ComponentTree {
  components: Component[];
  rootOrder: string[];
  repeatedPatterns: RepeatedSibling[];
  warnings: string[];
}

export interface ComponentizeOptions {
  detectRepeatedSiblings?: boolean;
  minSiblingCount?: number;
  includeWrapper?: boolean;
  namingFn?: (tagName: string, className: string, index: number) => string;
}

// ============================================
// HELPERS
// ============================================

function findTagEnd(content: string, startIndex: number): number {
  let inDouble = false;
  let inSingle = false;
  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    if (char === '"' && !inSingle) inDouble = !inDouble;
    else if (char === "'" && !inDouble) inSingle = !inSingle;
    else if (char === '>' && !inDouble && !inSingle) return i;
  }
  return -1;
}

function getAttributeValue(tag: string, attr: string): string | null {
  const regex = new RegExp(`${attr}=(?:"([^"]*)"|'([^']*)'|([^>\\s]*))`, "i");
  const match = tag.match(regex);
  if (!match) return null;
  return match[1] || match[2] || match[3] || null;
}

function getPrimaryClass(classAttr: string | null): string {
  if (!classAttr) return "";
  return classAttr.split(/\s+/)[0] || "";
}

function extractElement(content: string, startIndex: number, tagName: string): string | null {
  const openingTagEnd = findTagEnd(content, startIndex);
  if (openingTagEnd === -1) return null;

  if (content[openingTagEnd - 1] === "/") {
    return content.substring(startIndex, openingTagEnd + 1);
  }

  let depth = 1;
  let pos = openingTagEnd + 1;
  const lowerTag = tagName.toLowerCase();

  while (depth > 0 && pos < content.length) {
    const nextOpen = content.substring(pos).search(new RegExp(`<${lowerTag}(?:\\s|>)`, "i"));
    const nextClose = content.substring(pos).search(new RegExp(`</${lowerTag}>`, "i"));

    if (nextClose === -1) return null;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = pos + nextOpen + lowerTag.length + 1;
    } else {
      depth--;
      if (depth === 0) {
        return content.substring(startIndex, pos + nextClose + `</${lowerTag}>`.length);
      }
      pos = pos + nextClose + `</${lowerTag}>`.length;
    }
  }

  return null;
}

interface ElementInfo {
  tagName: string;
  html: string;
  startIndex: number;
  className: string;
  classNames: string[];
  id: string;
  firstHeading: string;
}

function findTopLevelElements(html: string, tagNames: string[]): ElementInfo[] {
  const elements: ElementInfo[] = [];
  // Use boundary check instead of full tag match to handle attributes with > chars
  const tagPattern = new RegExp(`<(${tagNames.join("|")})\\b`, "gi");
  let match;

  while ((match = tagPattern.exec(html)) !== null) {
    const tagName = match[1].toLowerCase();
    const startIndex = match.index;

    const fullElement = extractElement(html, startIndex, tagName);
    if (fullElement) {
      // Find exact end of opening tag to verify attributes
      const openingTagEnd = findTagEnd(fullElement, 0);
      const openTag = fullElement.substring(0, openingTagEnd + 1);

      const classAttr = getAttributeValue(openTag, "class");
      const idAttr = getAttributeValue(openTag, "id");
      const classNames = classAttr ? classAttr.split(/\s+/).filter(Boolean) : [];

      // Try to find the first heading inside this element for naming
      const headingMatch = fullElement.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
      const firstHeading = headingMatch
        ? headingMatch[1]
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
        : "";

      elements.push({
        tagName,
        html: fullElement,
        startIndex,
        className: getPrimaryClass(classAttr),
        classNames,
        id: idAttr || "",
        firstHeading,
      });
      tagPattern.lastIndex = startIndex + fullElement.length;
    }
  }

  return elements.sort((a, b) => a.startIndex - b.startIndex);
}

function extractImageUrls(html: string): string[] {
  const urls: string[] = [];
  const imgRegex = /<img[^>]+src="([^"]+)"/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    if (!urls.includes(match[1])) urls.push(match[1]);
  }
  return urls;
}

function extractJsHooksFromHtml(html: string): string[] {
  const hooks: string[] = [];

  const dataAttrRegex = /\bdata-([a-zA-Z0-9-]+)(?:="[^"]*")?/g;
  let match;
  while ((match = dataAttrRegex.exec(html)) !== null) {
    const hookName = `data-${match[1]}`;
    if (!hooks.includes(hookName)) hooks.push(hookName);
  }

  const idRegex = /\bid="([^"]+)"/g;
  while ((match = idRegex.exec(html)) !== null) {
    const hookName = `#${match[1]}`;
    if (!hooks.includes(hookName)) hooks.push(hookName);
  }

  return hooks;
}

// ============================================
// COMPONENT DETECTION
// ============================================

const COMPONENT_CLASS_PATTERNS = [
  /^nav(igation)?(-|_|$)/i, /^header(-|_|$)/i, /^hero(-|_|$)/i,
  /^section(-|_|$)/i, /(-|_)section$/i, /^footer(-|_|$)/i,
  /^navbar(-|_|$)/i, /^w-nav(-|_|$)/i,
  /^cta(-|_|$)/i, /^banner(-|_|$)/i, /^features?(-|_|$)/i,
  /^pricing(-|_|$)/i, /^testimonial(-|_|$)/i, /^faq(-|_|$)/i,
];

function matchesComponentClassPattern(classNames: string[]): boolean {
  for (const cls of classNames) {
    for (const pattern of COMPONENT_CLASS_PATTERNS) {
      if (pattern.test(cls)) return true;
    }
  }
  return false;
}

function detectComponentType(args: {
  tagName: string;
  classNames: string[];
  id: string;
  html: string;
  order: number;
}): ComponentType {
  const lowerTag = args.tagName.toLowerCase();
  const classText = args.classNames.join(" ").toLowerCase();
  const lowerId = (args.id || "").toLowerCase();
  const lowerHtml = args.html.toLowerCase();

  // Debug logging for hero detection
  const hasHeroClass = classText.includes("hero");
  const hasHeroId = lowerId.includes("hero");
  const hasH1 = lowerHtml.includes("<h1");
  const isEarlyOrder = args.order <= 2;

  if (lowerTag === "nav") return "nav";
  if (lowerTag === "header") return "header";
  if (lowerTag === "footer") return "footer";

  // Hero detection with multiple fallbacks
  if (hasHeroClass || hasHeroId) {
    console.log(`[componentizer] Hero detected via class/id: ${args.classNames.join(", ")}`);
    return "hero";
  }
  if (/nav(igation)?/i.test(classText)) return "nav";
  if (classText.includes("header")) return "header";
  if (classText.includes("footer")) return "footer";

  // Fallback: early sections with H1 are likely hero
  if (isEarlyOrder && hasH1) {
    console.log(`[componentizer] Hero detected via early H1: order=${args.order}`);
    return "hero";
  }

  if (lowerTag === "section" || lowerTag === "article") return "section";
  if (lowerTag === "div" && /-section|section-/i.test(classText)) return "section";

  return "section";
}

function generateComponentName(
  tagName: string,
  className: string,
  index: number,
  id?: string,
  firstHeading?: string
): string {
  const normalizedHeading = (firstHeading || "").replace(/\s+/g, " ").trim();
  if (normalizedHeading) {
    const truncated =
      normalizedHeading.length > 48 ? normalizedHeading.substring(0, 48) + "..." : normalizedHeading;
    return truncated;
  }

  // Fallback: className > id > generic name
  const nameSource = className || id || "";
  if (nameSource) {
    let name = nameSource
      .replace(/-/g, " ")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    if (tagName.toLowerCase() === "section") {
      name = name.replace(/\s*Section$/i, "");
    }
    return name || `Section ${index}`;
  }

  const tagDisplayName: Record<string, string> = {
    nav: "Navigation", header: "Header", section: "Section",
    footer: "Footer", article: "Article", aside: "Sidebar",
    main: "Main Content", div: "Block",
  };

  return `${tagDisplayName[tagName.toLowerCase()] || "Section"} ${index}`;
}

function generateId(name: string, index: number): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return base || `component-${index}`;
}

// ============================================
// MAIN COMPONENTIZER
// ============================================

export function componentizeHtml(cleanHtml: string, options: ComponentizeOptions = {}): ComponentTree {
  void options;
  const components: Component[] = [];
  const rootOrder: string[] = [];
  const warnings: string[] = [];
  const repeatedPatterns: RepeatedSibling[] = [];
  const usedIds = new Set<string>();

  const ensureUniqueId = (baseId: string): string => {
    let id = baseId;
    let counter = 1;
    while (usedIds.has(id)) {
      id = `${baseId}-${counter}`;
      counter++;
    }
    usedIds.add(id);
    return id;
  };

  let bodyContent = cleanHtml;
  const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    bodyContent = bodyMatch[1].trim();
  }
  const unwrapped = unwrapWfBody(bodyContent);
  if (unwrapped !== bodyContent) {
    bodyContent = unwrapped;
  }

  const semanticElements = findTopLevelElements(bodyContent, [
    "nav",
    "header",
    "main",
    "section",
    "article",
    "aside",
    "footer",
  ]);

  const divElements = findTopLevelElements(bodyContent, ["div"]).filter((div) =>
    matchesComponentClassPattern(div.classNames)
  );

  const orderedCandidates = [...semanticElements, ...divElements].sort(
    (a, b) => a.startIndex - b.startIndex
  );

  const elementsToExtract: ElementInfo[] = [];
  let currentEnd = -1;
  for (const element of orderedCandidates) {
    if (element.startIndex < currentEnd) continue;
    elementsToExtract.push(element);
    currentEnd = element.startIndex + element.html.length;
  }

  let order = 1;
  for (const element of elementsToExtract) {
    const { tagName, html, className, id: elementId, firstHeading } = element;

    if (tagName === "main") {
      const mainChildren = findTopLevelElements(html, ["section", "article", "div"]);
      for (const child of mainChildren) {
        const hasComponentClass = child.tagName === "section" || child.tagName === "article" ||
          matchesComponentClassPattern(child.classNames);

        if (hasComponentClass) {
          const component = createComponent(
            child.tagName, child.html, child.className, child.classNames, order++, ensureUniqueId,
            child.id, child.firstHeading
          );
          console.log(`[componentizer] Extracted from <main>: ${component.name} (type: ${component.type})`);
          components.push(component);
          rootOrder.push(component.id);
        }
      }
      continue;
    }

    const component = createComponent(tagName, html, className, element.classNames, order++, ensureUniqueId, elementId, firstHeading);
    console.log(`[componentizer] Extracted component: ${component.name} (type: ${component.type}, tag: ${tagName}, class: ${className})`);
    components.push(component);
    rootOrder.push(component.id);
  }

  if (components.length === 0 && bodyContent.trim()) {
    warnings.push("No semantic sections detected. Treating entire content as single component.");
    const component = createComponent("div", bodyContent, "page-content", ["page-content"], 1, ensureUniqueId);
    component.type = "wrapper";
    components.push(component);
    rootOrder.push(component.id);
  }

  console.log(`[componentizer] Total components extracted: ${components.length}`);
  console.log(`[componentizer] Component types: ${components.map(c => `${c.name}:${c.type}`).join(", ")}`);

  return { components, rootOrder, repeatedPatterns, warnings };
}

function unwrapWfBody(html: string): string {
  const match = html.match(/^<div[^>]*class="[^"]*wf-body[^"]*"[^>]*>([\s\S]*)<\/div>\s*$/i);
  if (!match) return html;
  return match[1].trim();
}

function createComponent(
  tagName: string,
  html: string,
  className: string,
  classNames: string[],
  order: number,
  ensureUniqueId: (baseId: string) => string,
  elementId?: string,
  firstHeading?: string
): Component {
  const name = generateComponentName(tagName, className, order, elementId, firstHeading);
  const id = ensureUniqueId(generateId(name, order));
  const type = detectComponentType({
    tagName,
    classNames,
    id: elementId || "",
    html,
    order,
  });

  return {
    id, name, type, tagName, primaryClass: className,
    htmlContent: html.trim(),
    classesUsed: extractClassNames(html),
    assetsUsed: extractImageUrls(html),
    jsHooks: extractJsHooksFromHtml(html),
    children: [],
    order,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function getComponentsByType(tree: ComponentTree, type: ComponentType): Component[] {
  return tree.components.filter((c) => c.type === type);
}

export function getNavigation(tree: ComponentTree): Component | undefined {
  return tree.components.find((c) => c.type === "nav");
}

export function getHero(tree: ComponentTree): Component | undefined {
  return tree.components.find((c) => c.type === "hero");
}

export function getFooter(tree: ComponentTree): Component | undefined {
  return tree.components.find((c) => c.type === "footer");
}

export function getOrderedComponents(tree: ComponentTree): Component[] {
  return tree.rootOrder.map((id) => tree.components.find((c) => c.id === id)).filter((c): c is Component => c !== undefined);
}

export function getAllClassesUsed(tree: ComponentTree): string[] {
  const allClasses = new Set<string>();
  for (const component of tree.components) {
    for (const cls of component.classesUsed) {
      allClasses.add(cls);
    }
  }
  return Array.from(allClasses);
}

export function generateComponentSlug(component: Component, prefix?: string): string {
  const base = component.id;
  return prefix ? `${prefix}-${base}` : base;
}

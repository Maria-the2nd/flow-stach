/**
 * Webflow normalization pass.
 * Rewrites HTML + CSS into class-only selectors that Webflow can import cleanly.
 */

import { ELEMENT_TO_CLASS_MAP, parseCSS, type ClassIndex } from "./css-parser";
import { sanitizeGradientsForWebflow } from "./gradient-sanitizer";
import { decoupleGradientsFromTransforms } from "./gradient-transform-decoupler";
import { literalizeCssForWebflow } from "./webflow-literalizer";
import {
  convertNthChildToBem,
  applyNthChildModifiersToHtml,
  applyFirstLastChildModifiersToHtml,
  applyOddEvenModifiersToHtml,
  applyAnFormulaModifiersToHtml,
  applyAnPlusBModifiersToHtml,
  applyNthLastChildModifiersToHtml,
  removeConvertedNthChildRules,
  removeConvertedFirstLastChildRules,
  removeConvertedOddEvenRules,
  removeConvertedAnFormulaRules,
  removeConvertedAnPlusBRules,
  removeConvertedNthLastChildRules,
  logNthChildConversionReport,
  type NthChildHtmlInjection,
  type NthChildConversionReport,
  type FirstLastChildHtmlInjection,
  type OddEvenHtmlInjection,
  type AnFormulaHtmlInjection,
  type AnPlusBHtmlInjection,
  type NthLastChildHtmlInjection,
} from "./nth-child-converter";
import {
  detectFrameworks,
  sanitizeVoidElements,
  type FrameworkDetectionResult,
} from "./framework-detector";

export interface NormalizationOptions {
  /** Throw when layout-critical properties are missing (default: false). */
  strictLayout?: boolean;
}

export interface NormalizationResult {
  html: string;
  css: string;
  warnings: string[];
  classIndex?: ClassIndex;
  /** Report of nth-child to BEM conversions (if any) */
  nthChildReport?: NthChildConversionReport;
  /** Framework detection results (React, Tailwind, etc.) */
  frameworkDetection?: FrameworkDetectionResult;
  /** Body background CSS to add to embed (when body has max-width constraint) */
  bodyBackgroundEmbed?: string;
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
  /** nth-child modifiers to inject into HTML elements */
  nthChildInjections: NthChildHtmlInjection[];
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
 * Convert <br> tags inside headings to Webflow-safe format.
 * Webflow's React parser (error #137) rejects <br> tags in certain contexts.
 * We replace <br> tags inside h1-h6 with a styled span that creates a line break.
 */
function normalizeBrTagsInHeadings(html: string): string {
  // Match <br> or <br/> or <br /> inside heading tags (h1-h6)
  // This regex matches headings with their content, including nested tags
  const headingBrPattern = /<(h[1-6])([^>]*)>([\s\S]*?)<\/(h[1-6])>/gi;
  
  return html.replace(headingBrPattern, (match, openTag, attrs, content, closeTag) => {
    // Only process if open and close tags match
    if (openTag.toLowerCase() !== closeTag.toLowerCase()) {
      return match;
    }
    
    // Replace <br>, <br/>, or <br /> with a styled span that creates a line break
    // Using display: block to force a line break without using <br>
    const normalizedContent = content.replace(/<br\s*\/?>/gi, '<span style="display: block;"></span>');
    
    return `<${openTag}${attrs}>${normalizedContent}</${closeTag}>`;
  });
}

/**
 * Normalize HTML + CSS to class-only selectors and inject required classes.
 */
export function normalizeHtmlCssForWebflow(
  html: string,
  css: string,
  options: NormalizationOptions = {},
  preParsedClassIndex?: ClassIndex
): NormalizationResult {
  const warnings: string[] = [];
  const strictLayout = options.strictLayout === true;
  void preParsedClassIndex;
  const context: NormalizationContext = {
    needsBodyWrapper: false,
    bodyExtraClasses: new Set(),
    descendantMappings: [],
    nthChildInjections: [],
  };

  // ============================================
  // FRAMEWORK DETECTION (EARLY)
  // ============================================
  // Detect React, JSX, Tailwind, Vue, Angular, Svelte, Alpine.js patterns
  // This runs BEFORE conversion to catch incompatible content early
  const frameworkDetection = detectFrameworks(html);

  // Add framework warnings to the warnings array
  for (const issue of frameworkDetection.issues) {
    if (issue.severity === 'block') {
      warnings.push(`[BLOCKED] ${issue.message}${issue.suggestion ? ` - ${issue.suggestion}` : ''}`);
    } else if (issue.severity === 'warn') {
      warnings.push(`[WARNING] ${issue.message}${issue.suggestion ? ` - ${issue.suggestion}` : ''}`);
    }
  }

  // Sanitize void elements to prevent React error #137
  // This removes any invalid content from void elements like <br>, <hr>, etc.
  const voidSanitization = sanitizeVoidElements(html);
  if (voidSanitization.fixed.length > 0) {
    for (const fix of voidSanitization.fixed) {
      warnings.push(`[AUTO-FIX] ${fix}`);
    }
    html = voidSanitization.html;
  }

  // CRITICAL: Normalize self-closing tags FIRST before any parsing
  // This prevents React error #137 in Webflow's paste handler
  let normalizedHtml = normalizeSelfClosingTags(html);
  normalizedHtml = removeProblematicAttributes(normalizedHtml);
  // Convert <br> tags in headings to Webflow-safe format (prevents React error #137)
  normalizedHtml = normalizeBrTagsInHeadings(normalizedHtml);

  // Sanitize gradients for Webflow compatibility
  // This resolves CSS vars inside gradients and rounds percentages
  const gradientResult = sanitizeGradientsForWebflow(css);
  if (gradientResult.sanitizedCount > 0) {
    warnings.push(`Sanitized ${gradientResult.sanitizedCount} gradients for Webflow compatibility`);
  }
  warnings.push(...gradientResult.warnings);
  let sanitizedCss = gradientResult.css;

  // REORDERED: Literalize CSS variables BEFORE parsing
  // This ensures all CSS variables are resolved before we parse into ClassIndex
  const literalizedResult = literalizeCssForWebflow(sanitizedCss);
  warnings.push(...literalizedResult.warnings);
  sanitizedCss = literalizedResult.css;

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

  // Convert positional selectors (:nth-child(N), :first-child, :last-child, odd/even) to BEM modifier classes
  // This enables native Webflow support instead of requiring CSS embed
  const nthChildResult = convertNthChildToBem(sanitizedCss);
  let nthChildReport: NthChildConversionReport | undefined;

  if (nthChildResult.report.converted > 0) {
    logNthChildConversionReport(nthChildResult.report);
    nthChildReport = nthChildResult.report;

    // Apply nth-child modifiers to HTML (add modifier classes based on position)
    normalizedHtml = applyNthChildModifiersToHtml(normalizedHtml, nthChildResult.htmlInjections);

    // Apply first-child/last-child modifiers to HTML
    normalizedHtml = applyFirstLastChildModifiersToHtml(normalizedHtml, nthChildResult.firstLastInjections);

    // Apply odd/even modifiers to HTML
    normalizedHtml = applyOddEvenModifiersToHtml(normalizedHtml, nthChildResult.oddEvenInjections);

    // Apply an formula modifiers to HTML (every Nth element)
    normalizedHtml = applyAnFormulaModifiersToHtml(normalizedHtml, nthChildResult.anFormulaInjections);

    // Apply an+b formula modifiers to HTML (cyclic slot positions)
    normalizedHtml = applyAnPlusBModifiersToHtml(normalizedHtml, nthChildResult.anPlusBInjections);

    // Apply nth-last-child modifiers to HTML (from end positions)
    normalizedHtml = applyNthLastChildModifiersToHtml(normalizedHtml, nthChildResult.nthLastChildInjections);

    // Remove converted nth-child rules from CSS (they're now BEM classes)
    sanitizedCss = removeConvertedNthChildRules(sanitizedCss, nthChildResult.htmlInjections);

    // Remove converted first-child/last-child rules from CSS
    sanitizedCss = removeConvertedFirstLastChildRules(sanitizedCss, nthChildResult.firstLastInjections);

    // Remove converted odd/even rules from CSS
    sanitizedCss = removeConvertedOddEvenRules(sanitizedCss, nthChildResult.oddEvenInjections);

    // Remove converted an formula rules from CSS
    sanitizedCss = removeConvertedAnFormulaRules(sanitizedCss, nthChildResult.anFormulaInjections);

    // Remove converted an+b formula rules from CSS
    sanitizedCss = removeConvertedAnPlusBRules(sanitizedCss, nthChildResult.anPlusBInjections);

    // Remove converted nth-last-child rules from CSS
    sanitizedCss = removeConvertedNthLastChildRules(sanitizedCss, nthChildResult.nthLastChildInjections);

    // Add the converted BEM rules to CSS
    sanitizedCss = nthChildResult.convertedCss + '\n\n' + sanitizedCss;

    // Store injections in context for later HTML processing
    context.nthChildInjections = nthChildResult.htmlInjections;

    warnings.push(
      `Converted ${nthChildResult.report.converted} positional CSS rules to BEM modifier classes`
    );
  }

  // Continue with selector normalization (element → class)
  const defaultFontFamily = findDefaultFontFamily(sanitizedCss);
  const parsed = parseCssBlocks(sanitizedCss);

  const baseRules = normalizeRuleSet(parsed.baseRules, context, warnings);
  const mediaRules = parsed.mediaBlocks.map((block) => ({
    query: block.query,
    rules: normalizeRuleSet(block.rules, context, warnings),
  }));

  const htmlResult = normalizeHtml(normalizedHtml, context, warnings);
  ensureTypographyFontRules(
    baseRules,
    htmlResult.requiredTypographyClasses,
    htmlResult.hasBtnClass,
    defaultFontFamily,
    warnings
  );

  let normalizedCss = serializeCss(baseRules, mediaRules);

  const originalMinWidthBlocks =
    css.match(/@media\s*([^{]*min-width[^)]*\)[^{]*)\{([\s\S]*?)\}\s*/gi) || [];
  if (originalMinWidthBlocks.length > 0) {
    const missingBlocks = originalMinWidthBlocks.filter((block) => !normalizedCss.includes(block));
    if (missingBlocks.length > 0) {
      normalizedCss = [normalizedCss, ...missingBlocks].filter(Boolean).join("\n\n");
      warnings.push(
        `Preserved ${missingBlocks.length} mobile-first @media block(s) that were dropped during normalization.`
      );
    }
  }

  const finalParsed = parseCSS(normalizedCss);
  const classIndex = finalParsed.classIndex;
  warnings.push(...finalParsed.classIndex.warnings.map((w) => w.message));

  if (strictLayout) {
    const injectedDefaults = finalParsed.classIndex.warnings.filter((w) =>
      /missing explicit properties/i.test(w.message)
    );
    if (injectedDefaults.length > 0) {
      throw new Error(
        `Strict layout failed: ${injectedDefaults.length} layout containers required injected defaults.`
      );
    }
  }

  // Extract body background to embed when .wf-body has constraining layout (max-width)
  // This ensures background covers full viewport, not just the constrained container
  const bodyBackgroundResult = extractBodyBackgroundForEmbed(normalizedCss);
  if (bodyBackgroundResult.embedCss) {
    normalizedCss = bodyBackgroundResult.updatedCss;
    warnings.push(
      `Extracted body background to embed CSS for full-viewport coverage (body has max-width constraint)`
    );
  }

  return {
    html: htmlResult.html,
    css: normalizedCss,
    warnings,
    classIndex,
    nthChildReport,
    frameworkDetection,
    bodyBackgroundEmbed: bodyBackgroundResult.embedCss,
  };
}

function parseCssBlocks(css: string): { baseRules: RawRule[]; mediaBlocks: MediaBlock[] } {
  const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const mediaBlocks: MediaBlock[] = [];

  // Use proper brace matching to extract media blocks
  // (The simple regex /@media\s*([^{]+)\{([\s\S]*?)\}\s*\}/g fails for nested braces)
  const mediaStartRegex = /@media\s*([^{]+)\s*\{/g;
  const fullMatches: string[] = [];
  let match;

  while ((match = mediaStartRegex.exec(cleanCss)) !== null) {
    const query = match[1].trim();
    const openBraceIndex = match.index + match[0].length - 1;

    // Find the matching closing brace using brace counting
    let braceCount = 1;
    let i = openBraceIndex + 1;
    while (i < cleanCss.length && braceCount > 0) {
      if (cleanCss[i] === "{") braceCount++;
      else if (cleanCss[i] === "}") braceCount--;
      i++;
    }

    if (braceCount === 0) {
      const content = cleanCss.slice(openBraceIndex + 1, i - 1);
      const fullMatch = cleanCss.slice(match.index, i);
      fullMatches.push(fullMatch);
      const rules = parseRulesFromContent(content);
      mediaBlocks.push({ query, rules });
    }
  }

  // Remove all media blocks from CSS to get base rules
  let baseContent = cleanCss;
  for (const fullMatch of fullMatches) {
    baseContent = baseContent.replace(fullMatch, "");
  }
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
  warnings: string[]
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

    // Note: Layout property enforcement is now handled by enforceExplicitLayoutProperties
    // in css-parser.ts after ClassIndex is built, not during normalization

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

  // Descendant element selectors: .parent h2 -> .parent-h2 (MODIFIER class)
  // BEM COMBO CLASS APPROACH:
  // 1. Create modifier class for descendant selector styles (e.g., .section-header-h2)
  // 2. Base typography class (heading-h2) is added separately to ALL headings
  // 3. Result: <h2 class="heading-h2 section-header-h2"> (BOTH classes)
  //
  // This follows Webflow's BEM pattern:
  // - Base class has typography (Fredoka, uppercase)
  // - Modifier class has context-specific styles (margin-bottom)
  // - No style conflicts because each context has its own modifier
  const descendantElementMatch = base.match(/\.([a-zA-Z_-][\w-]*)\s+(h[1-6]|p|a|ul|ol|li|blockquote|section|nav|header|footer|main|article|aside)$/);
  if (descendantElementMatch) {
    const parentClass = descendantElementMatch[1];
    const element = descendantElementMatch[2];
    // Create MODIFIER class for descendant styles
    // Base typography class is added separately, so element gets BOTH
    const isComboClassElement = element === "a" || element === "p" || /^h[1-6]$/.test(element) ||
      element === "ul" || element === "ol" || element === "li" || element === "blockquote";
    const className = isComboClassElement
      ? deriveDescendantClassName(parentClass, element)
      : ELEMENT_TO_CLASS_MAP[element] || `${parentClass}-${element}`;
    // Add to context for later HTML processing
    context.descendantMappings.push({
      parentClass,
      target: element,
      targetType: "tag",
      className,
      combinator: " ",
    });
    return `.${className}${pseudo}`;
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
  // Anchor tags: context-aware link naming
  if (target === "a") {
    if (parentClass.endsWith("links")) return parentClass.replace(/links$/, "link");
    if (parentClass.endsWith("link")) return parentClass;
    if (parentClass.endsWith("s")) return `${parentClass.slice(0, -1)}-link`;
    return `${parentClass}-link`;
  }
  // Paragraph tags: create MODIFIER class (not base class)
  // Base typography class will be added separately, giving element BOTH classes
  // This follows BEM combo class pattern: base class + modifier class
  if (target === "p") {
    return `${parentClass}-p`;
  }
  // Heading tags: create MODIFIER class (not base class)
  // Base typography class (heading-h1, heading-h2) will be added separately
  // Element gets BOTH: heading-h2 (typography) + section-header-h2 (modifier)
  if (/^h[1-6]$/.test(target)) {
    return `${parentClass}-${target}`;
  }
  // List elements: create MODIFIER class (not base class)
  // Base class (list-ul, list-ol, list-item) will be added separately
  // Element gets BOTH: list-ul (typography) + features-ul (modifier)
  if (target === "ul" || target === "ol" || target === "li") {
    return `${parentClass}-${target}`;
  }
  // Blockquote: create MODIFIER class (not base class)
  // Base class (blockquote) will be added separately
  if (target === "blockquote") {
    return `${parentClass}-blockquote`;
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

  // Auto-assign BEM classes to classless divs (prevents "Div Block" in Webflow Navigator)
  let assignedCount = 0;
  const usedClassNames = new Set<string>();

  // Track all existing class names
  wrapper.querySelectorAll("[class]").forEach((el) => {
    Array.from(el.classList).forEach((cls) => usedClassNames.add(cls));
  });

  /**
   * Generate a unique BEM class name for a classless div based on parent context.
   */
  function generateBemClassNameDOM(parent: Element | null): string {
    if (!parent || parent.classList.length === 0) {
      return generateUniqueClassNameDOM("auto-wrapper");
    }

    const parentBlock = parent.classList[0];
    const elementSuffixes = ["content", "wrapper", "inner", "container"];

    for (const suffix of elementSuffixes) {
      const className = `${parentBlock}__${suffix}`;
      if (!usedClassNames.has(className)) {
        usedClassNames.add(className);
        return className;
      }
    }

    return generateUniqueClassNameDOM(`${parentBlock}__content`);
  }

  function generateUniqueClassNameDOM(baseName: string): string {
    if (!usedClassNames.has(baseName)) {
      usedClassNames.add(baseName);
      return baseName;
    }

    for (let i = 1; i < 100; i++) {
      const className = `${baseName}-${i}`;
      if (!usedClassNames.has(className)) {
        usedClassNames.add(className);
        return className;
      }
    }

    const fallback = `${baseName}-${Date.now()}`;
    usedClassNames.add(fallback);
    return fallback;
  }

  // Find and assign classes to classless divs
  wrapper.querySelectorAll("div:not([class])").forEach((el) => {
    const div = el as HTMLElement;
    const parent = div.parentElement;
    const bemClass = generateBemClassNameDOM(parent);
    div.classList.add(bemClass);
    assignedCount++;
    warnings.push(
      `Auto-assigned class "${bemClass}" to classless div (parent: ${parent?.classList[0] || "root"})`
    );
  });

  if (assignedCount > 0) {
    warnings.push(`Auto-assigned ${assignedCount} BEM class(es) to classless div elements`);
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
      // BEM COMBO CLASS APPROACH:
      // ALWAYS add base typography class (heading-h1, heading-h2, etc.)
      // Element may also have modifier classes from descendant selectors
      // Result: <h2 class="heading-h2 section-header-h2"> (both classes)
      const baseClass = `heading-${tag}`;
      if (!element.classList.contains(baseClass)) {
        element.classList.add(baseClass);
      }
      requiredTypographyClasses.add(baseClass);
      if (element.classList.contains("btn")) hasBtnClass = true;
    });
  }

  // Inject wf-* classes on structural elements (section, nav, header, footer, etc.)
  // This preserves spacing from element selectors like `section { padding: 80px 0; }`
  const STRUCTURAL_TAGS = ["section", "nav", "header", "footer", "main", "article", "aside"];
  for (const structuralTag of STRUCTURAL_TAGS) {
    wrapper.querySelectorAll(structuralTag).forEach((el) => {
      const element = el as HTMLElement;
      const wfClass = ELEMENT_TO_CLASS_MAP[structuralTag];
      if (wfClass && !element.classList.contains(wfClass)) {
        element.classList.add(wfClass);
      }
    });
  }

  // BEM COMBO CLASS APPROACH for list elements:
  // ALWAYS add base class (list-ul, list-ol, list-item, blockquote)
  // Element may also have modifier classes from descendant selectors
  const LIST_ELEMENTS = [
    { tag: "ul", baseClass: "list-ul" },
    { tag: "ol", baseClass: "list-ol" },
    { tag: "li", baseClass: "list-item" },
    { tag: "blockquote", baseClass: "blockquote" },
  ];
  for (const { tag, baseClass } of LIST_ELEMENTS) {
    wrapper.querySelectorAll(tag).forEach((el) => {
      const element = el as HTMLElement;
      if (!element.classList.contains(baseClass)) {
        element.classList.add(baseClass);
      }
      requiredTypographyClasses.add(baseClass);
    });
  }

  wrapper.querySelectorAll("p").forEach((el) => {
    const element = el as HTMLElement;
    // BEM COMBO CLASS APPROACH:
    // ALWAYS add base typography class (text-body)
    // Element may also have modifier classes from descendant selectors
    // Result: <p class="text-body section-header-p"> (both classes)
    if (!element.classList.contains("text-body")) {
      element.classList.add("text-body");
    }
    requiredTypographyClasses.add("text-body");
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

  // Auto-assign BEM classes to classless divs (prevents "Div Block" in Webflow Navigator)
  const assignedCount = assignClassesToClasslessDivs(parsed, warnings);
  if (assignedCount > 0) {
    warnings.push(`Auto-assigned ${assignedCount} BEM class(es) to classless div elements`);
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

  // Structural elements that get wf-* classes for spacing preservation
  const STRUCTURAL_TAGS_SET = new Set(["section", "nav", "header", "footer", "main", "article", "aside"]);

  walkElements(parsed, (element) => {
    if (HEADING_TAGS.includes(element.tag)) {
      // BEM COMBO CLASS APPROACH:
      // ALWAYS add base typography class (heading-h1, heading-h2, etc.)
      // Element may also have modifier classes from descendant selectors
      // Result: heading gets both base + modifier classes
      const baseClass = `heading-${element.tag}`;
      if (!element.classes.includes(baseClass)) {
        element.classes.push(baseClass);
      }
      requiredTypographyClasses.add(baseClass);
    }

    // Inject wf-* classes on structural elements (section, nav, header, footer, etc.)
    if (STRUCTURAL_TAGS_SET.has(element.tag)) {
      const wfClass = ELEMENT_TO_CLASS_MAP[element.tag];
      if (wfClass && !element.classes.includes(wfClass)) {
        element.classes.push(wfClass);
      }
    }

    if (element.tag === "p") {
      // BEM COMBO CLASS APPROACH:
      // ALWAYS add base typography class (text-body)
      // Element may also have modifier classes from descendant selectors
      if (!element.classes.includes("text-body")) {
        element.classes.push("text-body");
      }
      requiredTypographyClasses.add("text-body");
    }

    // BEM COMBO CLASS APPROACH for list elements:
    // ALWAYS add base class (list-ul, list-ol, list-item, blockquote)
    // Element may also have modifier classes from descendant selectors
    const LIST_ELEMENT_MAP: Record<string, string> = {
      ul: "list-ul",
      ol: "list-ol",
      li: "list-item",
      blockquote: "blockquote",
    };
    if (LIST_ELEMENT_MAP[element.tag]) {
      const baseClass = LIST_ELEMENT_MAP[element.tag];
      if (!element.classes.includes(baseClass)) {
        element.classes.push(baseClass);
      }
      requiredTypographyClasses.add(baseClass);
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

/**
 * Auto-assign BEM classes to classless div elements based on parent context.
 * This prevents "Div Block" names in Webflow Navigator by giving all divs meaningful class names.
 *
 * Strategy:
 * - If parent has class `feature-card`, classless child div gets `feature-card__content`
 * - If parent has class `hero`, classless child div gets `hero__content`
 * - Generic fallback: `{parent-block}__wrapper`
 *
 * @param root The parsed HTML tree
 * @param warnings Array to collect warnings
 * @returns Number of classes assigned
 */
export function assignClassesToClasslessDivs(
  root: ParsedElement,
  warnings: string[]
): number {
  let assignedCount = 0;
  const usedClassNames = new Set<string>();

  // Track all existing class names to avoid collisions
  walkElements(root, (element) => {
    element.classes.forEach((cls) => usedClassNames.add(cls));
  });

  /**
   * Generate a unique BEM class name for a classless div based on parent context.
   */
  function generateBemClassName(
    parent: ParsedElement | null,
    siblingIndex: number
  ): string {
    // No parent context - use generic name
    if (!parent || parent.classes.length === 0) {
      return generateUniqueClassName("auto-wrapper", siblingIndex);
    }

    // Use parent's first class as BEM block
    const parentBlock = parent.classes[0];

    // Common BEM element patterns
    const elementSuffixes = ["content", "wrapper", "inner", "container"];

    // Try each suffix until we find an unused one
    for (const suffix of elementSuffixes) {
      const className = `${parentBlock}__${suffix}`;
      if (!usedClassNames.has(className)) {
        usedClassNames.add(className);
        return className;
      }
    }

    // All common suffixes taken - add numbered suffix
    return generateUniqueClassName(`${parentBlock}__content`, siblingIndex);
  }

  /**
   * Generate a unique class name by appending a number if needed.
   */
  function generateUniqueClassName(baseName: string, startIndex: number): string {
    if (!usedClassNames.has(baseName)) {
      usedClassNames.add(baseName);
      return baseName;
    }

    // Try numbered variants
    for (let i = startIndex + 1; i < startIndex + 100; i++) {
      const className = `${baseName}-${i}`;
      if (!usedClassNames.has(className)) {
        usedClassNames.add(className);
        return className;
      }
    }

    // Fallback with timestamp if somehow all 100 variants are taken
    const fallback = `${baseName}-${Date.now()}`;
    usedClassNames.add(fallback);
    return fallback;
  }

  /**
   * Recursively process elements and assign classes to classless divs.
   */
  function processWithParent(
    element: ParsedElement,
    parent: ParsedElement | null
  ): void {
    // If this is a classless div, assign a BEM class
    if (element.tag === "div" && element.classes.length === 0) {
      let siblingIndex = 0;
      if (parent) {
        // Find this element's position among sibling divs
        siblingIndex = parent.children.filter(
          (child): child is ParsedElement =>
            typeof child !== "string" && child.tag === "div"
        ).indexOf(element);
      }

      const bemClass = generateBemClassName(parent, siblingIndex);
      element.classes.push(bemClass);
      assignedCount++;

      warnings.push(
        `Auto-assigned class "${bemClass}" to classless div (parent: ${parent?.classes[0] || "root"})`
      );
    }

    // Recurse to children with current element as parent
    for (const child of element.children) {
      if (typeof child !== "string") {
        processWithParent(child, element);
      }
    }
  }

  // Start processing from root
  processWithParent(root, null);

  return assignedCount;
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
  // Track which classes have font-family defined in ANY rule
  const classesWithFont = new Set<string>();

  for (const rule of baseRules) {
    if (rule.properties.has("font-family")) {
      for (const selector of rule.selectors) {
        const classMatch = selector.match(/^\.(\w[\w-]*)$/);
        if (classMatch) {
          classesWithFont.add(classMatch[1]);
        }
      }
    }
  }

  const required = new Set(requiredTypographyClasses);
  if (hasBtnClass || classesWithFont.has("btn")) required.add("btn");

  // For classes that need font-family, only add if NO rule has it
  for (const className of required) {
    if (!classesWithFont.has(className)) {
      if (defaultFontFamily) {
        // Find an existing rule to add font-family to, or create a new one
        let foundRule = false;
        for (const rule of baseRules) {
          for (const selector of rule.selectors) {
            const classMatch = selector.match(/^\.(\w[\w-]*)$/);
            if (classMatch && classMatch[1] === className) {
              rule.properties.set("font-family", defaultFontFamily);
              foundRule = true;
              break;
            }
          }
          if (foundRule) break;
        }
        if (!foundRule) {
          baseRules.push({
            selectors: [`.${className}`],
            properties: new Map([["font-family", defaultFontFamily]]),
          });
        }
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

/**
 * Extract body background properties to embed CSS when .wf-body has constraining layout.
 *
 * Problem: In HTML, `body { background: #000; max-width: 1200px; }` fills the entire viewport
 * with background while constraining content. But in Webflow, .wf-body is a div, so background
 * only covers the constrained area, leaving white space on sides.
 *
 * Solution: Extract background properties to embed CSS targeting `body` element, which Webflow
 * applies to the actual page body (full viewport). Layout constraints stay on .wf-body div.
 */
function extractBodyBackgroundForEmbed(css: string): { updatedCss: string; embedCss: string | undefined } {
  // Background properties that should apply to full viewport
  const BACKGROUND_PROPS = [
    'background',
    'background-color',
    'background-image',
    'background-repeat',
    'background-position',
    'background-size',
    'background-attachment',
  ];

  // Layout constraints that indicate .wf-body is smaller than viewport
  const CONSTRAINT_PROPS = ['max-width', 'width'];

  // Find .wf-body rule
  const wfBodyMatch = css.match(/\.wf-body\s*\{([^}]+)\}/);
  if (!wfBodyMatch) {
    return { updatedCss: css, embedCss: undefined };
  }

  const propsStr = wfBodyMatch[1];
  const props = parsePropertiesForExtraction(propsStr);

  // Check if there's BOTH a background AND a constraint
  const hasBackground = BACKGROUND_PROPS.some(p => props.has(p));
  const hasConstraint = CONSTRAINT_PROPS.some(p => props.has(p));

  if (!hasBackground || !hasConstraint) {
    return { updatedCss: css, embedCss: undefined };
  }

  // Extract background properties for embed
  const backgroundProps: string[] = [];
  const remainingProps: string[] = [];

  for (const [name, value] of props) {
    if (BACKGROUND_PROPS.includes(name)) {
      backgroundProps.push(`${name}: ${value}`);
    } else {
      remainingProps.push(`${name}: ${value}`);
    }
  }

  if (backgroundProps.length === 0) {
    return { updatedCss: css, embedCss: undefined };
  }

  // Build embed CSS with body selector (applies to Webflow page body)
  const embedCss = `body { ${backgroundProps.join('; ')}; }`;

  // Update .wf-body rule to remove background properties
  const updatedWfBody = `.wf-body { ${remainingProps.join('; ')}; }`;
  const updatedCss = css.replace(wfBodyMatch[0], updatedWfBody);

  return { updatedCss, embedCss };
}

/**
 * Parse CSS properties string into a Map for extraction logic.
 */
function parsePropertiesForExtraction(propsStr: string): Map<string, string> {
  const result = new Map<string, string>();
  const propRegex = /([\w-]+)\s*:\s*([^;]+)/g;
  let match;

  while ((match = propRegex.exec(propsStr)) !== null) {
    const name = match[1].trim().toLowerCase();
    const value = match[2].trim();
    result.set(name, value);
  }

  return result;
}

function serializeRule(rule: NormalizedRule): string {
  const selectorText = rule.selectors.join(", ");
  const propertiesText = serializeProperties(rule.properties);
  if (!selectorText || !propertiesText) return "";
  return `${selectorText} { ${propertiesText} }`;
}

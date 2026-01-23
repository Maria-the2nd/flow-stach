/**
 * Webflow Conversion Verification CLI
 * Verifies fidelity between original HTML+CSS and generated Webflow payload
 */

import { parseCSS, ClassIndex } from "./css-parser";
import { NormalizationResult, parseHtmlString, ParsedElement } from "./webflow-normalizer";
import { WebflowPayload } from "./webflow-converter";
import {
  runPreflightValidation,
  validateUUIDs,
  validateNodeReferences,
  detectCircularReferences,
  validateStyles,
  validateEmbedSize,
  validateNodeStructure,
  type PreflightResult,
  type UUIDValidation,
  type OrphanValidation,
  type CircularValidation,
  type StyleValidation,
} from "./preflight-validator";

// ============================================
// TYPES
// ============================================

export interface VerificationResult {
  phase: string;
  status: "PASS" | "WARN" | "FAIL";
  issues: string[];
  details: string[];
}

export interface VerificationReport {
  overallStatus: "PASS" | "WARN" | "FAIL";
  criticalFailures: string[];
  warnings: string[];
  recommendations: string[];
  pasteSafety: Record<string, "SAFE" | "REVIEW" | "DO NOT PASTE">;
  phases: VerificationResult[];
  componentFidelity: Record<string, number>; // component name -> fidelity score (0-100)
}

export interface OriginalAnalysis {
  html: string;
  css: string;
  elementSelectors: string[];
  descendantSelectors: string[];
  mediaQueries: Array<{ query: string; selectors: string[] }>;
  typographyElements: Array<{ tag: string; classes: string[]; hasFontClass: boolean }>;
  layoutContainers: Array<{ selector: string; display: string; properties: Record<string, string> }>;
  interactiveElements: Array<{ tag: string; href?: string; classes: string[] }>;
  tokens: Map<string, string>;
}

// ============================================
// ORIGINAL ANALYSIS
// ============================================

export function analyzeOriginal(html: string, css: string): OriginalAnalysis {
  const elementSelectors: string[] = [];
  const descendantSelectors: string[] = [];
  const mediaQueries: Array<{ query: string; selectors: string[] }> = [];
  const typographyElements: Array<{ tag: string; classes: string[]; hasFontClass: boolean }> = [];
  const layoutContainers: Array<{ selector: string; display: string; properties: Record<string, string> }> = [];
  const interactiveElements: Array<{ tag: string; href?: string; classes: string[] }> = [];
  const tokens = new Map<string, string>();

  // Parse CSS for selectors and properties
  const cssRules = parseCssRules(css);

  for (const rule of cssRules.baseRules) {
    const selectors = rule.selector.split(",").map(s => s.trim());

    for (const selector of selectors) {
      // Check for element selectors
      if (/^(body|html|h[1-6]|p|a|li|button|div|span|section|header|footer|nav|main|article|aside)$/i.test(selector)) {
        elementSelectors.push(selector);
      }

      // Check for descendant selectors
      if (selector.includes(" ")) {
        descendantSelectors.push(selector);
      }

      // Check for layout containers
      if (rule.properties.display && ["flex", "grid", "inline-flex", "inline-grid"].includes(rule.properties.display)) {
        layoutContainers.push({
          selector,
          display: rule.properties.display,
          properties: rule.properties
        });
      }
    }
  }

  // Parse media queries
  for (const mq of cssRules.mediaRules) {
    mediaQueries.push({
      query: mq.query,
      selectors: mq.rules.map(r => r.selector)
    });
  }

  // Extract CSS variables
  const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = varRegex.exec(css)) !== null) {
    tokens.set(`--${match[1]}`, match[2].trim());
  }

  // Analyze HTML for typography and interactive elements
  const htmlAnalysis = analyzeHtmlElements(html);
  typographyElements.push(...htmlAnalysis.typographyElements);
  interactiveElements.push(...htmlAnalysis.interactiveElements);

  return {
    html,
    css,
    elementSelectors,
    descendantSelectors,
    mediaQueries,
    typographyElements,
    layoutContainers,
    interactiveElements,
    tokens
  };
}

function parseCssRules(css: string): { baseRules: Array<{ selector: string; properties: Record<string, string> }>; mediaRules: Array<{ query: string; rules: Array<{ selector: string; properties: Record<string, string> }> }> } {
  const baseRules: Array<{ selector: string; properties: Record<string, string> }> = [];
  const mediaRules: Array<{ query: string; rules: Array<{ selector: string; properties: Record<string, string> }> }> = [];

  // Remove comments
  const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, "");

  // Parse media queries
  const mediaRegex = /@media\s*([^{]+)\{([\s\S]*?)\}\s*\}/g;
  let mediaMatch;
  while ((mediaMatch = mediaRegex.exec(cleanCss)) !== null) {
    const query = mediaMatch[1].trim();
    const content = mediaMatch[2];
    const rules = parseRuleContent(content);
    mediaRules.push({ query, rules });
  }

  // Parse base rules
  const cssWithoutMedia = cleanCss.replace(mediaRegex, "");
  baseRules.push(...parseRuleContent(cssWithoutMedia));

  return { baseRules, mediaRules };
}

function parseRuleContent(content: string): Array<{ selector: string; properties: Record<string, string> }> {
  const rules: Array<{ selector: string; properties: Record<string, string> }> = [];
  const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
  let match;

  while ((match = ruleRegex.exec(content)) !== null) {
    const selector = match[1].trim();
    const propertiesStr = match[2].trim();
    const properties: Record<string, string> = {};

    const propRegex = /([a-zA-Z-]+)\s*:\s*([^;]+);/g;
    let propMatch;
    while ((propMatch = propRegex.exec(propertiesStr)) !== null) {
      properties[propMatch[1]] = propMatch[2].trim();
    }

    rules.push({ selector, properties });
  }

  return rules;
}

function analyzeHtmlElements(html: string): { typographyElements: Array<{ tag: string; classes: string[]; hasFontClass: boolean }>; interactiveElements: Array<{ tag: string; href?: string; classes: string[] }> } {
  const typographyElements: Array<{ tag: string; classes: string[]; hasFontClass: boolean }> = [];
  const interactiveElements: Array<{ tag: string; href?: string; classes: string[] }> = [];

  // Simple regex-based HTML parsing (for CLI purposes)
  const tagRegex = /<(\w+)([^>]*)>([^<]*)/g;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];

    // Extract classes
    const classMatch = attrs.match(/class\s*=\s*["']([^"']*)["']/);
    const classes = classMatch ? classMatch[1].split(/\s+/).filter(Boolean) : [];

    // Extract href for links
    const hrefMatch = attrs.match(/href\s*=\s*["']([^"']*)["']/);
    const href = hrefMatch ? hrefMatch[1] : undefined;

    // Check typography elements
    if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "div"].includes(tag)) {
      const hasFontClass = classes.some(cls => cls.startsWith("text-") || cls.startsWith("heading-"));
      typographyElements.push({ tag, classes, hasFontClass });
    }

    // Check interactive elements
    if (["a", "button"].includes(tag)) {
      interactiveElements.push({ tag, href, classes });
    }
  }

  return { typographyElements, interactiveElements };
}

// ============================================
// VERIFICATION PHASES
// ============================================

export function verifyCssCoverage(original: OriginalAnalysis, normalized: NormalizationResult, payload: WebflowPayload): VerificationResult {
  void payload;
  const issues: string[] = [];
  const details: string[] = [];

  // Check element selectors
  const unhandledElements = original.elementSelectors.filter(sel => {
    // Check if selector was converted to a class in normalized HTML
    const elementType = sel.toLowerCase();
    if (["body", "html"].includes(elementType)) {
      return !normalized.html.includes("wf-body");
    }
    if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(elementType)) {
      return !normalized.html.includes(`heading-${elementType}`);
    }
    if (elementType === "p") {
      return !normalized.html.includes("text-body");
    }
    return true; // Assume others are handled
  });

  if (unhandledElements.length > 0) {
    issues.push(`${unhandledElements.length} element selectors not promoted`);
    details.push(...unhandledElements.map(sel => `  - ${sel}`));
  }

  // Check descendant selectors
  const unflattenedDescendants = original.descendantSelectors.filter(sel => {
    // Check if selector still contains spaces (not flattened)
    return normalized.css.includes(sel) || normalized.html.includes(sel);
  });

  if (unflattenedDescendants.length > 0) {
    issues.push(`${unflattenedDescendants.length} descendant selectors not flattened`);
    details.push(...unflattenedDescendants.map(sel => `  - ${sel}`));
  }

  const status = issues.length > 0 ? "FAIL" : "PASS";
  return { phase: "CSS Coverage Audit", status, issues, details };
}

export function verifyTypographyIntegrity(original: OriginalAnalysis, normalized: NormalizationResult, payload: WebflowPayload): VerificationResult {
  void payload;
  const issues: string[] = [];
  const details: string[] = [];

  // Check typography elements in normalized HTML
  const missingFontClasses: string[] = [];

  // Parse normalized HTML for typography elements
  const headingRegex = /heading-(h[1-6])/g;
  const textRegex = /text-\w+/g;

  const foundHeadings = new Set<string>();
  const foundTextClasses = new Set<string>();

  let match;
  while ((match = headingRegex.exec(normalized.html)) !== null) {
    foundHeadings.add(match[1]);
  }
  while ((match = textRegex.exec(normalized.html)) !== null) {
    foundTextClasses.add(match[0]);
  }

  // Check that headings have corresponding classes
  for (const el of original.typographyElements) {
    if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(el.tag) && !foundHeadings.has(el.tag)) {
      missingFontClasses.push(`${el.tag} elements`);
    }
    if (el.tag === "p" && !foundTextClasses.has("text-body")) {
      missingFontClasses.push("p elements");
    }
  }

  if (missingFontClasses.length > 0) {
    issues.push(`${missingFontClasses.length} text elements missing font classes`);
    details.push(...missingFontClasses.map(el => `  - ${el}`));
  }

  const status = issues.length > 0 ? "FAIL" : "PASS";
  return { phase: "Typography Integrity Test", status, issues, details };
}

export function verifyLayoutAuthority(original: OriginalAnalysis, normalized: NormalizationResult, payload: WebflowPayload): VerificationResult {
  void normalized;
  void payload;
  const issues: string[] = [];
  const details: string[] = [];

  // Check layout containers have required properties
  for (const container of original.layoutContainers) {
    const missingProps: string[] = [];

    if (container.display.includes("flex")) {
      const required = ["display", "flex-direction", "justify-content", "align-items"];
      for (const prop of required) {
        if (!container.properties[prop]) {
          missingProps.push(prop);
        }
      }
    } else if (container.display.includes("grid")) {
      const required = ["display", "grid-template-columns"];
      for (const prop of required) {
        if (!container.properties[prop]) {
          missingProps.push(prop);
        }
      }
    }

    if (missingProps.length > 0) {
      issues.push(`${container.selector} missing layout properties: ${missingProps.join(", ")}`);
      details.push(`  - ${container.selector}: missing ${missingProps.join(", ")}`);
    }
  }

  const status = issues.length > 0 ? "FAIL" : "PASS";
  return { phase: "Layout Authority Test", status, issues, details };
}

export function verifyResponsiveVariants(original: OriginalAnalysis, normalized: NormalizationResult, payload: WebflowPayload): VerificationResult {
  void original;
  void normalized;
  const issues: string[] = [];
  const details: string[] = [];

  // Check that media queries were converted to variants
  const webflowVariants = new Set<string>();
  for (const style of payload.payload.styles) {
    for (const variant of Object.keys(style.variants)) {
      webflowVariants.add(variant);
    }
  }

  const missingBreakpoints: string[] = [];
  for (const mq of original.mediaQueries) {
    // Check if breakpoint was detected and converted
    const hasCorrespondingVariant = webflowVariants.has("medium") || webflowVariants.has("small") || webflowVariants.has("tiny");
    if (!hasCorrespondingVariant) {
      missingBreakpoints.push(mq.query);
    }
  }

  if (missingBreakpoints.length > 0) {
    issues.push(`${missingBreakpoints.length} responsive variants not created`);
    details.push(...missingBreakpoints.map(bp => `  - ${bp}`));
  }

  const status = issues.length > 0 ? "FAIL" : "PASS";
  return { phase: "Responsive Variant Integrity", status, issues, details };
}

export function verifyInteractiveStyling(original: OriginalAnalysis, normalized: NormalizationResult, payload: WebflowPayload): VerificationResult {
  void normalized;
  void payload;
  const issues: string[] = [];
  const details: string[] = [];

  // Check that interactive elements have styling classes
  const nakedLinks: string[] = [];

  for (const el of original.interactiveElements) {
    if (el.tag === "a" && el.classes.length === 0) {
      nakedLinks.push("anchor tags without classes");
    }
  }

  if (nakedLinks.length > 0) {
    issues.push(`${nakedLinks.length} interactive elements without styling classes`);
    details.push(...nakedLinks.map(el => `  - ${el}`));
  }

  const status = issues.length > 0 ? "FAIL" : "PASS";
  return { phase: "Link & Interactive Styling Test", status, issues, details };
}

export function verifyTokenConsumption(original: OriginalAnalysis, normalized: NormalizationResult, payload: WebflowPayload): VerificationResult {
  void normalized;
  const issues: string[] = [];
  const details: string[] = [];

  // Check that CSS variables are used in the styles
  const usedTokens = new Set<string>();
  const allStyleLess = payload.payload.styles.map(s => s.styleLess + Object.values(s.variants).map(v => v.styleLess).join(" ")).join(" ");

  for (const [tokenName] of original.tokens) {
    if (allStyleLess.includes(tokenName)) {
      usedTokens.add(tokenName);
    }
  }

  const unusedTokens = Array.from(original.tokens.keys()).filter(token => !usedTokens.has(token));

  if (unusedTokens.length > 0) {
    issues.push(`${unusedTokens.length} tokens defined but unused`);
    details.push(...unusedTokens.map(token => `  - ${token}`));
  }

  const status = unusedTokens.length > 0 ? "WARN" : "PASS";
  return { phase: "Token Consumption Test", status, issues, details };
}

export function verifyVisibilityRisks(original: OriginalAnalysis, normalized: NormalizationResult, payload: WebflowPayload): VerificationResult {
  void original;
  void payload;
  const issues: string[] = [];
  const details: string[] = [];

  const parsedHtml = parseHtmlString(normalized.html);
  if (!parsedHtml) {
    return { phase: "Visibility Risk Assessment", status: "FAIL", issues: ["Failed to parse normalized HTML"], details: [] };
  }

  // Parse normalized CSS to get properties map
  const { classIndex } = parseCSS(normalized.css);

  checkVisibilityRecursively(parsedHtml, null, classIndex, issues, details, 0);

  const status = issues.length > 0 ? "WARN" : "PASS";
  return { phase: "Visibility Risk Assessment", status, issues, details };
}

function checkVisibilityRecursively(
  element: ParsedElement,
  parentStyle: Record<string, string> | null,
  classIndex: ClassIndex,
  issues: string[],
  details: string[],
  depth: number
) {
  const style = getElementStyle(element, classIndex);
  const selector = element.classes.length > 0 ? `.${element.classes.join(".")}` : `<${element.tag}>`;

  // Check: Overflow hidden with no height
  if ((style.overflow === "hidden" || style.overflowX === "hidden" || style.overflowY === "hidden") && style.display !== "none") {
    const hasHeight = style.height && style.height !== "auto" && style.height !== "0px" && style.height !== "0";
    const hasMinHeight = style["min-height"] && style["min-height"] !== "0px" && style["min-height"] !== "0";
    const isFlexOrGrid = style.display === "flex" || style.display === "grid";
    
    if (!hasHeight && !hasMinHeight && !isFlexOrGrid) {
      if (selector.includes("container") || selector.includes("wrapper") || selector.includes("grid")) {
         issues.push(`Potential invisible container: "${selector}" has overflow:hidden but no explicit height.`);
         details.push(`  - ${selector}: overflow:hidden detected without height/min-height. Ensure children size it correctly.`);
      }
    }
  }

  // Check: Deep nesting
  if (depth > 12) {
    if (!issues.some(i => i.startsWith("Deep nesting detected"))) {
        issues.push("Deep nesting detected (>12 levels). Webflow may struggle with this.");
        details.push(`  - At ${selector} (depth ${depth})`);
    }
  }

  // Check: Z-Index negative
  if (style["z-index"] && parseInt(style["z-index"]) < 0) {
    issues.push(`Negative z-index detected on "${selector}".`);
    details.push(`  - ${selector}: z-index: ${style["z-index"]}. Ensure parent stacking context is correct.`);
  }

  // Check: Explicitly hidden
  if (style.opacity === "0" || style.visibility === "hidden") {
     issues.push(`Element "${selector}" is explicitly hidden.`);
     details.push(`  - ${selector}: opacity: ${style.opacity} / visibility: ${style.visibility}`);
  }

  for (const child of element.children) {
    if (typeof child !== "string") {
      checkVisibilityRecursively(child, style, classIndex, issues, details, depth + 1);
    }
  }
}

function getElementStyle(element: ParsedElement, classIndex: ClassIndex): Record<string, string> {
  const style: Record<string, string> = {};
  for (const cls of element.classes) {
    const entry = classIndex.classes[cls];
    if (entry) {
      const props = parseStyleString(entry.baseStyles);
      Object.assign(style, props);
    }
  }
  return style;
}

function parseStyleString(styleStr: string): Record<string, string> {
  const res: Record<string, string> = {};
  styleStr.split(";").forEach((p) => {
    const [k, v] = p.split(":");
    if (k && v) res[k.trim()] = v.trim();
  });
  return res;
}

/**
 * Standalone diagnostic function for use in ImportWizard
 */
export function diagnoseVisibilityIssues(html: string, css: string): string[] {
    const issues: string[] = [];
    // Try to parse HTML. If it's a fragment (multiple roots), wrap it.
    let parsedHtml = parseHtmlString(html);
    if (!parsedHtml) {
        parsedHtml = parseHtmlString(`<div class="diagnostic-wrapper">${html}</div>`);
    }

    if (!parsedHtml) return ["Failed to parse HTML for diagnostics"];

    const { classIndex } = parseCSS(css);
    const details: string[] = [];

    checkVisibilityRecursively(parsedHtml, null, classIndex, issues, details, 0);

    return issues;
}

// ============================================
// PRE-FLIGHT VERIFICATION PHASES
// ============================================

/**
 * Verify UUID integrity using preflight validator.
 * Duplicate UUIDs cause unrecoverable Webflow project corruption.
 */
export function verifyUUIDIntegrity(payload: WebflowPayload): VerificationResult {
  const issues: string[] = [];
  const details: string[] = [];

  const validation = validateUUIDs(payload.payload.nodes, payload.payload.styles);

  if (validation.duplicates.length > 0) {
    issues.push(`${validation.duplicates.length} duplicate UUID(s) detected`);
    details.push(...validation.duplicates.slice(0, 10).map(id => `  - Duplicate: ${id}`));
    if (validation.duplicates.length > 10) {
      details.push(`  ... and ${validation.duplicates.length - 10} more duplicates`);
    }
  }

  if (validation.invalidFormat.length > 0) {
    issues.push(`${validation.invalidFormat.length} UUID(s) with invalid format`);
    details.push(...validation.invalidFormat.slice(0, 5).map(id => `  - Invalid: ${id}`));
    if (validation.invalidFormat.length > 5) {
      details.push(`  ... and ${validation.invalidFormat.length - 5} more invalid`);
    }
  }

  const status = validation.isValid ? "PASS" : "FAIL";
  return { phase: "UUID Integrity Check", status, issues, details };
}

/**
 * Verify node reference integrity using preflight validator.
 * Orphan references cause Webflow to fail silently or corrupt data.
 */
export function verifyNodeReferences(payload: WebflowPayload): VerificationResult {
  const issues: string[] = [];
  const details: string[] = [];

  const validation = validateNodeReferences(payload.payload.nodes);

  if (validation.orphanReferences.length > 0) {
    issues.push(`${validation.orphanReferences.length} orphan node reference(s)`);
    details.push(...validation.orphanReferences.slice(0, 10).map(
      ref => `  - Node ${ref.parentId} -> missing child ${ref.missingChildId}`
    ));
    if (validation.orphanReferences.length > 10) {
      details.push(`  ... and ${validation.orphanReferences.length - 10} more orphans`);
    }
  }

  if (validation.unreachableNodes.length > 0) {
    // Unreachable nodes are warnings, not failures
    details.push(`  Warning: ${validation.unreachableNodes.length} unreachable node(s)`);
  }

  const status = validation.isValid ? "PASS" : "FAIL";
  return { phase: "Node Reference Integrity", status, issues, details };
}

/**
 * Verify no circular references exist using preflight validator.
 * Circular references cause infinite loops in Webflow.
 */
export function verifyNoCircularReferences(payload: WebflowPayload): VerificationResult {
  const issues: string[] = [];
  const details: string[] = [];

  const validation = detectCircularReferences(payload.payload.nodes);

  if (validation.cycles.length > 0) {
    issues.push(`${validation.cycles.length} circular reference(s) detected`);
    for (const cycle of validation.cycles.slice(0, 5)) {
      details.push(`  - Cycle: ${cycle.join(" -> ")}`);
    }
    if (validation.cycles.length > 5) {
      details.push(`  ... and ${validation.cycles.length - 5} more cycles`);
    }
  }

  const status = validation.isValid ? "PASS" : "FAIL";
  return { phase: "Circular Reference Check", status, issues, details };
}

/**
 * Verify style definitions using preflight validator.
 */
export function verifyStyleDefinitions(payload: WebflowPayload): VerificationResult {
  const issues: string[] = [];
  const details: string[] = [];

  const validation = validateStyles(payload.payload.styles, payload.payload.nodes);

  if (validation.invalidStyles.length > 0) {
    issues.push(`${validation.invalidStyles.length} invalid style declaration(s)`);
    details.push(...validation.invalidStyles.slice(0, 10).map(
      s => `  - ${s.className}: ${s.property}="${s.value}" (${s.reason})`
    ));
    if (validation.invalidStyles.length > 10) {
      details.push(`  ... and ${validation.invalidStyles.length - 10} more invalid styles`);
    }
  }

  if (validation.missingStyleRefs.length > 0) {
    issues.push(`${validation.missingStyleRefs.length} missing style reference(s)`);
    details.push(...validation.missingStyleRefs.slice(0, 5).map(ref => `  - ${ref}`));
    if (validation.missingStyleRefs.length > 5) {
      details.push(`  ... and ${validation.missingStyleRefs.length - 5} more missing refs`);
    }
  }

  const status = validation.isValid ? "PASS" : (validation.invalidStyles.length > 0 ? "WARN" : "PASS");
  return { phase: "Style Definition Check", status, issues, details };
}

/**
 * Verify embed sizes using preflight validator.
 */
export function verifyEmbedSizes(payload: WebflowPayload, cssEmbed?: string, jsEmbed?: string): VerificationResult {
  const issues: string[] = [];
  const details: string[] = [];

  const validation = validateEmbedSize(payload.payload.nodes, cssEmbed, jsEmbed);

  if (validation.errors.length > 0) {
    issues.push(...validation.errors);
    details.push(...validation.errors.map(e => `  - ERROR: ${e}`));
  }

  if (validation.warnings.length > 0) {
    details.push(...validation.warnings.map(w => `  - WARNING: ${w}`));
  }

  if (validation.css > 0) {
    details.push(`  CSS embed size: ${Math.round(validation.css / 1024)}KB`);
  }
  if (validation.js > 0) {
    details.push(`  JS embed size: ${Math.round(validation.js / 1024)}KB`);
  }

  const status = validation.errors.length > 0 ? "FAIL" : (validation.warnings.length > 0 ? "WARN" : "PASS");
  return { phase: "Embed Size Check", status, issues, details };
}

/**
 * Verify node structure using preflight validator.
 */
export function verifyNodeStructure(payload: WebflowPayload): VerificationResult {
  const issues: string[] = [];
  const details: string[] = [];

  const validation = validateNodeStructure(payload.payload.nodes);

  if (validation.errors.length > 0) {
    issues.push(`${validation.errors.length} node structure error(s)`);
    details.push(...validation.errors.slice(0, 10).map(e => `  - ERROR: ${e}`));
    if (validation.errors.length > 10) {
      details.push(`  ... and ${validation.errors.length - 10} more errors`);
    }
  }

  if (validation.warnings.length > 0) {
    details.push(...validation.warnings.slice(0, 5).map(w => `  - WARNING: ${w}`));
    if (validation.warnings.length > 5) {
      details.push(`  ... and ${validation.warnings.length - 5} more warnings`);
    }
  }

  const status = validation.errors.length > 0 ? "FAIL" : (validation.warnings.length > 0 ? "WARN" : "PASS");
  return { phase: "Node Structure Check", status, issues, details };
}

/**
 * Run comprehensive pre-flight verification on a Webflow payload.
 * This should be run BEFORE allowing paste to prevent project corruption.
 */
export function runPreflightVerification(
  payload: WebflowPayload,
  options: {
    cssEmbed?: string;
    jsEmbed?: string;
  } = {}
): VerificationReport {
  const phases: VerificationResult[] = [
    verifyUUIDIntegrity(payload),
    verifyNodeReferences(payload),
    verifyNoCircularReferences(payload),
    verifyStyleDefinitions(payload),
    verifyEmbedSizes(payload, options.cssEmbed, options.jsEmbed),
    verifyNodeStructure(payload),
  ];

  // Collect critical failures, warnings, and recommendations
  const criticalFailures: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  for (const phase of phases) {
    if (phase.status === "FAIL") {
      criticalFailures.push(`${phase.phase}: ${phase.issues.join("; ")}`);
    } else if (phase.status === "WARN") {
      warnings.push(`${phase.phase}: ${phase.issues.join("; ")}`);
    }
  }

  // Add recommendations based on issues
  if (criticalFailures.some(f => f.includes("UUID"))) {
    recommendations.push("Regenerate node IDs to fix duplicate UUID issues");
  }
  if (criticalFailures.some(f => f.includes("circular"))) {
    recommendations.push("Check parent-child relationships for circular dependencies");
  }
  if (criticalFailures.some(f => f.includes("orphan"))) {
    recommendations.push("Ensure all child references point to existing nodes");
  }
  if (warnings.some(w => w.includes("Embed Size"))) {
    recommendations.push("Consider splitting large embeds into smaller chunks");
  }

  // Determine overall status
  const overallStatus = criticalFailures.length > 0 ? "FAIL" : (warnings.length > 0 ? "WARN" : "PASS");

  // Determine paste safety
  const pasteSafety: Record<string, "SAFE" | "REVIEW" | "DO NOT PASTE"> = {
    "payload": overallStatus === "FAIL" ? "DO NOT PASTE" : (overallStatus === "WARN" ? "REVIEW" : "SAFE"),
  };

  return {
    overallStatus,
    criticalFailures,
    warnings,
    recommendations,
    pasteSafety,
    phases,
    componentFidelity: {},
  };
}

// Re-export preflight types and functions for convenience
export {
  runPreflightValidation,
  validateUUIDs,
  validateNodeReferences,
  detectCircularReferences,
  validateStyles,
  validateEmbedSize,
  validateNodeStructure,
  type PreflightResult,
  type UUIDValidation,
  type OrphanValidation,
  type CircularValidation,
  type StyleValidation,
} from "./preflight-validator";


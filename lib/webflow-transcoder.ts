/**
 * Webflow transcoding pipeline with deterministic conversion + semantic recovery.
 */

import { readFileSync } from "fs";
import { extractTokens } from "./token-extractor";
import {
  extractCssVariables,
  parseCSS,
  propertiesToStyleLess,
  resolveCssVariables,
} from "./css-parser";
import { normalizeHtmlCssForWebflow } from "./webflow-normalizer";
import {
  buildTokenWebflowPayload,
  convertHtmlCssToWebflow,
  type WebflowNode,
  type WebflowPayload,
  type WebflowStyle,
} from "./webflow-converter";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_CLAUDE_MODEL = "anthropic/claude-sonnet-4.0";
const CLAUDE_SYSTEM_PROMPT = [
  "You are a Webflow Semantic Transcoding Assistant.",
  "",
  "You are NOT a designer.",
  "You are NOT allowed to redesign, simplify, or improve layouts.",
  "You must preserve the original HTML/CSS intent exactly.",
  "",
  "Your task is to repair semantic gaps where deterministic rules failed",
  "when transcoding HTML/CSS into Webflow's explicit style model.",
  "",
  "Webflow does NOT support:",
  "- CSS variables",
  "- Element selectors (h1, p, body)",
  "- Browser default behavior",
  "- Implicit layout relationships",
  "",
  "You must make all layout, spacing, and typography explicit.",
  "",
  "For CSS Grid layouts:",
  "- Preserve grid-template-columns exactly (e.g., repeat(4, 1fr) → 1fr 1fr 1fr 1fr)",
  "- Preserve grid-column and grid-row spans on ALL child elements",
  "- Use grid-column-start: auto; grid-column-end: span 2; for spanning",
  "- Do NOT simplify or reduce column counts",
  "- Bento grids require explicit span values on children to maintain layout",
  "- Ensure grid-template-rows is never empty; default to 'auto' if undefined",
  "",
  "You MUST output VALID JSON ONLY.",
  "No prose. No markdown. No explanations outside JSON.",
].join("\n");

const SKIP_TAGS = new Set(["meta", "link", "script", "style", "title", "head"]);
const FONT_FALLBACKS = ["arial", "sans-serif", "serif", "system-ui"];
const SPACING_PROPERTIES = new Set([
  "gap",
  "row-gap",
  "column-gap",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "width",
  "height",
]);
const LAYOUT_PROPERTIES = new Set([
  "display",
  "flex-direction",
  "flex-wrap",
  "justify-content",
  "align-items",
  "align-content",
  "grid-template-columns",
  "grid-template-rows",
  "grid-column",
  "grid-row",
  "gap",
  "row-gap",
  "column-gap",
]);

export interface DiagnosticReport {
  missingFonts: string[];
  layoutDegradation: string[];
  missingSpacing: string[];
  orphanedElements: string[];
  phantomElements: string[];
}

export interface SemanticPatchInstruction {
  op: "mergeStyle" | "setStyle" | "mergeVariant" | "setVariant" | "addClassToNode" | "removeNode";
  className?: string;
  nodeId?: string;
  variant?: string;
  styleLess?: string;
  properties?: Record<string, string>;
  reason?: string;
}

export interface SemanticPatchResponse {
  patches: SemanticPatchInstruction[];
  notes?: string[];
  requiresHumanReview?: Array<{ issue: string; context: string }>;
  summaryIssues?: string[];
  confidence?: "high" | "medium" | "low";
}

export interface TranscodingReport {
  status: "PASS" | "FAIL";
  deterministicFixes: string[];
  semanticFixes: string[];
  claudeReasons: string[];
  remainingIssues: string[];
}

export interface TranscodingResult {
  webflowPayload: WebflowPayload;
  webflowJson: string;
  tokenPayload: WebflowPayload;
  tokenPayloadJson: string;
  diagnostics: DiagnosticReport;
  report: TranscodingReport;
  usedSemanticRecovery: boolean;
}

export interface TranscodeOptions {
  idPrefix?: string;
  tokenName?: string;
  tokenNamespace?: string;
  disableSemanticRecovery?: boolean;
  forceSemanticRecovery?: boolean;
  claude?: {
    apiKey?: string;
    model?: string;
    timeoutMs?: number;
    temperature?: number;
    maxTokens?: number;
    reasoningEffort?: "low" | "medium" | "high";
  };
}

interface HtmlAnalysis {
  classes: Map<string, number>;
  tags: Map<string, number>;
  elements: Array<{ tag: string; classes: string[] }>;
}

interface PayloadAnalysis {
  classes: Map<string, number>;
  tags: Map<string, number>;
  nodesById: Map<string, WebflowNode>;
}

interface FailureDetection {
  shouldInvoke: boolean;
  reasons: string[];
  collapsedRepeats: string[];
}

interface ClaudeSemanticResponse {
  summary: {
    issues_detected: string[];
    confidence: "high" | "medium" | "low";
  };
  typography_fixes: Array<{
    target_class: string;
    font_family: string;
    font_weight: string | null;
    line_height: string | null;
    reason: string;
  }>;
  layout_fixes: Array<{
    target_class: string;
    display: "flex" | "grid" | "block";
    properties: {
      flex_direction: string | null;
      justify_content: string | null;
      align_items: string | null;
      gap: string | null;
      grid_template_columns: string | null;
      grid_template_rows: string | null;
      grid_column: string | null;
      grid_row: string | null;
      grid_column_start: string | null;
      grid_column_end: string | null;
      grid_row_start: string | null;
      grid_row_end: string | null;
    };
    reason: string;
  }>;
  spacing_fixes: Array<{
    target_class: string;
    padding: string | null;
    margin: string | null;
    min_height: string | null;
    max_width: string | null;
    reason: string;
  }>;
  parent_child_repairs: Array<{
    parent_class: string;
    child_class: string;
    action: "apply_spacing_to_parent" | "duplicate_layout_rules" | "enforce_structure";
    reason: string;
  }>;
  phantom_elements: Array<{
    selector: string;
    action: "remove";
    reason: string;
  }>;
  requires_human_review: Array<{
    issue: string;
    context: string;
  }>;
}

export async function transcodeHtmlCssToWebflow(
  html: string,
  css: string,
  options: TranscodeOptions = {}
): Promise<TranscodingResult> {
  const deterministicFixes: string[] = [];
  const semanticFixes: string[] = [];

  const normalized = normalizeHtmlCssForWebflow(html, css);
  if (normalized.warnings.length > 0) {
    deterministicFixes.push(...normalized.warnings.map((warning) => `Normalizer: ${warning}`));
  }

  const cssVariables = extractCssVariables(css);
  const parsedCss = parseCSS(normalized.css);
  if (parsedCss.classIndex.warnings.length > 0) {
    deterministicFixes.push(...parsedCss.classIndex.warnings.map((warning) => `CSS: ${warning.message}`));
  }

  let payload = convertHtmlCssToWebflow(html, css, { idPrefix: options.idPrefix });
  payload = resolvePayloadCssVariables(payload, cssVariables);

  const diagnostics = buildDiagnosticReport({
    originalHtml: html,
    normalizedHtml: normalized.html,
    payload,
    classIndex: parsedCss.classIndex,
  });

  const detection = detectFailureConditions({
    diagnostics,
    originalHtml: html,
    payload,
    normalizedHtml: normalized.html,
    classIndex: parsedCss.classIndex,
  });

  let usedSemanticRecovery = false;
  let attemptedSemanticRecovery = false;
  let claudeError: string | null = null;
  const claudeReviewNotes: string[] = [];
  const claudeReasons = detection.reasons;

  if (!options.disableSemanticRecovery && (options.forceSemanticRecovery || detection.shouldInvoke)) {
    attemptedSemanticRecovery = true;
    try {
      const patchResponse = await requestSemanticPatches({
        html,
        css,
        payload,
        diagnostics,
        options,
      });

      if (patchResponse) {
        usedSemanticRecovery = true;
        const applyResult = applySemanticPatches(payload, patchResponse.patches);
        payload = applyResult.payload;
        semanticFixes.push(...applyResult.applied);
        if (patchResponse.notes?.length) {
          semanticFixes.push(...patchResponse.notes.map((note) => `Claude note: ${note}`));
        }
        if (patchResponse.summaryIssues?.length) {
          semanticFixes.push(
            ...patchResponse.summaryIssues.map((issue) => `Claude summary: ${issue}`)
          );
        }
        if (patchResponse.requiresHumanReview?.length) {
          claudeReviewNotes.push(
            ...patchResponse.requiresHumanReview.map(
              (entry) => `Requires review: ${entry.issue} (${entry.context})`
            )
          );
        }
        payload = resolvePayloadCssVariables(payload, cssVariables);
      }
    } catch (error) {
      claudeError = error instanceof Error ? error.message : String(error);
    }
  }

  const finalDiagnostics = buildDiagnosticReport({
    originalHtml: html,
    normalizedHtml: normalized.html,
    payload,
    classIndex: parsedCss.classIndex,
  });

  const remainingIssues = summarizeDiagnostics(finalDiagnostics);
  if (claudeReviewNotes.length > 0) {
    remainingIssues.push(...claudeReviewNotes);
  }
  if (claudeError) {
    remainingIssues.push(`Claude recovery failed: ${claudeError}`);
  }
  const status = remainingIssues.length === 0 ? "PASS" : "FAIL";

  const tokenExtraction = extractTokens(css, options.tokenName ?? "Design System");
  if (options.tokenNamespace) {
    tokenExtraction.namespace = options.tokenNamespace;
  }
  const tokenPayload = buildTokenWebflowPayload(tokenExtraction);

  return {
    webflowPayload: payload,
    webflowJson: JSON.stringify(payload),
    tokenPayload,
    tokenPayloadJson: JSON.stringify(tokenPayload),
    diagnostics: finalDiagnostics,
    report: {
      status,
      deterministicFixes,
      semanticFixes,
      claudeReasons: attemptedSemanticRecovery ? claudeReasons : [],
      remainingIssues,
    },
    usedSemanticRecovery,
  };
}

function buildDiagnosticReport(params: {
  originalHtml: string;
  normalizedHtml: string;
  payload: WebflowPayload;
  classIndex: ReturnType<typeof parseCSS>["classIndex"];
}): DiagnosticReport {
  const originalAnalysis = analyzeHtml(params.originalHtml);
  const normalizedAnalysis = analyzeHtml(params.normalizedHtml);
  const payloadAnalysis = analyzePayload(params.payload);

  const injectedClasses = new Set(
    Array.from(normalizedAnalysis.classes.keys()).filter((cls) => !originalAnalysis.classes.has(cls))
  );

  const stylesByClass = new Map<string, WebflowStyle>();
  for (const style of params.payload.payload.styles) {
    stylesByClass.set(style.name, style);
  }

  const missingFonts: string[] = [];
  const layoutDegradation: string[] = [];
  const missingSpacing: string[] = [];
  const orphanedElements: string[] = [];
  const phantomElements: string[] = [];

  for (const [className, entry] of Object.entries(params.classIndex.classes)) {
    if (!normalizedAnalysis.classes.has(className)) continue;
    if (!entry.baseStyles) continue;

    const expectedFont = getStyleProperty(entry.baseStyles, "font-family");
    if (expectedFont) {
      const style = stylesByClass.get(className);
      const actualFont = style ? getStyleProperty(style.styleLess, "font-family") : null;
      if (!actualFont || isFallbackFont(actualFont, expectedFont)) {
        missingFonts.push(`.${className} missing font-family (expected ${expectedFont})`);
      }
    }

    if (entry.isLayoutContainer) {
      const style = stylesByClass.get(className);
      const actualProps = style ? parseStyleLess(style.styleLess) : new Map<string, string>();
      const expectedProps = parseStyleLess(entry.baseStyles);
      const display = (actualProps.get("display") || expectedProps.get("display") || "").toLowerCase();
      const isFlex = display.includes("flex");
      const isGrid = display.includes("grid");

      if (isFlex) {
        const missing = ["display", "flex-direction", "justify-content", "align-items"].filter(
          (prop) => !actualProps.has(prop)
        );
        if (missing.length > 0) {
          layoutDegradation.push(`.${className} missing flex props: ${missing.join(", ")}`);
        }
      }

      if (isGrid) {
        const missing = ["display", "grid-template-columns"].filter((prop) => !actualProps.has(prop));
        if (missing.length > 0) {
          layoutDegradation.push(`.${className} missing grid props: ${missing.join(", ")}`);
        }
      }
    }

    const expectedProps = parseStyleLess(entry.baseStyles);
    for (const prop of expectedProps.keys()) {
      if (!SPACING_PROPERTIES.has(prop)) continue;
      const style = stylesByClass.get(className);
      const actualProps = style ? parseStyleLess(style.styleLess) : new Map<string, string>();
      if (!actualProps.has(prop)) {
        missingSpacing.push(`.${className} missing ${prop}`);
      }
    }
  }

  for (const className of payloadAnalysis.classes.keys()) {
    if (!stylesByClass.has(className)) {
      orphanedElements.push(`.${className}`);
    }
  }

  for (const node of params.payload.payload.nodes) {
    if (!node.children) continue;
    for (const childId of node.children) {
      if (!payloadAnalysis.nodesById.has(childId)) {
        orphanedElements.push(`${node._id} -> missing child ${childId}`);
      }
    }
  }

  const originalCounts = buildElementSignatureCounts(originalAnalysis.elements);
  for (const node of params.payload.payload.nodes) {
    if (node.text) continue;
    const tag = (node.tag || "div").toLowerCase();
    const classList = (node.classes || []).filter((cls) => !injectedClasses.has(cls));
    const signature = buildElementSignature(tag, classList);
    const count = originalCounts.get(signature) ?? 0;
    if (count > 0) {
      originalCounts.set(signature, count - 1);
    } else {
      phantomElements.push(`${tag}#${node._id}`);
    }
  }

  return {
    missingFonts,
    layoutDegradation,
    missingSpacing,
    orphanedElements,
    phantomElements,
  };
}

function detectFailureConditions(params: {
  diagnostics: DiagnosticReport;
  originalHtml: string;
  normalizedHtml: string;
  payload: WebflowPayload;
  classIndex: ReturnType<typeof parseCSS>["classIndex"];
}): FailureDetection {
  const reasons: string[] = [];
  const collapsedRepeats: string[] = [];

  if (params.diagnostics.missingFonts.length > 0) {
    reasons.push("Font-family fallback detected");
  }
  if (params.diagnostics.layoutDegradation.length > 0) {
    reasons.push("Flex/Grid structure degradation detected");
  }
  if (params.diagnostics.missingSpacing.length > 0) {
    reasons.push("Missing spacing/sizing detected");
  }
  if (params.diagnostics.phantomElements.length > 0) {
    reasons.push("Phantom elements detected in Webflow output");
  }

  const originalAnalysis = analyzeHtml(params.originalHtml);
  const stylesByClass = new Map<string, WebflowStyle>();
  for (const style of params.payload.payload.styles) {
    stylesByClass.set(style.name, style);
  }

  for (const [className, count] of originalAnalysis.classes.entries()) {
    if (count < 2) continue;
    const style = stylesByClass.get(className);
    if (!style) continue;
    const props = parseStyleLess(style.styleLess);
    const hasSizing = Array.from(SPACING_PROPERTIES).some((prop) => props.has(prop));
    if (!hasSizing) {
      collapsedRepeats.push(`.${className} repeats without sizing/spacing`);
    }
  }

  if (collapsedRepeats.length > 0) {
    reasons.push("Repeated components collapse detected");
  }

  const shouldInvoke = reasons.length > 0;

  return { shouldInvoke, reasons, collapsedRepeats };
}

async function requestSemanticPatches(params: {
  html: string;
  css: string;
  payload: WebflowPayload;
  diagnostics: DiagnosticReport;
  options: TranscodeOptions;
}): Promise<SemanticPatchResponse | null> {
  const apiKey =
    params.options.claude?.apiKey ||
    process.env.FLOWSTACH_OPENROUTER_KEY ||
    process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return null;
  }

  if (typeof fetch === "undefined") {
    throw new Error("Fetch API not available for Claude semantic recovery.");
  }

  const prompt = buildClaudePrompt({
    html: params.html,
    css: params.css,
    payload: params.payload,
    diagnostics: params.diagnostics,
  });

  const model = params.options.claude?.model || DEFAULT_CLAUDE_MODEL;
  const timeoutMs = params.options.claude?.timeoutMs ?? 45000;
  const temperature = params.options.claude?.temperature ?? 0.2;
  const maxTokens = params.options.claude?.maxTokens ?? 3000;
  const reasoningEffort = params.options.claude?.reasoningEffort ?? "high";

  const attempt = async (messageOverride?: string): Promise<ClaudeSemanticResponse> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await (async () => {
      try {
        return await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://flowstach.local",
            "X-Title": "Flow Stach Webflow Transcoder",
          },
          body: JSON.stringify({
            model,
            temperature,
            max_tokens: maxTokens,
            stream: false,
            reasoning: { effort: reasoningEffort },
            messages: [
              {
                role: "system",
                content: CLAUDE_SYSTEM_PROMPT,
              },
              {
                role: "user",
                content: messageOverride ? `${prompt}\n\n${messageOverride}` : prompt,
              },
            ],
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    })();

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude semantic recovery failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Claude returned empty content.");
    }

    const jsonText = typeof content === "string" ? extractJson(content) ?? content : JSON.stringify(content);
    let parsed: ClaudeSemanticResponse;
    try {
      parsed = JSON.parse(jsonText) as ClaudeSemanticResponse;
    } catch (parseError) {
      throw new Error(`Claude schema invalid: ${String(parseError)}`);
    }
    const validation = validateClaudeSemanticResponse(parsed);
    if (!validation.ok) {
      throw new Error(`Claude schema invalid: ${validation.errors.join("; ")}`);
    }

    return parsed;
  };

  try {
    const response = await attempt();
    return translateClaudeResponseToPatches(response, params);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Claude schema invalid")) {
      throw error;
    }
    const retryMessage =
      "Previous response failed schema validation. Return JSON that matches the schema exactly. No prose.";
    const response = await attempt(retryMessage);
    return translateClaudeResponseToPatches(response, params);
  }
}

function translateClaudeResponseToPatches(
  response: ClaudeSemanticResponse,
  params: {
    payload: WebflowPayload;
    diagnostics: DiagnosticReport;
  }
): SemanticPatchResponse {
  const patches: SemanticPatchInstruction[] = [];
  const notes: string[] = [];

  for (const fix of response.typography_fixes) {
    const properties: Record<string, string> = {
      "font-family": fix.font_family,
    };
    if (fix.font_weight) properties["font-weight"] = fix.font_weight;
    if (fix.line_height) properties["line-height"] = fix.line_height;
    patches.push({
      op: "mergeStyle",
      className: fix.target_class,
      properties,
      reason: fix.reason,
    });
  }

  for (const fix of response.layout_fixes) {
    const properties: Record<string, string> = {
      display: fix.display,
    };
    if (fix.properties.flex_direction) properties["flex-direction"] = fix.properties.flex_direction;
    if (fix.properties.justify_content) properties["justify-content"] = fix.properties.justify_content;
    if (fix.properties.align_items) properties["align-items"] = fix.properties.align_items;
    if (fix.properties.gap) properties["gap"] = fix.properties.gap;
    if (fix.properties.grid_template_columns) {
      properties["grid-template-columns"] = fix.properties.grid_template_columns;
    }
    if (fix.properties.grid_template_rows) {
      properties["grid-template-rows"] = fix.properties.grid_template_rows;
    }
    if (fix.properties.grid_column) {
      properties["grid-column"] = fix.properties.grid_column;
    }
    if (fix.properties.grid_row) {
      properties["grid-row"] = fix.properties.grid_row;
    }
    if (fix.properties.grid_column_start) {
      properties["grid-column-start"] = fix.properties.grid_column_start;
    }
    if (fix.properties.grid_column_end) {
      properties["grid-column-end"] = fix.properties.grid_column_end;
    }
    if (fix.properties.grid_row_start) {
      properties["grid-row-start"] = fix.properties.grid_row_start;
    }
    if (fix.properties.grid_row_end) {
      properties["grid-row-end"] = fix.properties.grid_row_end;
    }
    patches.push({
      op: "mergeStyle",
      className: fix.target_class,
      properties,
      reason: fix.reason,
    });
  }

  for (const fix of response.spacing_fixes) {
    const properties: Record<string, string> = {};
    if (fix.padding) properties.padding = fix.padding;
    if (fix.margin) properties.margin = fix.margin;
    if (fix.min_height) properties["min-height"] = fix.min_height;
    if (fix.max_width) properties["max-width"] = fix.max_width;
    if (Object.keys(properties).length === 0) continue;
    patches.push({
      op: "mergeStyle",
      className: fix.target_class,
      properties,
      reason: fix.reason,
    });
  }

  const stylesByClass = new Map<string, WebflowStyle>();
  for (const style of params.payload.payload.styles) {
    stylesByClass.set(style.name, style);
  }

  for (const repair of response.parent_child_repairs) {
    if (repair.action === "apply_spacing_to_parent") {
      const copied = copyStyleProperties(stylesByClass, repair.child_class, SPACING_PROPERTIES);
      if (Object.keys(copied).length === 0) {
        notes.push(`No spacing properties found to copy from .${repair.child_class}`);
        continue;
      }
      patches.push({
        op: "mergeStyle",
        className: repair.parent_class,
        properties: copied,
        reason: repair.reason,
      });
    }

    if (repair.action === "duplicate_layout_rules") {
      const copied = copyStyleProperties(stylesByClass, repair.child_class, LAYOUT_PROPERTIES);
      if (Object.keys(copied).length === 0) {
        notes.push(`No layout properties found to copy from .${repair.child_class}`);
        continue;
      }
      patches.push({
        op: "mergeStyle",
        className: repair.parent_class,
        properties: copied,
        reason: repair.reason,
      });
    }

    if (repair.action === "enforce_structure") {
      const targets = findParentsForChildClass(params.payload, repair.parent_class, repair.child_class);
      if (targets.length === 0) {
        notes.push(`No parent nodes found for .${repair.child_class}`);
        continue;
      }
      for (const nodeId of targets) {
        patches.push({
          op: "addClassToNode",
          nodeId,
          className: repair.parent_class,
          reason: repair.reason,
        });
      }
    }
  }

  const phantomIds = extractPhantomNodeIds(params.diagnostics.phantomElements);
  for (const phantom of response.phantom_elements) {
    if (phantom.action !== "remove") continue;
    const targets = resolvePhantomSelectors(phantom.selector, params.payload, phantomIds);
    if (targets.length === 0) {
      notes.push(`Skipped phantom removal for ${phantom.selector} (not in diagnostics)`);
      continue;
    }
    for (const nodeId of targets) {
      patches.push({ op: "removeNode", nodeId, reason: phantom.reason });
    }
  }

  return {
    patches,
    notes,
    requiresHumanReview: response.requires_human_review,
    summaryIssues: response.summary.issues_detected,
    confidence: response.summary.confidence,
  };
}

function validateClaudeSemanticResponse(value: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isPlainObject(value)) {
    return { ok: false, errors: ["Response is not an object"] };
  }

  const root = value as Record<string, unknown>;
  const requiredKeys = [
    "summary",
    "typography_fixes",
    "layout_fixes",
    "spacing_fixes",
    "parent_child_repairs",
    "phantom_elements",
    "requires_human_review",
  ];
  const rootKeys = new Set(requiredKeys);
  Object.keys(root).forEach((key) => {
    if (!rootKeys.has(key)) errors.push(`Unexpected key: ${key}`);
  });
  for (const key of requiredKeys) {
    if (!(key in root)) errors.push(`Missing key: ${key}`);
  }

  if (!isPlainObject(root.summary)) {
    errors.push("summary must be an object");
  } else {
    const summary = root.summary as Record<string, unknown>;
    if (!Array.isArray(summary.issues_detected) || summary.issues_detected.some((item) => typeof item !== "string")) {
      errors.push("summary.issues_detected must be string[]");
    }
    if (!["high", "medium", "low"].includes(String(summary.confidence))) {
      errors.push("summary.confidence must be high|medium|low");
    }
  }

  if (!Array.isArray(root.typography_fixes)) errors.push("typography_fixes must be array");
  if (!Array.isArray(root.layout_fixes)) errors.push("layout_fixes must be array");
  if (!Array.isArray(root.spacing_fixes)) errors.push("spacing_fixes must be array");
  if (!Array.isArray(root.parent_child_repairs)) errors.push("parent_child_repairs must be array");
  if (!Array.isArray(root.phantom_elements)) errors.push("phantom_elements must be array");
  if (!Array.isArray(root.requires_human_review)) errors.push("requires_human_review must be array");

  const checkString = (value: unknown, field: string): void => {
    if (typeof value !== "string") errors.push(`${field} must be string`);
  };

  const checkStringOrNull = (value: unknown, field: string): void => {
    if (value !== null && typeof value !== "string") errors.push(`${field} must be string|null`);
  };

  const checkExactKeys = (value: Record<string, unknown>, allowed: string[], field: string): void => {
    const allowedSet = new Set(allowed);
    Object.keys(value).forEach((key) => {
      if (!allowedSet.has(key)) errors.push(`${field} has unexpected key: ${key}`);
    });
  };

  if (Array.isArray(root.typography_fixes)) {
    root.typography_fixes.forEach((item, index) => {
      if (!isPlainObject(item)) {
        errors.push(`typography_fixes[${index}] must be object`);
        return;
      }
      const entry = item as Record<string, unknown>;
      checkExactKeys(
        entry,
        ["target_class", "font_family", "font_weight", "line_height", "reason"],
        `typography_fixes[${index}]`
      );
      checkString(entry.target_class, `typography_fixes[${index}].target_class`);
      checkString(entry.font_family, `typography_fixes[${index}].font_family`);
      checkStringOrNull(entry.font_weight, `typography_fixes[${index}].font_weight`);
      checkStringOrNull(entry.line_height, `typography_fixes[${index}].line_height`);
      checkString(entry.reason, `typography_fixes[${index}].reason`);
    });
  }

  if (Array.isArray(root.layout_fixes)) {
    root.layout_fixes.forEach((item, index) => {
      if (!isPlainObject(item)) {
        errors.push(`layout_fixes[${index}] must be object`);
        return;
      }
      const entry = item as Record<string, unknown>;
      checkExactKeys(entry, ["target_class", "display", "properties", "reason"], `layout_fixes[${index}]`);
      checkString(entry.target_class, `layout_fixes[${index}].target_class`);
      if (!["flex", "grid", "block"].includes(String(entry.display))) {
        errors.push(`layout_fixes[${index}].display must be flex|grid|block`);
      }
      if (!isPlainObject(entry.properties)) {
        errors.push(`layout_fixes[${index}].properties must be object`);
      } else {
        const props = entry.properties as Record<string, unknown>;
        checkExactKeys(
          props,
          ["flex_direction", "justify_content", "align_items", "gap", "grid_template_columns", "grid_template_rows", "grid_column", "grid_row", "grid_column_start", "grid_column_end", "grid_row_start", "grid_row_end"],
          `layout_fixes[${index}].properties`
        );
        checkStringOrNull(props.flex_direction, `layout_fixes[${index}].properties.flex_direction`);
        checkStringOrNull(props.justify_content, `layout_fixes[${index}].properties.justify_content`);
        checkStringOrNull(props.align_items, `layout_fixes[${index}].properties.align_items`);
        checkStringOrNull(props.gap, `layout_fixes[${index}].properties.gap`);
        checkStringOrNull(props.grid_template_columns, `layout_fixes[${index}].properties.grid_template_columns`);
        checkStringOrNull(props.grid_template_rows, `layout_fixes[${index}].properties.grid_template_rows`);
        checkStringOrNull(props.grid_column, `layout_fixes[${index}].properties.grid_column`);
        checkStringOrNull(props.grid_row, `layout_fixes[${index}].properties.grid_row`);
        checkStringOrNull(props.grid_column_start, `layout_fixes[${index}].properties.grid_column_start`);
        checkStringOrNull(props.grid_column_end, `layout_fixes[${index}].properties.grid_column_end`);
        checkStringOrNull(props.grid_row_start, `layout_fixes[${index}].properties.grid_row_start`);
        checkStringOrNull(props.grid_row_end, `layout_fixes[${index}].properties.grid_row_end`);
      }
      checkString(entry.reason, `layout_fixes[${index}].reason`);
    });
  }

  if (Array.isArray(root.spacing_fixes)) {
    root.spacing_fixes.forEach((item, index) => {
      if (!isPlainObject(item)) {
        errors.push(`spacing_fixes[${index}] must be object`);
        return;
      }
      const entry = item as Record<string, unknown>;
      checkExactKeys(
        entry,
        ["target_class", "padding", "margin", "min_height", "max_width", "reason"],
        `spacing_fixes[${index}]`
      );
      checkString(entry.target_class, `spacing_fixes[${index}].target_class`);
      checkStringOrNull(entry.padding, `spacing_fixes[${index}].padding`);
      checkStringOrNull(entry.margin, `spacing_fixes[${index}].margin`);
      checkStringOrNull(entry.min_height, `spacing_fixes[${index}].min_height`);
      checkStringOrNull(entry.max_width, `spacing_fixes[${index}].max_width`);
      checkString(entry.reason, `spacing_fixes[${index}].reason`);
    });
  }

  if (Array.isArray(root.parent_child_repairs)) {
    root.parent_child_repairs.forEach((item, index) => {
      if (!isPlainObject(item)) {
        errors.push(`parent_child_repairs[${index}] must be object`);
        return;
      }
      const entry = item as Record<string, unknown>;
      checkExactKeys(
        entry,
        ["parent_class", "child_class", "action", "reason"],
        `parent_child_repairs[${index}]`
      );
      checkString(entry.parent_class, `parent_child_repairs[${index}].parent_class`);
      checkString(entry.child_class, `parent_child_repairs[${index}].child_class`);
      if (
        !["apply_spacing_to_parent", "duplicate_layout_rules", "enforce_structure"].includes(
          String(entry.action)
        )
      ) {
        errors.push(`parent_child_repairs[${index}].action invalid`);
      }
      checkString(entry.reason, `parent_child_repairs[${index}].reason`);
    });
  }

  if (Array.isArray(root.phantom_elements)) {
    root.phantom_elements.forEach((item, index) => {
      if (!isPlainObject(item)) {
        errors.push(`phantom_elements[${index}] must be object`);
        return;
      }
      const entry = item as Record<string, unknown>;
      checkExactKeys(entry, ["selector", "action", "reason"], `phantom_elements[${index}]`);
      checkString(entry.selector, `phantom_elements[${index}].selector`);
      if (entry.action !== "remove") {
        errors.push(`phantom_elements[${index}].action must be remove`);
      }
      checkString(entry.reason, `phantom_elements[${index}].reason`);
    });
  }

  if (Array.isArray(root.requires_human_review)) {
    root.requires_human_review.forEach((item, index) => {
      if (!isPlainObject(item)) {
        errors.push(`requires_human_review[${index}] must be object`);
        return;
      }
      const entry = item as Record<string, unknown>;
      checkExactKeys(entry, ["issue", "context"], `requires_human_review[${index}]`);
      checkString(entry.issue, `requires_human_review[${index}].issue`);
      checkString(entry.context, `requires_human_review[${index}].context`);
    });
  }

  return { ok: errors.length === 0, errors };
}

function copyStyleProperties(
  stylesByClass: Map<string, WebflowStyle>,
  sourceClass: string,
  allowedProps: Set<string>
): Record<string, string> {
  const style = stylesByClass.get(sourceClass);
  if (!style) return {};
  const props = parseStyleLess(style.styleLess);
  const copied: Record<string, string> = {};
  for (const [prop, value] of props.entries()) {
    if (!allowedProps.has(prop)) continue;
    copied[prop] = value;
  }
  return copied;
}

function findParentsForChildClass(
  payload: WebflowPayload,
  parentClass: string,
  childClass: string
): string[] {
  const parentByChildId = new Map<string, WebflowNode>();
  for (const node of payload.payload.nodes) {
    if (!node.children) continue;
    for (const childId of node.children) {
      parentByChildId.set(childId, node);
    }
  }

  const targets: string[] = [];
  for (const node of payload.payload.nodes) {
    if (node.text) continue;
    if (!node.classes?.includes(childClass)) continue;
    const parent = parentByChildId.get(node._id);
    if (!parent) continue;
    if (parent.classes?.includes(parentClass)) continue;
    targets.push(parent._id);
  }

  return targets;
}

function extractPhantomNodeIds(phantoms: string[]): Set<string> {
  const ids = new Set<string>();
  for (const entry of phantoms) {
    const hashIndex = entry.indexOf("#");
    if (hashIndex === -1) continue;
    const id = entry.slice(hashIndex + 1).trim();
    if (id) ids.add(id);
  }
  return ids;
}

function resolvePhantomSelectors(
  selector: string,
  payload: WebflowPayload,
  phantomIds: Set<string>
): string[] {
  const normalized = selector.trim();
  if (!normalized) return [];

  const directId = resolveNodeIdFromSelector(normalized);
  if (directId && phantomIds.has(directId)) {
    return [directId];
  }

  if (normalized.startsWith(".")) {
    const className = normalized.slice(1);
    const matches: string[] = [];
    for (const node of payload.payload.nodes) {
      if (node.text) continue;
      if (!node.classes?.includes(className)) continue;
      if (phantomIds.has(node._id)) matches.push(node._id);
    }
    return matches;
  }

  if (phantomIds.has(normalized)) {
    return [normalized];
  }

  return [];
}

function resolveNodeIdFromSelector(selector: string): string | null {
  if (selector.startsWith("#")) return selector.slice(1);
  const hashIndex = selector.indexOf("#");
  if (hashIndex !== -1) return selector.slice(hashIndex + 1);
  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function applySemanticPatches(
  payload: WebflowPayload,
  patches: SemanticPatchInstruction[]
): { payload: WebflowPayload; applied: string[] } {
  const applied: string[] = [];
  const stylesByClass = new Map<string, WebflowStyle>();
  for (const style of payload.payload.styles) {
    stylesByClass.set(style.name, style);
  }

  const nodesById = new Map<string, WebflowNode>();
  for (const node of payload.payload.nodes) {
    nodesById.set(node._id, node);
  }

  for (const patch of patches) {
    switch (patch.op) {
      case "mergeStyle": {
        if (!patch.className) break;
        const style = ensureStyle(stylesByClass, payload, patch.className);
        const merged = mergeStyleLess(
          style.styleLess,
          patch.properties ? propertiesToStyleLess(patch.properties) : patch.styleLess || ""
        );
        style.styleLess = merged;
        applied.push(`mergeStyle:${patch.className}`);
        break;
      }
      case "setStyle": {
        if (!patch.className || !patch.styleLess) break;
        const style = ensureStyle(stylesByClass, payload, patch.className);
        style.styleLess = normalizeStyleLess(patch.styleLess);
        applied.push(`setStyle:${patch.className}`);
        break;
      }
      case "mergeVariant": {
        if (!patch.className || !patch.variant) break;
        const style = ensureStyle(stylesByClass, payload, patch.className);
        const current = style.variants[patch.variant]?.styleLess ?? "";
        const merged = mergeStyleLess(
          current,
          patch.properties ? propertiesToStyleLess(patch.properties) : patch.styleLess || ""
        );
        style.variants[patch.variant] = { styleLess: merged };
        applied.push(`mergeVariant:${patch.className}:${patch.variant}`);
        break;
      }
      case "setVariant": {
        if (!patch.className || !patch.variant || !patch.styleLess) break;
        const style = ensureStyle(stylesByClass, payload, patch.className);
        style.variants[patch.variant] = { styleLess: normalizeStyleLess(patch.styleLess) };
        applied.push(`setVariant:${patch.className}:${patch.variant}`);
        break;
      }
      case "addClassToNode": {
        if (!patch.nodeId || !patch.className) break;
        const node = nodesById.get(patch.nodeId);
        if (!node) break;
        if (!node.classes) node.classes = [];
        if (!node.classes.includes(patch.className)) {
          node.classes.push(patch.className);
        }
        applied.push(`addClass:${patch.nodeId}:${patch.className}`);
        break;
      }
      case "removeNode": {
        if (!patch.nodeId) break;
        removeNodeAndDescendants(payload, patch.nodeId);
        applied.push(`removeNode:${patch.nodeId}`);
        break;
      }
      default:
        break;
    }
  }

  return { payload, applied };
}

function ensureStyle(
  stylesByClass: Map<string, WebflowStyle>,
  payload: WebflowPayload,
  className: string
): WebflowStyle {
  const existing = stylesByClass.get(className);
  if (existing) return existing;

  const created: WebflowStyle = {
    _id: className,
    fake: false,
    type: "class",
    name: className,
    namespace: "",
    comb: "",
    styleLess: "",
    variants: {},
    children: [],
  };
  payload.payload.styles.push(created);
  stylesByClass.set(className, created);
  return created;
}

function removeNodeAndDescendants(payload: WebflowPayload, nodeId: string): void {
  const nodesById = new Map<string, WebflowNode>();
  for (const node of payload.payload.nodes) {
    nodesById.set(node._id, node);
  }

  const toRemove = new Set<string>();
  const stack = [nodeId];

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId || toRemove.has(currentId)) continue;
    toRemove.add(currentId);
    const node = nodesById.get(currentId);
    if (node?.children) {
      node.children.forEach((childId) => stack.push(childId));
    }
  }

  payload.payload.nodes = payload.payload.nodes.filter((node) => !toRemove.has(node._id));
  for (const node of payload.payload.nodes) {
    if (node.children) {
      node.children = node.children.filter((childId) => !toRemove.has(childId));
    }
  }
}

function summarizeDiagnostics(diagnostics: DiagnosticReport): string[] {
  return [
    ...diagnostics.missingFonts,
    ...diagnostics.layoutDegradation,
    ...diagnostics.missingSpacing,
    ...diagnostics.orphanedElements,
    ...diagnostics.phantomElements,
  ];
}

function analyzeHtml(html: string): HtmlAnalysis {
  const classes = new Map<string, number>();
  const tags = new Map<string, number>();
  const elements: Array<{ tag: string; classes: string[] }> = [];

  const tagRegex = /<([a-zA-Z][\w-]*)([^>]*)>/g;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    if (SKIP_TAGS.has(tag)) continue;

    const attrs = match[2] ?? "";
    const classMatch = attrs.match(/class\s*=\s*["']([^"']*)["']/);
    const classList = classMatch ? classMatch[1].split(/\s+/).filter(Boolean) : [];

    tags.set(tag, (tags.get(tag) || 0) + 1);
    elements.push({ tag, classes: classList });

    for (const cls of classList) {
      classes.set(cls, (classes.get(cls) || 0) + 1);
    }
  }

  return { classes, tags, elements };
}

function analyzePayload(payload: WebflowPayload): PayloadAnalysis {
  const classes = new Map<string, number>();
  const tags = new Map<string, number>();
  const nodesById = new Map<string, WebflowNode>();

  for (const node of payload.payload.nodes) {
    nodesById.set(node._id, node);
    if (node.text) continue;
    const tag = (node.tag || "div").toLowerCase();
    tags.set(tag, (tags.get(tag) || 0) + 1);

    for (const cls of node.classes || []) {
      classes.set(cls, (classes.get(cls) || 0) + 1);
    }
  }

  return { classes, tags, nodesById };
}

function buildElementSignature(tag: string, classes: string[]): string {
  const normalized = classes.slice().sort().join(".");
  return `${tag}|${normalized}`;
}

function buildElementSignatureCounts(
  elements: Array<{ tag: string; classes: string[] }>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const element of elements) {
    const signature = buildElementSignature(element.tag, element.classes);
    counts.set(signature, (counts.get(signature) || 0) + 1);
  }
  return counts;
}

function parseStyleLess(styleLess: string): Map<string, string> {
  const props = new Map<string, string>();
  if (!styleLess) return props;

  const clean = styleLess.replace(/\/\*[\s\S]*?\*\//g, "");
  clean.split(";").forEach((chunk) => {
    const part = chunk.trim();
    if (!part) return;
    const colonIndex = part.indexOf(":");
    if (colonIndex === -1) return;
    const name = part.slice(0, colonIndex).trim().toLowerCase();
    const value = part.slice(colonIndex + 1).trim();
    if (!name || !value) return;
    props.set(name, value);
  });

  return props;
}

function normalizeStyleLess(styleLess: string): string {
  return styleLess
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => (chunk.endsWith(";") ? chunk : `${chunk};`))
    .join(" ");
}

function mergeStyleLess(base: string, patch: string): string {
  const baseProps = parseStyleLess(base);
  const patchProps = parseStyleLess(patch);

  for (const [key, value] of patchProps.entries()) {
    baseProps.set(key, value);
  }

  return Array.from(baseProps.entries())
    .map(([prop, val]) => `${prop}: ${val};`)
    .join(" ");
}

function getStyleProperty(styleLess: string, property: string): string | null {
  const props = parseStyleLess(styleLess);
  return props.get(property.toLowerCase()) || null;
}

function isFallbackFont(actual: string, expected: string): boolean {
  const actualLower = actual.toLowerCase();
  const expectedLower = expected.toLowerCase();

  if (actualLower === expectedLower) return false;
  const usesFallback = FONT_FALLBACKS.some((fallback) => actualLower.includes(fallback));
  const expectedHasFallback = FONT_FALLBACKS.some((fallback) => expectedLower.includes(fallback));
  return usesFallback && !expectedHasFallback;
}

function resolvePayloadCssVariables(payload: WebflowPayload, variables: Map<string, string>): WebflowPayload {
  for (const style of payload.payload.styles) {
    style.styleLess = resolveCssVariables(style.styleLess, variables).resolved;
    for (const [variant, entry] of Object.entries(style.variants)) {
      style.variants[variant] = {
        styleLess: resolveCssVariables(entry.styleLess, variables).resolved,
      };
    }
  }
  return payload;
}

function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function buildClaudePrompt(params: {
  html: string;
  css: string;
  payload: WebflowPayload;
  diagnostics: DiagnosticReport;
}): string {
  return `INPUTS:

1. ORIGINAL_HTML
<<<HTML
${params.html}
HTML

2. ORIGINAL_CSS
<<<CSS
${params.css}
CSS

3. GENERATED_WEBFLOW_OUTPUT
<<<WEBFLOW
${JSON.stringify(params.payload)}
WEBFLOW

4. DIAGNOSTIC_REPORT
<<<REPORT
${JSON.stringify(params.diagnostics, null, 2)}
REPORT


OBJECTIVE:

Produce PATCH INSTRUCTIONS that make the Webflow output
visually and structurally equivalent to the original HTML/CSS.

You may ONLY:
- Recover layout intent
- Resolve CSS variables to concrete values
- Map element typography to class-based styles
- Make browser defaults explicit
- Remove phantom elements not present in original HTML

You may NOT:
- Redesign
- Remove components
- Change copy
- Invent elements
- Simplify layouts

If something is ambiguous, mark it as "requires_human_review".

RETURN JSON MATCHING THE SCHEMA EXACTLY.`;
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error("Usage: bun run tsx lib/webflow-transcoder.ts <html-file> <css-file>");
    process.exit(1);
  }

  const [htmlPath, cssPath] = args;
  const html = readFileSync(htmlPath, "utf-8");
  const css = readFileSync(cssPath, "utf-8");

  transcodeHtmlCssToWebflow(html, css)
    .then((result) => {
      console.log(result.webflowJson);
      console.log(result.tokenPayloadJson);
      console.log(JSON.stringify(result.report, null, 2));
    })
    .catch((error) => {
      console.error("Transcoding failed:", error);
      process.exit(1);
    });
}

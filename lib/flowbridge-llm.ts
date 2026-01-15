/**
 * Flowbridge OpenRouter LLM integration (server-side).
 */

import { mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  FLOWBRIDGE_LLM_SCHEMA,
  type FlowbridgeSemanticPatchRequest,
  type FlowbridgeSemanticPatchResponse,
  type FlowbridgeSemanticPatchResult,
  type FlowbridgeComponentSplit,
  validateSemanticPatchResponse,
} from "./flowbridge-semantic";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

const SYSTEM_PROMPT = `You are a "semantic patch generator" for an HTML->Webflow conversion pipeline.

You will NOT generate Webflow JSON from scratch.
You will ONLY return a JSON patch that improves our existing deterministic parse.

We will give you:
1) A DOM outline (nodeId, tag, classes, ids, brief text snippet).
2) A current component split: components[{componentId, name, rootNodeIds[]}].
3) A warnings summary (e.g. descendant selector flattening).
4) A small CSS token map (resolved :root vars if available).
5) The full normalized HTML and each component's HTML.
6) A full, authoritative HTML slice for each component (componentFullHtml).

Your job:
- Rename components to stable human names (Nav, Hero, Pricing, Footer, etc.).
- Replace component HTML only when a section needs its child layout restored.
- Replace the final CSS only when unresolved variables or layout-critical rules are missing.
If a component's HTML is missing cards/grids that exist in componentFullHtml, return a replaceHtml patch using componentFullHtml.

Rules:
- Output MUST be valid JSON matching the schema below.
- Use only componentIds provided.
- Keep changes minimal and use notes for brief reasons.

Return ONLY JSON. No commentary.

JSON SCHEMA (conceptual):
${JSON.stringify(FLOWBRIDGE_LLM_SCHEMA, null, 2)}`;

const DEBUG_DIR_NAME = "flowbridge-llm-debug";

export async function requestFlowbridgeSemanticPatch(
  request: FlowbridgeSemanticPatchRequest,
  options: {
    model?: string;
    apiKey?: string;
  } = {}
): Promise<FlowbridgeSemanticPatchResult> {
  const strict = process.env.FLOWBRIDGE_STRICT_LLM === "1";
  const mockFallback = (params: { reason: string; model?: string; latencyMs?: number; inputTokens?: number }) => {
    const patch = runMockSemanticPatch(request);
    const outputSize = JSON.stringify(patch).length;
    return {
      patch,
      meta: {
        mode: "mock" as const,
        model: "mock",
        latencyMs: params.latencyMs,
        inputTokens: params.inputTokens,
        outputTokens: estimateTokens(JSON.stringify(patch)),
        outputSize,
        reason: params.reason,
      },
    } satisfies FlowbridgeSemanticPatchResult;
  };

  if (process.env.USE_LLM === "0") {
    return {
      patch: null,
      meta: { mode: "fallback", reason: "use_llm_disabled" },
    };
  }

  if (process.env.FLOWBRIDGE_LLM_MOCK === "1") {
    const start = Date.now();
    const inputTokens = estimateTokens(JSON.stringify(request));
    console.info("LLM_START", { model: "mock", inputTokens });
    const patch = runMockSemanticPatch(request);
    const outputSize = JSON.stringify(patch).length;
    const latencyMs = Date.now() - start;
    console.info("LLM_END", { latencyMs, outputSize });
    if (process.env.FLOWBRIDGE_LLM_DEBUG === "1") {
      writeDebugPayload({
        request: { model: "mock", request },
        response: patch,
      });
    }
    return {
      patch,
      meta: {
        mode: "mock",
        model: "mock",
        latencyMs,
        inputTokens,
        outputTokens: estimateTokens(JSON.stringify(patch)),
        outputSize,
      },
    };
  }

  const apiKey =
    options.apiKey ||
    process.env.FLOWSTACH_OPENROUTER_KEY ||
    process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    const error = new Error("LLM_CONFIG_MISSING: missing_api_key");
    if (strict) throw error;
    console.warn("LLM_CONFIG_MISSING", { reason: "missing_api_key" });
    return mockFallback({ reason: "missing_api_key" });
  }

  const optionModel =
    typeof options.model === "string" && options.model.trim().length > 0 ? options.model.trim() : undefined;
  const envModel =
    typeof process.env.OPENROUTER_MODEL === "string" && process.env.OPENROUTER_MODEL.trim().length > 0
      ? process.env.OPENROUTER_MODEL.trim()
      : undefined;
  const model = normalizeOpenRouterModel(optionModel || envModel || DEFAULT_MODEL);
  if (!model) {
    const error = new Error("LLM_CONFIG_MISSING: missing_model");
    if (strict) throw error;
    console.warn("LLM_CONFIG_MISSING", { reason: "missing_model" });
    return mockFallback({ reason: "missing_model" });
  }

  const userPrompt = buildUserPrompt(request);
  const inputTokens = estimateTokens(`${SYSTEM_PROMPT}\n${userPrompt}`);
  const start = Date.now();
  console.info("LLM_START", { model, inputTokens });
  const debugEnabled = process.env.FLOWBRIDGE_LLM_DEBUG === "1";
  const debugRequest = {
    model,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    request,
  };

  let responseText = "";
  let latencyMs = 0;
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://flowstach.local",
        "X-Title": "Flow Stach Flowbridge Semantic Repair",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 3000,
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    responseText = await response.text();
    latencyMs = Date.now() - start;
    console.info("LLM_END", {
      latencyMs,
      outputSize: responseText.length,
    });

    if (debugEnabled) {
      writeDebugPayload({
        request: debugRequest,
        response: responseText,
      });
    }

    if (!response.ok) {
      console.warn("LLM_INVALID_FALLBACK", {
        reason: "openrouter_error",
        status: response.status,
        body: responseText.slice(0, 500),
      });
      if (strict) {
        throw new Error(`LLM_INVALID_FALLBACK: openrouter_error ${response.status}`);
      }
      return mockFallback({
        reason: `openrouter_error_${response.status}`,
        model,
        latencyMs,
        inputTokens,
      });
    }
  } catch (error) {
    if (debugEnabled) {
      writeDebugPayload({
        request: debugRequest,
        response: { error: String(error) },
      });
    }
    console.warn("LLM_INVALID_FALLBACK", {
      reason: "fetch_error",
      error: String(error),
    });
    if (strict) throw error;
    return mockFallback({ reason: "fetch_error", model, inputTokens });
  }

  let data: unknown;
  try {
    data = JSON.parse(responseText);
  } catch (error) {
    console.warn("LLM_INVALID_FALLBACK", {
      reason: "invalid_json",
      error: String(error),
    });
    if (strict) throw error;
    return mockFallback({ reason: "invalid_json", model, latencyMs, inputTokens });
  }

  const content = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message
    ?.content;
  if (!content) {
    console.warn("LLM_INVALID_FALLBACK", { reason: "empty_content" });
    if (strict) throw new Error("LLM_INVALID_FALLBACK: empty_content");
    return mockFallback({ reason: "empty_content", model, latencyMs, inputTokens });
  }

  let parsed: FlowbridgeSemanticPatchResponse;
  try {
    const jsonText = typeof content === "string" ? extractJson(content) ?? content : JSON.stringify(content);
    parsed = JSON.parse(jsonText) as FlowbridgeSemanticPatchResponse;
  } catch (error) {
    console.warn("LLM_INVALID_FALLBACK", { reason: "response_parse_error", error: String(error) });
    if (strict) throw error;
    return mockFallback({ reason: "response_parse_error", model, latencyMs, inputTokens });
  }

  const validation = validateSemanticPatchResponse(parsed);
  if (!validation.ok) {
    console.warn("LLM_INVALID_FALLBACK", {
      reason: "schema_invalid",
      errors: validation.errors,
    });
    if (strict) {
      throw new Error(`LLM_INVALID_FALLBACK: schema_invalid ${validation.errors.join(", ")}`);
    }
    return mockFallback({ reason: "schema_invalid", model, latencyMs, inputTokens });
  }

  const usage = (data as { usage?: { completion_tokens?: unknown; prompt_tokens?: unknown } }).usage;
  const outputTokens = typeof usage?.completion_tokens === "number" ? usage.completion_tokens : undefined;
  const reportedInputTokens = typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : inputTokens;

  return {
    patch: parsed,
    meta: {
      mode: "live",
      model,
      latencyMs,
      inputTokens: reportedInputTokens,
      outputTokens,
      outputSize: responseText.length,
    },
  };
}

function buildUserPrompt(request: FlowbridgeSemanticPatchRequest): string {
  return [
    "DOM_OUTLINE:",
    JSON.stringify(request.domOutline, null, 2),
    "",
    "COMPONENTS:",
    JSON.stringify(request.components, null, 2),
    "",
    "COMPONENT_HTML:",
    JSON.stringify(request.componentHtml, null, 2),
    "",
    "COMPONENT_FULL_HTML:",
    JSON.stringify(request.componentFullHtml, null, 2),
    "",
    "FULL_HTML:",
    request.fullHtml,
    "",
    "WARNINGS:",
    JSON.stringify(request.warnings, null, 2),
    "",
    "CSS_TOKENS:",
    JSON.stringify(request.tokens, null, 2),
  ].join("\n");
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function writeDebugPayload(payload: { request: unknown; response: unknown }): void {
  const dir = join(tmpdir(), DEBUG_DIR_NAME);
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const requestPath = join(dir, `${stamp}-request.json`);
  const responsePath = join(dir, `${stamp}-response.json`);
  writeFileSync(requestPath, JSON.stringify(payload.request, null, 2), "utf-8");
  writeFileSync(
    responsePath,
    typeof payload.response === "string" ? payload.response : JSON.stringify(payload.response, null, 2),
    "utf-8"
  );
}

function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function normalizeOpenRouterModel(model: string): string {
  const normalized = model.trim();
  if (normalized === "anthropic/claude-sonnet-4.0") return "anthropic/claude-sonnet-4";
  return normalized;
}

function runMockSemanticPatch(
  request: FlowbridgeSemanticPatchRequest
): FlowbridgeSemanticPatchResponse {
  const nodeById = new Map(request.domOutline.map((node) => [node.nodeId, node]));
  const componentHtmlByComponentId = new Map(request.componentHtml.map((entry) => [entry.componentId, entry.html]));
  const fullHtmlByComponentId = new Map(request.componentFullHtml.map((entry) => [entry.componentId, entry.html]));
  const assigned = new Set<string>();
  const renames: FlowbridgeSemanticPatchResponse["componentRenames"] = [];

  const pickName = (component: FlowbridgeComponentSplit): string | null => {
    const primaryNodeId = component.rootNodeIds[0];
    const node = primaryNodeId ? nodeById.get(primaryNodeId) : undefined;
    const tag = node?.tag || "";
    const classText = node?.classes.join(" ").toLowerCase() || "";
    const idText = node?.id?.toLowerCase() || "";
    const text = node?.text?.toLowerCase() || "";
    const name = component.name.toLowerCase();
    const html = componentHtmlByComponentId.get(component.componentId) || fullHtmlByComponentId.get(component.componentId) || "";
    const htmlLower = html.toLowerCase();

    if (
      tag === "nav" ||
      /<nav\b/i.test(html) ||
      classText.includes("nav") ||
      name.includes("nav") ||
      htmlLower.includes("w-nav")
    ) {
      return "Nav";
    }

    if (/<h1\b/i.test(html) || classText.includes("hero") || idText.includes("hero") || name.includes("hero")) {
      return "Hero";
    }

    if (
      idText.includes("pricing") ||
      classText.includes("pricing") ||
      name.includes("pricing") ||
      htmlLower.includes("pricing") ||
      htmlLower.includes("price") ||
      htmlLower.includes("plan") ||
      htmlLower.includes("billing") ||
      htmlLower.includes("per month") ||
      htmlLower.includes("monthly") ||
      htmlLower.includes("yearly") ||
      htmlLower.includes("$")
    ) {
      return "Pricing";
    }

    if (
      idText.includes("features") ||
      classText.includes("features") ||
      classText.includes("bento") ||
      htmlLower.includes("features-section") ||
      htmlLower.includes("features-bento") ||
      htmlLower.includes("bento")
    ) {
      return "Bento/Features";
    }

    if (idText.includes("problem") || classText.includes("problem") || htmlLower.includes("the problem")) {
      return "Problem";
    }

    if (
      idText.includes("how") ||
      text.includes("how it works") ||
      classText.includes("steps") ||
      htmlLower.includes("how it works") ||
      htmlLower.includes("steps")
    ) {
      return "How it works";
    }

    if (
      tag === "footer" ||
      /<footer\b/i.test(html) ||
      classText.includes("footer") ||
      name.includes("footer") ||
      htmlLower.includes("copyright")
    ) {
      return "Footer";
    }
    return null;
  };

  for (const component of request.components) {
    const newName = pickName(component);
    if (!newName || assigned.has(newName) || newName === component.name) continue;
    assigned.add(newName);
    renames.push({
      id: component.componentId,
      name: newName,
    });
  }

  const response: FlowbridgeSemanticPatchResponse = {
    componentRenames: renames,
    htmlPatches: [],
    cssPatches: [],
    notes: [],
  };

  const validation = validateSemanticPatchResponse(response);
  if (!validation.ok) {
    throw new Error(`Mock response invalid: ${validation.errors.join(", ")}`);
  }

  return response;
}

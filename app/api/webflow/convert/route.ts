import { NextResponse } from "next/server";
import { isValidWebflowPayload, type WebflowPayload } from "@/lib/webflow-converter";

// Debug mode - set WEBFLOW_CONVERT_DEBUG=true for verbose logging
const DEBUG = process.env.WEBFLOW_CONVERT_DEBUG === "true";

type ConvertRequest = {
  html: string;
  css: string;
  idPrefix?: string;
  sectionName?: string;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const WEBFLOW_PAYLOAD_SCHEMA = {
  name: "webflow_payload",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["type", "payload", "meta"],
    properties: {
      type: { const: "@webflow/XscpData" },
      payload: {
        type: "object",
        additionalProperties: false,
        required: ["nodes", "styles", "assets", "ix1", "ix2"],
        properties: {
          nodes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["_id"],
              properties: {
                _id: { type: "string" },
                type: {
                  type: "string",
                  enum: [
                    "Block",
                    "Link",
                    "Image",
                    "Video",
                    "HtmlEmbed",
                    "Heading",
                    "Paragraph",
                    "Section",
                    "List",
                    "ListItem",
                  ],
                },
                tag: { type: "string" },
                classes: { type: "array", items: { type: "string" } },
                children: { type: "array", items: { type: "string" } },
                text: { type: "boolean" },
                v: { type: "string" },
                data: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    tag: { type: "string" },
                    text: { type: "boolean" },
                    xattr: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        required: ["name", "value"],
                        properties: {
                          name: { type: "string" },
                          value: { type: "string" },
                        },
                      },
                    },
                    link: {
                      type: "object",
                      additionalProperties: false,
                      required: ["mode", "url"],
                      properties: {
                        mode: { type: "string" },
                        url: { type: "string" },
                        target: { type: "string" },
                      },
                    },
                    attr: {
                      type: "object",
                      additionalProperties: false,
                      required: ["src", "alt"],
                      properties: {
                        src: { type: "string" },
                        alt: { type: "string" },
                        loading: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          styles: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "_id",
                "fake",
                "type",
                "name",
                "namespace",
                "comb",
                "styleLess",
                "variants",
                "children",
              ],
              properties: {
                _id: { type: "string" },
                fake: { type: "boolean" },
                type: { const: "class" },
                name: { type: "string" },
                namespace: { type: "string" },
                comb: { type: "string" },
                styleLess: { type: "string" },
                variants: {
                  type: "object",
                  additionalProperties: {
                    type: "object",
                    additionalProperties: false,
                    required: ["styleLess"],
                    properties: {
                      styleLess: { type: "string" },
                    },
                  },
                },
                children: { type: "array", items: { type: "string" } },
              },
            },
          },
          assets: { type: "array" },
          ix1: { type: "array" },
          ix2: {
            type: "object",
            additionalProperties: false,
            required: ["interactions", "events", "actionLists"],
            properties: {
              interactions: { type: "array" },
              events: { type: "array" },
              actionLists: { type: "array" },
            },
          },
        },
      },
      meta: {
        type: "object",
        additionalProperties: false,
        required: [
          "unlinkedSymbolCount",
          "droppedLinks",
          "dynBindRemovedCount",
          "dynListBindRemovedCount",
          "paginationRemovedCount",
        ],
        properties: {
          unlinkedSymbolCount: { type: "integer" },
          droppedLinks: { type: "integer" },
          dynBindRemovedCount: { type: "integer" },
          dynListBindRemovedCount: { type: "integer" },
          paginationRemovedCount: { type: "integer" },
        },
      },
    },
  },
} as const;

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractCssVariables(css: string): Map<string, string> {
  const variables = new Map<string, string>();

  // Match :root and .fp-root blocks
  const rootBlocks = css.matchAll(/:root\s*\{([^}]*)\}|\.fp-root\s*\{([^}]*)\}/g);

  for (const match of rootBlocks) {
    const content = match[1] || match[2];
    if (!content) continue;

    // Extract variable definitions: --name: value;
    const varMatches = content.matchAll(/--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g);
    for (const varMatch of varMatches) {
      const name = `--${varMatch[1]}`;
      const value = varMatch[2].trim();
      variables.set(name, value);
    }
  }

  return variables;
}

function resolveCssVariables(css: string, variables: Map<string, string>): string {
  // Replace var(--name) with actual values
  // Also handle var(--name, fallback)
  return css.replace(/var\(([^)]+)\)/g, (match, content) => {
    const parts = content.split(',').map((p: string) => p.trim());
    const varName = parts[0]; // --variable-name
    const fallback = parts[1]; // optional fallback

    const value = variables.get(varName);
    if (value) {
      // If the value itself contains var(), resolve recursively
      if (value.includes('var(')) {
        return resolveCssVariables(value, variables);
      }
      return value;
    }
    return fallback || match; // Use fallback or keep original if not found
  });
}

function stripTokenBlocks(css: string): string {
  return css
    .replace(/:root\s*\{[^}]*\}/g, "")
    .replace(/\.fp-root\s*\{[^}]*\}/g, "")
    .trim();
}

function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function buildPrompt(input: ConvertRequest): string {
  const html = compactWhitespace(input.html);

  // Extract CSS variables BEFORE stripping token blocks
  const cssVariables = extractCssVariables(input.css);

  // Strip :root blocks and resolve all var() references
  const strippedCss = stripTokenBlocks(input.css);
  const resolvedCss = resolveCssVariables(strippedCss, cssVariables);
  const css = compactWhitespace(resolvedCss);

  const prefix = input.idPrefix || "wf";
  const sectionName = input.sectionName || "section";

  return `You convert HTML + CSS into Webflow clipboard JSON. Return ONLY valid JSON.

## NODES
- _id: unique, prefixed with "${prefix}-"
- Element: { _id, type, tag, classes: [], children: [], data: { tag, text: false } }
- Text: { _id, text: true, v: "content" }
- Types: section→Section, h1-h6→Heading, p→Paragraph, a→Link, img→Image, div→Block
- Link data: { link: { mode: "external", url: "..." } }
- Image data: { attr: { src: "...", alt: "..." } }

## STYLES (preserve ALL CSS with resolved values)
- One style per class: { _id, fake: false, type: "class", name, namespace: "", comb: "", styleLess: "...", variants: {}, children: [] }
- styleLess: ALL properties with RESOLVED values (no var() references)
- Remove only: transition, animation properties
- Variants for pseudo-classes: { hover: { styleLess: "..." } }
- Variants for breakpoints: medium (≤991px), small (≤767px), tiny (≤479px)

## BACKGROUND COLOR RULES (IMPORTANT)
- Page background comes from design tokens (via page-wrapper class) - NOT from individual components
- Only include background-color on a component IF the CSS explicitly defines a DIFFERENT background
- Components like cards, modals, or colored sections should keep their explicit background colors
- DO NOT add background: transparent or background: inherit - just omit the property
- If a section has the SAME background as the page (e.g., dark bg on dark page), OMIT the background property

## SECTION/PAGE MARGINS
- Horizontal page margins (padding-left/right) come from the page-wrapper class - NOT from sections
- DO NOT include site-wide horizontal padding in section styles
- Sections should have their own internal padding if needed, but NOT the outer page margins
- Components will sit inside a page-wrapper that provides consistent edge spacing

## EXAMPLE OUTPUT
{
  "type": "@webflow/XscpData",
  "payload": {
    "nodes": [
      { "_id": "${prefix}-section-1", "type": "Section", "tag": "section", "classes": ["hero"], "children": ["${prefix}-heading-1"], "data": { "tag": "section", "text": false } },
      { "_id": "${prefix}-heading-1", "type": "Heading", "tag": "h1", "classes": ["hero-title"], "children": ["${prefix}-text-1"], "data": { "tag": "h1", "text": false } },
      { "_id": "${prefix}-text-1", "text": true, "v": "Hello World" }
    ],
    "styles": [
      { "_id": "hero", "fake": false, "type": "class", "name": "hero", "namespace": "", "comb": "", "styleLess": "min-height: 100vh; padding: 8rem 0;", "variants": { "small": { "styleLess": "padding: 4rem 0;" } }, "children": [] },
      { "_id": "hero-title", "fake": false, "type": "class", "name": "hero-title", "namespace": "", "comb": "", "styleLess": "font-size: 3rem; color: #ffffff; font-weight: 700;", "variants": {}, "children": [] }
    ],
    "assets": [],
    "ix1": [],
    "ix2": { "interactions": [], "events": [], "actionLists": [] }
  },
  "meta": { "unlinkedSymbolCount": 0, "droppedLinks": 0, "dynBindRemovedCount": 0, "dynListBindRemovedCount": 0, "paginationRemovedCount": 0 }
}

## INPUT - Section: ${sectionName}
HTML:
${html}

CSS (variables already resolved - copy ALL properties exactly):
${css}`;
}

export async function POST(request: Request) {
  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // Use FLOWSTACH_OPENROUTER_KEY to avoid Windows env var conflicts
  const apiKey = process.env.FLOWSTACH_OPENROUTER_KEY || process.env.OPENROUTER_API_KEY;

  // Debug: Log which API key is being used (first 20 chars only for security)
  console.info("[webflow-convert]", requestId, "env_check", {
    hasKey: !!apiKey,
    keyPrefix: apiKey ? apiKey.slice(0, 20) + "..." : "none",
    keyLength: apiKey?.length || 0,
    model: process.env.OPENROUTER_MODEL || "default",
  });

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENROUTER_API_KEY", requestId },
      { status: 500 }
    );
  }

  let body: ConvertRequest;
  try {
    body = (await request.json()) as ConvertRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.html || !body?.css) {
    return NextResponse.json(
      { error: "Missing html or css in request", requestId },
      { status: 400 }
    );
  }

  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4.1";

  // Log CSS variable resolution
  const cssVars = extractCssVariables(body.css);
  if (DEBUG && cssVars.size > 0) {
    console.info("[webflow-convert]", requestId, "css_variables_resolved", {
      count: cssVars.size,
      variables: Array.from(cssVars.keys()).slice(0, 10),
    });
  }

  const prompt = buildPrompt(body);
  console.info("[webflow-convert]", requestId, "request", {
    model,
    sectionName: body.sectionName,
    htmlLength: body.html.length,
    cssLength: body.css.length,
    cssVarsResolved: cssVars.size,
  });

  if (DEBUG) {
    console.info("[webflow-convert]", requestId, "prompt_preview", {
      promptLength: prompt.length,
      promptSnippet: prompt.slice(0, 500) + "...",
    });
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://flowstach.local",
      "X-Title": "Flow Stach Webflow Converter",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      structured_outputs: true,
      response_format: {
        type: "json_schema",
        json_schema: WEBFLOW_PAYLOAD_SCHEMA,
      },
      messages: [
        {
          role: "system",
          content:
            "You are a precise converter that outputs only valid JSON for Webflow clipboard payloads.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.warn("[webflow-convert]", requestId, "openrouter_error", {
      status: response.status,
      body: errorText.slice(0, 1000),
    });
    return NextResponse.json(
      { error: "OpenRouter request failed", details: errorText, requestId },
      { status: response.status }
    );
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (DEBUG) {
    console.info("[webflow-convert]", requestId, "raw_response", {
      hasChoices: !!data?.choices,
      choicesLength: data?.choices?.length,
      hasContent: !!content,
      contentType: typeof content,
      finishReason: data?.choices?.[0]?.finish_reason,
    });
  }

  if (!content) {
    console.warn("[webflow-convert]", requestId, "empty_content", {
      rawData: JSON.stringify(data).slice(0, 500),
    });
    return NextResponse.json(
      { error: "OpenRouter returned empty content", requestId },
      { status: 502 }
    );
  }

  let payload: WebflowPayload;
  try {
    if (typeof content === "string") {
      const jsonText = extractJson(content) ?? content;
      payload = JSON.parse(jsonText) as WebflowPayload;
    } else {
      payload = content as WebflowPayload;
    }
  } catch (parseError) {
    console.warn("[webflow-convert]", requestId, "invalid_json", {
      error: String(parseError),
      contentSnippet: typeof content === "string" ? content.slice(0, 500) : "non-string",
    });
    return NextResponse.json(
      { error: "Model returned invalid JSON", requestId },
      { status: 502 }
    );
  }

  if (!isValidWebflowPayload(payload)) {
    console.warn("[webflow-convert]", requestId, "invalid_payload", {
      hasType: "type" in payload,
      type: payload?.type,
      hasPayload: "payload" in payload,
      hasNodes: Array.isArray(payload?.payload?.nodes),
      nodesLength: payload?.payload?.nodes?.length,
      hasStyles: Array.isArray(payload?.payload?.styles),
      stylesLength: payload?.payload?.styles?.length,
      hasMeta: "meta" in payload,
    });
    return NextResponse.json(
      { error: "Model returned invalid Webflow payload", requestId },
      { status: 422 }
    );
  }

  console.info("[webflow-convert]", requestId, "success", {
    nodes: payload.payload.nodes.length,
    styles: payload.payload.styles.length,
  });
  return NextResponse.json({
    model,
    webflowJson: JSON.stringify(payload),
    payload,
    requestId,
  });
}

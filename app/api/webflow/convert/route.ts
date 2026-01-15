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
  let result = css;
  let iterations = 0;
  const maxIterations = 10; // Prevent infinite loops

  while (result.includes('var(') && iterations < maxIterations) {
    result = result.replace(/var\(([^)]+)\)/g, (match, content) => {
      const parts = content.split(',').map((p: string) => p.trim());
      const varName = parts[0]; // --variable-name
      const fallback = parts[1]; // optional fallback

      const value = variables.get(varName);
      if (value) {
        return value;
      }
      return fallback || match;
    });
    iterations++;
  }

  // Warn if max iterations reached with unresolved variables
  if (iterations >= maxIterations && result.includes('var(')) {
    console.warn('[resolveCssVariables] Max iterations reached with unresolved variables:', {
      unresolvedVars: result.match(/var\([^)]+\)/g)?.slice(0, 5),
    });
  }

  return result;
}

function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

/**
 * Fix common issues with LLM-generated payloads
 * - Ensure Link nodes have data.link
 * - Ensure Image nodes have data.attr
 * - Fix invalid node types
 */
function fixPayloadIssues(payload: WebflowPayload): { payload: WebflowPayload; fixes: string[] } {
  const fixes: string[] = [];
  const validTypes = ["Block", "Link", "Image", "Video", "HtmlEmbed", "Heading", "Paragraph", "Section", "List", "ListItem"];

  for (const node of payload.payload.nodes) {
    // Skip text nodes
    if (node.text === true) continue;

    // Fix invalid node types
    if (node.type && !validTypes.includes(node.type)) {
      fixes.push(`Fixed invalid type "${node.type}" → "Block" for node ${node._id}`);
      node.type = "Block";
    }

    // Ensure Link nodes have data.link
    if (node.type === "Link" || node.tag === "a") {
      node.type = "Link";
      if (!node.data) {
        node.data = { tag: "a", text: false };
      }
      if (!node.data.link) {
        node.data.link = { mode: "external", url: "#" };
        fixes.push(`Added missing data.link to Link node ${node._id}`);
      }
    }

    // Ensure Image nodes have data.attr
    if (node.type === "Image" || node.tag === "img") {
      node.type = "Image";
      if (!node.data) {
        node.data = { tag: "img", text: false };
      }
      if (!node.data.attr) {
        node.data.attr = { src: "https://placehold.co/400x300", alt: "placeholder" };
        fixes.push(`Added missing data.attr to Image node ${node._id}`);
      }
    }

    // Fix nav/header/footer to Block type
    if (node.tag === "nav" || node.tag === "header" || node.tag === "footer") {
      if (node.type !== "Block") {
        fixes.push(`Fixed ${node.tag} type "${node.type}" → "Block" for node ${node._id}`);
        node.type = "Block";
      }
    }
  }

  return { payload, fixes };
}

interface StyleMapping {
  className: string;
  baseStyles: string;
  hoverStyles?: string;
  comboStyles: Map<string, string>; // modifier class -> additional styles
  descendantStyles: Map<string, string>; // "h3" -> styles for .class h3
}

/**
 * Parse CSS into structured rules for easier LLM processing
 */
function parseCssRules(css: string, variables: Map<string, string>): {
  classStyles: Map<string, StyleMapping>;
  tagStyles: Map<string, string>;
} {
  const classStyles = new Map<string, StyleMapping>();
  const tagStyles = new Map<string, string>();

  // First, resolve all variables
  const resolvedCss = resolveCssVariables(css, variables);

  // Helper to ensure class exists
  const ensureClass = (className: string): StyleMapping => {
    if (!classStyles.has(className)) {
      classStyles.set(className, {
        className,
        baseStyles: '',
        comboStyles: new Map(),
        descendantStyles: new Map(),
      });
    }
    return classStyles.get(className)!;
  };

  // Parse each CSS rule
  const ruleRegex = /([^{}@]+)\{([^}]+)\}/g;
  let match;

  while ((match = ruleRegex.exec(resolvedCss)) !== null) {
    const selector = match[1].trim();
    const properties = match[2].trim()
      .replace(/\s+/g, ' ')
      .replace(/;\s*/g, '; ')
      .trim();

    // Skip @rules, :root, etc.
    if (selector.startsWith('@') || selector === ':root' || selector === '.fp-root') continue;
    if (selector.includes('*')) continue; // Skip universal selectors
    if (selector.includes('::')) continue; // Skip pseudo-elements (::before, ::after)

    // Handle standalone tag selectors (h1, h2, h3, body, p, footer, etc.)
    const standaloneTagMatch = selector.match(/^(h[1-6]|body|p|a|ul|ol|li|span|strong|em|nav|footer|header|section)(?:\s*,\s*(h[1-6]|body|p|a|ul|ol|li|span|strong|em|nav|footer|header|section))*$/i);
    if (standaloneTagMatch) {
      const tags = selector.split(',').map(t => t.trim().toLowerCase());
      for (const tag of tags) {
        const existing = tagStyles.get(tag) || '';
        tagStyles.set(tag, existing ? `${existing} ${properties}` : properties);
      }
      continue;
    }

    // Extract class names from selector
    const classMatches = [...selector.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)];

    // Check for pseudo-classes
    const isHover = selector.includes(':hover');
    const isLastChild = selector.includes(':last-child');
    const hasNthChild = selector.includes(':nth-child');

    // Check if it's a descendant selector (.class tag or .class .class)
    const hasSpace = selector.includes(' ');

    if (hasSpace && classMatches.length > 0) {
      // Descendant selector: .parent tag or .parent .child
      const parentClass = classMatches[0][1];
      const parentMapping = ensureClass(parentClass);

      // Extract what comes after the parent class
      const afterParent = selector.split(/\.[a-zA-Z_-][a-zA-Z0-9_-]*/)[1]?.trim() || '';

      // Check if descendant is a tag (like h3, p, li, a)
      const descendantTagMatch = afterParent.match(/^\s*(h[1-6]|p|a|li|ul|ol|span|strong|em)(?:\s|$|:)/i);
      if (descendantTagMatch) {
        const tag = descendantTagMatch[1].toLowerCase();
        const key = isLastChild ? `${tag}:last-child` : tag;
        const existing = parentMapping.descendantStyles.get(key) || '';
        parentMapping.descendantStyles.set(key, existing ? `${existing} ${properties}` : properties);
        continue;
      }

      // Check if descendant is another class
      if (classMatches.length > 1) {
        const childClass = classMatches[1][1];
        const key = isLastChild ? `${childClass}:last-child` : childClass;
        const existing = parentMapping.descendantStyles.get(key) || '';
        parentMapping.descendantStyles.set(key, existing ? `${existing} ${properties}` : properties);
        continue;
      }
    }

    // No classes found - skip
    if (classMatches.length === 0) continue;

    // Check if it's a compound selector (.class1.class2) without space
    const isCompound = classMatches.length > 1 && !hasSpace;

    if (isCompound && !isHover) {
      // Compound selector: .base.modifier
      const baseClass = classMatches[0][1];
      const modifierClass = classMatches[1][1];
      const baseMapping = ensureClass(baseClass);

      // Add combo styles
      baseMapping.comboStyles.set(modifierClass, properties);

      // Also create the modifier class
      const modifierMapping = ensureClass(modifierClass);
      if (!modifierMapping.baseStyles) {
        modifierMapping.baseStyles = properties;
      }
    } else if (isHover && !hasSpace) {
      // Hover state on single class
      const baseClass = classMatches[0][1];
      ensureClass(baseClass).hoverStyles = properties;
    } else if (hasNthChild) {
      // nth-child - extract and create unique class
      const baseClass = classMatches[0][1];
      const nthMatch = selector.match(/:nth-child\((\d+)\)/);
      if (nthMatch) {
        const nthClass = `${baseClass}-nth-${nthMatch[1]}`;
        ensureClass(nthClass).baseStyles = properties;
      }
    } else if (!hasSpace) {
      // Simple class selector (including :last-child on class)
      const className = classMatches[0][1];
      const mapping = ensureClass(className);

      if (isLastChild) {
        // Store as variant or just append with a note
        mapping.baseStyles = mapping.baseStyles
          ? `${mapping.baseStyles} /* :last-child */ ${properties}`
          : properties;
      } else {
        mapping.baseStyles = mapping.baseStyles
          ? `${mapping.baseStyles} ${properties}`
          : properties;
      }
    }
  }

  return { classStyles, tagStyles };
}

function buildPrompt(input: ConvertRequest): string {
  const html = compactWhitespace(input.html);

  // Extract CSS variables
  const cssVariables = extractCssVariables(input.css);

  // Parse CSS into structured format
  const { classStyles, tagStyles } = parseCssRules(input.css, cssVariables);

  const prefix = input.idPrefix || "wf";

  // Build style definitions
  const styleDefinitions: string[] = [];

  // Collect combo class relationships
  const comboRelationships: Map<string, string[]> = new Map();
  for (const [className, mapping] of classStyles) {
    if (mapping.comboStyles.size > 0) {
      comboRelationships.set(className, Array.from(mapping.comboStyles.keys()));
    }
  }

  // Add class styles
  for (const [className, mapping] of classStyles) {
    const hasContent = mapping.baseStyles || mapping.hoverStyles || mapping.comboStyles.size > 0;
    if (!hasContent) continue;

    const childrenList = comboRelationships.get(className);
    const isComboModifier = Array.from(comboRelationships.values()).some(arr => arr.includes(className));

    styleDefinitions.push(`### .${className}`);

    if (mapping.baseStyles) {
      styleDefinitions.push(`styleLess: "${mapping.baseStyles}"`);
    }

    if (childrenList && childrenList.length > 0) {
      styleDefinitions.push(`children: [${childrenList.map(c => `"${c}"`).join(', ')}]`);
    }

    if (isComboModifier) {
      styleDefinitions.push(`comb: "&"  ← THIS IS A COMBO CLASS`);
      // Find which base class this modifies and show the combo styles
      for (const [baseClass, mods] of comboRelationships) {
        if (mods.includes(className)) {
          const comboStyles = classStyles.get(baseClass)?.comboStyles.get(className);
          if (comboStyles) {
            styleDefinitions.push(`(when combined with .${baseClass}): "${comboStyles}"`);
          }
        }
      }
    }

    if (mapping.hoverStyles) {
      styleDefinitions.push(`variants.hover: "${mapping.hoverStyles}"`);
    }

    // Show descendant styles as context
    if (mapping.descendantStyles.size > 0) {
      for (const [desc, styles] of mapping.descendantStyles) {
        styleDefinitions.push(`(child ${desc} gets): "${styles}"`);
      }
    }

    styleDefinitions.push('');
  }

  return `Convert HTML+CSS to Webflow clipboard JSON.

## TASK
Create nodes from HTML. Create styles from CSS. Return valid JSON only.

## COMBO CLASSES - VERY IMPORTANT
When CSS has \`.base.modifier { styles }\`, this is a COMBO CLASS:
- The BASE class needs: children: ["modifier"]
- The MODIFIER class needs: comb: "&", styleLess: "the combo styles"

Example: \`.card.featured { background: green; }\`
→ Style "card": { ..., children: ["featured"] }
→ Style "featured": { comb: "&", styleLess: "background: green;" }

## NODE TYPES - ONLY THESE ARE VALID
- Section: for <section> elements
- Block: for <div>, <nav>, <header>, <footer>, <span>, <ul>, <ol>, <li>, <article>, <aside>
- Heading: for <h1>, <h2>, <h3>, <h4>, <h5>, <h6>
- Paragraph: for <p>
- Link: for <a> elements - REQUIRES data.link!
- Image: for <img> elements - REQUIRES data.attr!
- List: for <ul>, <ol>
- ListItem: for <li>

## NODE FORMAT
Element: { "_id": "${prefix}-xxx", "type": "Block", "tag": "div", "classes": [], "children": [], "data": { "tag": "div", "text": false } }
Text: { "_id": "${prefix}-text-x", "text": true, "v": "text content" }

## LINK ELEMENTS - REQUIRED FORMAT
<a href="..."> MUST have data.link:
{ "_id": "${prefix}-link-1", "type": "Link", "tag": "a", "classes": ["btn"], "children": ["${prefix}-text-1"], "data": { "tag": "a", "text": false, "link": { "mode": "external", "url": "#" } } }

## IMAGE ELEMENTS - REQUIRED FORMAT
<img src="..." alt="..."> MUST have data.attr:
{ "_id": "${prefix}-img-1", "type": "Image", "tag": "img", "classes": [], "children": [], "data": { "tag": "img", "text": false, "attr": { "src": "https://placeholder.com/img.jpg", "alt": "description" } } }

## NAV/HEADER ELEMENTS
<nav> → type: "Block", tag: "nav"
<header> → type: "Block", tag: "header"
<footer> → type: "Block", tag: "footer"
These are NOT special types - use "Block" for all of them!

## STYLE FORMAT
{ "_id": "classname", "fake": false, "type": "class", "name": "classname", "namespace": "", "comb": "", "styleLess": "all properties;", "variants": {}, "children": [] }

- comb: "" for base class, "&" for combo modifier
- children: ["modifier"] if this class has combo modifiers
- variants: { "hover": { "styleLess": "..." } } for hover states

## STYLES TO CREATE
${styleDefinitions.join('\n')}

## TAG DEFAULTS (merge into element classes)
${Array.from(tagStyles.entries()).map(([tag, styles]) => `<${tag}>: ${styles}`).join('\n')}

## HTML
${html}

## OUTPUT
{
  "type": "@webflow/XscpData",
  "payload": {
    "nodes": [...],
    "styles": [...],
    "assets": [],
    "ix1": [],
    "ix2": { "interactions": [], "events": [], "actionLists": [] }
  },
  "meta": { "unlinkedSymbolCount": 0, "droppedLinks": 0, "dynBindRemovedCount": 0, "dynListBindRemovedCount": 0, "paginationRemovedCount": 0 }
}`;
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
  } catch (error) {
    console.warn("[webflow-convert]", requestId, "invalid_json_body", { error: String(error) });
    return NextResponse.json({ error: "Invalid JSON body", requestId }, { status: 400 });
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

  // Parse CSS for logging
  const { classStyles, tagStyles } = parseCssRules(body.css, cssVars);

  console.info("[webflow-convert]", requestId, "css_parsed", {
    cssVars: cssVars.size,
    classStyles: classStyles.size,
    tagStyles: tagStyles.size,
    classes: Array.from(classStyles.keys()).slice(0, 15),
    tags: Array.from(tagStyles.keys()),
  });

  if (DEBUG) {
    // Log detailed style info
    for (const [className, mapping] of Array.from(classStyles.entries()).slice(0, 5)) {
      console.info("[webflow-convert]", requestId, "style_detail", {
        class: className,
        baseStyles: mapping.baseStyles.slice(0, 100),
        hasHover: !!mapping.hoverStyles,
        comboCount: mapping.comboStyles.size,
      });
    }
  }

  const prompt = buildPrompt(body);
  console.info("[webflow-convert]", requestId, "request", {
    model,
    sectionName: body.sectionName,
    htmlLength: body.html.length,
    cssLength: body.css.length,
    promptLength: prompt.length,
  });

  if (DEBUG) {
    console.info("[webflow-convert]", requestId, "prompt_preview", {
      promptLength: prompt.length,
      promptSnippet: prompt.slice(0, 1000) + "...",
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

  // Fix common LLM issues with Link/Image nodes
  const { payload: fixedPayload, fixes } = fixPayloadIssues(payload);
  payload = fixedPayload;

  if (fixes.length > 0) {
    console.info("[webflow-convert]", requestId, "payload_fixes", { fixes });
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

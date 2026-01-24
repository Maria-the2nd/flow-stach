import {
  runPreflightValidation,
  validateInteractionReferences,
  validateNodeDepth,
} from "./preflight-validator";
import {
  sanitizeWebflowPayload,
  payloadLikelyNeedsSanitization,
  type EmbedContent,
  SAFE_DEPTH_LIMIT,
} from "./webflow-sanitizer";
import { prepareHTMLForWebflow } from "./validation/html-sanitizer";
import type { WebflowPayload } from "./webflow-converter";
import { chunkEmbed, type ChunkedEmbedResult } from "./embed-chunker";

export const WEBFLOW_EMBED_CHAR_LIMIT = 50_000;
export const WEBFLOW_EMBED_SOFT_LIMIT = 40_000;

export interface WebflowSafetyGateInput {
  payload: WebflowPayload | string;
  cssEmbed?: string | null;
  jsEmbed?: string | null;
  htmlEmbed?: string | null;
}

export interface WebflowSafetyReport {
  status: "pass" | "warn" | "block";
  blocked: boolean;
  fatalIssues: string[];
  warnings: string[];
  autoFixes: string[];
  extractedToEmbeds?: {
    hasCSS: boolean;
    hasJS: boolean;
    hasHTML: boolean;
    warnings: string[];
  };
  embedSize: {
    limit: number;
    css: number;
    js: number;
    html: number;
    errors: string[];
    warnings: string[];
  };
  embedChunking?: {
    css?: ChunkedEmbedResult;
    js?: ChunkedEmbedResult;
    html?: ChunkedEmbedResult;
  };
  htmlSanitization: {
    sanitizedNodes: number;
    changes: string[];
    warnings: string[];
    errors: string[];
  };
}

export interface WebflowSafetyGateResult {
  payload: WebflowPayload;
  webflowJson: string;
  preflight: ReturnType<typeof runPreflightValidation>;
  sanitizationApplied: boolean;
  sanitizationChanges: string[];
  embedContent?: EmbedContent;
  report: WebflowSafetyReport;
  blocked: boolean;
  blockReason?: string;
}

const FORBIDDEN_TAGS = [
  { label: "doctype", pattern: /<!doctype[^>]*>/gi },
  { label: "html", pattern: /<\/?html[^>]*>/gi },
  { label: "head", pattern: /<\/?head[^>]*>/gi },
  { label: "body", pattern: /<\/?body[^>]*>/gi },
];

function stripForbiddenRootTags(html: string): { html: string; removed: string[] } {
  let result = html;
  const removed: string[] = [];

  for (const tag of FORBIDDEN_TAGS) {
    if (tag.pattern.test(result)) {
      result = result.replace(tag.pattern, "");
      removed.push(tag.label);
      tag.pattern.lastIndex = 0;
    }
  }

  return { html: result, removed };
}

function sanitizeInlineHandlers(html: string): { html: string; removed: boolean } {
  const before = html;
  const after = html.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  return { html: after, removed: before !== after };
}

function sanitizeEmbedHtml(html: string): {
  html: string;
  changes: string[];
  warnings: string[];
} {
  if (!html) {
    return { html, changes: [], warnings: [] };
  }

  const changes: string[] = [];
  const warnings: string[] = [];

  const prepared = prepareHTMLForWebflow(html);
  let sanitized = prepared.sanitizedHTML;

  if (prepared.changesApplied.length > 0) {
    changes.push(...prepared.changesApplied);
  }
  if (!prepared.validation.valid) {
    warnings.push(...prepared.validation.errors);
  }
  if (prepared.validation.warnings.length > 0) {
    warnings.push(...prepared.validation.warnings);
  }

  const inlineHandlers = sanitizeInlineHandlers(sanitized);
  if (inlineHandlers.removed) {
    sanitized = inlineHandlers.html;
    changes.push("Removed inline event handlers");
    warnings.push("Inline event handlers were removed - recreate as JS listeners");
  }

  const stripped = stripForbiddenRootTags(sanitized);
  sanitized = stripped.html;
  if (stripped.removed.length > 0) {
    changes.push(`Removed forbidden root tags: ${stripped.removed.join(", ")}`);
  }

  // If forbidden tags still present (likely in embedded strings), warn.
  for (const tag of FORBIDDEN_TAGS) {
    if (tag.pattern.test(sanitized)) {
      warnings.push(`Embed HTML still contains <${tag.label}> tag text - remove it manually`);
      tag.pattern.lastIndex = 0;
    }
  }

  return { html: sanitized.trim(), changes, warnings };
}

function mergeEmbedBlocks(...blocks: Array<string | null | undefined>): string {
  return blocks
    .filter((block) => typeof block === "string" && block.trim().length > 0)
    .map((block) => block!.trim())
    .join("\n\n");
}

function sanitizeHtmlEmbedsInPayload(
  payload: WebflowPayload
): {
  payload: WebflowPayload;
  summary: WebflowSafetyReport["htmlSanitization"];
  maxHtmlSize: number;
} {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  const summary = {
    sanitizedNodes: 0,
    changes: [] as string[],
    warnings: [] as string[],
    errors: [] as string[],
  };
  let maxHtmlSize = 0;

  if (!Array.isArray(result.payload.nodes)) {
    return { payload: result, summary, maxHtmlSize };
  }

  for (const node of result.payload.nodes) {
    if (node.type !== "HtmlEmbed") continue;
    const raw =
      node.data?.embed?.meta?.html ||
      (typeof node.v === "string" ? node.v : "");

    if (!raw) continue;

    const sanitized = sanitizeEmbedHtml(raw);
    const updated = sanitized.html;
    const size = updated.length;
    if (size > maxHtmlSize) maxHtmlSize = size;

    if (size > WEBFLOW_EMBED_CHAR_LIMIT) {
      summary.errors.push(
        `HtmlEmbed node ${node._id} exceeds ${WEBFLOW_EMBED_CHAR_LIMIT} characters (${size.toLocaleString()})`
      );
    } else if (size > WEBFLOW_EMBED_SOFT_LIMIT) {
      summary.warnings.push(
        `HtmlEmbed node ${node._id} is large (${size.toLocaleString()} chars)`
      );
    }

    if (updated !== raw) {
      summary.sanitizedNodes += 1;
      if (node.data?.embed?.meta) {
        node.data.embed.meta.html = updated;
      }
      if (typeof node.v === "string") {
        node.v = updated;
      }
    }

    for (const change of sanitized.changes) {
      summary.changes.push(`HtmlEmbed ${node._id}: ${change}`);
    }
    for (const warning of sanitized.warnings) {
      summary.warnings.push(`HtmlEmbed ${node._id}: ${warning}`);
    }
  }

  return { payload: result, summary, maxHtmlSize };
}

function evaluateEmbedSize(label: string, content: string, errors: string[], warnings: string[]) {
  if (!content) return;
  const size = content.length;
  if (size > WEBFLOW_EMBED_CHAR_LIMIT) {
    errors.push(`${label} embed exceeds ${WEBFLOW_EMBED_CHAR_LIMIT} characters (${size.toLocaleString()})`);
  } else if (size > WEBFLOW_EMBED_SOFT_LIMIT) {
    warnings.push(`${label} embed is large (${size.toLocaleString()} chars)`);
  }
}

function parsePayload(payload: WebflowPayload | string): WebflowPayload | null {
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload) as WebflowPayload;
    } catch {
      return null;
    }
  }
  return payload;
}

export function ensureWebflowPasteSafety(input: WebflowSafetyGateInput): WebflowSafetyGateResult {
  const parsedPayload = parsePayload(input.payload);
  if (!parsedPayload) {
    const report: WebflowSafetyReport = {
      status: "block",
      blocked: true,
      fatalIssues: ["Invalid JSON - cannot parse payload"],
      warnings: [],
      autoFixes: [],
      embedSize: {
        limit: WEBFLOW_EMBED_CHAR_LIMIT,
        css: 0,
        js: 0,
        html: 0,
        errors: [],
        warnings: [],
      },
      htmlSanitization: {
        sanitizedNodes: 0,
        changes: [],
        warnings: [],
        errors: [],
      },
    };
    return {
      payload: {
        type: "@webflow/XscpData",
        payload: { nodes: [], styles: [], assets: [], ix1: [], ix2: { interactions: [], events: [], actionLists: [] } },
        meta: {
          unlinkedSymbolCount: 0,
          droppedLinks: 0,
          dynBindRemovedCount: 0,
          dynListBindRemovedCount: 0,
          paginationRemovedCount: 0,
          hasEmbedCSS: false,
          hasEmbedJS: false,
          embedCSSSize: 0,
          embedJSSize: 0,
        },
      },
      webflowJson: "",
      preflight: runPreflightValidation({
        type: "@webflow/XscpData",
        payload: { nodes: [], styles: [], assets: [], ix1: [], ix2: { interactions: [], events: [], actionLists: [] } },
        meta: {
          unlinkedSymbolCount: 0,
          droppedLinks: 0,
          dynBindRemovedCount: 0,
          dynListBindRemovedCount: 0,
          paginationRemovedCount: 0,
          hasEmbedCSS: false,
          hasEmbedJS: false,
          embedCSSSize: 0,
          embedJSSize: 0,
        },
      }),
      sanitizationApplied: false,
      sanitizationChanges: [],
      embedContent: undefined,
      report,
      blocked: true,
      blockReason: report.fatalIssues[0],
    };
  }

  let payload = parsedPayload;
  const baseCssEmbed = mergeEmbedBlocks(input.cssEmbed, payload.embedCSS);
  const baseJsEmbed = mergeEmbedBlocks(input.jsEmbed, payload.embedJS);
  const baseHtmlEmbed = mergeEmbedBlocks(input.htmlEmbed);

  const initialPreflight = runPreflightValidation(payload, {
    cssEmbed: baseCssEmbed || undefined,
    jsEmbed: baseJsEmbed || undefined,
  });

  const depthValidation = validateNodeDepth(payload.payload.nodes);
  const exceedsSafeDepth = depthValidation.maxDepthFound > SAFE_DEPTH_LIMIT;

  const shouldSanitize =
    !initialPreflight.canProceed ||
    !initialPreflight.isValid ||
    payloadLikelyNeedsSanitization(payload) ||
    exceedsSafeDepth;

  let sanitizationApplied = false;
  let sanitizationChanges: string[] = [];
  let extractedEmbed: EmbedContent | undefined;

  if (shouldSanitize) {
    const interactionValidation = validateInteractionReferences(payload);
    const brokenInteractionIndexes = interactionValidation.orphanTargets
      .filter((target) => target.interactionIndex >= 0)
      .map((target) => target.interactionIndex);

    const sanitization = sanitizeWebflowPayload(payload, {
      brokenInteractionIndexes,
    });
    payload = sanitization.payload;
    sanitizationApplied = sanitization.hadIssues;
    sanitizationChanges = sanitization.changes;
    extractedEmbed = sanitization.embedContent;
  }

  const finalCssEmbed = mergeEmbedBlocks(baseCssEmbed, extractedEmbed?.css);
  const finalJsEmbed = mergeEmbedBlocks(baseJsEmbed, extractedEmbed?.js);
  const finalHtmlEmbed = mergeEmbedBlocks(baseHtmlEmbed, extractedEmbed?.html);

  const htmlEmbedSanitization = sanitizeHtmlEmbedsInPayload(payload);
  payload = htmlEmbedSanitization.payload;

  const extraHtmlSanitization = finalHtmlEmbed
    ? sanitizeEmbedHtml(finalHtmlEmbed)
    : { html: "", changes: [], warnings: [] };

  // Apply chunking to embeds exceeding soft limit
  const cssChunking = finalCssEmbed ? chunkEmbed(finalCssEmbed, 'css', WEBFLOW_EMBED_SOFT_LIMIT) : undefined;
  const jsChunking = finalJsEmbed ? chunkEmbed(finalJsEmbed, 'js', WEBFLOW_EMBED_SOFT_LIMIT) : undefined;
  const htmlChunking = extraHtmlSanitization.html ? chunkEmbed(extraHtmlSanitization.html, 'html', WEBFLOW_EMBED_SOFT_LIMIT) : undefined;

  // Evaluate ONLY first chunks for hard limit errors
  const embedSizeErrors: string[] = [];
  const embedSizeWarnings: string[] = [];

  if (cssChunking) {
    if (cssChunking.wasChunked) {
      embedSizeWarnings.push(...cssChunking.instructions);
      // Check if any chunk exceeds hard limit
      const oversized = cssChunking.chunks.find(c => c.size > WEBFLOW_EMBED_CHAR_LIMIT);
      if (oversized) {
        embedSizeErrors.push(`CSS chunk ${oversized.index + 1} exceeds ${WEBFLOW_EMBED_CHAR_LIMIT} chars after chunking`);
      }
    }
  }

  if (jsChunking) {
    if (jsChunking.wasChunked) {
      embedSizeWarnings.push(...jsChunking.instructions);
      const oversized = jsChunking.chunks.find(c => c.size > WEBFLOW_EMBED_CHAR_LIMIT);
      if (oversized) {
        embedSizeErrors.push(`JS chunk ${oversized.index + 1} exceeds ${WEBFLOW_EMBED_CHAR_LIMIT} chars after chunking`);
      }
    }
  }

  if (htmlChunking) {
    if (htmlChunking.wasChunked) {
      embedSizeWarnings.push(...htmlChunking.instructions);
      const oversized = htmlChunking.chunks.find(c => c.size > WEBFLOW_EMBED_CHAR_LIMIT);
      if (oversized) {
        embedSizeErrors.push(`HTML chunk ${oversized.index + 1} exceeds ${WEBFLOW_EMBED_CHAR_LIMIT} chars after chunking`);
      }
    }
  }

  const finalPreflight = runPreflightValidation(payload, {
    cssEmbed: finalCssEmbed || undefined,
    jsEmbed: finalJsEmbed || undefined,
  });

  const fatalIssues = [
    ...finalPreflight.issues
      .filter((issue) => issue.severity === "fatal" || issue.severity === "error")
      .map((issue) => issue.message),
    ...htmlEmbedSanitization.summary.errors,
    ...embedSizeErrors,
  ];

  const warnings = [
    ...finalPreflight.issues
      .filter((issue) => issue.severity === "warning")
      .map((issue) => issue.message),
    ...htmlEmbedSanitization.summary.warnings,
    ...embedSizeWarnings,
    ...(extractedEmbed?.warnings || []),
    ...extraHtmlSanitization.warnings,
  ];

  const autoFixes = [
    ...sanitizationChanges,
    ...htmlEmbedSanitization.summary.changes,
    ...extraHtmlSanitization.changes.map((change) => `Embed HTML: ${change}`),
  ];

  const blocked = fatalIssues.length > 0 || !finalPreflight.canProceed;
  const status: WebflowSafetyReport["status"] = blocked
    ? "block"
    : warnings.length > 0 || autoFixes.length > 0
      ? "warn"
      : "pass";

  const report: WebflowSafetyReport = {
    status,
    blocked,
    fatalIssues,
    warnings,
    autoFixes,
    extractedToEmbeds: extractedEmbed
      ? {
          hasCSS: !!extractedEmbed.css,
          hasJS: !!extractedEmbed.js,
          hasHTML: !!extractedEmbed.html,
          warnings: extractedEmbed.warnings,
        }
      : undefined,
    embedSize: {
      limit: WEBFLOW_EMBED_CHAR_LIMIT,
      css: finalCssEmbed.length,
      js: finalJsEmbed.length,
      html: Math.max(extraHtmlSanitization.html.length, htmlEmbedSanitization.maxHtmlSize),
      errors: [...embedSizeErrors, ...htmlEmbedSanitization.summary.errors],
      warnings: embedSizeWarnings,
    },
    embedChunking: (cssChunking || jsChunking || htmlChunking) ? {
      css: cssChunking,
      js: jsChunking,
      html: htmlChunking,
    } : undefined,
    htmlSanitization: htmlEmbedSanitization.summary,
  };

  const embedContent: EmbedContent | undefined =
    finalCssEmbed || finalJsEmbed || finalHtmlEmbed || extractedEmbed?.warnings?.length
      ? {
          css: finalCssEmbed,
          js: finalJsEmbed,
          html: extraHtmlSanitization.html || finalHtmlEmbed || "",
          warnings: extractedEmbed?.warnings || [],
        }
      : undefined;

  const blockReason = blocked ? fatalIssues[0] || finalPreflight.summary : undefined;

  return {
    payload,
    webflowJson: JSON.stringify(payload),
    preflight: finalPreflight,
    sanitizationApplied,
    sanitizationChanges: sanitizationChanges,
    embedContent,
    report,
    blocked,
    blockReason,
  };
}

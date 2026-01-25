import {
  runPreflightValidation,
  validateInteractionReferences,
  validateNodeDepth,
  RESERVED_CLASS_PREFIXES,
} from "./preflight-validator";
import {
  sanitizeWebflowPayload,
  payloadLikelyNeedsSanitization,
  type EmbedContent,
  SAFE_DEPTH_LIMIT,
} from "./webflow-sanitizer";
import { sanitizeReservedClassNames } from "./webflow-sanitizer";
import { prepareHTMLForWebflow } from "./validation/html-sanitizer";
import type { WebflowPayload, WebflowNode } from "./webflow-converter";
import { chunkEmbed, type ChunkedEmbedResult } from "./embed-chunker";
import { extractClassNamesFromCSS } from "./css-embed-router";

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

// ============================================================================
// PLACEHOLDER STYLE CREATION FOR EMBED-ONLY CLASSES
// ============================================================================

/**
 * Collect all style UUIDs referenced by nodes in the payload.
 * NOTE: In Webflow's format, node.classes contains style UUIDs (style._id values),
 * NOT class names. The class name is stored in style.name.
 */
function collectAllReferencedStyleIds(nodes: WebflowNode[]): Set<string> {
  const referencedStyleIds = new Set<string>();

  if (!Array.isArray(nodes)) {
    return referencedStyleIds;
  }

  for (const node of nodes) {
    if (Array.isArray(node.classes)) {
      for (const styleId of node.classes) {
        if (typeof styleId === "string" && isLikelyStyleId(styleId)) {
          referencedStyleIds.add(styleId);
        }
      }
    }
  }

  return referencedStyleIds;
}

function repairStyleReferenceIds(payload: WebflowPayload): {
  payload: WebflowPayload;
  remapped: boolean;
  remappedCount: number;
  remappedNames: string[];
  ambiguousNames: string[];
  unknownRefs: string[];
} {
  if (!payload?.payload?.nodes || !payload?.payload?.styles) {
    return {
      payload,
      remapped: false,
      remappedCount: 0,
      remappedNames: [],
      ambiguousNames: [],
      unknownRefs: [],
    };
  }

  const styleIdSet = new Set<string>();
  const styleNameToId = new Map<string, string>();
  const duplicateNames = new Set<string>();

  for (const style of payload.payload.styles) {
    if (!style?._id || !style?.name) continue;
    styleIdSet.add(style._id);
    if (styleNameToId.has(style.name)) {
      duplicateNames.add(style.name);
    } else {
      styleNameToId.set(style.name, style._id);
    }
  }

  const remapNames = new Map<string, string>();
  const ambiguousNames = new Set<string>();
  const unknownRefs = new Set<string>();

  for (const node of payload.payload.nodes) {
    if (!Array.isArray(node.classes)) continue;
    for (const classRef of node.classes) {
      if (typeof classRef !== "string") continue;
      if (styleIdSet.has(classRef) || isReservedClass(classRef)) continue;

      const mapped = styleNameToId.get(classRef);
      if (mapped) {
        if (duplicateNames.has(classRef)) {
          ambiguousNames.add(classRef);
        } else {
          remapNames.set(classRef, mapped);
        }
      } else if (isLikelyStyleId(classRef)) {
        unknownRefs.add(classRef);
      }
    }
  }

  if (remapNames.size === 0) {
    return {
      payload,
      remapped: false,
      remappedCount: 0,
      remappedNames: [],
      ambiguousNames: Array.from(ambiguousNames),
      unknownRefs: Array.from(unknownRefs),
    };
  }

  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  let remappedCount = 0;

  result.payload.nodes = result.payload.nodes.map((node) => {
    if (!Array.isArray(node.classes)) return node;
    const nextClasses = node.classes.map((classRef) => {
      if (typeof classRef !== "string") return classRef;
      const mapped = remapNames.get(classRef);
      if (mapped) {
        remappedCount += 1;
        return mapped;
      }
      return classRef;
    });
    return { ...node, classes: nextClasses };
  });

  return {
    payload: result,
    remapped: remappedCount > 0,
    remappedCount,
    remappedNames: Array.from(remapNames.keys()),
    ambiguousNames: Array.from(ambiguousNames),
    unknownRefs: Array.from(unknownRefs),
  };
}

function isLikelyStyleId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Check if a class name uses a reserved Webflow prefix.
 */
function isReservedClass(className: string): boolean {
  for (const prefix of RESERVED_CLASS_PREFIXES) {
    if (className.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

/**
 * Verify that all style UUIDs referenced by nodes exist in the styles array.
 *
 * In Webflow's format:
 * - node.classes contains style UUIDs (style._id values)
 * - styles have _id (UUID) and name (class name)
 *
 * The converter should create all necessary styles upfront. This function
 * verifies that relationship is intact and logs warnings for any issues.
 *
 * NOTE: This function no longer creates placeholder styles. The converter
 * is responsible for creating all styles, including placeholders for classes
 * that exist in HTML but have no CSS rules.
 *
 * @param payload - The Webflow payload to verify
 * @param embedCSS - CSS that was routed to embed (used for categorization)
 * @returns Verification result with any issues found
 */
function createPlaceholderStylesForMissingClasses(
  payload: WebflowPayload,
  embedCSS: string
): {
  fixedPayload: WebflowPayload;
  addedPlaceholders: string[];
  embedOnlyClasses: string[];
  noStyleClasses: string[];
  missingStyleRefs: string[];
} {
  if (!payload?.payload?.nodes || !payload?.payload?.styles) {
    return {
      fixedPayload: payload,
      addedPlaceholders: [],
      embedOnlyClasses: [],
      noStyleClasses: [],
      missingStyleRefs: [],
    };
  }

  // Extract class names from embed CSS (if provided)
  const embedClasses = embedCSS ? extractClassNamesFromCSS(embedCSS) : new Set<string>();

  // Get existing style IDs (UUIDs) and build ID-to-name mapping
  const existingStyleIds = new Set<string>();
  const styleIdToName = new Map<string, string>();
  for (const style of payload.payload.styles) {
    existingStyleIds.add(style._id);
    styleIdToName.set(style._id, style.name);
  }

  // Get style UUIDs referenced by nodes
  const referencedStyleIds = collectAllReferencedStyleIds(payload.payload.nodes);

  // Find any style UUIDs that don't have matching styles
  // This should NOT happen if the converter is working correctly
  const missingStyleRefs: string[] = [];
  const embedOnlyClasses: string[] = [];
  const noStyleClasses: string[] = [];

  for (const styleId of referencedStyleIds) {
    if (!existingStyleIds.has(styleId)) {
      missingStyleRefs.push(styleId);
    }
  }

  // For backward compatibility, categorize existing styles by their embed status
  for (const style of payload.payload.styles) {
    if (style.styleLess === '' || !style.styleLess) {
      // Empty styleLess - style was a placeholder
      if (embedClasses.has(style.name)) {
        embedOnlyClasses.push(style.name);
      } else {
        noStyleClasses.push(style.name);
      }
    }
  }

  // We no longer create placeholder styles here - the converter handles this
  // Just return the payload as-is with categorization info
  return {
    fixedPayload: payload,
    addedPlaceholders: [],  // No longer adding placeholders here
    embedOnlyClasses,
    noStyleClasses,
    missingStyleRefs,
  };
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
  const styleRefRepair = repairStyleReferenceIds(payload);
  payload = styleRefRepair.payload;

  const reservedRename = sanitizeReservedClassNames(payload);
  payload = reservedRename.payload;

  const styleRefFixes: string[] = [];
  const styleRefWarnings: string[] = [];
  const reservedRenameFixes: string[] = [];
  const reservedRenameWarnings: string[] = [];
  const previewList = (items: string[]) => {
    const preview = items.slice(0, 5).join(", ");
    const moreCount = items.length > 5 ? items.length - 5 : 0;
    return `${preview}${moreCount > 0 ? `, ... +${moreCount} more` : ""}`;
  };

  if (styleRefRepair.remapped) {
    styleRefFixes.push(
      `Remapped ${styleRefRepair.remappedCount} class reference(s) from style names to IDs`
    );
  }
  if (styleRefRepair.ambiguousNames.length > 0) {
    styleRefWarnings.push(
      `Found ${styleRefRepair.ambiguousNames.length} ambiguous class name reference(s) that match multiple styles: ${previewList(styleRefRepair.ambiguousNames)}`
    );
  }
  if (styleRefRepair.unknownRefs.length > 0) {
    styleRefWarnings.push(
      `Found ${styleRefRepair.unknownRefs.length} class reference(s) that do not match style IDs or style names: ${previewList(styleRefRepair.unknownRefs)}`
    );
  }
  if (reservedRename.renamed.length > 0) {
    reservedRenameFixes.push(...reservedRename.renamed);
    reservedRenameWarnings.push(
      `Renamed ${reservedRename.renamed.length} reserved class name(s) to avoid Webflow conflicts.`
    );
  }
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

  let sanitizationApplied = styleRefRepair.remapped || reservedRename.renamed.length > 0;
  let sanitizationChanges: string[] = [...styleRefFixes, ...reservedRenameFixes];
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
    sanitizationApplied = sanitizationApplied || sanitization.hadIssues;
    sanitizationChanges = [...sanitizationChanges, ...sanitization.changes];
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

  // ============================================================================
  // AUTO-FIX: Create placeholder styles for all missing classes
  // ============================================================================
  // Classes referenced by nodes but missing from the styles array will cause
  // "missing style" warnings. This can happen because:
  // 1. Their CSS was routed to embed (complex selectors, pseudo-elements)
  // 2. They have no CSS at all (semantic/structural markers)
  // 3. The CSS parser didn't recognize their rules
  //
  // We create empty placeholder styles so Webflow recognizes the class.
  // Actual styling comes from the CSS embed or doesn't exist.
  const {
    fixedPayload: payloadWithPlaceholders,
    addedPlaceholders,
    embedOnlyClasses,
    noStyleClasses,
    missingStyleRefs,
  } = createPlaceholderStylesForMissingClasses(payload, finalCssEmbed);
  payload = payloadWithPlaceholders;

  // Track auto-fix for placeholder styles with detailed categorization
  const placeholderAutoFixes: string[] = [];
  if (addedPlaceholders.length > 0) {
    const classListPreview = addedPlaceholders.slice(0, 5).join(", ");
    const moreCount = addedPlaceholders.length > 5 ? addedPlaceholders.length - 5 : 0;
    const moreText = moreCount > 0 ? `, ... +${moreCount} more` : "";

    placeholderAutoFixes.push(
      `Created ${addedPlaceholders.length} placeholder style(s) for missing classes: ${classListPreview}${moreText}`
    );

    // Add detail about where styles come from
    if (embedOnlyClasses.length > 0) {
      placeholderAutoFixes.push(
        `  → ${embedOnlyClasses.length} class(es) have styles in CSS embed`
      );
    }
    if (noStyleClasses.length > 0) {
      placeholderAutoFixes.push(
        `  → ${noStyleClasses.length} class(es) have no CSS rules (structural/semantic only)`
      );
    }
  }
  if (missingStyleRefs.length > 0) {
    const preview = missingStyleRefs.slice(0, 5).join(", ");
    const moreCount = missingStyleRefs.length > 5 ? missingStyleRefs.length - 5 : 0;
    const moreText = moreCount > 0 ? `, ... +${moreCount} more` : "";
    styleRefWarnings.push(
      `Found ${missingStyleRefs.length} style reference(s) in nodes that are not in styles: ${preview}${moreText}`
    );
  }

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
      .filter((issue) => issue.severity === "fatal")
      .map((issue) => issue.message),
    ...htmlEmbedSanitization.summary.errors,
    ...embedSizeErrors,
  ];

  const sanitizationWarnings: string[] = [];
  if (sanitizationApplied && sanitizationChanges.length > 0) {
    sanitizationWarnings.push(
      "Sanitization applied to fix unsafe content before paste."
    );
  }

  const warnings = [
    ...finalPreflight.issues
      .filter((issue) => issue.severity === "warning" || issue.severity === "error")
      .map((issue) => issue.message),
    ...htmlEmbedSanitization.summary.warnings,
    ...embedSizeWarnings,
    ...(extractedEmbed?.warnings || []),
    ...extraHtmlSanitization.warnings,
    ...styleRefWarnings,
    ...reservedRenameWarnings,
    ...sanitizationWarnings,
  ];

  const autoFixes = [
    ...sanitizationChanges,
    ...htmlEmbedSanitization.summary.changes,
    ...extraHtmlSanitization.changes.map((change) => `Embed HTML: ${change}`),
    ...placeholderAutoFixes,
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

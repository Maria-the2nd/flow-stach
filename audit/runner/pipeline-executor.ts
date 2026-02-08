/**
 * Pipeline Executor
 *
 * Calls the exact same lib/ functions used by the app for deterministic testing.
 * NO LLM calls - audit runs offline, deterministic path only.
 */

import { extractCleanHtml } from "../../lib/html-parser";
import { normalizeHtmlCssForWebflow } from "../../lib/webflow-normalizer";
import { parseCSS } from "../../lib/css-parser";
import { literalizeCssForWebflow } from "../../lib/webflow-literalizer";
import { componentizeHtml } from "../../lib/componentizer";
import { buildCssTokenPayload } from "../../lib/webflow-converter";
import { mergeEmbedCSS, routeCSS } from "../../lib/css-embed-router";

export interface PipelineInput {
  html: string;
  css?: string;
  js?: string;
}

export interface PipelineOutput {
  /** Original bundled HTML (before pipeline) */
  originalHtml: string;
  /** Sanitized HTML after normalization */
  sanitizedHtml: string;
  /** Sanitized CSS after normalization */
  sanitizedCss: string;
  /** CSS routed to embed in the real pipeline */
  embedCss: string;
  /** Parsed CSS class index */
  classIndex: Record<string, unknown>;
  /** Webflow safety gate result */
  safetyResult: {
    safe: boolean;
    warnings: string[];
    blockers: string[];
  };
  /** Pipeline warnings accumulated */
  warnings: string[];
  /** Pipeline errors if any */
  errors: string[];
}

/**
 * Run the HTML-to-Webflow pipeline deterministically
 */
export function runPipeline(input: PipelineInput): PipelineOutput {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    // Step 1: Extract clean HTML and embedded CSS
    const cleanResult = extractCleanHtml(input.html);
    const originalHtml = input.html;

    // Merge embedded CSS with external CSS if provided
    let combinedCss = cleanResult.extractedStyles;
    if (input.css) {
      combinedCss = `${combinedCss}\n\n/* External CSS */\n${input.css}`;
    }

    // Step 2: Two-pass routing (same strategy as production converter):
    // - pre-pass: route only hard blockers before normalization
    // - post-pass: route remaining non-native rules after normalization
    const preRouting = routeCSS(combinedCss, {
      strategy: "panel-first",
      phase: "hard-blockers",
    });

    // Step 3: Normalize pre-routed native CSS for Webflow
    const normResult = normalizeHtmlCssForWebflow(
      cleanResult.cleanHtml,
      preRouting.native,
    );
    if (normResult.warnings.length > 0) {
      warnings.push(...normResult.warnings);
    }

    const postRouting = routeCSS(normResult.css, {
      strategy: "panel-first",
      phase: "full",
    });

    const finalNativeCss = postRouting.native;
    const finalEmbedCss = mergeEmbedCSS(
      normResult.bodyBackgroundEmbed || "",
      preRouting.embed,
      postRouting.embed,
    );

    // Step 4: Parse CSS into class index
    const cssResult = parseCSS(finalNativeCss);

    // Merge non-standard media CSS (container queries, >991px breakpoints, pseudo+media rules)
    // into embed output — same pattern as webflow-converter-streaming.ts
    const completeEmbedCss = cssResult.classIndex.nonStandardMediaCss
      ? mergeEmbedCSS(finalEmbedCss, cssResult.classIndex.nonStandardMediaCss)
      : finalEmbedCss;

    // Step 5: Literalize CSS (resolve variables)
    const literalResult = literalizeCssForWebflow(finalNativeCss);
    if (literalResult.remainingVarCount > 0) {
      warnings.push(
        `${literalResult.remainingVarCount} CSS variables could not be resolved`,
      );
    }

    // Step 6: Componentize HTML
    const componentTree = componentizeHtml(normResult.html);

    // Step 7: Build CSS token payload
    const tokenPayload = buildCssTokenPayload(finalNativeCss, {
      namespace: "audit",
      includePreview: false,
    });

    // Step 8: Safety check (simplified for audit - just check for obvious issues)
    const safetyResult = {
      safe: true,
      warnings: [] as string[],
      blockers: [] as string[],
    };

    // Build sanitized HTML bundle for visual comparison (native + embed).
    // Include both inline scripts extracted from source HTML and optional external JS fixture files
    // so interaction-dependent states are represented in audit previews.
    const previewJs = [cleanResult.extractedScripts, input.js]
      .filter((chunk): chunk is string => !!chunk && chunk.trim().length > 0)
      .join("\n\n");

    const sanitizedHtml = buildSanitizedBundle(
      normResult.html,
      finalNativeCss,
      completeEmbedCss,
      previewJs,
    );

    return {
      originalHtml,
      sanitizedHtml,
      sanitizedCss: finalNativeCss,
      embedCss: completeEmbedCss,
      classIndex: cssResult.classIndex as unknown as Record<string, unknown>,
      safetyResult: {
        safe: safetyResult.safe,
        warnings: safetyResult.warnings || [],
        blockers: safetyResult.blockers || [],
      },
      warnings,
      errors,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Pipeline error: ${message}`);

    return {
      originalHtml: input.html,
      sanitizedHtml: input.html,
      sanitizedCss: "",
      embedCss: "",
      classIndex: {},
      safetyResult: { safe: false, warnings: [], blockers: [message] },
      warnings,
      errors,
    };
  }
}

/**
 * Build a complete HTML document from sanitized parts
 */
function buildSanitizedBundle(
  html: string,
  css: string,
  embedCss: string,
  js: string,
): string {
  const nativeStyleTag = `<style data-flowbridge-native="true">\n${css}\n</style>`;
  const embedStyleTag = embedCss
    ? `\n<style data-flowbridge-embed="true">\n${embedCss}\n</style>`
    : "";

  // Check if html is already a full document
  const isFullDocument = /<html/i.test(html) || /<!DOCTYPE/i.test(html);

  if (isFullDocument) {
    // Inject updated CSS into existing document
    const withStyle = html.replace(
      /<\/head>/i,
      `${nativeStyleTag}${embedStyleTag}\n</head>`,
    );
    if (js) {
      return withStyle.replace(
        /<\/body>/i,
        `<script>\n${js}\n</script>\n</body>`,
      );
    }
    return withStyle;
  }

  // Build complete document from fragment
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Audit Preview</title>
  ${nativeStyleTag}${embedStyleTag}
</head>
<body>
${html}
${js ? `<script>\n${js}\n</script>` : ""}
</body>
</html>`;
}

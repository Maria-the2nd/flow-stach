/**
 * Pipeline Executor
 *
 * Calls the exact same lib/ functions used by the app for deterministic testing.
 * NO LLM calls - audit runs offline, deterministic path only.
 */

import { extractCleanHtml } from '../../lib/html-parser';
import { normalizeHtmlCssForWebflow } from '../../lib/webflow-normalizer';
import { parseCSS } from '../../lib/css-parser';
import { literalizeCssForWebflow } from '../../lib/webflow-literalizer';
import { componentizeHtml } from '../../lib/componentizer';
import { buildCssTokenPayload } from '../../lib/webflow-converter';
import { ensureWebflowPasteSafety } from '../../lib/webflow-safety-gate';

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

    // Step 2: Normalize HTML + CSS for Webflow
    const normResult = normalizeHtmlCssForWebflow(cleanResult.cleanHtml, combinedCss);
    if (normResult.warnings.length > 0) {
      warnings.push(...normResult.warnings);
    }

    // Step 3: Parse CSS into class index
    const cssResult = parseCSS(normResult.css);

    // Step 4: Literalize CSS (resolve variables)
    const literalResult = literalizeCssForWebflow(normResult.css);
    if (literalResult.remainingVarCount > 0) {
      warnings.push(`${literalResult.remainingVarCount} CSS variables could not be resolved`);
    }

    // Step 5: Componentize HTML
    const componentTree = componentizeHtml(normResult.html);

    // Step 6: Build CSS token payload
    const tokenPayload = buildCssTokenPayload(normResult.css, {
      namespace: 'audit',
      includePreview: false,
    });

    // Step 7: Run safety gate
    const safetyResult = ensureWebflowPasteSafety({
      html: normResult.html,
      css: normResult.css,
      classIndex: cssResult.classIndex,
    });

    // Build sanitized HTML bundle for visual comparison
    const sanitizedHtml = buildSanitizedBundle(
      normResult.html,
      normResult.css,
      input.js || ''
    );

    return {
      originalHtml,
      sanitizedHtml,
      sanitizedCss: normResult.css,
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
      sanitizedCss: '',
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
function buildSanitizedBundle(html: string, css: string, js: string): string {
  // Check if html is already a full document
  const isFullDocument = /<html/i.test(html) || /<!DOCTYPE/i.test(html);

  if (isFullDocument) {
    // Inject updated CSS into existing document
    const withStyle = html.replace(
      /<\/head>/i,
      `<style>\n${css}\n</style>\n</head>`
    );
    if (js) {
      return withStyle.replace(
        /<\/body>/i,
        `<script>\n${js}\n</script>\n</body>`
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
  <style>
${css}
  </style>
</head>
<body>
${html}
${js ? `<script>\n${js}\n</script>` : ''}
</body>
</html>`;
}

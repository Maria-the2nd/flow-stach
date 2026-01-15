/**
 * Flowbridge CLI import runner.
 * Generates Webflow-ready artifacts from an HTML input file.
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { basename, join, resolve } from "path";
import { extractCleanHtml, extractJsHooks, getClassesUsed } from "../lib/html-parser";
import { extractFontFamilies, extractGoogleFontsUrl, extractTokens } from "../lib/token-extractor";
import { parseCSS } from "../lib/css-parser";
import { componentizeHtml } from "../lib/componentizer";
import {
  applyDeterministicComponentNames,
  applySemanticPatchResponse,
  buildSemanticPatchRequest,
} from "../lib/flowbridge-semantic";
import { requestFlowbridgeSemanticPatch } from "../lib/flowbridge-llm";
import { literalizeCssForWebflow } from "../lib/webflow-literalizer";
import { buildComponentPayload, buildCssTokenPayload, validateForWebflowPaste } from "../lib/webflow-converter";
import { normalizeHtmlCssForWebflow } from "../lib/webflow-normalizer";

type CliOptions = {
  inputPath: string;
  outDir: string;
};

function loadEnvLocal(): void {
  const envPath = resolve(".env.local");
  try {
    const content = readFileSync(envPath, "utf-8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const index = trimmed.indexOf("=");
      if (index === -1) return;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch {
    // ignore missing .env.local
  }
}

function parseArgs(argv: string[]): CliOptions {
  const inputArg = argv.find((arg) => arg.startsWith("--input="));
  const outArg = argv.find((arg) => arg.startsWith("--out="));
  const inputPath = inputArg ? inputArg.replace("--input=", "") : "temp/tests/flow-bridge-bento.html";
  const outDir = outArg ? outArg.replace("--out=", "") : join("temp", "flowbridge-import-output");
  return { inputPath, outDir };
}

function applyVisibilityDefaults(html: string, css: string): { html: string; warnings: string[] } {
  const warnings: string[] = [];
  const hiddenRegex = /\.([a-zA-Z0-9_-]+)\s*\{[^}]*opacity\s*:\s*0[^}]*\}/g;
  const visibleRegex = /\.([a-zA-Z0-9_-]+)\.visible\s*\{[^}]*opacity\s*:\s*1[^}]*\}/g;

  const hiddenClasses = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = hiddenRegex.exec(css)) !== null) {
    hiddenClasses.add(match[1]);
  }

  const visibleClasses = new Set<string>();
  while ((match = visibleRegex.exec(css)) !== null) {
    visibleClasses.add(match[1]);
  }

  const targets = Array.from(hiddenClasses).filter((name) => visibleClasses.has(name));
  if (targets.length === 0) return { html, warnings };

  let updatedHtml = html;
  for (const target of targets) {
    const classRegex = new RegExp(`class="([^"]*\\b${target}\\b[^"]*)"`, "gi");
    let count = 0;
    updatedHtml = updatedHtml.replace(classRegex, (full, classValue) => {
      if (/\bvisible\b/i.test(classValue)) return full;
      count += 1;
      return `class="${classValue} visible"`;
    });
    if (count > 0) {
      warnings.push(`Visibility override: added "visible" to ${count} ".${target}" elements.`);
    }
  }

  return { html: updatedHtml, warnings };
}

function buildCardGridWarnings(componentHtml: string[], html: string): string[] {
  const warnings: string[] = [];
  const allClasses = getClassesUsed(html);
  const cardClasses = allClasses.filter((name) => name.toLowerCase().includes("card"));
  if (cardClasses.length === 0) return warnings;

  componentHtml.forEach((htmlBlock) => {
    const classText = getClassesUsed(htmlBlock).join(" ").toLowerCase();
    const isCardGrid =
      classText.includes("card-grid") ||
      classText.includes("pricing-grid") ||
      classText.includes("bento-grid") ||
      classText.includes("features-grid");
    if (!isCardGrid) return;
    const expectedCards = cardClasses.filter((name) => !name.toLowerCase().includes("grid"));
    const missingCards = expectedCards.filter((name) => !classText.includes(name.toLowerCase()));
    if (missingCards.length > 0) {
      warnings.push(`Card grid missing card children: ${missingCards.slice(0, 5).join(", ")}`);
    }
  });

  return warnings;
}

async function run(): Promise<void> {
  loadEnvLocal();
  const options = parseArgs(process.argv.slice(2));
  const inputPath = resolve(options.inputPath);

  const inputHtml = readFileSync(inputPath, "utf-8");
  const cleanResult = extractCleanHtml(inputHtml);
  const normalization = normalizeHtmlCssForWebflow(cleanResult.cleanHtml, cleanResult.extractedStyles);
  const visibility = applyVisibilityDefaults(normalization.html, normalization.css);
  let normalizedHtml = visibility.html;

  const cssResult = parseCSS(normalization.css);
  const tokens = extractTokens(normalization.css, basename(inputPath));
  const fontUrl = extractGoogleFontsUrl(inputHtml);
  const fontFamilies = extractFontFamilies(normalization.css);
  if (fontUrl && fontFamilies.length > 0) {
    tokens.fonts = { googleFonts: fontUrl, families: fontFamilies };
  }

  let components = componentizeHtml(normalizedHtml);
  const namingResult = applyDeterministicComponentNames(components);
  components = namingResult.componentTree;

  const componentHtmlBlocks = components.components.map((component) => component.htmlContent);
  const footerPresent =
    /<footer\b/i.test(normalizedHtml) ||
    /\bclass="[^"]*footer[^"]*"/i.test(normalizedHtml) ||
    /\bid="footer"/i.test(normalizedHtml);
  const cardWarnings = buildCardGridWarnings(componentHtmlBlocks, normalizedHtml);
  const preLiteralization = literalizeCssForWebflow(normalization.css);
  const forceLlm =
    process.env.FLOWBRIDGE_FORCE_LLM === "1" || process.env.NEXT_PUBLIC_FLOWBRIDGE_FORCE_LLM === "1";
  const shouldInvokeLlm = forceLlm || preLiteralization.remainingVarCount > 0;

  let semanticWarnings: string[] = [];
  let finalCss = normalization.css;
  let llmMeta: Record<string, unknown> | null = null;
  const patchCounts = { renamedComponents: 0, htmlMutations: 0, cssMutations: 0 };

  if (shouldInvokeLlm) {
    const semanticContext = buildSemanticPatchRequest(
      normalizedHtml,
      components,
      cssResult.classIndex,
      cssResult.cssVariables
    );
    const result = await requestFlowbridgeSemanticPatch(semanticContext.request);
    llmMeta = result.meta as unknown as Record<string, unknown>;

    if (result.patch) {
      const snapshotComponents = structuredClone(components);
      const snapshotHtml = normalizedHtml;
      const snapshotCss = finalCss;
      try {
        const applyResult = applySemanticPatchResponse({
          componentTree: components,
          patch: result.patch,
        });

        const patchedHtml = applyResult.patchedHtml.trim();
        const hasEmptyComponentHtml = applyResult.componentTree.components.some(
          (component) => !component.htmlContent.trim()
        );
        if (!patchedHtml || hasEmptyComponentHtml) {
          components = snapshotComponents;
          normalizedHtml = snapshotHtml;
          finalCss = snapshotCss;
        } else {
          components = applyResult.componentTree;
          normalizedHtml = applyResult.patchedHtml;
          semanticWarnings = applyResult.warnings;
          patchCounts.renamedComponents = applyResult.applied.renames;
          patchCounts.htmlMutations = applyResult.applied.htmlPatches;
          patchCounts.cssMutations = result.patch.cssPatches.length;
          const cssPatch = result.patch.cssPatches[result.patch.cssPatches.length - 1];
          if (cssPatch?.op === "replaceFinalCss") {
            finalCss = cssPatch.css;
          }
          if (result.patch.notes.length > 0) {
            semanticWarnings.push(...result.patch.notes.map((note) => `LLM: ${note}`));
          }
        }
      } catch {
        components = snapshotComponents;
        normalizedHtml = snapshotHtml;
        finalCss = snapshotCss;
      }
    }
  }

  if (!footerPresent) {
    const unexpectedFooters = components.components.filter((component) =>
      component.name.toLowerCase().startsWith("footer")
    );
    if (unexpectedFooters.length > 0) {
      semanticWarnings.push("Unexpected extracted section (Footer) removed: no footer in input HTML.");
      const removedIds = new Set(unexpectedFooters.map((component) => component.id));
      components.components = components.components.filter((component) => !removedIds.has(component.id));
      components.rootOrder = components.rootOrder.filter((id) => !removedIds.has(id));
    }
  }

  const literalization = literalizeCssForWebflow(finalCss, {
    strict: process.env.FLOWBRIDGE_STRICT_LLM === "1",
  });

  const finalCssResult = parseCSS(literalization.css);
  const tokenPayloadResult = buildCssTokenPayload(literalization.css, {
    namespace: tokens.namespace,
    includePreview: true,
  });

  const componentPayloads: Array<{ id: string; name: string; payload: unknown; html: string }> = [];
  for (const component of components.components) {
    const payload = buildComponentPayload(component, finalCssResult.classIndex, tokenPayloadResult.establishedClasses);
    componentPayloads.push({ id: component.id, name: component.name, payload: payload.webflowPayload, html: component.htmlContent });
  }

  const warnings = validateForWebflowPaste(finalCssResult.classIndex, components.components);
  const outDir = resolve(options.outDir);
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, "components"), { recursive: true });
  mkdirSync(join(outDir, "component-html"), { recursive: true });

  writeFileSync(join(outDir, "clean.html"), normalizedHtml, "utf-8");
  writeFileSync(join(outDir, "styles.css"), literalization.css, "utf-8");
  writeFileSync(join(outDir, "tokens.css"), cssResult.tokensCss, "utf-8");
  writeFileSync(
    join(outDir, "tokens.json"),
    JSON.stringify(
      {
        name: tokens.name,
        namespace: tokens.namespace,
        variables: tokens.variables,
        fonts: tokens.fonts,
      },
      null,
      2
    ),
    "utf-8"
  );
  writeFileSync(
    join(outDir, "token-payload.json"),
    JSON.stringify(tokenPayloadResult.webflowPayload, null, 2),
    "utf-8"
  );
  writeFileSync(
    join(outDir, "classIndex.json"),
    JSON.stringify(finalCssResult.classIndex, null, 2),
    "utf-8"
  );
  writeFileSync(
    join(outDir, "components.json"),
    JSON.stringify(
      components.components.map((component) => ({
        id: component.id,
        name: component.name,
        type: component.type,
        classesUsed: component.classesUsed,
        jsHooks: component.jsHooks,
      })),
      null,
      2
    ),
    "utf-8"
  );

  componentPayloads.forEach((component) => {
    const safeName = component.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
    writeFileSync(
      join(outDir, "components", `${safeName}-${component.id}.json`),
      JSON.stringify(component.payload, null, 2),
      "utf-8"
    );
    writeFileSync(
      join(outDir, "component-html", `${safeName}-${component.id}.html`),
      component.html,
      "utf-8"
    );
  });

  const report = {
    inputPath,
    componentCount: components.components.length,
    warnings: [...warnings, ...namingResult.warnings, ...semanticWarnings, ...literalization.warnings, ...visibility.warnings, ...cardWarnings],
    llmMeta,
    patchCounts,
    remainingCssVarCount: literalization.remainingVarCount,
    jsHooks: extractJsHooks(normalizedHtml),
  };
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf-8");

  console.log(`Flowbridge import artifacts written to: ${outDir}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

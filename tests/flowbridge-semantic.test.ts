import { existsSync, readFileSync } from "fs";
import { describe, it, expect } from "vitest";
import { extractCleanHtml } from "../lib/html-parser";
import { normalizeHtmlCssForWebflow } from "../lib/webflow-normalizer";
import { parseCSS } from "../lib/css-parser";
import { componentizeHtml } from "../lib/componentizer";
import {
  buildSemanticPatchRequest,
  applySemanticPatchResponse,
  applyDeterministicComponentNames,
} from "../lib/flowbridge-semantic";
import { requestFlowbridgeSemanticPatch } from "../lib/flowbridge-llm";

describe("flowbridge semantic patching", () => {
  it("uses mock LLM responses and applies component naming", async () => {
    const primaryPath = "/mnt/data/flow-bridge-bento.html";
    const fallbackPath = "temp/tests/flow-bridge-bento.html";
    const inputPath = existsSync(primaryPath) ? primaryPath : fallbackPath;

    expect(existsSync(inputPath)).toBe(true);

    const html = readFileSync(inputPath, "utf-8");
    const clean = extractCleanHtml(html);
    const normalization = normalizeHtmlCssForWebflow(clean.cleanHtml, clean.extractedStyles);
    const cssResult = parseCSS(normalization.css);

    let components = componentizeHtml(normalization.html);
    const namingResult = applyDeterministicComponentNames(components);
    components = namingResult.componentTree;
    const semanticContext = buildSemanticPatchRequest(
      normalization.html,
      components,
      cssResult.classIndex,
      cssResult.cssVariables
    );

    const originalUseLlm = process.env.USE_LLM;
    const originalMock = process.env.FLOWBRIDGE_LLM_MOCK;

    try {
      process.env.USE_LLM = "0";
      process.env.FLOWBRIDGE_LLM_MOCK = "1";
      const disabled = await requestFlowbridgeSemanticPatch(semanticContext.request, { model: "mock" });
      expect(disabled.patch).toBeNull();

      process.env.USE_LLM = "1";
      const response = await requestFlowbridgeSemanticPatch(semanticContext.request, { model: "mock" });
      expect(response.patch).toBeTruthy();

      const patched = applySemanticPatchResponse({
        componentTree: components,
        patch: response.patch!,
      });

      const names = patched.componentTree.components.map((component) => component.name);
      const expected = ["Nav", "Hero", "Bento/Features", "Problem", "How it works", "Pricing", "Footer"];
      expected.forEach((name) => {
        expect(names).toContain(name);
      });
    } finally {
      process.env.USE_LLM = originalUseLlm;
      process.env.FLOWBRIDGE_LLM_MOCK = originalMock;
    }
  });
});

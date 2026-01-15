import { existsSync, readFileSync } from "fs";
import assert from "assert";
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

async function run() {
  const primaryPath = "/mnt/data/flow-bridge-bento.html";
  const fallbackPath = "temp/tests/flow-bridge-bento.html";
  const inputPath = existsSync(primaryPath) ? primaryPath : fallbackPath;

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

  process.env.USE_LLM = "0";
  process.env.FLOWBRIDGE_LLM_MOCK = "1";
  const disabled = await requestFlowbridgeSemanticPatch(semanticContext.request, { model: "mock" });
  assert.strictEqual(disabled.patch, null, "LLM should be disabled when USE_LLM=0");

  process.env.USE_LLM = "1";
  const response = await requestFlowbridgeSemanticPatch(semanticContext.request, { model: "mock" });
  assert(response.patch, "Expected mock LLM response");

  const patched = applySemanticPatchResponse({
    componentTree: components,
    patch: response.patch,
  });

  const names = patched.componentTree.components.map((component) => component.name);
  const expected = ["Nav", "Hero", "Bento/Features", "Problem", "How it works", "Pricing", "Footer"];
  expected.forEach((name) => {
    assert(names.includes(name), `Missing component name: ${name}`);
  });

  console.log("flowbridge-semantic test passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

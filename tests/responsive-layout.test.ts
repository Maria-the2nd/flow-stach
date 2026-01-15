import assert from "assert";
import { extractTokens } from "../lib/token-extractor";
import { buildTokenWebflowPayload, convertHtmlCssToWebflow, WebflowStyle } from "../lib/webflow-converter";

function findStyle(styles: WebflowStyle[], name: string): WebflowStyle | undefined {
  return styles.find(s => s.name === name);
}

async function run() {
  const cssTokens = `
    :root {
      --space-test: 32px;
      --space-md: 1rem;
    }
  `;
  const tokens = extractTokens(cssTokens, "Flow Party");
  const tokenPayload = buildTokenWebflowPayload(tokens);
  const ns = tokens.namespace;
  const gapClass = `${ns}-gap-space-test`;
  const gapStyle = findStyle(tokenPayload.payload.styles, gapClass);
  assert(gapStyle, `Missing style ${gapClass}`);
  assert(gapStyle!.styleLess.includes("gap: 2rem;"), "px→rem conversion failed for base");
  assert(gapStyle!.variants.tiny.styleLess.includes("gap: 1.7rem;"), "tiny variant scaling failed");
  assert(gapStyle!.variants.small.styleLess.includes("gap: 1.8rem;"), "small variant scaling failed");
  assert(gapStyle!.variants.medium.styleLess.includes("gap: 2rem;"), "medium variant scaling failed");
  assert(gapStyle!.variants.desktop.styleLess.includes("gap: 2.2rem;"), "desktop variant scaling failed");

  const html = `<div class="bento-grid"><div></div><div></div><div></div><div></div></div>`;
  const css = `.bento-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }`;
  const payload = convertHtmlCssToWebflow(html, css, {});
  const bento = findStyle(payload.payload.styles, "bento-grid");
  assert(bento, "Missing bento-grid style");
  const small = bento!.variants["small"];
  const tiny = bento!.variants["tiny"];
  assert(small && small.styleLess.includes("grid-template-columns: repeat(3, minmax(0, 1fr));"), "small breakpoint grid fix failed");
  assert(tiny && tiny.styleLess.includes("grid-template-columns: 1fr;"), "tiny breakpoint grid fix failed");

  console.log("responsive-layout test passed");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

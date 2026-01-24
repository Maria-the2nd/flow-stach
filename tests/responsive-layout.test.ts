import { describe, it, expect } from "vitest";
import { extractTokens } from "../lib/token-extractor";
import { buildTokenWebflowPayload, convertHtmlCssToWebflow, WebflowStyle } from "../lib/webflow-converter";

function findStyle(styles: WebflowStyle[], name: string): WebflowStyle | undefined {
  return styles.find((s) => s.name === name);
}

describe("responsive layout", () => {
  it("scales gap tokens across breakpoints", () => {
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

    expect(gapStyle).toBeDefined();
    expect(gapStyle!.styleLess).toContain("gap: 2rem;");
    expect(gapStyle!.variants.tiny.styleLess).toContain("gap: 1.7rem;");
    expect(gapStyle!.variants.small.styleLess).toContain("gap: 1.8rem;");
    expect(gapStyle!.variants.medium.styleLess).toContain("gap: 2rem;");
    expect(gapStyle!.variants.desktop.styleLess).toContain("gap: 2.2rem;");
  });

  it("applies grid fixes for breakpoints", () => {
    const html = `<div class="bento-grid"><div></div><div></div><div></div><div></div></div>`;
    const css = `.bento-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }`;
    const payload = convertHtmlCssToWebflow(html, css, {});
    const bento = findStyle(payload.payload.styles, "bento-grid");

    expect(bento).toBeDefined();
    expect(bento!.variants.small.styleLess).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(bento!.variants.tiny.styleLess).toContain("grid-template-columns: 1fr;");
  });
});

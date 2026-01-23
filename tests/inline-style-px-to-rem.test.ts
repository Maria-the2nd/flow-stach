/**
 * Inline Style PX to REM Conversion Tests
 *
 * Verifies that inline style px values are converted to rem during Webflow conversion.
 */

import { describe, it, expect } from "vitest";
import { convertInlineStylePxToRem, convertHtmlCssToWebflow } from "../lib/webflow-converter";

describe("convertInlineStylePxToRem", () => {
  describe("basic conversions", () => {
    it("converts simple px value to rem", () => {
      const result = convertInlineStylePxToRem("width: 100px");
      expect(result).toBe("width: 6.25rem");
    });

    it("converts multiple px values", () => {
      const result = convertInlineStylePxToRem("width: 100px; height: 50px");
      expect(result).toBe("width: 6.25rem; height: 3.125rem");
    });

    it("converts padding shorthand with multiple px values", () => {
      const result = convertInlineStylePxToRem("padding: 16px 24px");
      expect(result).toBe("padding: 1rem 1.5rem");
    });

    it("converts margin with four values", () => {
      const result = convertInlineStylePxToRem("margin: 8px 16px 24px 32px");
      expect(result).toBe("margin: 0.5rem 1rem 1.5rem 2rem");
    });
  });

  describe("1px exception", () => {
    it("keeps 1px as px (thin borders)", () => {
      const result = convertInlineStylePxToRem("border-width: 1px");
      expect(result).toBe("border-width: 1px");
    });

    it("keeps -1px as px", () => {
      const result = convertInlineStylePxToRem("margin-top: -1px");
      expect(result).toBe("margin-top: -1px");
    });

    it("converts 2px to rem but keeps 1px", () => {
      const result = convertInlineStylePxToRem("border: 1px; padding: 2px");
      expect(result).toBe("border: 1px; padding: 0.125rem");
    });
  });

  describe("preserves non-px units", () => {
    it("preserves rem values", () => {
      const result = convertInlineStylePxToRem("width: 10rem");
      expect(result).toBe("width: 10rem");
    });

    it("preserves em values", () => {
      const result = convertInlineStylePxToRem("font-size: 1.2em");
      expect(result).toBe("font-size: 1.2em");
    });

    it("preserves percentage values", () => {
      const result = convertInlineStylePxToRem("width: 100%");
      expect(result).toBe("width: 100%");
    });

    it("preserves viewport units", () => {
      const result = convertInlineStylePxToRem("height: 100vh; width: 50vw");
      expect(result).toBe("height: 100vh; width: 50vw");
    });

    it("preserves vmin/vmax units", () => {
      const result = convertInlineStylePxToRem("width: 80vmin; height: 90vmax");
      expect(result).toBe("width: 80vmin; height: 90vmax");
    });

    it("preserves ch units", () => {
      const result = convertInlineStylePxToRem("max-width: 60ch");
      expect(result).toBe("max-width: 60ch");
    });
  });

  describe("mixed units", () => {
    it("converts px but preserves other units in same string", () => {
      const result = convertInlineStylePxToRem("width: 100px; height: 100%");
      expect(result).toBe("width: 6.25rem; height: 100%");
    });

    it("handles mixed units in multi-value property", () => {
      // When both px and other units are in the same value
      const result = convertInlineStylePxToRem("padding: 16px 10%");
      expect(result).toBe("padding: 1rem 10%");
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      const result = convertInlineStylePxToRem("");
      expect(result).toBe("");
    });

    it("handles negative px values", () => {
      const result = convertInlineStylePxToRem("margin-top: -16px");
      expect(result).toBe("margin-top: -1rem");
    });

    it("handles decimal px values", () => {
      const result = convertInlineStylePxToRem("font-size: 14.5px");
      expect(result).toBe("font-size: 0.9063rem");
    });

    it("handles unitless values (line-height, z-index)", () => {
      const result = convertInlineStylePxToRem("line-height: 1.5; z-index: 100");
      expect(result).toBe("line-height: 1.5; z-index: 100");
    });

    it("handles calc() expressions (pass through)", () => {
      const result = convertInlineStylePxToRem("width: calc(100% - 16px)");
      // calc() is complex, we just pass it through
      expect(result).toBe("width: calc(100% - 16px)");
    });
  });

  describe("custom base px", () => {
    it("uses custom base for conversion", () => {
      // With base 10, 100px = 10rem
      const result = convertInlineStylePxToRem("width: 100px", 10);
      expect(result).toBe("width: 10rem");
    });
  });
});

describe("Inline styles in Webflow conversion", () => {
  it("converts inline style px to rem in HTML nodes", () => {
    const html = `<div class="container" style="width: 100px; padding: 16px 24px;">Content</div>`;
    const css = `.container { display: flex; }`;
    const result = convertHtmlCssToWebflow(html, css);

    // Find the inline style class created
    const inlineStyle = result.payload.styles.find((s) => s.name.startsWith("inline-"));
    expect(inlineStyle).toBeDefined();

    // Verify px values were converted to rem
    expect(inlineStyle?.styleLess).toContain("6.25rem"); // 100px
    expect(inlineStyle?.styleLess).toContain("1rem");    // 16px
    expect(inlineStyle?.styleLess).toContain("1.5rem");  // 24px

    // Should NOT contain px values (except maybe 1px)
    expect(inlineStyle?.styleLess).not.toContain("100px");
    expect(inlineStyle?.styleLess).not.toContain("16px");
    expect(inlineStyle?.styleLess).not.toContain("24px");
  });

  it("preserves 1px in inline styles", () => {
    const html = `<div style="border-width: 1px; padding: 16px;">Content</div>`;
    const css = ``;
    const result = convertHtmlCssToWebflow(html, css);

    const inlineStyle = result.payload.styles.find((s) => s.name.startsWith("inline-"));
    expect(inlineStyle).toBeDefined();

    // 1px should be preserved
    expect(inlineStyle?.styleLess).toContain("1px");
    // 16px should be converted
    expect(inlineStyle?.styleLess).toContain("1rem");
  });

  it("preserves non-px units in inline styles", () => {
    const html = `<div style="width: 100%; height: 50vh; font-size: 1.2em;">Content</div>`;
    const css = ``;
    const result = convertHtmlCssToWebflow(html, css);

    const inlineStyle = result.payload.styles.find((s) => s.name.startsWith("inline-"));
    expect(inlineStyle).toBeDefined();

    expect(inlineStyle?.styleLess).toContain("100%");
    expect(inlineStyle?.styleLess).toContain("50vh");
    expect(inlineStyle?.styleLess).toContain("1.2em");
  });
});

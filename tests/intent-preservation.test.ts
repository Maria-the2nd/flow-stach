/**
 * Tests for intent preservation in the Webflow converter.
 * These tests verify that source CSS intent is not lost during conversion.
 */

import { describe, test, expect } from "vitest";
import { parseCSS, ELEMENT_TO_CLASS_MAP } from "../lib/css-parser";
import { literalizeCssForWebflow } from "../lib/webflow-literalizer";

describe("Intent Preservation", () => {
  describe("Issue 1: Structural Spacing Preservation", () => {
    test("extracts section padding from element selector", () => {
      const css = `section { padding: 80px 0; }`;
      const result = parseCSS(css);
      const wfSection = result.classIndex.classes["wf-section"];

      expect(wfSection).toBeDefined();
      expect(wfSection.baseStyles).toContain("padding-top: 80px");
      expect(wfSection.baseStyles).toContain("padding-bottom: 80px");
    });

    test("extracts nav margin from element selector", () => {
      const css = `nav { margin-bottom: 20px; }`;
      const result = parseCSS(css);
      const wfNav = result.classIndex.classes["wf-nav"];

      expect(wfNav).toBeDefined();
      expect(wfNav.baseStyles).toContain("margin-bottom: 20px");
    });

    test("extracts header padding with CSS variable", () => {
      const css = `:root { --header-padding: 60px; }
        header { padding-top: var(--header-padding); padding-bottom: var(--header-padding); }`;
      const result = parseCSS(css);
      const wfHeader = result.classIndex.classes["wf-header"];

      expect(wfHeader).toBeDefined();
      expect(wfHeader.baseStyles).toContain("padding-top: 60px");
      expect(wfHeader.baseStyles).toContain("padding-bottom: 60px");
    });

    test("extracts footer spacing from element selector", () => {
      const css = `footer { padding: 40px 20px; margin-top: 60px; }`;
      const result = parseCSS(css);
      const wfFooter = result.classIndex.classes["wf-footer"];

      expect(wfFooter).toBeDefined();
      expect(wfFooter.baseStyles).toContain("padding-top: 40px");
      expect(wfFooter.baseStyles).toContain("margin-top: 60px");
    });

    test("ELEMENT_TO_CLASS_MAP includes structural elements", () => {
      expect(ELEMENT_TO_CLASS_MAP["section"]).toBe("wf-section");
      expect(ELEMENT_TO_CLASS_MAP["nav"]).toBe("wf-nav");
      expect(ELEMENT_TO_CLASS_MAP["header"]).toBe("wf-header");
      expect(ELEMENT_TO_CLASS_MAP["footer"]).toBe("wf-footer");
      expect(ELEMENT_TO_CLASS_MAP["main"]).toBe("wf-main");
      expect(ELEMENT_TO_CLASS_MAP["article"]).toBe("wf-article");
      expect(ELEMENT_TO_CLASS_MAP["aside"]).toBe("wf-aside");
    });
  });

  describe("Issue 2: Font-Family Quote Preservation", () => {
    test("preserves font-family quotes from CSS variable", () => {
      const css = `:root { --font: "Inter", sans-serif; }
        h1 { font-family: var(--font); }`;
      const result = literalizeCssForWebflow(css);

      // The resolved value should keep the quotes around "Inter"
      expect(result.css).toContain('"Inter"');
    });

    test("preserves font-family with space in name", () => {
      const css = `:root { --font-heading: "Plus Jakarta Sans", sans-serif; }
        h1 { font-family: var(--font-heading); }`;
      const result = literalizeCssForWebflow(css);

      expect(result.css).toContain('"Plus Jakarta Sans"');
    });

    test("preserves direct font-family declaration with quotes", () => {
      const css = `h1 { font-family: "Antonio", sans-serif; }`;
      const result = literalizeCssForWebflow(css);

      expect(result.css).toContain('"Antonio"');
    });

    test("preserves multiple font-family declarations", () => {
      const css = `
        h1 { font-family: "Antonio", sans-serif; }
        p { font-family: "Inter", system-ui, sans-serif; }
      `;
      const result = literalizeCssForWebflow(css);

      expect(result.css).toContain('"Antonio"');
      expect(result.css).toContain('"Inter"');
    });
  });

  describe("Issue 3: Flex-Wrap Default Injection", () => {
    test("does not inject flex-wrap: nowrap on flex containers", () => {
      const css = `.flex-container { display: flex; gap: 20px; }`;
      const result = parseCSS(css);
      const flexClass = result.classIndex.classes["flex-container"];

      expect(flexClass).toBeDefined();
      // Should NOT contain flex-wrap: nowrap (browser default is fine)
      expect(flexClass.baseStyles).not.toContain("flex-wrap");
    });

    test("preserves explicit flex-wrap: wrap when specified", () => {
      const css = `.flex-container { display: flex; flex-wrap: wrap; }`;
      const result = parseCSS(css);
      const flexClass = result.classIndex.classes["flex-container"];

      expect(flexClass).toBeDefined();
      expect(flexClass.baseStyles).toContain("flex-wrap: wrap");
    });

    test("preserves explicit flex-wrap: nowrap when specified", () => {
      const css = `.flex-container { display: flex; flex-wrap: nowrap; }`;
      const result = parseCSS(css);
      const flexClass = result.classIndex.classes["flex-container"];

      expect(flexClass).toBeDefined();
      expect(flexClass.baseStyles).toContain("flex-wrap: nowrap");
    });
  });

  describe("Preserved Workarounds (Grid Compatibility)", () => {
    test("still injects grid-template-rows: auto for grids without rows", () => {
      const css = `.grid { display: grid; grid-template-columns: 1fr 1fr; }`;
      const result = parseCSS(css);
      const gridClass = result.classIndex.classes["grid"];

      expect(gridClass).toBeDefined();
      // This is the Webflow zero-rows fix that MUST be preserved
      expect(gridClass.baseStyles).toContain("grid-template-rows: auto");
    });

    test("does not inject grid-template-rows when already specified", () => {
      const css = `.grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 100px; }`;
      const result = parseCSS(css);
      const gridClass = result.classIndex.classes["grid"];

      expect(gridClass).toBeDefined();
      expect(gridClass.baseStyles).toContain("grid-template-rows: 100px");
      // Should not double-inject
      expect(gridClass.baseStyles.match(/grid-template-rows/g)?.length).toBe(1);
    });
  });
});

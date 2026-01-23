/**
 * CSS Unit Preservation Tests
 *
 * Verifies that the CSS parser and Webflow converter preserve all CSS units
 * (rem, em, %, vh, vw, vmin, vmax, ch, ex, calc, clamp, etc.)
 */

import { describe, it, expect } from "vitest";
import { parseCSS, propertiesToStyleLess } from "../lib/css-parser";
import { convertHtmlCssToWebflow } from "../lib/webflow-converter";

describe("CSS Unit Preservation", () => {
  describe("parseCSS preserves units in values", () => {
    it("preserves rem units", () => {
      const css = `.test { font-size: 1.5rem; padding: 2rem; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      expect(entry?.baseStyles).toContain("font-size: 1.5rem");
      // Shorthand is expanded to longhand properties, but units are preserved
      expect(entry?.baseStyles).toContain("padding-top: 2rem");
      expect(entry?.baseStyles).toContain("padding-right: 2rem");
    });

    it("preserves em units", () => {
      const css = `.test { font-size: 1.2em; margin: 0.5em; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      expect(entry?.baseStyles).toContain("font-size: 1.2em");
      // Shorthand is expanded to longhand properties, but units are preserved
      expect(entry?.baseStyles).toContain("margin-top: 0.5em");
      expect(entry?.baseStyles).toContain("margin-left: 0.5em");
    });

    it("preserves percentage units", () => {
      const css = `.test { width: 100%; height: 50%; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      expect(entry?.baseStyles).toContain("width: 100%");
      expect(entry?.baseStyles).toContain("height: 50%");
    });

    it("preserves viewport units (vh, vw)", () => {
      const css = `.test { height: 100vh; width: 50vw; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      expect(entry?.baseStyles).toContain("height: 100vh");
      expect(entry?.baseStyles).toContain("width: 50vw");
    });

    it("preserves vmin/vmax units", () => {
      const css = `.test { width: 80vmin; height: 90vmax; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      expect(entry?.baseStyles).toContain("width: 80vmin");
      expect(entry?.baseStyles).toContain("height: 90vmax");
    });

    it("preserves ch units", () => {
      const css = `.test { width: 60ch; max-width: 80ch; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      expect(entry?.baseStyles).toContain("width: 60ch");
      expect(entry?.baseStyles).toContain("max-width: 80ch");
    });

    it("preserves px units", () => {
      const css = `.test { font-size: 16px; padding: 24px; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      expect(entry?.baseStyles).toContain("font-size: 16px");
      // Shorthand is expanded to longhand properties, but units are preserved
      expect(entry?.baseStyles).toContain("padding-top: 24px");
      expect(entry?.baseStyles).toContain("padding-bottom: 24px");
    });

    it("preserves unitless values (line-height, z-index)", () => {
      const css = `.test { line-height: 1.5; z-index: 100; opacity: 0.8; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      expect(entry?.baseStyles).toContain("line-height: 1.5");
      expect(entry?.baseStyles).toContain("z-index: 100");
      // Note: opacity 0 gets normalized to 1 for visibility, so we use 0.8
      expect(entry?.baseStyles).toContain("opacity: 0.8");
    });

    it("preserves calc() expressions", () => {
      const css = `.test { width: calc(100% - 2rem); height: calc(100vh - 80px); }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      expect(entry?.baseStyles).toContain("width: calc(100% - 2rem)");
      expect(entry?.baseStyles).toContain("height: calc(100vh - 80px)");
    });

    it("preserves clamp() expressions", () => {
      const css = `.test { font-size: clamp(1rem, 2vw, 2rem); }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      expect(entry?.baseStyles).toContain("font-size: clamp(1rem, 2vw, 2rem)");
    });

    it("preserves min()/max() expressions", () => {
      const css = `.test { width: min(100%, 1200px); height: max(300px, 50vh); }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      expect(entry?.baseStyles).toContain("width: min(100%, 1200px)");
      expect(entry?.baseStyles).toContain("height: max(300px, 50vh)");
    });

    it("preserves mixed units in shorthand properties", () => {
      const css = `.test { padding: 1rem 2em 3vh 4%; margin: 10px 2rem; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      // Shorthand gets expanded to individual properties
      expect(entry?.baseStyles).toContain("padding-top: 1rem");
      expect(entry?.baseStyles).toContain("padding-right: 2em");
      expect(entry?.baseStyles).toContain("padding-bottom: 3vh");
      expect(entry?.baseStyles).toContain("padding-left: 4%");
    });

    it("preserves grid fr units", () => {
      const css = `.test { display: grid; grid-template-columns: 1fr 2fr 1fr; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      expect(entry?.baseStyles).toContain("grid-template-columns: 1fr 2fr 1fr");
    });
  });

  describe("Webflow conversion preserves units", () => {
    it("preserves rem units in Webflow payload", () => {
      const html = `<div class="test">Content</div>`;
      const css = `.test { font-size: 1.5rem; padding: 2rem; }`;
      const result = convertHtmlCssToWebflow(html, css);

      const style = result.payload.styles.find((s) => s.name === "test");
      expect(style?.styleLess).toContain("font-size: 1.5rem");
      // Shorthand is expanded to longhand properties, but units are preserved
      expect(style?.styleLess).toContain("padding-top: 2rem");
      expect(style?.styleLess).toContain("padding-right: 2rem");
    });

    it("preserves viewport units in Webflow payload", () => {
      const html = `<div class="hero">Content</div>`;
      const css = `.hero { height: 100vh; min-height: 80vh; }`;
      const result = convertHtmlCssToWebflow(html, css);

      const style = result.payload.styles.find((s) => s.name === "hero");
      expect(style?.styleLess).toContain("height: 100vh");
      expect(style?.styleLess).toContain("min-height: 80vh");
    });

    it("preserves calc() in Webflow payload", () => {
      const html = `<div class="container">Content</div>`;
      const css = `.container { width: calc(100% - 4rem); }`;
      const result = convertHtmlCssToWebflow(html, css);

      const style = result.payload.styles.find((s) => s.name === "container");
      expect(style?.styleLess).toContain("width: calc(100% - 4rem)");
    });

    it("converts clamp() to max value in Webflow payload (prevents Designer breakage)", () => {
      const html = `<h1 class="title">Title</h1>`;
      const css = `.title { font-size: clamp(1.5rem, 4vw, 3rem); }`;
      const result = convertHtmlCssToWebflow(html, css);

      const style = result.payload.styles.find((s) => s.name === "title");
      // clamp() breaks Webflow Designer, so it's converted to max value
      expect(style?.styleLess).toContain("font-size: 3rem");
      expect(style?.styleLess).not.toContain("clamp(");
    });
  });

  describe("Media query breakpoint detection", () => {
    it("detects px-based max-width breakpoints", () => {
      const css = `
        .test { font-size: 16px; }
        @media (max-width: 767px) { .test { font-size: 14px; } }
      `;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      expect(entry?.mediaQueries.small).toContain("font-size: 14px");
    });

    // rem-based breakpoints are now supported
    it("detects rem-based max-width breakpoints", () => {
      const css = `
        .test { font-size: 16px; }
        @media (max-width: 48rem) { .test { font-size: 14px; } }
      `;
      // 48rem = 768px, which maps to "medium" breakpoint (<=991px)
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      expect(entry?.mediaQueries.medium).toContain("font-size: 14px");
    });

    it("detects em-based max-width breakpoints", () => {
      const css = `
        .test { font-size: 16px; }
        @media (max-width: 30em) { .test { font-size: 12px; } }
      `;
      // 30em = 480px, which maps to "tiny" breakpoint (<=479px) - closest match
      // Actually 480px is NOT <=479, so it goes to small (<=767px)
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      expect(entry?.mediaQueries.small).toContain("font-size: 12px");
    });

    it("detects px-based min-width breakpoints", () => {
      const css = `
        .test { font-size: 14px; }
        @media (min-width: 768px) { .test { font-size: 16px; } }
      `;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      // min-width promotes to base styles
      expect(entry?.baseStyles).toContain("font-size: 16px");
    });
  });

  describe("CSS variable resolution preserves units", () => {
    it("preserves units when resolving CSS variables", () => {
      const css = `
        :root { --spacing: 2rem; --font-size: 1.5rem; }
        .test { padding: var(--spacing); font-size: var(--font-size); }
      `;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      // Shorthand is expanded and CSS variable is resolved, but units are preserved
      expect(entry?.baseStyles).toContain("padding-top: 2rem");
      expect(entry?.baseStyles).toContain("padding-left: 2rem");
      expect(entry?.baseStyles).toContain("font-size: 1.5rem");
    });

    it("preserves calc() in CSS variable values", () => {
      const css = `
        :root { --content-width: calc(100% - 4rem); }
        .test { width: var(--content-width); }
      `;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["test"];
      expect(entry?.baseStyles).toContain("width: calc(100% - 4rem)");
    });
  });
});

describe("Edge cases", () => {
  it("handles dvh/dvw (dynamic viewport units)", () => {
    const css = `.test { height: 100dvh; width: 100dvw; }`;
    const result = parseCSS(css);
    const entry = result.classIndex.classes["test"];
    expect(entry?.baseStyles).toContain("height: 100dvh");
    expect(entry?.baseStyles).toContain("width: 100dvw");
  });

  it("handles svh/svw/lvh/lvw units", () => {
    const css = `.test { min-height: 100svh; max-height: 100lvh; }`;
    const result = parseCSS(css);
    const entry = result.classIndex.classes["test"];
    expect(entry?.baseStyles).toContain("min-height: 100svh");
    expect(entry?.baseStyles).toContain("max-height: 100lvh");
  });

  it("handles ex units", () => {
    const css = `.test { height: 2ex; }`;
    const result = parseCSS(css);
    const entry = result.classIndex.classes["test"];
    expect(entry?.baseStyles).toContain("height: 2ex");
  });

  it("handles negative values with units", () => {
    const css = `.test { margin-top: -2rem; transform: translateX(-50%); }`;
    const result = parseCSS(css);
    const entry = result.classIndex.classes["test"];
    expect(entry?.baseStyles).toContain("margin-top: -2rem");
    expect(entry?.baseStyles).toContain("transform: translateX(-50%)");
  });

  it("handles decimal values with units", () => {
    const css = `.test { font-size: 0.875rem; line-height: 1.625; }`;
    const result = parseCSS(css);
    const entry = result.classIndex.classes["test"];
    expect(entry?.baseStyles).toContain("font-size: 0.875rem");
    expect(entry?.baseStyles).toContain("line-height: 1.625");
  });
});

/**
 * Bug Fix Tests
 * Tests for the two critical bugs that break Webflow Designer:
 * 1. clamp() function conversion
 * 2. Descendant selector handling
 */

import { describe, it, expect } from "vitest";
import { parseCSS } from "../lib/css-parser";
import { convertHtmlCssToWebflow } from "../lib/webflow-converter";

describe("Critical Bug Fixes", () => {
  describe("Bug 1: clamp() function conversion", () => {
    it("converts clamp() to max value in sanitizeStyleLess", () => {
      const css = `.hero { font-size: clamp(48px, 10vw, 110px); }`;
      const html = `<div class="hero">Hero</div>`;

      const result = convertHtmlCssToWebflow(html, css);
      const heroStyle = result.payload.styles.find(s => s.name === "hero");

      expect(heroStyle).toBeDefined();
      expect(heroStyle?.styleLess).toContain("110px");
      expect(heroStyle?.styleLess).not.toContain("clamp(");
    });

    it("converts min() to smallest value", () => {
      const css = `.box { width: min(100%, 500px); }`;
      const html = `<div class="box">Box</div>`;

      const result = convertHtmlCssToWebflow(html, css);
      const boxStyle = result.payload.styles.find(s => s.name === "box");

      expect(boxStyle).toBeDefined();
      // Should use 100 (from 100%)
      expect(boxStyle?.styleLess).not.toContain("min(");
    });

    it("converts max() to largest value", () => {
      const css = `.container { width: max(50%, 300px); }`;
      const html = `<div class="container">Container</div>`;

      const result = convertHtmlCssToWebflow(html, css);
      const containerStyle = result.payload.styles.find(s => s.name === "container");

      expect(containerStyle).toBeDefined();
      expect(containerStyle?.styleLess).not.toContain("max(");
    });
  });

  describe("Bug 2: Descendant selector handling", () => {
    it("converts .hero h1 to .hero .heading-h1", () => {
      const css = `.hero h1 { margin-bottom: 24px; }`;
      const result = parseCSS(css);

      // Should have heading-h1 class with margin-bottom
      const h1Entry = result.classIndex.classes["heading-h1"];
      expect(h1Entry).toBeDefined();
      expect(h1Entry?.baseStyles).toContain("margin-bottom: 24px");

      // Should have a warning about conversion
      const conversionWarning = result.classIndex.warnings.find(
        w => w.message.includes("Converted descendant element selector")
      );
      expect(conversionWarning).toBeDefined();
    });

    it("handles .card p descendant selector", () => {
      const css = `.card p { color: #333; font-size: 16px; }`;
      const result = parseCSS(css);

      // Should create paragraph class entry (p maps to "text-body")
      const pEntry = result.classIndex.classes["text-body"];
      expect(pEntry).toBeDefined();
      expect(pEntry?.baseStyles).toContain("color: #333");
      expect(pEntry?.baseStyles).toContain("font-size: 16px");
    });

    it("handles multiple descendant selectors", () => {
      const css = `
        .hero h1 { font-size: 48px; }
        .hero h2 { font-size: 32px; }
        .hero p { font-size: 18px; }
      `;
      const result = parseCSS(css);

      // All element classes should exist
      expect(result.classIndex.classes["heading-h1"]).toBeDefined();
      expect(result.classIndex.classes["heading-h2"]).toBeDefined();
      expect(result.classIndex.classes["text-body"]).toBeDefined();

      // Each should have correct styles
      expect(result.classIndex.classes["heading-h1"]?.baseStyles).toContain("font-size: 48px");
      expect(result.classIndex.classes["heading-h2"]?.baseStyles).toContain("font-size: 32px");
      expect(result.classIndex.classes["text-body"]?.baseStyles).toContain("font-size: 18px");
    });

    it("preserves parent class relationship", () => {
      const css = `.hero h1 { margin-bottom: 24px; }`;
      const result = parseCSS(css);

      const h1Entry = result.classIndex.classes["heading-h1"];
      expect(h1Entry?.parentClasses).toContain("hero");
    });
  });

  describe("Combined: Both bugs in real-world scenario", () => {
    it("handles bento-style template with clamp() and descendant selectors", () => {
      const css = `
        .hero {
          padding: clamp(48px, 10vw, 110px);
        }
        .hero h1 {
          font-size: clamp(32px, 5vw, 72px);
          margin-bottom: 24px;
        }
        .hero p {
          font-size: max(16px, 1.2rem);
        }
      `;
      const html = `
        <div class="hero">
          <h1>Hero Title</h1>
          <p>Hero description</p>
        </div>
      `;

      const result = convertHtmlCssToWebflow(html, css);

      // Check that clamp() was converted
      const heroStyle = result.payload.styles.find(s => s.name === "hero");
      expect(heroStyle?.styleLess).not.toContain("clamp(");
      expect(heroStyle?.styleLess).toContain("110px");

      // Check that descendant selectors were handled
      const h1Style = result.payload.styles.find(s => s.name === "heading-h1");
      expect(h1Style).toBeDefined();
      expect(h1Style?.styleLess).not.toContain("clamp(");
      expect(h1Style?.styleLess).toContain("margin-bottom: 24px");

      const pStyle = result.payload.styles.find(s => s.name === "text-body");
      expect(pStyle).toBeDefined();
      expect(pStyle?.styleLess).not.toContain("max(");
    });
  });
});

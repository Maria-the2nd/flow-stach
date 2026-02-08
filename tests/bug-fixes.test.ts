/**
 * Bug Fix Tests
 * Tests for the two critical bugs that break Webflow Designer:
 * 1. clamp() function conversion
 * 2. Descendant selector handling
 */

import { describe, it, expect } from "vitest";
import { parseCSS } from "../lib/css-parser";
import { convertHtmlCssToWebflow } from "../lib/webflow-converter";
import { routeCSS } from "../lib/css-embed-router";
import { literalizeCssForWebflow } from "../lib/webflow-literalizer";

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
    it("converts .hero h1 to modifier class hero-h1", () => {
      const css = `.hero h1 { margin-bottom: 24px; }`;
      const result = parseCSS(css);

      // Base element class should exist (may be empty)
      const h1Entry = result.classIndex.classes["heading-h1"];
      expect(h1Entry).toBeDefined();

      // Modifier class hero-h1 should have the descendant-specific styles
      const modifierEntry = result.classIndex.classes["hero-h1"];
      expect(modifierEntry).toBeDefined();
      expect(modifierEntry?.baseStyles).toContain("margin-bottom: 24px");

      // Should have a warning about conversion
      const conversionWarning = result.classIndex.warnings.find(
        w => w.message.includes("Converted descendant element selector")
      );
      expect(conversionWarning).toBeDefined();
    });

    it("handles .card p descendant selector", () => {
      const css = `.card p { color: #333; font-size: 16px; }`;
      const result = parseCSS(css);

      // Base element class should exist
      const pEntry = result.classIndex.classes["text-body"];
      expect(pEntry).toBeDefined();

      // Modifier class card-p should have the styles
      const modifierEntry = result.classIndex.classes["card-p"];
      expect(modifierEntry).toBeDefined();
      expect(modifierEntry?.baseStyles).toContain("color: #333");
      expect(modifierEntry?.baseStyles).toContain("font-size: 16px");
    });

    it("handles multiple descendant selectors", () => {
      const css = `
        .hero h1 { font-size: 48px; }
        .hero h2 { font-size: 32px; }
        .hero p { font-size: 18px; }
      `;
      const result = parseCSS(css);

      // Base element classes should exist
      expect(result.classIndex.classes["heading-h1"]).toBeDefined();
      expect(result.classIndex.classes["heading-h2"]).toBeDefined();
      expect(result.classIndex.classes["text-body"]).toBeDefined();

      // Modifier classes should have the correct styles
      expect(result.classIndex.classes["hero-h1"]?.baseStyles).toContain("font-size: 48px");
      expect(result.classIndex.classes["hero-h2"]?.baseStyles).toContain("font-size: 32px");
      expect(result.classIndex.classes["hero-p"]?.baseStyles).toContain("font-size: 18px");
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

      // BEM COMBO CLASS APPROACH:
      // .hero h1 creates MODIFIER class (hero-h1) with context-specific styles
      // Base class (heading-h1) has typography from element selector
      // HTML gets BOTH: <h1 class="hero-h1 heading-h1">
      const h1Style = result.payload.styles.find(s => s.name === "heading-h1");
      expect(h1Style).toBeDefined();
      // heading-h1 has base typography, not the margin from descendant selector

      // Modifier class has the context-specific styles
      const heroH1Style = result.payload.styles.find(s => s.name === "hero-h1");
      expect(heroH1Style).toBeDefined();
      expect(heroH1Style?.styleLess).not.toContain("clamp(");
      expect(heroH1Style?.styleLess).toContain("margin-bottom: 24px");

      // .hero p creates MODIFIER class (hero-p)
      // Base class (text-body) has typography
      // HTML gets BOTH: <p class="hero-p text-body">
      const pStyle = result.payload.styles.find(s => s.name === "text-body");
      expect(pStyle).toBeDefined();

      const heroPStyle = result.payload.styles.find(s => s.name === "hero-p");
      expect(heroPStyle).toBeDefined();
      expect(heroPStyle?.styleLess).not.toContain("max(");
    });
  });

  describe("Bug 3: :nth-child() handling", () => {
    it("routes :nth-child() selectors to embed CSS", () => {
      const css = `
        :root {
          --cyan: #00ffff;
          --pink: #ff00ff;
          --yellow: #ffff00;
        }
        .step-card {
          padding: 20px;
        }
        .step-card:nth-child(1) {
          background: var(--cyan);
        }
        .step-card:nth-child(2) {
          background: var(--pink);
        }
        .step-card:nth-child(3) {
          background: var(--yellow);
        }
      `;

      const result = routeCSS(css);

      // :nth-child() rules should be routed to embed
      expect(result.embed).toContain(".step-card:nth-child(1)");
      expect(result.embed).toContain(".step-card:nth-child(2)");
      expect(result.embed).toContain(".step-card:nth-child(3)");

      // :root should also be in embed
      expect(result.embed).toContain(":root");
      expect(result.embed).toContain("--cyan");

      // Native CSS should have the base .step-card styles
      expect(result.native).toContain(".step-card");
      expect(result.native).toContain("padding");

      // Native CSS should NOT have :nth-child() rules
      expect(result.native).not.toContain(":nth-child");
    });

    it("resolves CSS variables in embed CSS after literalization", () => {
      const css = `
        :root {
          --cyan: #00ffff;
        }
        .step-card:nth-child(1) {
          background: var(--cyan);
        }
      `;

      // First literalize to resolve variables
      const literalized = literalizeCssForWebflow(css);

      // Check that variables are resolved
      expect(literalized.css).toContain("#00ffff");

      // Then route the literalized CSS
      const result = routeCSS(literalized.css);

      // The embed should have the resolved color value
      expect(result.embed).toContain(".step-card:nth-child(1)");
      expect(result.embed).toContain("#00ffff");
    });

    it("full pipeline: :nth-child() with CSS variable resolution", () => {
      const css = `
        :root {
          --cyan: #00ffff;
          --pink: #ff00ff;
        }
        .step-card {
          padding: 20px;
          border-radius: 8px;
        }
        .step-card:nth-child(1) {
          background: var(--cyan);
        }
        .step-card:nth-child(2) {
          background: var(--pink);
        }
      `;

      // 1. Literalize to resolve CSS variables
      const literalized = literalizeCssForWebflow(css);
      expect(literalized.remainingVarCount).toBe(0);

      // 2. Route to separate native vs embed
      const routed = routeCSS(literalized.css);

      // Native should have base .step-card styles only
      expect(routed.native).toContain("padding");
      expect(routed.native).toContain("border-radius");
      expect(routed.native).not.toContain(":nth-child");

      // Embed should have :nth-child rules with resolved colors
      expect(routed.embed).toContain(".step-card:nth-child(1)");
      expect(routed.embed).toContain("#00ffff");
      expect(routed.embed).toContain(".step-card:nth-child(2)");
      expect(routed.embed).toContain("#ff00ff");

      // Check routing stats
      expect(routed.stats.embedRules).toBeGreaterThan(0);
    });
  });

  describe("Bug 4: Inline style handling", () => {
    it("converts inline styles to Webflow classes", () => {
      const html = `
        <div class="container">
          <div style="text-align: center; margin-top: 32px;">
            <a href="#" class="btn">Click me</a>
          </div>
        </div>
      `;
      const css = `
        .container {
          padding: 20px;
        }
        .btn {
          background: blue;
          color: white;
        }
      `;

      const result = convertHtmlCssToWebflow(html, css);

      // Should have inline style class created
      const inlineStyle = result.payload.styles.find(s => s.name.startsWith("inline-"));
      expect(inlineStyle).toBeDefined();
      expect(inlineStyle?.styleLess).toContain("text-align: center");
      expect(inlineStyle?.styleLess).toContain("margin-top");

      // Verify the inline style ID is referenced by a node
      // In Webflow JSON, node.classes are UUIDs that reference style._id
      const inlineStyleId = inlineStyle?._id;
      const wrapperNode = result.payload.nodes.find(n =>
        n.classes?.includes(inlineStyleId as string)
      );
      expect(wrapperNode).toBeDefined();
    });

    it("preserves text-align center for button centering", () => {
      const html = `
        <div style="text-align: center; margin-top: 2rem;">
          <button class="cta-btn">See Example</button>
        </div>
      `;
      const css = `
        .cta-btn {
          display: inline-block;
          padding: 16px 32px;
          background: #4F46E5;
        }
      `;

      const result = convertHtmlCssToWebflow(html, css);

      // Check inline style was converted
      const inlineStyle = result.payload.styles.find(s => s.name.startsWith("inline-"));
      expect(inlineStyle).toBeDefined();
      expect(inlineStyle?.styleLess).toContain("text-align: center");

      // Button should have display: inline-block to respond to text-align
      const btnStyle = result.payload.styles.find(s => s.name === "cta-btn");
      expect(btnStyle).toBeDefined();
      expect(btnStyle?.styleLess).toContain("display: inline-block");
    });
  });
});

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

  describe("Bug: Heading font-family lost during BEM class conversion", () => {
    it("propagates font-family from class selector to heading base class", () => {
      const css = `.display { font-family: 'Anton', sans-serif; font-size: 64px; }`;
      const html = `<h1 class="display">Title</h1>`;

      const result = convertHtmlCssToWebflow(html, css);
      const headingStyle = result.payload.styles.find(s => s.name === "heading-h1");

      expect(headingStyle).toBeDefined();
      expect(headingStyle?.styleLess).toContain("font-family");
      expect(headingStyle?.styleLess).toContain("Anton");
    });

    it("does not override font-family already on heading base class", () => {
      // When .heading-h1 already has font-family (e.g., from a class selector),
      // propagation should not overwrite it with the applied class's font
      const css = `
        .heading-h1 { font-family: 'Playfair Display', serif; font-size: 48px; }
        .display { font-family: 'Anton', sans-serif; }
      `;
      const html = `<h1 class="display">Title</h1>`;

      const result = convertHtmlCssToWebflow(html, css);
      const headingStyle = result.payload.styles.find(s => s.name === "heading-h1");

      expect(headingStyle).toBeDefined();
      expect(headingStyle?.styleLess).toContain("Playfair Display");
      expect(headingStyle?.styleLess).not.toMatch(/font-family[^;]*Anton/);
    });

    it("propagates font-family from modifier class (descendant selector)", () => {
      const css = `.hero h1 { font-family: 'Oswald', sans-serif; font-size: 72px; }`;
      const html = `<div class="hero"><h1>Title</h1></div>`;

      const result = convertHtmlCssToWebflow(html, css);
      const headingStyle = result.payload.styles.find(s => s.name === "heading-h1");

      expect(headingStyle).toBeDefined();
      expect(headingStyle?.styleLess).toContain("font-family");
      expect(headingStyle?.styleLess).toContain("Oswald");
    });

    it("falls back to body font when no explicit heading font found", () => {
      // Simulates: body { font-family: 'Inter' } with headings that inherit
      // In production, body becomes .wf-body via normalizer
      const css = `
        .wf-body { font-family: 'Inter', sans-serif; }
        .heading-h3 { font-size: 1.2rem; font-weight: 700; }
        .gap-card { background: #1a1a1a; }
      `;
      const html = `
        <div class="gap-card"><h3 class="heading-h3">Card heading</h3></div>
      `;

      const result = convertHtmlCssToWebflow(html, css);
      const headingStyle = result.payload.styles.find(s => s.name === "heading-h3");

      // heading-h3 should get body font as fallback
      expect(headingStyle).toBeDefined();
      expect(headingStyle?.styleLess).toContain("font-family");
      expect(headingStyle?.styleLess).toContain("Inter");
    });

    it("leaves heading unchanged when no font found anywhere", () => {
      const css = `.display { font-size: 64px; color: red; }`;
      const html = `<h1 class="display">Title</h1>`;

      const result = convertHtmlCssToWebflow(html, css);
      const headingStyle = result.payload.styles.find(s => s.name === "heading-h1");

      // heading-h1 may or may not exist, but if it does, it shouldn't have font-family
      if (headingStyle) {
        expect(headingStyle.styleLess).not.toContain("font-family");
      }
    });
  });

  describe("Bug: Context-dependent color on heading base classes", () => {
    // NOTE: Production pipeline uses two-pass routing where bare element selectors
    // (h3 {}) survive to the normalizer and become .heading-h3 {} class selectors.
    // Tests here use pre-normalized CSS (class selectors) to simulate this behavior.

    it("removes color from base class when modifier has same color", () => {
      // Simulates production: h3 { color: white } → .heading-h3 { color: white }
      // and .gap-card h3 { color: white } → .gap-card-h3 { color: white }
      const css = `
        .heading-h3 { color: white; font-size: 1.2rem; font-weight: 700; }
        .gap-card-h3 { color: white; }
        .gap-card { background: #1a1a1a; padding: 24px; }
      `;
      const html = `
        <div class="section"><h3 class="heading-h3">Regular heading</h3></div>
        <div class="gap-card"><h3 class="heading-h3 gap-card-h3">Card heading</h3></div>
      `;

      const result = convertHtmlCssToWebflow(html, css);
      const headingStyle = result.payload.styles.find(s => s.name === "heading-h3");
      const modifierStyle = result.payload.styles.find(s => s.name === "gap-card-h3");

      // Base class should NOT have color (it was context-dependent)
      expect(headingStyle).toBeDefined();
      expect(headingStyle?.styleLess).not.toContain("color:");

      // Modifier should still have the color
      expect(modifierStyle).toBeDefined();
      expect(modifierStyle?.styleLess).toContain("color");
    });

    it("keeps color on base class when no modifier repeats it", () => {
      // Simulates production: h1 { color: #e8524b } → .heading-h1 { color: #e8524b }
      const css = `
        .heading-h1 { color: #e8524b; font-size: 4rem; }
      `;
      const html = `<h1 class="heading-h1">Red heading</h1>`;

      const result = convertHtmlCssToWebflow(html, css);
      const headingStyle = result.payload.styles.find(s => s.name === "heading-h1");

      // Base class should keep its color (no modifier has the same color)
      expect(headingStyle).toBeDefined();
      expect(headingStyle?.styleLess).toContain("#e8524b");
    });

    it("keeps color when modifier has different color", () => {
      // Simulates production: h3 { color: #333 } → .heading-h3 { color: #333 }
      // and .dark-section h3 { color: white } → .dark-section-h3 { color: white }
      const css = `
        .heading-h3 { color: #333; font-size: 1.2rem; }
        .dark-section-h3 { color: white; }
      `;
      const html = `
        <h3 class="heading-h3">Normal heading</h3>
        <div class="dark-section"><h3 class="heading-h3 dark-section-h3">Dark heading</h3></div>
      `;

      const result = convertHtmlCssToWebflow(html, css);
      const headingStyle = result.payload.styles.find(s => s.name === "heading-h3");

      // Base class should keep #333 (modifier has DIFFERENT color)
      expect(headingStyle).toBeDefined();
      expect(headingStyle?.styleLess).toContain("#333");
    });
  });

});

/**
 * Transition and Transform-Origin Support Tests
 *
 * Verifies that the CSS parser and Webflow converter properly handle:
 * - transition, transition-property, transition-duration, transition-timing-function, transition-delay
 * - transform-origin
 * - "all" → "transform, opacity" replacement for Webflow compatibility
 */

import { describe, it, expect } from "vitest";
import { parseCSS } from "../lib/css-parser";
import { convertHtmlCssToWebflow } from "../lib/webflow-converter";

describe("Transition Property Support", () => {
  describe("parseCSS handles transition longhands", () => {
    it("preserves transition-property", () => {
      const css = `.btn { transition-property: transform; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["btn"];
      expect(entry?.baseStyles).toContain("transition-property: transform");
    });

    it("preserves transition-duration", () => {
      const css = `.btn { transition-duration: 200ms; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["btn"];
      expect(entry?.baseStyles).toContain("transition-duration: 200ms");
    });

    it("preserves transition-timing-function", () => {
      const css = `.btn { transition-timing-function: ease-in-out; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["btn"];
      expect(entry?.baseStyles).toContain("transition-timing-function: ease-in-out");
    });

    it("preserves transition-delay", () => {
      const css = `.btn { transition-delay: 50ms; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["btn"];
      expect(entry?.baseStyles).toContain("transition-delay: 50ms");
    });
  });

  describe("parseCSS expands transition shorthand", () => {
    it("expands simple transition shorthand", () => {
      const css = `.btn { transition: all 200ms ease; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["btn"];

      // "all" should be replaced with "transform, opacity"
      expect(entry?.baseStyles).toContain("transition-property: transform, opacity");
      expect(entry?.baseStyles).toContain("transition-duration: 200ms");
      expect(entry?.baseStyles).toContain("transition-timing-function: ease");
    });

    it("expands transition with specific property", () => {
      const css = `.card { transition: transform 200ms ease; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["card"];

      expect(entry?.baseStyles).toContain("transition-property: transform");
      expect(entry?.baseStyles).toContain("transition-duration: 200ms");
      expect(entry?.baseStyles).toContain("transition-timing-function: ease");
    });

    it("expands transition with all four values", () => {
      const css = `.nav-link { transition: opacity 300ms ease-in-out 50ms; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["nav-link"];

      expect(entry?.baseStyles).toContain("transition-property: opacity");
      expect(entry?.baseStyles).toContain("transition-duration: 300ms");
      expect(entry?.baseStyles).toContain("transition-timing-function: ease-in-out");
      expect(entry?.baseStyles).toContain("transition-delay: 50ms");
    });

    it("expands transition with duration only", () => {
      const css = `.btn { transition: 0.3s; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["btn"];

      // Should default to "transform, opacity" when property not specified
      expect(entry?.baseStyles).toContain("transition-property: transform, opacity");
      expect(entry?.baseStyles).toContain("transition-duration: 0.3s");
    });

    it("handles transition: none", () => {
      const css = `.no-transition { transition: none; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["no-transition"];

      expect(entry?.baseStyles).toContain("transition-property: none");
      expect(entry?.baseStyles).toContain("transition-duration: 0s");
    });
  });

  describe("parseCSS replaces 'all' with Webflow-safe properties", () => {
    it("replaces 'all' in transition shorthand", () => {
      const css = `.btn { transition: all 0.2s; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["btn"];

      // "all" should be replaced with "transform, opacity"
      expect(entry?.baseStyles).toContain("transition-property: transform, opacity");
      expect(entry?.baseStyles).not.toContain("transition-property: all");
    });

    it("preserves specific properties (not 'all')", () => {
      const css = `.btn { transition: opacity 0.2s; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["btn"];

      expect(entry?.baseStyles).toContain("transition-property: opacity");
    });
  });

  describe("parseCSS handles transitions on hover/focus/active states", () => {
    it("applies transition to hover state", () => {
      const css = `.btn:hover { transition: transform 200ms ease; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["btn"];

      expect(entry?.hoverStyles).toContain("transition-property: transform");
      expect(entry?.hoverStyles).toContain("transition-duration: 200ms");
    });

    it("applies transition to base and hover states", () => {
      const css = `
        .btn { transition: all 200ms ease; }
        .btn:hover { transform: translateY(-2px); }
      `;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["btn"];

      // Base state should have transition
      expect(entry?.baseStyles).toContain("transition-property: transform, opacity");
      expect(entry?.baseStyles).toContain("transition-duration: 200ms");

      // Hover state should have transform
      expect(entry?.hoverStyles).toContain("transform: translateY(-2px)");
    });
  });

  describe("Webflow conversion includes transition in payload", () => {
    it("includes transition properties in Webflow payload", () => {
      const html = `<button class="btn">Click me</button>`;
      const css = `.btn { transition: all 200ms ease; transform: scale(1); }`;
      const result = convertHtmlCssToWebflow(html, css);

      const style = result.payload.styles.find((s) => s.name === "btn");
      expect(style?.styleLess).toContain("transition-property: transform, opacity");
      expect(style?.styleLess).toContain("transition-duration: 200ms");
      expect(style?.styleLess).toContain("transition-timing-function: ease");
      expect(style?.styleLess).toContain("transform: scale(1)");
    });

    it("includes transition with hover transform in Webflow payload", () => {
      const html = `<div class="card">Content</div>`;
      const css = `
        .card {
          transition: transform 200ms ease;
          transform: translateY(0);
        }
        .card:hover {
          transform: translateY(-4px);
        }
      `;
      const result = convertHtmlCssToWebflow(html, css);

      const style = result.payload.styles.find((s) => s.name === "card");

      // Base state should have transition and initial transform
      expect(style?.styleLess).toContain("transition-property: transform");
      expect(style?.styleLess).toContain("transition-duration: 200ms");
      expect(style?.styleLess).toContain("transform: translateY(0)");

      // Hover state should have hover transform
      expect(style?.variants?.hover?.styleLess).toContain("transform: translateY(-4px)");
    });
  });
});

describe("Transform-Origin Support", () => {
  describe("parseCSS preserves transform-origin", () => {
    it("preserves transform-origin with percentage values", () => {
      const css = `.logo { transform-origin: 0% 0%; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["logo"];
      expect(entry?.baseStyles).toContain("transform-origin: 0% 0%");
    });

    it("preserves transform-origin with keyword values", () => {
      const css = `.icon { transform-origin: center center; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["icon"];
      expect(entry?.baseStyles).toContain("transform-origin: center center");
    });

    it("preserves transform-origin with pixel values", () => {
      const css = `.box { transform-origin: 10px 20px; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["box"];
      expect(entry?.baseStyles).toContain("transform-origin: 10px 20px");
    });

    it("preserves transform-origin with mixed values", () => {
      const css = `.rotate { transform-origin: left bottom; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["rotate"];
      expect(entry?.baseStyles).toContain("transform-origin: left bottom");
    });
  });

  describe("parseCSS handles transform-origin with transform", () => {
    it("preserves both transform and transform-origin", () => {
      const css = `.logo { transform: rotate(10deg); transform-origin: 0% 0%; }`;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["logo"];

      expect(entry?.baseStyles).toContain("transform: rotate(10deg)");
      expect(entry?.baseStyles).toContain("transform-origin: 0% 0%");
    });

    it("preserves transform-origin on hover state", () => {
      const css = `
        .icon { transform: rotate(0deg); transform-origin: center; }
        .icon:hover { transform: rotate(45deg); }
      `;
      const result = parseCSS(css);
      const entry = result.classIndex.classes["icon"];

      expect(entry?.baseStyles).toContain("transform: rotate(0deg)");
      expect(entry?.baseStyles).toContain("transform-origin: center");
      expect(entry?.hoverStyles).toContain("transform: rotate(45deg)");
    });
  });

  describe("Webflow conversion includes transform-origin in payload", () => {
    it("includes transform-origin in Webflow payload", () => {
      const html = `<div class="logo">Logo</div>`;
      const css = `.logo { transform: rotate(10deg); transform-origin: 0% 0%; }`;
      const result = convertHtmlCssToWebflow(html, css);

      const style = result.payload.styles.find((s) => s.name === "logo");
      expect(style?.styleLess).toContain("transform: rotate(10deg)");
      expect(style?.styleLess).toContain("transform-origin: 0% 0%");
    });
  });
});

describe("Integration: Transition + Transform + Transform-Origin", () => {
  it("handles complete transition setup for interactive element", () => {
    const html = `<button class="btn">Hover me</button>`;
    const css = `
      .btn {
        transform: translateY(0) scale(1);
        transform-origin: center center;
        transition: all 200ms ease-in-out;
      }
      .btn:hover {
        transform: translateY(-4px) scale(1.05);
      }
    `;
    const result = convertHtmlCssToWebflow(html, css);

    const style = result.payload.styles.find((s) => s.name === "btn");

    // Base state
    expect(style?.styleLess).toContain("transform: translateY(0) scale(1)");
    expect(style?.styleLess).toContain("transform-origin: center center");
    expect(style?.styleLess).toContain("transition-property: transform, opacity");
    expect(style?.styleLess).toContain("transition-duration: 200ms");
    expect(style?.styleLess).toContain("transition-timing-function: ease-in-out");

    // Hover state
    expect(style?.variants?.hover?.styleLess).toContain("transform: translateY(-4px) scale(1.05)");
  });

  it("handles rotating element with custom origin", () => {
    const html = `<div class="logo">Logo</div>`;
    const css = `
      .logo {
        transform: rotate(0deg);
        transform-origin: top left;
        transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .logo:hover {
        transform: rotate(360deg);
      }
    `;
    const result = convertHtmlCssToWebflow(html, css);

    const style = result.payload.styles.find((s) => s.name === "logo");

    expect(style?.styleLess).toContain("transform: rotate(0deg)");
    expect(style?.styleLess).toContain("transform-origin: top left");
    expect(style?.styleLess).toContain("transition-property: transform");
    expect(style?.styleLess).toContain("transition-duration: 300ms");
    expect(style?.variants?.hover?.styleLess).toContain("transform: rotate(360deg)");
  });

  it("handles nav link with opacity and transform transition", () => {
    const html = `<a href="#" class="nav-link">Link</a>`;
    const css = `
      .nav-link {
        opacity: 1;
        transform: translateX(0);
        transition: all 150ms ease;
      }
      .nav-link:hover {
        opacity: 0.8;
        transform: translateX(4px);
      }
    `;
    const result = convertHtmlCssToWebflow(html, css);

    const style = result.payload.styles.find((s) => s.name === "nav-link");

    // Base state
    expect(style?.styleLess).toContain("opacity: 1");
    expect(style?.styleLess).toContain("transform: translateX(0)");
    expect(style?.styleLess).toContain("transition-property: transform, opacity");
    expect(style?.styleLess).toContain("transition-duration: 150ms");

    // Hover state
    expect(style?.variants?.hover?.styleLess).toContain("opacity: 0.8");
    expect(style?.variants?.hover?.styleLess).toContain("transform: translateX(4px)");
  });
});

describe("Edge Cases", () => {
  it("handles multiple transition properties in separate declarations", () => {
    const css = `
      .btn {
        transition-property: transform;
        transition-duration: 200ms;
        transition-timing-function: ease;
        transition-delay: 0ms;
      }
    `;
    const result = parseCSS(css);
    const entry = result.classIndex.classes["btn"];

    expect(entry?.baseStyles).toContain("transition-property: transform");
    expect(entry?.baseStyles).toContain("transition-duration: 200ms");
    expect(entry?.baseStyles).toContain("transition-timing-function: ease");
    expect(entry?.baseStyles).toContain("transition-delay: 0ms");
  });

  it("handles seconds instead of milliseconds", () => {
    const css = `.btn { transition: all 0.2s ease; }`;
    const result = parseCSS(css);
    const entry = result.classIndex.classes["btn"];

    expect(entry?.baseStyles).toContain("transition-duration: 0.2s");
  });

  it("handles cubic-bezier timing function", () => {
    const css = `.btn { transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1); }`;
    const result = parseCSS(css);
    const entry = result.classIndex.classes["btn"];

    expect(entry?.baseStyles).toContain("transition-timing-function: cubic-bezier(0.4");
  });

  it("handles steps timing function", () => {
    const css = `.animation { transition: opacity 1s steps(4, end); }`;
    const result = parseCSS(css);
    const entry = result.classIndex.classes["animation"];

    expect(entry?.baseStyles).toContain("transition-timing-function: steps");
  });

  it("preserves transform-origin with 3 values (x, y, z)", () => {
    const css = `.box { transform-origin: 50% 50% 0; }`;
    const result = parseCSS(css);
    const entry = result.classIndex.classes["box"];

    expect(entry?.baseStyles).toContain("transform-origin: 50% 50% 0");
  });
});

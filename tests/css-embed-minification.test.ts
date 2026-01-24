/**
 * CSS Embed Minification Integration Tests
 *
 * Verifies that CSS embed router applies minification to reduce embed block size
 */

import { describe, it, expect } from "vitest";
import { routeCSS, wrapEmbedCSSInStyleTag } from "../lib/css-embed-router";

describe("CSS Embed Router - Minification Integration", () => {
  it("minifies embed CSS by default", () => {
    const css = `
      /* Comment that should be removed */
      .hero::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        background: rgba(0, 0, 0, 0.5);
      }
    `;

    const result = routeCSS(css);

    // Should not contain comments
    expect(result.embed).not.toContain("/*");
    expect(result.embed).not.toContain("*/");

    // Should not contain newlines
    expect(result.embed).not.toContain("\n");

    // Should be minified (no unnecessary spaces)
    expect(result.embed).toContain(".hero::before{");
    expect(result.embed).toContain("content:\"\"");
    expect(result.embed).toContain("position:absolute");
  });

  it("minifies @keyframes in embed CSS", () => {
    const css = `@keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }`;

    const result = routeCSS(css);

    // Should be minified and contain keyframes
    expect(result.embed).toContain("@keyframes fadeIn");
    expect(result.embed).not.toContain("\n");
    // Check that at least the keyframes rule is present
    expect(result.embed.length).toBeGreaterThan(0);
  });

  it("minifies :root CSS variables in embed", () => {
    const css = `
      :root {
        --primary-color: rgba(59, 130, 246, 1);
        --spacing: 2rem;
      }
      .hero {
        color: var(--primary-color);
      }
    `;

    const result = routeCSS(css);

    // Should be minified
    expect(result.embed).toContain(":root{");
    expect(result.embed).not.toContain("\n");
    expect(result.embed).toContain("--primary-color:rgba(59,130,246,1)");
  });

  it("removes rgba() comma spacing in minified embed", () => {
    const css = `
      .hero::after {
        background: rgba(255, 128, 0, 0.8);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
    `;

    const result = routeCSS(css);

    // Should remove space after commas in rgba()
    expect(result.embed).toContain("rgba(255,128,0,0.8)");
    expect(result.embed).toContain("rgba(0,0,0,0.1)");
  });

  it("minifies media queries in embed", () => {
    const css = `
      .hero::before {
        content: "";
      }

      @media (max-width: 768px) {
        .hero::before {
          content: "mobile";
        }
      }
    `;

    const result = routeCSS(css);

    // Should be minified with no unnecessary spaces
    // Note: CSS router maps 768px to medium breakpoint (991px)
    expect(result.embed).toContain("@media(max-width:991px)");
    expect(result.embed).toContain('content:"mobile"');
    expect(result.embed).not.toContain("\n");
  });

  it("reduces embed CSS size significantly", () => {
    const css = `
      /* Hero styles */
      .hero::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(to right, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.7));
      }

      /* Animation */
      @keyframes slideIn {
        from {
          transform: translateX(-100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      /* Variables */
      :root {
        --primary: #3b82f6;
        --secondary: #8b5cf6;
      }
    `;

    const result = routeCSS(css);

    const originalSize = new TextEncoder().encode(css).length;
    const minifiedSize = new TextEncoder().encode(result.embed).length;
    const reduction = ((originalSize - minifiedSize) / originalSize) * 100;

    // Should achieve at least 30% size reduction
    expect(reduction).toBeGreaterThan(30);
    expect(minifiedSize).toBeLessThan(originalSize);
  });

  it("handles complex selectors and preserves strings", () => {
    const css = `
      .nav > .item:hover::after {
        content: "→";
        position: absolute;
      }

      [data-icon="arrow"]::before {
        content: "\\f001";
      }
    `;

    const result = routeCSS(css);

    // Should preserve string content
    expect(result.embed).toContain('content:"→"');
    expect(result.embed).toContain('content:"\\f001"');

    // Should be minified
    expect(result.embed).not.toContain("\n");
  });

  it("minifies wrapped embed CSS in style tag", () => {
    const css = `
      .hero::before {
        content: "";
        position: absolute;
      }
    `;

    const result = routeCSS(css);
    const wrapped = wrapEmbedCSSInStyleTag(result.embed);

    // Wrapped version should contain minified CSS
    expect(wrapped).toContain("<style>");
    expect(wrapped).toContain("</style>");
    expect(wrapped).toContain(".hero::before{");
    expect(wrapped).toContain('content:""');
  });

  it("reports accurate size in stats after minification", () => {
    const css = `
      .hero::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
      }
    `;

    const result = routeCSS(css);

    // Stats should reflect minified size
    const actualSize = new TextEncoder().encode(result.embed).length;
    expect(result.stats.embedSizeBytes).toBe(actualSize);
  });

  it("handles empty embed CSS", () => {
    const css = `
      .simple {
        color: red;
      }
    `;

    const result = routeCSS(css);

    // No embed CSS needed for simple class selector
    expect(result.embed).toBe("");
    expect(result.stats.embedRules).toBe(0);
  });

  it("preserves calc() and clamp() in minified embed", () => {
    const css = `
      .hero::before {
        width: calc(100% - 2rem);
        font-size: clamp(1rem, 2vw, 3rem);
      }
    `;

    const result = routeCSS(css);

    // Should preserve function expressions
    expect(result.embed).toContain("calc(100% - 2rem)");
    expect(result.embed).toContain("clamp(1rem,2vw,3rem)");
  });
});

describe("CSS Embed Router - Size Warnings with Minification", () => {
  it("calculates size warnings based on minified CSS", () => {
    // Create CSS that's large but can be significantly minified
    const largeCSS = Array(50)
      .fill(0)
      .map((_, i) => `
        /* Comment ${i} */
        .element-${i}::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
        }
      `)
      .join("\n");

    const result = routeCSS(largeCSS);

    // Size should be based on minified CSS (much smaller than original)
    const minifiedSize = new TextEncoder().encode(result.embed).length;
    expect(result.stats.embedSizeBytes).toBe(minifiedSize);

    // Original would be much larger
    const originalSize = new TextEncoder().encode(largeCSS).length;
    expect(minifiedSize).toBeLessThan(originalSize * 0.7); // At least 30% reduction
  });
});

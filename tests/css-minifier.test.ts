/**
 * CSS Minifier Tests
 *
 * Verifies that the CSS minifier correctly reduces CSS size while preserving functionality
 */

import { describe, it, expect } from "vitest";
import { minifyCSS, minifyCSSWithStats, getMinificationStats, checkSizeLimit, MinificationStats } from "../lib/css-minifier";

describe("CSS Minifier", () => {
  describe("Basic minification", () => {
    it("removes comments", () => {
      const css = `
        /* This is a comment */
        .hero {
          color: red; /* inline comment */
        }
        /* Multi-line
           comment */
      `;
      const result = minifyCSS(css);
      expect(result).not.toContain("/*");
      expect(result).not.toContain("*/");
      expect(result).toContain(".hero");
      expect(result).toContain("color:red");
    });

    it("removes newlines", () => {
      const css = `
        .hero {
          color: red;
          background: blue;
        }
      `;
      const result = minifyCSS(css);
      expect(result).not.toContain("\n");
    });

    it("removes unnecessary whitespace", () => {
      const css = `.hero   {   color  :  red  ;   }`;
      const result = minifyCSS(css);
      expect(result).toBe(".hero{color:red}");
    });

    it("removes space around colons", () => {
      const css = `.hero { color : red ; }`;
      const result = minifyCSS(css);
      expect(result).toBe(".hero{color:red}");
    });

    it("removes space around semicolons", () => {
      const css = `.hero { color: red ; background: blue ; }`;
      const result = minifyCSS(css);
      expect(result).toBe(".hero{color:red;background:blue}");
    });

    it("removes space around braces", () => {
      const css = `.hero { color: red; }`;
      const result = minifyCSS(css);
      expect(result).toBe(".hero{color:red}");
    });

    it("removes trailing semicolons before closing braces", () => {
      const css = `.btn{color:red;}`;
      const result = minifyCSS(css);
      expect(result).toBe(".btn{color:red}");
    });

    it("collapses multiple spaces to single space", () => {
      const css = `.hero    .child     .grandchild { color: red; }`;
      const result = minifyCSS(css);
      expect(result).toBe(".hero .child .grandchild{color:red}");
    });
  });

  describe("Edge cases - preserving strings", () => {
    it("preserves content in double quotes", () => {
      const css = `.hero::before { content: "Hello World"; }`;
      const result = minifyCSS(css);
      expect(result).toContain('content:"Hello World"');
    });

    it("preserves content in single quotes", () => {
      const css = `.hero::before { content: 'Hello World'; }`;
      const result = minifyCSS(css);
      expect(result).toContain("content:'Hello World'");
    });

    it("preserves empty content strings", () => {
      const css = `.hero::before { content: ""; }`;
      const result = minifyCSS(css);
      expect(result).toContain('content:""');
    });

    it("preserves URLs in double quotes", () => {
      const css = `.hero { background-image: url("image.jpg"); }`;
      const result = minifyCSS(css);
      expect(result).toContain('url("image.jpg")');
    });

    it("preserves URLs in single quotes", () => {
      const css = `.hero { background-image: url('image.jpg'); }`;
      const result = minifyCSS(css);
      expect(result).toContain("url('image.jpg')");
    });

    it("preserves escaped quotes in strings", () => {
      const css = `.hero::before { content: "He said \\"Hello\\""; }`;
      const result = minifyCSS(css);
      expect(result).toContain('content:"He said \\"Hello\\""');
    });

    it("preserves Unicode characters in strings", () => {
      const css = `.hero::before { content: "→ • ©"; }`;
      const result = minifyCSS(css);
      expect(result).toContain('content:"→ • ©"');
    });
  });

  describe("Edge cases - function values", () => {
    it("removes space after commas in rgba()", () => {
      const css = `.hero { background: rgba(0, 0, 0, 0.5); }`;
      const result = minifyCSS(css);
      expect(result).toContain("rgba(0,0,0,0.5)");
    });

    it("removes space after commas in rgb()", () => {
      const css = `.hero { color: rgb(255, 128, 0); }`;
      const result = minifyCSS(css);
      expect(result).toContain("rgb(255,128,0)");
    });

    it("removes space after commas in hsl()", () => {
      const css = `.hero { color: hsl(120, 100%, 50%); }`;
      const result = minifyCSS(css);
      expect(result).toContain("hsl(120,100%,50%)");
    });

    it("removes space after commas in transform functions", () => {
      const css = `.hero { transform: translate(10px, 20px); }`;
      const result = minifyCSS(css);
      expect(result).toContain("translate(10px,20px)");
    });

    it("preserves space in calc() expressions", () => {
      const css = `.hero { width: calc(100% - 2rem); }`;
      const result = minifyCSS(css);
      expect(result).toContain("calc(100% - 2rem)");
    });

    it("removes space after commas in linear-gradient()", () => {
      const css = `.hero { background: linear-gradient(to right, red, blue); }`;
      const result = minifyCSS(css);
      expect(result).toContain("linear-gradient(to right,red,blue)");
    });

    it("removes space after commas in box-shadow", () => {
      const css = `.hero { box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }`;
      const result = minifyCSS(css);
      expect(result).toContain("box-shadow:0 4px 6px rgba(0,0,0,0.1)");
    });
  });

  describe("Real-world examples", () => {
    it("minifies ::before pseudo-element with content", () => {
      const css = `
        .hero::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          /* Background overlay */
          background: rgba(0, 0, 0, 0.5);
        }
      `;
      const result = minifyCSS(css);
      expect(result).toBe('.hero::before{content:"";position:absolute;top:0;left:0;background:rgba(0,0,0,0.5)}');
    });

    it("minifies keyframe animation", () => {
      const css = `
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      const result = minifyCSS(css);
      expect(result).toContain("@keyframes fadeIn");
      expect(result).toContain("opacity:0");
      expect(result).toContain("opacity:1");
      expect(result).not.toContain("\n");
    });

    it("minifies media query", () => {
      const css = `
        @media (max-width: 768px) {
          .hero {
            font-size: 14px;
            padding: 1rem;
          }
        }
      `;
      const result = minifyCSS(css);
      expect(result).toContain("@media(max-width:768px)");
      expect(result).toContain(".hero{font-size:14px;padding:1rem}");
    });

    it("minifies complex selector with pseudo-elements", () => {
      const css = `
        .nav > .item:hover::after {
          content: "→";
          position: absolute;
          color: rgba(255, 0, 0, 0.8);
        }
      `;
      const result = minifyCSS(css);
      expect(result).toContain(".nav>.item:hover::after");
      expect(result).toContain('content:"→"');
      expect(result).toContain("rgba(255,0,0,0.8)");
    });

    it("minifies CSS with CSS variables", () => {
      const css = `
        :root {
          --primary-color: rgba(59, 130, 246, 1);
          --spacing: 2rem;
        }
        .hero {
          color: var(--primary-color);
          padding: var(--spacing);
        }
      `;
      const result = minifyCSS(css);
      expect(result).toContain(":root{--primary-color:rgba(59,130,246,1)");
      expect(result).toContain("color:var(--primary-color)");
    });

    it("minifies grid template with complex values", () => {
      const css = `
        .grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
        }
      `;
      const result = minifyCSS(css);
      expect(result).toContain("grid-template-columns:repeat(3,1fr)");
    });
  });

  describe("Options", () => {
    it("respects removeComments option", () => {
      const css = `/* comment */ .hero { color: red; }`;
      const result = minifyCSS(css, { removeComments: false });
      expect(result).toContain("/* comment */");
    });

    it("respects removeWhitespace option", () => {
      const css = `.hero { color: red; }`;
      const result = minifyCSS(css, { removeWhitespace: false });
      expect(result).toContain(" ");
    });
  });

  describe("getMinificationStats", () => {
    it("calculates size reduction correctly", () => {
      const original = `
        .hero {
          color: red;
        }
      `;
      const minified = ".hero{color:red;}";
      const stats = getMinificationStats(original, minified);

      expect(stats.originalSize).toBeGreaterThan(stats.minifiedSize);
      expect(stats.savedBytes).toBeGreaterThan(0);
      expect(stats.savedPercent).toBeGreaterThan(0);
      expect(stats.savedPercent).toBeLessThanOrEqual(100);
    });

    it("handles empty strings", () => {
      const stats = getMinificationStats("", "");
      expect(stats.originalSize).toBe(0);
      expect(stats.minifiedSize).toBe(0);
      expect(stats.savedBytes).toBe(0);
      expect(stats.savedPercent).toBe(0);
    });

    it("rounds percentage to 2 decimals", () => {
      const original = "a".repeat(1000);
      const minified = "a".repeat(333);
      const stats = getMinificationStats(original, minified);

      // Should be rounded to 2 decimals
      expect(stats.savedPercent.toString().split(".")[1]?.length || 0).toBeLessThanOrEqual(2);
    });
  });

  describe("checkSizeLimit", () => {
    it("detects CSS under soft limit", () => {
      const smallCSS = ".hero{color:red;}";
      const result = checkSizeLimit(smallCSS);

      expect(result.exceedsSoftLimit).toBe(false);
      expect(result.exceedsHardLimit).toBe(false);
      expect(result.warning).toBeUndefined();
    });

    it("detects CSS exceeding soft limit (10KB)", () => {
      const largishCSS = "a".repeat(11 * 1024); // 11KB
      const result = checkSizeLimit(largishCSS);

      expect(result.exceedsSoftLimit).toBe(true);
      expect(result.exceedsHardLimit).toBe(false);
      expect(result.warning).toContain("10KB");
    });

    it("detects CSS exceeding hard limit (100KB)", () => {
      const hugeCSS = "a".repeat(101 * 1024); // 101KB
      const result = checkSizeLimit(hugeCSS);

      expect(result.exceedsSoftLimit).toBe(true);
      expect(result.exceedsHardLimit).toBe(true);
      expect(result.warning).toContain("100KB");
    });
  });

  describe("Integration - size reduction on real CSS", () => {
    it("achieves significant size reduction on formatted CSS", () => {
      const css = `
        /* Hero Section */
        .hero {
          position: relative;
          height: 100vh;
          background: linear-gradient(to right, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.7));
        }

        .hero::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: url("hero-bg.jpg");
        }

        /* Typography */
        .hero h1 {
          font-size: clamp(2rem, 5vw, 4rem);
          color: rgba(255, 255, 255, 0.95);
        }

        @media (max-width: 768px) {
          .hero {
            height: 80vh;
          }
          .hero h1 {
            font-size: clamp(1.5rem, 4vw, 2.5rem);
          }
        }
      `;

      const minified = minifyCSS(css);
      const stats = getMinificationStats(css, minified);

      // Should achieve at least 30% size reduction
      expect(stats.savedPercent).toBeGreaterThan(30);

      // Should still be valid CSS (basic check)
      expect(minified).toContain(".hero{");
      expect(minified).toContain("rgba(0,0,0,0.5)");
      expect(minified).toContain('content:""');
    });
  });

  describe("minifyCSSWithStats", () => {
    it("returns both minified CSS and statistics", () => {
      const css = `.btn { color: red; margin: 10px; }`;
      const result = minifyCSSWithStats(css);

      expect(result.css).toBe(".btn{color:red;margin:10px}");
      expect(result.stats).toBeDefined();
      expect(result.stats.originalSize).toBeGreaterThan(result.stats.minifiedSize);
      expect(result.stats.reduction).toBeGreaterThan(0);
      expect(result.stats.reductionPercent).toBeGreaterThan(0);
    });

    it("calculates accurate reduction percentages", () => {
      const css = `
        .btn {
          color:     red;
          margin:    10px;
          padding:   20px;
        }
      `;
      const result = minifyCSSWithStats(css);

      // Should have high reduction due to whitespace
      expect(result.stats.reductionPercent).toBeGreaterThan(30);
      expect(result.stats.reduction).toBe(result.stats.originalSize - result.stats.minifiedSize);
    });

    it("handles empty input", () => {
      const result = minifyCSSWithStats('');

      expect(result.css).toBe('');
      expect(result.stats.originalSize).toBe(0);
      expect(result.stats.minifiedSize).toBe(0);
      expect(result.stats.reduction).toBe(0);
    });

    it("achieves 40-60% reduction on real-world CSS", () => {
      const css = `
        /* Hero section overlay */
        .hero::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0.3),
            rgba(0, 0, 0, 0.7)
          );
          z-index: 1;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      const result = minifyCSSWithStats(css);

      // Should achieve significant reduction
      expect(result.stats.reductionPercent).toBeGreaterThan(40);

      // Verify minified CSS is valid
      expect(result.css).toContain('.hero::before');
      expect(result.css).toContain('@keyframes fadeIn');
      expect(result.css).not.toContain('/*');
      expect(result.css).not.toContain('\n');
    });

    it("respects minification options", () => {
      const css = `/* comment */ .btn { color: red; }`;
      const result = minifyCSSWithStats(css, { removeComments: false });

      expect(result.css).toContain('/* comment */');
    });
  });

  describe("Edge cases - complex strings", () => {
    it("handles strings with special characters", () => {
      const css = `.icon::before { content: "\\f001"; }`;
      const result = minifyCSS(css);
      expect(result).toContain('content:"\\f001"');
    });

    it("handles attribute selectors with strings", () => {
      const css = `[data-icon="arrow"] { color: red; }`;
      const result = minifyCSS(css);
      expect(result).toContain('[data-icon="arrow"]');
    });

    it("handles multiple strings in same rule", () => {
      const css = `.hero { background-image: url("bg.jpg"); content: "test"; }`;
      const result = minifyCSS(css);
      expect(result).toContain('url("bg.jpg")');
      expect(result).toContain('content:"test"');
    });
  });
});

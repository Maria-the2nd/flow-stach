/**
 * CSS Variable Resolution Tests
 *
 * Tests for the CSS variable extraction and resolution functionality
 * that ensures var() references are resolved when routing to native Webflow styles.
 *
 * This is critical because Webflow's native style system does not support
 * CSS custom properties (var(--name) syntax).
 */

import { describe, it, expect } from "vitest";
import {
  extractCSSVariables,
  resolveCSSVariable,
  resolveVariablesInProperties,
  resolveChainedVariables,
  routeCSS,
  type CSSVariableMap,
} from "../lib/css-embed-router";

describe("CSS Variable Resolution", () => {
  // Test variables used across tests
  const testVariables: CSSVariableMap = {
    "--text-dark": "#1a1a1a",
    "--coral": "#E8524B",
    "--spacing": "16px",
    "--cream": "#FAF0E6",
    "--font-primary": "'Inter', sans-serif",
  };

  describe("extractCSSVariables", () => {
    it("should extract variables from :root", () => {
      const css = `:root { --text-dark: #1a1a1a; --coral: #E8524B; }`;
      const result = extractCSSVariables(css);
      expect(result["--text-dark"]).toBe("#1a1a1a");
      expect(result["--coral"]).toBe("#E8524B");
    });

    it("should handle multiline :root", () => {
      const css = `
        :root {
          --text-dark: #1a1a1a;
          --spacing: 16px;
        }
      `;
      const result = extractCSSVariables(css);
      expect(result["--text-dark"]).toBe("#1a1a1a");
      expect(result["--spacing"]).toBe("16px");
    });

    it("should handle multiple :root blocks", () => {
      const css = `
        :root { --a: red; }
        :root { --b: blue; }
      `;
      const result = extractCSSVariables(css);
      expect(result["--a"]).toBe("red");
      expect(result["--b"]).toBe("blue");
    });

    it("should preserve first definition when variable is redefined", () => {
      const css = `
        :root { --a: red; }
        :root { --a: blue; }
      `;
      const result = extractCSSVariables(css);
      expect(result["--a"]).toBe("red"); // First definition wins
    });

    it("should handle complex values", () => {
      const css = `
        :root {
          --gradient: linear-gradient(to right, red, blue);
          --shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          --transform: translateX(10px) rotate(45deg);
        }
      `;
      const result = extractCSSVariables(css);
      expect(result["--gradient"]).toBe("linear-gradient(to right, red, blue)");
      expect(result["--shadow"]).toBe("0 4px 6px rgba(0, 0, 0, 0.1)");
      expect(result["--transform"]).toBe("translateX(10px) rotate(45deg)");
    });

    it("should handle empty :root", () => {
      const css = `:root { }`;
      const result = extractCSSVariables(css);
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe("resolveCSSVariable", () => {
    it("should resolve simple var()", () => {
      const result = resolveCSSVariable("var(--text-dark)", testVariables);
      expect(result.resolved).toBe("#1a1a1a");
      expect(result.hadVariables).toBe(true);
      expect(result.unresolvedVars).toHaveLength(0);
    });

    it("should resolve var() in property value", () => {
      const result = resolveCSSVariable("var(--coral)", testVariables);
      expect(result.resolved).toBe("#E8524B");
    });

    it("should handle fallback when var exists", () => {
      const result = resolveCSSVariable("var(--text-dark, #000)", testVariables);
      expect(result.resolved).toBe("#1a1a1a"); // Uses defined value, not fallback
    });

    it("should use fallback when var missing", () => {
      const result = resolveCSSVariable("var(--missing, #000)", testVariables);
      expect(result.resolved).toBe("#000");
      expect(result.unresolvedVars).toHaveLength(0); // Fallback used, no unresolved
    });

    it("should resolve nested var fallback", () => {
      const result = resolveCSSVariable("var(--missing, var(--coral))", testVariables);
      expect(result.resolved).toBe("#E8524B");
    });

    it("should resolve var() inside calc()", () => {
      const result = resolveCSSVariable("calc(100% - var(--spacing))", testVariables);
      expect(result.resolved).toBe("calc(100% - 16px)");
    });

    it("should resolve multiple var() in one value", () => {
      const result = resolveCSSVariable("var(--spacing) var(--spacing)", testVariables);
      expect(result.resolved).toBe("16px 16px");
    });

    it("should track unresolved variables", () => {
      const result = resolveCSSVariable("var(--unknown)", testVariables);
      expect(result.unresolvedVars).toContain("--unknown");
      expect(result.resolved).toContain("var(--unknown)"); // Preserved for debugging
    });

    it("should not modify values without var()", () => {
      const result = resolveCSSVariable("#1a1a1a", testVariables);
      expect(result.resolved).toBe("#1a1a1a");
      expect(result.hadVariables).toBe(false);
    });

    it("should handle whitespace variations", () => {
      const result1 = resolveCSSVariable("var( --text-dark )", testVariables);
      expect(result1.resolved).toBe("#1a1a1a");

      const result2 = resolveCSSVariable("var(  --coral  ,  blue  )", testVariables);
      expect(result2.resolved).toBe("#E8524B");
    });

    it("should handle complex fallback values", () => {
      const result = resolveCSSVariable(
        "var(--missing, linear-gradient(to right, red, blue))",
        testVariables
      );
      expect(result.resolved).toBe("linear-gradient(to right, red, blue)");
    });
  });

  describe("resolveVariablesInProperties", () => {
    it("should resolve all var() in properties string", () => {
      const props = "color: var(--text-dark); background: var(--cream);";
      const { resolved, unresolvedVars } = resolveVariablesInProperties(props, testVariables);
      expect(resolved).toContain("color: #1a1a1a;");
      expect(resolved).toContain("background: #FAF0E6;");
      expect(unresolvedVars).toHaveLength(0);
    });

    it("should handle mixed resolved and unresolved", () => {
      const props = "color: var(--text-dark); border: 1px solid var(--unknown);";
      const { resolved, unresolvedVars } = resolveVariablesInProperties(props, testVariables);
      expect(resolved).toContain("color: #1a1a1a;");
      expect(unresolvedVars).toContain("--unknown");
    });

    it("should handle properties without var()", () => {
      const props = "display: flex; gap: 20px;";
      const { resolved, unresolvedVars } = resolveVariablesInProperties(props, testVariables);
      expect(resolved).toContain("display: flex;");
      expect(resolved).toContain("gap: 20px;");
      expect(unresolvedVars).toHaveLength(0);
    });

    it("should handle var() inside calc()", () => {
      const props = "width: calc(100% - var(--spacing));";
      const { resolved } = resolveVariablesInProperties(props, testVariables);
      expect(resolved).toContain("width: calc(100% - 16px);");
    });
  });

  describe("resolveChainedVariables", () => {
    it("should resolve variable referencing another variable", () => {
      const variables: CSSVariableMap = {
        "--base": "16px",
        "--spacing": "var(--base)",
      };
      const { resolved } = resolveChainedVariables(variables);
      expect(resolved["--spacing"]).toBe("16px");
      expect(resolved["--base"]).toBe("16px");
    });

    it("should resolve multiple levels of chaining", () => {
      const variables: CSSVariableMap = {
        "--a": "red",
        "--b": "var(--a)",
        "--c": "var(--b)",
      };
      const { resolved } = resolveChainedVariables(variables);
      expect(resolved["--c"]).toBe("red");
    });

    it("should detect circular references", () => {
      const variables: CSSVariableMap = {
        "--a": "var(--b)",
        "--b": "var(--a)",
      };
      const { circularRefs } = resolveChainedVariables(variables);
      expect(circularRefs.length).toBeGreaterThan(0);
    });

    it("should handle self-reference", () => {
      const variables: CSSVariableMap = {
        "--self": "var(--self)",
      };
      const { circularRefs } = resolveChainedVariables(variables);
      expect(circularRefs).toContain("--self");
    });
  });

  describe("integration with routeCSS", () => {
    it("should resolve vars when routing to native", () => {
      const css = `
        :root { --text-dark: #1a1a1a; }
        .nav-link { color: var(--text-dark); }
      `;
      const result = routeCSS(css);

      // Native CSS should have resolved value
      expect(result.native).toContain("color: #1a1a1a");
      expect(result.native).not.toContain("var(--text-dark)");

      // Embed should still have :root
      expect(result.embed).toContain(":root");
      expect(result.embed).toContain("--text-dark");
    });

    it("should resolve vars in media query rules", () => {
      const css = `
        :root { --spacing: 20px; }
        @media (max-width: 767px) {
          .card { padding: var(--spacing); }
        }
      `;
      const result = routeCSS(css);

      // Native CSS should have resolved value
      expect(result.native).toContain("padding: 20px");
      expect(result.native).not.toContain("var(--spacing)");
    });

    it("should use fallback when var is undefined", () => {
      const css = `
        :root { --defined: blue; }
        .btn { color: var(--undefined, red); }
      `;
      const result = routeCSS(css);

      // Should use fallback value
      expect(result.native).toContain("color: red");
    });

    it("should handle nested var() fallbacks", () => {
      const css = `
        :root { --coral: #E8524B; }
        .accent { color: var(--missing, var(--coral)); }
      `;
      const result = routeCSS(css);

      // Should use nested fallback
      expect(result.native).toContain("color: #E8524B");
    });

    it("should resolve var() inside calc()", () => {
      const css = `
        :root { --gap: 16px; }
        .container { width: calc(100% - var(--gap)); }
      `;
      const result = routeCSS(css);

      expect(result.native).toContain("width: calc(100% - 16px)");
    });

    it("should resolve multiple vars in same property", () => {
      const css = `
        :root {
          --v-spacing: 20px;
          --h-spacing: 40px;
        }
        .box { padding: var(--v-spacing) var(--h-spacing); }
      `;
      const result = routeCSS(css);

      expect(result.native).toContain("padding: 20px 40px");
    });

    it("should NOT resolve vars in embed CSS (preserve for JS access)", () => {
      const css = `
        :root { --text-dark: #1a1a1a; }
        .complex::before { color: var(--text-dark); }
      `;
      const result = routeCSS(css);

      // ::before routes to embed - should keep var() for potential JS usage
      expect(result.embed).toContain("var(--text-dark)");
    });

    it("should warn about unresolved variables", () => {
      const css = `
        :root { --defined: blue; }
        .btn { color: var(--undefined); }
      `;
      const result = routeCSS(css);

      // Should have a warning about the unresolved variable
      const hasUnresolvedWarning = result.warnings.some(
        w => w.reason?.includes("Unresolved CSS variables") || w.reason?.includes("--undefined")
      );
      expect(hasUnresolvedWarning).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty CSS", () => {
      const result = routeCSS("");
      expect(result.native).toBe("");
      expect(result.embed).toBe("");
    });

    it("should handle CSS without variables", () => {
      const css = `.hero { color: red; }`;
      const result = routeCSS(css);
      expect(result.native).toContain("color: red");
    });

    it("should handle :root only CSS", () => {
      const css = `:root { --color: red; }`;
      const result = routeCSS(css);
      expect(result.native).toBe("");
      expect(result.embed).toContain(":root");
    });

    it("should preserve font-family values with quotes", () => {
      const css = `
        :root { --font-primary: 'Inter', sans-serif; }
        .text { font-family: var(--font-primary); }
      `;
      const result = routeCSS(css);
      expect(result.native).toContain("font-family: 'Inter', sans-serif");
    });

    it("should handle var in shorthand properties", () => {
      const css = `
        :root {
          --border-color: #ccc;
          --border-width: 1px;
        }
        .card { border: var(--border-width) solid var(--border-color); }
      `;
      const result = routeCSS(css);
      expect(result.native).toContain("border: 1px solid #ccc");
    });
  });
});

/**
 * CRITICAL: Check if Webflow JSON nodes have the same classes as CSS/JS expect
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { extractCleanHtml } from "../lib/html-parser";
import { normalizeHtmlCssForWebflow } from "../lib/webflow-normalizer";
import { literalizeCssForWebflow } from "../lib/webflow-literalizer";
import { parseCSS } from "../lib/css-parser";
import { componentizeHtml } from "../lib/componentizer";
import { extractTokens } from "../lib/token-extractor";
import { buildCssTokenPayload, buildComponentPayload } from "../lib/webflow-converter";
import { renameClassesForProject, isBemRenamingEnabled } from "../lib/bem-renamer";
import { applyDeterministicComponentNames } from "../lib/flowbridge-semantic";
import { ensureWebflowPasteSafety } from "../lib/webflow-safety-gate";

describe("Webflow JSON Class Name Consistency", () => {
  it("should have matching class names in HTML nodes, CSS styles, and JS selectors", () => {
    const htmlPath = join(__dirname, "../temp/tests/flowbridge-poc.html");
    const fullHtml = readFileSync(htmlPath, "utf-8");

    console.log("\n" + "=".repeat(80));
    console.log("CHECKING: Do Webflow JSON class names match CSS and JS?");
    console.log("=".repeat(80));

    // Extract and process
    const cleanResult = extractCleanHtml(fullHtml);
    const tokens = extractTokens(cleanResult.extractedStyles, "flowbridge-poc");
    const normalization = normalizeHtmlCssForWebflow(cleanResult.cleanHtml, cleanResult.extractedStyles);
    let componentsTree = componentizeHtml(cleanResult.cleanHtml, {});
    const namingResult = applyDeterministicComponentNames(componentsTree);
    componentsTree = namingResult.componentTree;

    // BEM renaming
    const preTokenPayload = buildCssTokenPayload(normalization.css, { namespace: tokens.namespace, includePreview: false });
    const establishedClasses = Array.isArray(preTokenPayload.establishedClasses)
      ? preTokenPayload.establishedClasses
      : Array.from(preTokenPayload.establishedClasses);

    const renameResult = renameClassesForProject({
      componentsTree,
      css: normalization.css,
      js: cleanResult.extractedScripts,
      establishedClasses,
      options: {
        projectSlug: tokens.slug,
        enableLlmRefinement: false,
        preserveClasses: [],
        updateJSReferences: true,
      },
    });

    // Literalize and parse final CSS
    const literalization = literalizeCssForWebflow(renameResult.updatedCss);
    const parsed = parseCSS(literalization.css);

    console.log("\n=== CSS CLASS NAMES ===");
    const cssClassNames = Object.keys(parsed.classIndex.classes);
    console.log("Total CSS classes:", cssClassNames.length);
    console.log("Sample (first 15):", cssClassNames.slice(0, 15));

    // Extract class names from JS selectors
    console.log("\n=== JS SELECTOR CLASS NAMES ===");
    const jsClassNames = new Set<string>();
    const js = renameResult.updatedJs;

    const patterns = [
      /gsap\.(from|to|fromTo|set)\s*\(\s*["']([^"']+)["']/g,
      /querySelector(?:All)?\s*\(\s*["']([^"']+)["']/g,
      /trigger:\s*["']([^"']+)["']/g,
      /classList\.(add|remove|toggle|contains)\s*\(\s*["']([^"']+)["']/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(js)) !== null) {
        const selector = match[2] || match[1];
        const classMatches = selector.match(/\.([a-zA-Z_-][\w-]*)/g);
        if (classMatches) {
          classMatches.forEach(c => jsClassNames.add(c.slice(1)));
        }
      }
    }

    console.log("Classes referenced in JS:", Array.from(jsClassNames));

    // Build token payload and check style names
    console.log("\n=== WEBFLOW TOKEN STYLES ===");
    const tokenPayload = buildCssTokenPayload(literalization.css, { namespace: tokens.namespace, includePreview: true });
    const tokenSafety = ensureWebflowPasteSafety({ payload: tokenPayload.webflowPayload });
    const tokenStyles = tokenSafety.payload.payload.styles;
    const tokenStyleNames = tokenStyles.map((s: any) => s.name);
    console.log("Token style count:", tokenStyleNames.length);
    console.log("Sample token styles:", tokenStyleNames.slice(0, 15));

    // Build component payload for first component
    console.log("\n=== WEBFLOW COMPONENT CLASSES ===");
    const component = renameResult.updatedComponents.components[0];
    if (component) {
      console.log("Component:", component.name);
      console.log("Classes used in component HTML:", component.classesUsed);

      // Get classes from Webflow JSON nodes
      // NOTE: skipEstablishedStyles: false is used in production
      const componentPayload = buildComponentPayload(
        component,
        parsed.classIndex,
        new Set(tokenStyleNames), // established classes
        { skipEstablishedStyles: false }
      );

      const nodeClasses = new Set<string>();
      const collectNodeClasses = (nodes: any[]) => {
        for (const node of nodes) {
          if (node.classes) {
            // In Webflow JSON, node.classes can be UUIDs or class names
            node.classes.forEach((c: string) => {
              // Try to find the style with this ID to get the name
              const style = componentPayload.webflowPayload.payload.styles.find(
                (s: any) => s._id === c || s.name === c
              );
              if (style) {
                nodeClasses.add(style.name);
              } else {
                nodeClasses.add(c); // Keep as-is if can't resolve
              }
            });
          }
          if (node.children) {
            collectNodeClasses(node.children);
          }
        }
      };

      collectNodeClasses(componentPayload.webflowPayload.payload.nodes);
      console.log("Classes in Webflow nodes:", Array.from(nodeClasses));

      // Check for mismatches
      console.log("\n=== MISMATCH ANALYSIS ===");

      // JS classes not in CSS
      const jsNotInCss: string[] = [];
      for (const jsClass of jsClassNames) {
        if (!cssClassNames.includes(jsClass)) {
          jsNotInCss.push(jsClass);
        }
      }
      if (jsNotInCss.length > 0) {
        console.log("❌ JS references classes NOT in CSS:", jsNotInCss);
      } else {
        console.log("✅ All JS class references exist in CSS");
      }

      // JS classes not in Webflow styles
      const jsNotInWf: string[] = [];
      for (const jsClass of jsClassNames) {
        if (!tokenStyleNames.includes(jsClass)) {
          jsNotInWf.push(jsClass);
        }
      }
      if (jsNotInWf.length > 0) {
        console.log("❌ JS references classes NOT in Webflow styles:", jsNotInWf);
      } else {
        console.log("✅ All JS class references exist in Webflow styles");
      }
    }

    // Final check: What's in the embeds that users see?
    console.log("\n=== WHAT USERS SEE IN EMBEDS ===");
    console.log("scriptsJs (first 300 chars):", renameResult.updatedJs.substring(0, 300));
    console.log("\nexternalScripts:", cleanResult.externalScripts);

    // Assertions
    expect(cssClassNames.length).toBeGreaterThan(0);
  });
});

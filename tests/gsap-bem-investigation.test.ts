/**
 * CRITICAL INVESTIGATION: GSAP/JS Class References After BEM Renaming
 *
 * Hypothesis: BEM renaming changes CSS class names, but JavaScript (GSAP)
 * still targets the OLD class names, so animations don't work.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { extractCleanHtml } from "../lib/html-parser";
import { normalizeHtmlCssForWebflow } from "../lib/webflow-normalizer";
import { componentizeHtml } from "../lib/componentizer";
import { extractTokens } from "../lib/token-extractor";
import { buildCssTokenPayload } from "../lib/webflow-converter";
import { renameClassesForProject, isBemRenamingEnabled } from "../lib/bem-renamer";
import { applyDeterministicComponentNames } from "../lib/flowbridge-semantic";

describe("GSAP/JS Class References After BEM Renaming", () => {
  it("CRITICAL: Verify JS class selectors are updated to match renamed CSS classes", () => {
    const htmlPath = join(__dirname, "../temp/tests/flowbridge-poc.html");
    const fullHtml = readFileSync(htmlPath, "utf-8");

    console.log("\n" + "=".repeat(80));
    console.log("INVESTIGATION: Are GSAP selectors updated after BEM renaming?");
    console.log("=".repeat(80));

    // Step 1: Extract
    const cleanResult = extractCleanHtml(fullHtml);
    const tokens = extractTokens(cleanResult.extractedStyles, "flowbridge-poc");

    console.log("\n=== STEP 1: Original JavaScript (GSAP selectors) ===");
    const originalJs = cleanResult.extractedScripts;

    // Find all GSAP selectors in original JS
    const gsapSelectorPattern = /gsap\.(from|to|fromTo|set)\s*\(\s*["']([^"']+)["']/g;
    const querySelectorPattern = /querySelector(?:All)?\s*\(\s*["']([^"']+)["']/g;
    const scrollTriggerPattern = /trigger:\s*["']([^"']+)["']/g;

    const originalGsapSelectors: string[] = [];
    const originalQuerySelectors: string[] = [];
    const originalTriggers: string[] = [];

    let match;
    while ((match = gsapSelectorPattern.exec(originalJs)) !== null) {
      originalGsapSelectors.push(match[2]);
    }
    while ((match = querySelectorPattern.exec(originalJs)) !== null) {
      originalQuerySelectors.push(match[1]);
    }
    while ((match = scrollTriggerPattern.exec(originalJs)) !== null) {
      originalTriggers.push(match[1]);
    }

    console.log("Original GSAP selectors:", originalGsapSelectors);
    console.log("Original querySelector selectors:", originalQuerySelectors);
    console.log("Original ScrollTrigger triggers:", originalTriggers);

    // Step 2: Normalize and Componentize
    const normalization = normalizeHtmlCssForWebflow(cleanResult.cleanHtml, cleanResult.extractedStyles);
    let componentsTree = componentizeHtml(cleanResult.cleanHtml, {});
    const namingResult = applyDeterministicComponentNames(componentsTree);
    componentsTree = namingResult.componentTree;

    // Step 3: Get established classes (preserved)
    const preTokenPayload = buildCssTokenPayload(normalization.css, { namespace: tokens.namespace, includePreview: false });
    const establishedClasses = Array.isArray(preTokenPayload.establishedClasses)
      ? preTokenPayload.establishedClasses
      : Array.from(preTokenPayload.establishedClasses);

    console.log("\n=== STEP 2: BEM Renaming ===");
    console.log("BEM Renaming Enabled:", isBemRenamingEnabled());
    console.log("Established classes (will be PRESERVED):", establishedClasses.length);
    console.log("First 10 established:", establishedClasses.slice(0, 10));

    if (!isBemRenamingEnabled()) {
      console.log("❌ BEM RENAMING IS DISABLED - Skipping test");
      return;
    }

    // Step 4: Run BEM Renaming
    const renameResult = renameClassesForProject({
      componentsTree,
      css: normalization.css,
      js: originalJs,  // <-- Pass the original JS here
      establishedClasses,
      options: {
        projectSlug: tokens.slug,
        enableLlmRefinement: false,
        preserveClasses: [],
        updateJSReferences: true,  // <-- This should update JS!
      },
    });

    console.log("\n=== STEP 3: BEM Renaming Results ===");
    console.log("Total classes:", renameResult.report.summary.totalClasses);
    console.log("Renamed:", renameResult.report.summary.renamed);
    console.log("Preserved:", renameResult.report.summary.preserved);
    console.log("JS References Updated:", renameResult.report.summary.jsReferencesUpdated);

    // Show the rename mapping
    console.log("\n=== RENAME MAPPING ===");
    const mappingEntries = Array.from(renameResult.mapping.entries());
    console.log(`Total mappings: ${mappingEntries.length}`);
    mappingEntries.slice(0, 20).forEach(([original, renamed]) => {
      console.log(`  "${original}" → "${renamed}"`);
    });

    // Step 5: Check the updated JS
    console.log("\n=== STEP 4: Updated JavaScript ===");
    const updatedJs = renameResult.updatedJs;

    // Find all selectors in updated JS
    const updatedGsapSelectors: string[] = [];
    const updatedQuerySelectors: string[] = [];
    const updatedTriggers: string[] = [];

    gsapSelectorPattern.lastIndex = 0;
    querySelectorPattern.lastIndex = 0;
    scrollTriggerPattern.lastIndex = 0;

    while ((match = gsapSelectorPattern.exec(updatedJs)) !== null) {
      updatedGsapSelectors.push(match[2]);
    }
    while ((match = querySelectorPattern.exec(updatedJs)) !== null) {
      updatedQuerySelectors.push(match[1]);
    }
    while ((match = scrollTriggerPattern.exec(updatedJs)) !== null) {
      updatedTriggers.push(match[1]);
    }

    console.log("Updated GSAP selectors:", updatedGsapSelectors);
    console.log("Updated querySelector selectors:", updatedQuerySelectors);
    console.log("Updated ScrollTrigger triggers:", updatedTriggers);

    // Step 6: Compare - Are the old selectors still in the JS?
    console.log("\n=== STEP 5: COMPARISON ===");

    // Check if original class names are still in the updated JS
    const problematicSelectors: string[] = [];
    const allOriginalSelectors = [
      ...originalGsapSelectors,
      ...originalQuerySelectors,
      ...originalTriggers
    ];

    for (const selector of allOriginalSelectors) {
      // Extract class names from selector
      const classMatches = selector.match(/\.([a-zA-Z_-][\w-]*)/g);
      if (!classMatches) continue;

      for (const classWithDot of classMatches) {
        const className = classWithDot.slice(1); // Remove the dot
        const renamedTo = renameResult.mapping.get(className);

        if (renamedTo && renamedTo !== className) {
          // Class was renamed - check if old name is still in JS
          if (updatedJs.includes(`.${className}`)) {
            problematicSelectors.push(`"${className}" was renamed to "${renamedTo}" but old name still in JS!`);
          }
        }
      }
    }

    // Step 7: Check if CSS classes exist in JS selectors
    console.log("\n=== STEP 6: CSS vs JS Selector Match ===");
    const cssClassNames = new Set(Object.keys(
      renameResult.updatedComponents.components.reduce((acc, c) => {
        c.classesUsed.forEach(cl => acc[cl] = true);
        return acc;
      }, {} as Record<string, boolean>)
    ));

    const allUpdatedSelectors = [
      ...updatedGsapSelectors,
      ...updatedQuerySelectors,
      ...updatedTriggers
    ];

    const missingInCss: string[] = [];
    for (const selector of allUpdatedSelectors) {
      const classMatches = selector.match(/\.([a-zA-Z_-][\w-]*)/g);
      if (!classMatches) continue;

      for (const classWithDot of classMatches) {
        const className = classWithDot.slice(1);
        if (!cssClassNames.has(className)) {
          // Check if it's in the rename mapping (as the renamed value)
          const isRenamed = Array.from(renameResult.mapping.values()).includes(className);
          if (!isRenamed) {
            missingInCss.push(`JS selector uses ".${className}" but class not found in CSS/HTML`);
          }
        }
      }
    }

    // Results
    console.log("\n" + "=".repeat(80));
    console.log("INVESTIGATION RESULTS");
    console.log("=".repeat(80));

    if (problematicSelectors.length > 0) {
      console.log("\n❌ PROBLEM FOUND: Old class names still in JS after rename:");
      problematicSelectors.forEach(p => console.log(`   - ${p}`));
    } else {
      console.log("\n✅ No old class names found in JS after rename");
    }

    if (missingInCss.length > 0) {
      console.log("\n⚠️ WARNING: JS selectors target classes not in CSS/HTML:");
      missingInCss.forEach(m => console.log(`   - ${m}`));
    }

    // Show actual JS diff (first 500 chars)
    console.log("\n=== JS BEFORE vs AFTER (first 500 chars) ===");
    console.log("BEFORE:", originalJs.substring(0, 500));
    console.log("\nAFTER:", updatedJs.substring(0, 500));

    // Are they different?
    const jsChanged = originalJs !== updatedJs;
    console.log("\n=== FINAL VERDICT ===");
    console.log("Did JS change after BEM renaming?", jsChanged ? "YES" : "NO ❌ PROBLEM!");
    console.log("JS References Updated count:", renameResult.report.summary.jsReferencesUpdated);

    // Assertions
    // Note: jsReferencesUpdated only counts updates for renamed classes that ARE in JS.
    // If the only renamed class (e.g., "icon") isn't used in JS, this count is correctly 0.
    // The test verifies that no OLD class names remain in JS after renaming.
    expect(problematicSelectors).toHaveLength(0);

    // Also verify: if a class WAS renamed AND appears in JS, it should be updated
    const renamedClasses = mappingEntries.filter(([orig, renamed]) => orig !== renamed);
    const renamedUsedInJs = renamedClasses.filter(([orig]) =>
      allOriginalSelectors.some(sel => sel.includes(`.${orig}`))
    );

    if (renamedUsedInJs.length > 0) {
      // If renamed classes are used in JS, they should be updated
      expect(renameResult.report.summary.jsReferencesUpdated).toBeGreaterThan(0);
    } else {
      // If no renamed classes are used in JS, 0 updates is correct
      console.log("\n✅ No renamed classes were used in JS - jsReferencesUpdated=0 is correct");
    }
  });
});

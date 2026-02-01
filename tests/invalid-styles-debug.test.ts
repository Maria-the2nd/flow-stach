/**
 * Debug test for Webflow invalid styles: btn and bento-item
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { extractCleanHtml } from "../lib/html-parser";
import { normalizeHtmlCssForWebflow } from "../lib/webflow-normalizer";
import { literalizeCssForWebflow } from "../lib/webflow-literalizer";
import { parseCSS, classIndexToWebflowStyles } from "../lib/css-parser";
import { routeCSS } from "../lib/css-embed-router";

describe("Invalid Styles Debug: btn and bento-item", () => {
  it("should debug btn and bento-item class generation", () => {
    const htmlPath = join(__dirname, "../temp/tests/flowbridge-poc.html");
    const fullHtml = readFileSync(htmlPath, "utf-8");

    console.log("\n=== STEP 1: Extract Clean HTML ===");
    const cleanResult = extractCleanHtml(fullHtml);
    console.log("Extracted CSS length:", cleanResult.extractedStyles.length);

    // Check if btn and bento-item are in the raw CSS
    const hasBtnRaw = cleanResult.extractedStyles.includes(".btn ");
    const hasBentoRaw = cleanResult.extractedStyles.includes(".bento-item");
    console.log("Raw CSS has .btn:", hasBtnRaw);
    console.log("Raw CSS has .bento-item:", hasBentoRaw);

    console.log("\n=== STEP 2: Route CSS ===");
    const routing = routeCSS(cleanResult.extractedStyles);
    console.log("Native CSS length:", routing.native.length);
    console.log("Embed CSS length:", routing.embed.length);
    console.log("Routing warnings:", routing.warnings.filter(w =>
      w.selector?.includes("btn") || w.selector?.includes("bento")
    ));

    // Check if variables are resolved
    const nativeHasVar = routing.native.includes("var(--");
    console.log("Native CSS has unresolved var():", nativeHasVar);
    if (nativeHasVar) {
      const varMatches = routing.native.match(/var\(--[\w-]+\)/g) || [];
      console.log("Unresolved vars in native:", [...new Set(varMatches)].slice(0, 10));
    }

    console.log("\n=== STEP 3: Normalize ===");
    const normalization = normalizeHtmlCssForWebflow(cleanResult.cleanHtml, routing.native);
    console.log("Normalized CSS length:", normalization.css.length);
    console.log("Normalization warnings:", normalization.warnings.slice(0, 5));

    console.log("\n=== STEP 4: Literalize ===");
    const literalization = literalizeCssForWebflow(normalization.css);
    console.log("Literalized CSS length:", literalization.css.length);
    console.log("Remaining var count:", literalization.remainingVarCount);
    console.log("Unresolved variables:", literalization.unresolvedVariables.slice(0, 10));

    console.log("\n=== STEP 5: Parse CSS ===");
    const parsed = parseCSS(literalization.css);
    const classIndex = parsed.classIndex;

    // Check btn class
    const btnClass = classIndex.classes["btn"];
    console.log("\n--- btn class ---");
    console.log("Exists:", !!btnClass);
    if (btnClass) {
      console.log("baseStyles:", btnClass.baseStyles?.substring(0, 200));
      console.log("Has var():", btnClass.baseStyles?.includes("var(--"));
    }

    // Check bento-item class
    const bentoClass = classIndex.classes["bento-item"];
    console.log("\n--- bento-item class ---");
    console.log("Exists:", !!bentoClass);
    if (bentoClass) {
      console.log("baseStyles:", bentoClass.baseStyles?.substring(0, 200));
      console.log("Has var():", bentoClass.baseStyles?.includes("var(--"));
    }

    console.log("\n=== STEP 6: Convert to Webflow Styles ===");
    const usedClasses = new Set(Object.keys(classIndex.classes));
    const webflowStyles = classIndexToWebflowStyles(classIndex, usedClasses);

    // Find btn and bento-item in Webflow styles
    const btnStyle = webflowStyles.find(s => s.name === "btn");
    const bentoStyle = webflowStyles.find(s => s.name === "bento-item");

    console.log("\n--- btn Webflow style ---");
    if (btnStyle) {
      console.log("styleLess:", btnStyle.styleLess?.substring(0, 300));
      console.log("styleLess has var():", btnStyle.styleLess?.includes("var(--"));

      // Check for invalid patterns
      const hasEmptyProp = /:\s*;/.test(btnStyle.styleLess || "");
      const hasInvalidUnit = /:\s*\d+[a-z]*\s+[a-z]+/.test(btnStyle.styleLess || "");
      console.log("Has empty property value:", hasEmptyProp);
      console.log("Has potentially invalid unit:", hasInvalidUnit);
    } else {
      console.log("NOT FOUND in Webflow styles!");
    }

    console.log("\n--- bento-item Webflow style ---");
    if (bentoStyle) {
      console.log("styleLess:", bentoStyle.styleLess?.substring(0, 300));
      console.log("styleLess has var():", bentoStyle.styleLess?.includes("var(--"));

      // Check for invalid patterns
      const hasEmptyProp = /:\s*;/.test(bentoStyle.styleLess || "");
      const hasInvalidUnit = /:\s*\d+[a-z]*\s+[a-z]+/.test(bentoStyle.styleLess || "");
      console.log("Has empty property value:", hasEmptyProp);
      console.log("Has potentially invalid unit:", hasInvalidUnit);
    } else {
      console.log("NOT FOUND in Webflow styles!");
    }

    // Check for common Webflow-invalid patterns
    console.log("\n=== Checking for Invalid Patterns ===");
    for (const style of webflowStyles) {
      const sl = style.styleLess || "";

      // Check for unresolved CSS variables
      if (sl.includes("var(--")) {
        console.log(`INVALID: ${style.name} has unresolved CSS variable`);
      }

      // Check for empty values
      if (/:\s*;/.test(sl)) {
        console.log(`INVALID: ${style.name} has empty property value`);
      }

      // Check for inherit/initial/unset (Webflow might not like these)
      if (/:\s*(inherit|initial|unset)\s*;/.test(sl)) {
        console.log(`SUSPICIOUS: ${style.name} has inherit/initial/unset`);
      }
    }

    // Assertions
    expect(btnClass).toBeDefined();
    expect(bentoClass).toBeDefined();
  });

  it("should check Three.js and external script handling", () => {
    const htmlPath = join(__dirname, "../temp/tests/flowbridge-poc.html");
    const fullHtml = readFileSync(htmlPath, "utf-8");

    console.log("\n=== THREE.JS HANDLING ===");

    const cleanResult = extractCleanHtml(fullHtml);

    console.log("External scripts found:", cleanResult.externalScripts);
    console.log("Has three.js:", cleanResult.externalScripts.some(s => s.includes("three")));
    console.log("Has gsap:", cleanResult.externalScripts.some(s => s.includes("gsap")));

    // Check if canvas element exists
    const hasCanvas = fullHtml.includes("<canvas") || fullHtml.includes("id=\"three-bg\"");
    console.log("Has canvas element:", hasCanvas);

    // Check inline scripts for Three.js setup
    const hasThreeSetup = cleanResult.extractedScripts.includes("THREE.Scene") ||
                          cleanResult.extractedScripts.includes("new THREE");
    console.log("Has Three.js setup in inline scripts:", hasThreeSetup);

    // Check if we're preserving the canvas
    const cleanHtmlHasCanvas = cleanResult.cleanHtml.includes("canvas") ||
                                cleanResult.cleanHtml.includes("three-bg");
    console.log("Clean HTML preserves canvas:", cleanHtmlHasCanvas);

    // Assertions
    expect(cleanResult.externalScripts.some(s => s.includes("three"))).toBe(true);
  });
});

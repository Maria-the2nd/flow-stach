/**
 * Full Pipeline Debug Test
 *
 * Tests the complete flow from HTML+CSS through to Webflow styles
 * to trace where CSS styles are being lost.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { routeCSS } from "../lib/css-embed-router";
import { normalizeHtmlCssForWebflow } from "../lib/webflow-normalizer";
import { parseCSS, classIndexToWebflowStyles } from "../lib/css-parser";
import { extractCleanHtml } from "../lib/html-parser";
import { literalizeCssForWebflow } from "../lib/webflow-literalizer";
import { componentizeHtml } from "../lib/componentizer";
import { buildComponentPayload, buildCssTokenPayload } from "../lib/webflow-converter";
import { ensureWebflowPasteSafety } from "../lib/webflow-safety-gate";

describe("Full Pipeline Debug", () => {
  it("should trace where styles are lost in the wf-motion-effects pipeline", () => {
    // Read the test file
    const htmlPath = join(__dirname, "../temp/tests/wf-motion-effects-test.html");
    const fullHtml = readFileSync(htmlPath, "utf-8");

    // Extract CSS from <style> tags
    const styleMatch = fullHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    expect(styleMatch).toBeTruthy();
    const css = styleMatch![1];

    // Extract body content
    const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const html = bodyMatch ? bodyMatch[1] : fullHtml;

    console.log("\n=== STEP 1: Raw CSS Input ===");
    console.log("CSS length:", css.length);
    console.log("CSS has :root:", css.includes(":root"));
    console.log("CSS has .card:", css.includes(".card"));
    console.log("CSS has var(--", css.includes("var(--"));

    // Step 1: Route CSS
    console.log("\n=== STEP 2: routeCSS() ===");
    const routed = routeCSS(css);
    console.log("Native CSS length:", routed.native.length);
    console.log("Embed CSS length:", routed.embed.length);
    console.log("Stats:", routed.stats);
    console.log("Native CSS (first 500 chars):", routed.native.substring(0, 500));

    // Step 2: Normalize
    console.log("\n=== STEP 3: normalizeHtmlCssForWebflow() ===");
    const normalized = normalizeHtmlCssForWebflow(html, routed.native);
    console.log("Normalized HTML length:", normalized.html.length);
    console.log("ClassIndex classes:", Object.keys(normalized.classIndex?.classes || {}).length);
    console.log("Warnings:", normalized.warnings.length);
    if (normalized.warnings.length > 0) {
      console.log("First 5 warnings:", normalized.warnings.slice(0, 5));
    }

    // Check classIndex
    const classIndex = normalized.classIndex;
    if (classIndex) {
      const classNames = Object.keys(classIndex.classes);
      console.log("Class names:", classNames.slice(0, 20).join(", "));

      // Check which classes have styles
      const withStyles = classNames.filter(name => classIndex.classes[name].baseStyles);
      const withoutStyles = classNames.filter(name => !classIndex.classes[name].baseStyles);
      console.log("Classes WITH baseStyles:", withStyles.length);
      console.log("Classes WITHOUT baseStyles:", withoutStyles.length);
      console.log("Classes with styles:", withStyles.slice(0, 10).join(", "));
      console.log("Classes without styles:", withoutStyles.slice(0, 10).join(", "));

      // Show sample entries
      console.log("\n=== Class Entry Details ===");
      ["card", "test-grid", "log-entry", "box-transition"].forEach(name => {
        const entry = classIndex.classes[name];
        if (entry) {
          console.log(`${name}: baseStyles="${entry.baseStyles.substring(0, 100)}..."`);
        } else {
          console.log(`${name}: NOT FOUND`);
        }
      });
    }

    // Step 3: Convert to Webflow styles
    console.log("\n=== STEP 4: classIndexToWebflowStyles() ===");
    if (classIndex) {
      const styles = classIndexToWebflowStyles(classIndex);
      console.log("Generated styles count:", styles.length);
      if (styles.length > 0) {
        console.log("First style:", styles[0].name, "styleLess length:", styles[0].styleLess?.length);
      }
    }

    // Assertions
    expect(routed.native.length).toBeGreaterThan(0);
    expect(Object.keys(normalized.classIndex?.classes || {}).length).toBeGreaterThan(5);
  });

  it("should work via project-engine path (no routeCSS)", () => {
    // This test mimics processProjectImport() which doesn't use routeCSS
    const htmlPath = join(__dirname, "../temp/tests/wf-motion-effects-test.html");
    const fullHtml = readFileSync(htmlPath, "utf-8");

    console.log("\n=== PROJECT-ENGINE PATH (no routeCSS) ===");

    // Extract clean HTML (same as project-engine)
    const cleanResult = extractCleanHtml(fullHtml);
    console.log("Clean HTML length:", cleanResult.cleanHtml.length);
    console.log("Extracted styles length:", cleanResult.extractedStyles.length);
    console.log("Has :root in styles:", cleanResult.extractedStyles.includes(":root"));
    console.log("Has var(-- in styles:", cleanResult.extractedStyles.includes("var(--"));

    // Normalize directly (no routeCSS!)
    console.log("\n=== Direct normalizeHtmlCssForWebflow (no routeCSS) ===");
    const normalized = normalizeHtmlCssForWebflow(cleanResult.cleanHtml, cleanResult.extractedStyles);

    const classIndex = normalized.classIndex;
    if (classIndex) {
      const classNames = Object.keys(classIndex.classes);
      const withStyles = classNames.filter(name => classIndex.classes[name].baseStyles);
      const withoutStyles = classNames.filter(name => !classIndex.classes[name].baseStyles);

      console.log("Total classes:", classNames.length);
      console.log("Classes WITH baseStyles:", withStyles.length);
      console.log("Classes WITHOUT baseStyles:", withoutStyles.length);
      console.log("Sample classes with styles:", withStyles.slice(0, 5).join(", "));

      // Show some class details
      ["card", "test-grid", "box-transition"].forEach(name => {
        const entry = classIndex.classes[name];
        if (entry) {
          console.log(`${name}: baseStyles="${entry.baseStyles.substring(0, 80)}..."`);
        } else {
          console.log(`${name}: NOT FOUND`);
        }
      });
    }

    // Assertions
    expect(classIndex).toBeDefined();
    expect(Object.keys(classIndex?.classes || {}).length).toBeGreaterThan(5);
  });

  it("should work via FULL project-engine path (normalize → literalize → parseCSS)", () => {
    // This test mimics the EXACT flow from processProjectImport()
    const htmlPath = join(__dirname, "../temp/tests/wf-motion-effects-test.html");
    const fullHtml = readFileSync(htmlPath, "utf-8");

    console.log("\n=== FULL PROJECT-ENGINE PATH ===");

    // Step 1: Extract clean HTML (same as project-engine line 86)
    const cleanResult = extractCleanHtml(fullHtml);
    console.log("Step 1 - extractCleanHtml:");
    console.log("  Clean HTML length:", cleanResult.cleanHtml.length);
    console.log("  Extracted styles length:", cleanResult.extractedStyles.length);

    // Step 2: Normalize (same as project-engine line 87)
    const normalization = normalizeHtmlCssForWebflow(cleanResult.cleanHtml, cleanResult.extractedStyles);
    console.log("\nStep 2 - normalizeHtmlCssForWebflow:");
    console.log("  Normalized CSS length:", normalization.css.length);
    console.log("  ClassIndex classes:", Object.keys(normalization.classIndex?.classes || {}).length);

    // Check if normalization.css has styles
    const normalizedCssHasCard = normalization.css.includes(".card");
    console.log("  CSS has .card:", normalizedCssHasCard);

    // Step 3: Literalize (same as project-engine line 232)
    // workingCss = normalization.css, then literalizeCssForWebflow(workingCss)
    const literalization = literalizeCssForWebflow(normalization.css);
    console.log("\nStep 3 - literalizeCssForWebflow:");
    console.log("  Literalized CSS length:", literalization.css.length);
    console.log("  Warnings:", literalization.warnings.length);
    console.log("  Remaining var count:", literalization.remainingVarCount);

    // Check if literalization.css has styles
    const literalizedCssHasCard = literalization.css.includes(".card");
    console.log("  CSS has .card:", literalizedCssHasCard);
    console.log("  CSS first 500 chars:", literalization.css.substring(0, 500));

    // Step 4: Final parseCSS (same as project-engine line 242)
    const finalCssResult = parseCSS(literalization.css);
    const classIndex = finalCssResult.classIndex;
    console.log("\nStep 4 - parseCSS (final):");
    console.log("  Total classes:", Object.keys(classIndex.classes).length);

    const classNames = Object.keys(classIndex.classes);
    const withStyles = classNames.filter(name => classIndex.classes[name].baseStyles);
    const withoutStyles = classNames.filter(name => !classIndex.classes[name].baseStyles);

    console.log("  Classes WITH baseStyles:", withStyles.length);
    console.log("  Classes WITHOUT baseStyles:", withoutStyles.length);

    // Show class details
    console.log("\n=== Final Class Entry Details ===");
    ["card", "test-grid", "box-transition", "wf-body"].forEach(name => {
      const entry = classIndex.classes[name];
      if (entry) {
        console.log(`  ${name}: baseStyles="${entry.baseStyles.substring(0, 80)}..."`);
      } else {
        console.log(`  ${name}: NOT FOUND`);
      }
    });

    // Assertions
    expect(literalization.css.length).toBeGreaterThan(0);
    expect(withStyles.length).toBeGreaterThan(5);
  });

  it("should generate Webflow JSON with styles (full end-to-end)", () => {
    const htmlPath = join(__dirname, "../temp/tests/wf-motion-effects-test.html");
    const fullHtml = readFileSync(htmlPath, "utf-8");

    console.log("\n=== FULL END-TO-END: HTML → Webflow JSON ===");

    // Step 1: Extract clean HTML
    const cleanResult = extractCleanHtml(fullHtml);

    // Step 2: Normalize
    const normalization = normalizeHtmlCssForWebflow(cleanResult.cleanHtml, cleanResult.extractedStyles);

    // Step 3: Literalize
    const literalization = literalizeCssForWebflow(normalization.css);

    // Step 4: Final parseCSS
    const finalCssResult = parseCSS(literalization.css);
    const classIndex = finalCssResult.classIndex;

    // Step 5: Componentize
    const componentsTree = componentizeHtml(normalization.html);
    console.log("Components found:", componentsTree.components.length);

    // Step 6: Build token payload for established classes
    const tokenPayloadResult = buildCssTokenPayload(literalization.css, { namespace: "test", includePreview: false });
    const establishedClasses = Array.isArray(tokenPayloadResult.establishedClasses)
      ? new Set(tokenPayloadResult.establishedClasses)
      : tokenPayloadResult.establishedClasses;
    console.log("Established classes:", establishedClasses.size);

    // Step 7: Build component payload (same as project-engine line 271)
    if (componentsTree.components.length > 0) {
      const firstComponent = componentsTree.components[0];
      console.log("\n--- First Component ---");
      console.log("Name:", firstComponent.name);
      console.log("Classes used:", firstComponent.classesUsed.slice(0, 10).join(", "));
      console.log("HTML length:", firstComponent.htmlContent.length);

      const payload = buildComponentPayload(firstComponent, classIndex, establishedClasses, {
        skipEstablishedStyles: false
      });

      console.log("\n--- Webflow Payload ---");
      console.log("Nodes:", payload.webflowPayload.payload.nodes.length);
      console.log("Styles:", payload.webflowPayload.payload.styles.length);
      console.log("Warnings:", payload.warnings.length);
      console.log("Missing classes:", payload.missingClasses.length);

      // Check styles
      const stylesWithContent = payload.webflowPayload.payload.styles.filter(s => s.styleLess && s.styleLess.length > 0);
      const stylesWithoutContent = payload.webflowPayload.payload.styles.filter(s => !s.styleLess || s.styleLess.length === 0);
      console.log("Styles WITH styleLess:", stylesWithContent.length);
      console.log("Styles WITHOUT styleLess:", stylesWithoutContent.length);

      // Show first few styles
      console.log("\n--- First 5 Styles ---");
      payload.webflowPayload.payload.styles.slice(0, 5).forEach((style, i) => {
        console.log(`  ${i + 1}. ${style.name}: styleLess="${(style.styleLess || '').substring(0, 60)}..."`);
      });

      // Step 8: Run safety gate
      const safety = ensureWebflowPasteSafety({ payload: payload.webflowPayload });
      console.log("\n--- Safety Gate ---");
      console.log("Blocked:", safety.blocked);
      console.log("Sanitization applied:", safety.sanitizationApplied);
      console.log("Final styles:", safety.payload.payload.styles.length);

      // Check final styles
      const finalStylesWithContent = safety.payload.payload.styles.filter(s => s.styleLess && s.styleLess.length > 0);
      console.log("Final styles WITH styleLess:", finalStylesWithContent.length);

      // Show final styles
      console.log("\n--- Final Styles (first 5) ---");
      safety.payload.payload.styles.slice(0, 5).forEach((style, i) => {
        console.log(`  ${i + 1}. ${style.name}: styleLess="${(style.styleLess || '').substring(0, 60)}..."`);
      });

      // Verify style ID references
      console.log("\n--- Verifying Node → Style References ---");
      const styleIdSet = new Set(safety.payload.payload.styles.map(s => s._id));
      const styleNameSet = new Set(safety.payload.payload.styles.map(s => s.name));
      let missingRefs = 0;
      let totalRefs = 0;
      for (const node of safety.payload.payload.nodes) {
        if (node.classes && Array.isArray(node.classes)) {
          for (const classRef of node.classes) {
            totalRefs++;
            // Class refs can be either UUIDs (style._id) or names (style.name)
            if (!styleIdSet.has(classRef) && !styleNameSet.has(classRef)) {
              missingRefs++;
              console.log(`  Missing: node ${node._id} references class "${classRef}" which doesn't exist in styles`);
            }
          }
        }
      }
      console.log(`Total class refs: ${totalRefs}, Missing: ${missingRefs}`);

      // Assertions
      expect(payload.webflowPayload.payload.styles.length).toBeGreaterThan(0);
      expect(stylesWithContent.length).toBeGreaterThan(0);
      expect(safety.blocked).toBe(false);
      expect(finalStylesWithContent.length).toBeGreaterThan(0);
      expect(missingRefs).toBe(0);
    }
  });

  it("should generate valid tokenWebflowJson with styles (project-engine flow)", () => {
    const htmlPath = join(__dirname, "../temp/tests/wf-motion-effects-test.html");
    const fullHtml = readFileSync(htmlPath, "utf-8");

    console.log("\n=== TOKEN PAYLOAD GENERATION (project-engine flow) ===");

    // Step 1: Extract clean HTML
    const cleanResult = extractCleanHtml(fullHtml);

    // Step 2: Normalize
    const normalization = normalizeHtmlCssForWebflow(cleanResult.cleanHtml, cleanResult.extractedStyles);

    // Step 3: Literalize (same as project-engine)
    const literalization = literalizeCssForWebflow(normalization.css);
    console.log("Literalized CSS length:", literalization.css.length);

    // Step 4: Build token payload (same as project-engine line 243)
    const tokenPayloadResult = buildCssTokenPayload(literalization.css, { namespace: "test", includePreview: true });
    console.log("Token payload nodes:", tokenPayloadResult.webflowPayload.payload.nodes.length);
    console.log("Token payload styles:", tokenPayloadResult.webflowPayload.payload.styles.length);

    // Check token styles
    const tokenStylesWithContent = tokenPayloadResult.webflowPayload.payload.styles.filter(
      s => s.styleLess && s.styleLess.length > 0
    );
    console.log("Token styles WITH styleLess:", tokenStylesWithContent.length);

    // Step 5: Run safety gate (same as project-engine line 244)
    const tokenSafety = ensureWebflowPasteSafety({ payload: tokenPayloadResult.webflowPayload });
    console.log("\n--- Token Safety Gate ---");
    console.log("Blocked:", tokenSafety.blocked);
    console.log("Block reason:", tokenSafety.blockReason);
    console.log("Sanitization applied:", tokenSafety.sanitizationApplied);
    console.log("Final styles count:", tokenSafety.payload.payload.styles.length);

    // Check what would be stored (same as project-engine line 245-247)
    const tokenWebflowJson = tokenSafety.blocked
      ? JSON.stringify({ placeholder: true })
      : tokenSafety.webflowJson;

    console.log("tokenWebflowJson is placeholder:", tokenWebflowJson.includes("placeholder"));
    console.log("tokenWebflowJson length:", tokenWebflowJson.length);

    // Parse and verify
    const parsedToken = JSON.parse(tokenWebflowJson);
    const isPlaceholder = parsedToken.placeholder === true;
    console.log("Is placeholder:", isPlaceholder);

    if (!isPlaceholder) {
      const finalTokenStyles = parsedToken.payload?.styles || [];
      const finalTokenStylesWithContent = finalTokenStyles.filter(
        (s: { styleLess?: string }) => s.styleLess && s.styleLess.length > 0
      );
      console.log("Final token styles:", finalTokenStyles.length);
      console.log("Final token styles WITH styleLess:", finalTokenStylesWithContent.length);

      // Show first few styles
      console.log("\n--- First 5 Token Styles ---");
      finalTokenStyles.slice(0, 5).forEach((style: { name?: string; styleLess?: string }, i: number) => {
        console.log(`  ${i + 1}. ${style.name}: styleLess="${(style.styleLess || '').substring(0, 60)}..."`);
      });
    }

    // Assertions
    expect(tokenSafety.blocked).toBe(false);
    expect(isPlaceholder).toBe(false);
  });
});

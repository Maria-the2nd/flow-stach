/**
 * Three.js and External Script Handling Tests
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { extractCleanHtml } from "../lib/html-parser";
import { detectLibraries, generateWebflowScriptEmbed } from "../lib/js-library-detector";

describe("Three.js and External Script Handling", () => {
  it("should detect Three.js from inline script code", () => {
    const htmlPath = join(__dirname, "../temp/tests/flowbridge-poc.html");
    const fullHtml = readFileSync(htmlPath, "utf-8");

    const cleanResult = extractCleanHtml(fullHtml);

    console.log("\n=== Extracted Scripts ===");
    console.log("Inline scripts length:", cleanResult.extractedScripts.length);
    console.log("External scripts:", cleanResult.externalScripts);

    // Check if Three.js code is in inline scripts
    const hasThreeCode = cleanResult.extractedScripts.includes("THREE.");
    console.log("Has THREE. in inline scripts:", hasThreeCode);

    // Detect libraries from inline scripts
    const detected = detectLibraries(cleanResult.extractedScripts);
    console.log("\n=== Detected Libraries ===");
    console.log("Library names:", detected.names);
    console.log("Display names:", detected.displayNames);
    console.log("Script URLs:", detected.scripts);

    // Verify Three.js is detected
    expect(detected.names).toContain("three");
    expect(detected.scripts.some(s => s.includes("three"))).toBe(true);
  });

  it("should generate embedJS with Three.js script tag", () => {
    const htmlPath = join(__dirname, "../temp/tests/flowbridge-poc.html");
    const fullHtml = readFileSync(htmlPath, "utf-8");

    const cleanResult = extractCleanHtml(fullHtml);

    // Generate the embed
    const embedResult = generateWebflowScriptEmbed(cleanResult.extractedScripts, {
      detectLibs: true,
      wrapInDOMContentLoaded: true,
    });

    console.log("\n=== Generated Embed ===");
    console.log("Embed HTML length:", embedResult.embedHtml.length);
    console.log("Detected libraries:", embedResult.detectedLibraries.displayNames);
    console.log("Paid plugin warnings:", embedResult.paidPluginWarnings);

    // Check for Three.js script tag
    const hasThreeScript = embedResult.embedHtml.includes("three");
    console.log("Has three.js script tag:", hasThreeScript);

    // Check for GSAP script tags
    const hasGsapScript = embedResult.embedHtml.includes("gsap");
    console.log("Has GSAP script tag:", hasGsapScript);

    // Show first part of embed
    console.log("\n--- Embed HTML (first 1000 chars) ---");
    console.log(embedResult.embedHtml.substring(0, 1000));

    // Verify script tags are present
    expect(embedResult.embedHtml).toContain('<script src="');
    expect(hasThreeScript).toBe(true);
    expect(hasGsapScript).toBe(true);
  });

  it("should check if canvas element is preserved", () => {
    const htmlPath = join(__dirname, "../temp/tests/flowbridge-poc.html");
    const fullHtml = readFileSync(htmlPath, "utf-8");

    const cleanResult = extractCleanHtml(fullHtml);

    console.log("\n=== Canvas Element Check ===");

    // Original has canvas
    const originalHasCanvas = fullHtml.includes("<canvas") || fullHtml.includes('id="three-bg"');
    console.log("Original HTML has canvas:", originalHasCanvas);

    // Clean HTML should preserve canvas
    const cleanHasCanvas = cleanResult.cleanHtml.includes("canvas") ||
                            cleanResult.cleanHtml.includes("three-bg");
    console.log("Clean HTML preserves canvas/three-bg:", cleanHasCanvas);

    // Check for the actual canvas element
    const canvasMatch = cleanResult.cleanHtml.match(/<canvas[^>]*>/);
    console.log("Canvas element found:", canvasMatch ? canvasMatch[0] : "NONE");

    // Check for the three-bg div
    const threeBgMatch = cleanResult.cleanHtml.match(/id="three-bg"[^>]*/);
    console.log("Three-bg div found:", threeBgMatch ? threeBgMatch[0] : "NONE");

    expect(originalHasCanvas).toBe(true);
  });
});

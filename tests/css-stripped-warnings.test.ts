/**
 * CSS Stripped Properties Warnings Test
 *
 * Verifies that when properties are stripped (e.g., animation),
 * appropriate warnings are emitted with full context.
 */

import { describe, it, expect } from "vitest";
import { parseCSS } from "../lib/css-parser";

describe("Stripped Property Warnings", () => {
  it("emits warning when animation property is stripped", () => {
    const css = `.animated { animation: fadeIn 1s ease; }`;
    const result = parseCSS(css);

    // Should have a stripped_property warning
    const strippedWarnings = result.classIndex.warnings.filter(
      (w) => w.type === "stripped_property"
    );

    expect(strippedWarnings.length).toBeGreaterThan(0);

    const animationWarning = strippedWarnings.find((w) => w.property === "animation");
    expect(animationWarning).toBeDefined();
    expect(animationWarning?.selector).toBe(".animated");
    expect(animationWarning?.value).toBe("fadeIn 1s ease");
    expect(animationWarning?.reason).toBe("STRIP_PROPERTIES");
    expect(animationWarning?.severity).toBe("warning");
  });

  it("emits warning when animation-name is stripped", () => {
    const css = `.fade { animation-name: fadeIn; animation-duration: 1s; }`;
    const result = parseCSS(css);

    const strippedWarnings = result.classIndex.warnings.filter(
      (w) => w.type === "stripped_property"
    );

    const animationNameWarning = strippedWarnings.find(
      (w) => w.property === "animation-name"
    );
    expect(animationNameWarning).toBeDefined();
    expect(animationNameWarning?.selector).toBe(".fade");
    expect(animationNameWarning?.value).toBe("fadeIn");
    expect(animationNameWarning?.reason).toBe("STRIP_PROPERTIES");

    const animationDurationWarning = strippedWarnings.find(
      (w) => w.property === "animation-duration"
    );
    expect(animationDurationWarning).toBeDefined();
  });

  it("emits warning for multiple stripped properties in one rule", () => {
    const css = `.complex {
      animation: spin 2s linear infinite;
      -webkit-animation: spin 2s linear infinite;
      -webkit-font-smoothing: antialiased;
    }`;
    const result = parseCSS(css);

    const strippedWarnings = result.classIndex.warnings.filter(
      (w) => w.type === "stripped_property"
    );

    // Should have warnings for animation, -webkit-animation, and -webkit-font-smoothing
    expect(strippedWarnings.length).toBeGreaterThanOrEqual(3);

    const properties = strippedWarnings.map((w) => w.property);
    expect(properties).toContain("animation");
    expect(properties).toContain("-webkit-animation");
    expect(properties).toContain("-webkit-font-smoothing");

    // All should have the same selector
    strippedWarnings.forEach((warning) => {
      expect(warning.selector).toBe(".complex");
      expect(warning.reason).toBe("STRIP_PROPERTIES");
    });
  });

  it("includes selector context in warning", () => {
    const css = `
      .btn { animation: pulse 1s infinite; }
      .card:hover { animation: bounce 0.5s; }
    `;
    const result = parseCSS(css);

    const strippedWarnings = result.classIndex.warnings.filter(
      (w) => w.type === "stripped_property" && w.property === "animation"
    );

    expect(strippedWarnings.length).toBe(2);

    const btnWarning = strippedWarnings.find((w) => w.selector === ".btn");
    expect(btnWarning).toBeDefined();
    expect(btnWarning?.value).toBe("pulse 1s infinite");

    const cardHoverWarning = strippedWarnings.find((w) => w.selector === ".card:hover");
    expect(cardHoverWarning).toBeDefined();
    expect(cardHoverWarning?.value).toBe("bounce 0.5s");
  });

  it("emits unsupported_property warning for unknown properties", () => {
    const css = `.custom { -webkit-custom-prop: value; unknown-prop: test; }`;
    const result = parseCSS(css);

    const unsupportedWarnings = result.classIndex.warnings.filter(
      (w) => w.type === "unsupported_property"
    );

    expect(unsupportedWarnings.length).toBeGreaterThan(0);

    unsupportedWarnings.forEach((warning) => {
      expect(warning.selector).toBe(".custom");
      expect(warning.reason).toBe("unsupported");
      expect(warning.value).toBeDefined();
      expect(warning.severity).toBe("warning");
    });
  });

  it("does NOT emit warning for supported transition properties", () => {
    const css = `.btn { transition: all 200ms ease; }`;
    const result = parseCSS(css);

    const strippedWarnings = result.classIndex.warnings.filter(
      (w) => w.type === "stripped_property" && w.property?.startsWith("transition")
    );

    // Should be 0 because transition is now supported
    expect(strippedWarnings.length).toBe(0);

    // Should have successfully parsed the transition
    const entry = result.classIndex.classes["btn"];
    expect(entry?.baseStyles).toContain("transition-property: transform, opacity");
    expect(entry?.baseStyles).toContain("transition-duration: 200ms");
  });

  it("formats warning message correctly", () => {
    const css = `.animated { animation: fadeIn 1s; }`;
    const result = parseCSS(css);

    const warning = result.classIndex.warnings.find(
      (w) => w.type === "stripped_property" && w.property === "animation"
    );

    expect(warning?.message).toContain("animation");
    expect(warning?.message).toContain("not supported");
    expect(warning?.message).toContain("stripped");
  });
});

describe("Warning Output Format", () => {
  it("provides all required fields for UI display", () => {
    const css = `.box { animation: rotate 2s; filter: blur(10px); }`;
    const result = parseCSS(css);

    const strippedWarning = result.classIndex.warnings.find(
      (w) => w.type === "stripped_property"
    );

    expect(strippedWarning).toBeDefined();
    expect(strippedWarning).toHaveProperty("type");
    expect(strippedWarning).toHaveProperty("message");
    expect(strippedWarning).toHaveProperty("selector");
    expect(strippedWarning).toHaveProperty("property");
    expect(strippedWarning).toHaveProperty("value");
    expect(strippedWarning).toHaveProperty("reason");
    expect(strippedWarning).toHaveProperty("severity");

    // Example output format for UI:
    console.log("\n=== Example Warning Output ===");
    console.log(JSON.stringify(strippedWarning, null, 2));
    console.log("\nDisplay format:");
    console.log(
      `[${strippedWarning?.severity?.toUpperCase()}] ${strippedWarning?.selector}: ${strippedWarning?.property} = "${strippedWarning?.value}"`
    );
    console.log(`Reason: ${strippedWarning?.reason}`);
    console.log(`Message: ${strippedWarning?.message}`);
  });
});

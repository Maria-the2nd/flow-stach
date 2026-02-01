/**
 * @keyframes Extraction Tests
 *
 * Verifies that @keyframes blocks don't corrupt CSS parsing.
 * Classes defined before AND after @keyframes should be extracted correctly.
 */

import { describe, it, expect } from "vitest";
import { parseCSS } from "../lib/css-parser";

describe("@keyframes extraction", () => {
  it("should extract classes defined AFTER @keyframes blocks", () => {
    const css = `
      .before { color: red; }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-5px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .after { color: blue; }
    `;
    const result = parseCSS(css);

    // Both classes should be detected
    expect(result.classIndex.classes["before"]).toBeDefined();
    expect(result.classIndex.classes["after"]).toBeDefined();
    expect(result.classIndex.classes["before"]?.baseStyles).toContain("color: red");
    expect(result.classIndex.classes["after"]?.baseStyles).toContain("color: blue");
  });

  it("should handle multiple @keyframes blocks", () => {
    const css = `
      .card { background: white; }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      .btn { padding: 10px; }
      @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      .footer { margin-top: 20px; }
    `;
    const result = parseCSS(css);

    // All 3 classes should be detected
    expect(result.classIndex.classes["card"]).toBeDefined();
    expect(result.classIndex.classes["btn"]).toBeDefined();
    expect(result.classIndex.classes["footer"]).toBeDefined();
  });

  it("should handle @-webkit-keyframes", () => {
    const css = `
      .before { color: red; }
      @-webkit-keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .after { color: blue; }
    `;
    const result = parseCSS(css);

    expect(result.classIndex.classes["before"]).toBeDefined();
    expect(result.classIndex.classes["after"]).toBeDefined();
  });

  it("should preserve @keyframes in the result for embed CSS", () => {
    const css = `
      .test { color: red; }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    const result = parseCSS(css);

    // Keyframes should be preserved in the result
    expect(result.keyframes).toBeDefined();
    expect(result.keyframes).toContain("@keyframes fadeIn");
    expect(result.keyframes).toContain("opacity: 0");
    expect(result.keyframes).toContain("opacity: 1");
  });

  it("should handle complex @keyframes with percentages", () => {
    const css = `
      .before { display: flex; }
      @keyframes gradient-anim {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .after { display: grid; }
    `;
    const result = parseCSS(css);

    expect(result.classIndex.classes["before"]).toBeDefined();
    expect(result.classIndex.classes["after"]).toBeDefined();
    expect(result.keyframes).toContain("@keyframes gradient-anim");
  });

  it("should handle real-world CSS from wf-motion-effects-test.html", () => {
    // Simplified version of the test file CSS with @keyframes
    const css = `
      :root { --brand: #7c3aed; }
      * { box-sizing: border-box; }
      body { background-color: #0b0f1a; }

      .test-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
        gap: 1.5rem;
      }

      .card {
        background: #161b2e;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 1.5rem;
      }

      .log-entry {
        margin-bottom: 0.25rem;
        animation: fadeIn 0.3s ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-5px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .box-transition {
        width: 80px;
        height: 80px;
        background: #7c3aed;
        border-radius: 12px;
        transition: all 400ms ease;
      }

      .filter-bg {
        width: 100%;
        height: 100%;
        background: linear-gradient(45deg, #ff0000, #ffff00, #00ff00);
        animation: gradient-anim 10s infinite linear;
      }

      @keyframes gradient-anim {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      .glass-box {
        width: 120px;
        height: 80px;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(8px);
        border-radius: 12px;
      }

      .var-box {
        width: 80px;
        height: 80px;
        background: #7c3aed;
      }

      .selector-list li:nth-child(even) {
        background: #7c3aed;
      }
    `;

    const result = parseCSS(css);
    const classNames = Object.keys(result.classIndex.classes);

    console.log("\\n=== Classes Detected ===");
    console.log(`Total: ${classNames.length}`);
    console.log(classNames.join(", "));

    console.log("\\n=== @keyframes Extracted ===");
    console.log(result.keyframes.substring(0, 200) + "...");

    // Should detect many more than 3 classes!
    expect(classNames.length).toBeGreaterThan(3);

    // Specific classes that should be detected
    expect(result.classIndex.classes["test-grid"]).toBeDefined();
    expect(result.classIndex.classes["card"]).toBeDefined();
    expect(result.classIndex.classes["log-entry"]).toBeDefined();
    expect(result.classIndex.classes["box-transition"]).toBeDefined();
    expect(result.classIndex.classes["filter-bg"]).toBeDefined();
    expect(result.classIndex.classes["glass-box"]).toBeDefined();
    expect(result.classIndex.classes["var-box"]).toBeDefined();

    // Both @keyframes should be in the keyframes output
    expect(result.keyframes).toContain("@keyframes fadeIn");
    expect(result.keyframes).toContain("@keyframes gradient-anim");
  });
});

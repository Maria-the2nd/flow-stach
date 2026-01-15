import assert from "assert";
import {
  hasGradientTransformConflict,
  detectGradientTransformConflicts,
  decoupleGradientsFromTransforms,
} from "../lib/gradient-transform-decoupler";

/**
 * Unit tests for gradient-transform decoupler
 */
async function run() {
  console.log("[gradient-transform-decoupler.test] Running tests...");

  // Test 1: hasGradientTransformConflict detection
  console.log("  ✓ Testing hasGradientTransformConflict...");
  
  assert.strictEqual(
    hasGradientTransformConflict("background: linear-gradient(red, blue); transform: scale(1.05);"),
    true,
    "Should detect gradient + transform combination"
  );

  assert.strictEqual(
    hasGradientTransformConflict("background: linear-gradient(red, blue);"),
    false,
    "Should not detect gradient-only"
  );

  assert.strictEqual(
    hasGradientTransformConflict("transform: scale(1.05);"),
    false,
    "Should not detect transform-only"
  );

  assert.strictEqual(
    hasGradientTransformConflict("background: linear-gradient(red, blue); will-change: transform;"),
    true,
    "Should detect will-change as transform indicator"
  );

  assert.strictEqual(
    hasGradientTransformConflict("background: linear-gradient(red, blue); transition: transform 0.3s;"),
    true,
    "Should detect transition as transform indicator"
  );

  // Test 2: detectGradientTransformConflicts
  console.log("  ✓ Testing detectGradientTransformConflicts...");

  const css1 = `.card { 
    background: linear-gradient(red, blue); 
    transform: scale(1.05); 
  }`;
  const conflicts1 = detectGradientTransformConflicts(css1);
  assert.strictEqual(conflicts1.length, 1, "Should detect one conflict");
  assert.strictEqual(conflicts1[0].className, "card", "Should identify correct class");
  assert.strictEqual(conflicts1[0].hasGradient, true, "Should detect gradient");
  assert.strictEqual(conflicts1[0].hasTransform, true, "Should detect transform");

  const css2 = `.card { background: linear-gradient(red, blue); }`;
  const conflicts2 = detectGradientTransformConflicts(css2);
  assert.strictEqual(conflicts2.length, 0, "Should ignore gradient-only elements");

  const css3 = `.card { transform: scale(1.05); }`;
  const conflicts3 = detectGradientTransformConflicts(css3);
  assert.strictEqual(conflicts3.length, 0, "Should ignore transform-only elements");

  const css4 = `.card { 
    background: linear-gradient(red, blue); 
    will-change: transform; 
  }`;
  const conflicts4 = detectGradientTransformConflicts(css4);
  assert.strictEqual(conflicts4.length, 1, "Should detect will-change as transform indicator");
  assert.strictEqual(conflicts4[0].hasWillChange, true, "Should flag will-change");

  // Test 3: decoupleGradientsFromTransforms - basic functionality
  console.log("  ✓ Testing decoupleGradientsFromTransforms - basic...");

  const html1 = '<div class="card">Content</div>';
  const css5 = `.card { 
    background: linear-gradient(red, blue); 
    transform: scale(1.05); 
  }`;
  const result1 = decoupleGradientsFromTransforms(html1, css5);
  
  assert.strictEqual(result1.rewriteCount, 1, "Should rewrite one element");
  assert.strictEqual(result1.decoupledClasses.length, 1, "Should decouple one class");
  assert.strictEqual(result1.decoupledClasses[0], "card", "Should decouple correct class");
  assert(result1.html.includes("card-bg"), "Should create card-bg element");
  assert(result1.css.includes(".card-bg"), "Should create card-bg CSS rule");
  assert(result1.css.includes("position: relative"), "Parent should have position: relative");
  assert(result1.css.includes("position: absolute"), "Child should have position: absolute");
  assert(result1.css.includes("inset: 0"), "Child should have inset: 0");

  // Test 4: Preserve original children
  console.log("  ✓ Testing decoupleGradientsFromTransforms - preserve children...");

  const html2 = '<div class="card"><span>Text</span><p>Paragraph</p></div>';
  const css6 = `.card { 
    background: linear-gradient(red, blue); 
    transform: scale(1.05); 
  }`;
  const result2 = decoupleGradientsFromTransforms(html2, css6);
  
  assert(result2.html.includes("<span>Text</span>"), "Should preserve span child");
  assert(result2.html.includes("<p>Paragraph</p>"), "Should preserve p child");

  // Test 5: Multiple classes
  console.log("  ✓ Testing decoupleGradientsFromTransforms - multiple classes...");

  const html3 = '<div class="card"><div class="button">Button</div></div>';
  const css7 = `.card { 
    background: linear-gradient(red, blue); 
    transform: scale(1.05); 
  }
  .button {
    background: linear-gradient(green, yellow);
    transform: rotate(45deg);
  }`;
  const result3 = decoupleGradientsFromTransforms(html3, css7);
  
  assert.strictEqual(result3.rewriteCount, 2, "Should rewrite two elements");
  assert.strictEqual(result3.decoupledClasses.length, 2, "Should decouple two classes");
  assert(result3.html.includes("card-bg"), "Should create card-bg");
  assert(result3.html.includes("button-bg"), "Should create button-bg");

  // Test 6: Skip pseudo-elements
  console.log("  ✓ Testing decoupleGradientsFromTransforms - skip pseudo-elements...");

  const css8 = `.card { 
    background: linear-gradient(red, blue); 
    transform: scale(1.05); 
  }
  .card::before {
    background: linear-gradient(green, yellow);
    transform: rotate(45deg);
  }`;
  const conflicts5 = detectGradientTransformConflicts(css8);
  // Should only detect .card, not .card::before
  assert.strictEqual(conflicts5.length, 1, "Should only detect base class, not pseudo-element");
  assert.strictEqual(conflicts5[0].className, "card", "Should detect correct class");

  // Test 7: Hover states
  console.log("  ✓ Testing decoupleGradientsFromTransforms - hover states...");

  const css9 = `.card { 
    background: linear-gradient(red, blue); 
    transform: scale(1.05); 
  }
  .card:hover {
    transform: scale(1.1);
  }`;
  const result4 = decoupleGradientsFromTransforms(html1, css9);
  
  // Should handle hover state
  assert(result4.css.includes(".card:hover"), "Should preserve hover selector");
  assert(result4.css.includes(".card-bg:hover"), "Should create hover for bg element");

  // Test 8: Media queries
  console.log("  ✓ Testing decoupleGradientsFromTransforms - media queries...");

  const css10 = `.card { 
    background: linear-gradient(red, blue); 
    transform: scale(1.05); 
  }
  @media (max-width: 767px) {
    .card {
      transform: scale(1.02);
    }
  }`;
  const result5 = decoupleGradientsFromTransforms(html1, css10);
  
  assert(result5.css.includes("@media"), "Should preserve media query");
  assert(result5.css.includes(".card-bg"), "Should create bg rule in media query");

  // Test 9: Avoid collision with existing -bg class
  console.log("  ✓ Testing decoupleGradientsFromTransforms - avoid collision...");

  const css11 = `.card { 
    background: linear-gradient(red, blue); 
    transform: scale(1.05); 
  }
  .card-bg {
    background-color: red;
  }`;
  const result6 = decoupleGradientsFromTransforms(html1, css11);
  
  assert.strictEqual(result6.rewriteCount, 0, "Should not rewrite if -bg class exists");
  assert.strictEqual(result6.warnings.length, 1, "Should warn about collision");
  assert(result6.warnings[0].includes("already exists"), "Warning should mention collision");

  // Test 10: Custom suffix
  console.log("  ✓ Testing decoupleGradientsFromTransforms - custom suffix...");

  const result7 = decoupleGradientsFromTransforms(html1, css5, {
    gradientLayerSuffix: "-gradient",
  });
  
  assert(result7.html.includes("card-gradient"), "Should use custom suffix");
  assert(result7.css.includes(".card-gradient"), "Should use custom suffix in CSS");

  // Test 11: Filter classes
  console.log("  ✓ Testing decoupleGradientsFromTransforms - filter classes...");

  const result8 = decoupleGradientsFromTransforms(html3, css7, {
    filterClasses: new Set(["card"]),
  });
  
  assert.strictEqual(result8.rewriteCount, 1, "Should only rewrite filtered class");
  assert.strictEqual(result8.decoupledClasses.length, 1, "Should only decouple filtered class");
  assert.strictEqual(result8.decoupledClasses[0], "card", "Should decouple correct class");

  // Test 12: No conflicts
  console.log("  ✓ Testing decoupleGradientsFromTransforms - no conflicts...");

  const css12 = `.card { background: linear-gradient(red, blue); }`;
  const result9 = decoupleGradientsFromTransforms(html1, css12);
  
  assert.strictEqual(result9.rewriteCount, 0, "Should not rewrite when no conflicts");
  assert.strictEqual(result9.decoupledClasses.length, 0, "Should not decouple any classes");

  // Test 13: Multiple gradient properties
  console.log("  ✓ Testing decoupleGradientsFromTransforms - multiple gradient properties...");

  const css13 = `.card { 
    background-image: linear-gradient(red, blue);
    background-size: cover;
    background-position: center;
    transform: scale(1.05); 
  }`;
  const result10 = decoupleGradientsFromTransforms(html1, css13);
  
  assert(result10.css.includes("background-image"), "Should preserve background-image");
  assert(result10.css.includes("background-size"), "Should preserve background-size");
  assert(result10.css.includes("background-position"), "Should preserve background-position");

  // Test 14: Shared properties (border-radius)
  console.log("  ✓ Testing decoupleGradientsFromTransforms - shared properties...");

  const css14 = `.card { 
    background: linear-gradient(red, blue);
    transform: scale(1.05);
    border-radius: 8px;
  }`;
  const result11 = decoupleGradientsFromTransforms(html1, css14);
  
  assert(result11.css.includes("border-radius: 8px"), "Should preserve border-radius on bg element");

  console.log("[gradient-transform-decoupler.test] All tests passed! ✓");
}

run().catch((error) => {
  console.error("[gradient-transform-decoupler.test] Test failed:", error);
  process.exit(1);
});

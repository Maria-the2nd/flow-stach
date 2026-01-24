/**
 * CSS Minifier - Example Usage
 *
 * Demonstrates how CSS minification reduces embed block size
 */

import { minifyCSS, minifyCSSWithStats, getMinificationStats, checkSizeLimit } from "./css-minifier";

// ============================================
// EXAMPLE 1: Basic Minification
// ============================================

const exampleCSS = `
/* Hero Section Styles */
.hero::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.5),
    rgba(0, 0, 0, 0.7)
  );
}

.hero::after {
  content: "→";
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.9);
}

/* Animations */
@keyframes slideIn {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* CSS Variables */
:root {
  --primary-color: #3b82f6;
  --secondary-color: #8b5cf6;
  --spacing-unit: 1rem;
}
`;

console.log("=== CSS MINIFICATION EXAMPLE ===\n");

console.log("BEFORE (formatted CSS):");
console.log(exampleCSS);
console.log("\n" + "=".repeat(50) + "\n");

const minified = minifyCSS(exampleCSS);

console.log("AFTER (minified CSS):");
console.log(minified);
console.log("\n" + "=".repeat(50) + "\n");

// ============================================
// EXAMPLE 2: Size Reduction Statistics
// ============================================

const stats = getMinificationStats(exampleCSS, minified);

console.log("SIZE REDUCTION STATS:");
console.log(`  Original size:  ${stats.originalSize} bytes`);
console.log(`  Minified size:  ${stats.minifiedSize} bytes`);
console.log(`  Saved:          ${stats.savedBytes} bytes (${stats.savedPercent}%)`);
console.log("\n" + "=".repeat(50) + "\n");

// ============================================
// EXAMPLE 3: Size Limit Checking
// ============================================

const sizeCheck = checkSizeLimit(minified);

console.log("SIZE LIMIT CHECK:");
console.log(`  Size: ${sizeCheck.size} bytes`);
console.log(`  Exceeds 10KB soft limit: ${sizeCheck.exceedsSoftLimit}`);
console.log(`  Exceeds 100KB hard limit: ${sizeCheck.exceedsHardLimit}`);
if (sizeCheck.warning) {
  console.log(`  Warning: ${sizeCheck.warning}`);
}
console.log("\n" + "=".repeat(50) + "\n");

// ============================================
// EXAMPLE 4: minifyCSSWithStats Usage
// ============================================

const statsResult = minifyCSSWithStats(exampleCSS);

console.log("MINIFY WITH STATS (one-step minification):");
console.log(`  Original size:  ${statsResult.stats.originalSize} bytes`);
console.log(`  Minified size:  ${statsResult.stats.minifiedSize} bytes`);
console.log(`  Reduction:      ${statsResult.stats.reduction} bytes`);
console.log(`  Percentage:     ${statsResult.stats.reductionPercent}%`);
console.log("\n" + "=".repeat(50) + "\n");

// ============================================
// EXAMPLE 5: Custom Minification Options
// ============================================

// Keep comments (useful for debugging)
const minifiedWithComments = minifyCSS(exampleCSS, {
  removeComments: false,
  removeWhitespace: true,
});

console.log("CUSTOM OPTIONS (keep comments):");
console.log(minifiedWithComments.substring(0, 200) + '...');
console.log("\n" + "=".repeat(50) + "\n");

// ============================================
// EXAMPLE 6: Real-world Use Case
// ============================================

console.log("\n" + "=".repeat(50) + "\n");
console.log("REAL-WORLD USE CASE:");
console.log("When embedding CSS in Webflow, you have character limits:");
console.log("  - Soft limit: ~10KB (performance recommendation)");
console.log("  - Hard limit: ~100KB (Webflow limitation)");
console.log("\nMinification helps you:");
console.log("  1. Stay within character limits");
console.log("  2. Improve page load performance");
console.log("  3. Reduce bandwidth usage");
console.log("\nThe CSS embed router automatically minifies all embed CSS.");

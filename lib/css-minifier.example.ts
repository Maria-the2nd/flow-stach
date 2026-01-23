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
// EXAMPLE 4: Custom Minification Options
// ============================================

// Remove whitespace but keep comments (useful for debugging)
const minifiedWithComments = minifyCSS(exampleCSS, {
  removeComments: false,
  removeWhitespace: true,
  preserveCommaSpace: true,
});

console.log("CUSTOM OPTIONS (keep comments):");
console.log(minifiedWithComments);
console.log("\n" + "=".repeat(50) + "\n");

// Remove space after commas for maximum compression
const maxMinified = minifyCSS(exampleCSS, {
  removeComments: true,
  removeWhitespace: true,
  preserveCommaSpace: false, // Remove all spaces after commas
});

console.log("MAXIMUM COMPRESSION (no comma spacing):");
console.log(maxMinified);
console.log("\n" + "=".repeat(50) + "\n");

const maxStats = getMinificationStats(exampleCSS, maxMinified);
console.log("MAXIMUM COMPRESSION STATS:");
console.log(`  Saved: ${maxStats.savedBytes} bytes (${maxStats.savedPercent}%)`);

// ============================================
// EXAMPLE 5: Real-world Use Case
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

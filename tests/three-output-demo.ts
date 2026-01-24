/**
 * Three-Output System Demo
 *
 * Run this with: bun run tests/three-output-demo.ts
 *
 * Demonstrates the three outputs produced by the converter:
 * 1. Webflow JSON (structure + native styles)
 * 2. CSS Embed Block (pseudo-elements, keyframes, etc.)
 * 3. JS Embed Block (CDN scripts + user code)
 */

import { convertSectionToWebflow } from '../lib/webflow-converter';
import type { DetectedSection } from '../lib/html-parser';

// Demo: Complex hero section with all three outputs
const demoSection: DetectedSection = {
  name: 'Hero',
  className: 'hero',
  id: 'hero',
  htmlContent: `
    <div class="hero">
      <h1 class="hero-title">Welcome to Flow Bridge</h1>
      <p class="hero-subtitle">Convert any HTML to Webflow in seconds</p>
      <button class="hero-cta">Get Started</button>
    </div>
  `,
  cssContent: `
    :root {
      --hero-bg: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      --hero-text: #ffffff;
      --cta-color: #ff6b6b;
    }

    .hero {
      background: var(--hero-bg);
      padding: 4rem 2rem;
      text-align: center;
      position: relative;
    }

    .hero::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 70%);
      pointer-events: none;
    }

    .hero-title {
      color: var(--hero-text);
      font-size: 3rem;
      font-weight: 700;
      margin-bottom: 1rem;
    }

    .hero-subtitle {
      color: rgba(255,255,255,0.9);
      font-size: 1.25rem;
      margin-bottom: 2rem;
    }

    .hero-cta {
      background: var(--cta-color);
      color: white;
      padding: 1rem 2rem;
      border: none;
      border-radius: 8px;
      font-size: 1.125rem;
      cursor: pointer;
      transition: transform 0.3s ease;
    }

    .hero-cta:hover {
      transform: scale(1.05);
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
  jsContent: `
    // Animate hero elements on load
    gsap.from('.hero-title', {
      opacity: 0,
      y: -30,
      duration: 1,
      ease: 'power3.out'
    });

    gsap.from('.hero-subtitle', {
      opacity: 0,
      y: -20,
      duration: 1,
      delay: 0.2,
      ease: 'power3.out'
    });

    gsap.from('.hero-cta', {
      opacity: 0,
      scale: 0.8,
      duration: 0.8,
      delay: 0.4,
      ease: 'back.out(1.7)'
    });

    // Smooth scroll
    const lenis = new Lenis({ smooth: true });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
  `,
  order: 1,
};

console.log('🚀 Converting hero section with Flow Bridge...\n');

const payload = convertSectionToWebflow(demoSection);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 CONVERSION RESULTS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Output 1: Webflow JSON
console.log('1️⃣  WEBFLOW JSON');
console.log('   Purpose: Structure + native Webflow styles');
console.log('   Usage: Copy and paste into Flow-Goodies extension');
console.log(`   Nodes: ${payload.payload.nodes.length}`);
console.log(`   Styles: ${payload.payload.styles.length}`);
console.log(`   Size: ${(new Blob([JSON.stringify(payload)]).size / 1024).toFixed(2)} KB\n`);

// Output 2: CSS Embed Block
if (payload.embedCSS) {
  console.log('2️⃣  CSS EMBED BLOCK');
  console.log('   Purpose: Non-native CSS (pseudo-elements, keyframes, variables)');
  console.log('   Usage: Add HTML Embed element and paste this code');
  console.log(`   Size: ${payload.meta.embedCSSSize} bytes`);
  console.log('   Preview:');
  console.log('   ┌' + '─'.repeat(70) + '┐');

  const cssLines = payload.embedCSS.split('\n').slice(0, 15);
  cssLines.forEach(line => {
    const truncated = line.length > 66 ? line.substring(0, 63) + '...' : line;
    console.log('   │ ' + truncated.padEnd(68) + ' │');
  });

  if (payload.embedCSS.split('\n').length > 15) {
    console.log('   │ ' + '... (truncated)'.padEnd(68) + ' │');
  }

  console.log('   └' + '─'.repeat(70) + '┘\n');
} else {
  console.log('2️⃣  CSS EMBED BLOCK');
  console.log('   ❌ No embed CSS required (all styles are Webflow-native)\n');
}

// Output 3: JS Embed Block
if (payload.embedJS) {
  console.log('3️⃣  JS EMBED BLOCK');
  console.log('   Purpose: JavaScript with automatic CDN injection');
  console.log('   Usage: Add HTML Embed element and paste this code');
  console.log(`   Size: ${payload.meta.embedJSSize} bytes`);

  // Extract detected libraries from the embed
  const gsapMatch = payload.embedJS.match(/gsap/i);
  const lenisMatch = payload.embedJS.match(/lenis/i);
  const libraries = [];
  if (gsapMatch) libraries.push('GSAP');
  if (lenisMatch) libraries.push('Lenis');

  if (libraries.length > 0) {
    console.log(`   Libraries: ${libraries.join(', ')}`);
  }

  console.log('   Preview:');
  console.log('   ┌' + '─'.repeat(70) + '┐');

  const jsLines = payload.embedJS.split('\n').slice(0, 15);
  jsLines.forEach(line => {
    const truncated = line.length > 66 ? line.substring(0, 63) + '...' : line;
    console.log('   │ ' + truncated.padEnd(68) + ' │');
  });

  if (payload.embedJS.split('\n').length > 15) {
    console.log('   │ ' + '... (truncated)'.padEnd(68) + ' │');
  }

  console.log('   └' + '─'.repeat(70) + '┘\n');
} else {
  console.log('3️⃣  JS EMBED BLOCK');
  console.log('   ❌ No JavaScript required\n');
}

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ CONVERSION COMPLETE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n📋 Next Steps:');
console.log('   1. Copy Webflow JSON and paste into Flow-Goodies');
console.log('   2. Add HTML Embed element for CSS embed block');
console.log('   3. Add HTML Embed element for JS embed block');
console.log('   4. Publish and enjoy your converted component!\n');

// Validation summary
if (payload.meta.preflightValidation) {
  const validation = payload.meta.preflightValidation;
  console.log(`🔍 Validation: ${validation.isValid ? '✅ PASSED' : '⚠️  WARNINGS'}`);
  console.log(`   ${validation.summary}`);
}

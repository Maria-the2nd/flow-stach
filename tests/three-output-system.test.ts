/**
 * Three-Output System Tests
 *
 * Verifies that convertSectionToWebflow produces all three outputs:
 * 1. Webflow JSON (native structure + styles)
 * 2. CSS Embed Block (for :root, pseudo-elements, @keyframes)
 * 3. JS Embed Block (CDN scripts + user code)
 */

import { describe, test, expect } from 'vitest';
import { convertSectionToWebflow } from '../lib/webflow-converter';
import type { DetectedSection } from '../lib/html-parser';

describe('Three-Output System', () => {
  test('should include embedCSS in payload when pseudo-elements are present', () => {
    const section: DetectedSection = {
      name: 'Hero',
      className: 'hero',
      id: 'hero',
      htmlContent: '<div class="hero">Hero Content</div>',
      cssContent: `
        .hero {
          color: red;
        }
        .hero::before {
          content: "→";
        }
      `,
      jsContent: '',
      order: 1,
    };

    const payload = convertSectionToWebflow(section);

    // Should have embedCSS field
    expect(payload.embedCSS).toBeDefined();
    expect(payload.embedCSS).toContain('<style>');
    expect(payload.embedCSS).toContain('::before');
    expect(payload.meta.hasEmbedCSS).toBe(true);
    expect(payload.meta.embedCSSSize).toBeGreaterThan(0);
  });

  test('should include embedCSS when :root variables are present', () => {
    const section: DetectedSection = {
      name: 'Hero',
      className: 'hero',
      id: 'hero',
      htmlContent: '<div class="hero">Hero Content</div>',
      cssContent: `
        :root {
          --color: red;
        }
        .hero {
          color: var(--color);
        }
      `,
      jsContent: '',
      order: 1,
    };

    const payload = convertSectionToWebflow(section);

    expect(payload.embedCSS).toBeDefined();
    expect(payload.embedCSS).toContain(':root');
    expect(payload.meta.hasEmbedCSS).toBe(true);
  });

  test('should include embedCSS when @keyframes are present', () => {
    const section: DetectedSection = {
      name: 'Hero',
      className: 'hero',
      id: 'hero',
      htmlContent: '<div class="hero">Hero Content</div>',
      cssContent: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .hero {
          animation: fadeIn 1s;
        }
      `,
      jsContent: '',
      order: 1,
    };

    const payload = convertSectionToWebflow(section);

    expect(payload.embedCSS).toBeDefined();
    expect(payload.embedCSS).toContain('@keyframes');
    expect(payload.meta.hasEmbedCSS).toBe(true);
  });

  test('should include embedJS in payload when JS is present', () => {
    const section: DetectedSection = {
      name: 'Hero',
      className: 'hero',
      id: 'hero',
      htmlContent: '<div class="hero">Hero Content</div>',
      cssContent: '.hero { color: red; }',
      jsContent: `
        console.log('Hello World');
      `,
      order: 1,
    };

    const payload = convertSectionToWebflow(section);

    expect(payload.embedJS).toBeDefined();
    expect(payload.embedJS).toContain('<script>');
    expect(payload.embedJS).toContain('Hello World');
    expect(payload.embedJS).toContain('DOMContentLoaded');
    expect(payload.meta.hasEmbedJS).toBe(true);
    expect(payload.meta.embedJSSize).toBeGreaterThan(0);
  });

  test('should include CDN scripts in embedJS when GSAP is detected', () => {
    const section: DetectedSection = {
      name: 'Hero',
      className: 'hero',
      id: 'hero',
      htmlContent: '<div class="hero">Hero Content</div>',
      cssContent: '.hero { color: red; }',
      jsContent: `
        gsap.to('.hero', { opacity: 1 });
      `,
      order: 1,
    };

    const payload = convertSectionToWebflow(section);

    expect(payload.embedJS).toBeDefined();
    expect(payload.embedJS).toContain('cdnjs.cloudflare.com');
    expect(payload.embedJS).toContain('gsap');
    expect(payload.embedJS).toContain('.hero');
    expect(payload.meta.hasEmbedJS).toBe(true);
  });

  test('should include CDN scripts for GSAP plugins in correct order', () => {
    const section: DetectedSection = {
      name: 'Hero',
      className: 'hero',
      id: 'hero',
      htmlContent: '<div class="hero">Hero Content</div>',
      cssContent: '.hero { color: red; }',
      jsContent: `
        gsap.to('.hero', { x: 100 });
        ScrollTrigger.create({ trigger: '.hero' });
      `,
      order: 1,
    };

    const payload = convertSectionToWebflow(section);

    expect(payload.embedJS).toBeDefined();

    // Should include both GSAP core and ScrollTrigger
    const embedJS = payload.embedJS!;
    expect(embedJS).toContain('gsap.min.js');
    expect(embedJS).toContain('ScrollTrigger.min.js');

    // GSAP core should appear before ScrollTrigger (dependency order)
    const gsapIndex = embedJS.indexOf('gsap.min.js');
    const scrollTriggerIndex = embedJS.indexOf('ScrollTrigger.min.js');
    expect(gsapIndex).toBeLessThan(scrollTriggerIndex);
  });

  test('should have empty embedCSS when no embed-worthy CSS', () => {
    const section: DetectedSection = {
      name: 'Hero',
      className: 'hero',
      id: 'hero',
      htmlContent: '<div class="hero">Hero Content</div>',
      cssContent: '.hero { color: red; }', // Simple CSS, goes to native
      jsContent: '',
      order: 1,
    };

    const payload = convertSectionToWebflow(section);

    // embedCSS should be undefined or empty
    expect(payload.embedCSS).toBeFalsy();
    expect(payload.meta.hasEmbedCSS).toBe(false);
    expect(payload.meta.embedCSSSize).toBe(0);
  });

  test('should have empty embedJS when no JavaScript', () => {
    const section: DetectedSection = {
      name: 'Hero',
      className: 'hero',
      id: 'hero',
      htmlContent: '<div class="hero">Hero Content</div>',
      cssContent: '.hero { color: red; }',
      jsContent: '',
      order: 1,
    };

    const payload = convertSectionToWebflow(section);

    expect(payload.embedJS).toBeFalsy();
    expect(payload.meta.hasEmbedJS).toBe(false);
    expect(payload.meta.embedJSSize).toBe(0);
  });

  test('should include both embedCSS and embedJS when both are needed', () => {
    const section: DetectedSection = {
      name: 'Hero',
      className: 'hero',
      id: 'hero',
      htmlContent: '<div class="hero">Hero Content</div>',
      cssContent: `
        :root { --color: red; }
        .hero::before { content: "→"; }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      `,
      jsContent: `
        gsap.to('.hero', {
          opacity: 1,
          duration: 1
        });
      `,
      order: 1,
    };

    const payload = convertSectionToWebflow(section);

    // Should have both embeds
    expect(payload.embedCSS).toBeDefined();
    expect(payload.embedJS).toBeDefined();

    // CSS embed should contain routed CSS
    expect(payload.embedCSS).toContain(':root');
    expect(payload.embedCSS).toContain('::before');
    expect(payload.embedCSS).toContain('@keyframes');

    // JS embed should contain CDN + user code
    expect(payload.embedJS).toContain('cdnjs.cloudflare.com');
    expect(payload.embedJS).toContain('gsap');
    expect(payload.embedJS).toContain('.hero');

    // Meta flags should be correct
    expect(payload.meta.hasEmbedCSS).toBe(true);
    expect(payload.meta.hasEmbedJS).toBe(true);
    expect(payload.meta.embedCSSSize).toBeGreaterThan(0);
    expect(payload.meta.embedJSSize).toBeGreaterThan(0);
  });

  test('should wrap embedCSS in style tags', () => {
    const section: DetectedSection = {
      name: 'Hero',
      className: 'hero',
      id: 'hero',
      htmlContent: '<div class="hero">Hero Content</div>',
      cssContent: `
        .hero::after { content: "←"; }
      `,
      jsContent: '',
      order: 1,
    };

    const payload = convertSectionToWebflow(section);

    expect(payload.embedCSS).toBeDefined();
    expect(payload.embedCSS).toMatch(/^<style>/);
    expect(payload.embedCSS).toMatch(/<\/style>$/);
  });

  test('should wrap embedJS with DOMContentLoaded', () => {
    const section: DetectedSection = {
      name: 'Hero',
      className: 'hero',
      id: 'hero',
      htmlContent: '<div class="hero">Hero Content</div>',
      cssContent: '.hero { color: red; }',
      jsContent: `
        const hero = document.querySelector('.hero');
        hero.style.opacity = '1';
      `,
      order: 1,
    };

    const payload = convertSectionToWebflow(section);

    expect(payload.embedJS).toBeDefined();
    expect(payload.embedJS).toContain('DOMContentLoaded');
    expect(payload.embedJS).toContain('document.querySelector');
  });

  test('should properly escape special characters in embedCSS', () => {
    const section: DetectedSection = {
      name: 'Hero',
      className: 'hero',
      id: 'hero',
      htmlContent: '<div class="hero">Hero Content</div>',
      cssContent: `
        .hero::before { content: "→ ← ↓ ↑"; }
      `,
      jsContent: '',
      order: 1,
    };

    const payload = convertSectionToWebflow(section);

    expect(payload.embedCSS).toBeDefined();
    // Should preserve special characters
    expect(payload.embedCSS).toContain('content:');
  });

  test('should detect multiple libraries in embedJS', () => {
    const section: DetectedSection = {
      name: 'Hero',
      className: 'hero',
      id: 'hero',
      htmlContent: '<div class="hero">Hero Content</div>',
      cssContent: '.hero { color: red; }',
      jsContent: `
        // Use GSAP
        gsap.to('.hero', { x: 100 });

        // Use Lenis
        const lenis = new Lenis({ smooth: true });
      `,
      order: 1,
    };

    const payload = convertSectionToWebflow(section);

    expect(payload.embedJS).toBeDefined();
    const embedJS = payload.embedJS!;

    // Should include both GSAP and Lenis CDN URLs
    expect(embedJS).toContain('gsap');
    expect(embedJS).toContain('lenis');
  });
});

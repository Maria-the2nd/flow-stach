/**
 * JavaScript Class Reference Updating Tests
 *
 * Verifies that BEM renaming correctly updates JS references
 * including GSAP, Three.js, and other animation libraries.
 */

import { describe, it, expect } from "vitest";
import { updateJSClassReferences } from "../lib/flowbridge-semantic";

describe("JS class reference updating", () => {
  // Create a test mapping similar to what BEM renamer would produce
  const testMapping = new Map<string, string>([
    ["hero", "fp__hero"],
    ["hero-actions", "fp__hero-actions"],
    ["sticker", "fp__sticker"],
    ["bento-item", "fp__bento-item"],
    ["bento-grid", "fp__bento-grid"],
    ["faq-question", "fp__faq-question"],
    ["faq-answer", "fp__faq-answer"],
    ["card", "fp__card"],
    ["active", "fp__active"],
  ]);

  it("should update GSAP gsap.from() class selectors", () => {
    const js = `
      gsap.from(".hero p, .hero-actions", {
        duration: 1.2,
        y: 30,
        opacity: 0
      });
    `;

    const result = updateJSClassReferences(js, testMapping);

    expect(result.updated).toContain(".fp__hero ");
    expect(result.updated).toContain(".fp__hero-actions");
    expect(result.replacements).toBeGreaterThan(0);
  });

  it("should update GSAP gsap.to() class selectors", () => {
    const js = `
      gsap.to(".sticker", {
        scrollTrigger: { trigger: ".sticker" },
        yPercent: -200
      });
    `;

    const result = updateJSClassReferences(js, testMapping);

    expect(result.updated).toContain(".fp__sticker");
    expect(result.updated).not.toContain('".sticker"');
    expect(result.replacements).toBe(2); // Two occurrences
  });

  it("should update GSAP with ScrollTrigger trigger selectors", () => {
    const js = `
      gsap.from(".bento-item", {
        scrollTrigger: {
          trigger: ".bento-grid",
          start: "top 80%"
        },
        opacity: 0
      });
    `;

    const result = updateJSClassReferences(js, testMapping);

    expect(result.updated).toContain(".fp__bento-item");
    expect(result.updated).toContain(".fp__bento-grid");
    expect(result.replacements).toBe(2);
  });

  it("should update document.querySelectorAll class selectors", () => {
    const js = `
      document.querySelectorAll('.sticker').forEach(sticker => {
        gsap.to(sticker, { yPercent: -200 });
      });

      document.querySelectorAll('.faq-question').forEach(q => {
        q.addEventListener('click', () => {
          document.querySelectorAll('.faq-answer').forEach(a => a.style.maxHeight = '0px');
        });
      });
    `;

    const result = updateJSClassReferences(js, testMapping);

    expect(result.updated).toContain("'.fp__sticker'");
    expect(result.updated).toContain("'.fp__faq-question'");
    expect(result.updated).toContain("'.fp__faq-answer'");
    expect(result.replacements).toBe(3);
  });

  it("should update classList.add/remove/toggle patterns", () => {
    const js = `
      element.classList.add('active');
      element.classList.remove('hero');
      element.classList.toggle('card');
      if (element.classList.contains('sticker')) {}
    `;

    const result = updateJSClassReferences(js, testMapping);

    expect(result.updated).toContain("classList.add('fp__active')");
    expect(result.updated).toContain("classList.remove('fp__hero')");
    expect(result.updated).toContain("classList.toggle('fp__card')");
    expect(result.updated).toContain("classList.contains('fp__sticker')");
    expect(result.replacements).toBe(4);
  });

  it("should update querySelector with single class", () => {
    const js = `
      const el = document.querySelector('.card');
      const items = document.querySelectorAll('.bento-item');
    `;

    const result = updateJSClassReferences(js, testMapping);

    expect(result.updated).toContain("'.fp__card'");
    expect(result.updated).toContain("'.fp__bento-item'");
    expect(result.replacements).toBe(2);
  });

  it("should update jQuery-style selectors", () => {
    const js = `
      $('.card').addClass('active');
      $('.hero').hide();
    `;

    const result = updateJSClassReferences(js, testMapping);

    expect(result.updated).toContain("$('.fp__card')");
    expect(result.updated).toContain("$('.fp__hero')");
    expect(result.replacements).toBeGreaterThanOrEqual(2);
  });

  it("should handle complex GSAP timeline", () => {
    const js = `
      const tl = gsap.timeline();
      tl.from(".hero", { opacity: 0 })
        .from(".hero-actions", { y: 50 })
        .to(".card", { scale: 1.1 });
    `;

    const result = updateJSClassReferences(js, testMapping);

    expect(result.updated).toContain(".fp__hero");
    expect(result.updated).toContain(".fp__hero-actions");
    expect(result.updated).toContain(".fp__card");
  });

  it("should NOT update class names in unrelated string contexts", () => {
    const js = `
      console.log("Processing hero section");
      const text = "This card is active";
    `;

    const result = updateJSClassReferences(js, testMapping);

    // These should NOT be changed - they're just strings, not selectors
    expect(result.updated).toContain("Processing hero section");
    expect(result.updated).toContain("This card is active");
    expect(result.replacements).toBe(0);
  });

  it("should handle chained class selectors like .card.active", () => {
    const js = `
      document.querySelector('.card.active');
      gsap.to('.hero.active', { opacity: 1 });
    `;

    const result = updateJSClassReferences(js, testMapping);

    // Both classes in the chain should be renamed
    expect(result.updated).toContain(".fp__card");
    expect(result.updated).toContain(".fp__active");
    expect(result.updated).toContain(".fp__hero");
  });

  it("should update real-world GSAP code from flowbridge-poc", () => {
    const js = `
      gsap.registerPlugin(ScrollTrigger);

      gsap.from("#hero-title", {
        duration: 1.5,
        y: 100,
        opacity: 0
      });

      gsap.from(".hero p, .hero-actions", {
        duration: 1.2,
        y: 30,
        opacity: 0
      });

      document.querySelectorAll('.sticker').forEach(sticker => {
        gsap.to(sticker, {
          scrollTrigger: {
            trigger: sticker,
            start: "top bottom",
            scrub: 1
          },
          yPercent: -200
        });
      });

      gsap.from(".bento-item", {
        scrollTrigger: {
          trigger: ".bento-grid",
          start: "top 80%"
        },
        opacity: 0,
        stagger: 0.1
      });

      document.querySelectorAll('.faq-question').forEach(q => {
        q.addEventListener('click', () => {
          document.querySelectorAll('.faq-answer').forEach(a => a.style.maxHeight = '0px');
        });
      });
    `;

    const result = updateJSClassReferences(js, testMapping);

    console.log("\n=== Updated JS ===");
    console.log(result.updated);
    console.log(`\nTotal replacements: ${result.replacements}`);

    // Verify all class references were updated
    expect(result.updated).toContain(".fp__hero ");
    expect(result.updated).toContain(".fp__hero-actions");
    expect(result.updated).toContain("'.fp__sticker'");
    expect(result.updated).toContain(".fp__bento-item");
    expect(result.updated).toContain(".fp__bento-grid");
    expect(result.updated).toContain("'.fp__faq-question'");
    expect(result.updated).toContain("'.fp__faq-answer'");

    // ID selectors should NOT be changed
    expect(result.updated).toContain("#hero-title");

    // Should have multiple replacements
    expect(result.replacements).toBeGreaterThanOrEqual(7);
  });
});

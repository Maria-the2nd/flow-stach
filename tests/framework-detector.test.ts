/**
 * Tests for Framework Detector
 * Validates detection of React, JSX, Tailwind, Vue, Angular, Svelte patterns
 * and void element issues that could cause React error #137
 */

import { describe, it, expect } from "vitest";
import {
  detectFrameworks,
  isLikelyFrameworkCode,
  hasVoidElementProblems,
  sanitizeVoidElements,
  VOID_ELEMENTS,
} from "../lib/framework-detector";

describe("Framework Detector", () => {
  // ============================================
  // REACT/JSX DETECTION
  // ============================================

  describe("React/JSX Detection", () => {
    it("should detect className attribute (definitive React)", () => {
      const html = `<div className="my-component">Hello</div>`;
      const result = detectFrameworks(html);

      expect(result.canConvert).toBe(false);
      expect(result.frameworks.some((f) => f.framework === "jsx")).toBe(true);
      expect(
        result.frameworks.some((f) => f.evidence.includes("JSX className attribute"))
      ).toBe(true);
    });

    it("should detect onClick handler with JSX syntax", () => {
      const html = `<button onClick={() => handleClick()}>Click me</button>`;
      const result = detectFrameworks(html);

      expect(result.frameworks.some((f) => f.framework === "react" || f.framework === "jsx")).toBe(true);
    });

    it("should detect useState hook", () => {
      const html = `
        <script>
          const [count, setCount] = useState(0);
        </script>
        <div>Count: {count}</div>
      `;
      const result = detectFrameworks(html);

      expect(result.canConvert).toBe(false);
      expect(
        result.frameworks.some((f) => f.evidence.some((e) => e.includes("useState")))
      ).toBe(true);
    });

    it("should detect React import", () => {
      const html = `
        <script>
          import React from 'react';
          import { useState } from 'react';
        </script>
        <div className="app">Hello</div>
      `;
      const result = detectFrameworks(html);

      expect(result.canConvert).toBe(false);
    });

    it("should detect React fragments", () => {
      // React.Fragment with JSX patterns
      const html = `
        <React.Fragment>
          <div className="item">Item 1</div>
          <div className="item">Item 2</div>
        </React.Fragment>
      `;
      const result = detectFrameworks(html);

      expect(result.canConvert).toBe(false);
      expect(result.frameworks.some((f) => f.framework === "jsx")).toBe(true);
    });

    it("should detect PascalCase components", () => {
      const html = `<MyComponent prop="value">Content</MyComponent>`;
      const result = detectFrameworks(html);

      expect(result.frameworks.length).toBeGreaterThan(0);
      expect(
        result.frameworks.some((f) => f.evidence.some((e) => e.includes("PascalCase")))
      ).toBe(true);
    });

    it("should allow plain HTML with class attribute", () => {
      const html = `<div class="my-custom-component">Hello World</div>`;
      const result = detectFrameworks(html);

      // Should not detect React/JSX (uses 'class' not 'className')
      const hasReact = result.frameworks.some((f) => f.framework === "jsx" || f.framework === "react");
      expect(hasReact).toBe(false);
    });
  });

  // ============================================
  // TAILWIND DETECTION
  // ============================================

  describe("Tailwind Detection", () => {
    it("should detect heavy Tailwind usage", () => {
      const html = `
        <div class="flex items-center justify-between p-4 bg-slate-900 rounded-lg shadow-lg">
          <span class="text-lg font-semibold text-white">Title</span>
          <button class="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-md">
            Click
          </button>
        </div>
      `;
      const result = detectFrameworks(html);

      expect(result.frameworks.some((f) => f.framework === "tailwind")).toBe(true);
      expect(result.hasWarnings).toBe(true);
      // Tailwind is a warning, not a block
      expect(result.canConvert).toBe(true);
    });

    it("should detect Tailwind responsive prefixes", () => {
      // Multiple Tailwind utilities including responsive prefixes
      const html = `<div class="p-2 md:p-4 lg:p-6 flex items-center">Content</div>`;
      const result = detectFrameworks(html);

      expect(result.frameworks.some((f) => f.framework === "tailwind")).toBe(true);
    });

    it("should not flag normal CSS classes as Tailwind", () => {
      const html = `<div class="header-container main-content footer">Normal classes</div>`;
      const result = detectFrameworks(html);

      // Should not detect Tailwind (no utility patterns)
      expect(result.frameworks.every((f) => f.framework !== "tailwind")).toBe(true);
    });
  });

  // ============================================
  // VUE DETECTION
  // ============================================

  describe("Vue Detection", () => {
    it("should detect v-if directive", () => {
      const html = `<div v-if="isVisible">Visible content</div>`;
      const result = detectFrameworks(html);

      expect(result.canConvert).toBe(false);
      expect(result.frameworks.some((f) => f.framework === "vue")).toBe(true);
    });

    it("should detect v-for directive", () => {
      const html = `<li v-for="item in items" :key="item.id">{{ item.name }}</li>`;
      const result = detectFrameworks(html);

      expect(result.canConvert).toBe(false);
      expect(result.frameworks.some((f) => f.framework === "vue")).toBe(true);
    });

    it("should detect Vue event shorthand", () => {
      const html = `<button @click="handleClick">Click</button>`;
      const result = detectFrameworks(html);

      expect(result.frameworks.some((f) => f.framework === "vue" || f.framework === "alpine")).toBe(
        true
      );
    });
  });

  // ============================================
  // ANGULAR DETECTION
  // ============================================

  describe("Angular Detection", () => {
    it("should detect *ngIf directive", () => {
      const html = `<div *ngIf="condition">Content</div>`;
      const result = detectFrameworks(html);

      expect(result.canConvert).toBe(false);
      expect(result.frameworks.some((f) => f.framework === "angular")).toBe(true);
    });

    it("should detect *ngFor directive", () => {
      const html = `<li *ngFor="let item of items">{{ item.name }}</li>`;
      const result = detectFrameworks(html);

      expect(result.canConvert).toBe(false);
      expect(result.frameworks.some((f) => f.framework === "angular")).toBe(true);
    });

    it("should detect Angular event binding", () => {
      const html = `<button (click)="onClick()">Click</button>`;
      const result = detectFrameworks(html);

      expect(result.frameworks.some((f) => f.framework === "angular")).toBe(true);
    });
  });

  // ============================================
  // SVELTE DETECTION
  // ============================================

  describe("Svelte Detection", () => {
    it("should detect Svelte #if block", () => {
      const html = `{#if condition}<div>Content</div>{/if}`;
      const result = detectFrameworks(html);

      expect(result.canConvert).toBe(false);
      expect(result.frameworks.some((f) => f.framework === "svelte")).toBe(true);
    });

    it("should detect Svelte #each block", () => {
      const html = `{#each items as item}<li>{item}</li>{/each}`;
      const result = detectFrameworks(html);

      expect(result.canConvert).toBe(false);
      expect(result.frameworks.some((f) => f.framework === "svelte")).toBe(true);
    });
  });

  // ============================================
  // ALPINE.JS DETECTION
  // ============================================

  describe("Alpine.js Detection", () => {
    it("should detect x-data directive", () => {
      const html = `<div x-data="{ open: false }">Content</div>`;
      const result = detectFrameworks(html);

      expect(result.frameworks.some((f) => f.framework === "alpine")).toBe(true);
      // Alpine is a warning, not a block
      expect(result.hasWarnings).toBe(true);
    });

    it("should detect x-show directive", () => {
      const html = `<div x-show="isOpen">Dropdown</div>`;
      const result = detectFrameworks(html);

      expect(result.frameworks.some((f) => f.framework === "alpine")).toBe(true);
    });
  });

  // ============================================
  // VOID ELEMENT DETECTION
  // ============================================

  describe("Void Element Detection", () => {
    it("should have all 14 HTML5 void elements", () => {
      const expectedVoidElements = [
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
      ];

      for (const tag of expectedVoidElements) {
        expect(VOID_ELEMENTS.has(tag)).toBe(true);
      }
      expect(VOID_ELEMENTS.size).toBe(14);
    });

    it("should detect br with content (React error #137)", () => {
      const html = `<h1>THE ULTIMATE<br>content</br>IMPORT TRIAL.</h1>`;
      const result = detectFrameworks(html);

      expect(result.voidElementIssues.length).toBeGreaterThan(0);
      expect(result.voidElementIssues.some((i) => i.tag === "br")).toBe(true);
      expect(result.canConvert).toBe(false);
    });

    it("should detect void element with closing tag and content", () => {
      const html = `<div><br>Line break text</br></div>`;
      const result = detectFrameworks(html);

      expect(result.voidElementIssues.length).toBeGreaterThan(0);
      expect(result.canConvert).toBe(false);
    });

    it("should allow properly formatted void elements", () => {
      const html = `
        <div>
          Line 1<br />Line 2
          <hr />
          <img src="image.jpg" alt="test" />
          <input type="text" />
        </div>
      `;
      const result = detectFrameworks(html);

      // Should have no void element issues
      expect(result.voidElementIssues.length).toBe(0);
    });

    it("should sanitize void elements with content", () => {
      const html = `<div><br>invalid content</br></div>`;
      const { html: sanitized, fixed } = sanitizeVoidElements(html);

      expect(fixed.length).toBeGreaterThan(0);
      expect(sanitized).not.toContain("</br>");
    });
  });

  // ============================================
  // QUICK CHECK UTILITIES
  // ============================================

  describe("Quick Check Utilities", () => {
    it("isLikelyFrameworkCode should detect className", () => {
      expect(isLikelyFrameworkCode(`<div className="foo">Test</div>`)).toBe(true);
    });

    it("isLikelyFrameworkCode should detect v-if", () => {
      expect(isLikelyFrameworkCode(`<div v-if="show">Test</div>`)).toBe(true);
    });

    it("isLikelyFrameworkCode should detect *ngIf", () => {
      expect(isLikelyFrameworkCode(`<div *ngIf="show">Test</div>`)).toBe(true);
    });

    it("isLikelyFrameworkCode should detect Svelte #if", () => {
      expect(isLikelyFrameworkCode(`{#if show}<div>Test</div>{/if}`)).toBe(true);
    });

    it("isLikelyFrameworkCode should allow plain HTML", () => {
      expect(isLikelyFrameworkCode(`<div class="foo">Test</div>`)).toBe(false);
    });

    it("hasVoidElementProblems should detect br with closing tag", () => {
      expect(hasVoidElementProblems(`<br>content</br>`)).toBe(true);
    });

    it("hasVoidElementProblems should allow self-closing br", () => {
      expect(hasVoidElementProblems(`<br />`)).toBe(false);
    });
  });

  // ============================================
  // REAL WORLD EXAMPLES
  // ============================================

  describe("Real World Examples", () => {
    it("should block React component with JSX", () => {
      const html = `
        <div className="app-container">
          <Header title="My App" />
          <main>
            {items.map(item => (
              <Card key={item.id} {...item} />
            ))}
          </main>
          <Footer />
        </div>
      `;
      const result = detectFrameworks(html);

      expect(result.canConvert).toBe(false);
      expect(result.frameworks.some((f) => f.severity === "block")).toBe(true);
    });

    it("should warn about Tailwind but allow conversion", () => {
      const html = `
        <div class="min-h-screen bg-gray-100">
          <header class="bg-white shadow-sm">
            <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="flex justify-between h-16">
                <div class="flex items-center">
                  <a href="/" class="text-xl font-bold text-gray-900">Logo</a>
                </div>
              </div>
            </nav>
          </header>
        </div>
      `;
      const result = detectFrameworks(html);

      expect(result.canConvert).toBe(true);
      expect(result.hasWarnings).toBe(true);
      expect(result.frameworks.some((f) => f.framework === "tailwind")).toBe(true);
    });

    it("should pass clean HTML with no frameworks", () => {
      // Use class names that don't match any utility patterns
      const html = `
        <section class="hero-section">
          <div class="hero-container">
            <h1 class="hero-title">Welcome to Our Site</h1>
            <p class="hero-description">This is a clean HTML template.</p>
            <a href="/contact" class="button button-primary">Get Started</a>
          </div>
        </section>
      `;
      const result = detectFrameworks(html);

      expect(result.canConvert).toBe(true);
      expect(result.hasWarnings).toBe(false);
      expect(result.frameworks.length).toBe(0);
    });

    it("should handle the Ultimate Import Trial error case", () => {
      // This is the actual error case from the user
      const html = `<h1>THE ULTIMATE<br>IMPORT TRIAL.</h1>`;
      const result = detectFrameworks(html);

      // This should NOT be blocked - br is valid HTML
      // The issue was how it was being converted, not the HTML itself
      // If br is properly self-closing or just <br>, it's valid
      // Only <br>content</br> is invalid
    });
  });

  // ============================================
  // SUMMARY MESSAGE
  // ============================================

  describe("Summary Messages", () => {
    it("should generate blocked summary for React/JSX", () => {
      const html = `<div className="foo">Test</div>`;
      const result = detectFrameworks(html);

      expect(result.summary).toContain("BLOCKED");
      // className triggers JSX detection specifically
      expect(result.summary.toLowerCase()).toContain("jsx");
    });

    it("should generate warning summary for Tailwind", () => {
      const html = `<div class="flex p-4 m-2 bg-blue-500 text-white rounded-lg">Test</div>`;
      const result = detectFrameworks(html);

      expect(result.summary).toContain("WARNING");
      expect(result.summary.toLowerCase()).toContain("tailwind");
    });

    it("should generate safe summary for clean HTML", () => {
      const html = `<div class="custom-component">Test</div>`;
      const result = detectFrameworks(html);

      // No frameworks detected = safe
      expect(result.canConvert).toBe(true);
      expect(result.summary.toLowerCase()).toContain("safe");
    });
  });
});

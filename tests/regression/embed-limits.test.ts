import { describe, it, expect } from 'vitest';
import { ensureWebflowPasteSafety } from '@/lib/webflow-safety-gate';
import { createMinimalPayload } from '../fixtures/fixture-loader';

describe('Embed Size Limits', () => {
  const generateCSS = (sizeInKB: number): string => {
    const targetSize = sizeInKB * 1024;
    const ruleTemplate = '.class-XXXX { color: red; padding: 10px; margin: 5px; }\n';
    const rulesNeeded = Math.ceil(targetSize / ruleTemplate.length);
    return Array.from({ length: rulesNeeded }, (_, i) =>
      ruleTemplate.replace('XXXX', String(i).padStart(4, '0'))
    ).join('');
  };

  const generateJS = (sizeInKB: number): string => {
    const targetSize = sizeInKB * 1024;
    const statementTemplate = 'var variable_XXXX = "some value here";\n';
    const statementsNeeded = Math.ceil(targetSize / statementTemplate.length);
    return Array.from({ length: statementsNeeded }, (_, i) =>
      statementTemplate.replace('XXXX', String(i).padStart(4, '0'))
    ).join('');
  };

  const generateHTML = (sizeInKB: number): string => {
    const targetSize = sizeInKB * 1024;
    const elementTemplate = '<div class="item-XXXX">Content here</div>\n';
    const elementsNeeded = Math.ceil(targetSize / elementTemplate.length);
    return Array.from({ length: elementsNeeded }, (_, i) =>
      elementTemplate.replace('XXXX', String(i).padStart(4, '0'))
    ).join('');
  };

  describe('CSS Embed Limits', () => {
    it('should allow CSS embeds under 40KB without warnings', () => {
      const cssEmbed = generateCSS(30); // 30KB

      const result = ensureWebflowPasteSafety({
        payload: createMinimalPayload(),
        cssEmbed,
      });

      expect(result.report.blocked).toBe(false);

      const hasCSSWarning = result.report.warnings.some(
        (w) => w.toLowerCase().includes('css') && w.toLowerCase().includes('embed')
      );
      expect(hasCSSWarning).toBe(false);
    });

    it('should warn about CSS embeds between 40KB-50KB (soft limit)', () => {
      const cssEmbed = generateCSS(45); // 45KB

      const result = ensureWebflowPasteSafety({
        payload: createMinimalPayload(),
        cssEmbed,
      });

      expect(result.report.blocked).toBe(false);

      const hasCSSWarning = result.report.warnings.some(
        (w) => w.toLowerCase().includes('css') && w.toLowerCase().includes('embed')
      );
      expect(hasCSSWarning).toBe(true);
    });

    it('should handle CSS embeds over 50KB (hard limit)', () => {
      const cssEmbed = generateCSS(55); // 55KB

      const result = ensureWebflowPasteSafety({
        payload: createMinimalPayload(),
        cssEmbed,
      });

      // Should either block or provide chunking
      const isHandled =
        result.report.blocked ||
        result.report.warnings.some((w) => w.toLowerCase().includes('chunk'));

      expect(isHandled).toBe(true);
    });
  });

  describe('JS Embed Limits', () => {
    it('should allow JS embeds under 40KB without warnings', () => {
      const jsEmbed = generateJS(30); // 30KB

      const result = ensureWebflowPasteSafety({
        payload: createMinimalPayload(),
        jsEmbed,
      });

      expect(result.report.blocked).toBe(false);

      const hasJSWarning = result.report.warnings.some(
        (w) => w.toLowerCase().includes('js') && w.toLowerCase().includes('embed')
      );
      expect(hasJSWarning).toBe(false);
    });

    it('should warn about JS embeds between 40KB-50KB (soft limit)', () => {
      const jsEmbed = generateJS(45); // 45KB

      const result = ensureWebflowPasteSafety({
        payload: createMinimalPayload(),
        jsEmbed,
      });

      expect(result.report.blocked).toBe(false);

      const hasJSWarning = result.report.warnings.some(
        (w) => w.toLowerCase().includes('js') && w.toLowerCase().includes('embed')
      );
      expect(hasJSWarning).toBe(true);
    });

    it('should handle JS embeds over 50KB (hard limit)', () => {
      const jsEmbed = generateJS(55); // 55KB

      const result = ensureWebflowPasteSafety({
        payload: createMinimalPayload(),
        jsEmbed,
      });

      const isHandled =
        result.report.blocked ||
        result.report.warnings.some((w) => w.toLowerCase().includes('chunk'));

      expect(isHandled).toBe(true);
    });
  });

  describe('HTML Embed Limits', () => {
    it('should allow HTML embeds under 40KB without warnings', () => {
      const htmlEmbed = generateHTML(30); // 30KB

      const result = ensureWebflowPasteSafety({
        payload: createMinimalPayload(),
        htmlEmbed,
      });

      expect(result.report.blocked).toBe(false);

      const hasHTMLWarning = result.report.warnings.some(
        (w) => w.toLowerCase().includes('html') && w.toLowerCase().includes('embed')
      );
      expect(hasHTMLWarning).toBe(false);
    });

    it('should warn about HTML embeds between 40KB-50KB (soft limit)', () => {
      const htmlEmbed = generateHTML(45); // 45KB

      const result = ensureWebflowPasteSafety({
        payload: createMinimalPayload(),
        htmlEmbed,
      });

      expect(result.report.blocked).toBe(false);

      const hasHTMLWarning = result.report.warnings.some(
        (w) => w.toLowerCase().includes('html') && w.toLowerCase().includes('embed')
      );
      expect(hasHTMLWarning).toBe(true);
    });

    it('should handle HTML embeds over 50KB (hard limit)', () => {
      const htmlEmbed = generateHTML(55); // 55KB

      const result = ensureWebflowPasteSafety({
        payload: createMinimalPayload(),
        htmlEmbed,
      });

      const isHandled =
        result.report.blocked ||
        result.report.warnings.some((w) => w.toLowerCase().includes('chunk'));

      expect(isHandled).toBe(true);
    });
  });

  describe('Combined Embed Sizes', () => {
    it('should handle multiple embeds within limits', () => {
      const cssEmbed = generateCSS(25); // 25KB
      const jsEmbed = generateJS(25); // 25KB

      const result = ensureWebflowPasteSafety({
        payload: createMinimalPayload(),
        cssEmbed,
        jsEmbed,
      });

      expect(result.report.blocked).toBe(false);
    });

    it('should warn when multiple embeds exceed soft limits', () => {
      const cssEmbed = generateCSS(45); // 45KB
      const jsEmbed = generateJS(45); // 45KB

      const result = ensureWebflowPasteSafety({
        payload: createMinimalPayload(),
        cssEmbed,
        jsEmbed,
      });

      expect(result.report.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Exact Boundary Testing', () => {
    it('should handle exactly 40KB (soft limit boundary)', () => {
      const cssEmbed = generateCSS(40); // Exactly 40KB

      const result = ensureWebflowPasteSafety({
        payload: createMinimalPayload(),
        cssEmbed,
      });

      expect(result.report.blocked).toBe(false);
    });

    it('should handle exactly 50KB (hard limit boundary)', () => {
      const cssEmbed = generateCSS(50); // Exactly 50KB

      const result = ensureWebflowPasteSafety({
        payload: createMinimalPayload(),
        cssEmbed,
      });

      // At exactly 50KB, should trigger warning or chunking
      const isHandled =
        result.report.warnings.length > 0 ||
        result.report.blocked;

      expect(isHandled).toBe(true);
    });
  });
});

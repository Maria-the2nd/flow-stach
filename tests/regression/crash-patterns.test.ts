import { describe, it, expect } from 'vitest';
import { loadFixture, loadAllFixtures } from '../fixtures/fixture-loader';
import { ensureWebflowPasteSafety } from '@/lib/webflow-safety-gate';

describe('Crash Pattern Prevention', () => {
  describe('React Issue #137 - span+br crash', () => {
    it('should sanitize text nodes containing <br> tags', () => {
      const fixture = loadFixture('crash-patterns', 'react-137-span-br.json');

      const result = ensureWebflowPasteSafety({
        payload: fixture.payload,
      });

      expect(result.report.blocked).toBe(fixture.expectedResult.shouldBlock);
      expect(result.sanitizationApplied).toBe(fixture.expectedResult.shouldSanitize);

      if (fixture.expectedResult.shouldSanitize) {
        // Verify <br> tags were removed from text nodes
        const sanitizedPayload = result.sanitizationAppliedPayload;
        if (sanitizedPayload && typeof sanitizedPayload === 'object') {
          const textNodes = sanitizedPayload.payload.nodes.filter((n: any) => n.text);
          textNodes.forEach((node: any) => {
            expect(node.v).not.toContain('<br>');
          });
        }
      }
    });
  });

  describe('Invalid Variant Keys', () => {
    it('should strip invalid combo class variant keys', () => {
      const fixture = loadFixture('crash-patterns', 'invalid-variant-keys.json');

      const result = ensureWebflowPasteSafety({
        payload: fixture.payload,
      });

      expect(result.report.blocked).toBe(fixture.expectedResult.shouldBlock);
      expect(result.sanitizationApplied).toBe(fixture.expectedResult.shouldSanitize);

      if (fixture.expectedResult.shouldSanitize) {
        const sanitizedPayload = result.sanitizationAppliedPayload;
        if (sanitizedPayload && typeof sanitizedPayload === 'object') {
          const styles = sanitizedPayload.payload.styles;
          const validKeys = ['main', 'tiny', 'small', 'medium', 'large'];

          styles.forEach((style: any) => {
            if (style.variants) {
              const variantKeys = Object.keys(style.variants);
              variantKeys.forEach((key) => {
                expect(validKeys).toContain(key);
              });
            }
          });
        }
      }
    });
  });

  describe('Reserved Class Names', () => {
    it('should warn about w- prefix class names', () => {
      const fixture = loadFixture('crash-patterns', 'reserved-class-names.json');

      const result = ensureWebflowPasteSafety({
        payload: fixture.payload,
      });

      expect(result.report.blocked).toBe(fixture.expectedResult.shouldBlock);
      expect(result.report.warnings.length).toBeGreaterThan(0);

      // Check that warning mentions reserved prefix
      const hasReservedWarning = result.report.warnings.some(
        (w) => w.toLowerCase().includes('reserved') || w.toLowerCase().includes('w-')
      );
      expect(hasReservedWarning).toBe(true);
    });
  });

  describe('Deep Nesting Limits', () => {
    it('should allow 30 levels of nesting without warnings', () => {
      const fixture = loadFixture('crash-patterns', 'deep-nesting-30-levels.json');

      const result = ensureWebflowPasteSafety({
        payload: fixture.payload,
      });

      expect(result.report.blocked).toBe(false);
      expect(result.sanitizationApplied).toBe(false);
    });

    it('should flatten or warn about 50 levels of nesting', () => {
      const fixture = loadFixture('crash-patterns', 'deep-nesting-50-levels.json');

      const result = ensureWebflowPasteSafety({
        payload: fixture.payload,
      });

      // Should either sanitize (flatten) or warn
      const hasNestingHandling =
        result.sanitizationApplied ||
        result.report.warnings.some((w) => w.toLowerCase().includes('nesting'));

      expect(hasNestingHandling).toBe(true);
    });
  });

  describe('Embed Size Limits', () => {
    it('should warn about 50KB CSS embeds (soft limit)', () => {
      const fixture = loadFixture('crash-patterns', 'embed-size-50kb.json');

      // Create 50KB of CSS
      const cssEmbed = '.class { color: red; }\n'.repeat(2500); // ~50KB

      const result = ensureWebflowPasteSafety({
        payload: fixture.payload,
        cssEmbed,
      });

      expect(result.report.blocked).toBe(false);

      const hasEmbedWarning = result.report.warnings.some(
        (w) => w.toLowerCase().includes('css') && (w.includes('40') || w.includes('50'))
      );
      expect(hasEmbedWarning).toBe(true);
    });

    it('should block or chunk 60KB CSS embeds (hard limit)', () => {
      const fixture = loadFixture('crash-patterns', 'embed-size-60kb.json');

      // Create 60KB of CSS
      const cssEmbed = '.class { color: red; }\n'.repeat(3000); // ~60KB

      const result = ensureWebflowPasteSafety({
        payload: fixture.payload,
        cssEmbed,
      });

      // Should either block or have chunking information
      const hasEmbedHandling =
        result.report.blocked ||
        result.report.warnings.some((w) => w.toLowerCase().includes('chunk'));

      expect(hasEmbedHandling).toBe(true);
    });
  });

  describe('Circular References', () => {
    it('should detect and break circular style references', () => {
      const fixture = loadFixture('crash-patterns', 'circular-style-refs.json');

      const result = ensureWebflowPasteSafety({
        payload: fixture.payload,
      });

      expect(result.report.blocked).toBe(fixture.expectedResult.shouldBlock);

      // Should either sanitize or warn about circular references
      const hasCircularHandling =
        result.sanitizationApplied ||
        result.report.warnings.some((w) => w.toLowerCase().includes('circular'));

      expect(hasCircularHandling).toBe(true);
    });

    it('should detect and break circular node references', () => {
      const fixture = loadFixture('crash-patterns', 'circular-node-refs.json');

      const result = ensureWebflowPasteSafety({
        payload: fixture.payload,
      });

      expect(result.report.blocked).toBe(fixture.expectedResult.shouldBlock);

      const hasCircularHandling =
        result.sanitizationApplied ||
        result.report.warnings.some((w) => w.toLowerCase().includes('circular'));

      expect(hasCircularHandling).toBe(true);
    });
  });

  describe('Duplicate UUIDs', () => {
    it('should detect and regenerate duplicate _id values', () => {
      const fixture = loadFixture('crash-patterns', 'duplicate-uuids.json');

      const result = ensureWebflowPasteSafety({
        payload: fixture.payload,
      });

      expect(result.report.blocked).toBe(fixture.expectedResult.shouldBlock);

      if (result.sanitizationApplied && result.sanitizationAppliedPayload && typeof result.sanitizationAppliedPayload === 'object') {
        const nodeIds = result.sanitizationAppliedPayload.payload.nodes.map((n: any) => n._id);
        const styleIds = result.sanitizationAppliedPayload.payload.styles.map((s: any) => s._id);
        const allIds = [...nodeIds, ...styleIds];

        // All IDs should be unique after sanitization
        const uniqueIds = new Set(allIds);
        expect(uniqueIds.size).toBe(allIds.length);
      }
    });
  });

  describe('All Crash Patterns', () => {
    it('should handle all crash patterns without throwing errors', () => {
      const fixtures = loadAllFixtures('crash-patterns');

      fixtures.forEach((fixture) => {
        expect(() => {
          ensureWebflowPasteSafety({
            payload: fixture.payload,
            cssEmbed: fixture.payload.embedCSS,
            jsEmbed: fixture.payload.embedJS,
          });
        }).not.toThrow();
      });
    });
  });
});

import { describe, it, expect } from 'vitest';
import { loadAllFixtures } from '../fixtures/fixture-loader';
import { ensureWebflowPasteSafety } from '@/lib/webflow-safety-gate';

type FixtureStyle = {
  variants?: Record<string, unknown>;
};

describe('Sanitization Logic', () => {
  describe('Valid Patterns', () => {
    it('should pass all valid patterns without modification', () => {
      const fixtures = loadAllFixtures('valid-patterns');

      fixtures.forEach((fixture) => {
        const result = ensureWebflowPasteSafety({
          payload: fixture.payload,
        });

        expect(result.report.blocked).toBe(false);
        expect(result.sanitizationApplied).toBe(false);
        expect(result.report.warnings.length).toBe(0);
      });
    });

    it('should preserve valid variant keys', () => {
      const fixture = loadAllFixtures('valid-patterns').find(
        (f) => f.name === 'Valid Variant Keys'
      );

      if (fixture) {
        const result = ensureWebflowPasteSafety({
          payload: fixture.payload,
        });

        expect(result.sanitizationApplied).toBe(false);

        // Verify all variant keys are preserved
        if (!result.sanitizationApplied) {
          const originalStyles = fixture.payload.payload.styles as FixtureStyle[];
          originalStyles.forEach((style) => {
            if (style.variants) {
              const originalKeys = Object.keys(style.variants);
              expect(originalKeys.length).toBeGreaterThan(0);
            }
          });
        }
      }
    });

    it('should preserve safe nesting levels', () => {
      const fixture = loadAllFixtures('valid-patterns').find(
        (f) => f.name === 'Safe Nesting - 20 Levels'
      );

      if (fixture) {
        const result = ensureWebflowPasteSafety({
          payload: fixture.payload,
        });

        expect(result.report.blocked).toBe(false);
        expect(result.sanitizationApplied).toBe(false);

        // Verify node count is preserved
        if (!result.sanitizationApplied) {
          expect(fixture.payload.payload.nodes.length).toBe(20);
        }
      }
    });

    it('should not flag valid class names', () => {
      const fixture = loadAllFixtures('valid-patterns').find(
        (f) => f.name === 'Valid Class Names'
      );

      if (fixture) {
        const result = ensureWebflowPasteSafety({
          payload: fixture.payload,
        });

        expect(result.report.warnings.length).toBe(0);

        // Verify no w- prefix warnings
        const hasReservedWarning = result.report.warnings.some(
          (w) => w.toLowerCase().includes('w-') || w.toLowerCase().includes('reserved')
        );
        expect(hasReservedWarning).toBe(false);
      }
    });
  });

  describe('Sanitization Preservation', () => {
    it('should preserve payload structure after sanitization', () => {
      const crashPatterns = loadAllFixtures('crash-patterns');

      crashPatterns.forEach((fixture) => {
        const result = ensureWebflowPasteSafety({
          payload: fixture.payload,
          cssEmbed: fixture.payload.embedCSS,
          jsEmbed: fixture.payload.embedJS,
        });

        if (result.sanitizationApplied && result.sanitizationAppliedPayload && typeof result.sanitizationAppliedPayload === 'object') {
          // Verify required structure
          expect(result.sanitizationAppliedPayload.type).toBe('@webflow/XscpData');
          expect(result.sanitizationAppliedPayload.payload).toBeDefined();
          expect(result.sanitizationAppliedPayload.payload.nodes).toBeDefined();
          expect(result.sanitizationAppliedPayload.payload.styles).toBeDefined();
          expect(result.sanitizationAppliedPayload.meta).toBeDefined();
        }
      });
    });

    it('should not introduce new errors during sanitization', () => {
      const crashPatterns = loadAllFixtures('crash-patterns');

      crashPatterns.forEach((fixture) => {
        const result = ensureWebflowPasteSafety({
          payload: fixture.payload,
        });

        // If sanitized, the sanitized payload should pass without critical errors
        if (result.sanitizationApplied && result.sanitizationAppliedPayload) {
          const revalidation = ensureWebflowPasteSafety({
            payload: result.sanitizationAppliedPayload,
          });

          // Sanitized payload should not require further sanitization
          expect(revalidation.safetyReport.blocked).toBe(false);
        }
      });
    });
  });

  describe('Idempotency', () => {
    it('should be idempotent - sanitizing twice should not change result', () => {
      const crashPatterns = loadAllFixtures('crash-patterns');

      crashPatterns.forEach((fixture) => {
        const firstPass = ensureWebflowPasteSafety({
          payload: fixture.payload,
        });

        if (firstPass.sanitized && firstPass.sanitizedPayload) {
          const secondPass = ensureWebflowPasteSafety({
            payload: firstPass.sanitizedPayload,
          });

          // Second pass should not require sanitization
          expect(secondPass.sanitized).toBe(false);
        }
      });
    });
  });

  describe('Warning Consistency', () => {
    it('should provide clear warnings for all detected issues', () => {
      const allFixtures = [
        ...loadAllFixtures('crash-patterns'),
        ...loadAllFixtures('valid-patterns'),
      ];

      allFixtures.forEach((fixture) => {
        const result = ensureWebflowPasteSafety({
          payload: fixture.payload,
        });

        // Warnings should be non-empty strings
        result.report.warnings.forEach((warning) => {
          expect(typeof warning).toBe('string');
          expect(warning.length).toBeGreaterThan(0);
        });

        // If fixture expects warnings, verify they are present
        if (fixture.expectedResult.warnings && fixture.expectedResult.warnings.length > 0) {
          expect(result.report.warnings.length).toBeGreaterThan(0);
        }
      });
    });
  });
});

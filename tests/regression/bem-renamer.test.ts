import { describe, it, expect } from 'vitest';
import {
  renameClassesForProject,
  isBemRenamingEnabled,
  isHighRiskClass,
  detectHighRiskClasses,
} from '@/lib/bem-renamer';
import type { ComponentTree } from '@/lib/componentizer';

// Helper to create a minimal component tree for testing
function createTestComponentTree(components: Array<{
  id: string;
  name: string;
  classes: string[];
  html: string;
}>): ComponentTree {
  return {
    components: components.map((c, i) => ({
      id: c.id,
      name: c.name,
      type: 'section' as const,
      tagName: 'section',
      primaryClass: c.classes[0] || '',
      htmlContent: c.html,
      classesUsed: c.classes,
      assetsUsed: [],
      jsHooks: [],
      children: [],
      order: i + 1,
    })),
    rootOrder: components.map((c) => c.id),
    repeatedPatterns: [],
    warnings: [],
  };
}

describe('BEM Renamer', () => {
  describe('isBemRenamingEnabled', () => {
    it('should return true by default', () => {
      expect(isBemRenamingEnabled()).toBe(true);
    });
  });

  describe('isHighRiskClass', () => {
    it('should detect common high-risk class names', () => {
      const highRiskNames = [
        'container',
        'hero',
        'section',
        'header',
        'footer',
        'nav',
        'navigation',
        'sidebar',
        'main',
        'content',
        'wrapper',
        'row',
        'col',
        'grid',
        'flex',
        'button',
        'btn',
        'link',
        'text',
        'title',
        'heading',
        'image',
        'img',
        'card',
        'list',
        'item',
      ];

      highRiskNames.forEach((name) => {
        expect(isHighRiskClass(name)).toBe(true);
      });
    });

    it('should NOT flag specific/unique class names', () => {
      const safeNames = [
        'acme-hero',
        'custom-container',
        'my-unique-section',
        'brand-header-v2',
        'feature-card-blue',
      ];

      safeNames.forEach((name) => {
        expect(isHighRiskClass(name)).toBe(false);
      });
    });

    it('should detect Webflow reserved prefixes', () => {
      const reservedNames = [
        'w-container',
        'w-nav',
        'w-slider',
        'w-dropdown',
      ];

      reservedNames.forEach((name) => {
        expect(isHighRiskClass(name)).toBe(true);
      });
    });
  });

  describe('detectHighRiskClasses', () => {
    it('should return list of high-risk classes from input', () => {
      const classes = ['container', 'my-card', 'hero', 'footer', 'acme-button'];
      const highRisk = detectHighRiskClasses(classes);

      expect(highRisk).toContain('container');
      expect(highRisk).toContain('hero');
      expect(highRisk).toContain('footer');
      expect(highRisk).not.toContain('my-card');
      expect(highRisk).not.toContain('acme-button');
    });
  });

  describe('renameClassesForProject', () => {
    describe('Idempotency', () => {
      it('should produce identical output when run twice', () => {
        const tree = createTestComponentTree([
          {
            id: 'hero',
            name: 'Hero Section',
            classes: ['hero', 'hero-content', 'hero-title'],
            html: '<section class="hero"><div class="hero-content"><h1 class="hero-title">Hello</h1></div></section>',
          },
        ]);

        const css = `.hero { background: blue; } .hero-content { padding: 20px; } .hero-title { font-size: 48px; }`;
        const js = `document.querySelector('.hero').addEventListener('click', () => {});`;

        const result1 = renameClassesForProject({
          componentsTree: tree,
          css,
          js,
          establishedClasses: [],
          options: {
            projectSlug: 'test-project',
            updateJSReferences: true,
          },
        });

        // Run again on the result
        const result2 = renameClassesForProject({
          componentsTree: result1.updatedComponents,
          css: result1.updatedCss,
          js: result1.updatedJs,
          establishedClasses: [],
          options: {
            projectSlug: 'test-project',
            updateJSReferences: true,
          },
        });

        // CSS should be identical (already namespaced classes are preserved)
        expect(result2.updatedCss).toBe(result1.updatedCss);
        // Second run should have 0 renames (classes already namespaced are preserved)
        expect(result2.report.summary.renamed).toBe(0);
        // Total classes should be the same
        expect(result2.report.summary.totalClasses).toBe(result1.report.summary.totalClasses);
      });
    });

    describe('High-risk class neutralization', () => {
      it('should rename high-risk generic names', () => {
        const tree = createTestComponentTree([
          {
            id: 'main',
            name: 'Main Section',
            classes: ['container', 'hero', 'section'],
            html: '<section class="container hero section">Content</section>',
          },
        ]);

        const css = `.container { max-width: 1200px; } .hero { min-height: 100vh; } .section { padding: 80px 0; }`;

        const result = renameClassesForProject({
          componentsTree: tree,
          css,
          js: '',
          establishedClasses: [],
          options: {
            projectSlug: 'mysite',
          },
        });

        // All high-risk classes should be renamed
        expect(result.mapping.get('container')).not.toBe('container');
        expect(result.mapping.get('hero')).not.toBe('hero');
        expect(result.mapping.get('section')).not.toBe('section');

        // Report should track them
        expect(result.report.summary.highRiskNeutralized).toBe(3);
        expect(result.report.categories.highRiskDetected).toContain('container');
        expect(result.report.categories.highRiskDetected).toContain('hero');
        expect(result.report.categories.highRiskDetected).toContain('section');
      });
    });

    describe('Shared class handling', () => {
      it('should namespace shared classes as utilities with -u- prefix', () => {
        const tree = createTestComponentTree([
          {
            id: 'hero',
            name: 'Hero Section',
            classes: ['shared-button', 'hero-specific'],
            html: '<section><button class="shared-button hero-specific">Click</button></section>',
          },
          {
            id: 'footer',
            name: 'Footer',
            classes: ['shared-button', 'footer-specific'],
            html: '<footer><button class="shared-button footer-specific">Submit</button></footer>',
          },
        ]);

        const css = `.shared-button { padding: 10px; } .hero-specific { color: blue; } .footer-specific { color: green; }`;

        const result = renameClassesForProject({
          componentsTree: tree,
          css,
          js: '',
          establishedClasses: [],
          options: {
            projectSlug: 'mysite',
          },
        });

        // Shared class should be namespaced as utility with -u- prefix
        const sharedButtonName = result.mapping.get('shared-button');
        expect(sharedButtonName).toBeDefined();
        expect(sharedButtonName).toContain('-u-');

        // Component-local classes should NOT have -u- prefix
        const heroSpecificName = result.mapping.get('hero-specific');
        const footerSpecificName = result.mapping.get('footer-specific');
        expect(heroSpecificName).not.toContain('-u-');
        expect(footerSpecificName).not.toContain('-u-');
      });

      it('should avoid collisions between shared utilities', () => {
        const tree = createTestComponentTree([
          {
            id: 'section1',
            name: 'Section 1',
            classes: ['btn', 'item'],
            html: '<section class="btn item">Content</section>',
          },
          {
            id: 'section2',
            name: 'Section 2',
            classes: ['btn', 'item'],
            html: '<section class="btn item">Content</section>',
          },
        ]);

        const css = `.btn { display: inline-block; } .item { margin: 10px; }`;

        const result = renameClassesForProject({
          componentsTree: tree,
          css,
          js: '',
          establishedClasses: [],
          options: {
            projectSlug: 'mysite',
          },
        });

        // Both shared classes should get unique utility names
        const btnName = result.mapping.get('btn');
        const itemName = result.mapping.get('item');
        expect(btnName).toBeDefined();
        expect(itemName).toBeDefined();
        expect(btnName).not.toBe(itemName);
      });
    });

    describe('Established class preservation', () => {
      it('should preserve design token classes', () => {
        const tree = createTestComponentTree([
          {
            id: 'card',
            name: 'Card Component',
            classes: ['card', 'text-primary', 'bg-accent'],
            html: '<div class="card text-primary bg-accent">Card content</div>',
          },
        ]);

        const css = `.card { border-radius: 12px; } .text-primary { color: var(--primary); } .bg-accent { background: var(--accent); }`;

        const result = renameClassesForProject({
          componentsTree: tree,
          css,
          js: '',
          establishedClasses: ['text-primary', 'bg-accent'],
          options: {
            projectSlug: 'mysite',
          },
        });

        // Design token classes should be preserved
        expect(result.mapping.get('text-primary')).toBe('text-primary');
        expect(result.mapping.get('bg-accent')).toBe('bg-accent');

        // Non-token classes can be renamed
        expect(result.mapping.get('card')).toBeDefined();

        // Report should track preserved classes
        expect(result.report.summary.preserved).toBeGreaterThanOrEqual(2);
      });
    });

    describe('JS reference updating', () => {
      it('should update querySelector references', () => {
        const tree = createTestComponentTree([
          {
            id: 'nav',
            name: 'Navigation',
            classes: ['nav', 'nav-link'],
            html: '<nav class="nav"><a class="nav-link" href="#">Link</a></nav>',
          },
        ]);

        const css = `.nav { display: flex; } .nav-link { color: blue; }`;
        const js = `
          document.querySelector('.nav').classList.add('active');
          document.querySelectorAll('.nav-link').forEach(el => el.style.color = 'red');
        `;

        const result = renameClassesForProject({
          componentsTree: tree,
          css,
          js,
          establishedClasses: [],
          options: {
            projectSlug: 'mysite',
            updateJSReferences: true,
          },
        });

        // JS should have updated selectors
        const newNavClass = result.mapping.get('nav');
        const newNavLinkClass = result.mapping.get('nav-link');

        if (newNavClass && newNavClass !== 'nav') {
          expect(result.updatedJs).toContain(`.${newNavClass}`);
        }
        if (newNavLinkClass && newNavLinkClass !== 'nav-link') {
          expect(result.updatedJs).toContain(`.${newNavLinkClass}`);
        }
      });
    });

    describe('No Webflow reserved output', () => {
      it('should NOT produce w-* prefixed class names', () => {
        const tree = createTestComponentTree([
          {
            id: 'section',
            name: 'Main Section',
            classes: ['container', 'row', 'col'],
            html: '<section class="container row col">Content</section>',
          },
        ]);

        const css = `.container { width: 100%; } .row { display: flex; } .col { flex: 1; }`;

        const result = renameClassesForProject({
          componentsTree: tree,
          css,
          js: '',
          establishedClasses: [],
          options: {
            projectSlug: 'mysite',
          },
        });

        // No output class should start with w-
        for (const [, newName] of result.mapping) {
          expect(newName.startsWith('w-')).toBe(false);
        }
      });
    });

    describe('CSS selector integrity', () => {
      it('should handle complex CSS selectors', () => {
        const tree = createTestComponentTree([
          {
            id: 'card',
            name: 'Card',
            classes: ['card', 'card-active', 'card-title'],
            html: '<div class="card card-active"><h2 class="card-title">Title</h2></div>',
          },
        ]);

        const css = `
          .card { border: 1px solid #ccc; }
          .card.card-active { border-color: blue; }
          .card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .card .card-title { font-weight: bold; }
        `;

        const result = renameClassesForProject({
          componentsTree: tree,
          css,
          js: '',
          establishedClasses: [],
          options: {
            projectSlug: 'mysite',
          },
        });

        // CSS should still be valid (no broken selectors)
        expect(result.updatedCss).toBeDefined();
        // Should still contain hover pseudo-class
        expect(result.updatedCss).toContain(':hover');
      });
    });

    describe('BEM format output', () => {
      it('should produce valid BEM class names starting with project slug', () => {
        const tree = createTestComponentTree([
          {
            id: 'hero',
            name: 'Hero',
            classes: ['hero', 'hero-content', 'hero-title'],
            html: '<section class="hero"><div class="hero-content"><h1 class="hero-title">Hello</h1></div></section>',
          },
        ]);

        const css = `.hero { min-height: 100vh; } .hero-content { padding: 40px; } .hero-title { font-size: 64px; }`;

        const result = renameClassesForProject({
          componentsTree: tree,
          css,
          js: '',
          establishedClasses: [],
          options: {
            projectSlug: 'mysite',
          },
        });

        // All renamed classes should start with project slug (may have -, __, or -- as separator)
        for (const [original, newName] of result.mapping) {
          if (original !== newName) {
            // Class should start with project slug followed by separator or be the slug itself
            const startsWithSlug = newName.startsWith('mysite');
            expect(startsWithSlug).toBe(true);
            // If longer than slug, should have a valid BEM separator
            if (newName.length > 'mysite'.length) {
              const separatorChar = newName.charAt('mysite'.length);
              expect(['-', '_'].includes(separatorChar)).toBe(true);
            }
          }
        }
      });
    });

    describe('Report accuracy', () => {
      it('should accurately report summary statistics', () => {
        const tree = createTestComponentTree([
          {
            id: 'page',
            name: 'Page',
            classes: ['container', 'hero', 'text-primary', 'unique-card'],
            html: '<div class="container hero text-primary unique-card">Content</div>',
          },
        ]);

        const css = `.container { width: 100%; } .hero { height: 100vh; } .text-primary { color: blue; } .unique-card { border-radius: 8px; }`;

        const result = renameClassesForProject({
          componentsTree: tree,
          css,
          js: '',
          establishedClasses: ['text-primary'],
          options: {
            projectSlug: 'mysite',
          },
        });

        // Total classes processed
        expect(result.report.summary.totalClasses).toBe(4);

        // Preserved (text-primary)
        expect(result.report.summary.preserved).toBe(1);

        // High-risk (container, hero)
        expect(result.report.summary.highRiskNeutralized).toBe(2);

        // Status should be warn due to high-risk classes
        expect(result.report.status).toBe('warn');
      });
    });

    describe('LLM context generation', () => {
      it('should generate LLM context when enabled', () => {
        const tree = createTestComponentTree([
          {
            id: 'section',
            name: 'Section',
            classes: ['container', 'section'],
            html: '<section class="container section">Content</section>',
          },
        ]);

        const css = `.container { width: 100%; } .section { padding: 40px; }`;

        const result = renameClassesForProject({
          componentsTree: tree,
          css,
          js: '',
          establishedClasses: [],
          options: {
            projectSlug: 'mysite',
            enableLlmRefinement: true,
          },
        });

        // Should have LLM context
        expect(result.llmContext).toBeDefined();
        expect(result.llmContext?.proposedMapping).toBeDefined();
        expect(result.llmContext?.highRiskDetected).toBeDefined();
        expect(result.llmContext?.ambiguousNames).toBeDefined();

        // High-risk classes should be in context
        expect(result.llmContext?.highRiskDetected).toContain('container');
        expect(result.llmContext?.highRiskDetected).toContain('section');
      });

      it('should NOT generate LLM context when disabled', () => {
        const tree = createTestComponentTree([
          {
            id: 'section',
            name: 'Section',
            classes: ['container'],
            html: '<section class="container">Content</section>',
          },
        ]);

        const css = `.container { width: 100%; }`;

        const result = renameClassesForProject({
          componentsTree: tree,
          css,
          js: '',
          establishedClasses: [],
          options: {
            projectSlug: 'mysite',
            enableLlmRefinement: false,
          },
        });

        expect(result.llmContext).toBeUndefined();
      });
    });
  });
});

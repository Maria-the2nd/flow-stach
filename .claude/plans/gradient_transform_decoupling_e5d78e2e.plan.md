---
name: Gradient Transform Decoupling
overview: Implement a pre-processing pass that detects elements combining gradients with transforms, then structurally rewrites the HTML to separate them into parent/child relationships - preventing Webflow's gradient-drop failure mode during import.
todos:
  - id: create-decoupler-module
    content: Create lib/gradient-transform-decoupler.ts with detection logic (detectGradientTransformConflicts, hasGradientTransformConflict)
    status: completed
  - id: implement-css-splitting
    content: Implement CSS splitting logic that separates gradient properties from transform properties into parent/child classes
    status: completed
  - id: implement-html-rewriting
    content: Implement HTML rewriting to inject gradient layer child elements for conflicting classes
    status: completed
  - id: integrate-normalizer
    content: Integrate decoupler into webflow-normalizer.ts pipeline after gradient sanitization
    status: completed
  - id: handle-edge-cases
    content: "Handle edge cases: multiple gradients, pseudo-elements, nested transforms, responsive variants, hover states"
    status: in_progress
  - id: add-tests
    content: Create tests/gradient-transform-decoupler.test.ts with comprehensive unit tests
    status: pending
  - id: update-gradient-sanitizer
    content: Export helper functions from gradient-sanitizer.ts for reuse by decoupler
    status: completed
---

# Gradient-Transform Decoupling for Webflow Import

## Problem Summary

Webflow's import engine has a race condition when processing elements that combine:
- `background-image: linear-gradient(...)` 
- `transform: scale()`, `translateZ()`, etc.
- `transition` properties

During import, the gradient normalization "loses the race" to transform normalization, causing:
- Gradient silently dropped
- Solid color fallback applied (often brown/beige)
- Transform and transition survive, but gradient is permanently lost

## Solution: Structural Decoupling

The fix is to **structurally separate** gradient-bearing elements from transform-bearing elements before Webflow ever sees them.

### Before (problematic)

```html
<div class="product-image">
  <!-- gradient + transform on same element = fails -->
</div>
```

```css
.product-image {
  background: linear-gradient(...);
  transform: scale(1.05);
  transition: transform 0.3s;
}
```

### After (safe)

```html
<div class="product-image">
  <div class="product-image-bg">
    <!-- gradient lives here, no transforms -->
  </div>
  <!-- original children moved here -->
</div>
```

```css
.product-image {
  transform: scale(1.05);
  transition: transform 0.3s;
  position: relative;
}
.product-image-bg {
  background: linear-gradient(...);
  position: absolute;
  inset: 0;
}
```

---

## Architecture

### New Module: `lib/gradient-transform-decoupler.ts`

This module will:
1. Detect problematic element/style combinations
2. Rewrite HTML structure
3. Split CSS rules appropriately

### Integration Point

Insert into the pipeline in `webflow-normalizer.ts`, **after** gradient sanitization but **before** HTML normalization:

```
normalizeHtmlCssForWebflow()
├─ normalizeSelfClosingTags()
├─ removeProblematicAttributes()
├─ sanitizeGradientsForWebflow()     ← existing
├─ decoupleGradientsFromTransforms() ← NEW
├─ parseProperties()
└─ normalizeHtml()
```

---

## Implementation Details

### Step 1: Detection Algorithm

Create detection logic to find elements with the dangerous combination:

```typescript
// lib/gradient-transform-decoupler.ts

interface PotentialConflict {
  className: string;
  hasGradient: boolean;
  hasTransform: boolean;
  hasWillChange: boolean;
  hasTransition: boolean;
  gradientValue: string;
  transformValue: string;
  selectors: string[];
}

function detectGradientTransformConflicts(
  css: string,
  classIndex: ClassIndex
): PotentialConflict[]
```

Detection criteria:
- Element has `background-image` containing `gradient(`
- AND has any of: `transform`, `will-change: transform`, `transition` involving transform

### Step 2: HTML Rewriting

For each detected conflict, rewrite the HTML:

```typescript
interface DecouplingResult {
  html: string;
  css: string;
  rewriteCount: number;
  warnings: string[];
}

function rewriteHtmlForDecoupling(
  html: string,
  conflicts: PotentialConflict[],
  options: DecouplingOptions
): DecouplingResult
```

The rewrite will:
1. Find elements with the conflicting class
2. Insert a new child `<div class="{className}-bg"></div>` as first child
3. Preserve all existing children
4. Mark the parent for transform-only styling

### Step 3: CSS Splitting

Split the CSS rules to separate gradient from transform:

```typescript
function splitCssForDecoupling(
  css: string,
  conflicts: PotentialConflict[]
): string
```

For each conflict class:
- **Parent class**: Keep `transform`, `transition`, `will-change`; add `position: relative`
- **New `-bg` class**: Keep `background-image`, `background-*`; add `position: absolute; inset: 0; z-index: -1`

### Step 4: Integration in Normalizer

Update [`lib/webflow-normalizer.ts`](lib/webflow-normalizer.ts):

```typescript
export function normalizeHtmlCssForWebflow(
  html: string,
  css: string,
  options: NormalizationOptions = {}
): NormalizationResult {
  // ... existing setup ...
  
  // Sanitize gradients
  const gradientResult = sanitizeGradientsForWebflow(css);
  
  // NEW: Decouple gradients from transforms
  const decoupledResult = decoupleGradientsFromTransforms(
    normalizedHtml,
    gradientResult.css
  );
  
  if (decoupledResult.rewriteCount > 0) {
    warnings.push(
      `Decoupled ${decoupledResult.rewriteCount} gradient+transform elements for Webflow compatibility`
    );
  }
  
  // Continue with decoupled HTML/CSS
  normalizedHtml = decoupledResult.html;
  const sanitizedCss = decoupledResult.css;
  
  // ... rest of normalization ...
}
```

---

## Key Files to Create/Modify

### Create: `lib/gradient-transform-decoupler.ts`

```typescript
// Core exports
export interface DecouplingOptions {
  /** Preserve original structure in data attributes for debugging */
  preserveDebugInfo?: boolean;
  /** Class suffix for gradient layer (default: "-bg") */
  gradientLayerSuffix?: string;
  /** Only process specific class names */
  filterClasses?: Set<string>;
}

export interface DecouplingResult {
  html: string;
  css: string;
  rewriteCount: number;
  decoupledClasses: string[];
  warnings: string[];
}

export function decoupleGradientsFromTransforms(
  html: string,
  css: string,
  options?: DecouplingOptions
): DecouplingResult;

export function detectGradientTransformConflicts(
  css: string
): PotentialConflict[];

export function hasGradientTransformConflict(
  styleLess: string
): boolean;
```

### Modify: `lib/webflow-normalizer.ts`

- Import and call `decoupleGradientsFromTransforms`
- Add to warnings array
- Pass decoupled HTML/CSS to rest of pipeline

### Modify: `lib/gradient-sanitizer.ts`

- Export helper: `extractGradientFromValue(value: string): string | null`
- This will be reused by decoupler

---

## CSS Property Categorization

### Properties that stay on PARENT (transform container)

```typescript
const TRANSFORM_PROPERTIES = new Set([
  'transform',
  'transform-origin',
  'transform-style',
  'perspective',
  'perspective-origin',
  'will-change',
  'transition',
  'transition-property',
  'transition-duration',
  'transition-timing-function',
  'transition-delay',
]);
```

### Properties that move to CHILD (gradient layer)

```typescript
const GRADIENT_PROPERTIES = new Set([
  'background',
  'background-image',
  'background-color',
  'background-size',
  'background-position',
  'background-repeat',
  'background-attachment',
  'background-origin',
  'background-clip',
]);
```

### Properties that need DUPLICATION (both layers)

```typescript
const SHARED_PROPERTIES = new Set([
  'border-radius',  // Gradient layer needs same radius
  'overflow',       // Both need overflow handling
]);
```

---

## Edge Cases to Handle

1. **Multiple gradients**: Some elements have multiple gradient layers - preserve all on the `-bg` element

2. **Pseudo-elements with gradients**: If `:before/:after` has the gradient, don't rewrite (pseudo-elements don't have the same conflict)

3. **Nested transforms**: If parent already has transform, the child gradient layer should still work

4. **Responsive variations**: Check all media query variants for the conflict, not just base styles

5. **Hover states**: If hover adds transform to gradient element, need to decouple the hover state too

6. **Existing `-bg` suffix**: Check if a `{class}-bg` already exists to avoid collision

---

## Testing Strategy

### Unit Tests for `gradient-transform-decoupler.ts`

```typescript
// tests/gradient-transform-decoupler.test.ts

describe('detectGradientTransformConflicts', () => {
  it('detects gradient + transform combination', () => {
    const css = `.card { 
      background: linear-gradient(red, blue); 
      transform: scale(1.05); 
    }`;
    const conflicts = detectGradientTransformConflicts(css);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].className).toBe('card');
  });

  it('ignores gradient-only elements', () => {
    const css = `.card { background: linear-gradient(red, blue); }`;
    const conflicts = detectGradientTransformConflicts(css);
    expect(conflicts).toHaveLength(0);
  });

  it('ignores transform-only elements', () => {
    const css = `.card { transform: scale(1.05); }`;
    const conflicts = detectGradientTransformConflicts(css);
    expect(conflicts).toHaveLength(0);
  });

  it('detects will-change as transform indicator', () => {
    const css = `.card { 
      background: linear-gradient(red, blue); 
      will-change: transform; 
    }`;
    const conflicts = detectGradientTransformConflicts(css);
    expect(conflicts).toHaveLength(1);
  });
});

describe('decoupleGradientsFromTransforms', () => {
  it('wraps gradient in child element', () => {
    const html = '<div class="card">Content</div>';
    const css = `.card { 
      background: linear-gradient(red, blue); 
      transform: scale(1.05); 
    }`;
    const result = decoupleGradientsFromTransforms(html, css);
    
    expect(result.html).toContain('card-bg');
    expect(result.css).toContain('.card-bg');
    expect(result.rewriteCount).toBe(1);
  });

  it('preserves original children', () => {
    const html = '<div class="card"><span>Text</span></div>';
    const css = `.card { 
      background: linear-gradient(red, blue); 
      transform: scale(1.05); 
    }`;
    const result = decoupleGradientsFromTransforms(html, css);
    
    expect(result.html).toContain('<span>Text</span>');
  });
});
```

---

## Rollout Plan

1. **Phase 1**: Create `gradient-transform-decoupler.ts` with detection logic only (no rewrites)
2. **Phase 2**: Add CSS splitting logic, output warnings but don't modify
3. **Phase 3**: Implement HTML rewriting, enable behind flag
4. **Phase 4**: Enable by default after validation

---

## Success Criteria

- Gradients survive Webflow import when transforms are present
- No visual difference between original and decoupled layouts
- All existing tests pass
- New unit tests cover detection and rewriting
- Extension successfully imports previously-failing components
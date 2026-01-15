# Gradient-Transform Decoupling

Automatic structural separation of gradient-bearing elements from transform-bearing elements to prevent Webflow import failures.

## Problem

Webflow's import engine has a race condition when processing elements that combine:
- `background-image: linear-gradient(...)`
- `transform: scale()`, `translateZ()`, etc.
- `transition` properties

During import, the gradient normalization "loses the race" to transform normalization, causing:
- **Gradient silently dropped** - replaced with solid color fallback (often brown/beige)
- **Transform and transition survive** - but gradient is permanently lost
- **Inconsistent behavior** - same component may work on some pages but fail on others

### Why It Happens

Webflow resolves styles in this order:
1. Page-level styles
2. Class styles
3. Interaction / transform styles
4. Variable modes
5. Computed fallback

When an element has both gradient and transform, Webflow tries to:
1. Normalize the background (gradient)
2. Normalize the transform
3. Attach interactions / hover / motion

On some pages, step 1 loses the race, so Webflow:
- Drops the gradient
- Falls back to the first resolved solid color it can find
- That color often comes from a color token, parent background, or computed "average"

## Solution

The **Gradient-Transform Decoupler** automatically rewrites HTML and CSS to structurally separate gradient layers from transform containers **before** Webflow ever sees them.

### Before (Problematic)

```html
<div class="product-image">
  <!-- gradient + transform on same element = fails -->
</div>
```

```css
.product-image {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transform: scale(1.05);
  transition: transform 0.3s ease;
}
```

### After (Safe)

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
  transition: transform 0.3s ease;
  position: relative;
}
.product-image-bg {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: absolute;
  inset: 0;
  z-index: -1;
}
```

## Implementation

### Location

- **Module**: `lib/gradient-transform-decoupler.ts`
- **Integration**: `lib/webflow-normalizer.ts` (runs after gradient sanitization)
- **Tests**: `tests/gradient-transform-decoupler.test.ts`

### Detection

The decoupler detects conflicts by checking for:
- `background-image` or `background` containing `gradient(`
- **AND** any of:
  - `transform` property
  - `will-change: transform`
  - `transition` property (conservatively assumed to involve transform)

**Note on transition detection:** The decoupler uses a conservative approach - any `transition` property triggers decoupling, even if it doesn't explicitly mention `transform` (e.g., `transition: color 0.3s`). This prevents false negatives but may cause unnecessary decoupling in rare cases.

### CSS Property Categorization

**Properties that stay on PARENT (transform container):**
- `transform`, `transform-origin`, `transform-style`
- `perspective`, `perspective-origin`
- `will-change`
- `transition`, `transition-*`

**Properties that move to CHILD (gradient layer):**
- `background`, `background-image`
- `background-color`, `background-size`
- `background-position`, `background-repeat`
- `background-attachment`, `background-origin`, `background-clip`

**Properties that move to CHILD ONLY (for visual correctness):**
- `border-radius` and its variants (gradient layer needs same radius to match parent shape)
- `overflow`, `overflow-x`, `overflow-y` (applied to gradient layer to ensure proper clipping)

**Note:** These properties are NOT duplicated on both layers. They only appear on the child gradient layer, which is sufficient for visual correctness since the child is absolutely positioned within the parent.

### HTML Rewriting

For each detected conflict:
1. Finds elements with the conflicting class
2. Inserts a new child `<div class="{className}-bg"></div>` as first child
3. Preserves all existing children
4. Marks the parent for transform-only styling

**Implementation details:**
- Uses `DOMParser` when available (browser environments) for accurate HTML parsing
- Falls back to regex-based replacement in non-browser environments (Node.js, etc.)
- Regex fallback may have limitations with deeply nested or complex HTML structures
- Checks for existing `-bg` elements to avoid duplicate insertion

### CSS Splitting

For each conflict class:
- **Parent class**: Keeps `transform`, `transition`, `will-change`; adds `position: relative`; keeps all other non-gradient properties
- **New `-bg` class**: Keeps `background-image`, `background-*`; adds `position: absolute; inset: 0; z-index: -1`; receives shared properties like `border-radius` and `overflow`

## Edge Cases Handled

1. **Multiple gradients** - All gradient properties preserved on the `-bg` element
2. **Pseudo-elements** - `::before` and `::after` are skipped (they don't have the same conflict)
3. **Nested transforms** - Works correctly even if parent already has transform
4. **Responsive variants** - Media queries are processed and split correctly
5. **Hover states** - Pseudo-classes like `:hover` are applied to both parent and child (child may have minimal properties for consistency)
6. **Existing `-bg` suffix** - Checks for collisions and skips decoupling if `{class}-bg` already exists
7. **Compound selectors** - Handles `.card.active` and similar compound class selectors
8. **Non-gradient/non-transform properties** - All other properties (padding, margin, width, etc.) remain on the parent

## Usage

The decoupler runs automatically during the normalization pipeline:

```typescript
import { normalizeHtmlCssForWebflow } from './lib/webflow-normalizer';

const result = normalizeHtmlCssForWebflow(html, css);
// Decoupling happens automatically if conflicts are detected
// Warnings will indicate if decoupling occurred:
// "Decoupled N gradient+transform elements for Webflow compatibility (class1, class2)"
```

### Manual Usage

You can also use the decoupler directly:

```typescript
import { decoupleGradientsFromTransforms } from './lib/gradient-transform-decoupler';

const result = decoupleGradientsFromTransforms(html, css, {
  gradientLayerSuffix: '-bg',  // default
  filterClasses: new Set(['card']),  // only process specific classes
  preserveDebugInfo: false,  // add data attributes for debugging
});

// result.html - rewritten HTML with gradient layers
// result.css - split CSS with separate rules
// result.rewriteCount - number of elements rewritten
// result.decoupledClasses - array of class names that were decoupled
// result.warnings - any warnings (e.g., collision detection)
```

## API Reference

### `decoupleGradientsFromTransforms(html, css, options?)`

Main function that detects and decouples gradient-transform conflicts.

**Parameters:**
- `html: string` - HTML content to process
- `css: string` - CSS content to process
- `options?: DecouplingOptions` - Optional configuration

**Returns:**
```typescript
{
  html: string;              // Rewritten HTML
  css: string;               // Split CSS
  rewriteCount: number;      // Number of elements rewritten
  decoupledClasses: string[]; // Class names that were decoupled
  warnings: string[];         // Warnings (collisions, etc.)
}
```

### `detectGradientTransformConflicts(css)`

Detects all gradient-transform conflicts in CSS without modifying anything.

**Returns:** `PotentialConflict[]` - Array of detected conflicts with details

### `hasGradientTransformConflict(styleLess)`

Quick check if a styleLess string has both gradient and transform properties.

**Returns:** `boolean`

## Examples

### Basic Example

```css
.card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transform: scale(1.05);
  transition: transform 0.3s ease;
}
```

**After decoupling:**
```css
.card {
  transform: scale(1.05);
  transition: transform 0.3s ease;
  position: relative;
}
.card-bg {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: absolute;
  inset: 0;
  z-index: -1;
}
```

### With Hover State

```css
.card {
  background: linear-gradient(red, blue);
  transform: scale(1.05);
}
.card:hover {
  transform: scale(1.1);
}
```

**After decoupling:**
```css
.card {
  transform: scale(1.05);
  position: relative;
}
.card:hover {
  transform: scale(1.1);
}
.card-bg {
  background: linear-gradient(red, blue);
  position: absolute;
  inset: 0;
  z-index: -1;
}
.card-bg:hover {
  /* Hover state created for consistency, may have minimal properties */
  position: absolute;
  inset: 0;
  z-index: -1;
}
```

### With Media Query

```css
.card {
  background: linear-gradient(red, blue);
  transform: scale(1.05);
}
@media (max-width: 767px) {
  .card {
    transform: scale(1.02);
  }
}
```

**After decoupling:**
```css
.card {
  transform: scale(1.05);
  position: relative;
}
.card-bg {
  background: linear-gradient(red, blue);
  position: absolute;
  inset: 0;
  z-index: -1;
}
@media (max-width: 767px) {
  .card {
    transform: scale(1.02);
  }
  .card-bg {
    position: absolute;
    inset: 0;
    z-index: -1;
  }
}
```

## Testing

Comprehensive test suite in `tests/gradient-transform-decoupler.test.ts`:

- ✅ Detection logic (gradient + transform combinations)
- ✅ Basic decoupling functionality
- ✅ Child preservation
- ✅ Multiple classes
- ✅ Pseudo-elements skipping
- ✅ Hover states
- ✅ Media queries
- ✅ Collision avoidance
- ✅ Custom suffixes
- ✅ Filter classes
- ✅ Edge cases

Run tests:
```bash
bun tests/gradient-transform-decoupler.test.ts
```

## Related

- [Gradient Sanitizer](../lib/gradient-sanitizer.ts) - Resolves CSS variables in gradients
- [Webflow Normalizer](../lib/webflow-normalizer.ts) - Main normalization pipeline
- [Webflow Import Issues](../../docs/runbook.md) - Other known Webflow import problems

## Limitations

### Transition Detection

The decoupler uses a **conservative approach** for transition detection. Any `transition` property triggers decoupling, even if it doesn't involve transforms (e.g., `transition: color 0.3s`). This prevents false negatives but may cause unnecessary decoupling in rare cases. The visual result remains correct.

### HTML Rewriting Fallback

In non-browser environments (Node.js), HTML rewriting falls back to regex-based replacement when `DOMParser` is unavailable. This fallback:
- Works for most common HTML structures
- May have issues with deeply nested or complex HTML
- Inserts the bg element immediately after the opening tag (may not preserve structure perfectly in edge cases)

For best results, use in browser environments where `DOMParser` is available.

### Shared Properties

Properties like `border-radius` and `overflow` are only applied to the child gradient layer, not duplicated on both. This is intentional and sufficient for visual correctness since the child is absolutely positioned within the parent.

### Hover State Rules

When hover states are split, the child's hover rule (`.card-bg:hover`) may contain only positioning properties for consistency, even if no gradient-specific hover styles exist. This ensures the structure remains consistent across all pseudo-class variants.

## Notes

- This is a **structural rewrite** - the visual appearance remains identical
- The decoupler is **automatic** - no user action required
- Warnings are included in normalization results if decoupling occurs
- Collision detection prevents overwriting existing `-bg` classes
- Works with all gradient types: `linear-gradient`, `radial-gradient`, `conic-gradient`, etc.
- All non-gradient/non-transform properties remain on the parent element
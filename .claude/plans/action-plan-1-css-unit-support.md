# Action Plan 1: CSS Unit Support

## Overview

Ensure the import and conversion pipeline handles all CSS units, not just pixels. Sites may use rem, em, %, vh, vw, vmin, vmax, ch, ex, etc.

## Problem Statement

The current CSS parsing and Webflow conversion may assume pixel values or incorrectly handle relative units. This causes:
- Incorrect sizing when pasting into Webflow
- Lost responsive behavior
- Typography scale issues (rem-based systems break)

## Files to Investigate

| File | Purpose | Unit Handling Status |
|------|---------|---------------------|
| `lib/css-parser.ts` | Parse CSS from HTML | CHECK: How does it handle unit values? |
| `lib/webflow-converter.ts` | Convert to Webflow JSON | CHECK: Does it preserve units or convert to px? |
| `lib/webflow-literalizer.ts` | Generate Webflow styleLess | CHECK: Unit handling in style output |
| `lib/token-extractor.ts` | Extract CSS variables | CHECK: Preserves variable values with units? |

## Tasks

### 1.1 Audit Current Unit Handling

**Goal:** Understand how each unit type is currently processed

```bash
# Search for pixel-specific handling
grep -r "px" lib/css-parser.ts lib/webflow-converter.ts lib/webflow-literalizer.ts
```

Check for:
- Hard-coded "px" assumptions
- Number-only parsing that strips units
- parseFloat() calls that lose unit suffix
- Unit conversion functions

### 1.2 Create Unit Preservation Utilities

**Location:** `lib/css-units.ts` (NEW)

```typescript
export type CSSUnit =
  | 'px' | 'rem' | 'em'
  | '%'
  | 'vh' | 'vw' | 'vmin' | 'vmax' | 'dvh' | 'dvw'
  | 'ch' | 'ex'
  | 'fr'  // grid
  | 'deg' | 'rad' | 'turn'  // angles
  | 'ms' | 's'  // time
  | ''  // unitless (line-height, z-index, etc.)

export interface CSSValue {
  value: number
  unit: CSSUnit
  raw: string
}

// Parse "16px" -> { value: 16, unit: 'px', raw: '16px' }
// Parse "1.5rem" -> { value: 1.5, unit: 'rem', raw: '1.5rem' }
// Parse "100%" -> { value: 100, unit: '%', raw: '100%' }
export function parseCSSValue(input: string): CSSValue

// Preserve original value string when generating output
export function formatCSSValue(cssValue: CSSValue): string
```

### 1.3 Update CSS Parser

**Location:** `lib/css-parser.ts`

Ensure `parseStyles()` and related functions:
- Use `parseCSSValue()` instead of `parseFloat()`
- Preserve unit in returned style objects
- Handle calc() expressions: `calc(100vh - 80px)`
- Handle CSS functions: `clamp()`, `min()`, `max()`

### 1.4 Update Webflow Converter

**Location:** `lib/webflow-converter.ts`

The Webflow JSON format requires specific handling for units:

```typescript
// Webflow styleLess format examples:
// Pixels: "font-size: 16px;"
// Rem: "font-size: 1rem;"
// Percent: "width: 100%;"
// Viewport: "height: 100vh;"
```

Ensure:
- Units pass through unchanged to styleLess
- Numeric values keep their unit suffix
- Special handling for Webflow-unsupported units (convert if needed)

### 1.5 Update Webflow Literalizer

**Location:** `lib/webflow-literalizer.ts`

Check style generation preserves units:
- `fontSize`, `lineHeight`, `letterSpacing` commonly use rem/em
- `width`, `height`, `padding`, `margin` may use %, vh, vw
- Grid properties use fr units

### 1.6 Handle Special Cases

**calc() expressions:**
```css
width: calc(100% - 2rem);
height: calc(100vh - var(--header-height));
```

**CSS functions:**
```css
font-size: clamp(1rem, 2vw, 2rem);
width: min(100%, 1200px);
```

**Unitless values (must remain unitless):**
```css
line-height: 1.5;
z-index: 100;
flex: 1;
opacity: 0.8;
```

### 1.7 Add Unit Tests

**Location:** `tests/css-units.test.ts` (NEW)

```typescript
describe('CSS Unit Parsing', () => {
  test('parses pixel values', () => {
    expect(parseCSSValue('16px')).toEqual({ value: 16, unit: 'px', raw: '16px' })
  })

  test('parses rem values', () => {
    expect(parseCSSValue('1.5rem')).toEqual({ value: 1.5, unit: 'rem', raw: '1.5rem' })
  })

  test('parses percentage', () => {
    expect(parseCSSValue('100%')).toEqual({ value: 100, unit: '%', raw: '100%' })
  })

  test('parses viewport units', () => {
    expect(parseCSSValue('100vh')).toEqual({ value: 100, unit: 'vh', raw: '100vh' })
  })

  test('handles unitless values', () => {
    expect(parseCSSValue('1.5')).toEqual({ value: 1.5, unit: '', raw: '1.5' })
  })

  test('preserves calc expressions', () => {
    expect(parseCSSValue('calc(100% - 2rem)')).toEqual({
      value: NaN,
      unit: '',
      raw: 'calc(100% - 2rem)'
    })
  })
})

describe('Webflow Conversion with Units', () => {
  test('preserves rem in font-size', () => {
    const html = '<div style="font-size: 1.25rem;">Text</div>'
    const result = convertToWebflow(html)
    expect(result.styleLess).toContain('font-size: 1.25rem')
  })

  test('preserves vh in height', () => {
    const html = '<section style="height: 100vh;">Section</section>'
    const result = convertToWebflow(html)
    expect(result.styleLess).toContain('height: 100vh')
  })
})
```

## Webflow Unit Support Reference

| Unit | Webflow Support | Notes |
|------|-----------------|-------|
| px | Full | Default unit |
| rem | Full | Relative to root font-size |
| em | Full | Relative to parent font-size |
| % | Full | Percentage of parent |
| vh/vw | Full | Viewport units |
| vmin/vmax | Full | Viewport min/max |
| dvh/dvw | Partial | Dynamic viewport (newer browsers) |
| ch | Full | Character width |
| fr | Full | Grid fraction |
| calc() | Full | Calculations |
| clamp() | Full | Clamped values |
| min()/max() | Full | Min/max functions |

## Acceptance Criteria

- [ ] Import HTML with rem-based typography preserves rem values
- [ ] Import HTML with vh/vw sections preserves viewport units
- [ ] Import HTML with calc() expressions preserves calculations
- [ ] Import HTML with clamp() preserves responsive sizing
- [ ] Unitless values (line-height, z-index) remain unitless
- [ ] No "px" suffix added to unitless values
- [ ] Webflow paste renders correctly with original units

## Estimated Complexity

- Investigation: Low
- Implementation: Medium
- Testing: Medium

## Dependencies

None - this is foundational work that improves all import flows.

## Related Plans

This work benefits:
- Action Plan 2 (HTML Import Improvements)
- Action Plan 4 (React Conversion)

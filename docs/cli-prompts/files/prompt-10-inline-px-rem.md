# PROMPT 10: Inline Style PX→REM Conversion

**Priority:** CRITICAL  
**Complexity:** Low  
**Estimated Time:** 20 minutes  
**Coverage Impact:** +1%

---

## Context

The CSS parser already converts PX to REM in stylesheets, but HTML inline styles (`style="width: 100px"`) are passed through unchanged. This creates inconsistency between stylesheet-defined styles and inline styles, and may cause issues with Webflow's responsive scaling.

---

## Requirements

### 1. Detect PX Values in Inline Styles

```html
<div style="width: 100px; padding: 16px 24px; margin-top: 32px;">
<span style="font-size: 14px; line-height: 20px;">
<img style="max-width: 400px; height: auto;">
```

### 2. Convert to REM (base 16px)

```html
<div style="width: 6.25rem; padding: 1rem 1.5rem; margin-top: 2rem;">
<span style="font-size: 0.875rem; line-height: 1.25rem;">
<img style="max-width: 25rem; height: auto;">
```

### 3. Conversion Formula

```
REM = PX / 16
```

Round to reasonable precision (3 decimal places max, remove trailing zeros).

### 4. Exceptions (Keep as PX)

- `border-width: 1px` - Single pixel borders
- `outline-width: 1px` - Single pixel outlines
- `box-shadow` with 1px values
- Any property already using rem, em, %, vw, vh, vmin, vmax, ch, ex

### 5. Properties to Convert

```typescript
const PX_CONVERTIBLE_PROPERTIES = [
  'width', 'min-width', 'max-width',
  'height', 'min-height', 'max-height',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'font-size',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-indent',
  'top', 'right', 'bottom', 'left',
  'gap', 'row-gap', 'column-gap',
  'border-radius',
  'inset',
  'flex-basis',
];
```

---

## Files to Modify

### Create utility in: `lib/css-parser.ts` or `lib/inline-style-converter.ts`

```typescript
/**
 * Convert PX values to REM in an inline style string
 * @param styleString - The value of a style attribute (e.g., "width: 100px; padding: 16px")
 * @param basePx - Base pixel value (default 16)
 * @returns Converted style string
 */
export function convertInlineStylePxToRem(
  styleString: string, 
  basePx: number = 16
): string;

/**
 * Convert a single PX value to REM
 * @param pxValue - Numeric value in pixels
 * @param basePx - Base pixel value (default 16)
 * @returns REM string (e.g., "1.5rem")
 */
export function pxToRem(pxValue: number, basePx: number = 16): string;

/**
 * Check if a property should have its PX values converted
 */
export function shouldConvertProperty(property: string): boolean;

/**
 * Check if a PX value should be kept as-is (e.g., 1px borders)
 */
export function shouldKeepAsPx(property: string, value: number): boolean;
```

### Modify: `lib/webflow-converter.ts`

Apply conversion when processing HTML nodes with style attributes:

```typescript
import { convertInlineStylePxToRem } from './css-parser'; // or inline-style-converter

// In node processing (around line 500-600 where attributes are handled)
function processNodeAttributes(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  
  for (const attr of element.attributes) {
    if (attr.name === 'style') {
      // Convert PX to REM in inline styles
      attrs.style = convertInlineStylePxToRem(attr.value);
    } else {
      attrs[attr.name] = attr.value;
    }
  }
  
  return attrs;
}
```

---

## Implementation Details

### Core Conversion Logic

```typescript
const PX_VALUE_PATTERN = /(-?\d*\.?\d+)px/g;

export function convertInlineStylePxToRem(
  styleString: string, 
  basePx: number = 16
): string {
  if (!styleString || !styleString.includes('px')) {
    return styleString;
  }

  // Parse into property-value pairs
  const declarations = styleString.split(';').filter(Boolean);
  const converted: string[] = [];

  for (const declaration of declarations) {
    const colonIndex = declaration.indexOf(':');
    if (colonIndex === -1) continue;

    const property = declaration.slice(0, colonIndex).trim().toLowerCase();
    let value = declaration.slice(colonIndex + 1).trim();

    if (shouldConvertProperty(property) && value.includes('px')) {
      value = value.replace(PX_VALUE_PATTERN, (match, pxNum) => {
        const px = parseFloat(pxNum);
        
        // Keep 1px values for borders
        if (shouldKeepAsPx(property, px)) {
          return match;
        }
        
        return pxToRem(px, basePx);
      });
    }

    converted.push(`${property}: ${value}`);
  }

  return converted.join('; ');
}

export function pxToRem(pxValue: number, basePx: number = 16): string {
  const rem = pxValue / basePx;
  
  // Round to 3 decimal places and remove trailing zeros
  const rounded = Math.round(rem * 1000) / 1000;
  const formatted = rounded.toString();
  
  return `${formatted}rem`;
}

export function shouldConvertProperty(property: string): boolean {
  const normalizedProp = property.toLowerCase().replace(/-/g, '');
  
  // Don't convert border-width, outline properties
  if (property.includes('border') && property.includes('width')) {
    return false;
  }
  if (property.includes('outline')) {
    return false;
  }
  
  return PX_CONVERTIBLE_PROPERTIES.some(p => 
    normalizedProp.includes(p.toLowerCase().replace(/-/g, ''))
  );
}

export function shouldKeepAsPx(property: string, value: number): boolean {
  // Keep 1px values for borders and outlines
  if (Math.abs(value) === 1) {
    if (property.includes('border') || property.includes('outline')) {
      return true;
    }
  }
  
  // Keep 0px (though it should be just 0)
  if (value === 0) {
    return true;
  }
  
  return false;
}
```

### Handling Shorthand Properties

```typescript
// padding: 16px 24px 16px 24px → padding: 1rem 1.5rem 1rem 1.5rem
// margin: 32px auto → margin: 2rem auto
// border-radius: 4px 8px → border-radius: 0.25rem 0.5rem

// The regex replacement handles multiple values automatically
// "16px 24px" → "1rem 1.5rem" (each px value replaced independently)
```

### Preserving Non-PX Units

```typescript
// Already in rem/em/% - no conversion
// "width: 50%" → "width: 50%" (unchanged)
// "font-size: 1.5rem" → "font-size: 1.5rem" (unchanged)
// "height: 100vh" → "height: 100vh" (unchanged)

// The regex only matches 'px', so other units pass through
```

---

## Test Cases

```typescript
describe('convertInlineStylePxToRem', () => {
  it('should convert simple px values', () => {
    expect(convertInlineStylePxToRem('width: 100px'))
      .toBe('width: 6.25rem');
  });

  it('should convert multiple properties', () => {
    expect(convertInlineStylePxToRem('width: 100px; height: 50px'))
      .toBe('width: 6.25rem; height: 3.125rem');
  });

  it('should handle shorthand properties', () => {
    expect(convertInlineStylePxToRem('padding: 16px 24px'))
      .toBe('padding: 1rem 1.5rem');
  });

  it('should keep 1px border values', () => {
    expect(convertInlineStylePxToRem('border-width: 1px'))
      .toBe('border-width: 1px');
  });

  it('should convert non-1px borders', () => {
    expect(convertInlineStylePxToRem('border-width: 2px'))
      .toBe('border-width: 0.125rem');
  });

  it('should preserve existing rem values', () => {
    expect(convertInlineStylePxToRem('font-size: 1.5rem'))
      .toBe('font-size: 1.5rem');
  });

  it('should preserve percentage values', () => {
    expect(convertInlineStylePxToRem('width: 50%'))
      .toBe('width: 50%');
  });

  it('should preserve vh/vw values', () => {
    expect(convertInlineStylePxToRem('height: 100vh'))
      .toBe('height: 100vh');
  });

  it('should handle mixed units', () => {
    expect(convertInlineStylePxToRem('width: 100px; height: 50%'))
      .toBe('width: 6.25rem; height: 50%');
  });

  it('should handle negative values', () => {
    expect(convertInlineStylePxToRem('margin-left: -16px'))
      .toBe('margin-left: -1rem');
  });

  it('should handle decimal px values', () => {
    expect(convertInlineStylePxToRem('font-size: 14.5px'))
      .toBe('font-size: 0.906rem');
  });

  it('should handle zero values', () => {
    expect(convertInlineStylePxToRem('margin: 0px'))
      .toBe('margin: 0px'); // Could also be '0rem' but 0px is valid
  });

  it('should not convert box-shadow 1px values', () => {
    // This is tricky - box-shadow has multiple px values
    // For now, we convert all non-1px values
    expect(convertInlineStylePxToRem('box-shadow: 0 2px 4px rgba(0,0,0,0.1)'))
      .toBe('box-shadow: 0 0.125rem 0.25rem rgba(0,0,0,0.1)');
  });

  it('should return unchanged if no px', () => {
    expect(convertInlineStylePxToRem('display: flex'))
      .toBe('display: flex');
  });

  it('should handle empty string', () => {
    expect(convertInlineStylePxToRem('')).toBe('');
  });

  it('should handle null/undefined', () => {
    expect(convertInlineStylePxToRem(null as any)).toBe(null);
  });
});

describe('pxToRem', () => {
  it('should convert common values', () => {
    expect(pxToRem(16)).toBe('1rem');
    expect(pxToRem(24)).toBe('1.5rem');
    expect(pxToRem(32)).toBe('2rem');
    expect(pxToRem(8)).toBe('0.5rem');
    expect(pxToRem(4)).toBe('0.25rem');
  });

  it('should handle odd values', () => {
    expect(pxToRem(14)).toBe('0.875rem');
    expect(pxToRem(18)).toBe('1.125rem');
  });

  it('should remove trailing zeros', () => {
    expect(pxToRem(16)).toBe('1rem'); // Not '1.000rem'
    expect(pxToRem(32)).toBe('2rem'); // Not '2.000rem'
  });
});
```

---

## Edge Cases

1. **Already converted**: Don't double-convert `1rem` to `0.0625rem`
2. **Calc functions**: `calc(100px - 16px)` → `calc(6.25rem - 1rem)`
3. **Custom properties**: `var(--spacing)` → unchanged
4. **Media query values in style**: N/A (inline styles don't have media queries)
5. **Important declarations**: `16px !important` → `1rem !important`

### Calc Handling

```typescript
// calc() needs special handling to convert internal px values
const CALC_PATTERN = /calc\(([^)]+)\)/g;

function convertCalcPx(calcExpression: string, basePx: number): string {
  return calcExpression.replace(PX_VALUE_PATTERN, (match, pxNum) => {
    return pxToRem(parseFloat(pxNum), basePx);
  });
}

// "calc(100px - 16px)" → "calc(6.25rem - 1rem)"
```

---

## Integration Checklist

- [ ] Add `convertInlineStylePxToRem()` function to `css-parser.ts` or new file
- [ ] Add `pxToRem()` utility function
- [ ] Add `shouldConvertProperty()` and `shouldKeepAsPx()` helpers
- [ ] Integrate into node attribute processing in `webflow-converter.ts`
- [ ] Handle `calc()` expressions
- [ ] Handle `!important` declarations
- [ ] Add unit tests for all conversion scenarios
- [ ] Test with real AI-generated HTML with inline styles

---

## Success Criteria

1. `width: 100px` → `width: 6.25rem`
2. `padding: 16px 24px` → `padding: 1rem 1.5rem`
3. `border-width: 1px` → `border-width: 1px` (unchanged)
4. `font-size: 1.5rem` → `font-size: 1.5rem` (unchanged)
5. `width: 50%` → `width: 50%` (unchanged)
6. `calc(100px - 16px)` → `calc(6.25rem - 1rem)`
7. No double-conversion of existing rem values
8. Proper rounding with minimal decimal places

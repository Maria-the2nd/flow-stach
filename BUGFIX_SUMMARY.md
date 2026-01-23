# Critical Bug Fixes for Webflow Designer Corruption

## Summary

Fixed two critical bugs that caused templates to corrupt Webflow Designer:

1. **clamp(), min(), max() CSS functions** - These functions passed through unchanged, causing Webflow Designer to fail parsing and corrupt the entire project
2. **Descendant selectors with elements** - Selectors like `.hero h1` were being skipped entirely, causing styles to be lost and elements to render incorrectly

## Bug 1: clamp(), min(), max() Function Handling

### Problem
- CSS functions like `clamp(48px, 10vw, 110px)` were passing through unchanged
- Webflow Designer cannot parse these functions
- This corrupted the entire project when pasting

### Solution
Added conversion logic in `sanitizeStyleLess()` function (lib/webflow-converter.ts:94-145):
- `clamp(min, preferred, max)` → converts to `max` value (safest fallback)
- `min(val1, val2, ...)` → converts to smallest value
- `max(val1, val2, ...)` → converts to largest value

### Example
**Before:**
```css
.hero { font-size: clamp(48px, 10vw, 110px); }
```

**After:**
```css
.hero { font-size: 110px; }
```

## Bug 2: Descendant Selector Handling

### Problem
- Descendant selectors like `.hero h1 { margin-bottom: 24px }` were being skipped entirely
- The `parseSelector` function couldn't extract a className from `h1` (it's not a class)
- Styles were lost, causing elements to render incorrectly

### Solution
Implemented three-layer fix:

#### 1. CSS Parser (lib/css-parser.ts:766-793)
Added `convertElementDescendantSelector()` helper function that:
- Detects selectors like `.hero h1`
- Maps elements to their Webflow class equivalents using `ELEMENT_TO_CLASS_MAP`
- Converts `.hero h1` → `.hero .heading-h1`

#### 2. Main Parsing Loop (lib/css-parser.ts:1024-1053)
- Applies conversion before processing rules in base, media queries, and min-width blocks
- Adds warnings about conversions for debugging

#### 3. Normalizer (lib/webflow-normalizer.ts:417-442)
- Updated to use `ELEMENT_TO_CLASS_MAP` for consistency
- Prevents creating incompatible "hero-h1" style classes

#### 4. Node Converter (lib/webflow-converter.ts:820-825)
- Automatically adds element mapped classes to nodes without explicit classes
- Ensures styles are collected and included in payload

### Example
**Before:**
```css
.hero h1 { margin-bottom: 24px; }  /* SKIPPED - styles lost */
```

**After:**
```css
.hero .heading-h1 { margin-bottom: 24px; }  /* Converted and applied */
```

## Element to Class Mapping

The following elements are automatically mapped:
- `h1` → `heading-h1`
- `h2` → `heading-h2`
- `h3` → `heading-h3`
- `h4` → `heading-h4`
- `h5` → `heading-h5`
- `h6` → `heading-h6`
- `p` → `text-body`
- `a` → `link`
- `body` → `wf-body`

## Files Modified

1. **lib/webflow-converter.ts**
   - Added clamp/min/max conversion in `sanitizeStyleLess()` (lines 94-145)
   - Imported `ELEMENT_TO_CLASS_MAP` (line 14)
   - Added element class mapping in node conversion (lines 820-825)
   - Added sanitization to `convertToWebflowStyles()` (lines 967-978)

2. **lib/css-parser.ts**
   - Added `convertElementDescendantSelector()` helper (lines 766-793)
   - Updated base rule parsing (lines 1037-1051)
   - Updated media query parsing (lines 1074-1086)
   - Updated min-width parsing (lines 1098-1108)

3. **lib/webflow-normalizer.ts**
   - Updated descendant selector handling to use `ELEMENT_TO_CLASS_MAP` (lines 417-442)

4. **tests/bug-fixes.test.ts** (new file)
   - Comprehensive tests for both bug fixes
   - Tests clamp(), min(), max() conversion
   - Tests descendant selector handling
   - Tests combined real-world scenarios

5. **tests/css-units.test.ts**
   - Updated clamp() test to reflect new behavior (lines 160-169)

## Testing

All tests pass:
- 28/28 CSS unit preservation tests ✓
- 8/8 Bug fix tests ✓
- Total: 36 tests, 82 assertions

### Test Coverage

**clamp() conversion:**
```typescript
const css = `.hero { font-size: clamp(48px, 10vw, 110px); }`;
// Result: font-size: 110px; (max value)
```

**Descendant selectors:**
```typescript
const css = `.hero h1 { margin-bottom: 24px; }`;
// Result: Creates heading-h1 class with styles
```

**Combined scenario:**
```typescript
const css = `
  .hero { padding: clamp(48px, 10vw, 110px); }
  .hero h1 { font-size: clamp(32px, 5vw, 72px); }
`;
// Result: Both clamp() converted, descendant styles preserved
```

## Warnings

The fixes generate informational warnings:
- "Converted clamp() in [property] to max value"
- "Converted descendant element selector .hero h1 to .hero .heading-h1"

These warnings are expected and help with debugging.

## Backwards Compatibility

- ✅ Existing styles without clamp() or descendant selectors work unchanged
- ✅ calc() function still passes through (Webflow supports it)
- ✅ All existing tests continue to pass

## Next Steps

1. Test with flow-bridge-bento.html to verify real-world scenarios
2. Monitor Webflow Designer for any remaining import issues
3. Consider adding user-facing documentation about these conversions

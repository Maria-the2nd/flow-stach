# PROMPT 11: CSS Minification for Embed Blocks

**Priority:** HIGH  
**Complexity:** Low  
**Estimated Time:** 20 minutes  
**Coverage Impact:** +0.5%

---

## Context

Webflow embed blocks have character limits (soft warning at ~10KB, hard errors at larger sizes). Currently, the CSS routed to embeds includes whitespace, newlines, and comments—wasting precious characters. Minifying the embed CSS can reduce size by 20-40%, allowing more complex styles to fit within limits.

---

## Requirements

### 1. Minification Rules

| Rule | Before | After |
|------|--------|-------|
| Remove comments | `/* comment */` | (removed) |
| Remove newlines | `\n` | (removed) |
| Collapse whitespace | `   ` | ` ` |
| Remove space after `:` | `color: red` | `color:red` |
| Remove space before `{` | `.class {` | `.class{` |
| Remove space after `{` | `{ color` | `{color` |
| Remove space before `}` | `red }` | `red}` |
| Remove space after `;` | `; color` | `;color` |
| Remove last semicolon | `red;}` | `red}` |
| Keep space in values | `rgb(0, 0, 0)` | `rgb(0,0,0)` |

### 2. Before Minification (847 chars)

```css
.hero::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* Background overlay for better text readability */
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.3),
    rgba(0, 0, 0, 0.7)
  );
  z-index: 1;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 3. After Minification (389 chars, 54% reduction)

```css
.hero::before{content:"";position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(to bottom,rgba(0,0,0,0.3),rgba(0,0,0,0.7));z-index:1}@keyframes fadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
```

### 4. Preserve Content Strings

```css
/* MUST preserve spaces inside content strings */
content: "Hello World";  /* → content:"Hello World" */
content: attr(data-text); /* → content:attr(data-text) */
```

### 5. Preserve URL Strings

```css
/* MUST preserve URLs */
background: url("https://example.com/image.png");
/* → background:url("https://example.com/image.png") */
```

---

## Files to Modify

### Add to: `lib/css-embed-router.ts`

```typescript
/**
 * Minify CSS for embed blocks to maximize character limit usage
 * @param css - CSS string to minify
 * @returns Minified CSS string
 */
export function minifyCSS(css: string): string;

/**
 * Get size reduction stats
 */
export interface MinificationStats {
  originalSize: number;
  minifiedSize: number;
  reduction: number;        // Bytes saved
  reductionPercent: number; // Percentage reduction
}

export function minifyCSSWithStats(css: string): {
  css: string;
  stats: MinificationStats;
};
```

### Update: `wrapEmbedCSSInStyleTag()` function

```typescript
export function wrapEmbedCSSInStyleTag(css: string, minify: boolean = true): string {
  const processedCSS = minify ? minifyCSS(css) : css;
  return `<style>${processedCSS}</style>`;
}
```

---

## Implementation Details

### Core Minification Logic

```typescript
export function minifyCSS(css: string): string {
  if (!css || !css.trim()) {
    return '';
  }

  let result = css;

  // Step 1: Preserve strings (content, url) by replacing with placeholders
  const strings: string[] = [];
  result = result.replace(/(["'])(?:(?!\1)[^\\]|\\.)*\1/g, (match) => {
    strings.push(match);
    return `__STRING_${strings.length - 1}__`;
  });

  // Step 2: Remove comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');

  // Step 3: Remove newlines and collapse whitespace
  result = result.replace(/\s+/g, ' ');

  // Step 4: Remove spaces around special characters
  result = result.replace(/\s*{\s*/g, '{');
  result = result.replace(/\s*}\s*/g, '}');
  result = result.replace(/\s*;\s*/g, ';');
  result = result.replace(/\s*:\s*/g, ':');
  result = result.replace(/\s*,\s*/g, ',');

  // Step 5: Remove trailing semicolons before closing braces
  result = result.replace(/;}/g, '}');

  // Step 6: Restore preserved strings
  result = result.replace(/__STRING_(\d+)__/g, (_, index) => {
    return strings[parseInt(index, 10)];
  });

  // Step 7: Trim
  return result.trim();
}

export function minifyCSSWithStats(css: string): {
  css: string;
  stats: MinificationStats;
} {
  const originalSize = new Blob([css]).size;
  const minified = minifyCSS(css);
  const minifiedSize = new Blob([minified]).size;
  
  return {
    css: minified,
    stats: {
      originalSize,
      minifiedSize,
      reduction: originalSize - minifiedSize,
      reductionPercent: Math.round((1 - minifiedSize / originalSize) * 100),
    },
  };
}
```

### String Preservation Pattern

```typescript
// This regex matches quoted strings while handling escaped quotes
// "hello \"world\"" → preserved as-is
// 'single quotes' → preserved as-is
const STRING_PATTERN = /(["'])(?:(?!\1)[^\\]|\\.)*\1/g;
```

### Integration with Embed Router

```typescript
// In routeCSS() or generateEmbedCSS()
export function generateEmbedBlock(embedCSS: string, options?: {
  minify?: boolean;
  wrapInStyleTag?: boolean;
}): { html: string; stats?: MinificationStats } {
  const { minify = true, wrapInStyleTag = true } = options || {};
  
  let css = embedCSS;
  let stats: MinificationStats | undefined;
  
  if (minify) {
    const result = minifyCSSWithStats(css);
    css = result.css;
    stats = result.stats;
    
    // Log reduction
    console.log(`Embed CSS minified: ${stats.originalSize} → ${stats.minifiedSize} chars (${stats.reductionPercent}% reduction)`);
  }
  
  const html = wrapInStyleTag ? `<style>${css}</style>` : css;
  
  return { html, stats };
}
```

---

## Test Cases

```typescript
describe('minifyCSS', () => {
  it('should remove comments', () => {
    const css = `.btn { /* button styles */ color: red; }`;
    expect(minifyCSS(css)).toBe('.btn{color:red}');
  });

  it('should collapse whitespace', () => {
    const css = `.btn {
      color:    red;
      margin:   10px;
    }`;
    expect(minifyCSS(css)).toBe('.btn{color:red;margin:10px}');
  });

  it('should remove spaces around special chars', () => {
    const css = `.btn { color : red ; }`;
    expect(minifyCSS(css)).toBe('.btn{color:red}');
  });

  it('should remove trailing semicolons', () => {
    const css = `.btn{color:red;}`;
    expect(minifyCSS(css)).toBe('.btn{color:red}');
  });

  it('should preserve content strings', () => {
    const css = `.btn::before { content: "Hello World"; }`;
    expect(minifyCSS(css)).toBe('.btn::before{content:"Hello World"}');
  });

  it('should preserve URL strings', () => {
    const css = `.bg { background: url("https://example.com/img.png"); }`;
    expect(minifyCSS(css)).toBe('.bg{background:url("https://example.com/img.png")}');
  });

  it('should preserve escaped quotes in strings', () => {
    const css = `.tooltip::after { content: "Say \\"Hello\\""; }`;
    expect(minifyCSS(css)).toBe('.tooltip::after{content:"Say \\"Hello\\""}');
  });

  it('should handle @keyframes', () => {
    const css = `@keyframes fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }`;
    expect(minifyCSS(css)).toBe('@keyframes fade{from{opacity:0}to{opacity:1}}');
  });

  it('should handle @media queries', () => {
    const css = `@media (max-width: 768px) {
      .btn { color: blue; }
    }`;
    expect(minifyCSS(css)).toBe('@media(max-width:768px){.btn{color:blue}}');
  });

  it('should handle multiple selectors', () => {
    const css = `.btn, .link, .nav { color: red; }`;
    expect(minifyCSS(css)).toBe('.btn,.link,.nav{color:red}');
  });

  it('should handle rgb/rgba values', () => {
    const css = `.box { color: rgba(0, 0, 0, 0.5); }`;
    expect(minifyCSS(css)).toBe('.box{color:rgba(0,0,0,0.5)}');
  });

  it('should handle calc values', () => {
    const css = `.box { width: calc(100% - 20px); }`;
    expect(minifyCSS(css)).toBe('.box{width:calc(100% - 20px)}');
    // Note: spaces in calc are significant for operators
  });

  it('should return empty string for empty input', () => {
    expect(minifyCSS('')).toBe('');
    expect(minifyCSS('   ')).toBe('');
  });

  it('should handle complex real-world CSS', () => {
    const css = `
      /* Hero section overlay */
      .hero::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        background: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0.3),
          rgba(0, 0, 0, 0.7)
        );
      }
    `;
    const minified = minifyCSS(css);
    expect(minified).not.toContain('/*');
    expect(minified).not.toContain('\n');
    expect(minified).toContain('content:""');
    expect(minified).toContain('linear-gradient(to bottom,rgba(0,0,0,0.3),rgba(0,0,0,0.7))');
  });
});

describe('minifyCSSWithStats', () => {
  it('should return size reduction stats', () => {
    const css = `.btn { color: red; margin: 10px; }`;
    const result = minifyCSSWithStats(css);
    
    expect(result.stats.originalSize).toBeGreaterThan(result.stats.minifiedSize);
    expect(result.stats.reduction).toBeGreaterThan(0);
    expect(result.stats.reductionPercent).toBeGreaterThan(0);
  });

  it('should report accurate percentages', () => {
    // A string with lots of whitespace should have high reduction
    const css = `
      .btn {
        color:     red;
        margin:    10px;
        padding:   20px;
      }
    `;
    const result = minifyCSSWithStats(css);
    expect(result.stats.reductionPercent).toBeGreaterThan(30);
  });
});
```

---

## Edge Cases

1. **calc() with spaces**: `calc(100% - 20px)` - spaces around operators are significant
   - Solution: Don't remove spaces inside `calc()`
   
2. **Font family names**: `font-family: "Open Sans", sans-serif`
   - Solution: Strings are preserved

3. **Data URIs**: `url(data:image/png;base64,...)`
   - Solution: Treat as URL, preserve

4. **Empty rules**: `.unused { }` after minification
   - Solution: Optionally remove empty rules

5. **!important**: `color: red !important`
   - Solution: Keep space before `!important`

### Handling calc()

```typescript
// Preserve spaces around + and - in calc (they're required)
// But remove around * and / (they're optional)
function preserveCalcSpaces(css: string): string {
  return css.replace(/calc\([^)]+\)/g, (match) => {
    // Mark spaces around + and - with placeholder
    return match
      .replace(/(\d)\s*\+\s*/g, '$1 + ')
      .replace(/(\d)\s*-\s*/g, '$1 - ');
  });
}
```

---

## UI Display

Show minification stats in the admin import page:

```
┌─────────────────────────────────────────────────────────────┐
│ 📦 Embed CSS Minified                                       │
├─────────────────────────────────────────────────────────────┤
│ Original:  2,450 chars                                      │
│ Minified:  1,890 chars                                      │
│ Saved:     560 chars (23% reduction)                        │
│ Status:    ✅ Under 10KB limit                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration Checklist

- [ ] Add `minifyCSS()` function to `css-embed-router.ts`
- [ ] Add `minifyCSSWithStats()` for reporting
- [ ] Implement string preservation for `content` and `url()`
- [ ] Handle escaped quotes in strings
- [ ] Preserve spaces in `calc()` expressions
- [ ] Update `wrapEmbedCSSInStyleTag()` to use minification
- [ ] Add minification toggle option (default: true)
- [ ] Display stats in admin import page
- [ ] Add unit tests for all scenarios
- [ ] Test with real embed CSS from converted components

---

## Success Criteria

1. Comments removed completely
2. Whitespace collapsed to minimum
3. Content strings preserved with internal spaces
4. URL strings preserved
5. calc() spaces preserved where required
6. Size reduction of 20-40% on typical CSS
7. Stats accurately reported
8. No functional changes to CSS behavior

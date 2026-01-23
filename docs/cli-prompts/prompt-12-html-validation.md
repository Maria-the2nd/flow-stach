# PROMPT 12: HTML Structure Validation

**Priority:** HIGH  
**Complexity:** Low  
**Estimated Time:** 20 minutes  
**Coverage Impact:** +1%

---

## Context

Certain HTML patterns cause issues when pasted into Webflow or create accessibility/SEO problems. We need to detect and warn about these patterns during conversion:

1. **Nested forms** - Invalid HTML that breaks form submission
2. **Missing alt attributes** - Accessibility violation
3. **Duplicate IDs** - Causes JavaScript targeting issues (partially implemented)
4. **Empty links** - Accessibility and SEO issue
5. **Invalid nesting** - e.g., `<p>` containing block elements

---

## Requirements

### 1. Nested Form Detection (ERROR)

```html
<!-- INVALID: nested forms -->
<form action="/submit">
  <form action="/inner">  <!-- ERROR -->
    <input type="text">
  </form>
</form>
```

Nested forms are invalid HTML and will cause unpredictable behavior in Webflow.

### 2. Missing Alt Attribute (WARNING)

```html
<!-- WARNING: missing alt -->
<img src="photo.jpg">

<!-- OK: empty alt is valid (decorative image) -->
<img src="decoration.jpg" alt="">

<!-- OK: has alt text -->
<img src="photo.jpg" alt="A sunset over mountains">
```

### 3. Empty Links (WARNING)

```html
<!-- WARNING: empty link -->
<a href="/page"></a>

<!-- WARNING: link with only whitespace -->
<a href="/page">   </a>

<!-- OK: has content -->
<a href="/page">Click here</a>

<!-- OK: has aria-label -->
<a href="/page" aria-label="Go to page"></a>

<!-- OK: has child with content -->
<a href="/page"><img src="icon.png" alt="Icon"></a>
```

### 4. Invalid Block in Inline (WARNING)

```html
<!-- WARNING: div inside span -->
<span><div>content</div></span>

<!-- WARNING: div inside p -->
<p><div>content</div></p>

<!-- OK -->
<div><p>content</p></div>
```

### 5. Deprecated Elements (INFO)

```html
<!-- INFO: deprecated element -->
<center>content</center>
<font color="red">text</font>
<marquee>scrolling</marquee>
```

---

## Files to Create/Modify

### Add to: `lib/html-validator.ts` (NEW) or `lib/preflight-validator.ts`

```typescript
/**
 * HTML Structure Validation
 * Detects problematic HTML patterns before Webflow conversion
 */

export interface HTMLValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  element?: string;      // Tag name
  line?: number;         // Approximate line number
  suggestion?: string;
}

// Main validation functions
export function validateHTMLStructure(html: string): HTMLValidationResult;
export function detectNestedForms(html: string): ValidationIssue[];
export function detectMissingAlt(html: string): ValidationIssue[];
export function detectEmptyLinks(html: string): ValidationIssue[];
export function detectInvalidNesting(html: string): ValidationIssue[];
export function detectDeprecatedElements(html: string): ValidationIssue[];
```

---

## Implementation Details

### Nested Form Detection

```typescript
export function detectNestedForms(html: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // Simple approach: count open/close form tags
  let formDepth = 0;
  const formPattern = /<\/?form\b[^>]*>/gi;
  let match;
  
  while ((match = formPattern.exec(html)) !== null) {
    const tag = match[0].toLowerCase();
    
    if (tag.startsWith('<form') && !tag.includes('/>')) {
      formDepth++;
      if (formDepth > 1) {
        issues.push({
          severity: 'error',
          code: 'HTML_NESTED_FORM',
          message: 'Nested <form> element detected - forms cannot be nested',
          element: 'form',
          line: getLineNumber(html, match.index),
          suggestion: 'Remove the inner form or restructure to avoid nesting',
        });
      }
    } else if (tag.startsWith('</form')) {
      formDepth = Math.max(0, formDepth - 1);
    }
  }
  
  return issues;
}
```

### Missing Alt Detection

```typescript
export function detectMissingAlt(html: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // Match <img> tags
  const imgPattern = /<img\b[^>]*>/gi;
  let match;
  
  while ((match = imgPattern.exec(html)) !== null) {
    const imgTag = match[0];
    
    // Check if alt attribute exists
    const hasAlt = /\balt\s*=/i.test(imgTag);
    
    if (!hasAlt) {
      // Extract src for context
      const srcMatch = imgTag.match(/src\s*=\s*["']([^"']+)["']/i);
      const src = srcMatch ? srcMatch[1] : 'unknown';
      
      issues.push({
        severity: 'warning',
        code: 'HTML_MISSING_ALT',
        message: `Image missing alt attribute: ${truncate(src, 50)}`,
        element: 'img',
        line: getLineNumber(html, match.index),
        suggestion: 'Add alt="" for decorative images or descriptive text for meaningful images',
      });
    }
  }
  
  return issues;
}
```

### Empty Links Detection

```typescript
export function detectEmptyLinks(html: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // Match <a>...</a> including content
  const linkPattern = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  
  while ((match = linkPattern.exec(html)) !== null) {
    const [fullMatch, content] = match;
    const anchorTag = fullMatch.match(/<a\b[^>]*>/i)?.[0] || '';
    
    // Check if has aria-label
    const hasAriaLabel = /\baria-label\s*=/i.test(anchorTag);
    
    // Check if content is empty or whitespace-only
    const trimmedContent = content.trim();
    const hasContent = trimmedContent.length > 0;
    
    // Check if contains img with alt
    const hasImgWithAlt = /<img[^>]*\balt\s*=\s*["'][^"']+["'][^>]*>/i.test(content);
    
    if (!hasAriaLabel && !hasContent && !hasImgWithAlt) {
      issues.push({
        severity: 'warning',
        code: 'HTML_EMPTY_LINK',
        message: 'Empty link without accessible text',
        element: 'a',
        line: getLineNumber(html, match.index),
        suggestion: 'Add text content or aria-label for accessibility',
      });
    }
  }
  
  return issues;
}
```

### Invalid Nesting Detection

```typescript
const INLINE_ELEMENTS = new Set([
  'span', 'a', 'strong', 'em', 'b', 'i', 'u', 'small', 'sub', 'sup',
  'abbr', 'cite', 'code', 'kbd', 'mark', 'q', 's', 'samp', 'var',
]);

const BLOCK_ELEMENTS = new Set([
  'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'section', 'article', 'aside', 'header', 'footer', 'nav', 'main',
  'table', 'form', 'fieldset', 'blockquote', 'pre', 'hr', 'figure',
]);

export function detectInvalidNesting(html: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // Pattern to detect inline elements containing block elements
  // This is simplified - a full parser would be more accurate
  
  for (const inline of INLINE_ELEMENTS) {
    const pattern = new RegExp(
      `<${inline}\\b[^>]*>[\\s\\S]*?<(${[...BLOCK_ELEMENTS].join('|')})\\b`,
      'gi'
    );
    
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const blockElement = match[1].toLowerCase();
      issues.push({
        severity: 'warning',
        code: 'HTML_INVALID_NESTING',
        message: `Block element <${blockElement}> inside inline element <${inline}>`,
        element: inline,
        line: getLineNumber(html, match.index),
        suggestion: `Move <${blockElement}> outside of <${inline}> or use <div> instead of <${inline}>`,
      });
    }
  }
  
  // Special case: anything inside <p> that's a block element
  const pBlockPattern = /<p\b[^>]*>[\s\S]*?<(div|section|article|header|footer|ul|ol|table|form|blockquote)\b/gi;
  let pMatch;
  while ((pMatch = pBlockPattern.exec(html)) !== null) {
    const blockElement = pMatch[1].toLowerCase();
    issues.push({
      severity: 'warning',
      code: 'HTML_INVALID_NESTING',
      message: `Block element <${blockElement}> inside <p> element`,
      element: 'p',
      line: getLineNumber(html, pMatch.index),
      suggestion: `Close the <p> before <${blockElement}> or restructure the HTML`,
    });
  }
  
  return issues;
}
```

### Deprecated Elements Detection

```typescript
const DEPRECATED_ELEMENTS = {
  'center': 'Use CSS text-align: center instead',
  'font': 'Use CSS font properties instead',
  'marquee': 'Use CSS animations instead',
  'blink': 'This element is not supported',
  'big': 'Use CSS font-size instead',
  'strike': 'Use <del> or <s> instead',
  'tt': 'Use <code> or CSS font-family: monospace instead',
  'frame': 'Use <iframe> instead',
  'frameset': 'Framesets are not supported',
  'noframes': 'Not needed - framesets are not supported',
  'applet': 'Use <object> or modern web technologies',
  'basefont': 'Use CSS instead',
  'dir': 'Use <ul> instead',
  'isindex': 'Use <form> and <input> instead',
  'menu': 'Use <ul> with appropriate styling',
};

export function detectDeprecatedElements(html: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  for (const [element, suggestion] of Object.entries(DEPRECATED_ELEMENTS)) {
    const pattern = new RegExp(`<${element}\\b`, 'gi');
    let match;
    
    while ((match = pattern.exec(html)) !== null) {
      issues.push({
        severity: 'info',
        code: 'HTML_DEPRECATED_ELEMENT',
        message: `Deprecated element <${element}> detected`,
        element,
        line: getLineNumber(html, match.index),
        suggestion,
      });
    }
  }
  
  return issues;
}
```

### Master Validation Function

```typescript
export function validateHTMLStructure(html: string): HTMLValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];
  
  // Run all detectors
  const nestedForms = detectNestedForms(html);
  const missingAlts = detectMissingAlt(html);
  const emptyLinks = detectEmptyLinks(html);
  const invalidNesting = detectInvalidNesting(html);
  const deprecated = detectDeprecatedElements(html);
  
  // Sort into severity buckets
  [...nestedForms, ...missingAlts, ...emptyLinks, ...invalidNesting, ...deprecated]
    .forEach(issue => {
      switch (issue.severity) {
        case 'error': errors.push(issue); break;
        case 'warning': warnings.push(issue); break;
        case 'info': info.push(issue); break;
      }
    });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    info,
  };
}
```

### Utility Functions

```typescript
function getLineNumber(html: string, index: number): number {
  const upToIndex = html.slice(0, index);
  return (upToIndex.match(/\n/g) || []).length + 1;
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
```

---

## Test Cases

```typescript
describe('detectNestedForms', () => {
  it('should detect nested forms', () => {
    const html = `<form><form></form></form>`;
    const issues = detectNestedForms(html);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].code).toBe('HTML_NESTED_FORM');
  });

  it('should allow sequential forms', () => {
    const html = `<form></form><form></form>`;
    const issues = detectNestedForms(html);
    expect(issues).toHaveLength(0);
  });

  it('should allow single form', () => {
    const html = `<form><input type="text"></form>`;
    const issues = detectNestedForms(html);
    expect(issues).toHaveLength(0);
  });
});

describe('detectMissingAlt', () => {
  it('should detect missing alt', () => {
    const html = `<img src="photo.jpg">`;
    const issues = detectMissingAlt(html);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('HTML_MISSING_ALT');
  });

  it('should allow empty alt', () => {
    const html = `<img src="photo.jpg" alt="">`;
    const issues = detectMissingAlt(html);
    expect(issues).toHaveLength(0);
  });

  it('should allow descriptive alt', () => {
    const html = `<img src="photo.jpg" alt="A beautiful sunset">`;
    const issues = detectMissingAlt(html);
    expect(issues).toHaveLength(0);
  });
});

describe('detectEmptyLinks', () => {
  it('should detect empty links', () => {
    const html = `<a href="/page"></a>`;
    const issues = detectEmptyLinks(html);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('HTML_EMPTY_LINK');
  });

  it('should detect whitespace-only links', () => {
    const html = `<a href="/page">   </a>`;
    const issues = detectEmptyLinks(html);
    expect(issues).toHaveLength(1);
  });

  it('should allow links with text', () => {
    const html = `<a href="/page">Click here</a>`;
    const issues = detectEmptyLinks(html);
    expect(issues).toHaveLength(0);
  });

  it('should allow links with aria-label', () => {
    const html = `<a href="/page" aria-label="Go to page"></a>`;
    const issues = detectEmptyLinks(html);
    expect(issues).toHaveLength(0);
  });

  it('should allow links with image having alt', () => {
    const html = `<a href="/page"><img src="icon.png" alt="Icon"></a>`;
    const issues = detectEmptyLinks(html);
    expect(issues).toHaveLength(0);
  });
});

describe('detectInvalidNesting', () => {
  it('should detect div inside span', () => {
    const html = `<span><div>content</div></span>`;
    const issues = detectInvalidNesting(html);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('HTML_INVALID_NESTING');
  });

  it('should detect div inside p', () => {
    const html = `<p><div>content</div></p>`;
    const issues = detectInvalidNesting(html);
    expect(issues).toHaveLength(1);
  });

  it('should allow valid nesting', () => {
    const html = `<div><p><span>content</span></p></div>`;
    const issues = detectInvalidNesting(html);
    expect(issues).toHaveLength(0);
  });
});

describe('detectDeprecatedElements', () => {
  it('should detect deprecated elements', () => {
    const html = `<center>content</center>`;
    const issues = detectDeprecatedElements(html);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('HTML_DEPRECATED_ELEMENT');
    expect(issues[0].severity).toBe('info');
  });

  it('should detect multiple deprecated elements', () => {
    const html = `<center><font color="red">text</font></center>`;
    const issues = detectDeprecatedElements(html);
    expect(issues).toHaveLength(2);
  });
});
```

---

## Integration

### Add to `lib/preflight-validator.ts`

```typescript
import { validateHTMLStructure } from './html-validator';

// In runPreflightValidation()
const htmlValidation = validateHTMLStructure(html);

if (htmlValidation.errors.length > 0) {
  results.errors.push(...htmlValidation.errors);
}
results.warnings.push(...htmlValidation.warnings);
results.info.push(...htmlValidation.info);
```

---

## Success Criteria

1. Nested forms flagged as ERROR
2. Missing alt attributes flagged as WARNING
3. Empty links flagged as WARNING (unless has aria-label)
4. Invalid nesting (block in inline) flagged as WARNING
5. Deprecated elements flagged as INFO
6. Line numbers included where possible
7. Clear suggestions for fixing each issue
8. No false positives on valid HTML

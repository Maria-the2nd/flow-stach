# PROMPT 8: JavaScript ↔ HTML Cross-Reference Validation

**Priority:** CRITICAL  
**Complexity:** Medium  
**Estimated Time:** 1 hour  
**Coverage Impact:** +2%

---

## Context

When JavaScript references DOM elements by ID or class that don't exist in the HTML, the pasted Webflow component will have broken interactivity. Currently, Flow Bridge detects libraries and generates CDN links but doesn't validate that the JavaScript's DOM queries will actually find elements.

This is a common failure mode: AI-generated code often has mismatched IDs/classes between HTML and JS, or the user pastes only part of a component.

---

## Requirements

### 1. Extract DOM References from JavaScript

Detect and extract these patterns:

```javascript
// ID References
document.getElementById('header')           // → 'header'
document.querySelector('#header')           // → 'header' (ID)
document.querySelector('#nav-menu')         // → 'nav-menu' (ID)
$('#header')                               // → 'header' (jQuery ID)
$('#nav-menu')                             // → 'nav-menu' (jQuery ID)

// Class References
document.querySelector('.btn')              // → 'btn' (class)
document.querySelectorAll('.card')          // → 'card' (class)
document.getElementsByClassName('active')   // → 'active' (class)
$('.btn')                                  // → 'btn' (jQuery class)
$('.card-item')                            // → 'card-item' (jQuery class)

// Class Manipulation
element.classList.add('active')            // → 'active'
element.classList.remove('hidden')         // → 'hidden'
element.classList.toggle('open')           // → 'open'
element.classList.contains('selected')     // → 'selected'
element.className = 'new-class'            // → 'new-class'

// Data Attributes (bonus)
element.dataset.id                         // → data-id attribute
document.querySelector('[data-action]')    // → data-action attribute
```

### 2. Extract Targets from HTML

Parse HTML to extract:
- All `id="xxx"` attributes → Set of IDs
- All `class="xxx yyy zzz"` attributes → Set of classes (split by whitespace)
- All `data-*` attributes → Set of data attribute names

### 3. Cross-Reference Validation

Compare JS references against HTML targets:

| Scenario | Severity | Action |
|----------|----------|--------|
| JS references ID not in HTML | ERROR | "JavaScript references #footer but no element with id='footer' exists" |
| JS references class not in HTML | WARNING | "JavaScript references .modal but no element with class='modal' exists" |
| JS manipulates class not in HTML | INFO | "JavaScript adds class 'active' which doesn't exist in HTML (may be intentional)" |
| JS references data attribute not in HTML | WARNING | "JavaScript references [data-id] but no element has data-id attribute" |

### 4. Skip Dynamic References

Don't flag these as errors (can't statically resolve):

```javascript
// Template literals with variables
document.getElementById(`item-${id}`)       // Skip
document.querySelector(`#${dynamicId}`)     // Skip

// Variable references
document.getElementById(myVariable)         // Skip
document.querySelector(selectorVar)         // Skip

// String concatenation
document.getElementById('item-' + index)   // Skip
$('#' + prefix + '-menu')                  // Skip

// Computed property access
elements[className]                        // Skip
```

### 5. Skip Commented Code

Don't extract references from:
```javascript
// document.getElementById('old-element')  // Skip (single-line comment)

/* 
document.querySelector('.deprecated')       // Skip (multi-line comment)
*/
```

---

## Files to Create/Modify

### Create: `lib/js-html-xref.ts`

```typescript
/**
 * JavaScript ↔ HTML Cross-Reference Validator
 * Detects orphan DOM references that will cause runtime errors
 */

export interface JSReference {
  type: 'id' | 'class' | 'data-attribute';
  value: string;
  pattern: string;      // The matched pattern (for debugging)
  line?: number;        // Line number in JS (if available)
  isDynamic: boolean;   // True if contains variables/template literals
}

export interface HTMLTarget {
  type: 'id' | 'class' | 'data-attribute';
  value: string;
  element?: string;     // Tag name (div, span, etc.)
  line?: number;
}

export interface XRefResult {
  // Extracted references
  jsIdReferences: JSReference[];
  jsClassReferences: JSReference[];
  jsDataReferences: JSReference[];
  jsClassManipulations: JSReference[];  // classList.add/remove/toggle
  
  // Extracted targets
  htmlIds: HTMLTarget[];
  htmlClasses: HTMLTarget[];
  htmlDataAttributes: HTMLTarget[];
  
  // Validation results
  orphanIds: string[];           // ERROR level
  orphanClasses: string[];       // WARNING level
  orphanDataAttrs: string[];     // WARNING level
  manipulatedClasses: string[];  // INFO level (classList.add etc.)
  
  // Summary
  isValid: boolean;              // False if any ERROR-level issues
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
  info: ValidationMessage[];
}

export interface ValidationMessage {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  jsReference?: string;
  suggestion?: string;
}

// Main functions
export function extractJSReferences(jsCode: string): {
  ids: JSReference[];
  classes: JSReference[];
  dataAttrs: JSReference[];
  classManipulations: JSReference[];
};

export function extractHTMLTargets(html: string): {
  ids: HTMLTarget[];
  classes: HTMLTarget[];
  dataAttrs: HTMLTarget[];
};

export function validateJSHTMLReferences(html: string, js: string): XRefResult;
```

### Modify: `lib/preflight-validator.ts`

Add cross-reference validation to the preflight checks:

```typescript
import { validateJSHTMLReferences } from './js-html-xref';

// In runPreflightValidation()
if (jsCode && jsCode.trim()) {
  const xrefResult = validateJSHTMLReferences(html, jsCode);
  
  if (xrefResult.orphanIds.length > 0) {
    results.errors.push(...xrefResult.errors);
  }
  
  if (xrefResult.orphanClasses.length > 0) {
    results.warnings.push(...xrefResult.warnings);
  }
  
  results.info.push(...xrefResult.info);
  results.meta.xrefValidation = xrefResult;
}
```

### Modify: `lib/webflow-converter.ts`

Add xref results to payload meta:

```typescript
// In WebflowPayload.meta interface
xrefValidation?: {
  isValid: boolean;
  orphanIds: string[];
  orphanClasses: string[];
  errorCount: number;
  warningCount: number;
};
```

---

## Implementation Details

### JS Reference Extraction Regex

```typescript
// Strip comments first
function stripJSComments(code: string): string {
  // Remove single-line comments
  code = code.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments
  code = code.replace(/\/\*[\s\S]*?\*\//g, '');
  return code;
}

// ID reference patterns
const ID_PATTERNS = [
  // getElementById('id') or getElementById("id")
  /document\.getElementById\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  
  // querySelector('#id')
  /document\.querySelector\s*\(\s*['"]#([^'"]+)['"]\s*\)/g,
  
  // jQuery $('#id')
  /\$\s*\(\s*['"]#([^'"]+)['"]\s*\)/g,
];

// Class reference patterns
const CLASS_PATTERNS = [
  // querySelector('.class')
  /document\.querySelector\s*\(\s*['"]\.([a-zA-Z_-][a-zA-Z0-9_-]*)['"]\s*\)/g,
  
  // querySelectorAll('.class')
  /document\.querySelectorAll\s*\(\s*['"]\.([a-zA-Z_-][a-zA-Z0-9_-]*)['"]\s*\)/g,
  
  // getElementsByClassName('class')
  /document\.getElementsByClassName\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  
  // jQuery $('.class')
  /\$\s*\(\s*['"]\.([a-zA-Z_-][a-zA-Z0-9_-]*)['"]\s*\)/g,
];

// Class manipulation patterns
const CLASS_MANIPULATION_PATTERNS = [
  // classList.add('class')
  /\.classList\.add\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  
  // classList.remove('class')
  /\.classList\.remove\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  
  // classList.toggle('class')
  /\.classList\.toggle\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  
  // classList.contains('class')
  /\.classList\.contains\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

// Dynamic reference detection (to skip)
const DYNAMIC_PATTERNS = [
  /\$\{[^}]+\}/,           // Template literal
  /['"][^'"]*\s*\+/,       // String concatenation start
  /\+\s*['"][^'"]*['"]/,   // String concatenation end
];

function isDynamic(pattern: string): boolean {
  return DYNAMIC_PATTERNS.some(p => p.test(pattern));
}
```

### HTML Target Extraction

```typescript
// ID extraction
const HTML_ID_PATTERN = /id\s*=\s*["']([^"']+)["']/gi;

// Class extraction (needs to split by whitespace)
const HTML_CLASS_PATTERN = /class\s*=\s*["']([^"']+)["']/gi;

// Data attribute extraction
const HTML_DATA_PATTERN = /data-([a-zA-Z0-9-]+)\s*=/gi;

function extractHTMLTargets(html: string) {
  const ids: HTMLTarget[] = [];
  const classes: HTMLTarget[] = [];
  const dataAttrs: HTMLTarget[] = [];
  
  // Extract IDs
  let match;
  while ((match = HTML_ID_PATTERN.exec(html)) !== null) {
    ids.push({ type: 'id', value: match[1] });
  }
  
  // Extract classes (split by whitespace)
  while ((match = HTML_CLASS_PATTERN.exec(html)) !== null) {
    const classList = match[1].split(/\s+/).filter(Boolean);
    classList.forEach(cls => {
      if (!classes.find(c => c.value === cls)) {
        classes.push({ type: 'class', value: cls });
      }
    });
  }
  
  // Extract data attributes
  while ((match = HTML_DATA_PATTERN.exec(html)) !== null) {
    const attrName = `data-${match[1]}`;
    if (!dataAttrs.find(d => d.value === attrName)) {
      dataAttrs.push({ type: 'data-attribute', value: attrName });
    }
  }
  
  return { ids, classes, dataAttrs };
}
```

---

## Test Cases

```typescript
describe('extractJSReferences', () => {
  it('should extract getElementById references', () => {
    const js = `document.getElementById('hero');`;
    const result = extractJSReferences(js);
    expect(result.ids).toContainEqual(expect.objectContaining({ value: 'hero' }));
  });

  it('should extract querySelector ID references', () => {
    const js = `document.querySelector('#nav-menu');`;
    const result = extractJSReferences(js);
    expect(result.ids).toContainEqual(expect.objectContaining({ value: 'nav-menu' }));
  });

  it('should extract jQuery ID references', () => {
    const js = `$('#sidebar').show();`;
    const result = extractJSReferences(js);
    expect(result.ids).toContainEqual(expect.objectContaining({ value: 'sidebar' }));
  });

  it('should extract class references', () => {
    const js = `document.querySelectorAll('.card');`;
    const result = extractJSReferences(js);
    expect(result.classes).toContainEqual(expect.objectContaining({ value: 'card' }));
  });

  it('should extract classList manipulations', () => {
    const js = `element.classList.add('active');`;
    const result = extractJSReferences(js);
    expect(result.classManipulations).toContainEqual(expect.objectContaining({ value: 'active' }));
  });

  it('should skip dynamic references', () => {
    const js = `document.getElementById(\`item-\${id}\`);`;
    const result = extractJSReferences(js);
    expect(result.ids.filter(r => !r.isDynamic)).toHaveLength(0);
  });

  it('should skip commented code', () => {
    const js = `
      // document.getElementById('old');
      /* document.querySelector('.deprecated'); */
      document.getElementById('active');
    `;
    const result = extractJSReferences(js);
    expect(result.ids.filter(r => !r.isDynamic)).toHaveLength(1);
    expect(result.ids[0].value).toBe('active');
  });
});

describe('validateJSHTMLReferences', () => {
  it('should pass when all references exist', () => {
    const html = `<div id="hero" class="section dark"><button class="btn"></button></div>`;
    const js = `
      document.getElementById('hero');
      document.querySelector('.btn');
    `;
    const result = validateJSHTMLReferences(html, js);
    expect(result.isValid).toBe(true);
    expect(result.orphanIds).toHaveLength(0);
    expect(result.orphanClasses).toHaveLength(0);
  });

  it('should detect orphan ID references', () => {
    const html = `<div id="hero"></div>`;
    const js = `document.getElementById('footer');`;
    const result = validateJSHTMLReferences(html, js);
    expect(result.isValid).toBe(false);
    expect(result.orphanIds).toContain('footer');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should detect orphan class references', () => {
    const html = `<div class="section"></div>`;
    const js = `document.querySelector('.missing-class');`;
    const result = validateJSHTMLReferences(html, js);
    expect(result.orphanClasses).toContain('missing-class');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should handle classList manipulation as INFO', () => {
    const html = `<div class="box"></div>`;
    const js = `element.classList.add('active');`;
    const result = validateJSHTMLReferences(html, js);
    expect(result.manipulatedClasses).toContain('active');
    expect(result.info.length).toBeGreaterThan(0);
  });

  it('should handle multiple classes in HTML', () => {
    const html = `<div class="card featured large"></div>`;
    const js = `document.querySelector('.featured');`;
    const result = validateJSHTMLReferences(html, js);
    expect(result.orphanClasses).toHaveLength(0);
  });
});
```

---

## Error Message Templates

```typescript
const XREF_MESSAGES = {
  ORPHAN_ID: (id: string) => ({
    severity: 'error' as const,
    code: 'XREF_ORPHAN_ID',
    message: `JavaScript references #${id} but no element with id="${id}" exists in HTML`,
    suggestion: `Add id="${id}" to the target element or fix the JavaScript reference`,
  }),
  
  ORPHAN_CLASS: (className: string) => ({
    severity: 'warning' as const,
    code: 'XREF_ORPHAN_CLASS',
    message: `JavaScript references .${className} but no element with class="${className}" exists in HTML`,
    suggestion: `Add class="${className}" to the target element or fix the JavaScript reference`,
  }),
  
  ORPHAN_DATA_ATTR: (attr: string) => ({
    severity: 'warning' as const,
    code: 'XREF_ORPHAN_DATA',
    message: `JavaScript references [${attr}] but no element has ${attr} attribute`,
    suggestion: `Add ${attr}="value" to the target element`,
  }),
  
  CLASS_MANIPULATION: (className: string) => ({
    severity: 'info' as const,
    code: 'XREF_CLASS_MANIPULATION',
    message: `JavaScript adds/removes class "${className}" which doesn't exist in initial HTML`,
    suggestion: `This is often intentional for dynamic state changes`,
  }),
  
  DYNAMIC_SKIPPED: (count: number) => ({
    severity: 'info' as const,
    code: 'XREF_DYNAMIC_SKIPPED',
    message: `${count} dynamic DOM references were skipped (template literals or variables)`,
    suggestion: `These cannot be statically validated`,
  }),
};
```

---

## Edge Cases to Handle

1. **Multiple classes on same element**: `class="btn primary large"` → all three classes valid
2. **Same class on multiple elements**: `class="item"` on 5 divs → still one valid class
3. **Nested selectors**: `.parent .child` → extract both "parent" and "child"
4. **Compound selectors**: `.btn.primary` → extract both "btn" and "primary"
5. **Attribute selectors with class**: `[class*="btn"]` → skip (too complex)
6. **GSAP selectors**: `gsap.to('.box', {...})` → extract "box"
7. **Swiper selectors**: `new Swiper('.swiper', {...})` → extract "swiper"

---

## Integration Checklist

- [ ] Create `lib/js-html-xref.ts` with all interfaces
- [ ] Implement `extractJSReferences()` with comment stripping
- [ ] Implement `extractHTMLTargets()` with class splitting
- [ ] Implement `validateJSHTMLReferences()` main function
- [ ] Add dynamic reference detection and skipping
- [ ] Integrate into `preflight-validator.ts`
- [ ] Add xref results to `WebflowPayload.meta`
- [ ] Update admin import page to display xref warnings/errors
- [ ] Add support for GSAP/Swiper selector patterns
- [ ] Add unit tests for all patterns
- [ ] Test with real AI-generated code examples

---

## Success Criteria

1. Orphan ID references flagged as ERROR
2. Orphan class references flagged as WARNING
3. classList manipulations flagged as INFO (not error)
4. Dynamic references skipped (no false positives)
5. Commented code ignored
6. Multiple classes on same element handled
7. GSAP/Swiper selector patterns detected
8. Clear error messages with suggestions

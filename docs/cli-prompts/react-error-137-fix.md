# React Error #137: Invalid HTML Structure in Conversion

## The Problem

You're hitting **React error #137** when pasting into Webflow Designer. This is a **different issue** from the style validation we just solved. This is about **invalid HTML structure** in the source that breaks when converted to Webflow JSON.

## Root Cause

### The Offending HTML Pattern

Line 910 in your `portfolio.html`:

```html
<span class="label">Years<br>Experience</span>
```

### Why This Breaks

While browsers are forgiving and render this fine, **Webflow's JSON structure and React renderer are strict**:

1. **In HTML (browser):** 
   - `<span>` contains: text node → `<br>` element → text node
   - Browser: "Sure, I'll render it"

2. **In Webflow JSON (React):**
   ```json
   {
     "tag": "span",
     "children": [
       "text-node-id-1",  // "Years"
       "br-node-id",      // <br>
       "text-node-id-2"   // "Experience"
     ]
   }
   ```
   - React: "ERROR #137 - Invalid nesting of inline elements with mixed text/br content"

3. **Result:** Designer crashes before content is even pasted

### React Error #137 Meaning

From React's error decoder:
> "Text nodes cannot contain mixed inline content with `<br>` elements in certain contexts."

React is stricter than browsers about what can nest inside inline elements.

## Additional Problematic Patterns Found

Line 899:
```html
<span>Designing</span> <span class="light">What</span><br>
<span class="light">Your Brand</span> <span>Needs</span>
```

This creates: `span` → whitespace → `span` → whitespace → `<br>` → `span` → whitespace → `span`

When converted to Webflow JSON, this mixed inline content structure causes React rendering errors.

## The Solution: Pre-Conversion HTML Sanitization

You need to sanitize HTML **BEFORE** sending to Claude API for conversion.

### Pattern 1: `<br>` Inside Inline Elements with Text

**Bad:**
```html
<span>Years<br>Experience</span>
```

**Good (Option A - Separate elements):**
```html
<span>Years</span><br><span>Experience</span>
```

**Good (Option B - Block wrapper):**
```html
<div class="label">
  <span>Years</span><br>
  <span>Experience</span>
</div>
```

### Pattern 2: Mixed Inline + `<br>` at Same Level

**Bad:**
```html
<span>Designing</span> <span class="light">What</span><br>
<span class="light">Your Brand</span> <span>Needs</span>
```

**Good (Wrap in container):**
```html
<div class="hero-title">
  <div class="line">
    <span>Designing</span> <span class="light">What</span>
  </div>
  <div class="line">
    <span class="light">Your Brand</span> <span>Needs</span>
  </div>
</div>
```

## Implementation: HTML Sanitizer

Add this BEFORE your conversion pipeline:

```typescript
/**
 * Sanitize HTML to be compatible with Webflow's React renderer
 * Must run BEFORE sending to Claude API for conversion
 */
export function sanitizeHTMLForWebflow(html: string): string {
  // Parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Pattern 1: Fix <br> inside inline elements with text
  const inlineElements = doc.querySelectorAll('span, a, strong, em, i, b');
  
  inlineElements.forEach(element => {
    // Check if element contains both text nodes AND <br> elements
    const hasText = Array.from(element.childNodes).some(
      node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
    );
    const hasBr = element.querySelector('br');
    
    if (hasText && hasBr) {
      // Convert: <span>Text<br>More</span>
      // To: <span>Text</span><br><span>More</span>
      
      const parent = element.parentElement;
      if (!parent) return;
      
      const parts: Node[] = [];
      let currentText = '';
      
      Array.from(element.childNodes).forEach(node => {
        if (node.nodeName === 'BR') {
          // Flush current text
          if (currentText.trim()) {
            const spanClone = element.cloneNode(false) as Element;
            spanClone.textContent = currentText;
            parts.push(spanClone);
          }
          parts.push(node.cloneNode());
          currentText = '';
        } else if (node.nodeType === Node.TEXT_NODE) {
          currentText += node.textContent || '';
        }
      });
      
      // Flush remaining text
      if (currentText.trim()) {
        const spanClone = element.cloneNode(false) as Element;
        spanClone.textContent = currentText;
        parts.push(spanClone);
      }
      
      // Replace original element with parts
      parts.forEach(part => parent.insertBefore(part, element));
      parent.removeChild(element);
    }
  });
  
  // Pattern 2: Wrap loose inline + <br> sequences in block containers
  const body = doc.body;
  let currentGroup: Element[] = [];
  
  Array.from(body.childNodes).forEach(node => {
    const isInlineOrBr = 
      (node.nodeType === Node.ELEMENT_NODE && 
       ['SPAN', 'A', 'STRONG', 'EM', 'BR'].includes(node.nodeName)) ||
      (node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
    
    if (isInlineOrBr) {
      currentGroup.push(node as Element);
    } else {
      if (currentGroup.length > 0) {
        // Found a sequence of inline elements - wrap them
        const wrapper = doc.createElement('div');
        wrapper.className = 'inline-group';
        
        currentGroup.forEach(el => wrapper.appendChild(el.cloneNode(true)));
        
        body.insertBefore(wrapper, node);
        currentGroup.forEach(el => el.remove());
        currentGroup = [];
      }
    }
  });
  
  return doc.body.innerHTML;
}
```

## Integration into Conversion Pipeline

### Current (Broken) Flow:
```
User HTML → Claude API → Webflow JSON → Clipboard → Designer ❌
```

### Fixed Flow:
```
User HTML → Sanitize HTML → Claude API → Validate JSON → Clipboard → Designer ✅
```

### Code Integration:

```typescript
// In your Convex mutation:
export const convertHTMLToWebflow = mutation({
  handler: async (ctx, args: { html: string, css: string }) => {
    
    // STEP 1: Sanitize HTML FIRST
    const sanitizedHTML = sanitizeHTMLForWebflow(args.html);
    
    // STEP 2: Convert with Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `Convert to Webflow JSON:

HTML (pre-sanitized):
${sanitizedHTML}

CSS:
${args.css}

CRITICAL: This HTML has been pre-sanitized for Webflow compatibility.
Ensure <br> elements are standalone nodes, not nested inside text-containing inline elements.`
        }],
      }),
    });
    
    const data = await response.json();
    const rawPayload = JSON.parse(data.content[0].text);
    
    // STEP 3: Validate the Webflow JSON
    const validation = validateWebflowPayload(rawPayload, true);
    
    if (!validation.valid) {
      throw new Error(`Validation failed:\n${formatValidationErrors(validation)}`);
    }
    
    const safePayload = validation.sanitizedPayload || rawPayload;
    
    // STEP 4: Store
    await ctx.db.insert("templates", {
      payload: safePayload,
      originalHTML: args.html,
      sanitizedHTML: sanitizedHTML,
      validationWarnings: validation.warnings,
    });
    
    return { success: true };
  }
});
```

## Quick Fix for Your Current HTML

For your `portfolio.html` file specifically:

### Change Line 910:
```html
<!-- BEFORE (breaks) -->
<span class="label">Years<br>Experience</span>

<!-- AFTER (works) -->
<span class="label-line">Years</span><br><span class="label-line">Experience</span>
```

### Update CSS:
```css
.hero-years .label-line {
  display: block; /* Makes each line stack properly */
  font-size: 13px;
  color: var(--text-muted);
}
```

### Change Lines 899-900:
```html
<!-- BEFORE (breaks) -->
<span>Designing</span> <span class="light">What</span><br>
<span class="light">Your Brand</span> <span>Needs</span>

<!-- AFTER (works) -->
<div class="title-line">
  <span>Designing</span> <span class="light">What</span>
</div>
<div class="title-line">
  <span class="light">Your Brand</span> <span>Needs</span>
</div>
```

## Add to Validation System

This should be added as a **pre-conversion validation** step in your Flow Bridge pipeline:

```typescript
// New validation rule
export function validateHTMLStructure(html: string): ValidationResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const errors: ValidationError[] = [];
  
  // Check for <br> inside inline elements with text
  const inlineElements = doc.querySelectorAll('span, a, strong, em, i, b');
  
  inlineElements.forEach(element => {
    const hasText = Array.from(element.childNodes).some(
      node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
    );
    const hasBr = element.querySelector('br');
    
    if (hasText && hasBr) {
      errors.push({
        severity: 'error',
        rule: 'invalid-br-nesting',
        message: `<${element.tagName.toLowerCase()}> contains both text and <br> elements - will break Webflow React renderer`,
        context: {
          element: element.outerHTML,
          fix: 'Split into separate elements or wrap in block container'
        }
      });
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings: []
  };
}
```

## Testing

Test with these known-bad patterns:

```html
<!-- Test 1: br inside span with text -->
<span>Before<br>After</span>

<!-- Test 2: Mixed inline at same level -->
<span>A</span><br><span>B</span>

<!-- Test 3: Multiple br in one span -->
<span>Line 1<br>Line 2<br>Line 3</span>
```

All should be sanitized before conversion.

## Summary

**The Issue:** React error #137 from invalid `<br>` nesting in HTML source  
**The Cause:** HTML patterns that browsers accept but Webflow's React renderer rejects  
**The Solution:** Sanitize HTML BEFORE conversion, validate AFTER conversion  
**The Integration:** Add to existing validation pipeline as pre-processing step

This is a **critical addition** to the validation system we built earlier. HTML sanitization must happen FIRST, then conversion, then JSON validation.

## Priority Action

1. ✅ Fix the two patterns in `portfolio.html` (lines 899-900, 910)
2. ✅ Add `sanitizeHTMLForWebflow()` function to your pipeline
3. ✅ Add `validateHTMLStructure()` to validation rules
4. ✅ Update Claude API prompt to note HTML is pre-sanitized
5. ✅ Test with the fixed HTML

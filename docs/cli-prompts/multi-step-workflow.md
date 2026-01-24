# Flow Bridge: Multi-Step Conversion Workflow

## The Reality of Webflow Conversion

Webflow has limitations on what can be pasted directly vs what needs custom code embeds. Flow Bridge needs to handle a 3-step conversion process:

### Step 1: Design Tokens (Copy to Webflow directly)
**What:** CSS custom properties, global styles, color variables
**Where:** Webflow's native style panel
**Format:** Native Webflow styles (not custom code)

```css
/* Example Design Tokens (Webflow-compatible) */
:root {
  --primary: #1A1A1A;
  --bg: #F9F8F5;
  --spacing-xl: 64px;
}

/* These become Webflow's global styles */
```

**Validation needed:**
- ✅ Only uses CSS properties Webflow supports
- ✅ No advanced selectors (`:has()`, `:where()`)
- ✅ Color values in hex/rgb (not oklch, color-mix)
- ✅ Spacing uses px/rem (not clamp, calc with viewport units)

---

### Step 2: HTML + Basic CSS (Copy to Webflow Designer)
**What:** Structure (divs, text, images) + layout CSS
**Where:** Pasted directly into Designer canvas
**Format:** Webflow JSON (`@webflow/XscpData`)

```json
{
  "type": "@webflow/XscpData",
  "payload": {
    "nodes": [...],  // HTML structure
    "styles": [...]  // Basic CSS classes
  }
}
```

**Validation needed:**
- ✅ No duplicate UUIDs
- ✅ No circular class references
- ✅ No orphaned state variants
- ✅ Valid HTML structure (no `<br>` in `<span>` with text)
- ✅ Only basic CSS (flexbox, grid, typography, spacing)
- ⚠️  Advanced CSS flagged for embed

---

### Step 3: Advanced Code (Copy to Custom Code Embeds)
**What:** Advanced CSS/JS that Webflow doesn't support natively
**Where:** Page Settings → Custom Code OR Embed elements
**Format:** Raw HTML/CSS/JS in `<script>` or `<style>` tags

```html
<!-- Example: GSAP Animation -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script>
gsap.to('.hero', { opacity: 1, duration: 1 });
</script>

<!-- Example: Advanced CSS -->
<style>
.gradient-text {
  background: linear-gradient(45deg, oklch(0.7 0.2 300), oklch(0.5 0.3 200));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
</style>
```

**What goes in embeds:**
- Modern CSS features: `oklch()`, `color-mix()`, `@container`, `:has()`
- Complex animations: GSAP, Framer Motion, custom keyframes
- JavaScript libraries: Barba.js, Locomotive Scroll, Three.js
- Advanced selectors Webflow doesn't support
- Backdrop filters, clip-path animations, SVG filters

---

## Flow Bridge Component Structure

Each converted component should have THREE sections:

```typescript
interface ConvertedComponent {
  // SECTION 1: Design Tokens
  designTokens: {
    type: 'webflow-native-styles';
    payload: {
      colors: Record<string, string>;
      typography: {...};
      spacing: {...};
    };
  };
  
  // SECTION 2: Basic Structure
  basicStructure: {
    type: '@webflow/XscpData';
    payload: {
      nodes: [...];
      styles: [...]; // Only basic CSS
    };
  };
  
  // SECTION 3: Advanced Code (optional)
  embedCode?: {
    type: 'custom-code';
    location: 'head' | 'body-end' | 'embed-element';
    payload: {
      html?: string;
      css?: string;
      javascript?: string;
      dependencies?: string[]; // CDN links
    };
  };
}
```

---

## Validation Rules Per Section

### Design Tokens Validation

```typescript
function validateDesignTokens(tokens: any): ValidationResult {
  const errors = [];
  
  // Check color formats
  Object.entries(tokens.colors).forEach(([name, value]) => {
    if (!isWebflowCompatibleColor(value)) {
      errors.push({
        rule: 'unsupported-color-format',
        message: `Color "${name}" uses ${value} - Webflow only supports hex/rgb/hsl`,
        fix: 'Convert to hex or rgb format'
      });
    }
  });
  
  // Check spacing units
  Object.entries(tokens.spacing).forEach(([name, value]) => {
    if (value.includes('clamp') || value.includes('min(') || value.includes('max(')) {
      errors.push({
        rule: 'unsupported-spacing',
        message: `Spacing "${name}" uses CSS functions not supported in Webflow`,
        fix: 'Use static px or rem values'
      });
    }
  });
  
  return { valid: errors.length === 0, errors };
}
```

### Basic Structure Validation

```typescript
function validateBasicStructure(payload: WebflowPayload): ValidationResult {
  // Run all the validations we already built
  const structureValidation = validateWebflowPayload(payload);
  
  // PLUS: Check for advanced CSS that should be in embeds
  const advancedCSSFound = [];
  
  payload.payload.styles.forEach(style => {
    const css = style.styleLess;
    
    // Check for features that need embeds
    if (css.includes('oklch') || css.includes('color-mix')) {
      advancedCSSFound.push({
        className: style.name,
        feature: 'Modern color functions',
        shouldMoveToEmbed: true
      });
    }
    
    if (css.includes('@container') || css.includes('container-type')) {
      advancedCSSFound.push({
        className: style.name,
        feature: 'Container queries',
        shouldMoveToEmbed: true
      });
    }
    
    if (css.includes('backdrop-filter')) {
      advancedCSSFound.push({
        className: style.name,
        feature: 'Backdrop filters',
        shouldMoveToEmbed: true
      });
    }
  });
  
  return {
    ...structureValidation,
    warnings: [
      ...structureValidation.warnings,
      ...advancedCSSFound.map(item => ({
        severity: 'warning',
        rule: 'advanced-css-detected',
        message: `"${item.className}" uses ${item.feature} - should be in embed`,
        context: item
      }))
    ]
  };
}
```

### Embed Code Validation

```typescript
function validateEmbedCode(embedCode: any): ValidationResult {
  const errors = [];
  const warnings = [];
  
  // Check script sources are HTTPS
  if (embedCode.javascript) {
    const scriptSrcPattern = /src=["']([^"']+)["']/g;
    const sources = [...embedCode.javascript.matchAll(scriptSrcPattern)];
    
    sources.forEach(match => {
      const url = match[1];
      if (!url.startsWith('https://')) {
        errors.push({
          rule: 'insecure-script',
          message: `Script source must use HTTPS: ${url}`
        });
      }
    });
  }
  
  // Check for known CDN issues
  if (embedCode.dependencies) {
    embedCode.dependencies.forEach(dep => {
      if (dep.includes('unpkg.com')) {
        warnings.push({
          rule: 'unreliable-cdn',
          message: 'unpkg.com can be unreliable - consider jsDelivr or cdnjs'
        });
      }
    });
  }
  
  return { valid: errors.length === 0, errors, warnings };
}
```

---

## User Flow in Flow Bridge UI

### Current (Broken):
```
User uploads HTML
  ↓
Clicks "Convert"
  ↓
Clicks "Copy to Webflow"
  ↓
Pastes in Designer
  ↓
❌ ERROR - corruption or missing features
```

### Correct (What We Need):

```
User uploads HTML + CSS
  ↓
Clicks "Convert"
  ↓
AI analyzes and splits into 3 sections:
  ✅ Design Tokens (validated)
  ✅ Basic Structure (validated)  
  ⚠️  Advanced Code (needs embed)
  ↓
┌─────────────────────────────────────────┐
│ Conversion Complete!                    │
│                                         │
│ Step 1: Copy Design Tokens              │
│ [Copy Tokens] ← Click this first        │
│ Paste into: Webflow Global Styles       │
│                                         │
│ Step 2: Copy Structure                  │
│ [Copy Structure] ← Click this second    │
│ Paste into: Webflow Designer Canvas     │
│                                         │
│ Step 3: Copy Advanced Code (Optional)   │
│ [Copy Embed Code] ← Click if needed     │
│ Paste into: Page Settings > Custom Code │
│                                         │
│ ⚠️  Note: This component uses GSAP      │
│    Make sure to add the CDN script      │
└─────────────────────────────────────────┘
```

---

## Implementation: Split Conversion Logic

### Claude API Prompt Enhancement

```typescript
const CONVERSION_PROMPT = `You are converting HTML/CSS to Webflow format.

CRITICAL: Webflow has three distinct areas for code. Split your output accordingly:

1. DESIGN TOKENS (Webflow-native styles)
   - Color variables
   - Typography scales
   - Spacing system
   - Only basic CSS properties Webflow supports

2. BASIC STRUCTURE (Webflow JSON)
   - HTML nodes
   - Layout CSS (flexbox, grid, positioning)
   - Basic styling (colors, fonts, spacing)
   - NO advanced CSS features

3. ADVANCED CODE (Custom embeds)
   - Modern CSS: oklch(), color-mix(), @container, :has()
   - GSAP/animation libraries
   - Complex JavaScript
   - Third-party libraries

Return JSON in this format:
{
  "designTokens": {
    "colors": {...},
    "typography": {...},
    "spacing": {...}
  },
  "basicStructure": {
    "type": "@webflow/XscpData",
    "payload": {...}
  },
  "embedCode": {
    "css": "...",
    "javascript": "...",
    "dependencies": ["https://..."]
  }
}

If a CSS property is not supported in Webflow's native styles, move it to embedCode.css.`;
```

### UI Component: Multi-Step Copy

```tsx
export function ConversionResult({ conversion }: { conversion: ConvertedComponent }) {
  const [step, setStep] = useState(1);
  
  const handleCopyTokens = async () => {
    const validation = validateDesignTokens(conversion.designTokens);
    
    if (!validation.valid) {
      toast.error('Design tokens validation failed');
      console.error(validation.errors);
      return;
    }
    
    // Copy as CSS custom properties
    const css = generateTokensCSS(conversion.designTokens);
    await navigator.clipboard.writeText(css);
    
    toast.success('✅ Design tokens copied! Paste in Webflow Global Styles');
    setStep(2);
  };
  
  const handleCopyStructure = async () => {
    const validation = validateWebflowPayload(conversion.basicStructure);
    
    if (!validation.valid) {
      toast.error('Structure validation failed');
      console.error(validation.errors);
      return;
    }
    
    // Show warnings about advanced CSS
    const advancedCSS = findAdvancedCSS(conversion.basicStructure);
    if (advancedCSS.length > 0) {
      toast.warning(`⚠️ ${advancedCSS.length} classes need custom code embed`);
    }
    
    // Copy as Webflow JSON
    const payload = validation.sanitizedPayload || conversion.basicStructure;
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    await navigator.clipboard.write([new ClipboardItem({ 'application/json': blob })]);
    
    toast.success('✅ Structure copied! Paste in Webflow Designer (Cmd+V)');
    setStep(3);
  };
  
  const handleCopyEmbed = async () => {
    if (!conversion.embedCode) return;
    
    const validation = validateEmbedCode(conversion.embedCode);
    
    if (!validation.valid) {
      toast.error('Embed code validation failed');
      return;
    }
    
    // Copy as HTML string
    const embedHTML = generateEmbedHTML(conversion.embedCode);
    await navigator.clipboard.writeText(embedHTML);
    
    toast.success('✅ Embed code copied! Paste in Page Settings > Custom Code');
  };
  
  return (
    <div className="conversion-steps">
      <Step
        number={1}
        active={step === 1}
        title="Copy Design Tokens"
        description="Paste into: Webflow Global Styles panel"
        onCopy={handleCopyTokens}
      />
      
      <Step
        number={2}
        active={step === 2}
        title="Copy Structure"
        description="Paste into: Webflow Designer canvas (Cmd+V)"
        onCopy={handleCopyStructure}
      />
      
      {conversion.embedCode && (
        <Step
          number={3}
          active={step === 3}
          title="Copy Advanced Code"
          description="Paste into: Page Settings > Custom Code"
          onCopy={handleCopyEmbed}
          optional
        />
      )}
    </div>
  );
}
```

---

## What CSS Goes Where

### Webflow Native (Copy directly):
```css
/* ✅ These work in Webflow */
display: flex;
gap: 24px;
background: #1A1A1A;
color: rgb(255, 255, 255);
padding: 2rem;
border-radius: 8px;
font-size: clamp(16px, 2vw, 24px); /* Yes, clamp works! */
```

### Custom Embed (Need `<style>` block):
```css
/* ❌ These need custom code embed */
background: oklch(0.7 0.2 300deg);
background: color-mix(in srgb, red 50%, blue);
backdrop-filter: blur(10px);
@container (min-width: 400px) { ... }
.parent:has(> .child) { ... }
clip-path: polygon(...);
```

---

## Summary: The Complete Flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. User uploads HTML/CSS                                     │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. HTML Sanitization (fix <br> nesting, etc)                │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. Claude API splits into 3 sections:                       │
│    - Design Tokens (Webflow-native CSS)                     │
│    - Basic Structure (Webflow JSON)                         │
│    - Advanced Code (Custom embed)                           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. Validation runs on EACH section                          │
│    - validateDesignTokens()                                  │
│    - validateWebflowPayload()                                │
│    - validateEmbedCode()                                     │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. UI shows 3-step copy workflow                            │
│    User sees validation results BEFORE clicking copy        │
│    Each step validated independently                        │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. User follows steps in order:                             │
│    Step 1: Copy tokens → Paste in Global Styles             │
│    Step 2: Copy structure → Paste in Designer                │
│    Step 3: Copy embed → Paste in Custom Code                 │
└──────────────────────────────────────────────────────────────┘
                          ↓
                    ✅ Success!
```

This is the full picture of what Flow Bridge needs to do.

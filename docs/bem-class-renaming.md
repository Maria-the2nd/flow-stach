# BEM Class Renaming

The BEM Class Renaming stage automatically transforms imported HTML/CSS class names into Webflow-safe, namespaced BEM format. This prevents class collisions with Webflow's built-in styles and creates a consistent naming convention across your project.

## Overview

When importing HTML/CSS into Webflow, generic class names like `container`, `hero`, or `section` can collide with Webflow's native classes and cause unpredictable styling issues. The BEM renamer solves this by:

1. **Namespacing** all classes with your project slug
2. **Neutralizing** high-risk generic names
3. **Preserving** design token classes
4. **Updating** JavaScript class references automatically

## How It Works

### Pipeline Position

The BEM renamer runs as **Stage 3b** in the import pipeline:

```
Stage 1: Parsing
Stage 2: Token Extraction
Stage 3: Componentizing
Stage 3b: BEM Class Renaming  ← HERE
Stage 4: Semantic Patching (LLM)
Stage 5: Artifact Generation
```

This ensures the LLM sees the final renamed classes during semantic patching.

### Class Categorization

Classes are categorized and renamed based on their usage:

| Category | Criteria | Rename Pattern | Example |
|----------|----------|----------------|---------|
| **Component-local** | Used in 1 component only | `{project}__{element}` | `hero` → `mysite__hero` |
| **Shared utility** | Used in 2+ components | `{project}-u-{name}` | `btn` → `mysite-u-btn` |
| **High-risk** | Generic names that collide | `{project}__{name}` | `container` → `mysite__container` |
| **Design tokens** | CSS variable classes | *Preserved* | `text-primary` → `text-primary` |

### High-Risk Class Names

The following generic names are automatically flagged and renamed:

```
container, hero, section, header, footer, nav, navigation,
sidebar, main, content, wrapper, row, col, grid, flex,
button, btn, link, text, title, heading, image, img,
card, list, item, menu, dropdown, modal, overlay, popup,
form, input, label, field, table, cell, icon, logo, badge
```

Additionally, any class starting with `w-` (Webflow's reserved prefix) is flagged.

## Configuration

### Feature Flag

The BEM renamer is **enabled by default**. To disable it:

```bash
# Environment variable
NEXT_PUBLIC_FLOWBRIDGE_BEM_RENAME=0
```

### Options

When calling the renamer programmatically:

```typescript
import { renameClassesForProject } from '@/lib/bem-renamer';

const result = renameClassesForProject({
  componentsTree,
  css,
  js,
  establishedClasses: ['text-primary', 'bg-accent'], // Never rename these
  options: {
    projectSlug: 'mysite',           // Required: BEM block prefix
    enableLlmRefinement: true,       // Pass context to LLM for better names
    preserveClasses: ['custom-keep'], // Additional classes to preserve
    updateJSReferences: true,        // Update JS selectors (default: true)
  },
});
```

## Output

### Mapping

The renamer returns a `Map<string, string>` of original → renamed classes:

```typescript
result.mapping.get('hero');      // 'mysite__hero'
result.mapping.get('btn');       // 'mysite-u-btn' (if shared)
result.mapping.get('text-primary'); // 'text-primary' (preserved)
```

### Updated Content

- `result.updatedComponents` - Component tree with renamed HTML
- `result.updatedCss` - CSS with renamed selectors
- `result.updatedJs` - JavaScript with updated class references

### Report

The `ClassRenamingReport` provides detailed metrics:

```typescript
interface ClassRenamingReport {
  status: "pass" | "warn";
  summary: {
    totalClasses: number;
    renamed: number;
    preserved: number;
    highRiskNeutralized: number;
    jsReferencesUpdated: number;
  };
  categories: {
    bemRenamed: Array<{ original, renamed, block }>;
    utilityNamespaced: Array<{ original, renamed }>;
    preserved: Array<{ className, reason }>;
    highRiskDetected: string[];
  };
  warnings: string[];
}
```

## LLM Integration

When `enableLlmRefinement: true`, the renamer builds context for the LLM semantic patching stage:

```typescript
interface LlmClassContext {
  proposedMapping: Array<{
    original: string;
    proposed: string;
    reason: string;
  }>;
  highRiskDetected: string[];
  ambiguousNames: string[];  // Classes where LLM could suggest better names
}
```

The LLM can then suggest improved class names via `classNameSuggestions` in its response.

## API Usage

The `/api/webflow/convert` endpoint supports optional BEM renaming:

```typescript
// Request
{
  html: "<div class='hero container'>...</div>",
  css: ".hero { ... } .container { ... }",
  projectSlug: "mysite",        // Enable BEM renaming
  enableBemRenaming: true       // Optional, default: true if projectSlug provided
}

// Response includes
{
  classRenamingReport: { ... },
  // webflowJson has renamed classes
}
```

## UI Display

The renaming report is displayed in:

1. **SafetyReportPanel** - Shows summary stats and categorized lists
2. **Project Details View** - Full report with expandable sections

The UI shows:
- Total classes processed
- Number renamed vs preserved
- High-risk classes neutralized
- Expandable lists of all renames by category

## Examples

### Basic Rename

**Input:**
```html
<section class="hero">
  <div class="container">
    <h1 class="hero-title">Welcome</h1>
  </div>
</section>
```

**Output (projectSlug: "acme"):**
```html
<section class="acme__hero">
  <div class="acme__container">
    <h1 class="acme__hero-title">Welcome</h1>
  </div>
</section>
```

### Shared Class

**Input (class used in 2 components):**
```html
<!-- Hero component -->
<button class="btn primary">Click</button>

<!-- Footer component -->
<button class="btn secondary">Submit</button>
```

**Output:**
```html
<!-- Hero component -->
<button class="acme-u-btn acme__primary">Click</button>

<!-- Footer component -->
<button class="acme-u-btn acme__secondary">Submit</button>
```

### Token Preservation

**Input:**
```html
<p class="text-primary bg-accent">Styled text</p>
```

**Output (text-primary and bg-accent are design tokens):**
```html
<p class="text-primary bg-accent">Styled text</p>
```

### JavaScript Update

**Input:**
```javascript
document.querySelector('.hero').addEventListener('click', handler);
document.querySelectorAll('.btn').forEach(el => el.classList.add('active'));
```

**Output:**
```javascript
document.querySelector('.acme__hero').addEventListener('click', handler);
document.querySelectorAll('.acme-u-btn').forEach(el => el.classList.add('active'));
```

## Best Practices

1. **Always provide a unique projectSlug** - This prevents collisions across imports
2. **Define design tokens upfront** - Pass them as `establishedClasses` to preserve naming
3. **Review the report** - Check for warnings about ambiguous renames
4. **Test JS interactions** - Verify renamed selectors work correctly

## Troubleshooting

### Classes not being renamed

- Check if the class is in `establishedClasses` (preserved)
- Check if the class already starts with your project slug (skipped)
- Verify `NEXT_PUBLIC_FLOWBRIDGE_BEM_RENAME` is not set to `0`

### JS selectors broken

- Ensure `updateJSReferences: true` (default)
- Check for dynamic class construction that can't be statically analyzed
- Review `jsReferencesUpdated` count in report

### Unexpected collisions

- Use a more unique `projectSlug`
- Check for duplicate class names in the mapping
- Review `highRiskDetected` for generic names that were renamed

## BEM Combo Classes for Typography Inheritance

This section documents the **BEM Combo Class Pattern** used to preserve typography and styling from CSS element selectors while supporting context-specific overrides. This pattern is critical for converting HTML/CSS that uses descendant selectors like `.section-header h2`.

### The Problem

When converting HTML/CSS to Webflow, we encounter a common pattern:

```css
/* Base typography for ALL h2 elements */
h1, h2, h3 {
    font-family: 'Fredoka', sans-serif;
    text-transform: uppercase;
}

/* Context-specific styles for h2 inside .section-header */
.section-header h2 {
    margin-bottom: 16px;
}
```

**The challenge**: Webflow doesn't support descendant selectors. A naive approach might:
1. Convert `.section-header h2` → `.section-header-h2` (context-aware class)
2. Apply the h2 element to this new class

**The problem**: The h2 loses its base typography (Fredoka, uppercase) because it only has the modifier class!

### The Solution: Combo Classes

Following [Webflow's BEM methodology](https://webflow.com/blog/class-naming-101-bem), we use **combo classes** - an element gets BOTH a base class AND a modifier class:

```html
<!-- BEFORE (wrong): only modifier class -->
<h2 class="section-header-h2">Title</h2>

<!-- AFTER (correct): base + modifier classes -->
<h2 class="heading-h2 section-header-h2">Title</h2>
```

**How styles are distributed:**
- `heading-h2` (base class): typography from `h2 {}` selector → `font-family: Fredoka; text-transform: uppercase`
- `section-header-h2` (modifier class): context-specific styles → `margin-bottom: 16px`

### Supported Elements

The converter automatically applies this pattern to:

| Element | Base Class | Modifier Pattern |
|---------|------------|------------------|
| `h1-h6` | `heading-h1` through `heading-h6` | `{parent}-h1` through `{parent}-h6` |
| `p` | `text-body` | `{parent}-p` |
| `ul` | `list-ul` | `{parent}-ul` |
| `ol` | `list-ol` | `{parent}-ol` |
| `li` | `list-item` | `{parent}-li` |
| `blockquote` | `blockquote` | `{parent}-blockquote` |
| `a` | `link` | Context-aware naming (see below) |

**Link naming conventions:**
- `.nav-links a` → `nav-link` (removes trailing 's')
- `.footer a` → `footer-link`

### How It Works in the Codebase

#### 1. Element-to-Class Mapping (`lib/css-parser.ts`)

```typescript
export const ELEMENT_TO_CLASS_MAP: Record<string, string> = {
  // Typography elements
  h1: "heading-h1",
  h2: "heading-h2",
  // ... h3-h6
  p: "text-body",
  a: "link",
  // List elements
  ul: "list-ul",
  ol: "list-ol",
  li: "list-item",
  blockquote: "blockquote",
  // Structural elements (different pattern - not combo classes)
  section: "wf-section",
  // ...
};
```

#### 2. Descendant Selector Conversion (`lib/webflow-normalizer.ts`)

When normalizing CSS like `.features h2 { margin-bottom: 24px }`:

```typescript
// In normalizeSelector():
// Detects descendant element selector
const descendantElementMatch = base.match(/\.([a-zA-Z_-][\w-]*)\s+(h[1-6]|p|a|ul|ol|li|blockquote|...)/);

// Creates MODIFIER class (not base class!)
const className = deriveDescendantClassName(parentClass, element);
// Result: "features-h2" (modifier class)
```

#### 3. Base Class Injection (`lib/webflow-normalizer.ts`)

During HTML normalization, base classes are ALWAYS added:

```typescript
// For headings
for (const tag of HEADING_TAGS) {
  wrapper.querySelectorAll(tag).forEach((el) => {
    const baseClass = `heading-${tag}`;  // e.g., "heading-h2"
    if (!element.classList.contains(baseClass)) {
      element.classList.add(baseClass);   // Always add base class
    }
  });
}

// For list elements
const LIST_ELEMENTS = [
  { tag: "ul", baseClass: "list-ul" },
  { tag: "ol", baseClass: "list-ol" },
  { tag: "li", baseClass: "list-item" },
  { tag: "blockquote", baseClass: "blockquote" },
];
for (const { tag, baseClass } of LIST_ELEMENTS) {
  wrapper.querySelectorAll(tag).forEach((el) => {
    if (!element.classList.contains(baseClass)) {
      element.classList.add(baseClass);
    }
  });
}
```

### Example Conversion

**Input HTML:**
```html
<section class="features">
  <h2>Our Features</h2>
  <ul>
    <li>Feature 1</li>
    <li>Feature 2</li>
  </ul>
</section>
```

**Input CSS:**
```css
h2 { font-family: 'Fredoka'; text-transform: uppercase; }
ul { list-style: disc; padding-left: 20px; }
li { margin-bottom: 8px; }

.features h2 { margin-bottom: 24px; }
.features ul { margin-top: 16px; }
.features li { color: #333; }
```

**Output HTML:**
```html
<section class="features wf-section">
  <h2 class="heading-h2 features-h2">Our Features</h2>
  <ul class="list-ul features-ul">
    <li class="list-item features-li">Feature 1</li>
    <li class="list-item features-li">Feature 2</li>
  </ul>
</section>
```

**Output Webflow Styles:**
- `.heading-h2`: `font-family: Fredoka; text-transform: uppercase`
- `.features-h2`: `margin-bottom: 24px`
- `.list-ul`: `list-style: disc; padding-left: 20px`
- `.features-ul`: `margin-top: 16px`
- `.list-item`: `margin-bottom: 8px`
- `.features-li`: `color: #333`

### When to Use This Pattern

Use this combo class approach when:

1. **Element selectors define base typography** - `h1, h2 { font-family: ... }`
2. **Descendant selectors add context-specific styles** - `.card h2 { margin-bottom: ... }`
3. **You need both inheritance AND customization**

Do NOT use this pattern for:

1. **Structural elements** (`section`, `nav`, `header`, etc.) - These use `wf-*` classes for spacing only
2. **Elements with only one styling context** - No need for combo classes
3. **Pseudo-selectors** (`:hover`, `:focus`) - Route to CSS embed instead
4. **Simple `:nth-child(N)`** - These are now automatically converted to BEM modifiers (see next section)

### Code Locations

| File | Function/Section | Purpose |
|------|------------------|---------|
| `lib/css-parser.ts:186-209` | `ELEMENT_TO_CLASS_MAP` | Defines element → base class mapping |
| `lib/css-parser.ts:1651-1687` | `mergeElementTypographyIntoClasses()` | Merges `h1 {}` typography into `.heading-h1` |
| `lib/webflow-normalizer.ts:410-428` | `normalizeSelector()` | Converts `.parent h2` → `.parent-h2` |
| `lib/webflow-normalizer.ts:483-515` | `deriveDescendantClassName()` | Creates modifier class names |
| `lib/webflow-normalizer.ts:662-676` | Heading injection (DOM) | Adds base `heading-*` classes |
| `lib/webflow-normalizer.ts:703-717` | List injection (DOM) | Adds base `list-*` classes |
| `lib/webflow-normalizer.ts:795-806` | Heading injection (fallback) | Same for parsed elements |
| `lib/webflow-normalizer.ts:828-843` | List injection (fallback) | Same for parsed elements |

### Troubleshooting

**Typography not applied (wrong font, missing uppercase):**
- Check if element has base class (e.g., `heading-h2`)
- Verify base class style exists in Webflow JSON
- Check `ELEMENT_TO_CLASS_MAP` includes the element

**Styles conflicting between contexts:**
- Ensure modifier classes are being created (not merging into base)
- Check `deriveDescendantClassName()` is returning different class per context
- Verify `isComboClassElement` check includes the element type

**Base class not being added:**
- Check HTML normalization loop includes the element
- Verify element isn't already classified differently
- Check both DOM and fallback parser paths

---

## nth-child to BEM Modifier Conversion

This section documents the automatic conversion of CSS `:nth-child(N)` selectors to BEM modifier classes. This enables native Webflow support for positional styling instead of requiring CSS embed.

### The Problem

A common CSS pattern for card variants:

```css
.step-card:nth-child(1) { background: #aefbff; }  /* cyan */
.step-card:nth-child(2) { background: #f6bbfd; }  /* pink */
.step-card:nth-child(3) { background: #ffff94; }  /* yellow */
```

**The challenge**: Webflow doesn't support `:nth-child` in the Designer. Previously, these rules were routed to CSS embed, requiring manual paste.

### The Solution: Automatic BEM Conversion

The converter automatically transforms simple numeric `:nth-child(N)` rules to BEM modifier classes:

**Input CSS:**
```css
.step-card:nth-child(1) { background: #aefbff; }
.step-card:nth-child(2) { background: #f6bbfd; }
.step-card:nth-child(3) { background: #ffff94; }
```

**Output CSS (BEM modifiers):**
```css
.step-card-cyan { background: #aefbff; }
.step-card-pink { background: #f6bbfd; }
.step-card-yellow { background: #ffff94; }
```

**Output HTML (classes injected by position):**
```html
<div class="step-card step-card-cyan">Card 1</div>
<div class="step-card step-card-pink">Card 2</div>
<div class="step-card step-card-yellow">Card 3</div>
```

### Semantic Color Naming

When the varying property is a recognizable color, the converter uses semantic names:

| Color Family | Hex Values (examples) | Modifier Name |
|--------------|----------------------|---------------|
| Cyan | `#aefbff`, `#00ffff`, `#0dcaf0` | `-cyan` |
| Pink | `#f6bbfd`, `#ff69b4`, `#ffc0cb` | `-pink` |
| Yellow | `#ffff94`, `#ffff00`, `#ffc107` | `-yellow` |
| Orange | `#fdc068`, `#ff9124`, `#ff9800` | `-orange` |
| Green | `#82eda6`, `#4caf50`, `#00ff00` | `-green` |
| Blue | `#589af0`, `#2196f3`, `#3b82f6` | `-blue` |
| Purple | `#c88cfd`, `#9c27b0`, `#a855f7` | `-purple` |
| Rose | `#fccddc`, `#ff6b6b`, `#f43f5e` | `-rose` |

When the color isn't recognizable or the property isn't a color, numbered modifiers are used: `-1`, `-2`, `-3`.

### Supported vs. Unsupported Patterns

**✅ Supported (converted to BEM):**
- `:nth-child(1)`, `:nth-child(2)`, `:nth-child(3)` - Simple numeric
- Any simple numeric position

**❌ Unsupported (left in CSS embed):**
- `:nth-child(odd)`, `:nth-child(even)` - Keywords
- `:nth-child(2n)`, `:nth-child(2n+1)`, `:nth-child(3n-1)` - Formula expressions
- `:nth-of-type()`, `:nth-last-child()` - Other nth selectors

### How It Works

1. **CSS Parsing**: Detect `:nth-child(N)` rules with simple numeric expressions
2. **Color Extraction**: Identify the primary varying property (usually `background`)
3. **Semantic Naming**: Map color values to human-readable names
4. **CSS Generation**: Create BEM modifier classes
5. **HTML Injection**: Add modifier classes to elements based on document position
6. **CSS Cleanup**: Remove original `:nth-child` rules (now replaced)

### Code Locations

| File | Function | Purpose |
|------|----------|---------|
| `lib/nth-child-converter.ts` | `convertNthChildToBem()` | Main conversion entry point |
| `lib/nth-child-converter.ts` | `parseNthChildRules()` | Parse CSS for nth-child patterns |
| `lib/nth-child-converter.ts` | `generateModifierClassName()` | Create semantic or numbered names |
| `lib/nth-child-converter.ts` | `applyNthChildModifiersToHtml()` | Inject classes into HTML |
| `lib/webflow-normalizer.ts:224-248` | Integration | Pipeline integration point |

### Example: Step Cards

**Before conversion:**
```html
<div class="step-card">01 PASTE</div>
<div class="step-card">02 CONVERT</div>
<div class="step-card">03 PERFECT</div>
```

```css
.step-card:nth-child(1) { background: #aefbff; }
.step-card:nth-child(2) { background: #f6bbfd; }
.step-card:nth-child(3) { background: #ffff94; }
```

**After conversion:**
```html
<div class="step-card step-card-cyan">01 PASTE</div>
<div class="step-card step-card-pink">02 CONVERT</div>
<div class="step-card step-card-yellow">03 PERFECT</div>
```

```css
.step-card-cyan { background: #aefbff; }
.step-card-pink { background: #f6bbfd; }
.step-card-yellow { background: #ffff94; }
```

**Result**: Native Webflow classes, no CSS embed needed! 🎉

### Troubleshooting

**nth-child rules still in CSS embed:**
- Check if the expression is simple numeric (only `1`, `2`, `3`, etc.)
- Complex expressions like `odd`, `even`, `2n+1` are not supported
- Verify the rule matches the pattern `.class:nth-child(N) { ... }`

**Wrong color names:**
- Color must be in the recognized color families
- Check `COLOR_NAME_MAP` in `lib/nth-child-converter.ts`
- Unrecognized colors fall back to numbered modifiers

**Modifier class not applied to HTML:**
- Elements are matched by document order, not parent context
- Ensure base class exists on the elements
- Check the element count matches the nth-child positions

---

## Technical Details

### Files

| File | Purpose |
|------|---------|
| `lib/bem-renamer.ts` | Core orchestration module |
| `lib/flowbridge-semantic.ts` | BEM utilities (formatBEM, parseToBEMParts, etc.) |
| `lib/validation-types.ts` | ClassRenamingReport type |
| `lib/project-engine.ts` | Pipeline integration (Stage 3b) |
| `components/validation/SafetyReportPanel.tsx` | UI component |
| `tests/regression/bem-renamer.test.ts` | Test suite |

### Dependencies

The BEM renamer uses existing utilities from `flowbridge-semantic.ts`:
- `isHighRiskClass()` - Detect generic/reserved names
- `formatBEM()` - Generate BEM class strings
- `parseToBEMParts()` - Parse existing BEM structure
- `inferElementRole()` - Infer BEM element from HTML context
- `updateHTMLClassReferences()` - Update HTML class attributes
- `updateCSSClassReferences()` - Update CSS selectors
- `updateJSClassReferences()` - Update JS class strings

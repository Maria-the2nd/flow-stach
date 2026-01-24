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

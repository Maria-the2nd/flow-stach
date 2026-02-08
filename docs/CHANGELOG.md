# Changelog

All notable changes to Flow-Stach will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed - February 7, 2026

#### CSS Pipeline: Pseudo-Class Rules in Min-Width Media Queries

**Problem Solved:** `:hover` rules inside `@media (min-width: ...)` blocks were silently dropped by `parseCSS()`. The parser skipped pseudo-class selectors in min-width media blocks with `continue`, losing styles like `.btn:hover { background: ... }` inside large breakpoints.

**Fix:** Pseudo-class rules inside non-standard min-width media queries are now collected and routed to `nonStandardMediaCss` as embed CSS, preserving them in the final output.

**Files Modified:**
- `lib/css-parser.ts` — Collect pseudo-class rules in min-width media, push to `nonStandardMediaBlocks`

#### CSS Pipeline: Modifier Classes for Descendant Element Selectors

**Problem Solved:** Descendant selectors like `.hero h1` were routed to embed CSS, losing Webflow Style Panel editability. The parser merged all styles into the base element class (`heading-h1`), losing the parent context.

**Fix:** Three coordinated changes create modifier classes:
1. **Parser** (`css-parser.ts`): `processRule()` creates modifier class `hero-h1` (separate from base `heading-h1`) with context-specific styles.
2. **Converter** (`webflow-converter.ts`): `processElement()` tracks `ancestorClasses` and injects modifier classes into descendant elements. `<h1>` inside `.hero` gets both `heading-h1` and `hero-h1`.
3. **Router** (`css-embed-router.ts`): Safety net updated — flattenable typography elements (`h1`–`h6`, `p`, `a`, `ul`, `ol`, `li`, `blockquote`) stay native since the parser creates modifier classes for them.

**Files Modified:**
- `lib/css-parser.ts` — Modifier class creation in `processRule()`
- `lib/webflow-converter.ts` — `ancestorClasses` parameter and modifier class injection
- `lib/css-embed-router.ts` — `flattenableElements` set in safety net

#### UI: Remove Hardcoded CSS Classes from App Design System

**Problem Solved:** `globals.css` contained hardcoded classes (`btn-premium`, `premium-hover`, `premium-card-hover`, `btn-primary-cta`, `glass-card-hover`, `font-display`, `scrollbar-hide`, `shadow-2xl`) that masked pipeline gaps by providing styles the converter should handle dynamically.

**Fix:** Removed all hardcoded pipeline-pattern classes. Replaced with inline Tailwind utilities in component files.

**Files Modified:**
- `app/globals.css` — Removed ~140 lines of hardcoded classes
- `app/(authenticated)/workspace/import/page.tsx` — Inline Tailwind
- `app/(authenticated)/workspace/projects/page.tsx` — Inline Tailwind
- `app/(authenticated)/workspace/library/page.tsx` — Inline Tailwind
- `app/(authenticated)/workspace/components/page.tsx` — Inline Tailwind
- `components/workspace/project-details-view.tsx` — Inline Tailwind
- `components/explore/explore-view.tsx` — Inline Tailwind
- `components/admin/WebflowTemplateImport.tsx` — Inline Tailwind

### Added - February 5, 2026

#### Pipeline Audit Harness with Smart CSS Analysis

**New Feature:** Automated audit pipeline that compares original HTML/CSS against sanitized Webflow-ready output. Includes a smart CSS analyzer that tracks CSS preservation rates and identifies routing decisions.

**Files Created/Modified:**
- `audit/diff/smart-analyzer.ts` — CSS preservation analysis with fallback map for media/embed rules
- `audit/runner/pipeline-executor.ts` — Audit pipeline executor consuming `nonStandardMediaCss`
- `tests/regression/panel-first-routing-guarantees.test.ts` — Regression tests for routing behavior
- `tests/regression/no-fixture-hardcoding.test.ts` — Ensures no fixture-specific logic

---

### Added - January 25, 2026

#### BEM Combo Class Pattern for Typography Inheritance 🎯

**Problem Solved:** When converting HTML/CSS with descendant selectors like `.section-header h2`, the typography (font-family, text-transform) from base element selectors (`h2 {}`) was being lost because elements only received the context-specific modifier class.

**Solution Implemented: Combo Classes**
- Elements now receive BOTH a base class AND a modifier class
- Base class carries typography from element selectors
- Modifier class carries context-specific styles (margins, colors, etc.)

**Example:**
```html
<!-- Before: lost Fredoka font -->
<h2 class="section-header-h2">Title</h2>

<!-- After: both base + modifier -->
<h2 class="heading-h2 section-header-h2">Title</h2>
```

**Supported Elements:**
- Headings: `h1`-`h6` → `heading-h1` through `heading-h6`
- Paragraph: `p` → `text-body`
- Lists: `ul` → `list-ul`, `ol` → `list-ol`, `li` → `list-item`
- Blockquote: `blockquote` → `blockquote`

**Files Modified:**
- `lib/css-parser.ts` - Added list elements to `ELEMENT_TO_CLASS_MAP`
- `lib/webflow-normalizer.ts` - Added base class injection and modifier class creation
- `docs/bem-class-renaming.md` - Added comprehensive documentation section

**Documentation:** See `docs/bem-class-renaming.md` section "BEM Combo Classes for Typography Inheritance"

#### Comprehensive Positional CSS to BEM Conversion 🎨

**Problem Solved:** CSS positional selectors (`:nth-child`, `:first-child`, `:last-child`, etc.) required CSS embed (manual paste into Webflow). This was a common pattern for card color variants, zebra striping, grid layouts, etc.

**Solution Implemented: Automatic BEM Conversion**
All common positional selectors are now auto-converted to BEM modifier classes:

| Pattern | Example | BEM Output |
|---------|---------|------------|
| `:nth-child(N)` | `.card:nth-child(1)` | `.card-cyan` (semantic) or `.card-1` |
| `:first-child` | `.card:first-child` | `.card-first` |
| `:last-child` | `.card:last-child` | `.card-last` |
| `:nth-child(odd/even)` | `.row:nth-child(odd)` | `.row-odd` |
| `:nth-child(Nn)` | `.item:nth-child(3n)` | `.item-every-3rd` |
| `:nth-child(an+b)` | `.grid:nth-child(6n+1)` | `.grid-slot-1` |
| `:nth-last-child(N)` | `.item:nth-last-child(2)` | `.item-from-end-2` |

**Examples:**

*Simple numeric (with semantic color naming):*
```css
/* Input */
.step-card:nth-child(1) { background: #aefbff; }

/* Output */
.step-card-cyan { background: #aefbff; }
```

*Zebra striping:*
```css
/* Input */
.row:nth-child(odd) { background: #f5f5f5; }
.row:nth-child(even) { background: #ffffff; }

/* Output */
.row-odd { background: #f5f5f5; }
.row-even { background: #ffffff; }
```

*Editorial "Pattern 6" grid:*
```css
/* Input */
.grid-item:nth-child(6n+1) { width: 100%; }
.grid-item:nth-child(6n+2) { width: 50%; }

/* Output */
.grid-item-slot-1 { width: 100%; }
.grid-item-slot-2 { width: 50%; }
```

*Last items styling:*
```css
/* Input */
.item:nth-last-child(1) { margin-bottom: 0; }
.item:nth-last-child(2) { border-bottom: dashed; }

/* Output */
.item-from-end-1 { margin-bottom: 0; }
.item-from-end-2 { border-bottom: dashed; }
```

**Files Created/Modified:**
- `lib/nth-child-converter.ts` - Main module (1400+ lines)
- `lib/webflow-normalizer.ts` - Pipeline integration
- `tests/nth-child-converter.test.ts` - 66 comprehensive tests
- `docs/bem-class-renaming.md` - Documentation section

**Documentation:** See `docs/bem-class-renaming.md` section "nth-child to BEM Modifier Conversion"

---

### Fixed - January 24, 2026 (Evening)

#### Style Guide Webflow Generator - Major Rewrite 🔧

**Problem Solved:** Style guide pasted into Webflow was inheriting styles from imported projects, causing:
- Text sizes (h1, h2, p) being overridden
- "Lame" layout due to CSS conflicts
- Inconsistent appearance across different projects

**Solution Implemented:**
- **100% Self-Contained Inline Styles**: Every element now has explicit inline styles
  - Font sizes: 48px (h1), 32px (h2), 20px (h3), 16px (p), etc.
  - Line heights, font weights, font families explicitly defined
  - All margins, padding, borders explicitly set
  - Box-sizing on every element
  - Zero CSS classes - pure inline styles
- **System Fonts**: Uses `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` to avoid font loading issues
- **No More Conflicts**: Style guide now looks perfect regardless of project's global styles

#### UI Components Section Added 🎨

**New Feature:**
- **Always-visible UI Components section** with examples:
  - **Buttons**: Primary (filled), Secondary (outlined), Outline (gray)
  - **Card**: Nested card example with title and description
  - **Input**: Form input field styling
- **Professional Layout**: 3-column responsive grid
- **Demonstrates Design System**: Shows how tokens work together

#### Default Spacing Tokens 📏

**Enhancement:**
- Spacing section now **always appears**
- If project has no spacing tokens, shows default scale:
  - --spacing-xs: 8px
  - --spacing-sm: 16px
  - --spacing-md: 24px
  - --spacing-lg: 48px
  - --spacing-xl: 96px
- Visual bars show relative sizes

**Files Modified:**
- `lib/webflow-style-guide-generator.ts` - Complete rewrite (200+ lines changed)

### Added - January 24, 2026 (Morning)

#### Design Tokens Style Guide System 🎨

**Major new feature**: Comprehensive design system documentation generator with Webflow export capability.

**User-Facing Features:**
- **Visual Style Guide Tab**: New tab in Project Details view displays complete design token documentation
- **Token Categories**: Automatic extraction and display of:
  - Colors (primitives and semantic roles)
  - Typography (font families, heading styles, body text variations)
  - Spacing (margins, padding, gaps with visual scale)
  - Border Radius (small, medium, large, xlarge with visual examples)
  - Shadows (xxsmall to xxlarge with intensity previews)
- **Copy Functionality**:
  - Individual token copy (hover and click icon)
  - Category copy (all tokens as CSS custom properties)
  - Webflow export (complete visual style guide page)
- **Relume-Style Layout**: Clean, organized, professional presentation
- **Responsive Design**: Works on desktop, tablet, and mobile views

**Technical Implementation:**

*New Files (8):*
- `lib/webflow-style-guide-generator.ts` - Webflow payload generator
- `components/project/style-guide/copy-button.tsx` - Reusable copy components
- `components/project/style-guide/variables-section.tsx` - Colors display
- `components/project/style-guide/typography-section.tsx` - Typography display
- `components/project/style-guide/spacing-section.tsx` - Spacing display
- `components/project/style-guide/radius-section.tsx` - Border radius display
- `components/project/style-guide/shadows-section.tsx` - Shadows display
- `components/project/style-guide/style-guide-view.tsx` - Main container

*Modified Files (5):*
- `lib/token-extractor.ts` - Added enhanced token extraction functions
- `components/workspace/project-details-view.tsx` - Integrated style guide tab
- `convex/schema.ts` - Extended designTokens schema
- `convex/import.ts` - Parse and store enhanced tokens
- `components/admin/ImportWizard.tsx` - Extract enhanced tokens during import

*New Interfaces:*
```typescript
- RadiusToken { name, value, size }
- ShadowToken { name, value, intensity }
- UIElement { name, classes, styles }
- EnhancedTokenExtraction extends TokenExtraction
```

*New Functions:*
```typescript
- extractEnhancedTokens()
- extractRadiusTokens()
- extractShadowTokens()
- extractUIElements()
- generateStyleGuidePayload()
```

**Documentation:**
- [User Guide](./features/STYLE_GUIDE.md) - Complete feature documentation
- [Quick Reference](./features/STYLE_GUIDE_QUICK_REFERENCE.md) - Cheat sheet
- [Implementation](./STYLE_GUIDE_IMPLEMENTATION.md) - Technical details
- [System Integration](../SYSTEM_MANIFEST.md) - Architecture updates

**Breaking Changes:** None - Fully backward compatible

**Migration Required:** No - Existing projects continue to work. Re-import projects to generate enhanced tokens.

---

## [1.0.0] - 2026-01-01

### Initial Release
- Import Wizard with HTML/CSS conversion
- Component detection and extraction
- Webflow payload generation
- Basic design token extraction (colors, typography, spacing)
- Asset validation and font detection
- Three-output system (Webflow JSON, CSS Embed, JS Embed)

---

## Versioning Strategy

- **Major (X.0.0)**: Breaking changes, major architecture shifts
- **Minor (1.X.0)**: New features, backward compatible
- **Patch (1.0.X)**: Bug fixes, small improvements

## Upcoming Features

- [ ] Icons/Logos section in Style Guide
- [ ] Animation/Transition tokens
- [ ] Dark mode color preview in Style Guide
- [ ] Actual heading style detection from CSS
- [ ] Export style guide as standalone HTML
- [ ] Customizable style guide themes

---

**Maintained by:** Flow Bridge Team
**Last Updated:** February 7, 2026

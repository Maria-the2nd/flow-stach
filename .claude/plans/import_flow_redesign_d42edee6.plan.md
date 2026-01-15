---
name: Import Flow Redesign
overview: |
  Simplify the import workflow by:
  1. Supporting all CSS units (rem, em, %, vh, vw, etc.)
  2. Adding "Full HTML (token-stripped)" option
  3. Improving JavaScript/library handling
  4. Testing WebFlow Designer Extension
  5. Adding React project conversion
todos:
  - id: css-unit-support
    content: Ensure CSS parser and Webflow converter preserve all units (rem, em, %, vh, vw, calc, clamp)
    status: completed
    plan: action-plan-1-css-unit-support.md
  - id: full-html-stripped
    content: Add handleCopyFullHtmlStripped handler in ImportWizard that combines all components and uses buildComponentPayload with skipEstablishedStyles
    status: pending
    plan: action-plan-2-html-import-improvements.md
  - id: html-tab-ui
    content: Update HtmlTab to show Full HTML (token-stripped) as primary action, make individual components secondary/collapsible
    status: pending
    plan: action-plan-2-html-import-improvements.md
  - id: external-scripts-state
    content: Add externalScripts to artifacts state from extractCleanHtml result
    status: pending
    plan: action-plan-2-html-import-improvements.md
  - id: external-scripts-ui
    content: Add external scripts section to JsTab with copy-able script tags and Webflow instructions
    status: pending
    plan: action-plan-2-html-import-improvements.md
  - id: extension-test-plan
    content: Document extension testing approach - either request Webflow access or create unit tests for core logic
    status: pending
    plan: action-plan-3-extension-testing.md
  - id: react-upload-ui
    content: Create React import page with folder/zip upload, project type detection, and build status display
    status: pending
    plan: action-plan-4-react-conversion.md
  - id: react-parser
    content: Create lib/react-parser.ts to analyze React project structure, detect framework (CRA, Vite, Next), and identify entry points
    status: pending
    plan: action-plan-4-react-conversion.md
  - id: react-builder
    content: Create lib/react-builder.ts to run static build and extract HTML output from dist/build folder
    status: pending
    plan: action-plan-4-react-conversion.md
  - id: react-css-extractor
    content: Create lib/react-css-extractor.ts to extract CSS from various sources (CSS files, CSS modules, Tailwind, styled-components)
    status: pending
    plan: action-plan-4-react-conversion.md
  - id: react-to-vanilla
    content: Create lib/react-to-vanilla.ts to convert React interactions (useState, useEffect, onClick) to vanilla JavaScript
    status: pending
    plan: action-plan-4-react-conversion.md
  - id: react-output-ui
    content: Add React output view with separate copyable sections for HTML, CSS, Vanilla JS, and library links with Webflow instructions
    status: pending
    plan: action-plan-4-react-conversion.md
---

# Import Flow Redesign - Master Roadmap

This is the master roadmap. The work has been divided into **4 executable action plans**.

## Action Plans

| # | Plan | Description | Status | Owner |
|---|------|-------------|--------|-------|
| 1 | [CSS Unit Support](action-plan-1-css-unit-support.md) | Handle all CSS units (rem, em, %, vh, vw, calc, clamp) | 🟢 Completed | You |
| 2 | [HTML Import Improvements](action-plan-2-html-import-improvements.md) | Full HTML copy option, external scripts UI | 🔴 Not Started | You |
| 3 | [Extension Testing](action-plan-3-extension-testing.md) | Test Designer Extension in Webflow | 📤 Delegated | External Dev |
| 4 | [React Conversion](action-plan-4-react-conversion.md) | Convert React projects to Webflow-ready output | 🔴 Not Started | You |

## Recommended Execution Order

### Your Work (Plans 1, 2, 4)

```
┌─────────────────────────┐
│  Phase 1: Foundation    │
│  ─────────────────────  │
│  Plan 1: CSS Units      │  ← START HERE
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Phase 2: Core Features │
│  ─────────────────────  │
│  Plan 2: HTML Imports   │  ← Main deliverable
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Phase 3: New Feature   │
│  ─────────────────────  │
│  Plan 4: React Conv.    │  ← Advanced feature
└─────────────────────────┘
```

### Delegated Work (Plan 3)

```
┌─────────────────────────────────────────┐
│  Plan 3: Extension Testing              │
│  ─────────────────────────────────────  │
│  Owner: External developer with         │
│         Webflow Designer Extensions     │
│                                         │
│  Send them: action-plan-3-extension-    │
│             testing.md                  │
│                                         │
│  They need: Access to the extension     │
│             code (flow-stach-designer-  │
│             extension/ folder)          │
└─────────────────────────────────────────┘
```

---

## Quick Reference: What Changed

### NEW: CSS Unit Support (Plan 1)

**Problem:** Current parsing may assume pixels or incorrectly handle relative units.

**Solution:** Create `lib/css-units.ts` with:
- `parseCSSValue()` - Parse "1.5rem" → { value: 1.5, unit: 'rem' }
- Update `css-parser.ts`, `webflow-converter.ts`, `webflow-literalizer.ts`
- Handle `calc()`, `clamp()`, `min()`, `max()` expressions
- Preserve unitless values (line-height, z-index, opacity)

**Units to support:**
- Absolute: px
- Relative: rem, em, %
- Viewport: vh, vw, vmin, vmax, dvh, dvw
- Other: ch, ex, fr, deg, rad, turn, ms, s

---

## Files Overview

### Existing Files to Modify

| File | Plan | Changes |
|------|------|---------|
| `lib/css-parser.ts` | 1 | Use `parseCSSValue()`, preserve units |
| `lib/webflow-converter.ts` | 1 | Preserve units in styleLess output |
| `lib/webflow-literalizer.ts` | 1 | Unit-aware style generation |
| `app/admin/import/page.tsx` | 2 | Add Full HTML handler, external scripts UI |

### New Files to Create

| File | Plan | Purpose |
|------|------|---------|
| `lib/css-units.ts` | 1 | CSS value parsing utilities |
| `tests/css-units.test.ts` | 1 | Unit tests for CSS parsing |
| `app/admin/import-react/page.tsx` | 4 | React import page |
| `lib/react-parser.ts` | 4 | Parse React project structure |
| `lib/react-builder.ts` | 4 | Extract from build output |
| `lib/react-css-extractor.ts` | 4 | Extract CSS from various sources |
| `lib/react-to-vanilla.ts` | 4 | Convert React to vanilla JS |
| `flow-stach-designer-extension/tests/*.test.ts` | 3 | Extension unit tests |

---

## How to Execute

### To run Plan 1 (CSS Unit Support):
```
Open: .claude/plans/action-plan-1-css-unit-support.md
Execute tasks 1.1 through 1.7
```

### To run Plan 2 (HTML Import Improvements):
```
Prerequisite: Complete Plan 1
Open: .claude/plans/action-plan-2-html-import-improvements.md
Execute tasks 2.1 through 2.4
```

### Plan 3 (Extension Testing) - DELEGATED:
```
Send to external developer:
  - File: .claude/plans/action-plan-3-extension-testing.md
  - Folder: flow-stach-designer-extension/

They will run the 5 test cases and report back with:
  - Screenshots of results
  - Any bug reports using the template in the doc
```

### To run Plan 4 (React Conversion):
```
Prerequisite: Complete Plan 1
Open: .claude/plans/action-plan-4-react-conversion.md
Execute tasks 4.1 through 4.6
```

---

## Status Legend

- 🔴 Not Started
- 🟡 In Progress
- 🟢 Completed
- 📤 Delegated (waiting on external developer)
- ⏸️ Blocked

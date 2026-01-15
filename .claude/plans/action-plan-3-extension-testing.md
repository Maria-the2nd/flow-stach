# Webflow Designer Extension - Testing & Validation

**For: External Developer with Webflow Designer Extensions Access**

---

## Context

This document is for a developer who has access to Webflow Designer Extensions. The extension code is complete but needs testing in a real Webflow environment.

## Project Repository

```
flow-stach-designer-extension/
├── src/
│   ├── collision/
│   │   └── detector.ts      # Detects duplicate classes/variables
│   ├── variables/
│   │   ├── manager.ts       # Creates Webflow variables from CSS tokens
│   │   └── remapper.ts      # Remaps CSS var() to Webflow UUIDs
│   └── index.ts             # Extension entry point
├── package.json
└── manifest.json
```

## What This Extension Does

1. **Variable Creation** - When user pastes "Design Tokens", creates native Webflow Variables
2. **Collision Detection** - When pasting duplicate classes, shows dialog to skip/rename
3. **UUID Remapping** - Converts `var(--color-primary)` to Webflow's internal UUID format

---

## Setup Instructions

### 1. Install Dependencies

```bash
cd flow-stach-designer-extension
npm install
```

### 2. Build Extension

```bash
npm run build
```

### 3. Load in Webflow Designer

1. Open Webflow Designer for any project
2. Go to Extensions panel
3. Load the built extension (follow Webflow's developer documentation)

---

## Test Cases

### Test 1: Variable Creation from Design Tokens

**Steps:**
1. Go to the Flow Stach app (`/admin/import`)
2. Import any HTML with CSS variables (design tokens)
3. Go to "Tokens" tab and click "Copy Design Tokens"
4. Open Webflow Designer
5. Paste (Ctrl/Cmd+V)

**Expected Result:**
- Variables appear in Webflow's Variables panel
- Variable names match CSS variable names (e.g., `--color-primary`)
- Variable values are correct (colors, sizes, etc.)

**Screenshot needed:** Variables panel showing created variables

---

### Test 2: Collision Detection - Duplicate Classes

**Steps:**
1. Paste a component into Webflow (any component from Flow Stach)
2. Note the class names created
3. Paste the SAME component again

**Expected Result:**
- Collision dialog appears
- Dialog shows which classes already exist
- Options: "Skip duplicates" or "Rename with suffix"

**Screenshot needed:** Collision dialog

---

### Test 3: Collision Resolution - Skip Duplicates

**Steps:**
1. Trigger collision dialog (paste same component twice)
2. Select "Skip duplicates"

**Expected Result:**
- No new classes created
- Existing classes are reused
- No "-2" suffix added to class names
- Component renders correctly using existing styles

**Verify:** Check Classes panel - no duplicate class names

---

### Test 4: Collision Resolution - Rename

**Steps:**
1. Trigger collision dialog (paste same component twice)
2. Select "Rename with suffix"

**Expected Result:**
- New classes created with "-2" suffix (or similar)
- Both components have independent styles

---

### Test 5: UUID Remapping

**Steps:**
1. Create variables first (Test 1)
2. Paste a component that uses those variables
3. Inspect the element's styles in Webflow

**Expected Result:**
- Styles reference Webflow's internal variable UUIDs
- NOT raw CSS variable names like `var(--color-primary)`
- Changes to variables reflect in component styles

**How to verify:**
- Edit a variable value in Webflow Variables panel
- Component should update to reflect the change

---

## Bug Report Template

If something doesn't work, please document:

```markdown
## Bug: [Short description]

**Test Case:** [Which test from above]

**Steps to Reproduce:**
1.
2.
3.

**Expected:** [What should happen]

**Actual:** [What actually happened]

**Screenshots:** [Attach if possible]

**Console Errors:** [Open DevTools, check Console tab]

**Browser:** [Chrome/Firefox/Safari version]

**Webflow Plan:** [Which Webflow plan/workspace]
```

---

## Files to Review if Issues Occur

| Issue | File to Check |
|-------|---------------|
| Variables not created | `src/variables/manager.ts` |
| Collision dialog not appearing | `src/collision/detector.ts` |
| UUID remapping broken | `src/variables/remapper.ts` |
| Extension not loading | `manifest.json`, `src/index.ts` |

---

## Success Criteria

All tests pass:
- [ ] Test 1: Variables created correctly
- [ ] Test 2: Collision dialog appears
- [ ] Test 3: Skip duplicates works (no "-2" suffix)
- [ ] Test 4: Rename option works
- [ ] Test 5: UUID remapping works (variable changes reflect)

---

## Questions?

Contact the project owner with:
- Screenshots of any errors
- Console output from browser DevTools
- Steps you took before the error

---

## Optional: Unit Tests (Can Run Locally)

If you want to verify core logic before testing in Webflow:

```bash
cd flow-stach-designer-extension
npm test
```

This runs unit tests for:
- `extractVariableReferences()` - Parsing var() from CSS
- `parseTokenManifest()` - Token processing
- `remapVariableReferences()` - UUID substitution

These tests don't require Webflow access.

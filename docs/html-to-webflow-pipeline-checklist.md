# HTML-to-Webflow Pipeline Fix Checklist

This checklist targets the root cause: **class→style ID integrity**. Every `node.classes` entry must resolve to a `style._id` that exists.

---

## P0 — Critical (Fix First)

### P0.0 — Invalid CSS Values Breaking Webflow Publish (NEW - BLOCKING)

**Task:** Fix CSS parsing/sanitization bugs that produce invalid styleLess values.

**Bug A: expandBorderShorthand truncates rgba colors**

Location: `lib/css-parser.ts` line 620

```typescript
// CURRENT (broken)
const parts = trimmed.split(/\s+/).filter(Boolean);

// This breaks: border: 1px solid rgba(255, 255, 255, 0.1)
// Split becomes: ["1px", "solid", "rgba(255,", "255,", "255,", "0.1)"]
// Result: border-color: rgba(255,;  <-- INVALID
```

**Fix:** Split border value while preserving parenthesized content.

**Bug B: Comments left in styleLess**

Location: `lib/webflow-sanitizer.ts` line 1248

```typescript
// CURRENT (broken)
styleLess = styleLess.replace(pattern, '/* [extracted to embed] */');

// Should be:
styleLess = styleLess.replace(pattern, '');
```

Webflow's styleLess format doesn't support CSS comments.

**Pass:** Webflow Audit panel shows 0 "Invalid styles" errors. Site can publish.

**Fail:** "Invalid styles prevent site from publishing" error.

---

### P0.1 — Fix buildCssTokenPayload Using Names Instead of UUIDs

**Task:** Fix `buildCssTokenPayload` to use style `_id` (UUIDs) in `node.classes`, not class names.

**Location:** `lib/webflow-converter.ts` lines 2277-2334

**The Bug:**
```typescript
// Line 2277 - Creates styles with random UUIDs
const styles = classIndexToWebflowStyles(classIndex);
// style._id = "abc-123-uuid", style.name = "hero"

// Line 2329 - Uses NAMES, not UUIDs!
const classes = buildComboChain(className);  // Returns ["hero"] - NAME!

// Line 2334 - Puts NAMES into node.classes
nodes.push({ classes });  // node.classes = ["hero"] - WRONG!
```

**Why This Breaks:**
- Webflow expects `node.classes` to contain `style._id` values
- But we're putting class NAMES in `node.classes`
- When Webflow looks for style with `_id = "hero"`, it doesn't find it

**Fix Requirements:**
1. Create a `StyleIdMap` first (maps name → UUID)
2. Pass it to `classIndexToWebflowStyles` for consistent UUID assignment
3. In `buildComboChain`, return `styleIdMap.get(className)` to get the UUID

**Pass:** Safety Report shows **0** "Node references missing class" warnings.

**Fail:** Warnings like "Node references missing class: section" appear.

---

### P0.1b — Fix Site Structure Remap (Downstream Fix)

**Task:** Fix `siteStructurePayload` remap in `project-details-view.tsx`.

**Location:** `components/workspace/project-details-view.tsx` lines 311-435

**Note:** This may be unnecessary if P0.1 is fixed correctly, since the root cause is upstream. But if components still have name/ID mismatches:

**Fix Requirements:**
- Remap by BOTH `style._id` AND `style.name`
- Never keep an invalid UUID - fail fast or inject style

**Pass:** Safety Report shows **0** "Node references missing class" warnings for Site Structure.

**Fail:** Any missing class warnings remain.

---

### P0.2 — Ensure Body Background is Actually Applied

**Task:** Guarantee `wf-body` style exists AND is used by a node in Style Guide.

**Why:** Webflow only creates classes when a node references them. Having the style definition alone is not enough.

**Fix Requirements:**
- Style Guide must include:
  1. A style definition for `.wf-body` with full properties (including background)
  2. A node that has `classes: ["<wf-body-style-id>"]`
- OR: Apply `wf-body` class to the Style Guide wrapper node

**Pass:** After pasting Style Guide only, Webflow canvas background matches body background (not white).

**Fail:** Canvas stays white.

---

### P0.3 — Guarantee Remap Integrity (Validation Gate)

**Task:** Add a validation gate: if any `node.classes` entry is not in final styles, fail fast or auto-inject the style.

**Location:** Add validation in `siteStructurePayload` useMemo before returning

**Implementation:**
```typescript
// Before returning payload, validate:
for (const node of allNodes) {
  for (const classId of node.classes || []) {
    if (!allStyleIds.has(classId)) {
      // Option A: Fail fast
      throw new Error(`Orphan class ID: ${classId} on node ${node._id}`);
      // Option B: Auto-inject placeholder style
    }
  }
}
```

**Pass:** Internal validation reports **0** orphan class IDs.

**Fail:** Any orphan class IDs detected.

---

## P1 — High Priority

### P1.1 — Verify BEM → Converter Ordering

**Task:** Ensure converter consumes post-BEM HTML/CSS only.

**Location:** `lib/project-engine.ts` — check pipeline ordering

**Why:** If converter runs on pre-rename HTML/CSS, styles will be generated for OLD names while nodes carry NEW names.

**Check:**
1. BEM renamer runs first, outputs renamed HTML/CSS
2. Converter receives renamed HTML/CSS
3. Style names in output match class names in nodes

**Pass:** Styles and nodes in output reference BEM names, not pre-rename names.

**Fail:** Any class names in styles don't match classes in nodes.

---

### P1.2 — Normalize + Componentizer Injected Classes

**Task:** Every injected class (`wf-body`, `wf-section`, etc.) must have a style definition downstream.

**Locations:**
- `lib/webflow-normalizer.ts` → `normalizeSelector()` injects `wf-body`
- `lib/componentizer.ts` → `injectRootClasses()` adds classes to component roots

**Check:**
1. List all classes injected by normalizer/componentizer
2. Verify each appears in `buildCssTokenPayload` output styles
3. Verify each is referenced by at least one node

**Pass:** Each injected class appears in styles AND is referenced by nodes.

**Fail:** Injected classes appear in HTML but not in styles.

---

## P2 — Medium Priority

### P2.1 — Body Style Extraction (Beyond Typography)

**Task:** Extend body extraction to capture ALL properties, not just typography.

**Location:** `lib/css-parser.ts` → `extractElementTypography()` (line 1438)

**Current State:** Only extracts:
- fontFamily, fontSize, fontWeight, fontStyle, lineHeight, letterSpacing, color, textTransform, textDecoration

**Missing:** background, background-color, margin, padding, etc.

**Fix:** Create `extractElementBaseStyles()` or extend `extractElementTypography()` to capture all properties.

**Pass:** In Style Guide output, `wf-body` style contains `background-color` when present in source CSS.

**Fail:** `wf-body` style exists but lacks background properties.

---

### P2.2 — Safety Gate Alignment

**Task:** `repairStyleReferenceIds` should not leave UUIDs unfixable.

**Location:** `lib/webflow-safety-gate.ts`

**Current State:** 
- `repairStyleReferenceIds()` only handles class NAMES → IDs
- Cannot fix UUIDs that don't exist after dedupe
- `createPlaceholderStylesForMissingClasses()` no longer creates placeholders

**Fix:** If remap is correct upstream (P0), safety gate should have nothing to fix. But if it encounters orphan UUIDs, it should:
- Log a clear error
- Optionally create placeholder styles as last resort

**Pass:** Safety gate never reports "class references do not match style IDs" if remap is correct.

**Fail:** It still reports missing UUIDs for valid payloads.

---

## P3 — Low Priority (Should Resolve Automatically)

### P3.1 — Wrapper Elimination

**Note:** There are TWO different wrappers:

1. **Multi-root wrapper:** "Wrapped 4 root elements in a container (Webflow requires single root)"
   - Location: `lib/webflow-sanitizer.ts` → `wrapMultipleRoots()`
   - This is VALID — Webflow requires single root
   - NOT a bug, just structural requirement

2. **Style-seeding wrapper:** "CSS Styles Established – N classes. Delete this wrapper after pasting."
   - Location: `lib/webflow-converter.ts` → `buildCssTokenPayload()` (line 2355)
   - This appears because Site Structure has class references missing from Style Guide
   - IS a symptom of the class→style mismatch

**Task:** Once Site Structure remap is fixed (P0), style-seeding wrapper should be unnecessary.

**Pass:** No "CSS Styles Established…" wrapper is inserted in Site Structure (token payload wrapper is expected).

**Fail:** Style-seeding wrapper still injected (indicates style mismatch persists).

---

## Final Acceptance (End-to-End)

Run through complete import → paste workflow:

| Step | Expected Result |
|------|-----------------|
| 1. Import HTML | No errors |
| 2. Paste Style Guide | Background color applies immediately |
| 3. Check Safety Report | 0 missing class warnings |
| 4. Paste Site Structure | All sections have correct names and styles |
| 5. Check Navigator | Sections show class names, not just "Section" |
| 6. Check Site Structure | No style-seeding wrapper needed |

**Pass:** All 6 steps succeed.

**Fail:** Any step fails.

---

## Execution Order

```
P0.1 (Site Structure remap) 
    ↓
P0.3 (Validation gate)
    ↓
P0.2 (wf-body in Style Guide)
    ↓
P1.1 (BEM ordering)
    ↓
P1.2 (Injected classes)
    ↓
P2.1 (Body style extraction)
    ↓
P2.2 (Safety gate)
    ↓
P3.1 (Verify wrapper gone)
    ↓
Final Acceptance
```

---

## Key Files Reference

| Priority | File | Function | Issue |
|----------|------|----------|-------|
| P0 | `components/workspace/project-details-view.tsx` | `siteStructurePayload` | Remap logic bug |
| P0 | `lib/webflow-converter.ts` | `buildCssTokenPayload` | wf-body node needed |
| P1 | `lib/project-engine.ts` | Pipeline orchestration | BEM ordering |
| P1 | `lib/webflow-normalizer.ts` | `normalizeSelector` | Injects wf-body |
| P1 | `lib/componentizer.ts` | `injectRootClasses` | Injects classes |
| P2 | `lib/css-parser.ts` | `extractElementTypography` | Missing body props |
| P2 | `lib/webflow-safety-gate.ts` | `repairStyleReferenceIds` | UUID handling |

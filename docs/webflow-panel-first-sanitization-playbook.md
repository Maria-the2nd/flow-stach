# Webflow Panel-First Sanitization Playbook

Last updated: February 7, 2026

## Purpose

This document defines how to fine-tune HTML/CSS conversion locally and safely roll it into the app.

Primary goal:
- Keep the maximum amount of styling editable in Webflow's Style Panel.
- Use CSS/JS/HTML embeds only for rules Webflow cannot represent natively.
- Avoid hardcoded fixture logic so the pipeline works for arbitrary imports.

## Non-Negotiable Rules

1. Panel-first routing.
- Native Webflow classes are preferred whenever conversion is possible.
- Embed CSS is fallback, not default.

2. No fixture-specific hardcoding.
- Do not add logic for one test slug, one class name, or one template only.
- All transforms must be based on reusable CSS/HTML patterns.

3. BEM + combo classes over custom code where possible.
- Convert descendant/element styling into class-based structures and modifiers.
- Preserve context with combo/modifier classes when needed.

4. Embed only true Webflow gaps.
- Pseudo-elements, unsupported selectors, unsupported at-rules, and specific advanced cases.

## Implemented in This Cycle

### 1) Two-pass CSS routing (generic, non-hardcoded)

Files:
- `lib/webflow-converter.ts`
- `audit/runner/pipeline-executor.ts`

Flow:
1. Pre-pass routes only hard blockers (`phase: "hard-blockers"`).
2. Normalizer converts remaining native-safe CSS/HTML.
3. Post-pass routes any remaining non-native rules (`phase: "full"`).
4. Embed CSS is merged once at the end.

Result:
- More CSS stays native.
- Complex rules still survive via embed.

### 2) Brace-safe at-rule extraction

File:
- `lib/css-embed-router.ts`

What changed:
- Replaced fragile regex-only extraction for block at-rules with brace-matching extraction.
- Handles nested keyframe blocks safely.

Block at-rules extracted with brace matching:
- `@keyframes`
- `@font-face`
- `@supports`
- `@layer`

Simple semicolon at-rules extracted with regex:
- `@charset`
- `@import`
- `@namespace`

Result:
- Prevents malformed embed CSS.
- Prevents accidental swallowing/corruption of nearby rules (like `:root`/`body`).

### 3) Full-viewport body background preservation

Files:
- `lib/webflow-normalizer.ts` (existing extraction behavior)
- `lib/webflow-converter.ts` (already merges `bodyBackgroundEmbed`)
- `audit/runner/pipeline-executor.ts` (now mirrors app behavior)

Why:
- In source HTML, `body` background covers viewport.
- In Webflow payloads, `.wf-body` is a wrapper div, often constrained by width.
- Background can appear white outside wrapper if not handled.

Approach:
- Keep layout constraints on `.wf-body`.
- Emit minimal embed rule for actual page body background when needed.

### 4) Stateful interaction selectors stay dynamic

Files:
- `lib/webflow-normalizer.ts`
- `lib/css-embed-router.ts`

What changed:
- Stateful ancestor chains like `.tab.active .tab-number` and `.faq-item.active .faq-answer` are no longer flattened into static classes.
- These selectors are routed to embed when needed so runtime class toggles (`active`, `open`, etc.) keep working.

Result:
- Interaction states remain correct after sanitization.
- Static non-state descendants can still be flattened to keep panel editability high.

### 5) Quote-safe grid template handling

File:
- `lib/webflow-literalizer.ts`

What changed:
- Quote stripping now preserves values that require quoted strings, especially `grid-template-areas`.

Result:
- Bento/grid layouts keep valid area definitions across base and media rules.

### 6) Anchor base selector parity (`a` -> `.link`)

File:
- `lib/webflow-normalizer.ts`

What changed:
- Element selector `a { ... }` is still converted to `.link` (panel-first), and all anchor nodes now automatically receive the `link` class in both normalization paths.

Result:
- Global link resets (for example `text-decoration: none; color: inherit`) continue to apply.
- Prevents blue/underlined fallback links when source relies on base `a` styling.

### 7) Scroll-reveal layout safety without JS

File:
- `lib/webflow-normalizer.ts`

What changed:
- Scroll-reveal base classes (for example `.fade-up`) now default to static visible values when source CSS depends on runtime state toggles.
- If source includes a visible-state selector (for example `.fade-up.visible`), its final `transform`/`opacity` is reused as the static baseline.
- This inference is class-agnostic: any unknown class with a state combo (for example `.intro-block.visible`) is handled the same way.
- If no visible-state selector exists, offscreen transform baselines are neutralized to `transform: none` when paired with hidden defaults.

Result:
- No layout collapse from script-dependent reveal offsets.
- Visual spacing remains stable in Webflow-first/static contexts.

### 8) Audit preview JS parity

File:
- `audit/runner/pipeline-executor.ts`

What changed:
- Audit `sanitized.html` now includes both:
  - inline scripts extracted from source HTML
  - optional external JS fixture file content

Result:
- Audit previews better match source interaction behavior.
- Reduces false visual diffs caused only by dropped runtime scripts.

### 9) Embed selector parity for element-to-class normalization

File:
- `lib/css-embed-router.ts`

What changed:
- When a rule is routed/split to embed and its selector is a pure element selector (for example `h1`, `a:hover`), embed routing now remaps it to the same normalized class selector used by native conversion (for example `.heading-h1`, `.link:hover`).
- `html` and `body` selectors remain untouched.

Result:
- Avoids specificity mismatches between native class styles and embed fallback styles.
- Preserves effects like gradient text clipping when vendor-prefixed properties are split to embed.

### 10) Gradient decoupling stacking-context safety

Files:
- `lib/gradient-transform-decoupler.ts`
- `tests/gradient-transform-decoupler.test.ts`

What changed:
- Gradient/transform decoupling inserts a child background layer (for example `.card-bg`) with `position: absolute; inset: 0; z-index: -1`.
- Parent transform layer now always receives `z-index: 0` (in addition to `position: relative`) when decoupled.

Why:
- Without a parent stacking context, negative z-index background helpers can render behind ancestor backgrounds and appear missing.

Result:
- Decoupled gradient layers remain visible across fixtures without fixture-specific logic.

### 11) Modifier classes for descendant element selectors

Files:
- `lib/css-parser.ts`
- `lib/webflow-converter.ts`
- `lib/css-embed-router.ts`

What changed:
- Descendant selectors like `.hero h1` no longer route to embed. Instead, the parser creates a modifier class (`hero-h1`) with context-specific styles, while the base class (`heading-h1`) retains typography.
- The converter tracks `ancestorClasses` during HTML tree traversal and injects modifier classes into descendant elements automatically.
- The router safety net skips flattenable typography elements (`h1`-`h6`, `p`, `a`, `ul`, `ol`, `li`, `blockquote`) since the parser handles them.

Result:
- Descendant element styles remain editable in Webflow Style Panel.
- Elements get both base + modifier classes: `<h1 class="heading-h1 hero-h1">`.

### 12) Pseudo-class rules in min-width media queries preserved

Files:
- `lib/css-parser.ts`

What changed:
- Previously, `:hover` rules inside `@media (min-width: ...)` blocks were silently dropped (`if (parsed.pseudoClass) continue;`).
- Now pseudo-class rules inside non-standard min-width media blocks are collected and routed to `nonStandardMediaCss` for embed output.

Result:
- Hover effects at large breakpoints are preserved in embed CSS instead of lost.

### 13) Hardcoded app CSS classes removed

Files:
- `app/globals.css`
- 8 component files

What changed:
- Removed hardcoded CSS classes from the app design system: `btn-premium`, `premium-hover`, `premium-card-hover`, `btn-primary-cta`, `glass-card-hover`, `font-display`, `scrollbar-hide`, `shadow-2xl`.
- These represented CSS patterns (shimmer effects, hover transitions, box shadows) that the pipeline should detect and handle dynamically for any imported file.
- Replaced with inline Tailwind utilities.

Result:
- App styling uses only Tailwind utilities, not hardcoded pipeline-pattern classes.
- Pipeline handles these patterns dynamically: `::after` shimmer via embed routing, `:hover` transitions via Webflow hover variants, `box-shadow` and `transition` as native properties.

## Local Fine-Tuning Workflow

Run:
```bash
bun run audit
```

Inspect:
- `temp/tests/_out/<slug>/original.html`
- `temp/tests/_out/<slug>/sanitized.html`
- `temp/tests/_out/SMART_ANALYSIS.txt`

Export one-by-one HTML pairs:
- `temp/tests/_html_exports/INDEX.csv`
- `temp/tests/_html_exports/*-original.html`
- `temp/tests/_html_exports/*-webflow-ready.html`

## App Rollout Checklist

Before shipping changes from local tuning to app:

1. Keep parity between app and audit paths.
- If routing/normalization changes in app pipeline, mirror in audit pipeline.

2. Validate non-hardcoding.
- No logic keyed by test slug or single class names.
- Pattern-based selector/property handling only.

3. Re-run validation.
```bash
bun run typecheck
bun run audit
```

4. Spot-check known stress fixture.
- `wf-motion-effects-test` is a useful sanity check for transitions, transforms, filters, pseudo-elements, and body background behavior.

## Hardcoding Guardrail

Allowed:
- Pattern logic such as selector classes, pseudo detection, at-rule category handling, and brace matching.

Not allowed:
- `if (slug === "wf-motion-effects-test") ...`
- `if (selector === ".some-one-off-class") ...` unless it is part of a documented global rule category.

## Acceptance Criteria

1. Sanitized output remains valid CSS with intact at-rules.
2. Webflow-editable styles are maximized in native class output.
3. Embed CSS contains only unsupported/necessary rules.
4. Body background behavior matches source intent in constrained layouts.
5. Same logic works across multiple fixtures without per-fixture branching.

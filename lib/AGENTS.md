# `lib/` — Shared logic (clipboard/export, token extraction, conversion pipeline)

This folder owns shared, non-UI logic used by the importer, validators, and "copy to Webflow" flows.

## Source of truth

- `AUTHORITATIVE_CURRENT_STATE.md` (pipeline stages, outputs, exclusions)
- `SYSTEM_MANIFEST.md` (clipboard + Style Guide + pipeline architecture)

## Conversion pipeline files (critical path)

| File | Role |
|------|------|
| `project-engine.ts` | Pipeline orchestrator — calls all stages in order |
| `css-embed-router.ts` | Two-phase CSS routing (hard-blockers → full), CSS variable resolution, `flattenableElements` set |
| `webflow-normalizer.ts` | Rewrite HTML/CSS to class-only selectors, nth-child→BEM, typography injection |
| `webflow-literalizer.ts` | Resolve CSS variables to literals, strip unsupported constructs |
| `css-parser.ts` | CSS→ClassIndex, modifier class creation for descendant selectors, media query bucketing, `nonStandardMediaCss` |
| `webflow-converter.ts` | ClassIndex→Webflow JSON, `ancestorClasses` tracking, UUID style IDs |
| `gradient-transform-decoupler.ts` | Decouple gradient + transform on same element |

### Pipeline flow
```
extractCleanHtml → routeCSS(hard-blockers) → normalizeHtmlCssForWebflow
→ routeCSS(full) → literalizeCssForWebflow → parseCSS → buildPayloads
```

### Key patterns
- **Modifier classes**: `.hero h1` → creates `hero-h1` modifier class (parser) + injects via `ancestorClasses` (converter). Flattenable elements (`h1`-`h6`, `p`, `a`, `ul`, `ol`, `li`, `blockquote`) stay native.
- **nonStandardMediaCss**: Container queries, print, `>991px` max-width, pseudo-class rules inside min-width media → collected by parser, merged into embed.
- **STATEFUL_CLASS_TOKENS**: Set of ~22 tokens (`active`, `open`, `visible`, etc.) that trigger embed routing for interaction selectors.

## Other touch points

- Clipboard helpers: `clipboard.ts`
- Token extraction: `token-extractor.ts`
- Style Guide payload generator: `webflow-style-guide-generator.ts`
- Webflow verification: `webflow-verifier.ts` (run via `bun run verify`)

If you're changing Style Guide behavior, keep the term **Style Guide (Design Tokens)** consistent everywhere.

## Guardrails (product-critical)

- Clipboard exports must be validated/sanitized before copy (follow existing helpers).
- "Site Structure Payload" must remain **base layout styles only** and must not duplicate styles already provided by Style Guide or Embeds.
- No fixture-specific hardcoding — all transforms must be pattern-based.
- Panel-first: maximize Webflow Style Panel editability. Embed is fallback, not default.

## Pre-PR checks (for `lib/` changes)

```bash
bun run typecheck
npx vitest run
```

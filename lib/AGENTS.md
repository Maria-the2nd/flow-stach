# `lib/` — Shared logic (clipboard/export, token extraction, conversion utilities)

This folder owns shared, non-UI logic used by the importer, validators, and “copy to Webflow” flows.

## Source of truth

- `AUTHORITATIVE_CURRENT_STATE.md` (pipeline stages, outputs, exclusions)
- `SYSTEM_MANIFEST.md` (clipboard + Style Guide pointers)

## Touch points (start here)

- Clipboard helpers: `lib/clipboard.ts`
- Token extraction: `lib/token-extractor.ts`
- Style Guide payload generator: `lib/webflow-style-guide-generator.ts`
- Webflow verification: `lib/webflow-verifier.ts` (run via `bun run verify`)

If you’re changing Style Guide behavior, keep the term **Style Guide (Design Tokens)** consistent everywhere.

## Guardrails (product-critical)

- Clipboard exports must be validated/sanitized before copy (follow existing helpers).
- “Site Structure Payload” must remain **base layout styles only** and must not duplicate styles already provided by:
  - Style Guide (Design Tokens)
  - Embeds (CSS/JS + external libs)

## Pre-PR checks (for `lib/` changes)

```bash
bun run typecheck && bun run lint && bun run verify
```


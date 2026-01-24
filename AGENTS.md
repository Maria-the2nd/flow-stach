# Flow Bridge — `AGENTS.md` (root)

This repo uses a **nearest-wins** `AGENTS.md` hierarchy: when editing a file, read the closest `AGENTS.md` in its directory tree.

## Source of truth (read these first)

- `AUTHORITATIVE_CURRENT_STATE.md` (**canonical current behavior; supersedes older docs**)
- `SYSTEM_MANIFEST.md` (routing, IA, naming guardrails; aligned to current-state)
- `CLAUDE.md` (dev quickstart; defers to manifest)

If anything conflicts, **defer to `AUTHORITATIVE_CURRENT_STATE.md`**.

## Documentation location policy (IMPORTANT)

- **All documentation should live under `docs/`** (feature docs, implementation notes, how-tos, architecture writeups).
- **Do not** add new “random” `.md` files at repo root or scattered throughout folders.
- **Explicit exceptions**: this root `AGENTS.md` and `CLAUDE.md` may live at the repo root.

## Quick commands (repo root)

```bash
bun install
bun run dev            # Next.js + Convex (via concurrently)
bun run convex:dev     # Convex only
bun run typecheck
bun run lint
bun run build
bun run verify         # Webflow verifier pipeline
bun run test:flowbridge
```

## Naming guardrails (avoid confusion)

- **Marketplace Templates/Components**: public catalog or owned library items.
- **Imported Projects**: user-owned HTML imports (`importProjects`).
- **Extracted Components**: outputs derived from an import project (stored as Assets + Payloads).
- **Style Guide (Design Tokens)**: the single term for token UI + Webflow copy payload.
- **Site Structure Payload**: full layout with **base layout styles only**; excludes Style Guide + Embeds styles.

## JIT Index (what to open, not what to paste)

- Next.js routes, layouts, API routes: `app/` → `app/AGENTS.md`
- UI components + Style Guide UI: `components/` → `components/AGENTS.md`
- Convex backend (tables/functions/auth): `convex/` → `convex/AGENTS.md`
- Clipboard/export + token/style guide generators: `lib/` → `lib/AGENTS.md`
- Chrome extension (Vite build, env vars, entrypoints): `flow-bridge-extension/` → `flow-bridge-extension/AGENTS.md`
- Test harness files: `tests/` → `tests/AGENTS.md`

## Definition of done (before you call it “done”)

- `bun run typecheck`
- `bun run lint` (or justify why not)
- `bun run build` (for UI/routing/API changes)
- `bun run verify` / `bun run test:flowbridge` when touching conversion/validation/import logic


# Generate `AGENTS.md` for **Flow Bridge** (Flow Stach repo)

This repo benefits from a **hierarchical `AGENTS.md` system** so AI coding agents can operate with minimal token usage and minimal wrong assumptions.

## 0) Hard source-of-truth rules (KEEP IN SYNC)

When generating `AGENTS.md`, align wording and constraints with:

- `AUTHORITATIVE_CURRENT_STATE.md` (**canonical current behavior**; supersedes older docs)
- `SYSTEM_MANIFEST.md` (**routing + UI IA + naming guardrails**, aligned to current-state)
- `CLAUDE.md` (**developer quickstart; defers to the manifest**)

If anything conflicts, **defer to `AUTHORITATIVE_CURRENT_STATE.md`** and mention the deprecation/alternative in a short note.

## 1) Core principles (non-negotiable)

1. **Root `AGENTS.md` stays lightweight** (aim \(~100–200\) lines): universal rules + links.
2. **Nearest-wins**: agents read the closest `AGENTS.md` for the file they’re changing.
3. **JIT indexing**: provide *paths + commands + where to look*, not pasted file contents.
4. **Token efficiency**: short checklists and “touch points” beat encyclopedic docs.
5. **Subfolder `AGENTS.md` files contain the practical details** for that area.

## 2) Repo snapshot (CURRENT)

- **Type**: Single Next.js app + Convex backend + bundled Chrome extension (multi-root, not a workspace monorepo).
- **Runtime/tooling**: Bun (`bun.lock`) + Next.js App Router + TypeScript strict.
- **Backend**: Convex functions + Clerk auth bridged via `requireAuth(ctx)` (see `CLAUDE.md` + current-state doc).
- **Key product terms (must match UI/docs)**:
  - **Style Guide (Design Tokens)** (single term; do not split “Design Tokens” vs “Style Guide”)
  - **Site Structure Payload** (base layout styles only; excludes Style Guide + Embeds styles)
  - **Imported Projects** / **Extracted Components** vs **Marketplace Templates/Components** (avoid confusing naming)

## 3) Root commands (copy/paste)

From repo root:

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

## 4) What `AGENTS.md` files to generate (THIS REPO)

Create these files (and keep them aligned with the docs listed in section 0):

- `AGENTS.md` (root)
- `app/AGENTS.md` (Next.js routes, API routes, auth boundaries, manifests)
- `components/AGENTS.md` (UI components, Style Guide surfaces, mock data)
- `convex/AGENTS.md` (data model + auth + user scoping)
- `lib/AGENTS.md` (clipboard/export pipeline + token extraction + generators)
- `flow-bridge-extension/AGENTS.md` (extension build + env vars + entrypoints)
- `tests/AGENTS.md` (how to run/extend tests in this repo)

Optionally add `docs/AGENTS.md` only if you actively maintain `docs/` (many files may be legacy; do not treat docs as authoritative over current-state/spec docs).

## 5) What MUST be included in the root `AGENTS.md`

- **Source-of-truth pointers** (the four docs above, especially `AUTHORITATIVE_CURRENT_STATE.md`)
- **Setup/run commands** (Bun + Convex + Next)
- **Naming guardrails** (Marketplace vs Imports; Style Guide (Design Tokens); Site Structure Payload)
- **JIT Index** mapping to each sub-`AGENTS.md`
- **Definition of Done**: typecheck + lint + build (plus targeted test/verify if relevant)

## 6) Subfolder `AGENTS.md` template requirements

Each subfolder `AGENTS.md` should include:

- **Identity**: what that folder owns (2–4 lines)
- **How to run/build** for that folder (or “root-only” if not applicable)
- **Touch points**: 5–12 files/directories that answer “where do I change X?”
- **Constraints/gotchas** that prevent regressions (auth, naming, output ordering, legacy routes)
- **Minimal pre-PR check** for changes in that area

## 7) Quality checks before finalizing

- [ ] Root `AGENTS.md` is **< 200 lines**
- [ ] Root links to each subfolder `AGENTS.md`
- [ ] Terminology matches `AUTHORITATIVE_CURRENT_STATE.md` + `SYSTEM_MANIFEST.md`
- [ ] Commands match `package.json` scripts
- [ ] No “placeholder examples” — only real paths in this repo

# `convex/` — Backend (Convex functions + data model)

This folder owns the Convex backend: persistence, queries/mutations, and enforcing per-user ownership.

## Source of truth

- `AUTHORITATIVE_CURRENT_STATE.md` (data model + pipeline outputs)
- `SYSTEM_MANIFEST.md` (table names + naming guardrails)
- `CLAUDE.md` (auth rule: Clerk → Convex via `requireAuth(ctx)`)

## Data model (current)

User import data:

- `importProjects` — user-owned projects (Clerk `userId`)
- `importArtifacts` — extracted artifacts (tokens/css/html/scripts/external libs/etc)

Library layer:

- `templates`
- `assets`
- `payloads`
- (favorites exist as a user marker; UI linkage may be limited)

## Auth & ownership (non-negotiable)

- Always bridge Clerk to Convex via `requireAuth(ctx)` for authenticated operations.
- Always scope reads/writes by `userId` (Clerk subject) for user-owned objects (imports, derived assets).
- Do not introduce concepts that current-state explicitly excludes (teams, shared ownership, purchases/orders).

## Generated types (REQUIRED after schema changes)

If you change `convex/schema.ts` (or Convex function signatures), regenerate and commit `convex/_generated/*`:

```bash
bunx convex codegen
```

Details live in `docs/development/convex-types.md`.

## Pipeline expectations (high level)

Import processing produces:

- `importProjects` + `importArtifacts` records
- A `templates` record whose slug matches the import project slug
- `assets` + `payloads` for extracted components

Generated-on-demand (not persisted):

- **Style Guide (Design Tokens)** payload generation at view time
- **Site Structure Payload** generation at view time (base layout styles only)

## Pre-PR checks (for `convex/` changes)

```bash
bun run convex:dev
```


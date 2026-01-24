# CLAUDE.md - Developer Guide

**THE SYSTEM MANIFEST IS THE SOURCE OF TRUTH**: Always refer to `SYSTEM_MANIFEST.md` for current routing, features, and UI architecture.

## Documentation location policy (IMPORTANT)

- **All documentation should live under `docs/`** (feature docs, implementation notes, how-tos, architecture writeups).
- **Do not** add new `.md` docs at repo root or scattered throughout folders.
- **Explicit exceptions**: this `CLAUDE.md` and the root `AGENTS.md` may live at the repo root.

## Project Overview
Flow Stach (Flow Bridge) is a Webflow ecosystem.
- **Tool**: HTML to Webflow converter.
- **Marketplace**: Premium component library.

## Commands
```bash
bun run dev          # Start server (Convex + Next.js)
bun run convex:dev   # Start Convex only
bun run typecheck    # TS validation
```

## Developer Guidelines
1. **Routing**: 
   - Public: `/`, `/explore`.
   - Workspace: `/workspace/projects`, `/workspace/import`, `/workspace/library`, `/workspace/components`.
2. **Database**: Use `importProjects` for user imports and `assets` for store components.
3. **Auth**: Always bridge Clerk to Convex via `requireAuth(ctx)`.
4. **Clipboard**: Use `lib/clipboard.ts` helpers for Webflow JSON.

## Deprecated Logic
- `/admin/import` -> Now `/workspace/import`.
- Sidebar "Import" -> Access via `/workspace/projects` button.
- Global `/assets` -> Now `/workspace/projects`.

Refer to `SYSTEM_MANIFEST.md` for the full technical breakdown.

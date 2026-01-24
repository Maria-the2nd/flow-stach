# `app/` — Next.js App Router

This folder owns **routing + layouts + server/client boundaries** for Flow Bridge.

## Source of truth

Keep routes and UI terminology aligned with:

- `AUTHORITATIVE_CURRENT_STATE.md`
- `SYSTEM_MANIFEST.md`

## What lives here

- Route groups: `app/(auth)/`, `app/(authenticated)/`
- Public routes: `app/explore/`, `app/extension/`, `app/flow-bridge/`
- Legacy/internal routes: `app/assets/`, `app/admin/`
- API routes:
  - `app/api/flowbridge/*` (LLM semantic patching endpoint)
  - `app/api/webflow/convert/route.ts` (Webflow validation/sanitization)
- App layout/providers: `app/layout.tsx`, `app/providers/*`

## Routing guardrails (must match manifest)

- `/` redirects to `/explore`
- Primary authenticated entry is `/workspace/projects`
- `/assets` is legacy (redirect) and **not** the primary navigation entry
- `/admin/*` is internal-only tooling, not part of the primary user journey

If you change routing, update `SYSTEM_MANIFEST.md` (and ensure it remains aligned to `AUTHORITATIVE_CURRENT_STATE.md`).

## Auth boundary rules

- Auth is via **Clerk**.
- Treat `(authenticated)` pages as requiring auth; keep access patterns consistent with `middleware.ts` and existing route group conventions.
- Backend ownership is enforced in Convex; UI should not assume cross-user access.

## “Copy to Webflow” UX constraints (product-critical)

Keep terms and ordering consistent:

- Use the single term **Style Guide (Design Tokens)** (do not split “Design Tokens” vs “Style Guide”).
- Copy order (user guidance): **Style Guide (Design Tokens) → Embeds → Site Structure Payload or individual components**.
- Site Structure Payload must include **base layout styles only** (exclude Style Guide + Embeds styles).

## Touch points

- Global app shell/layout: `app/layout.tsx`, `components/layout/AppShell.tsx`
- Providers: `app/providers/ConvexClientProvider.tsx`, `app/providers/ThemeProvider.tsx`
- Explore: `app/explore/page.tsx`
- Workspace pages: `app/(authenticated)/workspace/*`
- Asset detail (legacy/internal): `app/assets/[slug]/page.tsx`
- API routes: `app/api/**`

## Pre-PR checks (for `app/` changes)

```bash
bun run typecheck && bun run lint && bun run build
```


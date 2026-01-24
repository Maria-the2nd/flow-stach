# `components/` — UI components (Flow Bridge)

This folder owns reusable UI components and the main product surfaces (workspace views, Style Guide UI, explore UI, admin tools).

## Source of truth (naming + surfaces)

- `AUTHORITATIVE_CURRENT_STATE.md` (canonical terminology + behavior)
- `SYSTEM_MANIFEST.md` (routes + IA + naming guardrails)

## Naming guardrails (use these exact terms)

- **Style Guide (Design Tokens)**: token UI + Webflow copy payload (single term)
- **Site Structure Payload**: base layout styles only
- **Imported Projects** / **Extracted Components** vs **Marketplace Templates/Components**

Avoid calling extracted components “library components” in docs or UI copy.

## Touch points (start here)

- App shell: `components/layout/AppShell.tsx`
- Navigation: `components/navigation/*`, `components/sidebar/*`
- Workspace UI: `components/workspace/project-details-view.tsx`
- Project detail cards: `components/project/*`
- Style Guide UI: `components/project/style-guide/*`
- Copy/validation UX: `components/validation/*`
- Explore mock catalog: `components/explore/mock-data.ts`
- Admin tools UI: `components/admin/*`
- Asset detail UI: `components/asset-detail/*`

## Clipboard/export rules (product-critical)

- Use the shared clipboard helpers in `lib/clipboard.ts` (do not re-implement copy/sanitize logic ad-hoc).
- Maintain the user guidance order: **Style Guide (Design Tokens) → Embeds → Site Structure Payload/components**.

## UI consistency

- Prefer existing `components/ui/*` primitives instead of introducing new one-off UI patterns.
- Keep “premium” visual tone consistent with current UI (avoid mixing drastically different styles).

## Pre-PR checks (for `components/` changes)

```bash
bun run typecheck && bun run lint && bun run build
```


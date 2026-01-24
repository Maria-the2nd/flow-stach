# Webflow Export Surface Map

This inventory lists every place the app produces or copies content intended to be pasted into Webflow Designer.

## Engine Path (client-side import)
- `/workspace/import` → `processProjectImport` in `lib/project-engine.ts`
  - Token Webflow JSON (Design Tokens payload)
  - Component Webflow JSON per extracted component
  - Stored into Convex payloads (used by Project Details / Assets)

## LLM Conversion Path (API)
- `POST /api/webflow/convert` → `app/api/webflow/convert/route.ts`
  - Outputs: `designTokens`, `webflowJson`, `cssEmbed`, `jsEmbed`, `libraryImports`
  - Validation results + Safety Report included

## Clipboard / Copy Surfaces (UI)
- Webflow JSON copy (uses `lib/clipboard.ts`):
  - `components/workspace/project-details-view.tsx` (Style Guide copy, project payloads)
  - `components/project/components-list.tsx` (component paste)
  - `components/asset-detail/AssetDetailMain.tsx` + `components/asset-detail/AssetDetailContext.tsx`
  - `components/assets/AssetsContent.tsx` (site structure + tokens)
  - `components/admin/ImportWizard.tsx`
  - `components/validation/MultiStepCopyModal.tsx`

- Style Guide (Design Tokens) JSON copy:
  - `components/project/design-tokens-card.tsx`
  - `components/workspace/project-details-view.tsx`
  - `components/admin/ImportWizard.tsx`

- CSS / JS Embed copy (manual embeds):
  - `components/workspace/project-details-view.tsx` (embeds panel)
  - `components/assets/AssetsContent.tsx` (code panels)
  - `components/validation/MultiStepCopyModal.tsx` (CSS/JS embed steps)

- Library import tags (script/link):
  - `components/validation/LibraryImportGuide.tsx`
  - `components/admin/ImportWizard.tsx`
  - `components/assets/AssetsContent.tsx`

## Notes
- Clipboard safety gate is centralized in `lib/webflow-safety-gate.ts` and `lib/clipboard.ts`.
- Any new copy surface should route Webflow JSON through the Safety Gate and surface the report.

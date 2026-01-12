# I3 - Asset Detail View

## Summary

Implemented the `/assets/[slug]` dynamic route page for viewing individual asset details. The page features a center column with the asset title, preview placeholder, and tabbed content (Preview, Webflow, Code, Docs), plus a right context panel with details and action buttons.

## Checklist

- [x] Create `/app/assets/[slug]/page.tsx` with slug resolution
- [x] Implement "Not found" state for invalid slugs
- [x] Add center column with title and preview placeholder
- [x] Add shadcn Tabs component with 4 tabs (Preview, Webflow, Code, Docs)
- [x] Create right context panel with Details card
- [x] Create right context panel with Actions card (disabled buttons)
- [x] Add helper function `getAssetBySlug` to fakeAssets.ts

## Files Changed

### New Files

| File | Description |
|------|-------------|
| `components/ui/tabs.tsx` | shadcn/ui Tabs component (Mira preset) |
| `components/asset-detail/AssetDetailMain.tsx` | Main content area with title, preview, and tabs |
| `components/asset-detail/AssetDetailContext.tsx` | Right context panel with details and actions |
| `components/assets/AssetsContent.tsx` | Extracted client component for assets listing |
| `docs/ui/I3-detail.md` | This documentation file |

### Modified Files

| File | Changes |
|------|---------|
| `app/assets/[slug]/page.tsx` | Full implementation of detail view page |
| `app/assets/page.tsx` | Refactored to server component with Suspense |
| `lib/fakeAssets.ts` | Added `getAssetBySlug()` and `getAllAssets()` helpers |

### Bug Fixes (Pre-existing issues)

| File | Fix |
|------|-----|
| `app/assets/page.tsx` | Replaced `lucide-react` import with `@hugeicons` |
| `app/assets/page.tsx` | Added Suspense boundary for `useSearchParams` |

## Run Instructions

```bash
# Development
npm run dev

# Navigate to a valid asset
# http://localhost:3000/assets/magnetic-cursor-effect

# Test not found state
# http://localhost:3000/assets/invalid-slug
```

## Component Structure

```
/assets/[slug]
├── AppShell
│   ├── Sidebar (with Suspense)
│   ├── AssetDetailMain (center)
│   │   ├── Title
│   │   ├── Preview Placeholder
│   │   └── Tabs
│   │       ├── Preview (placeholder)
│   │       ├── Webflow (step blocks placeholder)
│   │       ├── Code (code block placeholder)
│   │       └── Docs (markdown sections placeholder)
│   └── AssetDetailContext (right)
│       ├── Details Card
│       │   ├── Category
│       │   ├── Updated date
│       │   └── Tags (badges)
│       └── Actions Card
│           ├── Copy to Webflow (disabled)
│           ├── Copy Code (disabled)
│           └── Favorite (disabled)
```

## Data Model

Uses existing `Asset` type from `lib/fakeAssets.ts`:

```typescript
type Asset = {
  slug: string
  title: string
  category: string
  isNew: boolean
  updatedAt: string
  tags: string[]
}
```

## Notes

- All action buttons are disabled as per spec (clipboard/favorite not implemented)
- Tab content shows placeholder UI elements
- Uses hugeicons for consistency with rest of codebase
- Sidebar wrapped in Suspense for Next.js 16 compatibility

# I2 - Assets Browse View

## Summary

Implementation of the `/assets` browse view with search functionality, responsive asset grid, and category filtering.

## Data Shape

```typescript
// lib/fakeAssets.ts

export type Asset = {
  slug: string        // URL-safe identifier
  title: string       // Display name
  category: string    // Category slug (matches sidebar)
  isNew: boolean      // Show "New" badge
  updatedAt: string   // ISO date string
  tags: string[]      // Searchable tags
}
```

### Categories

Categories are defined in both `lib/fakeAssets.ts` and `components/sidebar/Sidebar.tsx`:
- cursor
- scroll
- buttons
- navigation
- hover
- media
- typography
- utilities
- sections

### Sample Asset

```typescript
{
  slug: "magnetic-cursor-effect",
  title: "Magnetic Cursor Effect",
  category: "cursor",
  isNew: true,
  updatedAt: "2024-01-10",
  tags: ["cursor", "magnetic", "interaction"],
}
```

## Filtering Rules

### 1. Category Filter (URL Query Param)

- Filter by `?cat=<category>` query parameter
- Example: `/assets?cat=cursor` shows only cursor assets
- No `cat` param = show all assets
- Sidebar handles category navigation

### 2. Search Filter (Client State)

- Searches both `title` and `tags[]` fields
- Case-insensitive matching
- Partial string matching (substring)
- Applied in conjunction with category filter

### Filter Logic

```typescript
filteredAssets = fakeAssets.filter((asset) => {
  // 1. Category filter from URL
  if (categoryFilter && asset.category !== categoryFilter) {
    return false
  }

  // 2. Search filter from input
  if (searchQuery) {
    const query = searchQuery.toLowerCase()
    const matchesTitle = asset.title.toLowerCase().includes(query)
    const matchesTags = asset.tags.some(tag =>
      tag.toLowerCase().includes(query)
    )
    return matchesTitle || matchesTags
  }

  return true
})
```

## UI States

### 1. Default State
- All assets displayed in responsive grid
- "All" category active in sidebar

### 2. Filtered by Category
- Only assets matching `?cat` param shown
- Corresponding category highlighted in sidebar

### 3. Search Active
- Filtered results based on search query
- Combined with active category filter if any

### 4. Empty State - No Results
Shown when filtered results are empty. Message varies:
- Search + category: `No assets match "{query}" in {category}`
- Search only: `No assets match "{query}"`
- Category only: `No assets found in the "{category}" category`
- No assets at all: `No assets available`

## Component Structure

```
AssetsPage
├── AppShell
│   ├── Sidebar (category navigation)
│   ├── AssetsContent (main content)
│   │   ├── Header (title + description)
│   │   ├── Search Input
│   │   └── Asset Grid / Empty State
│   │       └── AssetCard (×n)
│   └── ContextPanel
```

## Files Changed

| File | Description |
|------|-------------|
| `lib/fakeAssets.ts` | Asset type definition + 18 fake assets |
| `app/assets/page.tsx` | Browse view with search, grid, filters |
| `docs/ui/I2-browse.md` | This documentation |

## Run Instructions

```bash
# Start development server
bun dev
# or
npm run dev

# Navigate to
http://localhost:3000/assets

# Test category filter
http://localhost:3000/assets?cat=cursor
http://localhost:3000/assets?cat=buttons
```

## Test Scenarios

1. **View all assets**: Navigate to `/assets` - should show 18 assets
2. **Filter by category**: Click "Cursor" in sidebar - should show 2 assets
3. **Search by title**: Type "button" - should show button-related assets
4. **Search by tag**: Type "animation" - should match assets with animation tag
5. **Combined filter**: Select "Cursor" + search "magnetic" - should show 1 asset
6. **Empty state**: Search for "xyz123" - should show empty state message
7. **Card click**: Click any card - should navigate to `/assets/[slug]`

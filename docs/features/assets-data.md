# Assets Data Layer

Documents how the UI connects to Convex for asset browsing and detail views.

## Convex Queries

### `api.assets.list`

Fetches published assets with optional filtering.

**Inputs:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | `string?` | Filter by category (e.g., "cursor", "scroll") |
| `search` | `string?` | Search in title and tags (case-insensitive) |

**Usage in `components/assets/AssetsContent.tsx`:**
```tsx
const assets = useQuery(api.assets.list, {
  category: categoryFilter ?? undefined,
  search: searchQuery || undefined,
})
```

**Behavior:**
- Returns only `status: "published"` assets
- Sorted by `updatedAt` descending (newest first)
- Category filter uses `by_category` index
- Search is client-side filter on title and tags

---

### `api.assets.bySlug`

Fetches a single asset by its URL slug.

**Inputs:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | `string` | Unique asset slug |

**Usage in `components/asset-detail/AssetDetailContent.tsx`:**
```tsx
const asset = useQuery(api.assets.bySlug, { slug })
```

**Returns:**
- Asset document if found and published
- `null` if not found or not published

---

### `api.payloads.byAssetId`

Fetches payload metadata for an asset.

**Inputs:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `assetId` | `Id<"assets">` | Asset document ID |

**Usage in `components/asset-detail/AssetDetailContent.tsx`:**
```tsx
const payload = useQuery(
  api.payloads.byAssetId,
  asset ? { assetId: asset._id } : "skip"
)
```

**Note:** Uses conditional `"skip"` to avoid querying until asset is loaded.

---

## User Initialization

### Where it runs

`InitUser` component is rendered in `app/assets/layout.tsx`:

```tsx
<FavoritesProvider>
  <InitUser />
  {children}
</FavoritesProvider>
```

This ensures authenticated Clerk users exist in Convex before any asset queries run.

### How it avoids re-running

The `useEnsureUser` hook in `hooks/useEnsureUser.ts` uses a ref to track execution:

```tsx
const hasCalledRef = useRef(false)

useEffect(() => {
  if (isLoading || !isAuthenticated || hasCalledRef.current) {
    return
  }
  hasCalledRef.current = true
  ensureFromClerk().catch((error) => {
    console.error("Failed to ensure user:", error)
    hasCalledRef.current = false // Allow retry on failure
  })
}, [isAuthenticated, isLoading, ensureFromClerk])
```

**Guarantees:**
- Runs once per session (ref persists across re-renders)
- Only runs when authenticated (skips if `isLoading` or `!isAuthenticated`)
- Retries on failure (resets ref on error)

---

## Test Checklist

### Browse Page (`/assets`)

- [ ] Assets load from Convex (not fake data)
- [ ] Category filter via `?cat=cursor` works
- [ ] Search filters by title
- [ ] Search filters by tags
- [ ] Empty state shows when no results
- [ ] Favorites toggle works (localStorage)
- [ ] "Show favorites only" filter works

### Detail Page (`/assets/[slug]`)

- [ ] Asset loads by slug
- [ ] Not Found state shows for invalid slug
- [ ] Loading state shows while fetching
- [ ] Payload metadata loads (if exists)
- [ ] Favorite toggle works in context panel

### User Initialization

- [ ] New user created in Convex on first visit
- [ ] Existing user not duplicated on repeat visits
- [ ] Console shows no "Failed to ensure user" errors

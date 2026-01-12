# Favorites Feature

Allow users to mark assets as favorites for quick access.

## User Experience

### Browse Page (`/assets`)

- Each asset card displays a heart icon in the top-right corner
- Click the heart to toggle favorite status
- Favorited assets show a filled red heart
- A "Favorites" filter button appears next to the search bar
- Click "Favorites" to show only favorited assets

### Detail Page (`/assets/[slug]`)

- The context panel includes an "Add to Favorites" / "Remove from Favorites" button
- Button text and icon update based on current favorite status
- State syncs with browse page (same asset shows same favorite state everywhere)

## Technical Implementation

### Data Layer

**File:** `lib/favorites.ts`

Async functions matching Convex signatures:
- `toggleFavorite(assetId): Promise<void>` - Toggle favorite status
- `listMyFavorites(): Promise<string[]>` - Returns array of favorited asset IDs

Currently uses `localStorage` for persistence. UI components never import this directly — they use the provider hook only.

### State Management

**File:** `components/favorites/FavoritesProvider.tsx`

React Context provider that:
- Loads favorites from storage on mount
- Provides `isFavorited(assetId)` and `toggle(assetId)` functions
- Uses optimistic updates for instant UI feedback
- Syncs state across all components

### UI Components

**Browse cards:** `components/assets/AssetsContent.tsx`
- `AssetCard` component uses `useFavorites()` hook
- Heart button with `onClick` handler that calls `toggle()`
- Prevents event propagation to avoid navigation on click

**Detail panel:** `components/asset-detail/AssetDetailContext.tsx`
- Uses same `useFavorites()` hook
- Full-width button in Actions card

## How to Test

1. **Browse page favorites:**
   - Navigate to `/assets`
   - Click heart icon on any card
   - Verify heart fills with red color
   - Click again to unfavorite

2. **Favorites filter:**
   - Add a few favorites
   - Click "Favorites" button next to search
   - Verify only favorited assets appear
   - Click again to show all assets

3. **Detail page sync:**
   - Favorite an asset from browse page
   - Click to open that asset's detail page
   - Verify "Remove from Favorites" shows in context panel
   - Toggle from detail page
   - Return to browse page
   - Verify state is synced

4. **Persistence:**
   - Add some favorites
   - Refresh the page
   - Verify favorites are preserved

5. **Empty state:**
   - Remove all favorites
   - Click "Favorites" filter
   - Verify helpful empty state message appears

## Swap Plan to Convex

When ready to persist favorites server-side:

1. **Create Convex schema** (`convex/schema.ts`):
   ```ts
   favorites: defineTable({
     userId: v.string(),
     assetId: v.string(),
   }).index("by_user", ["userId"])
   ```

2. **Create Convex functions** (`convex/favorites.ts`):
   ```ts
   // Query: favorites.listMine
   export const listMine = query({
     handler: async (ctx) => {
       const userId = await getAuthUserId(ctx)
       const favs = await ctx.db
         .query("favorites")
         .withIndex("by_user", (q) => q.eq("userId", userId))
         .collect()
       return favs.map((f) => f.assetId)
     },
   })

   // Mutation: favorites.toggle
   export const toggle = mutation({
     args: { assetId: v.string() },
     handler: async (ctx, { assetId }) => {
       const userId = await getAuthUserId(ctx)
       const existing = await ctx.db
         .query("favorites")
         .withIndex("by_user", (q) => q.eq("userId", userId))
         .filter((q) => q.eq(q.field("assetId"), assetId))
         .first()

       if (existing) {
         await ctx.db.delete(existing._id)
       } else {
         await ctx.db.insert("favorites", { userId, assetId })
       }
     },
   })
   ```

3. **Update FavoritesProvider** to use Convex hooks:
   ```ts
   const favorites = useQuery(api.favorites.listMine) ?? []
   const toggleMutation = useMutation(api.favorites.toggle)
   ```

4. **Delete** `lib/favorites.ts` (no longer needed)

Zero UI changes required — components already use `useFavorites()` hook.

## Future Improvements

- Add favorites count badge on filter button
- Keyboard shortcut for quick-favorite (e.g., `f` key)
- Sort favorites by date added

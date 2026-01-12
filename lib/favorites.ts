/**
 * Favorites data layer
 *
 * Async interface matching Convex function signatures:
 * - favorites.toggle({ assetId }) -> Promise<void>
 * - favorites.listMine() -> Promise<string[]>
 *
 * Currently uses localStorage for persistence.
 * To swap to Convex: replace these functions with Convex mutations/queries.
 * UI components use the FavoritesProvider hook only - never import this directly.
 */

const STORAGE_KEY = "flow-stach-favorites"

export type FavoriteAssetId = string

// Internal helpers - not exported
function getStoredFavorites(): Set<FavoriteAssetId> {
  if (typeof window === "undefined") return new Set()

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return new Set()
    return new Set(JSON.parse(stored) as FavoriteAssetId[])
  } catch {
    return new Set()
  }
}

function saveFavorites(favorites: Set<FavoriteAssetId>): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]))
}

/**
 * Toggle favorite status for an asset
 * Convex signature: favorites.toggle({ assetId })
 */
export async function toggleFavorite(assetId: FavoriteAssetId): Promise<void> {
  const favorites = getStoredFavorites()

  if (favorites.has(assetId)) {
    favorites.delete(assetId)
  } else {
    favorites.add(assetId)
  }

  saveFavorites(favorites)
}

/**
 * Get all favorited asset IDs for current user
 * Convex signature: favorites.listMine()
 */
export async function listMyFavorites(): Promise<FavoriteAssetId[]> {
  return [...getStoredFavorites()]
}

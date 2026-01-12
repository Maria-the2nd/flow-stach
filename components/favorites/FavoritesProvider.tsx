"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import {
  listMyFavorites,
  toggleFavorite,
  type FavoriteAssetId,
} from "@/lib/favorites"

interface FavoritesContextValue {
  favorites: Set<FavoriteAssetId>
  isFavorited: (assetId: FavoriteAssetId) => boolean
  toggle: (assetId: FavoriteAssetId) => void
  isLoading: boolean
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Set<FavoriteAssetId>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  // Load favorites on mount
  useEffect(() => {
    let mounted = true

    listMyFavorites().then((ids) => {
      if (mounted) {
        setFavorites(new Set(ids))
        setIsLoading(false)
      }
    })

    return () => {
      mounted = false
    }
  }, [])

  const isFavorited = useCallback(
    (assetId: FavoriteAssetId) => favorites.has(assetId),
    [favorites]
  )

  const toggle = useCallback((assetId: FavoriteAssetId) => {
    // Optimistic update
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(assetId)) {
        next.delete(assetId)
      } else {
        next.add(assetId)
      }
      return next
    })

    // Persist (fire and forget - Convex will handle errors)
    toggleFavorite(assetId)
  }, [])

  return (
    <FavoritesContext.Provider
      value={{ favorites, isFavorited, toggle, isLoading }}
    >
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (!context) {
    throw new Error("useFavorites must be used within a FavoritesProvider")
  }
  return context
}

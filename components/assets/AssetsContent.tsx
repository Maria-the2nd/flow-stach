"use client"

import { useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "convex/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, FavouriteIcon } from "@hugeicons/core-free-icons"

import { api } from "@/convex/_generated/api"
import { Doc } from "@/convex/_generated/dataModel"
import { useFavorites } from "@/components/favorites/FavoritesProvider"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card"

type Asset = Doc<"assets">

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function AssetCard({ asset }: { asset: Asset }) {
  const { isFavorited, toggle } = useFavorites()
  const favorited = isFavorited(asset.slug)

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggle(asset.slug)
  }

  return (
    <Link href={`/assets/${asset.slug}`}>
      <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-start gap-2">
            <span className="line-clamp-2">{asset.title}</span>
          </CardTitle>
          <CardAction className="flex items-center gap-1">
            {asset.isNew && <Badge variant="default">New</Badge>}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleFavoriteClick}
              aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
            >
              <HugeiconsIcon
                icon={FavouriteIcon}
                className={favorited ? "fill-current text-red-500" : "text-muted-foreground"}
                size={14}
              />
            </Button>
          </CardAction>
          <CardDescription className="capitalize">
            {asset.category}
          </CardDescription>
        </CardHeader>
        <div className="px-4 pb-4">
          <p className="text-muted-foreground text-xs">
            Updated {formatDate(asset.updatedAt)}
          </p>
        </div>
      </Card>
    </Link>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="bg-muted mb-4 rounded-full p-4">
        <HugeiconsIcon icon={Search01Icon} className="text-muted-foreground h-8 w-8" />
      </div>
      <h3 className="text-foreground mb-2 text-lg font-medium">
        No assets found
      </h3>
      <p className="text-muted-foreground max-w-sm text-sm">{message}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-muted-foreground">Loading assets...</p>
    </div>
  )
}

export function AssetsContent() {
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const { favorites } = useFavorites()

  const categoryFilter = searchParams.get("cat")

  // Fetch assets from Convex with category filter
  const assets = useQuery(api.assets.list, {
    category: categoryFilter ?? undefined,
    search: searchQuery || undefined,
  })

  // Apply client-side favorites filter
  const filteredAssets = useMemo(() => {
    if (!assets) return []
    if (!showFavoritesOnly) return assets
    return assets.filter((asset) => favorites.has(asset.slug))
  }, [assets, showFavoritesOnly, favorites])

  const isLoading = assets === undefined

  return (
    <div className="flex flex-1 flex-col p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Assets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and search your asset library
        </p>
      </div>

      {/* Search and filters */}
      <div className="mb-6 flex items-center gap-2">
        <div className="relative flex-1">
          <HugeiconsIcon icon={Search01Icon} className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search by title or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <Button
          variant={showFavoritesOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className="h-9 gap-1.5"
          aria-pressed={showFavoritesOnly}
        >
          <HugeiconsIcon
            icon={FavouriteIcon}
            className={showFavoritesOnly ? "fill-current" : ""}
            size={14}
          />
          Favorites
        </Button>
      </div>

      {/* Results */}
      {isLoading ? (
        <LoadingState />
      ) : filteredAssets.length === 0 ? (
        <EmptyState
          message={
            showFavoritesOnly
              ? "No favorites yet. Click the heart icon on any asset to add it to your favorites."
              : searchQuery
                ? `No assets match "${searchQuery}"${categoryFilter ? ` in ${categoryFilter}` : ""}`
                : categoryFilter
                  ? `No assets found in the "${categoryFilter}" category`
                  : "No assets available"
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredAssets.map((asset) => (
            <AssetCard key={asset._id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  )
}

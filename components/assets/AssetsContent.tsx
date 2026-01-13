"use client"

import { useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, FavouriteIcon, Folder01Icon, FilterIcon } from "@hugeicons/core-free-icons"

import { api } from "@/convex/_generated/api"
import { Doc } from "@/convex/_generated/dataModel"
import { useFavorites } from "@/components/favorites/FavoritesProvider"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/components/ui/card"

type Asset = Doc<"assets">

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const MAX_VISIBLE_TAGS = 3

function AssetCard({ asset }: { asset: Asset }) {
  const { isFavorited, toggle } = useFavorites()
  const favorited = isFavorited(asset.slug)

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggle(asset.slug)
  }

  const visibleTags = asset.tags.slice(0, MAX_VISIBLE_TAGS)
  const remainingTags = asset.tags.length - MAX_VISIBLE_TAGS

  return (
    <Link href={`/assets/${asset.slug}`}>
      <Card className="group flex flex-col overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-primary/20">
        {/* Preview Image */}
        <div className="relative aspect-[4/3] w-full bg-muted/50 overflow-hidden">
          {asset.previewImageUrl ? (
            <img
              src={asset.previewImageUrl}
              alt={asset.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <HugeiconsIcon icon={Folder01Icon} className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
          {/* Overlay badges */}
          <div className="absolute top-2 right-2 flex items-center gap-1">
            {asset.isNew && (
              <Badge variant="default" className="bg-emerald-500 text-white">
                New
              </Badge>
            )}
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 bg-background/80 backdrop-blur-sm"
              onClick={handleFavoriteClick}
              aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
            >
              <HugeiconsIcon
                icon={FavouriteIcon}
                className={favorited ? "fill-current text-red-500" : "text-muted-foreground"}
                size={14}
              />
            </Button>
          </div>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-start gap-2">
            <span className="line-clamp-1 text-sm">{asset.title}</span>
          </CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <Badge variant="outline" className="capitalize text-[10px]">
              {asset.category}
            </Badge>
            {visibleTags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                {tag}
              </Badge>
            ))}
            {asset.tags.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{asset.tags.length - 2}</span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  )
}

function AssetCardSkeleton() {
  return (
    <Card className="flex flex-col overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full" />
      <CardHeader className="pb-2">
        <CardTitle>
          <Skeleton className="h-4 w-3/4" />
        </CardTitle>
        <CardDescription className="flex gap-1">
          <Skeleton className="h-4 w-14 rounded-full" />
          <Skeleton className="h-4 w-10 rounded-full" />
        </CardDescription>
      </CardHeader>
    </Card>
  )
}

interface EmptyStateProps {
  title: string
  message: string
  icon?: typeof Search01Icon
}

function EmptyState({ title, message, icon: Icon = Search01Icon }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <div className="bg-muted/50 mb-4 rounded-full p-4 ring-1 ring-border">
        <HugeiconsIcon icon={Icon} className="text-muted-foreground h-8 w-8" />
      </div>
      <h3 className="text-foreground mb-2 text-lg font-medium">
        {title}
      </h3>
      <p className="text-muted-foreground max-w-sm text-sm">{message}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <AssetCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function AssetsContent() {
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const { favorites } = useFavorites()
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth()

  const categoryFilter = searchParams.get("cat")

  // Skip query until auth is loaded - pass "skip" to prevent query from running
  const assets = useQuery(
    api.assets.list,
    isAuthLoaded && isSignedIn
      ? {
          category: categoryFilter ?? undefined,
          search: searchQuery || undefined,
        }
      : "skip"
  )

  // Apply client-side favorites filter
  const filteredAssets = useMemo(() => {
    if (!assets) return []
    if (!showFavoritesOnly) return assets
    return assets.filter((asset) => favorites.has(asset.slug))
  }, [assets, showFavoritesOnly, favorites])

  const isLoading = !isAuthLoaded || (isSignedIn && assets === undefined)

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
        showFavoritesOnly ? (
          <EmptyState
            icon={FavouriteIcon}
            title="No favorites yet"
            message="Click the heart icon on any asset to add it to your favorites."
          />
        ) : searchQuery ? (
          <EmptyState
            icon={Search01Icon}
            title="No results found"
            message={`No assets match "${searchQuery}"${categoryFilter ? ` in ${categoryFilter}` : ""}. Try a different search term.`}
          />
        ) : categoryFilter ? (
          <EmptyState
            icon={FilterIcon}
            title="Category is empty"
            message={`No assets found in the "${categoryFilter}" category.`}
          />
        ) : (
          <EmptyState
            icon={Folder01Icon}
            title="No assets available"
            message="Assets will appear here once they are added to the vault."
          />
        )
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

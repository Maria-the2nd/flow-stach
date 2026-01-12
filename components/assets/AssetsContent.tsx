"use client"

import { useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"

import { fakeAssets, type Asset } from "@/lib/fakeAssets"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card"

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function AssetCard({ asset }: { asset: Asset }) {
  return (
    <Link href={`/assets/${asset.slug}`}>
      <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-start gap-2">
            <span className="line-clamp-2">{asset.title}</span>
          </CardTitle>
          {asset.isNew && (
            <CardAction>
              <Badge variant="default">New</Badge>
            </CardAction>
          )}
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

export function AssetsContent() {
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")

  const categoryFilter = searchParams.get("cat")

  const filteredAssets = useMemo(() => {
    return fakeAssets.filter((asset) => {
      // Filter by category from URL query param
      if (categoryFilter && asset.category !== categoryFilter) {
        return false
      }

      // Filter by search query (title + tags)
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesTitle = asset.title.toLowerCase().includes(query)
        const matchesTags = asset.tags.some((tag) =>
          tag.toLowerCase().includes(query)
        )
        return matchesTitle || matchesTags
      }

      return true
    })
  }, [categoryFilter, searchQuery])

  return (
    <div className="flex flex-1 flex-col p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Assets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and search your asset library
        </p>
      </div>

      {/* Search input */}
      <div className="relative mb-6">
        <HugeiconsIcon icon={Search01Icon} className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          type="text"
          placeholder="Search by title or tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 pl-9"
        />
      </div>

      {/* Results */}
      {filteredAssets.length === 0 ? (
        <EmptyState
          message={
            searchQuery
              ? `No assets match "${searchQuery}"${categoryFilter ? ` in ${categoryFilter}` : ""}`
              : categoryFilter
                ? `No assets found in the "${categoryFilter}" category`
                : "No assets available"
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredAssets.map((asset) => (
            <AssetCard key={asset.slug} asset={asset} />
          ))}
        </div>
      )}
    </div>
  )
}

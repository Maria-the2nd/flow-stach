"use client"

import { useState, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth, useUser } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  FavouriteIcon,
  Folder01Icon,
  FilterIcon,
  Copy01Icon,
  Delete01Icon,
  Upload04Icon,
  Database01Icon,
} from "@hugeicons/core-free-icons"

import { api } from "@/convex/_generated/api"
import { Doc } from "@/convex/_generated/dataModel"
import { useFavorites } from "@/components/favorites/FavoritesProvider"
import { ImportPanel } from "@/components/admin/ImportPanel"
import { DatabasePanel } from "@/components/admin/DatabasePanel"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ASSET_CATEGORIES } from "@/lib/assets/categories"
import { copyWebflowJson } from "@/lib/clipboard"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

function getAdminEmails(): string[] {
  const envValue = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ""
  return envValue.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean)
}

type Asset = Doc<"assets">

const MAX_VISIBLE_TAGS = 3

function AssetCard({ asset }: { asset: Asset }) {
  const { isFavorited, toggle } = useFavorites()
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth()
  const router = useRouter()
  const favorited = isFavorited(asset.slug)
  const isDesignToken = asset.category === "tokens"
  const [copying, setCopying] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const deleteAsset = useMutation(api.assets.deleteById)

  const payload = useQuery(
    api.payloads.byAssetId,
    isAuthLoaded && isSignedIn ? { assetId: asset._id } : "skip"
  )

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggle(asset.slug)
  }

  // Blue gradient for design tokens, orange for regular components
  const cardGradient = isDesignToken
    ? "bg-[linear-gradient(45deg,hsla(217,100%,50%,1),hsla(230,100%,60%,1),hsla(200,100%,50%,1))]"
    : "bg-[linear-gradient(45deg,#ED9A00,#FD6F01,#FFB000)]"

  const visibleTags = asset.tags.slice(0, MAX_VISIBLE_TAGS)
  const isPayloadLoading = payload === undefined
  const webflowDisabled = copying || isPayloadLoading

  const handleCopyToWebflow = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (webflowDisabled) return
    setCopying(true)
    try {
      await copyWebflowJson(payload?.webflowJson)
    } finally {
      setCopying(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (deleting) return
    if (!confirm(`Delete "${asset.title}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteAsset({ assetId: asset._id })
      toast.success("Asset deleted")
      // Note: Convex queries are reactive, no manual refresh needed
    } catch (error) {
      console.error("Failed to delete asset:", error)
      toast.error("Failed to delete asset")
    } finally {
      setDeleting(false)
    }
  }
  return (
    <Card className="group flex flex-col overflow-hidden transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-primary/20">
      <Link href={`/assets/${asset.slug}`} className="block">
        <div className={`relative aspect-[4/3] w-full overflow-hidden ${cardGradient}`}>
          <div className="relative flex h-full w-full flex-col items-start justify-end p-4">
            <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-black/80">
              {isDesignToken ? "Design Tokens" : "Component"}
            </span>
          </div>
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
      </Link>
      <CardContent className="mt-auto border-t border-border/70 pt-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-pill"
            onClick={handleCopyToWebflow}
            disabled={webflowDisabled}
          >
            <HugeiconsIcon icon={Copy01Icon} className="mr-1.5 h-3.5 w-3.5" />
            {copying ? "Copying..." : isPayloadLoading ? "Loading..." : "Copy to Webflow"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-pill text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={handleDelete}
            disabled={deleting}
          >
            <HugeiconsIcon icon={Delete01Icon} className="mr-1.5 h-3.5 w-3.5" />
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </CardContent>
    </Card>
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

interface TemplateCardProps {
  label: string
  slug: string
  count: number
  index: number
  previewGroup?: string
  imageUrl?: string
}

function TemplateCard({
  label,
  slug,
  count,
  index,
  previewGroup,
  imageUrl,
}: TemplateCardProps) {
  return (
    <Link href={slug ? `/assets?template=${slug}` : "/assets"}>
      <Card className="group flex h-full flex-col overflow-hidden transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-primary/20">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[linear-gradient(45deg,#ED9A00,#FD6F01,#FFB000)]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${label} thumbnail`}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          <div className="relative flex h-full w-full flex-col justify-between p-4">
            <span className="text-xs font-medium uppercase tracking-[0.28em] text-black/70">
              ({String(index + 1).padStart(2, "0")})
            </span>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-black/80">
                Template
              </span>
            </div>
          </div>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <span>{label}</span>
            <span className="text-xs text-muted-foreground">{count} components</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Open the template to view every section and component.
          </CardDescription>
          {previewGroup ? (
            <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {previewGroup}
              </span>
            </div>
          ) : null}
        </CardHeader>
      </Card>
    </Link>
  )
}

interface GroupCardProps {
  label: string
  slug: string
  count: number
  index: number
  templateSlug: string
}

function GroupCard({ label, slug, count, index, templateSlug }: GroupCardProps) {
  return (
    <Link href={`/assets?template=${templateSlug}&cat=${slug}`}>
      <Card className="group flex h-full flex-col overflow-hidden transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-primary/20">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[linear-gradient(45deg,#ED9A00,#FD6F01,#FFB000)]">
          <div className="relative flex h-full w-full flex-col justify-between p-4">
            <span className="text-xs font-medium uppercase tracking-[0.28em] text-black/70">
              ({String(index + 1).padStart(2, "0")})
            </span>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-black/80">
                Group
              </span>
            </div>
          </div>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <span>{label}</span>
            <span className="text-xs text-muted-foreground">{count} items</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Open the group to view its full component list.
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  )
}

export function AssetsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const { favorites } = useFavorites()
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth()
  const { user } = useUser()

  // Check if user is admin
  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || ""
  const adminEmails = getAdminEmails()
  const isAdmin = isAuthLoaded && isSignedIn && adminEmails.includes(userEmail)

  const templateFilter = searchParams.get("template")
  const categoryFilter = searchParams.get("cat")
  const adminPanel = searchParams.get("admin")
  const showFavoritesOnly = searchParams.get("favorites") === "true"
  const showTemplateLibrary = !templateFilter && !adminPanel && !showFavoritesOnly
  const showGroupLibrary = !!templateFilter && !categoryFilter && !adminPanel

  // Handle navigation after admin action
  const handleAdminActionComplete = () => {
    // Optionally refresh the page or navigate
  }

  // Skip query until auth is loaded - pass "skip" to prevent query from running
  const templates = useQuery(
    api.templates.listWithCounts,
    isAuthLoaded && isSignedIn ? {} : "skip"
  )

  const activeTemplate = templates?.find((template) => template.slug === templateFilter)

  const assets = useQuery(
    api.assets.list,
    isAuthLoaded &&
    isSignedIn &&
    !adminPanel &&
    (showFavoritesOnly || (!!activeTemplate && !!categoryFilter))
      ? {
          category: categoryFilter ?? undefined,
          search: searchQuery || undefined,
          templateId: activeTemplate?._id ?? undefined,
        }
      : "skip"
  )

  const categoryCounts = useQuery(
    api.assets.categoryCounts,
    isAuthLoaded && isSignedIn
      ? { templateId: activeTemplate?._id ?? undefined }
      : "skip"
  )

  // Apply client-side favorites filter and sort design tokens first
  const filteredAssets = useMemo(() => {
    if (!assets) return []
    let result = showFavoritesOnly
      ? assets.filter((asset) => favorites.has(asset.slug))
      : [...assets]

    // Sort: design tokens first, then by updatedAt
    result.sort((a, b) => {
      const aIsToken = a.category === "tokens" ? 0 : 1
      const bIsToken = b.category === "tokens" ? 0 : 1
      if (aIsToken !== bIsToken) return aIsToken - bIsToken
      return b.updatedAt - a.updatedAt
    })

    return result
  }, [assets, showFavoritesOnly, favorites])

  const isLoading = !isAuthLoaded || (
    isSignedIn &&
    !adminPanel &&
    (showFavoritesOnly || (!!activeTemplate && !!categoryFilter)) &&
    assets === undefined
  )
  const isTemplatesLoading = !isAuthLoaded || (
    isSignedIn && (templates === undefined || categoryCounts === undefined)
  )

  // Handle favorites toggle via URL
  const handleFavoritesToggle = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (showFavoritesOnly) {
      params.delete("favorites")
    } else {
      params.set("favorites", "true")
    }
    router.push(`/assets?${params.toString()}`)
  }

  const componentGroups = useMemo(() => {
    const base = ASSET_CATEGORIES.filter((category) => category.slug !== "")
    return base.map((category) => ({
      ...category,
      count: categoryCounts?.byCategory[category.slug] ?? 0,
    }))
  }, [categoryCounts])

  const visibleGroups = useMemo(
    () => componentGroups.filter((group) => group.count > 0),
    [componentGroups]
  )

  const previewGroup = visibleGroups[0]?.label ?? componentGroups[0]?.label

  return (
    <div className="flex flex-1 flex-col p-6">
      {/* Admin Panels */}
      {isAdmin && adminPanel === "import" && (
        <>
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Upload04Icon} className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl uppercase tracking-tight text-foreground">
                Import HTML
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste AI-generated HTML to split into sections and extract design tokens.
            </p>
          </div>
          <ImportPanel onImportComplete={handleAdminActionComplete} />
        </>
      )}

      {isAdmin && adminPanel === "database" && (
        <>
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Database01Icon} className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl uppercase tracking-tight text-foreground">
                Database Management
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage assets and clear the database when needed.
            </p>
          </div>
          <DatabasePanel onActionComplete={handleAdminActionComplete} />
        </>
      )}

      {/* Favorites View */}
      {!adminPanel && showFavoritesOnly && !templateFilter && (
        <>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">My Collection</span>
              <h2 className="mt-2 font-display text-2xl uppercase tracking-tight text-foreground">
                Favorites
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your saved components for quick access.
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="mb-6 flex items-center gap-2">
            <div className="relative flex-1">
              <HugeiconsIcon icon={Search01Icon} className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search favorites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
          </div>

          {/* Favorites Grid */}
          {isLoading ? (
            <LoadingState />
          ) : filteredAssets.length === 0 ? (
            <EmptyState
              icon={FavouriteIcon}
              title="No favorites yet"
              message="Click the heart icon on any component to add it to your favorites."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredAssets.map((asset) => (
                <AssetCard key={asset._id} asset={asset} />
              ))}
            </div>
          )}
        </>
      )}

      {!adminPanel && showTemplateLibrary ? (
        <>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Templates</span>
              <h2 className="mt-2 font-display text-2xl uppercase tracking-tight text-foreground">
                All Templates
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a template to reveal its full component system.
              </p>
            </div>
          </div>
          {isTemplatesLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <AssetCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {!templates || templates.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState
                    icon={Folder01Icon}
                    title="No templates available"
                    message="Templates will appear here once they are added to the vault."
                  />
                </div>
              ) : (
                templates.map((template, index) => (
                  <TemplateCard
                    key={template.slug}
                    label={template.name}
                    slug={template.slug}
                    count={template.assetCount ?? 0}
                    index={index}
                    previewGroup={previewGroup}
                    imageUrl={template.imageUrl}
                  />
                ))
              )}
            </div>
          )}
        </>
      ) : !adminPanel && showGroupLibrary ? (
        <>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Component Groups</span>
              <h2 className="mt-2 font-display text-2xl uppercase tracking-tight text-foreground">
                {activeTemplate?.name ?? "Template"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a group to browse the components inside.
              </p>
            </div>
          </div>
          {isTemplatesLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <AssetCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleGroups.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState
                    icon={Folder01Icon}
                    title="No groups available"
                    message="Groups will appear here once they are added to the vault."
                  />
                </div>
              ) : (
                visibleGroups.map((group, index) => (
                  <GroupCard
                    key={group.slug}
                    label={group.label}
                    slug={group.slug}
                    count={group.count}
                    index={index}
                    templateSlug={templateFilter ?? ""}
                  />
                ))
              )}
            </div>
          )}
        </>
      ) : !adminPanel ? (
        <>
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
              onClick={handleFavoritesToggle}
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
        </>
      ) : null}
    </div>
  )
}

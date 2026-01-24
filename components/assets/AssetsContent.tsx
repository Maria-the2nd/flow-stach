"use client"

import { useState, useMemo, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  FavouriteIcon,
  Folder01Icon,
  FilterIcon,
  Copy01Icon,
  Delete01Icon,
  Database01Icon,
} from "@hugeicons/core-free-icons"

import { api } from "@/convex/_generated/api"
import { Doc, Id } from "@/convex/_generated/dataModel"
import { useFavorites } from "@/components/favorites/FavoritesProvider"
import { ImportWizard } from "@/components/admin/ImportWizard"
import { DatabasePanel } from "@/components/admin/DatabasePanel"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ASSET_CATEGORIES } from "@/lib/assets/categories"
import { copyWebflowJson } from "@/lib/clipboard"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { parseTokenManifest } from "@/lib/token-extractor"
import { CodeIcon, JavaScriptIcon, Alert01Icon } from "@hugeicons/core-free-icons"

// Helper to parse codePayload into sections
function parseCodePayload(codePayload: string | undefined): {
  html: string
  css: string
  js: string
} {
  if (!codePayload) return { html: "", css: "", js: "" }

  let html = ""
  let css = ""
  let js = ""

  // Extract HTML section
  const htmlMatch = codePayload.match(/\/\* HTML \*\/\n([\s\S]*?)(?=\n\/\* CSS \*\/|$)/)
  if (htmlMatch) html = htmlMatch[1].trim()

  // Extract CSS section
  const cssMatch = codePayload.match(/\/\* CSS \*\/\n([\s\S]*?)(?=\n\/\* JS \*\/|$)/)
  if (cssMatch) css = cssMatch[1].trim()

  // Extract JS section
  const jsMatch = codePayload.match(/\/\* JS \*\/\n([\s\S]*)$/)
  if (jsMatch) js = jsMatch[1].trim()

  return { html, css, js }
}

// Helper to extract external script URLs from HTML
function extractExternalScripts(html: string): string[] {
  const scripts: string[] = []
  const scriptRegex = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi
  let match
  while ((match = scriptRegex.exec(html)) !== null) {
    const src = match[1]
    // Only external scripts (not relative paths)
    if (src.startsWith("http") || src.startsWith("//")) {
      scripts.push(src.startsWith("//") ? `https:${src}` : src)
    }
  }
  return scripts
}

// Code block component with copy button
function CodeBlock({
  title,
  code,
  language,
  icon
}: {
  title: string
  code: string
  language: string
  icon: typeof CodeIcon
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    toast.success(`${title} copied to clipboard`)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!code) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <HugeiconsIcon icon={icon} size={16} />
            {title}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1" />
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="bg-muted rounded-lg p-3 text-xs overflow-auto max-h-48 font-mono border border-border">
          <code>{code}</code>
        </pre>
      </CardContent>
    </Card>
  )
}

type Asset = Doc<"assets">

const MAX_VISIBLE_TAGS = 3

function AssetCard({ asset }: { asset: Asset }) {
  const { isFavorited, toggle } = useFavorites()
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth()
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

  // Blue gradient for design tokens, green/yellow for full-page, orange for others
  const isFullPage = asset.category === "full-page"
  const cardGradient = isDesignToken
    ? "bg-[linear-gradient(45deg,hsla(217,100%,50%,1),hsla(230,100%,60%,1),hsla(200,100%,50%,1))]"
    : isFullPage
      ? "bg-[linear-gradient(to_right,#24FE41,#FDFC47)]"
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
              {isDesignToken ? "Style Guide (Design Tokens)" : "Component"}
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
  templateId: string
  imageUrl?: string
}

function TemplateCard({
  label,
  slug,
  count,
  index,
  templateId,
  imageUrl,
}: TemplateCardProps) {
  const [deleting, setDeleting] = useState(false)
  const deleteTemplate = useMutation(api.templates.deleteTemplate)
  const router = useRouter()

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (deleting) return
    if (!confirm(`Delete template "${label}" and all its components? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteTemplate({ templateId: templateId as Id<"templates"> })
      toast.success("Template deleted")
      router.refresh()
    } catch (error) {
      console.error("Failed to delete template:", error)
      toast.error("Failed to delete template")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Link href={slug ? `/assets?template=${slug}` : "/assets"}>
      <Card className="group flex h-full flex-col overflow-hidden transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-primary/20">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[linear-gradient(45deg,#ED9A00,#FD6F01,#FFB000)]">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={`${label} thumbnail`}
              fill
              sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
              loader={({ src }) => src}
              unoptimized
              className="object-cover"
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
        </CardHeader>
        <CardContent className="pt-0">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={handleDelete}
            disabled={deleting}
          >
            <HugeiconsIcon icon={Delete01Icon} size={14} className="mr-1" />
            {deleting ? "Deleting..." : "Delete Template"}
          </Button>
        </CardContent>
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
  const isTokens = slug === "tokens"
  const isFullPage = slug === "full-page"
  // Blue for tokens, green/yellow for full-page, orange for others
  const cardGradient = isTokens
    ? "bg-[linear-gradient(45deg,hsla(217,100%,50%,1),hsla(230,100%,60%,1),hsla(200,100%,50%,1))]"
    : isFullPage
      ? "bg-[linear-gradient(to_right,#24FE41,#FDFC47)]"
      : "bg-[linear-gradient(45deg,#ED9A00,#FD6F01,#FFB000)]"
  const displayCount = isTokens ? 1 : count
  return (
    <Link href={`/assets?template=${templateSlug}&cat=${slug}`}>
      <Card className="group flex h-full flex-col overflow-hidden transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-primary/20">
        <div className={`relative aspect-[4/3] w-full overflow-hidden ${cardGradient}`}>
          <div className="relative flex h-full w-full flex-col justify-between p-4">
            <span className="text-xs font-medium uppercase tracking-[0.28em] text-black/70">
              ({String(index + 1).padStart(2, "0")})
            </span>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-black/80">
                {isTokens ? "Style Guide (Design Tokens)" : "Group"}
              </span>
            </div>
          </div>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <span>{isTokens ? "Style Guide (Design Tokens)" : label}</span>
            <span className="text-xs text-muted-foreground">{displayCount} items</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {isTokens ? "Paste the Style Guide (Design Tokens) first to establish global styles." : "Open the group to view its full component list."}
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
    const result = showFavoritesOnly
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

  // Auto-redirect to single asset when category has only 1 item
  useEffect(() => {
    if (
      categoryFilter &&
      templateFilter &&
      filteredAssets.length === 1 &&
      !isLoading
    ) {
      const singleAsset = filteredAssets[0]
      router.replace(`/assets/${singleAsset.slug}`)
    }
  }, [categoryFilter, templateFilter, filteredAssets, isLoading, router])

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
      count: category.slug === "tokens" ? 1 : (categoryCounts?.byCategory[category.slug] ?? 0),
    }))
  }, [categoryCounts])

  const visibleGroups = useMemo(
    () => componentGroups
      .filter((group) => group.slug === "tokens" || group.count > 0)
      .sort((a, b) => (a.slug === "tokens" ? -1 : b.slug === "tokens" ? 1 : 0)),
    [componentGroups]
  )

  const tokensAssets = useQuery(
    api.assets.list,
    isAuthLoaded &&
      isSignedIn &&
      showGroupLibrary &&
      activeTemplate
      ? {
        category: "tokens",
        templateId: activeTemplate._id,
      }
      : "skip"
  )

  const tokenAsset = tokensAssets && tokensAssets.length > 0 ? tokensAssets[0] : undefined

  const tokenPayload = useQuery(
    api.payloads.byAssetId,
    isAuthLoaded &&
      isSignedIn &&
      tokenAsset
      ? {
        assetId: tokenAsset._id,
      }
      : "skip"
  )

  // Query for full-page asset
  const fullPageAssets = useQuery(
    api.assets.list,
    isAuthLoaded &&
      isSignedIn &&
      showGroupLibrary &&
      activeTemplate
      ? {
        category: "full-page",
        templateId: activeTemplate._id,
      }
      : "skip"
  )

  const fullPageAsset = fullPageAssets && fullPageAssets.length > 0 ? fullPageAssets[0] : undefined

  const fullPagePayload = useQuery(
    api.payloads.byAssetId,
    isAuthLoaded &&
      isSignedIn &&
      fullPageAsset
      ? {
        assetId: fullPageAsset._id,
      }
      : "skip"
  )

  // Copy state for full site options
  const [copyingBaked, setCopyingBaked] = useState(false)
  const [copyingStripped, setCopyingStripped] = useState(false)
  const [copyingTokens, setCopyingTokens] = useState(false)

  // Handle copy full site baked (all styles included)
  const handleCopyFullSiteBaked = async () => {
    if (!fullPagePayload?.webflowJson) {
      toast.error("Full page payload not available")
      return
    }
    setCopyingBaked(true)
    try {
      await copyWebflowJson(fullPagePayload.webflowJson)
      toast.success("Full site copied with all styles! Paste in Webflow Designer.")
    } catch (error) {
      console.error("Copy error:", error)
      toast.error("Failed to copy")
    } finally {
      setCopyingBaked(false)
    }
  }

  // Handle copy tokens
  const handleCopyTokens = async () => {
    if (!tokenPayload?.webflowJson) {
      toast.error("Token payload not available")
      return
    }
    setCopyingTokens(true)
    try {
      await copyWebflowJson(tokenPayload.webflowJson)
      toast.success("Design tokens copied! Paste in Webflow, then delete the div.")
    } catch (error) {
      console.error("Copy error:", error)
      toast.error("Failed to copy")
    } finally {
      setCopyingTokens(false)
    }
  }

  // Handle copy full site stripped (requires tokens first)
  const handleCopyFullSiteStripped = async () => {
    if (!fullPagePayload?.webflowJson) {
      toast.error("Full page payload not available")
      return
    }
    setCopyingStripped(true)
    try {
      await copyWebflowJson(fullPagePayload.webflowJson)
      toast.success("Full site copied (uses token classes)! Paste in Webflow Designer.")
    } catch (error) {
      console.error("Copy error:", error)
      toast.error("Failed to copy")
    } finally {
      setCopyingStripped(false)
    }
  }

  let groupFontUrl: string | null = null
  let groupFontFamilies: string[] = []
  if (tokenPayload?.codePayload && tokenPayload.codePayload.startsWith("/* TOKEN MANIFEST */")) {
    const withoutPrefix = tokenPayload.codePayload.replace("/* TOKEN MANIFEST */", "").trim()
    const manifestJson = withoutPrefix.split("/* CSS */")[0].trim()
    const manifest = parseTokenManifest(manifestJson)
    if (manifest?.fonts?.googleFonts) {
      groupFontUrl = manifest.fonts.googleFonts
    }
    // Try to get families from manifest first
    if (manifest?.fonts?.families && manifest.fonts.families.length > 0) {
      groupFontFamilies = manifest.fonts.families
    } else if (manifest?.variables) {
      // Fallback: extract font families from font-type variables
      const fontVars = manifest.variables.filter(v => v.type === "fontFamily")
      const extractedFonts = fontVars
        .map(v => v.value || v.values?.light || v.values?.dark)
        .filter((v): v is string => !!v)
        .map(v => v.replace(/['"]/g, '').split(',')[0].trim())
        .filter((v, i, arr) => arr.indexOf(v) === i) // unique
      if (extractedFonts.length > 0) {
        groupFontFamilies = extractedFonts
      }
    }
  }

  // Parse the full page code payload to extract HTML, CSS, JS
  const fullPageCode = useMemo(() => {
    return parseCodePayload(fullPagePayload?.codePayload)
  }, [fullPagePayload?.codePayload])

  // Extract external scripts from the HTML (e.g., GSAP, libraries)
  const externalScripts = useMemo(() => {
    if (!fullPageCode.html) return []
    return extractExternalScripts(fullPageCode.html)
  }, [fullPageCode.html])

  return (
    <div className="flex flex-1 flex-col p-6">
      {/* Admin Panels */}
      {adminPanel === "import" && (
        <ImportWizard />
      )}

      {adminPanel === "database" && (
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <AssetCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
                    templateId={template._id}
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

          {/* STEP 1: Install Fonts (Always visible) */}
          <Card className="mb-6 border-2 border-amber-500/50 bg-amber-50/50 ">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-amber-700 ">
                <HugeiconsIcon icon={Alert01Icon} size={20} />
                Step 1: Install Fonts in Webflow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {groupFontFamilies.length > 0 ? (
                <>
                  <p className="text-sm font-medium">You must install these fonts before pasting:</p>
                  <div className="flex flex-wrap gap-2">
                    {groupFontFamilies.map((font) => (
                      <span key={font} className="text-lg font-bold bg-amber-200  text-amber-900  px-3 py-1 rounded-full">
                        {font}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No custom fonts detected. Check your original HTML for font-family declarations if fonts don&apos;t appear correctly.
                </p>
              )}
              <div className="p-3 rounded bg-amber-100  text-sm">
                <p className="font-medium text-amber-900  mb-2">How to install fonts:</p>
                <ol className="list-decimal list-inside space-y-1 text-amber-800 ">
                  <li>Go to <strong>Site Settings → Fonts</strong> in Webflow</li>
                  <li>Search for each font in Google Fonts and add it</li>
                  <li><strong>Wait 10-15 seconds</strong> for fonts to load in Designer</li>
                  <li>Then proceed to Step 2</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* STEP 2: Choose Import Method */}
          <div className="mb-6">
            <h3 className="text-lg font-bold mb-4">Step 2: Choose Import Method</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Option 1: Site Structure (Main Paste) */}
              <Card className="border-2 border-green-500/50 bg-green-50/50 ">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-green-700 ">
                    Option A: Site Structure (Main Paste)
                  </CardTitle>
                  <CardDescription>
                    Full site layout structure without duplicating styles from the Style Guide or Embeds.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={handleCopyFullSiteBaked}
                    disabled={!fullPagePayload?.webflowJson || copyingBaked}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    <HugeiconsIcon icon={Copy01Icon} size={16} className="mr-2" />
                    {copyingBaked ? "Copying..." : !fullPagePayload?.webflowJson ? "Loading..." : "Copy Site Structure"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Best for: Rebuilding a full page layout
                  </p>
                </CardContent>
              </Card>

              {/* Option 2: Style Guide (Design Tokens) + Site Structure */}
              <Card className="border-2 border-blue-500/50 bg-blue-50/50 ">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-blue-700 ">
                    Option B: Style Guide (Design Tokens) + Site Structure
                  </CardTitle>
                  <CardDescription>
                    Two pastes: First the Style Guide (Design Tokens), then the site structure (uses those classes).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={handleCopyTokens}
                      disabled={!tokenPayload?.webflowJson || copyingTokens}
                      variant="outline"
                      className="border-blue-500 text-blue-700 hover:bg-blue-100  "
                    >
                      <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1" />
                      {copyingTokens ? "..." : "1. Style Guide"}
                    </Button>
                    <Button
                      onClick={handleCopyFullSiteStripped}
                      disabled={!fullPagePayload?.webflowJson || copyingStripped}
                      variant="outline"
                      className="border-blue-500 text-blue-700 hover:bg-blue-100  "
                    >
                      <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1" />
                      {copyingStripped ? "..." : "2. Site Structure"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Best for: Building a design system, reusing styles
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* STEP 3: JavaScript Libraries (Always visible) */}
          <Card className="mb-6 border-2 border-purple-500/50 bg-purple-50/50 ">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-purple-700 ">
                <HugeiconsIcon icon={JavaScriptIcon} size={20} />
                Step 3: Add JavaScript Libraries (if needed)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                If this site uses animation libraries (GSAP, ScrollTrigger, Lenis, etc.), you must add them manually.
              </p>
              <div className="p-3 rounded bg-purple-100  text-sm">
                <p className="font-medium text-purple-900  mb-2">Where to add libraries:</p>
                <ol className="list-decimal list-inside space-y-1 text-purple-800 ">
                  <li>Go to <strong>Project Settings → Custom Code</strong></li>
                  <li>Add library script tags to <strong>&quot;Head Code&quot;</strong> section</li>
                  <li>Add your custom JavaScript to <strong>&quot;Footer Code&quot;</strong> (before &lt;/body&gt;)</li>
                </ol>
              </div>
              <p className="text-xs text-muted-foreground">
                Check the HTML and JavaScript sections below to see what libraries are used.
              </p>
            </CardContent>
          </Card>

          {/* Code Sections - External Libraries, HTML, CSS, JS */}
          {(externalScripts.length > 0 || fullPageCode.html || fullPageCode.css || fullPageCode.js) && (
            <div className="mb-8 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Code for Manual Integration
              </h3>

              {/* External Libraries (GSAP, etc.) */}
              {externalScripts.length > 0 && (
                <Card className="border-amber-500/50 bg-amber-50/30 ">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2 text-amber-700 ">
                        <HugeiconsIcon icon={Alert01Icon} size={16} />
                        External Libraries ({externalScripts.length})
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const scriptTags = externalScripts
                            .map((url) => `<script src="${url}"></script>`)
                            .join("\n")
                          navigator.clipboard.writeText(scriptTags)
                          toast.success("Script tags copied!")
                        }}
                      >
                        <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1" />
                        Copy Script Tags
                      </Button>
                    </div>
                    <CardDescription>
                      Add these to Webflow: <strong>Project Settings → Custom Code → Head Code</strong>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted rounded-lg p-3 text-xs overflow-auto max-h-32 font-mono border border-border">
                      {externalScripts.map((url) => `<script src="${url}"></script>`).join("\n")}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* HTML */}
              {fullPageCode.html && (
                <CodeBlock
                  title="HTML"
                  code={fullPageCode.html}
                  language="html"
                  icon={CodeIcon}
                />
              )}

              {/* CSS */}
              {fullPageCode.css && (
                <CodeBlock
                  title="CSS"
                  code={fullPageCode.css}
                  language="css"
                  icon={CodeIcon}
                />
              )}

              {/* JavaScript */}
              {fullPageCode.js && (
                <Card className="border-blue-500/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <HugeiconsIcon icon={JavaScriptIcon} size={16} />
                        JavaScript
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(fullPageCode.js)
                          toast.success("JavaScript copied!")
                        }}
                      >
                        <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1" />
                        Copy
                      </Button>
                    </div>
                    <CardDescription>
                      Add to: <strong>Project Settings → Custom Code → Before &lt;/body&gt; tag</strong>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted rounded-lg p-3 text-xs overflow-auto max-h-48 font-mono border border-border">
                      <code>{fullPageCode.js}</code>
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Individual Sections - Collapsible */}
          <details className="mb-6 group">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 py-2 mb-4">
              <HugeiconsIcon icon={Folder01Icon} size={16} />
              Individual Sections ({visibleGroups.filter(g => g.slug !== "tokens" && g.slug !== "full-page").length}) — for partial imports
            </summary>
            {isTemplatesLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <AssetCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visibleGroups.filter(g => g.slug !== "tokens" && g.slug !== "full-page").length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState
                      icon={Folder01Icon}
                      title="No sections available"
                      message="Sections will appear here once they are added to the vault."
                    />
                  </div>
                ) : (
                  visibleGroups
                    .filter(g => g.slug !== "tokens" && g.slug !== "full-page")
                    .map((group, index) => (
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
          </details>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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

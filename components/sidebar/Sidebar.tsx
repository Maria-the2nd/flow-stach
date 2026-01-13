"use client"

import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/nextjs"
import { useAuth } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Upload04Icon, Database01Icon, FavouriteIcon } from "@hugeicons/core-free-icons"
import { api } from "@/convex/_generated/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "./ThemeToggle"
import { ASSET_CATEGORIES, AssetCategory } from "@/lib/assets/categories"

export type Category = AssetCategory

function getAdminEmails(): string[] {
  const envValue = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ""
  return envValue.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean)
}

export interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()

  // Check if user is admin
  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || ""
  const adminEmails = getAdminEmails()
  const isAdmin = isLoaded && isSignedIn && adminEmails.includes(userEmail)

  const templates = useQuery(
    api.templates.listWithCounts,
    isLoaded && isSignedIn ? {} : "skip"
  )

  const activeCategory = searchParams.get("cat") ?? ""
  const activeTemplate = searchParams.get("template") ?? ""
  const activeAdmin = searchParams.get("admin") ?? ""
  const showFavorites = searchParams.get("favorites") === "true"

  const activeTemplateEntity = templates?.find((template) => template.slug === activeTemplate)

  // Fetch dynamic category counts
  const counts = useQuery(
    api.assets.categoryCounts,
    isLoaded && isSignedIn && activeTemplateEntity
      ? { templateId: activeTemplateEntity._id }
      : "skip"
  )

  // Build categories with counts
  const categories = ASSET_CATEGORIES.map((cat) => ({
    ...cat,
    count: cat.slug === ""
      ? counts?.total ?? 0
      : counts?.byCategory[cat.slug] ?? 0,
  })).filter((cat) => cat.slug === "" || cat.count > 0)

  function handleTemplateClick(slug: string) {
    const params = new URLSearchParams(searchParams.toString())

    if (!slug) {
      params.delete("template")
      params.delete("cat")
    } else {
      params.set("template", slug)
      params.delete("cat")
    }

    const query = params.toString()
    const targetPath = "/assets"
    router.push(query ? `${targetPath}?${query}` : targetPath)
  }

  function handleCategoryClick(slug: string) {
    const params = new URLSearchParams(searchParams.toString())

    if (slug === "") {
      params.delete("cat")
    } else {
      params.set("cat", slug)
    }

    const query = params.toString()
    const targetPath = "/assets"
    router.push(query ? `${targetPath}?${query}` : targetPath)
  }

  function handleAdminClick(tool: string) {
    const params = new URLSearchParams(searchParams.toString())

    if (activeAdmin === tool) {
      // Toggle off
      params.delete("admin")
    } else {
      params.set("admin", tool)
    }

    // Clear other filters when entering admin mode
    if (tool) {
      params.delete("template")
      params.delete("cat")
      params.delete("favorites")
    }

    const query = params.toString()
    const targetPath = "/assets"
    router.push(query ? `${targetPath}?${query}` : targetPath)
  }

  function handleFavoritesClick() {
    const params = new URLSearchParams(searchParams.toString())

    if (showFavorites) {
      params.delete("favorites")
    } else {
      params.set("favorites", "true")
      // Keep template filter but clear admin
      params.delete("admin")
    }

    const query = params.toString()
    const targetPath = "/assets"
    router.push(query ? `${targetPath}?${query}` : targetPath)
  }

  return (
    <aside className={cn("w-56", className)}>
      <div className="flex h-[100vh] flex-col">
        <div className="flex flex-col px-6 py-4">
          <span className="text-xs uppercase tracking-[0.32em] text-sidebar-foreground/60">
            Template Library
          </span>
          <span className="mt-2 text-base font-semibold uppercase tracking-[0.18em] text-sidebar-foreground">
            Flow Bridge
          </span>
        </div>

        <nav className="mt-10 min-h-0 flex-1 overflow-y-auto px-6 py-2">
        {/* Favorites Button */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleFavoritesClick}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
              showFavorites
                ? "bg-red-500/10 text-red-500 font-medium"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <HugeiconsIcon
              icon={FavouriteIcon}
              className={cn("h-4 w-4", showFavorites && "fill-current")}
            />
            <span>My Favorites</span>
          </button>
        </div>

        <div className="mb-6">
          <span className="text-[11px] uppercase tracking-[0.28em] text-sidebar-foreground/50">
            Templates
          </span>
          <ul className="mt-3 space-y-0.5">
            <li>
              <button
                type="button"
                onClick={() => handleTemplateClick("")}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                  activeTemplate === ""
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <span>All Templates</span>
              </button>
            </li>
            {(templates ?? []).map((template) => {
              const isActive = activeTemplate === template.slug

              return (
                <li key={template.slug}>
                  <button
                    type="button"
                    onClick={() => handleTemplateClick(template.slug)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <span>{template.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {activeTemplate ? (
          <div>
            <span className="text-[11px] uppercase tracking-[0.28em] text-sidebar-foreground/50">
              Component Groups
            </span>
            <ul className="mt-3 space-y-0.5">
              {categories.map((category) => {
                const isActive = activeCategory === category.slug
                if (category.slug === "") return null

                return (
                  <li key={category.slug}>
                    <button
                      type="button"
                      onClick={() => handleCategoryClick(category.slug)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <span>{category.label}</span>
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          isActive
                            ? "text-sidebar-accent-foreground/70"
                            : "text-sidebar-foreground/50"
                        )}
                      >
                        {category.count}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

      </nav>

        <div className="mt-auto shrink-0">
        {/* Admin Tools Section */}
        {isAdmin && (
          <div className="border-t border-sidebar-border px-6 py-4">
            <span className="text-[11px] uppercase tracking-[0.28em] text-sidebar-foreground/50">
              Admin Tools
            </span>
            <ul className="mt-3 space-y-0.5">
              <li>
                <button
                  type="button"
                  onClick={() => handleAdminClick("import")}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    activeAdmin === "import"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <HugeiconsIcon icon={Upload04Icon} className="h-3.5 w-3.5" />
                  <span>Import HTML</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleAdminClick("database")}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    activeAdmin === "database"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <HugeiconsIcon icon={Database01Icon} className="h-3.5 w-3.5" />
                  <span>Database</span>
                </button>
              </li>
            </ul>
          </div>
        )}

        {/* User area */}
        <div className="flex items-center justify-between border-t border-sidebar-border px-6 py-3">
          <SignedIn>
            <UserButton afterSignOutUrl="/sign-in" />
          </SignedIn>
          <SignedOut>
            <Button variant="outline" size="sm" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </SignedOut>
          <ThemeToggle />
        </div>
        </div>
      </div>
    </aside>
  )
}

export { ASSET_CATEGORIES as CATEGORIES }

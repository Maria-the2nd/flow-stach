"use client"

import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs"
import { useAuth } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "./ThemeToggle"

export interface Category {
  label: string
  slug: string
}

// Category definitions (counts are dynamic)
const CATEGORY_DEFS: Category[] = [
  { label: "All", slug: "" },
  { label: "Cursor", slug: "cursor" },
  { label: "Scroll", slug: "scroll" },
  { label: "Buttons", slug: "buttons" },
  { label: "Navigation", slug: "navigation" },
  { label: "Hover", slug: "hover" },
  { label: "Media", slug: "media" },
  { label: "Typography", slug: "typography" },
  { label: "Utilities", slug: "utilities" },
  { label: "Sections", slug: "sections" },
  { label: "Tokens", slug: "tokens" },
]

export interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isLoaded, isSignedIn } = useAuth()

  // Fetch dynamic category counts
  const counts = useQuery(
    api.assets.categoryCounts,
    isLoaded && isSignedIn ? {} : "skip"
  )

  const activeCategory = searchParams.get("cat") ?? ""

  // Build categories with counts
  const categories = CATEGORY_DEFS.map((cat) => ({
    ...cat,
    count: cat.slug === ""
      ? counts?.total ?? 0
      : counts?.byCategory[cat.slug] ?? 0,
  })).filter((cat) => cat.slug === "" || cat.count > 0)

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

  return (
    <aside
      className={cn(
        "flex h-full w-56 flex-col bg-sidebar",
        className
      )}
    >
      <div className="flex h-12 items-center px-4 font-semibold text-sidebar-foreground">
        Flow Stach
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-0.5">
          {categories.map((category) => {
            const isActive = activeCategory === category.slug

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
      </nav>

      {/* User area */}
      <div className="flex items-center justify-between border-t border-sidebar-border px-3 py-3">
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
    </aside>
  )
}

export { CATEGORY_DEFS as CATEGORIES }

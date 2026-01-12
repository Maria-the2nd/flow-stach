"use client"

import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface Category {
  label: string
  slug: string
  count: number
}

const CATEGORIES: Category[] = [
  { label: "All", slug: "", count: 47 },
  { label: "Cursor", slug: "cursor", count: 8 },
  { label: "Scroll", slug: "scroll", count: 6 },
  { label: "Buttons", slug: "buttons", count: 5 },
  { label: "Navigation", slug: "navigation", count: 7 },
  { label: "Hover", slug: "hover", count: 4 },
  { label: "Media", slug: "media", count: 3 },
  { label: "Typography", slug: "typography", count: 6 },
  { label: "Utilities", slug: "utilities", count: 5 },
  { label: "Sections", slug: "sections", count: 3 },
]

export interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const activeCategory = searchParams.get("cat") ?? ""

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
        "flex h-full w-56 flex-col border-r border-sidebar-border bg-sidebar",
        className
      )}
    >
      <div className="flex h-12 items-center px-4 font-semibold text-sidebar-foreground">
        Flow Stach
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-0.5">
          {CATEGORIES.map((category) => {
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
      <div className="border-t border-sidebar-border px-3 py-3">
        <SignedIn>
          <UserButton afterSignOutUrl="/sign-in" />
        </SignedIn>
        <SignedOut>
          <Button variant="outline" size="sm" asChild className="w-full">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </SignedOut>
      </div>
    </aside>
  )
}

export { CATEGORIES }

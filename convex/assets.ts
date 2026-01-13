import { query } from "./_generated/server"
import { v } from "convex/values"
import { requireAuth } from "./auth"

// List published assets with optional category and search filters
export const list = query({
  args: {
    category: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Require authentication for all queries
    await requireAuth(ctx)

    let assets

    // Filter by category if provided
    if (args.category) {
      assets = await ctx.db
        .query("assets")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .filter((q) => q.eq(q.field("status"), "published"))
        .collect()
    } else {
      assets = await ctx.db
        .query("assets")
        .withIndex("by_status", (q) => q.eq("status", "published"))
        .collect()
    }

    // Apply search filter if provided
    if (args.search) {
      const searchLower = args.search.toLowerCase()
      assets = assets.filter(
        (asset) =>
          asset.title.toLowerCase().includes(searchLower) ||
          asset.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      )
    }

    // Sort by updatedAt descending (newest first)
    return assets.sort((a, b) => b.updatedAt - a.updatedAt)
  },
})

// Get category counts for sidebar
export const categoryCounts = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx)

    const assets = await ctx.db
      .query("assets")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect()

    // Count by category
    const counts: Record<string, number> = {}
    for (const asset of assets) {
      counts[asset.category] = (counts[asset.category] || 0) + 1
    }

    return {
      total: assets.length,
      byCategory: counts,
    }
  },
})

// Get a single asset by slug
export const bySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    const asset = await ctx.db
      .query("assets")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .filter((q) => q.eq(q.field("status"), "published"))
      .unique()

    return asset
  },
})

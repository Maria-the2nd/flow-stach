import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { requireAdmin, requireAuth } from "./auth"

// List published assets with optional category and search filters
export const list = query({
  args: {
    category: v.optional(v.string()),
    search: v.optional(v.string()),
    templateId: v.optional(v.id("templates")),
  },
  handler: async (ctx, args) => {
    // Require authentication for all queries
    await requireAuth(ctx)

    const baseQuery = args.category
      ? ctx.db
        .query("assets")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
      : ctx.db
        .query("assets")
        .withIndex("by_status", (q) => q.eq("status", "published"))

    let assets = await baseQuery
      .filter((q) =>
        args.templateId
          ? q.and(
            q.eq(q.field("status"), "published"),
            q.eq(q.field("templateId"), args.templateId)
          )
          : q.eq(q.field("status"), "published")
      )
      .collect()

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
    const sortedAssets = assets.sort((a, b) => b.updatedAt - a.updatedAt)

    // Get thumbnail URLs for all assets
    const assetsWithThumbnails = await Promise.all(
      sortedAssets.map(async (asset) => {
        let thumbnailUrl: string | null = null
        if (asset.thumbnailStorageId) {
          thumbnailUrl = await ctx.storage.getUrl(asset.thumbnailStorageId)
        }
        return {
          ...asset,
          thumbnailUrl,  // New storage URL (use this over previewImageUrl)
        }
      })
    )

    return assetsWithThumbnails
  },
})

// Get category counts for sidebar
export const categoryCounts = query({
  args: {
    templateId: v.optional(v.id("templates")),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    const assets = await ctx.db
      .query("assets")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .filter((q) =>
        args.templateId
          ? q.and(
            q.eq(q.field("status"), "published"),
            q.eq(q.field("templateId"), args.templateId)
          )
          : q.eq(q.field("status"), "published")
      )
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

// Get total asset count (no auth required - for admin CLI usage)
export const count = query({
  args: {},
  handler: async (ctx) => {
    const allAssets = await ctx.db.query("assets").collect()
    const published = allAssets.filter((a) => a.status === "published")

    return {
      total: allAssets.length,
      published: published.length,
      draft: allAssets.length - published.length,
    }
  },
})

// Delete a single asset and its payload/favorites
export const deleteById = mutation({
  args: {
    assetId: v.id("assets"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const asset = await ctx.db.get(args.assetId)
    if (!asset) {
      throw new Error("Asset not found")
    }

    // Delete thumbnail from storage if exists
    if (asset.thumbnailStorageId) {
      await ctx.storage.delete(asset.thumbnailStorageId)
    }

    const payload = await ctx.db
      .query("payloads")
      .withIndex("by_asset_id", (q) => q.eq("assetId", args.assetId))
      .unique()

    if (payload) {
      await ctx.db.delete(payload._id)
    }

    const favorites = await ctx.db
      .query("favorites")
      .filter((q) => q.eq(q.field("assetId"), args.assetId))
      .collect()

    for (const favorite of favorites) {
      await ctx.db.delete(favorite._id)
    }

    await ctx.db.delete(args.assetId)

    return {
      deletedPayload: !!payload,
      deletedFavorites: favorites.length,
    }
  },
})

/**
 * Generate an upload URL for asset thumbnail
 * Returns a pre-signed URL that can be used to upload an image
 */
export const generateThumbnailUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Update asset thumbnail after upload
 * Saves the storage ID to the asset and deletes the old thumbnail if exists
 */
export const updateThumbnail = mutation({
  args: {
    assetId: v.id("assets"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const asset = await ctx.db.get(args.assetId)
    if (!asset) {
      throw new Error("Asset not found")
    }

    // Delete old thumbnail if exists
    if (asset.thumbnailStorageId) {
      await ctx.storage.delete(asset.thumbnailStorageId)
    }

    // Update asset with new thumbnail
    await ctx.db.patch(args.assetId, {
      thumbnailStorageId: args.storageId,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

/**
 * Delete asset thumbnail
 */
export const deleteThumbnail = mutation({
  args: {
    assetId: v.id("assets"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const asset = await ctx.db.get(args.assetId)
    if (!asset) {
      throw new Error("Asset not found")
    }

    // Delete thumbnail from storage if exists
    if (asset.thumbnailStorageId) {
      await ctx.storage.delete(asset.thumbnailStorageId)
    }

    // Remove thumbnail reference from asset
    await ctx.db.patch(args.assetId, {
      thumbnailStorageId: undefined,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

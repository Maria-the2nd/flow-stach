import { query, mutation } from "./_generated/server"
import { v } from "convex/values"
import { requireAuth, requireAdmin } from "./auth"

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx)

    const templates = await ctx.db.query("templates").collect()
    return templates.sort((a, b) => a.name.localeCompare(b.name))
  },
})

export const listWithCounts = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx)

    const templates = await ctx.db.query("templates").collect()
    const assets = await ctx.db
      .query("assets")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect()

    const counts = new Map<string, number>()
    for (const asset of assets) {
      if (!asset.templateId) continue
      counts.set(asset.templateId, (counts.get(asset.templateId) ?? 0) + 1)
    }

    return templates
      .map((template) => ({
        ...template,
        assetCount: counts.get(template._id) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  },
})

export const rename = mutation({
  args: {
    templateId: v.id("templates"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const name = args.name.trim()
    if (!name) {
      throw new Error("Template name cannot be empty")
    }

    await ctx.db.patch(args.templateId, {
      name,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

export const deleteTemplate = mutation({
  args: {
    templateId: v.id("templates"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    // Get all assets for this template
    const assets = await ctx.db
      .query("assets")
      .filter((q) => q.eq(q.field("templateId"), args.templateId))
      .collect()

    let deletedAssets = 0
    let deletedPayloads = 0

    // Delete each asset and its payload
    for (const asset of assets) {
      // Delete payload if exists
      const payload = await ctx.db
        .query("payloads")
        .withIndex("by_asset_id", (q) => q.eq("assetId", asset._id))
        .unique()

      if (payload) {
        await ctx.db.delete(payload._id)
        deletedPayloads++
      }

      // Delete favorites for this asset
      const favorites = await ctx.db
        .query("favorites")
        .filter((q) => q.eq(q.field("assetId"), asset._id))
        .collect()

      for (const fav of favorites) {
        await ctx.db.delete(fav._id)
      }

      await ctx.db.delete(asset._id)
      deletedAssets++
    }

    // Delete the template itself
    await ctx.db.delete(args.templateId)

    return {
      success: true,
      deletedAssets,
      deletedPayloads,
    }
  },
})

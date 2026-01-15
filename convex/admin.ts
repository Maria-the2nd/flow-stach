import { mutation } from "./_generated/server"
import { requireAdmin } from "./auth"
import { v } from "convex/values"

/**
 * Clear all assets, payloads, favorites, and templates from the database.
 * Admin only - use for fresh start before importing new data.
 */
export const clearAllAssets = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    // Delete all favorites first (they reference assets)
    const allFavorites = await ctx.db.query("favorites").collect()
    for (const favorite of allFavorites) {
      await ctx.db.delete(favorite._id)
    }

    // Delete all payloads (they reference assets)
    const allPayloads = await ctx.db.query("payloads").collect()
    for (const payload of allPayloads) {
      await ctx.db.delete(payload._id)
    }

    // Delete all assets
    const allAssets = await ctx.db.query("assets").collect()
    for (const asset of allAssets) {
      await ctx.db.delete(asset._id)
    }

    // Delete all templates
    const allTemplates = await ctx.db.query("templates").collect()
    for (const template of allTemplates) {
      await ctx.db.delete(template._id)
    }

    return {
      deletedAssets: allAssets.length,
      deletedPayloads: allPayloads.length,
      deletedFavorites: allFavorites.length,
      deletedTemplates: allTemplates.length,
    }
  },
})

/**
 * Clear all data for a single template:
 * - Deletes all assets associated with the template
 * - Deletes payloads and favorites for those assets
 * - Optionally deletes the template record itself
 */
export const clearTemplateData = mutation({
  args: {
    templateId: v.id("templates"),
    deleteTemplate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    // Collect assets for this template
    const assets = await ctx.db
      .query("assets")
      .filter((q) => q.eq(q.field("templateId"), args.templateId))
      .collect()

    let deletedAssets = 0
    let deletedPayloads = 0
    let deletedFavorites = 0

    for (const asset of assets) {
      // Delete payloads for asset
      const payloads = await ctx.db
        .query("payloads")
        .withIndex("by_asset_id", (q) => q.eq("assetId", asset._id))
        .collect()
      for (const payload of payloads) {
        await ctx.db.delete(payload._id)
        deletedPayloads++
      }

      // Delete favorites for asset
      const favorites = await ctx.db
        .query("favorites")
        .filter((q) => q.eq(q.field("assetId"), asset._id))
        .collect()
      for (const favorite of favorites) {
        await ctx.db.delete(favorite._id)
        deletedFavorites++
      }

      // Delete asset
      await ctx.db.delete(asset._id)
      deletedAssets++
    }

    let deletedTemplates = 0
    if (args.deleteTemplate) {
      await ctx.db.delete(args.templateId)
      deletedTemplates = 1
    }

    return {
      deletedAssets,
      deletedPayloads,
      deletedFavorites,
      deletedTemplates,
    }
  },
})

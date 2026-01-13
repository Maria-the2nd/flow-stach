import { mutation } from "./_generated/server"
import { requireAdmin } from "./auth"

/**
 * Clear all assets, payloads, and favorites from the database.
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

    return {
      deletedAssets: allAssets.length,
      deletedPayloads: allPayloads.length,
      deletedFavorites: allFavorites.length,
    }
  },
})

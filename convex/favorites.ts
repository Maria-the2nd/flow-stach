import { query, mutation } from "./_generated/server"
import { v } from "convex/values"
import { requireAuth } from "./auth"

// List all favorites for the current user
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx)

    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()

    // Fetch the associated assets
    const favoritesWithAssets = await Promise.all(
      favorites.map(async (fav) => {
        const asset = await ctx.db.get(fav.assetId)
        return {
          ...fav,
          asset,
        }
      })
    )

    // Filter out any favorites where the asset no longer exists or is not published
    return favoritesWithAssets.filter(
      (f) => f.asset && f.asset.status === "published"
    )
  },
})

// Toggle favorite status for an asset
export const toggle = mutation({
  args: {
    assetId: v.id("assets"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)

    // Check if asset exists and is published
    const asset = await ctx.db.get(args.assetId)
    if (!asset || asset.status !== "published") {
      throw new Error("Asset not found")
    }

    // Check if favorite already exists
    const existingFavorite = await ctx.db
      .query("favorites")
      .withIndex("by_user_and_asset", (q) =>
        q.eq("userId", user._id).eq("assetId", args.assetId)
      )
      .unique()

    if (existingFavorite) {
      // Remove favorite
      await ctx.db.delete(existingFavorite._id)
      return { favorited: false }
    } else {
      // Add favorite
      await ctx.db.insert("favorites", {
        userId: user._id,
        assetId: args.assetId,
        createdAt: Date.now(),
      })
      return { favorited: true }
    }
  },
})

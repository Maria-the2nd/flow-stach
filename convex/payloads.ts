import { query } from "./_generated/server"
import { v } from "convex/values"
import { requireAuth } from "./auth"

// Get payload by asset ID
export const byAssetId = query({
  args: {
    assetId: v.id("assets"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    const payload = await ctx.db
      .query("payloads")
      .withIndex("by_asset_id", (q) => q.eq("assetId", args.assetId))
      .unique()

    return payload
  },
})

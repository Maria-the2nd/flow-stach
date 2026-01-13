import { query } from "./_generated/server"
import { requireAuth } from "./auth"

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

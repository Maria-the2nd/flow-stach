import { mutation } from "./_generated/server"
import { v } from "convex/values"
import { requireAdmin } from "./auth"
import { Id } from "./_generated/dataModel"

/**
 * Import sections from parsed HTML
 * Creates assets and payloads in bulk
 */
export const importSections = mutation({
  args: {
    designSystemName: v.string(),
    designSystemSlug: v.string(),
    sections: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        slug: v.string(),
        category: v.string(),
        tags: v.array(v.string()),
        codePayload: v.string(),
      })
    ),
    tokenManifest: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const now = Date.now()
    const results = {
      assetsCreated: 0,
      assetsUpdated: 0,
      payloadsCreated: 0,
      payloadsUpdated: 0,
      errors: [] as string[],
    }

    // First, create/update the design tokens asset if manifest provided
    if (args.tokenManifest) {
      const tokenSlug = `${args.designSystemSlug}-tokens`
      const existingTokenAsset = await ctx.db
        .query("assets")
        .withIndex("by_slug", (q) => q.eq("slug", tokenSlug))
        .unique()

      if (existingTokenAsset) {
        // Update existing
        await ctx.db.patch(existingTokenAsset._id, {
          title: `${args.designSystemName} Design Tokens`,
          status: "published",
          updatedAt: now,
        })

        // Update payload
        const existingPayload = await ctx.db
          .query("payloads")
          .withIndex("by_asset_id", (q) => q.eq("assetId", existingTokenAsset._id))
          .unique()

        if (existingPayload) {
          await ctx.db.patch(existingPayload._id, {
            codePayload: `/* TOKEN MANIFEST */\n${args.tokenManifest}`,
            updatedAt: now,
          })
        }
        results.assetsUpdated++
      } else {
        // Create new token asset
        const tokenAssetId = await ctx.db.insert("assets", {
          slug: tokenSlug,
          title: `${args.designSystemName} Design Tokens`,
          category: "tokens",
          description: `Design tokens for ${args.designSystemName}`,
          tags: ["tokens", "design-system", args.designSystemSlug],
          isNew: true,
          status: "published",
          pasteReliability: "full",
          supportsCodeCopy: true,
          createdAt: now,
          updatedAt: now,
        })

        await ctx.db.insert("payloads", {
          assetId: tokenAssetId,
          webflowJson: "{}",
          codePayload: `/* TOKEN MANIFEST */\n${args.tokenManifest}`,
          dependencies: [],
          createdAt: now,
          updatedAt: now,
        })

        results.assetsCreated++
        results.payloadsCreated++
      }
    }

    // Import each section
    for (const section of args.sections) {
      try {
        // Check if asset exists
        const existingAsset = await ctx.db
          .query("assets")
          .withIndex("by_slug", (q) => q.eq("slug", section.slug))
          .unique()

        let assetId: Id<"assets">

        if (existingAsset) {
          // Update existing asset
          await ctx.db.patch(existingAsset._id, {
            title: section.name,
            category: section.category,
            tags: section.tags,
            status: "published",
            updatedAt: now,
          })
          assetId = existingAsset._id
          results.assetsUpdated++
        } else {
          // Create new asset
          assetId = await ctx.db.insert("assets", {
            slug: section.slug,
            title: section.name,
            category: section.category,
            description: `${section.name} from ${args.designSystemName}`,
            tags: section.tags,
            isNew: true,
            status: "published",
            pasteReliability: "full",
            supportsCodeCopy: true,
            createdAt: now,
            updatedAt: now,
          })
          results.assetsCreated++
        }

        // Check for existing payload
        const existingPayload = await ctx.db
          .query("payloads")
          .withIndex("by_asset_id", (q) => q.eq("assetId", assetId))
          .unique()

        if (existingPayload) {
          // Update payload
          await ctx.db.patch(existingPayload._id, {
            codePayload: section.codePayload,
            updatedAt: now,
          })
          results.payloadsUpdated++
        } else {
          // Create payload
          await ctx.db.insert("payloads", {
            assetId: assetId,
            webflowJson: "{}",
            codePayload: section.codePayload,
            dependencies: [],
            createdAt: now,
            updatedAt: now,
          })
          results.payloadsCreated++
        }
      } catch (error) {
        results.errors.push(`Failed to import ${section.name}: ${error}`)
      }
    }

    return results
  },
})

/**
 * Delete all imported sections for a design system
 */
export const deleteDesignSystem = mutation({
  args: {
    designSystemSlug: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    // Find all assets with this design system tag
    const assets = await ctx.db.query("assets").collect()
    const matchingAssets = assets.filter(
      (a) => a.tags.includes(args.designSystemSlug) || a.slug.startsWith(args.designSystemSlug)
    )

    let deleted = 0

    for (const asset of matchingAssets) {
      // Delete payload first
      const payload = await ctx.db
        .query("payloads")
        .withIndex("by_asset_id", (q) => q.eq("assetId", asset._id))
        .unique()

      if (payload) {
        await ctx.db.delete(payload._id)
      }

      // Delete asset
      await ctx.db.delete(asset._id)
      deleted++
    }

    return { deleted }
  },
})

/**
 * Get import stats
 */
export const getImportStats = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const assets = await ctx.db.query("assets").collect()
    const payloads = await ctx.db.query("payloads").collect()

    // Group by category
    const byCategory: Record<string, number> = {}
    for (const asset of assets) {
      byCategory[asset.category] = (byCategory[asset.category] || 0) + 1
    }

    // Count design systems (unique slug prefixes)
    const designSystems = new Set<string>()
    for (const asset of assets) {
      const parts = asset.slug.split("-")
      if (parts.length >= 2) {
        designSystems.add(parts.slice(0, 2).join("-"))
      }
    }

    return {
      totalAssets: assets.length,
      totalPayloads: payloads.length,
      byCategory,
      designSystemCount: designSystems.size,
    }
  },
})

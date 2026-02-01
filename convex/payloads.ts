import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { requireAuth, requireAdmin } from "./auth"

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

// Create payload with 5-output structure
export const create = mutation({
  args: {
    assetId: v.id("assets"),
    designTokens: v.optional(v.string()),
    webflowJson: v.optional(v.string()),
    cssEmbed: v.optional(v.string()),
    jsEmbed: v.optional(v.string()),
    libraryImports: v.optional(v.object({
      scripts: v.array(v.string()),
      styles: v.array(v.string()),
    })),
    validationResults: v.optional(v.object({
      designTokens: v.object({
        valid: v.boolean(),
        errors: v.array(v.string()),
        warnings: v.array(v.string()),
      }),
      webflowJson: v.object({
        valid: v.boolean(),
        errors: v.array(v.string()),
        warnings: v.array(v.string()),
      }),
      cssEmbed: v.object({
        valid: v.boolean(),
        errors: v.array(v.string()),
        warnings: v.array(v.string()),
      }),
      jsEmbed: v.object({
        valid: v.boolean(),
        errors: v.array(v.string()),
        warnings: v.array(v.string()),
      }),
    })),
    hasEmbeds: v.optional(v.boolean()),
    detectedLibraries: v.optional(v.array(v.string())),
    cssFeatures: v.optional(v.array(v.string())),
    // Backwards compatibility
    codePayload: v.optional(v.string()),
    dependencies: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    const now = Date.now()

    const payloadId = await ctx.db.insert("payloads", {
      assetId: args.assetId,
      designTokens: args.designTokens,
      webflowJson: args.webflowJson,
      cssEmbed: args.cssEmbed,
      jsEmbed: args.jsEmbed,
      libraryImports: args.libraryImports,
      validationResults: args.validationResults,
      hasEmbeds: args.hasEmbeds,
      detectedLibraries: args.detectedLibraries,
      cssFeatures: args.cssFeatures,
      codePayload: args.codePayload,
      dependencies: args.dependencies,
      createdAt: now,
      updatedAt: now,
    })

    return payloadId
  },
})

// Update existing payload
export const update = mutation({
  args: {
    payloadId: v.id("payloads"),
    designTokens: v.optional(v.string()),
    webflowJson: v.optional(v.string()),
    cssEmbed: v.optional(v.string()),
    jsEmbed: v.optional(v.string()),
    libraryImports: v.optional(v.object({
      scripts: v.array(v.string()),
      styles: v.array(v.string()),
    })),
    validationResults: v.optional(v.object({
      designTokens: v.object({
        valid: v.boolean(),
        errors: v.array(v.string()),
        warnings: v.array(v.string()),
      }),
      webflowJson: v.object({
        valid: v.boolean(),
        errors: v.array(v.string()),
        warnings: v.array(v.string()),
      }),
      cssEmbed: v.object({
        valid: v.boolean(),
        errors: v.array(v.string()),
        warnings: v.array(v.string()),
      }),
      jsEmbed: v.object({
        valid: v.boolean(),
        errors: v.array(v.string()),
        warnings: v.array(v.string()),
      }),
    })),
    hasEmbeds: v.optional(v.boolean()),
    detectedLibraries: v.optional(v.array(v.string())),
    cssFeatures: v.optional(v.array(v.string())),
    // Backwards compatibility
    codePayload: v.optional(v.string()),
    dependencies: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    const { payloadId, ...updates } = args

    await ctx.db.patch(payloadId, {
      ...updates,
      updatedAt: Date.now(),
    })

    return payloadId
  },
})

/**
 * Create a marketplace payload (admin only)
 * Used when importing Webflow templates into the marketplace
 */
export const createMarketplacePayload = mutation({
  args: {
    assetId: v.id("assets"),
    webflowJson: v.string(),
    cssEmbed: v.optional(v.string()),
    jsEmbed: v.optional(v.string()),
    libraryImports: v.optional(v.object({
      scripts: v.array(v.string()),
      styles: v.array(v.string()),
    })),
    detectedLibraries: v.optional(v.array(v.string())),
    hasEmbeds: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    // Verify asset exists
    const asset = await ctx.db.get(args.assetId)
    if (!asset) {
      throw new Error("Asset not found")
    }

    // Check if payload already exists for this asset
    const existingPayload = await ctx.db
      .query("payloads")
      .withIndex("by_asset_id", (q) => q.eq("assetId", args.assetId))
      .unique()

    if (existingPayload) {
      throw new Error("Payload already exists for this asset. Use update instead.")
    }

    const now = Date.now()

    const payloadId = await ctx.db.insert("payloads", {
      assetId: args.assetId,
      webflowJson: args.webflowJson,
      cssEmbed: args.cssEmbed,
      jsEmbed: args.jsEmbed,
      libraryImports: args.libraryImports,
      detectedLibraries: args.detectedLibraries,
      hasEmbeds: args.hasEmbeds ?? !!(args.cssEmbed || args.jsEmbed),
      createdAt: now,
      updatedAt: now,
    })

    return payloadId
  },
})

/**
 * Update marketplace payload (admin only)
 * Used for editing imported Webflow templates
 */
export const updateMarketplacePayload = mutation({
  args: {
    assetId: v.id("assets"),
    webflowJson: v.optional(v.string()),
    cssEmbed: v.optional(v.string()),
    jsEmbed: v.optional(v.string()),
    libraryImports: v.optional(v.object({
      scripts: v.array(v.string()),
      styles: v.array(v.string()),
    })),
    detectedLibraries: v.optional(v.array(v.string())),
    hasEmbeds: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const payload = await ctx.db
      .query("payloads")
      .withIndex("by_asset_id", (q) => q.eq("assetId", args.assetId))
      .unique()

    if (!payload) {
      throw new Error("Payload not found for this asset")
    }

    const { assetId, ...updates } = args

    // Remove undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    )

    // Recalculate hasEmbeds if needed
    if (cleanUpdates.cssEmbed !== undefined || cleanUpdates.jsEmbed !== undefined) {
      const newCssEmbed = cleanUpdates.cssEmbed ?? payload.cssEmbed
      const newJsEmbed = cleanUpdates.jsEmbed ?? payload.jsEmbed
      cleanUpdates.hasEmbeds = !!(newCssEmbed || newJsEmbed)
    }

    await ctx.db.patch(payload._id, {
      ...cleanUpdates,
      updatedAt: Date.now(),
    })

    return payload._id
  },
})

/**
 * Get payload by asset ID (admin only, for editing)
 */
export const getByAssetIdAdmin = query({
  args: {
    assetId: v.id("assets"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    return await ctx.db
      .query("payloads")
      .withIndex("by_asset_id", (q) => q.eq("assetId", args.assetId))
      .unique()
  },
})

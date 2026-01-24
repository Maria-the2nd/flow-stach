import { mutation, query } from "./_generated/server"
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

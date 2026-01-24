import { query, mutation } from "./_generated/server"
import { v } from "convex/values"
import { requireAuth, requireAdmin } from "./auth"
import { validateAndSanitizeWebflowJson } from "./webflow_validation"

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

    const template = await ctx.db.get(args.templateId)
    if (!template) {
      throw new Error("Template not found")
    }

    // Get all assets for this template
    const assets = await ctx.db
      .query("assets")
      .filter((q) => q.eq(q.field("templateId"), args.templateId))
      .collect()

    let deletedAssets = 0
    let deletedPayloads = 0

    // Delete each asset and its payload
    for (const asset of assets) {
      // Delete asset thumbnail from storage if exists
      if (asset.thumbnailStorageId) {
        await ctx.storage.delete(asset.thumbnailStorageId)
      }

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

    // Delete template thumbnail from storage if exists
    if (template.thumbnailStorageId) {
      await ctx.storage.delete(template.thumbnailStorageId)
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

/**
 * List user's templates (for Flow-Goodies extension)
 * Returns all templates with their asset counts
 */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx)

    const templates = await ctx.db.query("templates").collect()
    const assets = await ctx.db.query("assets").collect()

    const counts = new Map<string, number>()
    for (const asset of assets) {
      if (!asset.templateId) continue
      counts.set(asset.templateId, (counts.get(asset.templateId) ?? 0) + 1)
    }

    // Get thumbnail URLs for all templates
    const templatesWithThumbnails = await Promise.all(
      templates.map(async (template) => {
        let thumbnailUrl: string | null = null
        if (template.thumbnailStorageId) {
          thumbnailUrl = await ctx.storage.getUrl(template.thumbnailStorageId)
        }
        return {
          _id: template._id,
          name: template.name,
          slug: template.slug,
          imageUrl: template.imageUrl,  // Legacy fallback
          thumbnailUrl,                 // New storage URL
          assetCount: counts.get(template._id) ?? 0,
          _creationTime: template.createdAt,
        }
      })
    )

    return templatesWithThumbnails.sort((a, b) => b._creationTime - a._creationTime)
  },
})

/**
 * Generate an upload URL for template thumbnail
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
 * Update template thumbnail after upload
 * Saves the storage ID to the template and deletes the old thumbnail if exists
 */
export const updateThumbnail = mutation({
  args: {
    templateId: v.id("templates"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    const template = await ctx.db.get(args.templateId)
    if (!template) {
      throw new Error("Template not found")
    }

    // Delete old thumbnail if exists
    if (template.thumbnailStorageId) {
      await ctx.storage.delete(template.thumbnailStorageId)
    }

    // Update template with new thumbnail
    await ctx.db.patch(args.templateId, {
      thumbnailStorageId: args.storageId,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

/**
 * Delete template thumbnail
 */
export const deleteThumbnail = mutation({
  args: {
    templateId: v.id("templates"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    const template = await ctx.db.get(args.templateId)
    if (!template) {
      throw new Error("Template not found")
    }

    // Delete thumbnail from storage if exists
    if (template.thumbnailStorageId) {
      await ctx.storage.delete(template.thumbnailStorageId)
    }

    // Remove thumbnail reference from template
    await ctx.db.patch(args.templateId, {
      thumbnailStorageId: undefined,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

/**
 * Get full page payload for a template (for Flow-Goodies extension)
 * Returns the most recent asset's webflowJson for the given template
 */
export const getFullPagePayload = query({
  args: {
    templateId: v.id("templates"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    // Get the most recent asset for this template
    const assets = await ctx.db
      .query("assets")
      .withIndex("by_template", (q) => q.eq("templateId", args.templateId))
      .collect()

    if (assets.length === 0) {
      throw new Error("No assets found for this template")
    }

    // Sort by creation time descending (most recent first)
    const sortedAssets = assets.sort((a, b) => b.createdAt - a.createdAt)
    const latestAsset = sortedAssets[0]

    // Get the payload for this asset
    const payload = await ctx.db
      .query("payloads")
      .withIndex("by_asset_id", (q) => q.eq("assetId", latestAsset._id))
      .unique()

    if (!payload) {
      throw new Error("No payload found for this asset")
    }

    return {
      webflowJson: payload.webflowJson,
      assetTitle: latestAsset.title,
      assetSlug: latestAsset.slug,
    }
  },
})

/**
 * Send a draft payload to Flow-Goodies (clipboard-free bridge)
 * Creates a draft template/asset/payload that Flow-Goodies can fetch via "Insert Full Site"
 *
 * CRITICAL: Validates and sanitizes webflowJson before storing to prevent
 * corrupted payloads from reaching Webflow Designer.
 */
export const sendToFlowGoodies = mutation({
  args: {
    name: v.string(),
    webflowJson: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    // CRITICAL: Validate and sanitize webflowJson before storing
    const validationResult = validateAndSanitizeWebflowJson(args.webflowJson);

    if (!validationResult.validation.canProceed) {
      throw new Error(`Invalid Webflow payload: ${validationResult.validation.summary}`);
    }

    const now = Date.now()
    const slug = `flow-goodies-draft-${now}`

    // Find or create the "Flow-Goodies Drafts" template
    let template = await ctx.db
      .query("templates")
      .withIndex("by_slug", (q) => q.eq("slug", "flow-goodies-drafts"))
      .unique()

    if (!template) {
      const templateId = await ctx.db.insert("templates", {
        name: "Flow-Goodies Drafts",
        slug: "flow-goodies-drafts",
        createdAt: now,
        updatedAt: now,
      })
      template = await ctx.db.get(templateId)
      if (!template) {
        throw new Error("Failed to create template")
      }
    }

    // Create the asset
    const assetId = await ctx.db.insert("assets", {
      slug,
      title: args.name || `Draft ${now}`,
      category: "Draft",
      description: args.source || "Sent from flow-stach import tool",
      tags: ["draft", "flow-goodies"],
      templateId: template._id,
      isNew: true,
      status: "draft",
      pasteReliability: "full",
      supportsCodeCopy: false,
      createdAt: now,
      updatedAt: now,
    })

    // Create the payload with validated/sanitized JSON
    await ctx.db.insert("payloads", {
      assetId,
      webflowJson: validationResult.sanitizedJson,
      codePayload: JSON.stringify({ note: "No code payload for draft" }),
      dependencies: [],
      createdAt: now,
      updatedAt: now,
    })

    return {
      success: true,
      assetId,
      slug,
      templateId: template._id,
      validation: {
        sanitized: validationResult.sanitizationApplied,
        changes: validationResult.changes.length > 0 ? validationResult.changes : undefined,
      },
    }
  },
})

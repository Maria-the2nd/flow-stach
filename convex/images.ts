import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { requireAuth } from "./auth"

/**
 * Generate upload URL for an image
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Register a hosted image after upload
 */
export const registerHostedImage = mutation({
  args: {
    projectId: v.id("importProjects"),
    originalUrl: v.string(),
    originalFilename: v.string(),
    storageId: v.id("_storage"),
    mimeType: v.string(),
    sizeBytes: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    // Get the public URL for this storage item
    const hostedUrl = await ctx.storage.getUrl(args.storageId)

    // Store the record
    const id = await ctx.db.insert("hostedImages", {
      projectId: args.projectId,
      originalUrl: args.originalUrl,
      originalFilename: args.originalFilename,
      storageId: args.storageId,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      createdAt: Date.now(),
    })

    return { id, hostedUrl }
  },
})

/**
 * Update the images array in importProjects with hosted URL info
 */
export const updateProjectImage = mutation({
  args: {
    projectId: v.id("importProjects"),
    originalUrl: v.string(),
    hostedUrl: v.string(),
    hostedFilename: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    const project = await ctx.db.get(args.projectId)
    if (!project) {
      throw new Error("Project not found")
    }

    // Update the matching image in the images array
    const updatedImages = project.images?.map((img) => {
      if (img.url === args.originalUrl) {
        return {
          ...img,
          hostedUrl: args.hostedUrl,
          hostedFilename: args.hostedFilename,
          storageId: args.storageId,
        }
      }
      return img
    })

    await ctx.db.patch(args.projectId, {
      images: updatedImages,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

/**
 * Get all hosted images for a project
 */
export const getByProject = query({
  args: {
    projectId: v.id("importProjects"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    const images = await ctx.db
      .query("hostedImages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()

    // Get URLs for all images
    return Promise.all(
      images.map(async (img) => ({
        ...img,
        hostedUrl: await ctx.storage.getUrl(img.storageId),
      }))
    )
  },
})

/**
 * Delete all hosted images for a project (cleanup)
 */
export const deleteByProject = mutation({
  args: {
    projectId: v.id("importProjects"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    const images = await ctx.db
      .query("hostedImages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()

    for (const img of images) {
      await ctx.storage.delete(img.storageId)
      await ctx.db.delete(img._id)
    }

    return { deleted: images.length }
  },
})

/**
 * Delete a single hosted image
 */
export const deleteImage = mutation({
  args: {
    imageId: v.id("hostedImages"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    const image = await ctx.db.get(args.imageId)
    if (!image) {
      throw new Error("Image not found")
    }

    await ctx.storage.delete(image.storageId)
    await ctx.db.delete(args.imageId)

    return { success: true }
  },
})

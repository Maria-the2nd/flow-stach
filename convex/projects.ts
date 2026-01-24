import { query, mutation } from "./_generated/server"
import { v } from "convex/values"
import { requireAuth } from "./auth"
import { ConvexError } from "convex/values"

/**
 * User-scoped project queries for Chrome extension
 * These allow users to access their own imported projects
 */

/**
 * List current user's projects
 * Returns projects where userId matches the authenticated user's clerkId
 */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx)

    const projects = await ctx.db
      .query("importProjects")
      .withIndex("by_user", (q) => q.eq("userId", user.clerkId))
      .order("desc")
      .collect()

    // Get thumbnail URLs for all projects
    const projectsWithThumbnails = await Promise.all(
      projects.map(async (p) => {
        let thumbnailUrl: string | null = null
        if (p.thumbnailStorageId) {
          thumbnailUrl = await ctx.storage.getUrl(p.thumbnailStorageId)
        }
        return {
          _id: p._id,
          name: p.name,
          slug: p.slug,
          status: p.status,
          componentCount: p.componentCount,
          classCount: p.classCount,
          thumbnailUrl,
          _creationTime: p._creationTime,
        }
      })
    )

    return projectsWithThumbnails
  },
})

/**
 * Get a specific project with its artifacts
 * Verifies ownership before returning data
 */
export const getWithArtifacts = query({
  args: {
    projectId: v.id("importProjects"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)

    const project = await ctx.db.get(args.projectId)

    if (!project) {
      throw new ConvexError("Project not found")
    }

    // Verify ownership - project must have userId and it must match
    if (!project.userId || project.userId !== user.clerkId) {
      throw new ConvexError("Not authorized")
    }

    const artifacts = await ctx.db
      .query("importArtifacts")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect()

    return {
      project: {
        _id: project._id,
        name: project.name,
        slug: project.slug,
        status: project.status,
        componentCount: project.componentCount,
        classCount: project.classCount,
        hasTokens: project.hasTokens,
        _creationTime: project._creationTime,
      },
      artifacts: artifacts.map((a) => ({
        _id: a._id,
        type: a.type,
        createdAt: a.createdAt,
      })),
    }
  },
})

/**
 * Get artifact content for clipboard copy
 * Verifies ownership of parent project before returning content
 */
export const getArtifactContent = query({
  args: {
    artifactId: v.id("importArtifacts"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)

    const artifact = await ctx.db.get(args.artifactId)

    if (!artifact) {
      throw new ConvexError("Artifact not found")
    }

    // Get parent project to verify ownership
    const project = await ctx.db.get(artifact.projectId)

    if (!project) {
      throw new ConvexError("Project not found")
    }

    // Verify ownership
    if (!project.userId || project.userId !== user.clerkId) {
      throw new ConvexError("Not authorized")
    }

    return {
      type: artifact.type,
      content: artifact.content,
    }
  },
})

/**
 * Get a project by ID with all its artifacts and components
 * Public query for project detail pages (no auth required for viewing)
 */
export const getProjectById = query({
  args: { projectId: v.id("importProjects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    // Get all artifacts for this project
    const artifacts = await ctx.db
      .query("importArtifacts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Get all component assets linked to this project via template
    const template = await ctx.db
      .query("templates")
      .withIndex("by_slug", (q) => q.eq("slug", project.slug))
      .unique();

    let components: Array<{
      component: any;
      payload: any;
    }> = [];

    if (template) {
      const assets = await ctx.db
        .query("assets")
        .withIndex("by_template", (q) => q.eq("templateId", template._id))
        .collect();

      // Get payloads for each component
      components = await Promise.all(
        assets.map(async (component) => {
          const payload = await ctx.db
            .query("payloads")
            .withIndex("by_asset_id", (q) => q.eq("assetId", component._id))
            .first();
          return { component, payload };
        })
      );
    }

    return {
      project,
      artifacts,
      components,
    };
  },
});

/**
 * Get a project by slug with all its artifacts and components
 * Public query for project detail pages (no auth required for viewing)
 */
export const getProjectBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("importProjects")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!project) return null;

    // Get all artifacts for this project
    const artifacts = await ctx.db
      .query("importArtifacts")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    // Get all component assets linked to this project via template
    const template = await ctx.db
      .query("templates")
      .withIndex("by_slug", (q) => q.eq("slug", project.slug))
      .unique();

    let components: Array<{
      component: any;
      payload: any;
    }> = [];

    if (template) {
      const assets = await ctx.db
        .query("assets")
        .withIndex("by_template", (q) => q.eq("templateId", template._id))
        .collect();

      // Get payloads for each component
      components = await Promise.all(
        assets.map(async (component) => {
          const payload = await ctx.db
            .query("payloads")
            .withIndex("by_asset_id", (q) => q.eq("assetId", component._id))
            .first();
          return { component, payload };
        })
      );
    }

    return {
      project,
      artifacts,
      components,
    };
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Generate an upload URL for project thumbnail
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
 * Update project thumbnail after upload
 * Saves the storage ID to the project and deletes the old thumbnail if exists
 */
export const updateThumbnail = mutation({
  args: {
    projectId: v.id("importProjects"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)

    const project = await ctx.db.get(args.projectId)
    if (!project) {
      throw new ConvexError("Project not found")
    }

    // Verify ownership
    if (!project.userId || project.userId !== user.clerkId) {
      throw new ConvexError("Not authorized")
    }

    // Delete old thumbnail if exists
    if (project.thumbnailStorageId) {
      await ctx.storage.delete(project.thumbnailStorageId)
    }

    // Update project with new thumbnail
    await ctx.db.patch(args.projectId, {
      thumbnailStorageId: args.storageId,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

/**
 * Delete project thumbnail
 */
export const deleteThumbnail = mutation({
  args: {
    projectId: v.id("importProjects"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)

    const project = await ctx.db.get(args.projectId)
    if (!project) {
      throw new ConvexError("Project not found")
    }

    // Verify ownership
    if (!project.userId || project.userId !== user.clerkId) {
      throw new ConvexError("Not authorized")
    }

    // Delete thumbnail from storage if exists
    if (project.thumbnailStorageId) {
      await ctx.storage.delete(project.thumbnailStorageId)
    }

    // Remove thumbnail reference from project
    await ctx.db.patch(args.projectId, {
      thumbnailStorageId: undefined,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

/**
 * Delete a project and all its associated data
 * Only the owner can delete their project
 */
export const deleteProject = mutation({
  args: {
    projectId: v.id("importProjects"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)

    const project = await ctx.db.get(args.projectId)
    if (!project) {
      throw new ConvexError("Project not found")
    }

    // Verify ownership
    if (!project.userId || project.userId !== user.clerkId) {
      throw new ConvexError("Not authorized to delete this project")
    }

    // Delete thumbnail from storage if exists
    if (project.thumbnailStorageId) {
      await ctx.storage.delete(project.thumbnailStorageId)
    }

    // Delete all artifacts for this project
    const artifacts = await ctx.db
      .query("importArtifacts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()

    for (const artifact of artifacts) {
      await ctx.db.delete(artifact._id)
    }

    // Find and delete associated template and its assets if they exist
    const template = await ctx.db
      .query("templates")
      .withIndex("by_slug", (q) => q.eq("slug", project.slug))
      .unique()

    if (template) {
      // Delete assets and their payloads
      const assets = await ctx.db
        .query("assets")
        .withIndex("by_template", (q) => q.eq("templateId", template._id))
        .collect()

      for (const asset of assets) {
        // Delete payload
        const payload = await ctx.db
          .query("payloads")
          .withIndex("by_asset_id", (q) => q.eq("assetId", asset._id))
          .first()

        if (payload) {
          await ctx.db.delete(payload._id)
        }

        // Delete favorites
        const favorites = await ctx.db
          .query("favorites")
          .withIndex("by_asset", (q) => q.eq("assetId", asset._id))
          .collect()

        for (const fav of favorites) {
          await ctx.db.delete(fav._id)
        }

        await ctx.db.delete(asset._id)
      }

      // Delete template
      await ctx.db.delete(template._id)
    }

    // Finally delete the project
    await ctx.db.delete(args.projectId)

    return {
      success: true,
      deletedArtifacts: artifacts.length,
    }
  },
})

/**
 * Delete all of the current user's projects
 * Cascades to all related data (artifacts, templates, assets, payloads, favorites)
 */
export const deleteAllMyProjects = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx)

    // Get all user's projects
    const projects = await ctx.db
      .query("importProjects")
      .withIndex("by_user", (q) => q.eq("userId", user.clerkId))
      .collect()

    let deletedProjects = 0
    let deletedArtifacts = 0
    let deletedTemplates = 0
    let deletedAssets = 0
    let deletedPayloads = 0

    // Delete each project using existing cascade logic
    for (const project of projects) {
      // Delete thumbnail from storage
      if (project.thumbnailStorageId) {
        await ctx.storage.delete(project.thumbnailStorageId)
      }

      // Delete artifacts
      const artifacts = await ctx.db
        .query("importArtifacts")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()
      for (const artifact of artifacts) {
        await ctx.db.delete(artifact._id)
      }
      deletedArtifacts += artifacts.length

      // Find related template
      const template = await ctx.db
        .query("templates")
        .withIndex("by_slug", (q) => q.eq("slug", project.slug))
        .unique()

      if (template) {
        // Delete all assets for this template
        const assets = await ctx.db
          .query("assets")
          .withIndex("by_template", (q) => q.eq("templateId", template._id))
          .collect()

        for (const asset of assets) {
          // Delete asset thumbnail
          if (asset.thumbnailStorageId) {
            await ctx.storage.delete(asset.thumbnailStorageId)
          }

          // Delete payload
          const payload = await ctx.db
            .query("payloads")
            .withIndex("by_asset_id", (q) => q.eq("assetId", asset._id))
            .first()
          if (payload) {
            await ctx.db.delete(payload._id)
            deletedPayloads++
          }

          // Delete favorites
          const favorites = await ctx.db
            .query("favorites")
            .withIndex("by_asset", (q) => q.eq("assetId", asset._id))
            .collect()
          for (const fav of favorites) {
            await ctx.db.delete(fav._id)
          }

          // Delete asset
          await ctx.db.delete(asset._id)
          deletedAssets++
        }

        // Delete template
        await ctx.db.delete(template._id)
        deletedTemplates++
      }

      // Delete project
      await ctx.db.delete(project._id)
      deletedProjects++
    }

    return {
      deletedProjects,
      deletedArtifacts,
      deletedTemplates,
      deletedAssets,
      deletedPayloads,
    }
  },
})

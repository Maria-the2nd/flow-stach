import { query } from "./_generated/server"
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

    return projects.map((p) => ({
      _id: p._id,
      name: p.name,
      slug: p.slug,
      status: p.status,
      componentCount: p.componentCount,
      classCount: p.classCount,
      _creationTime: p._creationTime,
    }))
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

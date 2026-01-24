import { mutation, query, internalMutation } from "./_generated/server";
import { requireAdmin } from "./auth";
import { extractImages } from "../lib/image-extractor";

/**
 * INTERNAL: Delete orphan projects - CLI only, no auth required
 * Run with: npx convex run backfill:deleteOrphanProjectsInternal
 */
export const deleteOrphanProjectsInternal = internalMutation({
    args: {},
    handler: async (ctx) => {
        const projects = await ctx.db.query("importProjects").collect();
        let deletedCount = 0;
        let deletedArtifacts = 0;

        for (const project of projects) {
            if (!project.userId) {
                // Delete artifacts
                const artifacts = await ctx.db
                    .query("importArtifacts")
                    .withIndex("by_project", (q) => q.eq("projectId", project._id))
                    .collect();

                for (const artifact of artifacts) {
                    await ctx.db.delete(artifact._id);
                    deletedArtifacts++;
                }

                // Delete thumbnail
                if (project.thumbnailStorageId) {
                    await ctx.storage.delete(project.thumbnailStorageId);
                }

                // Delete project
                await ctx.db.delete(project._id);
                deletedCount++;
            }
        }

        return {
            deletedProjects: deletedCount,
            deletedArtifacts,
            message: deletedCount > 0
                ? `Cleaned up ${deletedCount} orphan projects`
                : "No orphan projects found"
        };
    },
});

/**
 * INTERNAL: Audit orphan records - CLI only
 * Run with: npx convex run backfill:auditOrphanRecordsInternal
 */
export const auditOrphanRecordsInternal = internalMutation({
    args: {},
    handler: async (ctx) => {
        const users = await ctx.db.query("users").collect();
        const validClerkIds = new Set(users.map(u => u.clerkId));

        const allProjects = await ctx.db.query("importProjects").collect();
        const orphanProjects = allProjects.filter(p => !p.userId || !validClerkIds.has(p.userId));

        return {
            totalProjects: allProjects.length,
            orphanProjects: orphanProjects.map(p => ({
                _id: p._id,
                name: p.name,
                slug: p.slug,
                userId: p.userId || "MISSING",
            })),
            summary: {
                total: allProjects.length,
                orphans: orphanProjects.length,
                valid: allProjects.length - orphanProjects.length,
            }
        };
    },
});

/**
 * Backfill mutation to scan all existing projects and extract their images/fonts
 * into the database fields we just added.
 */
export const backfillProjectAssets = mutation({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);

        const projects = await ctx.db.query("importProjects").collect();
        let updatedCount = 0;

        for (const project of projects) {
            // Try to find the clean HTML artifact for this project
            const htmlArtifact = await ctx.db
                .query("importArtifacts")
                .withIndex("by_project_type", (q) =>
                    q.eq("projectId", project._id).eq("type", "clean_html")
                )
                .unique();

            const cssArtifact = await ctx.db
                .query("importArtifacts")
                .withIndex("by_project_type", (q) =>
                    q.eq("projectId", project._id).eq("type", "styles_css")
                )
                .unique();

            const html = htmlArtifact?.content || project.sourceHtml || "";
            const css = cssArtifact?.content || "";

            if (html) {
                const images = extractImages(html, css);

                // Update the project with the extracted images
                await ctx.db.patch(project._id, {
                    images: images.length > 0 ? images : project.images,
                });
                updatedCount++;
            }
        }

        return { updatedCount };
    },
});

/**
 * ADMIN ONLY: Delete all orphan projects (projects without userId)
 * Run this ONCE before deploying the required userId schema change
 * This permanently deletes orphan projects and their artifacts
 */
export const deleteOrphanProjects = mutation({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);

        const projects = await ctx.db.query("importProjects").collect();
        let deletedCount = 0;
        let deletedArtifacts = 0;

        for (const project of projects) {
            // Check if project has no userId (orphan)
            if (!project.userId) {
                // Delete all artifacts for this project
                const artifacts = await ctx.db
                    .query("importArtifacts")
                    .withIndex("by_project", (q) => q.eq("projectId", project._id))
                    .collect();

                for (const artifact of artifacts) {
                    await ctx.db.delete(artifact._id);
                    deletedArtifacts++;
                }

                // Delete thumbnail if exists
                if (project.thumbnailStorageId) {
                    await ctx.storage.delete(project.thumbnailStorageId);
                }

                // Delete the project
                await ctx.db.delete(project._id);
                deletedCount++;
            }
        }

        return {
            deletedProjects: deletedCount,
            deletedArtifacts,
            message: deletedCount > 0
                ? `Cleaned up ${deletedCount} orphan projects`
                : "No orphan projects found"
        };
    },
});

/**
 * ADMIN ONLY: Audit orphan records across all tables
 * Lists records with missing or invalid ownership without deleting them
 */
export const auditOrphanRecords = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);

        // Get all valid user IDs from the users table
        const users = await ctx.db.query("users").collect();
        const validUserIds = new Set(users.map(u => u._id));
        const validClerkIds = new Set(users.map(u => u.clerkId));

        // Check importProjects without userId or with invalid userId
        const allProjects = await ctx.db.query("importProjects").collect();
        const orphanProjects = allProjects.filter(p => !p.userId || !validClerkIds.has(p.userId));

        // Check templates without userId
        const allTemplates = await ctx.db.query("templates").collect();
        const orphanTemplates = allTemplates.filter(t => !t.userId);

        // Check favorites with invalid userId
        const allFavorites = await ctx.db.query("favorites").collect();
        const orphanFavorites = allFavorites.filter(f => !validUserIds.has(f.userId));

        // Check for assets referencing missing templates
        const allAssets = await ctx.db.query("assets").collect();
        const templateIds = new Set(allTemplates.map(t => t._id));
        const assetsWithMissingTemplate = allAssets.filter(a => a.templateId && !templateIds.has(a.templateId));

        return {
            orphanProjects: orphanProjects.map(p => ({
                _id: p._id,
                name: p.name,
                slug: p.slug,
                userId: p.userId || "MISSING",
                createdAt: p.createdAt,
            })),
            orphanTemplates: orphanTemplates.map(t => ({
                _id: t._id,
                name: t.name,
                slug: t.slug,
                userId: t.userId || "MISSING",
                createdAt: t.createdAt,
            })),
            orphanFavorites: orphanFavorites.map(f => ({
                _id: f._id,
                userId: f.userId,
                assetId: f.assetId,
                createdAt: f.createdAt,
            })),
            assetsWithMissingTemplate: assetsWithMissingTemplate.map(a => ({
                _id: a._id,
                title: a.title,
                slug: a.slug,
                templateId: a.templateId,
            })),
            summary: {
                totalOrphanProjects: orphanProjects.length,
                totalOrphanTemplates: orphanTemplates.length,
                totalOrphanFavorites: orphanFavorites.length,
                totalAssetsWithMissingTemplate: assetsWithMissingTemplate.length,
                totalUsers: users.length,
            },
        };
    },
});

/**
 * ADMIN ONLY: Claim orphan projects for the current admin user
 * Useful for recovering projects that lost their userId during migration
 */
export const claimOrphanProjects = mutation({
    args: {},
    handler: async (ctx) => {
        const user = await requireAdmin(ctx);

        const projects = await ctx.db.query("importProjects").collect();
        let claimedCount = 0;

        for (const project of projects) {
            // Claim projects without userId
            if (!project.userId) {
                await ctx.db.patch(project._id, {
                    userId: user.clerkId,
                });
                claimedCount++;
            }
        }

        return {
            claimedProjects: claimedCount,
            newOwner: user.clerkId,
            message: claimedCount > 0
                ? `Claimed ${claimedCount} orphan projects`
                : "No orphan projects found"
        };
    },
});

/**
 * ADMIN ONLY: Clean up orphan favorites (favorites pointing to non-existent users)
 */
export const cleanupOrphanFavorites = mutation({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);

        const users = await ctx.db.query("users").collect();
        const validUserIds = new Set(users.map(u => u._id));

        const allFavorites = await ctx.db.query("favorites").collect();
        let deletedCount = 0;

        for (const favorite of allFavorites) {
            if (!validUserIds.has(favorite.userId)) {
                await ctx.db.delete(favorite._id);
                deletedCount++;
            }
        }

        return {
            deletedFavorites: deletedCount,
            message: deletedCount > 0
                ? `Cleaned up ${deletedCount} orphan favorites`
                : "No orphan favorites found"
        };
    },
});

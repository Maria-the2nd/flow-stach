import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    role: v.union(v.literal("user"), v.literal("admin")),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  assets: defineTable({
    slug: v.string(),
    title: v.string(),
    category: v.string(),
    description: v.optional(v.string()),
    tags: v.array(v.string()),
    templateId: v.optional(v.id("templates")),
    previewImageUrl: v.optional(v.string()),           // DEPRECATED: Keep for backwards compatibility
    thumbnailStorageId: v.optional(v.id("_storage")),  // Convex file storage
    previewVideoUrl: v.optional(v.string()),
    isNew: v.boolean(),
    status: v.union(v.literal("draft"), v.literal("published")),
    // Capability flags
    pasteReliability: v.optional(v.union(v.literal("full"), v.literal("partial"), v.literal("none"))),
    supportsCodeCopy: v.optional(v.boolean()),
    capabilityNotes: v.optional(v.string()),
    updatedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_category", ["category"])
    .index("by_status", ["status"])
    .index("by_template", ["templateId"]),

  templates: defineTable({
    name: v.string(),
    slug: v.string(),
    imageUrl: v.optional(v.string()),                  // DEPRECATED: Keep for backwards compatibility
    thumbnailStorageId: v.optional(v.id("_storage")),  // Convex file storage
    userId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),

  payloads: defineTable({
    assetId: v.id("assets"),

    // === FIVE SEPARATE OUTPUTS ===
    designTokens: v.optional(v.string()),      // JSON: { colors, typography, spacing }
    webflowJson: v.optional(v.string()),       // @webflow/XscpData JSON
    cssEmbed: v.optional(v.string()),          // Modern CSS content (no <style> tags)
    jsEmbed: v.optional(v.string()),           // JavaScript content (no <script> tags)
    libraryImports: v.optional(v.object({
      scripts: v.array(v.string()),            // CDN URLs: ["https://cdn.../gsap.min.js"]
      styles: v.array(v.string()),             // CDN URLs: ["https://cdn.../font.css"]
    })),

    // === VALIDATION METADATA ===
    validationResults: v.optional(v.object({
      designTokens: v.object({
        valid: v.boolean(),
        errors: v.array(v.string()),
        warnings: v.array(v.string())
      }),
      webflowJson: v.object({
        valid: v.boolean(),
        errors: v.array(v.string()),
        warnings: v.array(v.string())
      }),
      cssEmbed: v.object({
        valid: v.boolean(),
        errors: v.array(v.string()),
        warnings: v.array(v.string())
      }),
      jsEmbed: v.object({
        valid: v.boolean(),
        errors: v.array(v.string()),
        warnings: v.array(v.string())
      }),
    })),

    // === FEATURE DETECTION ===
    hasEmbeds: v.optional(v.boolean()),                    // True if cssEmbed or jsEmbed exist
    detectedLibraries: v.optional(v.array(v.string())),    // ["GSAP", "ScrollTrigger", "Lenis"]
    cssFeatures: v.optional(v.array(v.string())),          // ["oklch", "@container", ":has()"]

    // === BACKWARDS COMPATIBILITY (DEPRECATED) ===
    codePayload: v.optional(v.string()),       // DEPRECATED - keep for old assets
    dependencies: v.optional(v.array(v.string())), // DEPRECATED

    // === TIMESTAMPS ===
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_asset_id", ["assetId"]),

  favorites: defineTable({
    userId: v.id("users"),
    assetId: v.id("assets"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_asset", ["userId", "assetId"])
    .index("by_asset", ["assetId"]),

  // Import projects - stores imported HTML files for reuse
  importProjects: defineTable({
    name: v.string(),
    slug: v.string(),
    status: v.union(v.literal("draft"), v.literal("complete")),
    // Owner (Clerk user ID) - REQUIRED, no orphan projects allowed
    userId: v.string(),
    // Project thumbnail (Convex file storage reference)
    thumbnailStorageId: v.optional(v.id("_storage")),
    // Original HTML (may be large, consider compression)
    sourceHtml: v.optional(v.string()),
    // Metadata
    componentCount: v.optional(v.number()),
    classCount: v.optional(v.number()),
    hasTokens: v.optional(v.boolean()),

    // Font detection results
    fonts: v.optional(v.array(v.object({
      name: v.string(),
      source: v.string(),
      url: v.optional(v.string()),
      status: v.string(),
      warning: v.optional(v.boolean()),
      installationGuide: v.string(),
    }))),

    // Image validation results
    images: v.optional(v.array(v.object({
      url: v.string(),
      type: v.string(),
      estimatedSize: v.optional(v.number()),
      sizeWarning: v.boolean(),
      blocked: v.boolean(),
      classification: v.string(),
    }))),

    // Design tokens (for quick access)
    designTokens: v.optional(v.object({
      colors: v.array(v.object({
        name: v.string(),
        value: v.string(),
      })),
      typography: v.array(v.object({
        name: v.string(),
        value: v.string(),
      })),
      spacing: v.optional(v.array(v.object({
        name: v.string(),
        value: v.string(),
      }))),
      // Enhanced tokens
      radius: v.optional(v.array(v.object({
        name: v.string(),
        value: v.string(),
        size: v.string(),
      }))),
      shadows: v.optional(v.array(v.object({
        name: v.string(),
        value: v.string(),
        intensity: v.string(),
      }))),
    })),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_user", ["userId"]),

  // Import artifacts - stores extracted artifacts per project
  importArtifacts: defineTable({
    projectId: v.id("importProjects"),
    type: v.union(
      v.literal("tokens_json"),
      v.literal("tokens_css"),
      v.literal("styles_css"),
      v.literal("class_index"),
      v.literal("clean_html"),
      v.literal("scripts_js"),
      v.literal("js_hooks"),
      v.literal("external_scripts"),
      v.literal("token_webflow_json"),
      v.literal("component_manifest")
    ),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_type", ["projectId", "type"]),
})

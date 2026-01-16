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
    previewImageUrl: v.optional(v.string()),
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
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),

  payloads: defineTable({
    assetId: v.id("assets"),
    webflowJson: v.string(),
    codePayload: v.string(),
    dependencies: v.array(v.string()),
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
    // Original HTML (may be large, consider compression)
    sourceHtml: v.optional(v.string()),
    // Metadata
    componentCount: v.optional(v.number()),
    classCount: v.optional(v.number()),
    hasTokens: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

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

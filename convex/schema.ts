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
    .index("by_status", ["status"]),

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
    .index("by_user_and_asset", ["userId", "assetId"]),
})

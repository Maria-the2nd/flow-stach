# CLI Prompt 03a: Add User Ownership to Templates

<role>
You are a senior Convex developer adding user-scoping to the templates system.
</role>

<context>
**Project**: flow-stach — `C:\Users\maria\Desktop\pessoal\FLOW_PARTY\flow-stach`

**Current state**:
- `templates` table exists but has NO `userId` field
- All templates are visible to everyone
- We need templates to belong to specific users

**Existing auth pattern** (from `convex/auth.ts`):
- `getCurrentUser(ctx)` — returns user or null
- `requireAuth(ctx)` — throws if unauthenticated  
- `requireAdmin(ctx)` — throws if not admin

**Data flow when importing**:
- User uploads HTML at `/admin/import`
- Creates a `template` (e.g., "Flowbridge")
- Creates `assets` linked to that template (Design Tokens, Navigation, Hero, Sections, Full Page)
- Each asset has a `payload` with Webflow JSON

**Goal**: Templates should belong to the user who created them.
</context>

<instructions>

## Part 1: Update Schema

**File**: `convex/schema.ts`

Add to `templates` table:
```typescript
templates: defineTable({
  name: v.string(),
  slug: v.string(),
  imageUrl: v.optional(v.string()),
  userId: v.optional(v.string()),  // NEW - who owns this template
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
})
  .index("by_slug", ["slug"])
  .index("by_user", ["userId"]),  // NEW - for querying user's templates
```

## Part 2: Create User-Scoped Template Queries

**File**: `convex/templates.ts`

Add these new queries (keep existing ones for admin/marketplace):

```typescript
// List templates owned by current user
export const listMine = query({
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    
    const templates = await ctx.db
      .query("templates")
      .withIndex("by_user", (q) => q.eq("userId", user.clerkId))
      .order("desc")
      .collect();
    
    return templates;
  },
});

// Get template with its assets (ownership verified)
export const getWithAssets = query({
  args: { templateId: v.id("templates") },
  handler: async (ctx, { templateId }) => {
    const user = await requireAuth(ctx);
    
    const template = await ctx.db.get(templateId);
    if (!template) throw new ConvexError("Template not found");
    if (template.userId !== user.clerkId) throw new ConvexError("Not authorized");
    
    // Get all published assets for this template
    const assets = await ctx.db
      .query("assets")
      .withIndex("by_template", (q) => q.eq("templateId", templateId))
      .filter((q) => q.eq(q.field("status"), "published"))
      .collect();
    
    return { template, assets };
  },
});

// Get the "Full Page" asset payload for a template (for one-click full site copy)
export const getFullPagePayload = query({
  args: { templateId: v.id("templates") },
  handler: async (ctx, { templateId }) => {
    const user = await requireAuth(ctx);
    
    const template = await ctx.db.get(templateId);
    if (!template) throw new ConvexError("Template not found");
    if (template.userId !== user.clerkId) throw new ConvexError("Not authorized");
    
    // Find the "Full Page" asset (category might be "Full Page" or similar)
    const fullPageAsset = await ctx.db
      .query("assets")
      .withIndex("by_template", (q) => q.eq("templateId", templateId))
      .filter((q) => 
        q.and(
          q.eq(q.field("status"), "published"),
          q.or(
            q.eq(q.field("category"), "Full Page"),
            q.eq(q.field("category"), "full-page"),
            q.eq(q.field("category"), "FullPage")
          )
        )
      )
      .first();
    
    if (!fullPageAsset) {
      throw new ConvexError("No Full Page asset found for this template");
    }
    
    // Get the payload
    const payload = await ctx.db
      .query("payloads")
      .withIndex("by_asset_id", (q) => q.eq("assetId", fullPageAsset._id))
      .first();
    
    if (!payload) {
      throw new ConvexError("No payload found for Full Page asset");
    }
    
    return {
      asset: fullPageAsset,
      webflowJson: payload.webflowJson,
      codePayload: payload.codePayload,
    };
  },
});
```

## Part 3: Update Import to Set userId

**File**: `convex/import.ts`

Find where templates are created. Add `userId` when creating:

In `importProject` or `importSections` mutation, when creating template:
```typescript
// Before (probably something like):
const templateId = await ctx.db.insert("templates", {
  name: templateName,
  slug: templateSlug,
  createdAt: Date.now(),
});

// After:
const user = await requireAuth(ctx);  // or requireAdmin if admin-only
const templateId = await ctx.db.insert("templates", {
  name: templateName,
  slug: templateSlug,
  userId: user.clerkId,  // ADD THIS
  createdAt: Date.now(),
});
```

Also update any template update logic to preserve userId.

## Part 4: Don't Break Existing Functionality

- Keep `templates.list` and `templates.listWithCounts` for admin/marketplace view
- The new `listMine` is specifically for extension (user's own templates)
- Admin can still see all templates via existing queries

</instructions>

<output_format>
1. Updated `templates` table definition in schema.ts
2. New queries in templates.ts (`listMine`, `getWithAssets`, `getFullPagePayload`)
3. Changes to import.ts where templates are created
4. Confirm existing queries still work
</output_format>

<constraints>
- DO NOT break existing admin/marketplace functionality
- DO use existing auth helpers from convex/auth.ts
- DO make userId optional so existing templates don't break
- DO verify ownership before returning data
- Find the actual category name for "Full Page" in the codebase — it might be different
</constraints>

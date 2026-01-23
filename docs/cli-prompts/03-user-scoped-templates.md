# CLI Prompt 03: User-Scoped Templates + Full Page Copy

<role>
You are a senior Convex developer adding user-scoping to templates and creating queries for a Chrome extension to copy full page payloads.
</role>

<context>
**Project**: flow-stach (Flow Bridge web app)
**Location**: `C:\Users\maria\Desktop\pessoal\FLOW_PARTY\flow-stach`

**Current state**:
- `templates` table exists but has NO `userId` — all templates visible to everyone
- `assets` table has components grouped by category (including "Full Page")
- `payloads` table has Webflow JSON for each asset
- The web app already shows "Copy Full Site" button that works

**How it works now**:
1. Admin imports HTML → creates template (e.g., "Flowbridge")
2. Template has assets in categories: Design Tokens, Navigation, Hero, Sections, **Full Page**
3. "Full Page" is an asset with category "Full Page" containing the entire site as one Webflow JSON payload
4. User clicks "Copy Full Site" → copies the Full Page asset's payload

**Problem**: Templates aren't tied to users. When we have multiple users, everyone sees everything.

**Goal**:
1. Add `userId` to templates so each user only sees their own
2. Create queries the extension can call to:
   - List user's templates
   - Get the "Full Page" payload for a template (for one-click copy)
</context>

<instructions>

## Part 1: Update Schema

**File**: `convex/schema.ts`

Add `userId` to `templates` table:

```typescript
templates: defineTable({
  name: v.string(),
  slug: v.string(),
  imageUrl: v.optional(v.string()),
  userId: v.optional(v.string()),  // NEW - optional for backwards compatibility
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
})
  .index("by_slug", ["slug"])
  .index("by_user", ["userId"]),  // NEW
```

## Part 2: Create User-Scoped Template Queries

**File**: `convex/templates.ts` (update existing file)

Add these new queries:

### Query: `listMine`
- Requires auth (use `requireAuth` from auth.ts)
- Get user's clerkId
- Query templates where `userId === clerkId`
- Return: `_id`, `name`, `slug`, `imageUrl`, `createdAt`
- Sort by `createdAt` descending (newest first)

### Query: `getWithAssets`
- Args: `templateId: v.id("templates")`
- Requires auth
- Fetch template, verify ownership (`userId === clerkId`)
- Fetch all assets where `templateId` matches AND `status === "published"`
- Group assets by category
- Return: `{ template, assetsByCategory: Record<string, Asset[]> }`

### Query: `getFullPagePayload`
- Args: `templateId: v.id("templates")`
- Requires auth
- Verify ownership
- Find asset where `templateId` matches AND `category === "Full Page"` (or similar)
- Fetch its payload from `payloads` table
- Return: `{ webflowJson: string }` (ready to copy to clipboard)

## Part 3: Update Import to Set userId

**File**: `convex/import.ts`

Find where templates are created (likely in `importProject` or `importSections` mutation).

After creating/updating a template, set `userId` to current user's clerkId:

```typescript
// When creating template:
const templateId = await ctx.db.insert("templates", {
  name: templateName,
  slug: templateSlug,
  userId: user.clerkId,  // ADD THIS
  createdAt: Date.now(),
});

// When updating template:
await ctx.db.patch(existingTemplate._id, {
  updatedAt: Date.now(),
  userId: user.clerkId,  // ADD THIS (for migration of old templates)
});
```

## Part 4: Check Asset Category Names

Look at existing assets in the database or code to find the exact category name for the full page.

Possibilities:
- `"Full Page"`
- `"full-page"`
- `"FullPage"`
- Something else

The `getFullPagePayload` query needs to match this exactly.

Also check: Is there always exactly ONE "Full Page" asset per template? Or could there be multiple?

</instructions>

<output_format>
1. **Updated schema** — show the templates table definition
2. **New queries in templates.ts** — complete code for `listMine`, `getWithAssets`, `getFullPagePayload`
3. **Changes to import.ts** — show before/after for template creation
4. **Category name** — confirm the exact category string for "Full Page" assets
5. **Any edge cases** — what if no Full Page asset exists? What if multiple?
</output_format>

<constraints>
- DO NOT break existing queries (`list`, `listWithCounts`) — they should keep working for admin
- DO NOT make userId required — existing templates would break
- DO use existing auth helpers from `convex/auth.ts`
- DO handle legacy templates (no userId) — they should only be visible to admins, not regular users
- DO verify ownership before returning data
- The extension will call these queries — they must work with Clerk auth
</constraints>

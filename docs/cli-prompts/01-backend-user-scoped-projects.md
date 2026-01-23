# CLI Prompt 1: Add User-Scoped Project Queries for Extension

<role>
You are a senior Convex developer implementing user-scoped access for a Chrome extension. You understand Convex schema, queries, mutations, and the existing auth patterns in this codebase.
</role>

<context>
**Project**: Flow Bridge (flow-stach) — converts AI-generated HTML into Webflow format.

**Stack**: Next.js 16 + Convex + Clerk auth + Bun

**Existing auth pattern** (from `convex/auth.ts`):
- `getCurrentUser(ctx)` — returns user or null
- `requireAuth(ctx)` — throws if unauthenticated  
- `requireAdmin(ctx)` — throws if not admin role

**Current state**:
- `importProjects` table exists but has NO `userId` field
- `import.listImportProjects` and `import.getImportProject` are admin-only (use `requireAdmin`)
- Chrome extension needs to fetch the CURRENT USER's projects (not admin-only)

**What we're building**:
A Chrome extension companion that lets paid users access their converted projects from inside the Webflow Designer. Each user should only see their own projects.

**The extension needs**:
1. List my projects (user-scoped, not admin)
2. Get a specific project with its artifacts (ownership verified)
3. Get artifact content for clipboard copy
</context>

<instructions>
1. **Update schema** (`convex/schema.ts`):
   - Add `userId: v.optional(v.string())` to `importProjects` table
   - Add index: `by_user: ["userId"]`
   - Keep it optional so existing projects don't break

2. **Create new file** `convex/projects.ts` with these queries:

   **Query: `listMine`**
   - Use `requireAuth(ctx)` pattern from existing codebase
   - Get user's clerkId from the returned user
   - Query `importProjects` where `userId === clerkId`
   - Return: `_id`, `name`, `slug`, `status`, `componentCount`, `classCount`, `_creationTime`
   - Sort by `_creationTime` descending

   **Query: `getWithArtifacts`**
   - Args: `projectId: v.id("importProjects")`
   - Use `requireAuth(ctx)`
   - Fetch project, verify `userId === user.clerkId` (throw "Not authorized" if mismatch or if project has no userId)
   - Fetch all `importArtifacts` where `projectId` matches
   - Return `{ project, artifacts }`

   **Query: `getArtifactContent`**
   - Args: `artifactId: v.id("importArtifacts")`
   - Use `requireAuth(ctx)`
   - Fetch artifact → fetch parent project → verify ownership
   - Return the artifact's `content` field (the webflow JSON that gets copied)

3. **Update existing mutations** in `convex/import.ts`:
   - Find `importProject` mutation — after creating project, patch it with `userId: user.clerkId`
   - Find `importSections` mutation — same, set `userId` on created project
   - Use the auth helpers that already exist

4. **Leave admin mutations alone** — `import.listImportProjects` etc should keep working for the admin dashboard
</instructions>

<output_format>
Show me:
1. The updated `importProjects` definition in schema.ts
2. The complete new `convex/projects.ts` file
3. The specific changes to `convex/import.ts` (show before/after for the relevant functions)
</output_format>

<constraints>
- DO NOT modify existing admin queries — they must keep working
- DO NOT make userId required — existing data would break
- DO use the existing auth helpers (`requireAuth`, `getCurrentUser`) from `convex/auth.ts`
- DO verify ownership before returning data — this is security critical
- DO handle legacy projects (no userId) — treat as inaccessible to regular users, only admins can see them
- Follow the existing code patterns in this repo (check other convex files for style)
</constraints>

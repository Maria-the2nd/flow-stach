# AGENTS.md — Convex Backend

Serverless backend functions, database schema, and authentication logic.

## Stack

- **Framework**: Convex 1.31
- **Language**: TypeScript
- **Auth Provider**: Clerk (via Convex integration)

## Commands

```bash
# Start Convex dev server (auto-syncs with cloud)
bun run convex:dev

# Deploy to production
bun run convex:deploy

# Generate types after schema changes
bunx convex dev  # (types auto-generate on save)
```

## File Organization

```
convex/
├── _generated/             # Auto-generated types (DO NOT EDIT)
│   ├── api.d.ts
│   ├── dataModel.d.ts
│   └── server.d.ts
├── schema.ts               # Database schema definition
├── auth.ts                 # Authentication helpers
├── auth.config.ts          # Clerk provider configuration
├── users.ts                # User queries & mutations
├── assets.ts               # Asset queries & mutations
├── favorites.ts            # Favorites queries & mutations
├── payloads.ts             # Payload type definitions
├── admin.ts                # Admin operations (seeding, etc.)
├── tsconfig.json           # Convex-specific TS config
└── README.md               # Convex setup documentation
```

## Database Schema

Tables defined in `schema.ts`:

| Table | Purpose | Key Indexes |
|-------|---------|-------------|
| `users` | User profiles (synced from Clerk) | `by_clerk_id` |
| `assets` | Design assets/components | `by_slug`, `by_category`, `by_status` |
| `payloads` | Code payloads for assets | `by_asset` |
| `favorites` | User favorites | `by_user`, `by_user_and_asset` |

## Patterns & Conventions

### Query Pattern

- ✅ DO: Use `query()` for read operations like `convex/assets.ts`
- ✅ DO: Define return types explicitly
- ✅ DO: Use indexes for filtered queries

```typescript
// Example from assets.ts
export const list = query({
  args: { category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.category) {
      return ctx.db.query("assets")
        .withIndex("by_category", q => q.eq("category", args.category))
        .collect();
    }
    return ctx.db.query("assets").collect();
  },
});
```

### Mutation Pattern

- ✅ DO: Use `mutation()` for write operations
- ✅ DO: Validate inputs with `v.*` validators
- ✅ DO: Use `requireAuth()` for protected mutations

```typescript
// Example pattern
export const create = mutation({
  args: { title: v.string(), category: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    return ctx.db.insert("assets", { ...args, createdBy: user._id });
  },
});
```

### Authentication Pattern

- ✅ DO: Use helpers from `auth.ts`:
  - `getCurrentUser(ctx)` — Get current user (may be null)
  - `requireAuth(ctx)` — Get user or throw (for protected endpoints)
  - `requireAdmin(ctx)` — Get admin user or throw
- ✅ DO: Call auth helpers at the start of handlers
- ❌ DON'T: Access `ctx.auth` directly — use the helpers

### Schema Changes

- ✅ DO: Define indexes for common query patterns
- ✅ DO: Use `v.optional()` for nullable fields
- ✅ DO: Run `bun run convex:dev` to sync schema changes
- ❌ DON'T: Edit files in `_generated/` — they're auto-generated

## Key Files

| File | Purpose |
|------|---------|
| `schema.ts` | Database schema with all table definitions |
| `auth.ts` | `getCurrentUser()`, `requireAuth()`, `requireAdmin()` helpers |
| `auth.config.ts` | Clerk domain configuration |
| `assets.ts` | Asset CRUD operations |
| `users.ts` | User sync and profile operations |
| `favorites.ts` | Favorites toggle and list operations |
| `admin.ts` | Admin-only operations (seeding, bulk updates) |

## JIT Index

```bash
# Find all queries
rg -n "export const.*= query" convex/

# Find all mutations
rg -n "export const.*= mutation" convex/

# Find schema definitions
rg -n "defineTable|defineSchema" convex/schema.ts

# Find auth usage
rg -n "requireAuth|getCurrentUser" convex/

# Find index definitions
rg -n "\.index\(" convex/schema.ts
```

## Common Gotchas

1. **Generated types**: After schema changes, types update automatically when `convex:dev` is running
2. **Clerk sync**: User data syncs from Clerk — don't modify `clerkId` field manually
3. **Index required**: Queries with filters MUST use indexes for production performance
4. **Auth context**: `ctx.auth` is available but use `auth.ts` helpers for consistency
5. **Validators**: Use `v.*` from `convex/values` for all argument validation

## Pre-PR Checklist

```bash
bun run convex:dev  # Ensure schema syncs without errors
bun run typecheck
```

Verify:
- [ ] Schema changes deploy successfully
- [ ] Queries return expected data
- [ ] Mutations validate inputs correctly
- [ ] Auth guards work for protected endpoints

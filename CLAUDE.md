# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flow Stach is a Webflow component library application. Users can browse, search, and copy reusable Webflow components (assets) that include both Webflow JSON payloads and JavaScript code.

## Commands

```bash
bun run dev          # Start dev server (runs Convex + Next.js concurrently)
bun run build        # Production build
bun run typecheck    # TypeScript validation
bun run lint         # ESLint check
bun run convex:dev   # Start Convex backend only
bun run convex:deploy # Deploy Convex to production
```

## Architecture

### Provider Hierarchy (app/layout.tsx)

```
ClerkProvider (authentication)
  └── ThemeProvider (next-themes)
       └── ConvexClientProvider (database)
            └── InitUser (auto-sync Clerk user to Convex)
                 └── App content
```

The `InitUser` component automatically calls `users.ensureFromClerk` mutation when a user signs in, ensuring Clerk users are synced to the Convex `users` table.

### Layout Structure (AppShell)

Three-column responsive layout:
- **Sidebar** (240px): Navigation, category filters, theme toggle
- **Main**: Asset grid or asset detail view
- **Context Panel** (280px): Contextual info, only visible on large screens

### Database Schema (convex/schema.ts)

| Table | Purpose |
|-------|---------|
| `users` | Clerk user sync, role-based access (user/admin) |
| `assets` | Component metadata (slug, title, category, tags, status) |
| `payloads` | Webflow JSON + code for each asset |
| `favorites` | User bookmarks |

### Auth Pattern (convex/auth.ts)

All Convex queries/mutations use auth helpers:
- `getCurrentUser(ctx)` - Returns user or null
- `requireAuth(ctx)` - Throws if unauthenticated
- `requireAdmin(ctx)` - Throws if not admin role

### Data Flow for Assets

1. User views `/assets` - calls `api.assets.list` query
2. User clicks asset - navigates to `/assets/[slug]`
3. Detail page calls `api.assets.bySlug` + `api.payloads.byAssetId`
4. User copies Webflow JSON or code payload

## Key Patterns

### Styling
Use `cn()` helper from `lib/utils.ts` for conditional Tailwind classes:
```tsx
import { cn } from "@/lib/utils"
className={cn("base-classes", condition && "conditional-class")}
```

### Convex Queries with Auth
Skip queries until auth is ready to avoid errors:
```tsx
const { isLoaded, isSignedIn } = useAuth()
const data = useQuery(api.something, isLoaded && isSignedIn ? { args } : "skip")
```

### Icons
Use HugeIcons with the icon prop pattern:
```tsx
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"
<HugeiconsIcon icon={Search01Icon} size={16} />
```

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_DEPLOYMENT`

## Admin Features

- `/admin/seed` - Seeds demo assets (requires admin role)
- Admin role assigned via `users.role` field in Convex

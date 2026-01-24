# Deprecated Routes & UI Components

**Last Updated:** 2026-01-24

This document tracks all deprecated routes, pages, and UI patterns that have been replaced or removed from Flow Stach.

---

## Active Routes (Current State)

Flow Stach currently supports **only** these routes:

### Public
- `/explore` - Marketplace/store (templates, components, tools)
- `/sign-in` - Authentication (Clerk)
- `/sign-up` - User registration (Clerk)

### Authenticated Workspace
- `/workspace/projects` - User's imported projects
- `/workspace/projects/[id]` - Project detail view
- `/workspace/import` - HTML import wizard
- `/workspace/library` - Purchased templates
- `/workspace/components` - Purchased components

**Everything else is deprecated or a redirect.**

---

## Deprecated Routes

### 1. `/` (Root/Home Page)

**Status:** Redirects to `/explore`

**Old Purpose:**
- Landing page with marketing copy
- Feature highlights
- CTA to sign up or explore

**Why Deprecated:**
- Redundant with `/explore`
- User wants store-first experience
- No need for separate landing page

**Current Behavior:**
```tsx
// app/page.tsx
export default function Page() {
  redirect("/explore");
}
```

**Migration:** All traffic now goes directly to the marketplace.

---

### 2. `/assets`

**Status:** Redirects to `/workspace/projects`

**Old Purpose:**
- Gallery view of user's imported assets
- Was the old "home page" for authenticated users
- Mixed user imports with marketplace items (confused UX)

**Why Deprecated:**
- Ambiguous name ("assets" could mean user imports OR marketplace items)
- Replaced by clearer workspace structure
- `/workspace/projects` now handles user imports
- `/explore` handles marketplace browsing

**Current Behavior:**
```tsx
// app/assets/page.tsx
export default function AssetsPage() {
  redirect("/workspace/projects")
}
```

**Migration:**
- Old bookmarks redirect to workspace
- Database still uses `assets` table for marketplace items (NOT user imports)
- User imports now in `importProjects` table

---

### 3. `/admin/import`

**Status:** Deprecated, replaced by `/workspace/import`

**Old Purpose:**
- Full-featured HTML import wizard (2,075 lines)
- Admin-only tool for converting HTML → Webflow JSON
- Step-by-step extraction: tokens, CSS, HTML, JS
- Component breakdown and Webflow clipboard integration

**Why Deprecated:**
- "Admin" namespace implied restricted access
- Import tool should be available to all authenticated users
- Moved to user-space under `/workspace/import`

**Current Status:**
- ✅ **DELETED** on 2026-01-24 (file removed: `app/admin/import/page.tsx`)
- No redirect in place (404 if accessed)
- New implementation at `/workspace/import` verified and working

**Migration:**
- ✅ All import functionality moved to `/workspace/import`
- New import wizard uses `lib/project-engine.ts` for processing
- Users now access import via workspace navigation

---

### 4. `/admin/*` (Other Admin Routes)

**Status:** Unknown, likely deprecated

**Old Purpose:**
- Admin dashboard
- Asset management
- User management (?)

**Why Deprecated:**
- Admin tools should be in dedicated admin namespace OR user workspace
- Most functionality moved to `/workspace/*`

**Current Status:**
- SYSTEM_MANIFEST lists this as deprecated
- No other admin routes found in current codebase
- Likely cleaned up already

---

## Deprecated UI Patterns

### 1. Global Assets Gallery (Old `/assets`)

**What it was:**
- Single page showing all "assets" (user imports + marketplace)
- No clear separation between user content and store content
- Confusing navigation

**Replaced by:**
- `/explore` - Marketplace only
- `/workspace/projects` - User imports only
- Clear separation of concerns

---

### 2. Admin Import Wizard (Old `/admin/import`)

**What it was:**
- Massive 2,075-line React component
- Step-by-step HTML breakdown
- Tabs for Tokens, CSS, HTML, JS
- Direct Webflow clipboard integration
- Flow-Goodies extension integration

**Replaced by:**
- New `/workspace/import` wizard (location TBD)
- Should maintain feature parity with old wizard
- User-accessible (not admin-only)

**Key Features to Preserve:**
- HTML parsing and normalization
- Token extraction
- CSS routing (native vs embed)
- Component detection
- Webflow JSON generation
- Flow-Goodies backend integration
- Multi-output system (baked vs stripped styles)

---

## Database Schema Changes

### Old Pattern (Deprecated)
- `assets` table contained BOTH user imports AND marketplace items
- Confusing ownership model
- Hard to distinguish user content from store content

### New Pattern (Current)
- `importProjects` - User's imported HTML projects
- `importArtifacts` - Shredded parts of imports (tokens, CSS, HTML, JS)
- `assets` - Marketplace components (premium, for sale)
- `templates` - Marketplace templates (premium, full-page layouts)
- `payloads` - Webflow JSON for marketplace items

**Migration:**
- Any old "assets" that were user imports should be in `importProjects`
- Marketplace items stay in `assets`

---

## Files to Delete (After Verification)

Once the new workspace routes are confirmed working:

1. `app/admin/import/page.tsx` - Old import wizard (2,075 lines)
2. Any other files in `app/admin/*` (if they exist)
3. Old asset gallery components (if found in `components/assets/`)

**Before deletion:**
- Verify `/workspace/import` has feature parity
- Check for any references in other files
- Archive this document for reference

---

## Redirect Summary

| Old Route | New Route | Status |
|-----------|-----------|--------|
| `/` | `/explore` | ✅ Redirects |
| `/assets` | `/workspace/projects` | ✅ Redirects |
| `/admin/import` | `/workspace/import` | ⚠️ No redirect (404) |
| `/admin/*` | N/A | ⚠️ Unknown state |

---

## Navigation Changes

### Old Sidebar (Deprecated)
- "Assets" - Mixed user imports and marketplace
- "Import" - Direct link to import tool

### New Sidebar (Current)
- "Projects" - User imports only
- "Templates" - Purchased templates
- "Components" - Purchased components
- No "Import" link (accessed via button in Projects dashboard)

### Old Header (Deprecated)
- "Home" - Went to landing page
- "Assets" - Went to mixed gallery
- "Import" - Direct link

### New Header (Current)
- "Workspace" - Goes to `/workspace/projects`
- "Import" - Goes to `/workspace/import`
- "Explore" - Goes to `/explore`

---

## Cleanup Status (2026-01-24)

- [x] ✅ Deleted `app/admin/import/page.tsx` (replaced by `/workspace/import`)
- [x] ✅ Deleted all `AGENTS.md` files (root, app/, components/, convex/, hooks/, lib/)
- [x] ✅ Archived `docs/html-breakdown-process.md` (referenced old `/admin/import`)
- [x] ✅ Created `docs/archive/DEPRECATED_ROUTES.md` (this file)
- [x] ✅ Updated `SYSTEM_MANIFEST.md` with current routing
- [ ] Consider adding redirects for `/admin/import` → `/workspace/import`
- [ ] Audit other docs in `/docs` for outdated route references

**What Remains in `/admin/*`:**
- `/admin/import-react` - React/JSX to HTML converter (different tool, kept)
- `/admin/seed` - Database seeding utility (admin tool, kept)

---

## Historical Context

**Why the routes changed:**
- Original structure mixed marketplace and user content
- "Assets" was ambiguous (user imports vs. store items)
- Admin namespace was restrictive
- User wanted clear separation: Explore (store) vs. Workspace (user content)

**Timeline:**
- Pre-2026: `/assets` was main user page
- Jan 2026: Workspace structure introduced
- Jan 2026: Redirects added for old routes
- Current: Transition period (old files exist but unused)

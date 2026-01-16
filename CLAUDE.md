# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flow Stach is a Webflow component library application. Users can browse, search, and copy reusable Webflow components (assets) that include both Webflow JSON payloads and JavaScript code.

**Key Features:**
- Browse/search component library with category filtering
- Copy Webflow JSON payloads directly to clipboard (paste into Webflow Designer)
- Copy code snippets (HTML/CSS/JS) for manual integration
- Import AI-generated HTML and auto-convert to Webflow-ready assets
- Import React components and convert to plain HTML + CSS + JS
- Design token extraction and management
- Favorites system for bookmarking assets

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
- **Sidebar** (240px): Navigation, dynamic category filters (from database), theme toggle
- **Main**: Asset grid or asset detail view
- **Context Panel** (280px): Contextual info, only visible on large screens

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Redirects to `/assets` |
| `/assets` | Asset grid with search and category filtering |
| `/assets/[slug]` | Asset detail with copy actions |
| `/admin/seed` | Seed demo assets (admin only) |
| `/admin/import` | Import HTML sections (admin only) |
| `/admin/import-react` | Import React components (admin only) |
| `/sign-in`, `/sign-up` | Clerk auth pages |
| `/extension` | Browser extension info |
| `/flow-bridge` | Flow Bridge feature page |

### API Routes (app/api/)

| Route | Purpose |
|-------|---------|
| `/api/webflow/convert` | LLM-powered HTML→Webflow JSON conversion |

### Database Schema (convex/schema.ts)

| Table | Purpose |
|-------|---------|
| `users` | Clerk user sync, role-based access (user/admin) |
| `assets` | Component metadata (slug, title, category, tags, status, capability flags) |
| `payloads` | Webflow JSON + code for each asset |
| `favorites` | User bookmarks |

**Asset capability flags:**
- `pasteReliability`: `"full"` | `"partial"` | `"none"` - How well Webflow paste works
- `supportsCodeCopy`: Boolean - Whether code copy is available
- `capabilityNotes`: String - Human-readable capability notes

### Auth Pattern (convex/auth.ts)

All Convex queries/mutations use auth helpers:
- `getCurrentUser(ctx)` - Returns user or null
- `requireAuth(ctx)` - Throws if unauthenticated
- `requireAdmin(ctx)` - Throws if not admin role

**Disable auth for testing:**
Set `NEXT_PUBLIC_DISABLE_AUTH=true` in `.env.local` to bypass Clerk authentication. The middleware (`middleware.ts`) checks this flag.

### Data Flow for Assets

1. User views `/assets` - calls `api.assets.list` query
2. User clicks asset - navigates to `/assets/[slug]`
3. Detail page calls `api.assets.bySlug` + `api.payloads.byAssetId`
4. User copies Webflow JSON or code payload

## Key Libraries (lib/)

| File | Purpose |
|------|---------|
| `utils.ts` | Tailwind `cn()` helper |
| `clipboard.ts` | Clipboard operations, Webflow MIME type handling |
| `html-parser.ts` | Parse HTML into sections, extract CSS per section |
| `token-extractor.ts` | Extract design tokens from CSS `:root` variables |
| `webflow-converter.ts` | Convert HTML/CSS to Webflow JSON format |
| `jsx-parser.ts` | Parse React components, detect imports and dependencies |
| `jsx-to-html.ts` | Convert JSX to plain HTML + vanilla JavaScript |
| `fakeAssets.ts` | Demo asset data for seeding |
| `favorites.ts` | Favorites localStorage utilities |

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

### Webflow Clipboard
The app uses a special MIME type for Webflow paste:
```tsx
import { copyToWebflowClipboard, copyCodeToClipboard } from "@/lib/clipboard"

// Copy Webflow JSON (pastes into Webflow Designer)
await copyToWebflowClipboard(webflowJson)

// Copy code snippet
await copyCodeToClipboard(codePayload)
```

## Environment Variables

Required in `.env.local`:
```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Convex Database
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud

# Admin Access (comma-separated list of admin emails)
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com

# Optional: Disable auth for testing
NEXT_PUBLIC_DISABLE_AUTH=true

# Optional: LLM conversion (OpenRouter)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4.1
```

## Admin Features

- `/admin/seed` - Seeds demo assets (requires admin role in Convex)
- `/admin/import` - Import AI-generated HTML:
  - Parse HTML into sections automatically
  - Extract design tokens from `:root` CSS variables
  - Generate Webflow JSON payloads (fallback or LLM-powered)
  - Bulk create/update assets in database
- `/admin/import-react` - Import React components:
  - Paste React source code and detect imports
  - Request missing dependency files from user
  - Convert JSX to plain HTML + vanilla JS
  - Download as standalone HTML file
- Admin access controlled by `NEXT_PUBLIC_ADMIN_EMAILS` env var

## HTML Import Workflow

1. Paste AI-generated HTML (from Claude, ChatGPT, etc.) into `/admin/import`
2. Configure options (strip base styles, merge navigation, etc.)
3. Click "Parse HTML" to preview detected sections
4. Select sections to import
5. Click "Import" to create assets with:
   - Code payload (HTML + CSS for the section)
   - Webflow JSON (if conversion succeeds)
   - Design token dependencies

See `docs/html-breakdown-process.md` for detailed documentation.

## React Import Workflow

Convert React components to plain HTML + CSS + JavaScript at `/admin/import-react`:

1. **Paste Code**: Paste your React component source code (.jsx/.tsx)
2. **Add Dependencies**: Parser detects imports and asks for missing local files
   - Provide each missing component or CSS file
   - Library imports (react, framer-motion, etc.) are automatically ignored
3. **Convert**: Transforms JSX to plain HTML with:
   - `className` → `class` attribute conversion
   - Component references resolved to their HTML output
   - Event handlers (onClick, onChange) → vanilla JS addEventListener
   - React patterns detected with conversion warnings
4. **Result**: Copy HTML, CSS, or JS separately, or download as complete HTML file

**Supported conversions:**
- JSX syntax → HTML
- CSS imports → combined stylesheet
- onClick/onChange → addEventListener
- useRef → document.querySelector (with warnings)
- useEffect → DOMContentLoaded (with warnings)

**Not automatically converted (warnings shown):**
- useState (stateful logic)
- useContext (context dependencies)
- Complex expressions in JSX

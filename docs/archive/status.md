# Flow Stach — Project Status

Last updated: January 2026

## Shipped / Merged

### Core Infrastructure
- Next.js 16 (Bun) + shadcn UI scaffold
- Clerk auth + Convex plumbing
- ThemeProvider (next-themes) with dark/light modes
- Auth indicator (UserButton / sign out)

### Vault UI
- `/assets` browse (search + category filter)
- `/assets/[slug]` detail (tabs + context panel)
- Dynamic sidebar with categories from database
- Skeleton loading + improved empty states
- `/` redirects to `/assets`

### Clipboard Actions
- Copy Code (HTML/CSS/JS snippet)
- Copy to Webflow (Webflow-specific MIME type + fallback + toasts)
- See `docs/features/clipboard.md`

### Admin Tools
- `/admin/seed` - Seed demo assets (admin role required)
- `/admin/import` - HTML Import Tool:
  - Parse AI-generated HTML into sections
  - Extract design tokens from `:root` variables
  - Generate Webflow JSON (fallback converter + optional LLM)
  - Bulk import sections to Convex
  - Options: strip base styles, merge navigation, combine header+hero
  - See `docs/html-breakdown-process.md`

### Database
- Full schema with capability flags (pasteReliability, supportsCodeCopy, capabilityNotes)
- Assets + Payloads + Favorites + Users tables
- Indexes for efficient querying

### API Routes
- `/api/webflow/convert` - LLM-powered HTML→Webflow JSON conversion (OpenRouter)

### Libraries
- `lib/clipboard.ts` - Webflow MIME type handling
- `lib/html-parser.ts` - Section detection + CSS extraction
- `lib/token-extractor.ts` - Design token extraction
- `lib/webflow-converter.ts` - HTML/CSS to Webflow JSON conversion

### Hero Assets
- Magnetic cursor Webflow JSON + JS payload
- See `docs/assets/magnetic-cursor-effect.md`

## In Progress

- Browser extension (`flow-stach-extension/`)
- Flow Bridge feature (`/flow-bridge`)

## Backlog

1. **Convert more CodePens into real assets**
   - See `docs/research/codepen-candidates-v1.md`

2. **Improve Webflow JSON conversion accuracy**
   - LLM conversion is optional, needs refinement
   - Fallback converter handles basic cases

3. **Asset preview images/videos**
   - Schema supports `previewImageUrl` and `previewVideoUrl`
   - Not yet populated

4. **Favorites backend**
   - Currently localStorage only
   - Convex favorites table exists but not connected to UI

## Known Issues

1. **LLM conversion reliability**
   - Some complex sections fail LLM conversion
   - Falls back to basic converter

2. **Webflow paste compatibility**
   - `pasteReliability` flag indicates how well assets paste
   - Some assets require manual adjustment after paste

## Environment Requirements

```bash
# Required
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_CONVEX_URL
NEXT_PUBLIC_ADMIN_EMAILS

# Optional
NEXT_PUBLIC_DISABLE_AUTH=true  # Bypass auth for testing
OPENROUTER_API_KEY             # For LLM conversion
OPENROUTER_MODEL               # Default: openai/gpt-4.1
```

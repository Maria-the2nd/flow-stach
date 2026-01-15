# Flow Stach

A Webflow component library application for browsing, managing, and copying reusable Webflow components.

## Features

- **Browse Components** - Search and filter through a library of Webflow-ready assets
- **Copy to Webflow** - One-click copy Webflow JSON payloads directly into Webflow Designer
- **Code Snippets** - Copy HTML/CSS/JS code for manual integration
- **Design Tokens** - Extracted and managed design system variables
- **HTML Import** - Convert AI-generated HTML into Webflow-ready components
- **Favorites** - Bookmark frequently used components

## Extensions

Flow Stach integrates with Webflow via two distinct avenues. Understanding their differences clarifies what you can test today and where to find things in Webflow Designer.

### Apps Panel Location
- In Webflow Designer, open the **Apps** panel via the **plug icon** in the left sidebar or press **E**
- Webflow merged “Extensions”, “Apps”, and “Designer integrations” into a single Apps panel; the old “Extensions” label may not appear

### App Types
- **Data Clients (public, fully testable)**: Server-side/external apps using the Webflow REST API with tokens or OAuth. You can generate an API token and start testing immediately by calling the Data API from a local tool or server.
- **Designer Extensions (private beta)**: UI panels inside Designer (clipboard listeners, DOM/style injection, variable creation, “Install component” workflows). Without Designer Extensions access in your workspace, there’s no official way to load/test a custom Designer app locally.

### Recommended Hybrid Approach
- Build a testable **Data Client** for CMS/data workflows
- Use an **external installer** (web app/local app/Chrome extension) to generate the canonical payload and create variables/styles/CMS/symbols via APIs, avoiding Designer paste warnings
- Later, replace the external UI with a **Designer Extension** while keeping the same core logic

## Chrome Extension

The Flow Stach Chrome extension bridges browser clipboard limitations by writing `application/json` directly to the system clipboard so Webflow Designer can read it.

### Detection and Fallback
- The web app detects the extension via a `data-flowstach-extension="true"` attribute set on the document by the content script
- On copy:
  - If the extension is present, the app dispatches a `flowstach-copy` custom event containing the JSON payload
  - The extension writes the JSON to the native clipboard and returns a `flowstach-copy-result` event confirming success
  - If the extension is not present, the app uses standard web clipboard APIs as a fallback

### Install (Developer Mode)
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `flow-stach-extension` folder

### Troubleshooting
- Refresh Flow Stach after installing the extension
- Click on the Webflow Designer canvas (not inside text) before pasting
- Verify paste by testing in a text editor if needed

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Runtime**: [Bun](https://bun.sh/)
- **Database**: [Convex](https://convex.dev/)
- **Auth**: [Clerk](https://clerk.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [HugeIcons](https://hugeicons.com/)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed
- [Convex](https://convex.dev/) account
- [Clerk](https://clerk.dev/) account

### Installation

```bash
# Clone the repository
git clone https://github.com/Maria-the2nd/flow-stach.git
cd flow-stach

# Install dependencies
bun install

# Copy environment variables
cp .env.local.example .env.local
# Edit .env.local with your keys
```

### Environment Variables

Create a `.env.local` file with:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Convex Database
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud

# Admin Access (comma-separated emails)
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com

# Optional: Disable auth for local testing
# NEXT_PUBLIC_DISABLE_AUTH=true

# Optional: LLM-powered Webflow conversion
# OPENROUTER_API_KEY=sk-or-...
# OPENROUTER_MODEL=openai/gpt-4.1

# Optional: Flow Bridge semantic repair pass (LLM patching)
# USE_LLM=1
# OPENROUTER_API_KEY=sk-or-...
# OPENROUTER_MODEL=anthropic/claude-sonnet-4.0
# FLOWBRIDGE_LLM_DEBUG=1  # Writes request/response payloads to /tmp/flowbridge-llm-debug
# FLOWBRIDGE_STRICT_LLM=1 # Fail fast on missing key or invalid LLM response
# NEXT_PUBLIC_FLOWBRIDGE_STRICT_LLM=1 # Fail fast on unresolved CSS variables during import
# FLOWBRIDGE_LLM_MOCK=1  # Use deterministic mock patch response
# NEXT_PUBLIC_FLOWBRIDGE_FORCE_LLM=1 # Force the semantic pass even if heuristics find no issues
```

### Development

```bash
# Start dev server (Convex + Next.js)
bun run dev

# Or run separately
bun run convex:dev  # In terminal 1
bun run next dev    # In terminal 2
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Project Structure

```
flow-stach/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth pages (sign-in, sign-up)
│   ├── admin/             # Admin pages (seed, import)
│   ├── api/               # API routes
│   ├── assets/            # Asset browse and detail pages
│   └── layout.tsx         # Root layout with providers
├── components/            # React components
│   ├── admin/             # Admin-specific components
│   ├── asset-detail/      # Asset detail view
│   ├── assets/            # Asset grid and cards
│   ├── layout/            # AppShell, sidebar
│   └── ui/                # shadcn/ui components
├── convex/                # Convex backend
│   ├── schema.ts          # Database schema
│   ├── assets.ts          # Asset queries/mutations
│   ├── payloads.ts        # Payload queries
│   ├── users.ts           # User management
│   ├── favorites.ts       # Favorites mutations
│   ├── import.ts          # HTML import mutations
│   └── auth.ts            # Auth helpers
├── lib/                   # Utility libraries
│   ├── clipboard.ts       # Webflow clipboard handling
│   ├── html-parser.ts     # HTML section parser
│   ├── token-extractor.ts # Design token extraction
│   └── webflow-converter.ts # HTML to Webflow JSON
├── hooks/                 # Custom React hooks
└── docs/                  # Project documentation
```

## Commands

```bash
bun run dev           # Start development server
bun run build         # Production build
bun run start         # Start production server
bun run typecheck     # TypeScript validation
bun run lint          # ESLint check
bun run convex:dev    # Start Convex backend
bun run convex:deploy # Deploy Convex to production
```

## Admin Features

Access admin features at:
- `/admin/seed` - Seed demo assets
- `/admin/import` - Import AI-generated HTML

Admin access is controlled by the `NEXT_PUBLIC_ADMIN_EMAILS` environment variable.

## Documentation

- `CLAUDE.md` - AI assistant guidance for this codebase
- `AGENTS.md` - AI agent navigation guide
- `docs/` - Feature specifications and guides

## License

Private project.

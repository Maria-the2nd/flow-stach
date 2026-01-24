# Flow Stach Runbook

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

### Clerk Authentication

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

**How to get Clerk keys:**
1. Create an account at [clerk.com](https://clerk.com)
2. Create a new application
3. Go to API Keys in the dashboard
4. Copy the Publishable Key and Secret Key

### Convex

```env
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
```

**How to get Convex URL:**
1. Run `bunx convex dev` in the project root
2. Follow the prompts to create a new project or link an existing one
3. The URL will be automatically added to `.env.local`

### Admin Access

```env
NEXT_PUBLIC_ADMIN_EMAILS=your-email@example.com,another-admin@example.com
```

Only users whose Clerk email matches an entry in this list can access admin features (`/admin/seed`, `/admin/import`).

### Optional: Disable Auth for Testing

```env
NEXT_PUBLIC_DISABLE_AUTH=true
```

Set this to bypass Clerk authentication entirely during local development.

### Optional: LLM Conversion (OpenRouter)

```env
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4.1
```

Required for LLM-powered HTML to Webflow JSON conversion in the import tool.

**How to get OpenRouter keys:**
1. Create an account at [openrouter.ai](https://openrouter.ai)
2. Go to API Keys in the dashboard
3. Create a new key and copy it

## Development

### Start the development server

```bash
# Recommended: Start both Next.js and Convex concurrently
bun run dev

# Or run separately in two terminals:
# Terminal 1
bunx convex dev

# Terminal 2
bun run next dev
```

### Build for production

```bash
bun run build
```

### Type checking

**Important:** You must run `bunx convex dev` at least once before type checking will pass. This generates the types in `convex/_generated/`.

```bash
# First time setup (generates convex/_generated/)
bunx convex dev

# Then run typecheck
bun run typecheck
```

## Protected Routes

The following routes require authentication:
- `/assets` - Asset browse page
- `/assets/*` - Asset detail pages

Unauthenticated users will be redirected to `/sign-in`.

## Convex Schema

The Convex schema is defined in `convex/schema.ts`. After modifying the schema:

1. Run `bunx convex dev` to sync changes
2. Types will be auto-generated in `convex/_generated/`

## How to Seed Demo Data

The database can be seeded with 18 demo assets for testing and development. This is useful for new environments or when you need sample data.

### Prerequisites

1. **Set the admin allowlist** - Add your email to the `NEXT_PUBLIC_ADMIN_EMAILS` environment variable:

```env
# In .env.local
NEXT_PUBLIC_ADMIN_EMAILS=your-email@example.com,another-admin@example.com
```

Multiple emails can be comma-separated. Only users whose Clerk email matches an entry in this list can seed data.

2. **Sign in** - You must be authenticated with Clerk using an allowed email address.

### Seeding Steps

1. Start the development servers:
   ```bash
   # Terminal 1
   bun dev

   # Terminal 2
   bunx convex dev
   ```

2. Navigate to the seed page:
   ```
   http://localhost:3000/admin/seed
   ```

3. Click the **"Seed Demo Data"** button.

4. On success, you'll see a confirmation with the number of assets created. Click the link to view them at `/assets`.

### Notes

- The seed operation is idempotent - existing assets (by slug) are skipped.
- If all 18 demo assets already exist, you'll see "No new assets to seed."
- The mutation requires admin privileges in Convex (user must have `role: "admin"` in the database).

## How to Import AI-Generated HTML

The HTML Import tool at `/admin/import` converts AI-generated HTML (from Claude, ChatGPT, etc.) into Webflow-ready assets.

### Prerequisites

1. **Admin access** - Your email must be in `NEXT_PUBLIC_ADMIN_EMAILS`
2. **Sign in** - You must be authenticated with Clerk
3. **Optional: LLM API key** - For better Webflow JSON conversion, set `OPENROUTER_API_KEY`

### Import Steps

1. Navigate to the import page:
   ```
   http://localhost:3000/admin/import
   ```

2. Enter a **Design System Name** (e.g., "My Landing Page")

3. **Paste HTML** or upload a `.html` file

4. Configure options:
   - **Strip base styles**: Remove `:root`, reset, `body` styles from sections
   - **Merge navigation**: Combine mobile menu + main nav into one section
   - **Combine header+hero**: Create a single Header asset with nav and hero
   - **Use Flow Party map**: Use predefined slugs for Flow Party templates
   - **Always create new**: Create new assets instead of updating existing
   - **Use LLM conversion**: Use OpenRouter API for better Webflow JSON (requires API key)

5. Click **"Parse HTML"** to preview detected sections

6. Select which sections to import

7. Click **"Import"** to create assets

### What Gets Created

For each imported HTML file:
- **Token asset**: `{slug}-tokens` with extracted design variables
- **Section assets**: One asset per HTML section with:
  - Code payload (HTML + CSS for manual use)
  - Webflow JSON (for paste into Webflow Designer)
  - Token dependencies

### Troubleshooting

- **No sections detected**: Ensure HTML contains `<section>`, `<nav>`, or `<footer>` tags
- **LLM conversion failed**: Check console for errors, falls back to basic converter
- **Assets not appearing**: Check if categories exist in sidebar, try refreshing

See `docs/html-breakdown-process.md` for detailed documentation on the conversion process.

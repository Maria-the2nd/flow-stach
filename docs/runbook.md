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

## Development

### Start the development server

```bash
# Start Next.js
bun dev

# In a separate terminal, start Convex
bunx convex dev
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

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

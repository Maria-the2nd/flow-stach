# Phase 1: Authentication & Database Plumbing

## Overview

This phase establishes the authentication and database infrastructure for Flow Stach using Clerk (auth) and Convex (database).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Next.js App                         │
├─────────────────────────────────────────────────────────┤
│  ClerkProvider (auth state)                              │
│    └── ConvexClientProvider (database client)            │
│          └── App Components                              │
└─────────────────────────────────────────────────────────┘
              │                         │
              ▼                         ▼
        ┌──────────┐             ┌──────────────┐
        │  Clerk   │             │   Convex     │
        │ (Auth)   │             │  (Database)  │
        └──────────┘             └──────────────┘
```

## Authentication Flow

### Sign In
1. User navigates to a protected route (`/assets`, `/assets/*`)
2. Middleware (`middleware.ts`) intercepts the request
3. `clerkMiddleware` checks for valid session
4. If unauthenticated, user is redirected to `/sign-in`
5. User authenticates via Clerk's hosted UI
6. On success, user is redirected to original destination

### Sign Up
1. New users can navigate to `/sign-up`
2. Complete registration through Clerk's hosted UI
3. User is redirected to the app after successful registration

### Protected Routes
Protected routes are defined in `middleware.ts` using `createRouteMatcher`:

```typescript
const isProtectedRoute = createRouteMatcher(["/assets(.*)"]);
```

## Convex Connection

### Client Setup
The Convex client is initialized in `app/providers/ConvexClientProvider.tsx`:

```typescript
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
```

### Usage in Components
Components can use Convex hooks to query/mutate data:

```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

function MyComponent() {
  const data = useQuery(api.myTable.list);
  const create = useMutation(api.myTable.create);
  // ...
}
```

## File Structure

```
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── providers/
│   │   └── ConvexClientProvider.tsx
│   └── (auth)/
│       ├── sign-in/
│       │   └── [[...sign-in]]/
│       │       └── page.tsx
│       └── sign-up/
│           └── [[...sign-up]]/
│               └── page.tsx
├── convex/
│   ├── tsconfig.json
│   ├── schema.ts               # (to be implemented)
│   └── _generated/             # Auto-generated types
├── middleware.ts               # Route protection
└── .env.local                  # Environment variables
```

## Next Steps

1. **Intern task**: Implement Convex schema in `convex/schema.ts`
2. Create Convex functions for CRUD operations
3. Connect UI components to Convex queries/mutations
4. Add user-specific data filtering

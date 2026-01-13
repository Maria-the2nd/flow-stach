# AGENTS.md — Hooks

Custom React hooks for shared stateful logic.

## Stack

- **Framework**: React 19
- **Language**: TypeScript
- **Key dependencies**: Convex React, Clerk React

## File Organization

```
hooks/
└── useEnsureUser.ts    # Ensures user exists in Convex after Clerk auth
```

## Patterns & Conventions

### Hook Naming

- ✅ DO: Prefix all hooks with `use` (e.g., `useEnsureUser`)
- ✅ DO: Use descriptive names that indicate purpose
- ✅ DO: One hook per file

### Hook Structure

```typescript
// Standard hook pattern
import { useEffect, useState } from "react";

export function useMyHook(param: string) {
  const [state, setState] = useState<Type | null>(null);

  useEffect(() => {
    // Effect logic
  }, [param]);

  return { state, /* other values */ };
}
```

### Convex Hooks

- ✅ DO: Use `useQuery()` from `convex/react` for data fetching
- ✅ DO: Use `useMutation()` for write operations
- ✅ DO: Handle loading/error states

```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useAssets() {
  const assets = useQuery(api.assets.list);
  const createAsset = useMutation(api.assets.create);

  return { assets, createAsset, isLoading: assets === undefined };
}
```

### Clerk + Convex Pattern

See `useEnsureUser.ts` for the pattern of syncing Clerk auth with Convex:

- ✅ DO: Use `useUser()` from Clerk for auth state
- ✅ DO: Sync user data to Convex on first sign-in
- ✅ DO: Handle the async initialization gracefully

## Key Files

| File | Purpose |
|------|---------|
| `useEnsureUser.ts` | Syncs Clerk user to Convex database |

## JIT Index

```bash
# Find all hooks
rg -n "export (function|const) use" hooks/

# Find hook usage
rg -n "useEnsureUser|useQuery|useMutation" app/ components/

# Find Convex hook patterns
rg -n "useQuery\(api\." components/ app/
```

## Common Gotchas

1. **Convex loading state**: `useQuery` returns `undefined` while loading, not `null`
2. **Hook rules**: Hooks must be called unconditionally at the top of components
3. **Clerk dependency**: Auth hooks require being inside `<ClerkProvider>`
4. **Convex dependency**: Data hooks require being inside `<ConvexProvider>`

## Pre-PR Checklist

```bash
bun run typecheck && bun run lint
```

Verify:
- [ ] Hook follows React rules of hooks
- [ ] Loading states handled
- [ ] No infinite loops in useEffect
- [ ] Dependencies array is correct

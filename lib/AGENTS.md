# AGENTS.md — Lib (Utilities)

Utility functions, helpers, and shared logic.

## Stack

- **Language**: TypeScript
- **Key dependencies**: clsx, tailwind-merge

## File Organization

```
lib/
├── utils.ts            # Core utilities (cn, etc.)
├── clipboard.ts        # Clipboard operations
├── favorites.ts        # Favorites logic helpers
└── fakeAssets.ts       # Seed/mock data for development
```

## Patterns & Conventions

### The `cn()` Utility

The most important utility — used everywhere for Tailwind class merging:

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- ✅ DO: Use `cn()` for conditional/merged classes
- ✅ DO: Import from `@/lib/utils`
- ❌ DON'T: Use template literals for conditional classes
- ❌ DON'T: Import clsx/twMerge directly in components

### Adding New Utilities

- ✅ DO: Add general utilities to `utils.ts`
- ✅ DO: Create separate files for domain-specific logic (e.g., `clipboard.ts`)
- ✅ DO: Export from index if creating a barrel
- ❌ DON'T: Put React hooks in `lib/` — they go in `hooks/`
- ❌ DON'T: Put API/data fetching here — use Convex functions

### Utility Structure

- ✅ DO: Use pure functions where possible
- ✅ DO: Add JSDoc comments for non-obvious utilities
- ✅ DO: Export types alongside functions when needed

## Key Files

| File | Purpose |
|------|---------|
| `utils.ts` | `cn()` class merging utility |
| `clipboard.ts` | Copy-to-clipboard helpers |
| `favorites.ts` | Favorites state/logic helpers |
| `fakeAssets.ts` | Mock data for development/seeding |

## JIT Index

```bash
# Find all exports
rg -n "export (function|const|type)" lib/

# Find cn usage across codebase
rg -n "cn\(" components/ app/

# Find utility imports
rg -n "from.*@/lib" app/ components/
```

## Common Gotchas

1. **cn() import path**: Always `@/lib/utils`, not relative paths
2. **Pure functions**: Utilities should not have side effects
3. **No React**: Hooks belong in `hooks/`, not `lib/`

## Pre-PR Checklist

```bash
bun run typecheck && bun run lint
```

Verify:
- [ ] Utility functions are pure (no side effects)
- [ ] Types are exported where needed
- [ ] No React dependencies in utility files

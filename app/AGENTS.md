# AGENTS.md — App Directory

Next.js App Router pages, layouts, and route groups.

## Stack

- **Framework**: Next.js 16 (App Router, React Server Components)
- **Language**: TypeScript
- **Key dependencies**: Clerk (auth), next-themes (theming)

## File Organization

```
app/
├── (auth)/                 # Route group for auth pages (no layout impact)
│   ├── sign-in/[[...sign-in]]/page.tsx
│   └── sign-up/[[...sign-up]]/page.tsx
├── admin/                  # Admin utilities
│   └── page.tsx            # Seed data page
├── assets/                 # Asset browsing feature
│   ├── page.tsx            # List view
│   ├── [slug]/page.tsx     # Detail view (dynamic route)
│   └── layout.tsx          # Assets-specific layout
├── providers/              # Root-level context providers
│   ├── ConvexClientProvider.tsx
│   └── ThemeProvider.tsx
├── layout.tsx              # Root layout (providers tree)
├── page.tsx                # Home page
└── globals.css             # Global styles & Tailwind
```

## Patterns & Conventions

### Page Structure

- ✅ DO: Use `page.tsx` for route entry points like `app/assets/page.tsx`
- ✅ DO: Use `layout.tsx` for shared layouts like `app/assets/layout.tsx`
- ✅ DO: Use route groups `(name)/` when you need different layouts without URL impact
- ❌ DON'T: Put components in `app/` — they go in `components/`

### Server vs Client Components

- ✅ DO: Keep pages as Server Components by default
- ✅ DO: Add `"use client"` only when needed (hooks, interactivity)
- ✅ DO: See `app/providers/ConvexClientProvider.tsx` for client component pattern
- ❌ DON'T: Add `"use client"` to pages unless absolutely necessary

### Dynamic Routes

- ✅ DO: Use `[param]` folders for dynamic segments like `app/assets/[slug]/page.tsx`
- ✅ DO: Use `[[...param]]` for optional catch-all like `app/(auth)/sign-in/[[...sign-in]]/`
- ✅ DO: Access params via `params` prop in page components

### Providers Pattern

Root layout wraps the app with providers in this order:
```
ClerkProvider → ThemeProvider → ConvexClientProvider → {children}
```

See `app/layout.tsx` for the exact implementation.

## Key Files

| File | Purpose |
|------|---------|
| `layout.tsx` | Root layout with providers tree |
| `page.tsx` | Home page |
| `globals.css` | Global styles, Tailwind directives, CSS variables |
| `providers/ConvexClientProvider.tsx` | Convex client setup with Clerk auth |
| `providers/ThemeProvider.tsx` | Theme context (light/dark mode) |
| `admin/import/page.tsx` | Webflow Import Wizard (Full Page/Component conversion) |
| `assets/layout.tsx` | Layout for assets pages |
| `assets/page.tsx` | Assets list page |
| `assets/[slug]/page.tsx` | Asset detail page |

## JIT Index

```bash
# Find all pages
rg -n "export default" app/ --glob "*/page.tsx"

# Find all layouts
rg -n "export default" app/ --glob "*/layout.tsx"

# Find client components
rg -n '"use client"' app/

# Find route groups
ls -d app/\(*\)/ 2>/dev/null || dir app /AD | findstr "("
```

## Common Gotchas

1. **Clerk routes**: Auth pages use optional catch-all `[[...sign-in]]` for Clerk's internal routing
2. **Protected routes**: `/assets` is protected by `middleware.ts` at the root
3. **Convex + Clerk**: `ConvexClientProvider` uses `useAuth` from Clerk for token sync
4. **CSS variables**: Theme colors defined in `globals.css` using CSS custom properties

## Pre-PR Checklist

```bash
bun run typecheck && bun run lint && bun run build
```

Verify:
- [ ] Pages render without errors
- [ ] Auth flow works (sign-in, sign-out)
- [ ] Protected routes redirect unauthenticated users

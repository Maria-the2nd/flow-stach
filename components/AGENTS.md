# AGENTS.md — Components

Reusable React components including shadcn/ui primitives and feature-specific components.

## Stack

- **Framework**: React 19 (functional components)
- **Language**: TypeScript
- **Key dependencies**: shadcn/ui, Radix UI, class-variance-authority (CVA), HugeIcons

## File Organization

```
components/
├── ui/                     # shadcn/ui base components (DO NOT modify heavily)
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   └── ... (15+ components)
├── asset-detail/           # Asset detail feature
│   ├── AssetDetailContext.tsx
│   └── AssetDetailLayout.tsx
├── assets/                 # Asset listing feature
│   ├── AssetCard.tsx
│   ├── AssetGrid.tsx
│   └── AssetFilters.tsx
├── auth/                   # Auth-related components
├── layout/                 # Layout shells
│   └── MainShell.tsx
├── sidebar/                # Navigation sidebar
│   ├── AppSidebar.tsx
│   └── SidebarNav.tsx
├── context/                # Context/detail panels
├── favorites/              # Favorites feature
└── component-example.tsx   # Template (reference only)
```

## Patterns & Conventions

### Component Structure

- ✅ DO: Use functional components with TypeScript like `components/ui/button.tsx`
- ✅ DO: Export components as named exports: `export function Button() {}`
- ✅ DO: Define props interfaces above the component
- ❌ DON'T: Use class components
- ❌ DON'T: Use default exports for components (except pages)

### shadcn/ui Components

- ✅ DO: Use existing UI components from `components/ui/` before creating new ones
- ✅ DO: Extend with CVA variants like `components/ui/button.tsx`
- ✅ DO: Add new shadcn components via CLI: `bunx shadcn@latest add [component]`
- ❌ DON'T: Heavily modify shadcn/ui internals (add variants instead)
- ❌ DON'T: Duplicate functionality that exists in `ui/`

### Styling

- ✅ DO: Use Tailwind classes for styling
- ✅ DO: Use `cn()` from `@/lib/utils` for conditional classes
- ✅ DO: Use CSS variables for theming (see `app/globals.css`)
- ❌ DON'T: Use inline styles or CSS modules
- ❌ DON'T: Hardcode colors — use Tailwind theme classes

### Icons

- ✅ DO: Use HugeIcons: `import { IconName } from "hugeicons-react"`
- ✅ DO: Size icons consistently with `size={20}` or Tailwind `className="size-5"`
- ❌ DON'T: Mix icon libraries

### Context Providers

- ✅ DO: Create context in dedicated files like `components/asset-detail/AssetDetailContext.tsx`
- ✅ DO: Export provider and hook together
- ✅ DO: Use the pattern from `components/favorites/FavoritesProvider.tsx`

## Key Files

| File | Purpose |
|------|---------|
| `ui/button.tsx` | Button with variants (CVA pattern example) |
| `ui/card.tsx` | Card container component |
| `ui/dialog.tsx` | Modal dialog component |
| `ui/input.tsx` | Form input component |
| `layout/MainShell.tsx` | Main layout wrapper with sidebar |
| `sidebar/AppSidebar.tsx` | Application navigation sidebar |
| `asset-detail/AssetDetailContext.tsx` | Asset detail state management |
| `assets/AssetCard.tsx` | Asset card for grid display |

## Design System

### Component Examples

| Pattern | Example File |
|---------|--------------|
| Button variants | `ui/button.tsx` |
| Form input | `ui/input.tsx` |
| Modal/Dialog | `ui/dialog.tsx` |
| Dropdown | `ui/dropdown-menu.tsx` |
| Card layout | `ui/card.tsx` |
| Context + Provider | `asset-detail/AssetDetailContext.tsx` |

### Usage Rules

- ✅ DO: Import UI components from `@/components/ui/button`
- ✅ DO: Use the `cn()` utility for merging classes
- ❌ DON'T: Create one-off components that duplicate UI primitives
- ❌ DON'T: Use arbitrary Tailwind values when design tokens exist

## JIT Index

```bash
# Find a component by name
rg -n "export (function|const)" components/ --glob "*.tsx"

# Find UI components
ls components/ui/

# Find all contexts/providers
rg -n "createContext|Provider" components/

# Find CVA variants
rg -n "cva\(" components/

# Find component imports
rg -n "from.*@/components" app/ components/
```

## Common Gotchas

1. **cn() utility**: Always import from `@/lib/utils`, not from class-variance-authority
2. **Radix components**: shadcn wraps Radix — check Radix docs for prop details
3. **Server/Client**: Most components need `"use client"` for interactivity
4. **Icon imports**: HugeIcons uses named exports: `import { Home01Icon } from "hugeicons-react"`

## Pre-PR Checklist

```bash
bun run typecheck && bun run lint && bun run build
```

Verify:
- [ ] Component renders correctly
- [ ] Responsive on mobile/desktop
- [ ] Dark mode works (if applicable)
- [ ] No console warnings about props

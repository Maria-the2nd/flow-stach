# AGENTS.md

flow-stach — AI agent guidance for this repository.

## Project Snapshot

- **Type**: Simple single Next.js application (not a monorepo)
- **Stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Convex (backend), Clerk (auth)
- **Package Manager**: Bun
- **Sub-packages**: See individual AGENTS.md files in `app/`, `components/`, `convex/`, `lib/`, `hooks/`

## Root Commands

```bash
bun install              # Install all dependencies
bun run dev              # Start dev server (Convex + Next.js concurrently)
bun run build            # Production build
bun run typecheck        # TypeScript validation
bun run lint             # ESLint check
bun run convex:dev       # Start Convex backend dev server
bun run convex:deploy    # Deploy Convex to production
```

## Universal Conventions

- **Code style**: TypeScript strict mode, ESLint (Next.js core-web-vitals)
- **Components**: Functional React components only (no class components)
- **Imports**: Use `@/` alias for absolute paths (e.g., `@/components/ui/button`)
- **Styling**: Tailwind CSS utilities with `cn()` helper for conditional classes
- **Commits**: Descriptive commit messages (no enforced format yet)

## Security & Secrets

- **NEVER** commit API keys, tokens, or secrets
- Environment variables go in `.env.local` (gitignored)
- See `.env.local.example` for required variables
- Clerk keys: `NEXT_PUBLIC_CLERK_*` and `CLERK_SECRET_KEY`
- Convex keys: `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL`

## JIT Index

### Directory Structure

| Directory | Purpose | AGENTS.md |
|-----------|---------|-----------|
| `app/` | Next.js App Router pages & layouts | [app/AGENTS.md](app/AGENTS.md) |
| `components/` | Reusable React components | [components/AGENTS.md](components/AGENTS.md) |
| `convex/` | Backend functions & database schema | [convex/AGENTS.md](convex/AGENTS.md) |
| `lib/` | Utility functions & helpers | [lib/AGENTS.md](lib/AGENTS.md) |
| `hooks/` | Custom React hooks | [hooks/AGENTS.md](hooks/AGENTS.md) |
| `docs/` | Project documentation | (no AGENTS.md) |
| `public/` | Static assets | (no AGENTS.md) |

### Quick Find Commands

```bash
# Find a React component
rg -n "export (function|const)" components/

# Find a Convex function (query/mutation)
rg -n "export const" convex/ --glob "*.ts" --glob "!_generated/*"

# Find a hook
rg -n "export (function|const) use" hooks/

# Find a page
rg -n "export default" app/ --glob "*/page.tsx"

# Find all UI components (shadcn)
ls components/ui/

# Find types/interfaces
rg -n "export (type|interface)" --type ts
```

## Tech Stack Reference

| Layer | Technology | Key Files |
|-------|------------|-----------|
| Frontend | Next.js 16 (App Router) | `app/layout.tsx`, `app/page.tsx` |
| UI Components | shadcn/ui + Radix | `components/ui/*` |
| Styling | Tailwind CSS 4 | `app/globals.css`, `tailwind.config.ts` |
| Backend | Convex | `convex/schema.ts`, `convex/*.ts` |
| Auth | Clerk | `middleware.ts`, `convex/auth.ts` |
| Icons | HugeIcons | Import from `hugeicons-react` |

## Definition of Done

Before any PR:

- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` passes
- [ ] No console errors in browser
- [ ] Convex functions work locally (`bun run convex:dev`)

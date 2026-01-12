# S1: App Shell

## Summary

Persistent 3-column app shell layout for Flow Stach. Provides consistent structure across all authenticated-style routes with sidebar navigation, main content area, and context panel.

## Checklist

- [x] Create `AppShell` component with 3-column CSS grid layout
- [x] Responsive: collapses to 2 columns on tablet, 1 column on mobile
- [x] Create `Sidebar` placeholder component
- [x] Create `ContextPanel` placeholder component
- [x] Create `/assets` route with AppShell
- [x] Create `/assets/[slug]` route with AppShell

## Files Changed

| File | Action |
|------|--------|
| `components/layout/AppShell.tsx` | Created |
| `components/sidebar/Sidebar.tsx` | Created |
| `components/context/ContextPanel.tsx` | Created |
| `app/assets/page.tsx` | Created |
| `app/assets/[slug]/page.tsx` | Created |
| `docs/ui/S1-app-shell.md` | Created |

## Component API

### AppShell

```tsx
interface AppShellProps {
  sidebar: ReactNode;   // Left column content
  main: ReactNode;      // Center column content
  context: ReactNode;   // Right column content
}
```

### Layout Breakpoints

| Breakpoint | Columns | Layout |
|------------|---------|--------|
| `< md` | 1 | Main only (sidebar/context hidden) |
| `md - lg` | 2 | Sidebar (240px) + Main |
| `>= lg` | 3 | Sidebar (240px) + Main + Context (280px) |

## Run Instructions

```bash
# Start dev server
bun dev

# Visit routes
http://localhost:3000/assets
http://localhost:3000/assets/example-asset
```

## Notes

- No mobile drawer/toggle implemented yet (future task)
- Sidebar and ContextPanel are simple placeholders, to be enhanced in future tasks
- Uses shadcn/ui theme colors for borders and backgrounds

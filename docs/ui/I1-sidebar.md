# I1: Sidebar

## Summary

Real Sidebar component with category navigation. Displays hardcoded categories with fake counts and syncs active state with URL query parameter `cat`.

## Checklist

- [x] Implement `/components/sidebar/Sidebar.tsx` with full functionality
- [x] Header displays "Flow Stach"
- [x] List of categories with counts (hardcoded fake data)
- [x] Active state styling based on URL `?cat=` param
- [x] Clicking category navigates to `/assets?cat=<slug>`
- [x] "All" category clears `cat` param (navigates to `/assets`)
- [x] Add documentation

## Files Changed

| File | Action |
|------|--------|
| `components/sidebar/Sidebar.tsx` | Updated |
| `docs/ui/I1-sidebar.md` | Created |

## Component API

### Sidebar

```tsx
interface SidebarProps {
  className?: string;  // Optional additional CSS classes
}
```

### Category Shape

```tsx
interface Category {
  label: string;   // Display name (e.g., "Cursor")
  slug: string;    // URL slug (e.g., "cursor"), empty string for "All"
  count: number;   // Fake count number
}
```

### Categories Array

```tsx
const CATEGORIES: Category[] = [
  { label: "All", slug: "", count: 47 },
  { label: "Cursor", slug: "cursor", count: 8 },
  { label: "Scroll", slug: "scroll", count: 6 },
  { label: "Buttons", slug: "buttons", count: 5 },
  { label: "Navigation", slug: "navigation", count: 7 },
  { label: "Hover", slug: "hover", count: 4 },
  { label: "Media", slug: "media", count: 3 },
  { label: "Typography", slug: "typography", count: 6 },
  { label: "Utilities", slug: "utilities", count: 5 },
  { label: "Sections", slug: "sections", count: 3 },
]
```

## URL Behavior

| Action | Result |
|--------|--------|
| Click "All" | Navigate to `/assets` (no query param) |
| Click "Cursor" | Navigate to `/assets?cat=cursor` |
| Click "Scroll" | Navigate to `/assets?cat=scroll` |
| Page loads with `?cat=buttons` | "Buttons" category is highlighted |
| Page loads without `cat` param | "All" category is highlighted |

## Styling

- Uses sidebar theme colors: `bg-sidebar`, `text-sidebar-foreground`, etc.
- Active category: `bg-sidebar-accent`, `text-sidebar-accent-foreground`, `font-medium`
- Inactive hover: `bg-sidebar-accent/50`
- Counts use `tabular-nums` for consistent width alignment

## Run Instructions

```bash
# Start dev server
bun dev

# Test URL sync
http://localhost:3000/assets           # "All" should be active
http://localhost:3000/assets?cat=cursor  # "Cursor" should be active
```

## Notes

- Counts are fake/hardcoded (will be replaced when Convex is integrated)
- Component is client-side (`"use client"`) due to `useSearchParams` and `useRouter`
- Does not modify AppShell structure per constraints

# UI2: Auth Indicator + Sign Out

**Branch:** `feature/UI2-auth-indicator`
**Status:** Complete

## Summary

Added a visible signed-in indicator and sign-out control to the sidebar using Clerk's UserButton component. When signed out, displays a "Sign in" button that links to the sign-in page.

## Changes

### 1. Sidebar User Area
- **File:** `components/sidebar/Sidebar.tsx`
- **Location:** Footer of sidebar (below navigation)
- **When signed in:** Displays Clerk `<UserButton>` with profile avatar
  - Clicking opens Clerk's user menu
  - "Sign out" option redirects to `/sign-in`
- **When signed out:** Displays "Sign in" button
  - Links to `/sign-in` page
  - Uses shadcn Button with outline variant

## Files Changed

| File | Change Type |
|------|-------------|
| `components/sidebar/Sidebar.tsx` | Modified |
| `docs/ui/UI2-auth-indicator.md` | Created |

## Implementation Details

### Imports Added
```tsx
import Link from "next/link"
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
```

### User Area Component
```tsx
<div className="border-t border-sidebar-border px-3 py-3">
  <SignedIn>
    <UserButton afterSignOutUrl="/sign-in" />
  </SignedIn>
  <SignedOut>
    <Button variant="outline" size="sm" asChild className="w-full">
      <Link href="/sign-in">Sign in</Link>
    </Button>
  </SignedOut>
</div>
```

## Testing Notes

1. **When signed out:**
   - Visit any page with sidebar visible
   - Should see "Sign in" button at bottom of sidebar
   - Click "Sign in" - should navigate to `/sign-in`

2. **When signed in:**
   - Sign in via Clerk
   - Should see user avatar/button at bottom of sidebar
   - Click user button - should open Clerk user menu
   - Click "Sign out" - should sign out and redirect to `/sign-in`

## Validation Commands

```bash
bun run lint
bun run typecheck
bun dev
```

# UI3: Theme Toggle

## What

Light/Dark mode toggle using `next-themes` with System/Light/Dark options.

## Where

- **ThemeProvider**: `app/providers/ThemeProvider.tsx` - Wraps the app with next-themes provider
- **ThemeToggle**: `components/sidebar/ThemeToggle.tsx` - Dropdown toggle component
- **Sidebar**: `components/sidebar/Sidebar.tsx` - Toggle placed in sidebar footer (bottom-right)

## Implementation Details

### ThemeProvider Configuration
- `attribute="class"` - Uses class-based dark mode (`.dark` class on `<html>`)
- `defaultTheme="system"` - Respects OS preference by default
- `enableSystem` - Enables system theme detection
- `disableTransitionOnChange` - Prevents flash during theme switch

### Toggle UI
- Icon button showing sun/moon based on current theme
- Dropdown menu with radio items: System, Light, Dark
- Uses hugeicons for consistent iconography

### Tailwind Dark Mode
Already configured in `globals.css`:
```css
@custom-variant dark (&:is(.dark *));
```

## How to Test

1. Start dev server: `bun dev`
2. Navigate to any page with the sidebar
3. Click the theme toggle button (sun/moon icon) in the sidebar footer
4. Verify:
   - **System**: Follows OS light/dark preference
   - **Light**: Forces light mode
   - **Dark**: Forces dark mode
5. Refresh the page - theme selection should persist
6. Check that all UI elements respond correctly to theme changes

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Added `next-themes` dependency |
| `app/providers/ThemeProvider.tsx` | New - Theme provider component |
| `app/layout.tsx` | Wrapped with ThemeProvider, added `suppressHydrationWarning` |
| `components/sidebar/ThemeToggle.tsx` | New - Theme toggle dropdown |
| `components/sidebar/Sidebar.tsx` | Added ThemeToggle to footer |

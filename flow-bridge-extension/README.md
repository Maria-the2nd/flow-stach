# Flow Bridge Chrome Extension

Chrome extension companion for Flow Bridge web app. Allows users to copy their imported projects directly to Webflow Designer clipboard.

## Features

- **Sync Host Auth**: Shares authentication with the Flow Bridge web app
- **Project List**: View all your imported projects
- **One-Click Copy**: Copy Webflow JSON or code artifacts to clipboard
- **Webflow Compatible**: Uses the special Webflow MIME type for direct paste into Designer

## Setup

### 1. Install Dependencies

```bash
cd flow-bridge-extension
bun install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
- `VITE_CLERK_PUBLISHABLE_KEY` - From your Clerk dashboard
- `VITE_CONVEX_URL` - Your Convex deployment URL
- `VITE_SYNC_HOST` - Web app URL for auth sync (default: `http://localhost:3000`)

### 3. Add Extension Icons

Place your extension icons in the `icons/` folder:
- `icon-16.png` (16x16)
- `icon-48.png` (48x48)
- `icon-128.png` (128x128)

### 4. Build the Extension

```bash
# Development build with watch mode
bun run dev

# Production build
bun run build
```

### 5. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `flow-bridge-extension/dist` folder

### 6. Register Extension with Clerk

After loading the extension, you need to register it with Clerk for auth sync:

1. Copy your extension ID from `chrome://extensions/`
2. Run this API request (replace values):

```bash
curl -X PATCH https://api.clerk.com/v1/instance \
  -H "Authorization: Bearer YOUR_CLERK_SECRET_KEY" \
  -H "Content-type: application/json" \
  -d '{"allowed_origins": ["chrome-extension://YOUR_EXTENSION_ID"]}'
```

## Development

### Project Structure

```
flow-bridge-extension/
├── dist/                 # Built extension (load this in Chrome)
├── icons/               # Extension icons
├── src/
│   ├── components/      # React components
│   │   ├── ProjectList.tsx
│   │   └── ProjectDetail.tsx
│   ├── App.tsx         # Main app with Clerk/Convex providers
│   ├── popup.tsx       # React entry point
│   ├── background.ts   # Service worker for clipboard
│   ├── offscreen.ts    # Offscreen document for clipboard writes
│   ├── styles.css      # Popup styles
│   └── types.ts        # TypeScript types
├── convex/             # Re-exports from parent project
├── manifest.json       # Chrome extension manifest
├── popup.html          # Popup HTML entry
├── offscreen.html      # Offscreen document HTML
└── vite.config.ts      # Vite build config
```

### Commands

```bash
bun run dev        # Build with watch mode
bun run build      # Production build
bun run typecheck  # TypeScript check
```

### Debugging

1. **Popup**: Right-click extension icon → "Inspect popup"
2. **Background**: `chrome://extensions/` → "Service worker" link
3. **Offscreen**: Check background console for offscreen errors

## Auth Flow

1. User signs in on the web app (flowstach.com)
2. Extension uses Clerk's `syncHost` to detect the session
3. `ConvexProviderWithClerk` handles token passing to Convex
4. User can access their projects without signing in again

If not signed in on the web, users can sign in via the extension popup modal.

## Clipboard Flow

1. User clicks "Copy" on an artifact
2. Extension fetches artifact content from Convex
3. Popup sends message to background service worker
4. Background creates offscreen document (if needed)
5. Offscreen document writes to clipboard with correct MIME type
6. For Webflow JSON: Uses `application/json` MIME type with `@webflow/XscpData` format

## Known Limitations

- **OAuth not supported in popup**: Use email/password or sign in on web app first
- **Chrome only**: Uses Chrome-specific APIs (offscreen documents)
- **Requires web app auth**: Extension syncs auth from flowstach.com

## Troubleshooting

### "Not signed in" but signed in on web app
- Check that your Clerk instance allows the extension origin
- Verify `VITE_SYNC_HOST` matches your web app URL
- Try signing out and in again on the web app

### Clipboard not working
- Check extension permissions in `chrome://extensions/`
- Look for errors in background service worker console
- Ensure offscreen.html is in the dist folder

### Build errors
- Make sure parent project's Convex is generated: `bun run convex:dev`
- Check that all dependencies are installed

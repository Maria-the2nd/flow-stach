# CLI Prompt 2: Extension Popup + Auth + Convex Integration

<role>
You are a senior Chrome extension developer implementing auth and data fetching for a Manifest V3 extension. You understand Clerk auth flows, Convex client setup, and Chrome extension architecture.
</role>

<context>
**Project**: Flow Bridge extension — companion to the Flow Bridge web app.

**Current extension state** (`flow-stach-extension/`):
- MV3 manifest with `clipboardWrite` and `offscreen` permissions
- `background.js` — handles clipboard via offscreen document
- `content.js` — injects into flowstach.com pages, bridges copy events
- `offscreen.html/js` — writes to native clipboard
- NO popup, NO auth, NO Convex client

**Web app stack**:
- Clerk for auth (check `.env.local.example` for keys)
- Convex for backend
- `convex/projects.ts` has new user-scoped queries: `listMine`, `getWithArtifacts`, `getArtifactContent`

**Goal**: 
User clicks extension icon → popup shows their projects → they click copy → JSON goes to clipboard.
The extension should work when user is in the Webflow Designer (not just flowstach.com).

**Clerk auth in extensions**:
Clerk has `@clerk/chrome-extension` package. Research if this works for our use case, or if we need manual PKCE flow.
</context>

<instructions>
## Part 1: Research & Setup

1. **Check if `@clerk/chrome-extension` exists and fits our needs**
   - Look at Clerk docs or npm
   - We need: sign in, get session token, pass to Convex
   - If it doesn't work for popups, we'll do manual PKCE

2. **Determine Convex client approach for extension**
   - Can we use `convex/react` in a popup? (it's just React)
   - Or do we need `convex/browser` for vanilla JS?
   - We need to pass Clerk's JWT to Convex for auth

## Part 2: Manifest Updates

Update `manifest.json`:
- Add `action` with `default_popup` pointing to popup.html
- Add `storage` permission (for auth tokens)
- Add `identity` permission if needed for Clerk
- Add host permission for Convex URL and Clerk URLs
- Keep existing clipboard permissions

## Part 3: Popup Implementation

Create a simple popup (can be React or vanilla — your choice based on complexity):

**popup.html** + **popup.js** (or React equivalent):

1. **Auth state check**: On load, check if user is signed in
2. **Sign in flow**: If not signed in, show "Sign in" button that triggers Clerk auth
3. **Project list**: If signed in, fetch projects via `projects.listMine` and display
4. **Project detail**: Click project → show artifacts with copy buttons
5. **Copy action**: Click copy → send message to background.js → existing clipboard flow

**UI states**:
- Loading (checking auth)
- Signed out → "Sign in to Flow Bridge" button
- Signed in, loading projects → spinner
- Signed in, has projects → project list
- Signed in, no projects → "No projects yet. Import HTML at flowstach.com"
- Project detail view → artifact list with copy buttons

## Part 4: Auth Token Flow

1. User clicks "Sign in"
2. Extension opens Clerk sign-in (new tab or popup window)
3. After sign-in, capture the session/JWT
4. Store token in `chrome.storage.local`
5. Use token for Convex client authentication
6. Handle token refresh (Clerk sessions expire)

## Part 5: Convex Client in Extension

1. Initialize Convex client with the web app's Convex URL
2. Pass Clerk's session token to authenticate
3. Call `projects.listMine` to get user's projects
4. Call `projects.getArtifactContent` when user clicks copy

## Part 6: Wire to Existing Clipboard

When user clicks copy on an artifact:
1. Get artifact content via Convex query
2. Send message to background.js: `{ type: "COPY_WEBFLOW_JSON", payload: content }`
3. Background.js handles it via existing offscreen document flow
4. Show success/error feedback in popup
</instructions>

<output_format>
1. **Research findings**: What auth approach works best (Clerk package vs manual PKCE)
2. **Updated manifest.json**: Full file
3. **New files created**: List them with their purpose
4. **Popup code**: Complete implementation
5. **Auth flow code**: How sign-in works
6. **Convex client setup**: How queries are called
7. **Any issues or open questions**
</output_format>

<constraints>
- DO NOT break existing clipboard functionality — the web app copy flow must keep working
- DO use existing background.js message passing for clipboard writes
- DO store auth tokens securely in chrome.storage.local (not localStorage)
- DO handle auth errors gracefully (token expired, network issues)
- DO keep the popup lightweight — users will open it frequently
- If using React for popup, set up a minimal build (Vite or similar) — document the build command
- The popup should be FAST — no heavy frameworks if not needed
</constraints>

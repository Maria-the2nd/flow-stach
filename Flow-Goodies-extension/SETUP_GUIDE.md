# Flow-Goodies Designer Extension - Setup Guide

Complete documentation for creating and running a Webflow Designer Extension from scratch.

## Prerequisites

- Node.js/Bun installed
- Webflow account with Designer access
- Basic understanding of React

---

## Part 1: Create App in Webflow Dashboard

### 1.1 Navigate to App Development
1. Go to **Webflow Dashboard** → **Apps & Integrations** → **Develop**
2. Click **"+ Create an App"**

### 1.2 Fill Out App Info
- **App name**: `Flow-Goodies` (or your preferred name)
- **App description**: Brief description of what your extension does
  - Example: "Paste of styles into variables + remove conflicting class names"
- **App icon**: Upload 256×256 icon (optional but recommended)
- **App homepage URL**: Your website or leave blank
- **Restrict App installation to a specific site**: Toggle ON if testing on one site only

### 1.3 Configure Building Blocks
Click **"Building blocks"** tab:

**Enable:**
- ✅ **Designer extension (Designer API)** - ON
  - This is what creates the panel inside Webflow Designer

**Leave Disabled (you don't need these):**
- ❌ **Data client (REST API)** - OFF
  - Only needed for CMS integrations, external APIs, OAuth

**All permissions below should be "No access":**
- Assets: No access
- Authorized user: No access
- CMS: No access
- Comments: No access
- Components: No access
- Custom Code: No access
- Ecommerce: No access
- Forms: No access
- Pages: No access
- Sites: No access
- Site activity: No access
- Site config: No access
- User Accounts: No access

### 1.4 Create the App
1. Click **"Create App"** button
2. **IMPORTANT**: Copy the **Client ID** that appears
   - It looks like: `9697f34800a739c026c175e1ccbaf512a6fc333ff654d3c859bd78f1b5b1e7e4`
   - You'll need this in the next step

---

## Part 2: Set Up Local Development Environment

### 2.1 Install Webflow CLI

```powershell
# Use npm for global CLI tools (bun's global installs are unreliable)
npm install -g @webflow/webflow-cli

# Verify installation
webflow --version
```

### 2.2 Navigate to Your Project Root

```powershell
cd C:\Users\maria\Desktop\pessoal\FLOW_PARTY\flow-stach
```

### 2.3 Initialize Designer Extension

```powershell
webflow extension init flow-stash-designer-extension
```

**Prompts you'll see:**
1. **What would you like to name your Designer Extension?**
   - Accept default or type custom name (e.g., `Flow-Goodies-extension`)
   
2. **Which project template would you like to use?**
   - Select: **`react`** (use arrow keys + Enter)
   - Options: `default`, `react`, `typescript-alt`
   - Choose React for component-based UI

The CLI will create a new folder with your extension name.

### 2.4 Navigate Into Extension Folder

```powershell
cd Flow-Goodies-extension
```

---

## Part 3: Configure Client ID

### 3.1 Open webflow.json

The file should exist at:
```
C:\Users\maria\Desktop\pessoal\FLOW_PARTY\flow-stach\Flow-Goodies-extension\webflow.json
```

### 3.2 Add Your Client ID

Edit `webflow.json` to include the `clientId` you copied earlier:

```json
{
  "name": "Flow-Goodies-extension",
  "publicDir": "public",
  "size": "default",
  "apiVersion": "2",
  "clientId": "YOUR_CLIENT_ID_HERE"
}
```

**Replace** `YOUR_CLIENT_ID_HERE` with the actual Client ID from Webflow Dashboard.

**Example:**
```json
{
  "name": "Flow-Goodies-extension",
  "publicDir": "public",
  "size": "default",
  "apiVersion": "2",
  "clientId": "9697f34800a739c026c175e1ccbaf512a6fc333ff654d3c859bd78f1b5b1e7e4"
}
```

---

## Part 4: Install Dependencies and Run Dev Server

### 4.1 Install Node Modules

```powershell
# Use bun (faster) or npm
bun install
# OR
npm install
```

### 4.2 Start Development Server

```powershell
bun run dev
# OR
npm run dev
```

**Expected output:**
```
✔ All webflow packages are updated
╭─────────────────────────────────────────────────╮
│ Serving your extension at http://localhost:1337 │
╰─────────────────────────────────────────────────╯
```

**Keep this terminal window open.** The dev server must run continuously.

---

## Part 5: Test in Webflow Designer

### 5.1 Install Your App (First Time Only)

1. Go to **Webflow Dashboard** → **Apps & Integrations** → **Develop**
2. Find your **Flow-Goodies** app
3. Click the **"..."** menu → **"Install"**
4. Select the site you want to test on (e.g., "teste")
5. Click **"Authorize"**

### 5.2 Launch Development App

1. **Open Webflow Designer** for the site you authorized
2. **Press `E` key** (opens Apps panel)
3. You should see your app listed with a **"DEV"** badge
4. Click **"Launch development app"**

### 5.3 Verify It's Working

You should see:
- A panel opens on the right side of Designer
- Contains your React app (default: "Welcome to My React App!")
- The panel header shows your app name + "DEV" badge

---

## Part 6: Development Workflow

### 6.1 Making Changes

1. Edit files in `src/` folder (e.g., `src/index.tsx`, `src/App.tsx`)
2. Webpack watch mode automatically rebuilds
3. **Refresh the extension panel** in Designer to see changes
   - Click the refresh icon in the extension header
   - Or close and reopen the panel (press `E`, click your app again)

### 6.2 Project Structure

```
Flow-Goodies-extension/
├── src/
│   ├── index.tsx          # Entry point
│   ├── App.tsx            # Main React component
│   └── styles.css         # Styles
├── public/
│   └── index.html         # HTML template
├── webflow.json           # Webflow config (includes clientId)
├── package.json           # Dependencies
├── webpack.config.mjs     # Webpack config
└── README.md              # Auto-generated docs
```

### 6.3 Debugging

**View console logs:**
1. In Designer, open browser DevTools (F12)
2. Your extension runs in an iframe
3. Console logs from your React app appear in the Console tab

**Common issues:**
- **"App not showing in Designer"**: Verify `clientId` in `webflow.json` is correct
- **"Connection refused"**: Make sure dev server is running (`bun run dev`)
- **"Changes not showing"**: Refresh the extension panel or restart dev server

---

## Part 7: Building for Production (Later)

### 7.1 Bundle Extension

```powershell
webflow extension bundle
```

This creates a `.zip` file in your project directory.

### 7.2 Upload to Webflow

1. Go to **Webflow Dashboard** → **Apps & Integrations** → **Develop**
2. Find your app → Click **"Publish new version"**
3. Upload the `.zip` file
4. Fill out submission notes
5. Choose distribution:
   - **"Publish for internal testing (Workspace only)"** - For private testing
   - **"Submit an App"** - For public Webflow Marketplace (requires review)

### 7.3 Testing Production Build

After uploading:
1. Go to Designer
2. Press `E` → Find your app (no longer has "DEV" badge)
3. Click to launch the production version

---

## Troubleshooting

### Extension Doesn't Appear in Designer

**Check:**
1. Dev server is running: `bun run dev`
2. `clientId` in `webflow.json` matches Dashboard
3. App is installed on the site (Dashboard → Apps & Integrations → Manage)
4. Try refreshing Designer page (F5) and pressing `E` again

### "CORS Error" or "Blocked by CORS policy"

**Fix:**
- Webflow CLI dev server runs on HTTPS automatically
- If you see CORS errors, try running: `webflow extension serve` instead of `bun run dev`

### Dev Server Fails to Start

**Check:**
1. Port 1337 isn't already in use
   ```powershell
   # Check if something is using port 1337
   netstat -ano | findstr :1337
   ```
2. Node modules are installed: `bun install`
3. Webflow CLI is up to date: `npm update -g @webflow/webflow-cli`

---

## Next Steps

Now that your extension is running, you can:

1. **Build the component library UI**
   - Create component grid with thumbnails
   - Add search/filter functionality
   - Design the layout in React

2. **Implement clipboard copy mechanism**
   - Learn the `@webflow/XscpData` JSON format
   - Write JavaScript to copy components to clipboard
   - Test pasting into Webflow canvas

3. **Connect to your component database**
   - Use Convex or your chosen backend
   - Fetch component data via API
   - Display components dynamically

4. **Add authentication**
   - Use Clerk or auth provider
   - Gate premium components behind login
   - Sync with your Stash marketplace

---

## Useful Commands Reference

```powershell
# Start dev server
bun run dev

# Install dependencies
bun install

# Update Webflow CLI
npm update -g @webflow/webflow-cli

# Check Webflow CLI version
webflow --version

# Create new extension (from scratch)
webflow extension init <name>

# Bundle for production
webflow extension bundle

# Serve extension (alternative to bun run dev)
webflow extension serve
```

---

## Resources

- [Webflow Designer Extension Docs](https://developers.webflow.com/docs/designer-extension-overview)
- [Designer Extension API Reference](https://developers.webflow.com/docs/designer-extension-api-reference)
- [Webflow Apps GitHub Examples](https://github.com/Webflow-Examples)
- [React Documentation](https://react.dev/)

---

**Created:** January 21, 2026  
**Last Updated:** January 21, 2026  
**Status:** Development Environment Ready ✅

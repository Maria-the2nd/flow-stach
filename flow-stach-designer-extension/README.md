# Flow Stach Designer Extension

Standalone Webflow Designer Extension for installing Flow Stach components with collision detection and variable support.

## Overview

This extension provides a better installation experience for Flow Stach components:
- **Collision Detection**: Warns about existing classes and lets you skip them
- **Variable Creation**: Automatically creates Webflow variables from token manifests
- **UUID Remapping**: Converts CSS variable references to Webflow variable UUIDs
- **Smart Installation**: Uses Webflow APIs to inject components directly

## Architecture

The extension is completely standalone and does not require any changes to the Flow Stach web app. It works by:

1. **Monitoring Clipboard**: Polls clipboard every 500ms for `@webflow/XscpData` payloads
2. **Detecting Collisions**: Checks existing classes/variables in the target Webflow site
3. **Creating Variables**: Creates variable collections, modes, and variables if manifest is present
4. **Injecting Components**: Uses Webflow APIs to create styles and elements

## Installation (Designer Apps Panel)

Extensions live in the **Apps** panel in Webflow Designer. Webflow merged “Extensions”, “Apps”, and “Designer integrations” into a single Apps panel—look for the **plug icon** in the left sidebar, or press **E** to open it.

Access is gated: installing custom Designer apps requires **Designer Extensions** availability in your workspace (private beta) and appropriate developer permissions. If your workspace does not have Designer Extensions access, there is no official way to load/test a custom Designer app locally.

If your workspace has Designer Extensions access:

1. Build the extension:
   ```bash
   cd flow-stach-designer-extension
   npm install
   npm run build
   ```

2. Upload the extension via the Apps panel:
   - Open Webflow Designer
   - In the left sidebar, click **Apps** (plug icon) or press **E**
   - In the Apps panel, use the developer option to **Load/Upload a custom app** (naming may vary)
   - Select the files from the `dist/` folder; the manifest references `dist/index.js` and `dist/panel.html`
   - Enable the app for your workspace/site

3. Verify installation:
   - In Designer, open the **Apps** panel
   - You should see “Flow Stach Installer”
   - The page will have a hidden attribute `data-flowstach-extension="true"` indicating the extension is active

If you do not have access, use the **Hybrid Approach** described below: build a Data Client for server-side workflows and use an external installer (web app/local app/Chrome extension) until Designer Extensions access is granted.

Note: Webflow’s naming may differ slightly across releases. If you don’t see the Apps panel immediately, refresh the Designer or press **E** to open it. See Webflow’s developer docs (“Getting Started with Webflow Apps: Designer Extensions”) for the latest hotkeys and panel location.

## Testing & Requirements

- Use a **test site** in Webflow Designer to validate installation flows
- Open the **Apps** panel with the **plug icon** or press **E**
- If you **can’t upload or see your app**, you likely need a **Developer Workspace** or developer permissions in your workspace
- After upload, if the app doesn’t appear, **refresh the Designer** and reopen the Apps panel
- The extension runs inside Designer and relies on Designer-provided APIs (`webflow` global); it does **not** require the Webflow **Data API**

### Data API vs Designer App
- The **Data API** is for server-side integrations (REST), workspaces, and automation
- This extension is a **Designer app** that operates entirely inside Designer via the Apps panel
- You do **not** need Data API keys to test or use this extension

## Key Distinction: Data Clients vs Designer Extensions

### Data Clients (testable immediately)
- Server-side/external apps
- Use REST API with tokens or OAuth
- Manage sites/workspaces data (CMS, content, automation)
- You can generate an API token and start testing right away by calling Webflow’s Data API from your local tool or server. A Developer Workspace can help access premium features and advanced APIs.

### Designer Extensions (Designer apps)
- UI panels inside Designer (Apps panel)
- Clipboard listeners
- DOM/style injection
- Variable creation and “Install component” flows
- Access and testing depend on Designer Extensions availability in your workspace. Without Designer Extensions access, there’s no official way to load/test a custom Designer app locally.

### Practical Approach
- If Designer Extensions access is not available:
  - Use a Data Client for CMS/data workflows (fully testable)
  - Use an external installer or browser-based tooling to bootstrap variables and styles when working inside Designer (pending official app access)
  - Later, migrate the installer UI into a Designer Extension when access is granted

## Development

```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Production build
npm run build

# Type checking
npm run typecheck
```

## Project Structure

```
flow-stach-designer-extension/
├── src/
│   ├── index.ts              # Entry point
│   ├── types.ts              # Shared TypeScript types
│   ├── clipboard/
│   │   └── monitor.ts        # Clipboard monitoring
│   ├── collision/
│   │   └── detector.ts       # Collision detection
│   ├── variables/
│   │   ├── manager.ts        # Variable creation
│   │   └── remapper.ts       # UUID remapping
│   ├── injector/
│   │   └── dom.ts            # DOM injection
│   └── ui/
│       ├── panel.tsx         # Main UI component
│       ├── CollisionDialog.tsx
│       └── panel.html        # HTML template
├── manifest.json             # Extension manifest
├── package.json
├── tsconfig.json
└── webpack.config.js
```

## How It Works

### User Workflow

1. User browses Flow Stach web app (unchanged)
2. User clicks "Copy" button (existing clipboard functionality)
3. Extension detects payload in clipboard automatically
4. Extension UI shows "Install Component" button
5. User clicks Install → Extension detects collisions → User confirms → Installs

### Recommended Order

- Paste “Design Tokens” first to establish global styles and variables
- Then paste components; collisions (duplicate classes) can be skipped in the dialog

### Integration with Web App

The extension **does not modify** the web app at all. It simply:
- Reads clipboard data that the web app already generates
- Provides its own UI within Webflow Designer
- Uses Webflow APIs to inject components

### Optional: Token Manifest Support

If you want variable support, you can optionally add token manifest to payload meta in the web app:

```typescript
// In lib/webflow-converter.ts (OPTIONAL)
payload.meta = {
  ...payload.meta,
  tokenManifest: tokenManifest  // Only if available
};
```

This is completely optional - extension works without it (just skips variable creation).

When present, the extension will:
- Create variable collections and modes (e.g., light/dark)
- Create variables based on your manifest
- Remap CSS `var(--token, fallback)` references to Webflow variable UUIDs so pastes use native Webflow variables

## Webflow API Requirements

The extension uses the following Webflow Designer APIs (when available):

- `webflow.getAllStyles()` - Get existing styles
- `webflow.createStyle()` - Create new styles
- `webflow.getAllVariableCollections()` - Get variable collections
- `webflow.createVariableCollection()` - Create collection
- `webflow.createVariable()` - Create variables
- `webflow.getSelectedElement()` - Get selected element
- `webflow.createElement()` - Create elements
- `webflow.createTextNode()` - Create text nodes
- `webflow.getBody()` - Get body element

## Testing

Test the extension independently:

1. **Clipboard Detection**: Copy a Flow Stach payload, verify extension detects it
2. **Collision Detection**: Install to site with existing classes, verify collision dialog
3. **Variable Creation**: Install token payload, verify variables created in Webflow
4. **DOM Injection**: Verify styles and nodes are created correctly

## License

Same as main Flow Stach project.

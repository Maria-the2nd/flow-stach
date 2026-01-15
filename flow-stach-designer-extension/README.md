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

## Installation (Manual)

Until the extension is approved by Webflow, you'll need to install it manually:

1. Build the extension:
   ```bash
   cd flow-stach-designer-extension
   npm install
   npm run build
   ```

2. Load the extension in Webflow Designer (method depends on Webflow's extension system)

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

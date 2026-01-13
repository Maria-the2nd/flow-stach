# Flow Stach Chrome Extension

This extension enables copy-paste of Webflow components from Flow Stach to Webflow Designer.

## Why This Extension?

Web browsers sandbox custom clipboard MIME types (like `application/json`) to prevent security issues. This means data copied from a website can only be pasted in other websites, not in native applications like Webflow Designer.

This extension has elevated clipboard permissions that allow it to write `application/json` data to the native system clipboard, which Webflow Designer can read.

## Installation (Developer Mode)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select this `flow-stach-extension` folder
5. The extension should appear in your extensions list

## Usage

1. Go to Flow Stach (localhost:3000 or flowstach.com)
2. Navigate to any component
3. Click **Copy to Webflow**
4. Open Webflow Designer
5. Click on the canvas (not in a text element)
6. Press **Cmd+V** (Mac) or **Ctrl+V** (Windows)
7. The component should appear!

## Icons

The extension needs icon files. Create these PNG files in the `icons/` folder:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

You can use any icon generator or create them in Figma/Photoshop.

## Troubleshooting

### Extension not working?
- Make sure the extension is enabled in `chrome://extensions`
- Check that Flow Stach is in the allowed URLs (localhost:3000 or flowstach.com)
- Open DevTools Console to see any error messages

### Copy button shows "Extension not installed"?
- Refresh the Flow Stach page after installing the extension
- Check that the extension is active (look for the icon in Chrome toolbar)

### Paste not working in Webflow?
- Make sure you're clicking on the **canvas**, not inside a text element
- Try pressing Cmd+V / Ctrl+V while the canvas is focused
- Check if anything was copied by pasting in a text editor first

## Development

To modify the extension:

1. Edit the source files
2. Go to `chrome://extensions`
3. Click the refresh icon on the Flow Stach extension
4. Reload the Flow Stach webpage

### Files

- `manifest.json` - Extension configuration
- `background.js` - Service worker that handles clipboard operations
- `offscreen.html/js` - Offscreen document for clipboard access (Manifest V3 requirement)
- `content.js` - Content script injected into Flow Stach pages

## Permissions

This extension requests:
- `clipboardWrite` - Write to the system clipboard
- `offscreen` - Create offscreen documents (required for clipboard in Manifest V3)
- Host permissions for localhost:3000 and flowstach.com

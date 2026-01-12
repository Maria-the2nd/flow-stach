# Clipboard Actions

Copy Code and Copy to Webflow functionality for asset payloads.

## Overview

Two clipboard actions are available on the asset detail page:

- **Copy Code**: Copies the `codePayload` as plain text
- **Copy to Webflow**: Copies the `webflowJson` as JSON MIME type for pasting into Webflow Designer

## Supported Browsers

| Browser | Copy Code | Copy to Webflow |
|---------|-----------|-----------------|
| Chrome Desktop | Yes | Yes |
| Edge Desktop | Yes | Yes |
| Firefox Desktop | Yes | Limited* |
| Safari Desktop | Yes | Limited* |
| Mobile Browsers | Yes | No |

*Limited: May fall back to plain text copy, which won't paste correctly into Webflow Designer.

**Recommendation**: Use Chrome desktop for the best Webflow paste experience.

## How to Test

1. Navigate to an asset detail page (e.g., `/assets/magnetic-cursor-effect`)
2. Click **Copy to Webflow** in the right panel
3. Open Webflow Designer
4. Select a container element
5. Press `Ctrl/Cmd + V` to paste

The component should appear with all its structure intact.

For **Copy Code**:
1. Click **Copy Code**
2. Paste into your code editor
3. The raw code payload will be inserted

## Common Failure Cases

### "Payload not ready"
- The asset doesn't have a payload configured yet
- The payload fields contain "TODO" placeholder values
- Wait for the payload to be seeded via admin tools

### "Use Chrome desktop for Webflow paste"
- The `ClipboardItem` API is not supported in your browser
- The clipboard write permission was denied
- You're not in a secure context (HTTPS)

**Solutions**:
- Switch to Chrome desktop browser
- Ensure the site is served over HTTPS
- Check browser clipboard permissions in settings

### Clipboard Permission Denied
- Some browsers require explicit permission for clipboard access
- Check your browser's site settings for clipboard permissions
- Try clicking the button again (some browsers require user gesture)

## Implementation Details

### Files
- `lib/clipboard.ts` - Core clipboard utilities
- `components/asset-detail/AssetDetailContext.tsx` - Button wiring

### Dependencies
- `sonner` - Toast notifications

### API

```typescript
// Copy plain text
async function copyText(text: string): Promise<CopyResult>

// Copy JSON for Webflow (uses ClipboardItem API)
async function copyWebflowJson(jsonString: string): Promise<CopyResult>
```

Both functions return `{ success: true }` or `{ success: false, reason: string }`.

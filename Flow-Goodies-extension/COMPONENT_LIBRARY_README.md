# Flow Stash - Component Library Extension

A Webflow Designer Extension for importing HTML/CSS/JS components with smart style deduplication.

## What We Built

### ✅ Complete Features

1. **Component Library UI**
   - Searchable component grid
   - Category filtering (Hero, Card, Navigation, etc.)
   - Visual component cards with descriptions
   - Premium badge support

2. **Smart Copy System**
   - Converts HTML → Webflow node structure
   - Parses CSS → Webflow class styles
   - **Checks for duplicate class names** (avoids style conflicts)
   - Generates proper `@webflow/XscpData` clipboard format
   - Handles JavaScript components (shows alert with injection instructions)

3. **Sample Components**
   - Hero Section (gradient background)
   - Feature Card (hover effects)
   - Navigation Bar (responsive)

### 📁 Project Structure

```
src/
├── components/
│   ├── App.tsx                 # Main app component
│   ├── App.css                 # Styling
│   ├── SearchBar.tsx           # Search & filter UI
│   ├── ComponentGrid.tsx       # Grid layout
│   └── ComponentCard.tsx       # Individual component cards
├── data/
│   └── sampleComponents.ts     # Component library data
├── types/
│   └── component.ts            # TypeScript interfaces
├── utils/
│   └── webflowCopy.ts          # Core copy logic
└── index.tsx                   # Entry point
```

## How It Works

### 1. Component Data Structure

Each component contains:
```typescript
{
  id: string;           // Unique identifier
  name: string;         // Display name
  description: string;  // Short description
  category: string;     // Category (Hero, Card, etc.)
  thumbnail: string;    // Preview image (optional)
  html: string;         // Raw HTML structure
  css: string;          // CSS styles
  javascript?: string;  // Optional JS code
  tags: string[];       // Search tags
  isPremium: boolean;   // Premium flag
}
```

### 2. Copy Process

When user clicks "Copy to Webflow":

**Step 1: Parse HTML**
```typescript
const rootElement = parseHTML(component.html);
// Converts HTML string → DOM element
```

**Step 2: Convert to Webflow Nodes**
```typescript
const nodes = [convertToWebflowNode(rootElement)];
// DOM element → Webflow node structure with unique IDs
```

**Step 3: Parse CSS**
```typescript
const styles = parseCSSToWebflowStyles(component.css);
// Extracts class rules from CSS string
```

**Step 4: Check for Duplicates**
```typescript
const existingClasses = await getExistingClassNames();
// Fetches existing class names from current Webflow project
// Filters out duplicates to avoid conflicts
```

**Step 5: Create Clipboard Data**
```typescript
const clipboardData = {
  type: '@webflow/XscpData',
  payload: { nodes, styles, assets: [] }
};
// Generates Webflow-compatible JSON format
```

**Step 6: Write to Clipboard**
```typescript
await navigator.clipboard.write([clipboardItem]);
// User can now paste (Cmd+V) in Webflow Designer
```

### 3. Style Deduplication

**Problem**: Pasting multiple components with the same class names would create conflicts.

**Solution**:
```typescript
const existingClasses = await webflow.getAllStyles();
styles = styles.filter(style => !existingClasses.has(style.name));
```

- Fetches all existing class names from current site
- Filters out any styles that already exist
- Only adds new, unique classes

## Testing the Extension

### 1. Start Dev Server

```powershell
cd Flow-Goodies-extension
bun run dev
```

### 2. Open in Webflow Designer

1. Open any Webflow project
2. Press `E` key
3. Click "Flow-Goodies" (with DEV badge)
4. Extension panel opens on the right

### 3. Test Copying

**Basic Test:**
1. Search for "Hero Section"
2. Click "Copy to Webflow"
3. Button shows "✓ Copied!"
4. Click anywhere on Webflow canvas
5. Press `Cmd+V` (or `Ctrl+V`)
6. Hero section appears!

**Duplicate Test:**
1. Paste the Hero Section (first time)
2. Check Navigator - you'll see classes like `.hero-section`, `.hero-title`
3. Copy Hero Section again
4. Paste it again
5. Classes should NOT duplicate (extension filters them out)

**Filter Test:**
1. Click "Card" category button
2. Only Feature Card should show
3. Search "gradient"
4. Only Hero Section should show
5. Clear search, click "All"
6. All 3 components show

## Adding New Components

### Option 1: Edit Sample Data

Edit `src/data/sampleComponents.ts`:

```typescript
{
  id: 'footer-1',
  name: 'Footer',
  description: 'Modern footer with links',
  category: 'Footer',
  thumbnail: '',
  html: `
    <footer class="footer">
      <p class="footer-text">© 2026 Your Company</p>
    </footer>
  `,
  css: `
    .footer {
      background: #1a202c;
      color: white;
      padding: 2rem;
      text-align: center;
    }
    
    .footer-text {
      font-size: 0.875rem;
    }
  `,
  tags: ['footer', 'dark'],
  isPremium: false,
}
```

### Option 2: Connect to Backend (Future)

Replace `sampleComponents` import with API call:

```typescript
const [components, setComponents] = useState<Component[]>([]);

useEffect(() => {
  fetch('https://your-api.com/components')
    .then(res => res.json())
    .then(data => setComponents(data));
}, []);
```

## Limitations & Future Improvements

### Current Limitations

1. **CSS Parsing is Basic**
   - Uses regex for class extraction
   - Doesn't handle nested selectors (`.parent .child`)
   - Doesn't handle pseudo-classes (`:hover`, `:focus`)
   - **Fix**: Use a proper CSS parser like `postcss`

2. **HTML Structure**
   - Doesn't preserve attributes (data-*, aria-*)
   - Text content only works for simple cases
   - **Fix**: Enhanced DOM parsing with attribute preservation

3. **No Media Queries**
   - Responsive styles are not copied
   - **Fix**: Parse and include `@media` rules

4. **JavaScript Handling**
   - Shows alert instead of auto-injecting
   - **Fix**: Use Webflow API to inject custom code programmatically

### Planned Improvements

**Phase 2: Enhanced Parser**
- [ ] Use `postcss` for proper CSS parsing
- [ ] Handle pseudo-classes and media queries
- [ ] Preserve all HTML attributes
- [ ] Support SVG elements

**Phase 3: Backend Integration**
- [ ] Connect to Convex database
- [ ] Add Clerk authentication
- [ ] Premium component gating
- [ ] Component versioning

**Phase 4: Advanced Features**
- [ ] Live component preview (iframe)
- [ ] Drag-and-drop to canvas (if API supports)
- [ ] Batch copy (multiple components at once)
- [ ] Custom component builder

## Troubleshooting

### Extension Not Loading

**Check:**
1. Dev server running? `bun run dev`
2. `clientId` correct in `webflow.json`?
3. Browser console for errors (F12)

### Copy Button Does Nothing

**Check browser console:**
- "Failed to fetch existing styles" → Webflow API issue
- "Clipboard write failed" → Browser permissions
- Enable clipboard access for `localhost:1337`

### Pasted Component Looks Wrong

**Common issues:**
- **Classes missing**: CSS parsing failed (check console logs)
- **Layout broken**: Webflow interprets some CSS differently
- **Text missing**: HTML structure has nested text nodes

**Debug:**
```typescript
// Add to webflowCopy.ts after creating clipboardData
console.log(JSON.stringify(clipboardData, null, 2));
// Inspect the generated JSON structure
```

### Styles Duplicating Despite Logic

**Check:**
1. Are you pasting into a different site? (styles are site-specific)
2. Class names might have conflicts with Webflow's internal classes
3. Try renaming classes with a unique prefix (e.g., `fs-hero-section`)

## Development Tips

### Live Reload

Webpack watch mode auto-rebuilds on file changes, but you need to refresh the extension panel:
1. Make code changes
2. Wait for rebuild (terminal shows "compiled successfully")
3. In Designer extension panel, click refresh icon
4. Or close and reopen panel (press `E`, click app again)

### Debugging

**Console Logs:**
```typescript
// In webflowCopy.ts
console.log('Nodes:', nodes);
console.log('Styles:', styles);
console.log('Clipboard data:', clipboardData);
```

**View in DevTools:**
1. Right-click extension panel
2. Click "Inspect"
3. Console shows your logs
4. Network tab shows API calls

### Testing Webflow API

```typescript
// In App.tsx or ComponentCard.tsx
const testAPI = async () => {
  const el = await webflow.getSelectedElement();
  console.log('Selected element:', el);
  
  const styles = await webflow.getAllStyles();
  console.log('All styles:', styles);
};
```

## Resources

- [Webflow Designer API Docs](https://developers.webflow.com/docs/designer-extension-api-reference)
- [Clipboard API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)
- [CSS Parser (PostCSS)](https://postcss.org/)

---

**Status**: ✅ MVP Complete - Ready for Testing  
**Next**: Connect to Convex backend + add real component library

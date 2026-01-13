# Webflow Designer Extension Plan

> **Status**: Planning document for future implementation
> **Last Updated**: 2026-01-13
> **Owner**: Flow Stach team

---

## 1. Executive Summary

### What We're Building
A **Webflow Designer Extension** called "Flow Stach" that imports design tokens from AI-generated HTML components into Webflow as native Variables, and enables inserting components as editable Designer elements.

### Why We Need It
- Webflow's clipboard JSON **cannot create Variables** (the "variables" block is ignored)
- Variable bindings are **UUID-based only** - name matching never rebinds
- The only way to programmatically create Variables is through the Designer Extension API
- **Current state**: The app already stores HTML/CSS/JS. It just doesn't create Variables or Designer elements.

### What It Solves
Users who import components from Flow Stach get two options:
1. **Without tokens**: Import raw components (CSS fallback values)
2. **With tokens**: Use extension to create Variables first, then insert components with bindings

### Updated Goal (Full Import)
One flow: upload HTML → Flow Stach splits sections + tokens → Webflow Designer extension creates Variables and inserts components as native Designer elements.

---

## 2. User Journey (Detailed)

### Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  FLOW STACH PLATFORM                                                │
├─────────────────────────────────────────────────────────────────────┤
│  1. User uploads AI-generated HTML (full page or components)        │
│                           │                                         │
│                           ▼                                         │
│  2. Platform parses HTML into:                                      │
│     • Individual components (nav, hero, footer, etc.)               │
│     • Design token manifest (colors, fonts extracted from CSS)      │
│                           │                                         │
│                           ▼                                         │
│  3. User browses component library                                  │
│     • Sees preview thumbnails                                       │
│     • Can filter by category                                        │
│                           │                                         │
│                           ▼                                         │
│  4. User clicks "Copy to Webflow" on a component                    │
│     • Option A: copy payload (clipboard)                            │
│     • Option B: open Webflow Designer extension                     │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  WEBFLOW DESIGNER                                                   │
├─────────────────────────────────────────────────────────────────────┤
│  5. User opens Webflow Designer                                     │
│                           │                                         │
│                           ▼                                         │
│  6. USER CHOICE:                                                    │
│                                                                     │
│     OPTION A: Paste Without Variables                               │
│     ─────────────────────────────────                               │
│     • Press Cmd+V / Ctrl+V directly                                 │
│     • Component appears with hardcoded CSS values                   │
│     • No Variables created                                          │
│     • Good for: one-off usage, quick prototyping                    │
│                                                                     │
│     OPTION B: Import With Variables (Extension)                     │
│     ─────────────────────────────────                               │
│     • Press "E" to open Extensions panel                            │
│     • Click "Flow Stach" extension                                  │
│     • Click "Import Tokens"                                         │
│     • Variables created in Webflow                                  │
│     • Click "Insert Component"                                      │
│     • Extension inserts Webflow elements + bindings                 │
│     • Good for: design systems, consistent theming                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Notes
- The full "Insert Component" flow requires **Designer API element creation** or a **valid Webflow JSON payload**.
- If the API does not allow element creation, we must either generate Webflow JSON in Flow Stach or fall back to manual embed/paste.

---

## 3. Technical Requirements

### 3.1 Webflow App Registration

**Prerequisites**:
- Webflow account
- **Workspace Admin role** (required to create apps)

**Registration Process**:

| Step | Action | Details |
|------|--------|---------|
| 1 | Navigate | `Workspace Settings > Apps & Integrations > App Development` |
| 2 | Click | "Create an App" button |
| 3 | Fill form | Name: "Flow Stach" |
| | | Description: "Import design tokens and create Webflow Variables from Flow Stach components" (max 140 chars) |
| | | Homepage URL: `https://flowstach.com` (must be HTTPS) |
| | | App Icon: Upload 512x512 PNG |
| 4 | Select capability | Check "Designer Extension" |
| 5 | Save | Receive **Client ID** and **Client Secret** |
| 6 | Store securely | Add to `.env.local`, NEVER commit to repo |

**Security Notes**:
- Client ID can be public (included in extension)
- Client Secret must stay secret (server-side only, if needed)

---

### 3.2 Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Language** | TypeScript | 5.x | Type safety, intellisense |
| **UI Framework** | Vanilla HTML/CSS | - | Simple UI, no build complexity |
| **Build Tool** | Webflow CLI | Latest | Official scaffolding, bundling |
| **Type Definitions** | `@webflow/designer-extension-typings` | Latest | TypeScript types for Designer API |
| **Package Manager** | npm or bun | - | Dependency management |
| **Dev Server** | Built-in (Webflow CLI) | Port 1337 | Local development |

**Why Vanilla HTML/CSS (not React)**:
- Extension UI is simple (few buttons, status messages)
- Smaller bundle size
- Faster load time in Designer
- No framework learning curve
- Can upgrade to React later if needed

---

### 3.3 Project Structure

```
flow-stach-designer-extension/
│
├── src/                              # TypeScript source files
│   ├── index.ts                      # Entry point, event listeners
│   ├── token-importer.ts             # Core variable creation logic
│   ├── api.ts                        # API calls to Flow Stach (future)
│   └── types.ts                      # TypeScript interfaces
│
├── public/                           # Static files served to Designer
│   ├── index.html                    # Extension UI (body content only)
│   ├── index.js                      # Compiled from src/ (auto-generated)
│   └── styles.css                    # Extension styling
│
├── webflow.json                      # Extension manifest (required)
├── package.json                      # Dependencies and scripts
├── tsconfig.json                     # TypeScript configuration
├── .gitignore                        # Ignore node_modules, .env, etc.
└── README.md                         # Setup and development instructions
```

**File Details**:

#### `webflow.json` (Extension Manifest)
```json
{
  "name": "Flow Stach",
  "size": "comfortable"
}
```

| Property | Required | Values | Description |
|----------|----------|--------|-------------|
| `name` | Yes | String | Display name in Designer |
| `size` | No | `"default"`, `"comfortable"`, `"large"` | Panel dimensions |
| `apiVersion` | No | `"2"` | Designer API version |

#### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./public",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

#### `package.json`
```json
{
  "name": "flow-stach-designer-extension",
  "version": "1.0.0",
  "scripts": {
    "dev": "webflow extension serve",
    "build": "tsc && webflow extension bundle",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@webflow/designer-extension-typings": "latest",
    "typescript": "^5.0.0"
  }
}
```

---

### 3.4 Designer API Reference

#### Available APIs for Variables

| API | Method | Description |
|-----|--------|-------------|
| **Variable Collections** | `webflow.createVariableCollection(name)` | Create new collection |
| | `webflow.getVariableCollections()` | List all collections |
| | `collection.remove()` | Delete collection |
| | `collection.getName()` | Get collection name |
| **Variable Modes** | `collection.createVariableMode(name)` | Create mode (Light, Dark) |
| | `collection.getVariableModes()` | List modes in collection |
| | `mode.getName()` | Get mode name |
| **Color Variables** | `collection.createColorVariable(name, value)` | Create color variable |
| | `variable.set(value, mode)` | Set mode-specific value |
| | `variable.getValue()` | Get current value |
| | `variable.getName()` | Get variable name |
| **Font Family Variables** | `collection.createFontFamilyVariable(name, value)` | Create font variable |

#### Supported Variable Types
- `color` - Hex colors (#ffffff) or rgba()
- `fontFamily` - Font stack strings
- `size` - Pixel/rem values (not used in our tokens)
- `number` - Numeric values (not used in our tokens)
- `percentage` - Percent values (not used in our tokens)

### 3.5 Component Insertion (Needed for Full Import)
We need one of these to deliver Webflow-editable components:
1. **Designer API element creation** (ideal if Webflow exposes it)
2. **Valid Webflow JSON payloads** per component (clipboard/extension paste)

If (1) is available, the extension can build sections directly from parsed HTML data.
If only (2) is available, we need a **HTML → Webflow JSON converter** in Flow Stach.

---

## 4. Token Manifest Specification

### 4.1 Schema Definition

```typescript
// types.ts

interface TokenManifest {
  schemaVersion: string;           // "1.0"
  name: string;                    // Design system name
  slug: string;                    // URL-safe identifier
  namespace: string;               // CSS variable prefix (e.g., "fp")
  modes: string[];                 // ["light", "dark"]
  variables: TokenVariable[];
  fonts?: FontConfig;
}

interface TokenVariable {
  path: string;                    // "Colors / Background / Base"
  type: "color" | "fontFamily";
  cssVar: string;                  // "--fp-bg"
  values?: {                       // For colors with modes
    light: string;
    dark: string;
  };
  value?: string;                  // For fonts (single value)
}

interface FontConfig {
  googleFonts: string;             // Google Fonts URL
  headSnippet: string;             // HTML to inject in <head>
}
```

### 4.2 Example Token Manifest

```json
{
  "schemaVersion": "1.0",
  "name": "My Design System",
  "slug": "my-design-system",
  "namespace": "mds",
  "modes": ["light", "dark"],
  "variables": [
    {
      "path": "Colors / Background / Base",
      "type": "color",
      "cssVar": "--mds-bg",
      "values": {
        "light": "#f5f5f5",
        "dark": "#2d2f2e"
      }
    },
    {
      "path": "Colors / Background / Card",
      "type": "color",
      "cssVar": "--mds-bg-card",
      "values": {
        "light": "#ffffff",
        "dark": "#434645"
      }
    },
    {
      "path": "Colors / Text / Primary",
      "type": "color",
      "cssVar": "--mds-text",
      "values": {
        "light": "#171717",
        "dark": "#ffffff"
      }
    },
    {
      "path": "Colors / Accent / Strong",
      "type": "color",
      "cssVar": "--mds-accent",
      "values": {
        "light": "#ff531f",
        "dark": "#ff531f"
      }
    },
    {
      "path": "Typography / Body",
      "type": "fontFamily",
      "cssVar": "--mds-font-body",
      "value": "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
    },
    {
      "path": "Typography / Display",
      "type": "fontFamily",
      "cssVar": "--mds-font-display",
      "value": "'Antonio', sans-serif"
    }
  ],
  "fonts": {
    "googleFonts": "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Antonio:wght@700&display=swap",
    "headSnippet": "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">..."
  }
}
```

---

## 5. Extension UI Design

### 5.1 Wireframe

```
┌────────────────────────────────────────────┐
│  ┌──────────────────────────────────────┐  │
│  │         FLOW STACH                   │  │
│  │         Token Importer               │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │  Design System                       │  │
│  │  ┌────────────────────────────────┐  │  │
│  │  │ My Design System          ▼   │  │  │
│  │  └────────────────────────────────┘  │  │
│  │                                      │  │
│  │  12 colors · 2 fonts · 2 modes       │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │  If variables exist:                 │  │
│  │                                      │  │
│  │  ○ Replace existing variables        │  │
│  │  ○ Create new collection             │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │           Import Tokens              │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │  Status: Ready                       │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

### 5.2 HTML Structure

```html
<!-- public/index.html -->
<div class="extension">
  <header class="header">
    <h1>Flow Stach</h1>
    <p class="subtitle">Token Importer</p>
  </header>

  <section class="token-info">
    <label>Design System</label>
    <select id="design-system">
      <option value="flow-party">Flow Party</option>
      <!-- More options from API -->
    </select>
    <p class="token-summary">
      <span id="color-count">12</span> colors ·
      <span id="font-count">2</span> fonts ·
      <span id="mode-count">2</span> modes
    </p>
  </section>

  <section class="options" id="options-section" style="display: none;">
    <p>Variables already exist:</p>
    <label>
      <input type="radio" name="import-mode" value="replace" checked>
      Replace existing variables
    </label>
    <label>
      <input type="radio" name="import-mode" value="create">
      Create new collection
    </label>
  </section>

  <button id="import-btn" class="btn-primary">
    Import Tokens
  </button>

  <footer class="status">
    <p id="status-message">Ready</p>
  </footer>
</div>
```

### 5.3 Styling (Creative Studio Warmth)

```css
/* public/styles.css */

:root {
  --bg: #2d2f2e;
  --bg-card: #434645;
  --text: #ffffff;
  --text-muted: #767f7a;
  --accent: #ff531f;
  --accent-hover: #e64a1a;
  --radius: 12px;
  --font-body: 'Plus Jakarta Sans', system-ui, sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--text);
  padding: 1rem;
}

.extension {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.header {
  text-align: center;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.header h1 {
  font-size: 1.25rem;
  font-weight: 600;
}

.subtitle {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.token-info {
  background: var(--bg-card);
  padding: 1rem;
  border-radius: var(--radius);
}

.token-info label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.token-info select {
  width: 100%;
  padding: 0.5rem;
  margin-top: 0.5rem;
  background: var(--bg);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: var(--text);
  font-size: 0.875rem;
}

.token-summary {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.options {
  background: var(--bg-card);
  padding: 1rem;
  border-radius: var(--radius);
}

.options label {
  display: block;
  padding: 0.5rem 0;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-primary {
  width: 100%;
  padding: 0.75rem;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 9999px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}

.btn-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.status {
  text-align: center;
  padding-top: 0.5rem;
}

#status-message {
  font-size: 0.75rem;
  color: var(--text-muted);
}

#status-message.success {
  color: #38ef7d;
}

#status-message.error {
  color: #f5576c;
}
```

---

## 6. Core Logic Implementation

### 6.1 Entry Point (index.ts)

```typescript
// src/index.ts

import { importTokens } from './token-importer';
import { TokenManifest } from './types';

// For MVP: Embedded tokens (replace with API fetch later)
const EMBEDDED_TOKENS: TokenManifest = {
  // ... token manifest JSON
};

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
  const importBtn = document.getElementById('import-btn') as HTMLButtonElement;
  const statusEl = document.getElementById('status-message') as HTMLParagraphElement;
  const optionsSection = document.getElementById('options-section') as HTMLElement;

  // Check if collection already exists
  checkExistingCollection();

  // Import button handler
  importBtn.addEventListener('click', async () => {
    importBtn.disabled = true;
    statusEl.textContent = 'Importing...';
    statusEl.className = '';

    try {
      const replaceMode = (document.querySelector('input[name="import-mode"]:checked') as HTMLInputElement)?.value === 'replace';

      await importTokens(EMBEDDED_TOKENS, { replace: replaceMode });

      statusEl.textContent = 'Success! Variables created.';
      statusEl.className = 'success';
    } catch (error) {
      statusEl.textContent = `Error: ${error.message}`;
      statusEl.className = 'error';
    } finally {
      importBtn.disabled = false;
    }
  });
});

async function checkExistingCollection() {
  const collections = await webflow.getVariableCollections();
  const exists = collections.some(c => c.getName() === EMBEDDED_TOKENS.name);

  const optionsSection = document.getElementById('options-section');
  if (exists && optionsSection) {
    optionsSection.style.display = 'block';
  }
}
```

### 6.2 Token Importer (token-importer.ts)

```typescript
// src/token-importer.ts

import { TokenManifest, TokenVariable } from './types';

interface ImportOptions {
  replace: boolean;
}

export async function importTokens(
  manifest: TokenManifest,
  options: ImportOptions
): Promise<void> {

  // Step 1: Check for existing collection
  const collections = await webflow.getVariableCollections();
  const existing = collections.find(c => c.getName() === manifest.name);

  // Step 2: Handle existing collection
  if (existing) {
    if (options.replace) {
      await existing.remove();
    } else {
      // Create with unique name
      manifest.name = `${manifest.name} (${Date.now()})`;
    }
  }

  // Step 3: Create new collection
  const collection = await webflow.createVariableCollection(manifest.name);

  // Step 4: Create modes
  const modeMap = new Map<string, any>();
  for (const modeName of manifest.modes) {
    const mode = await collection.createVariableMode(modeName);
    modeMap.set(modeName.toLowerCase(), mode);
  }

  // Step 5: Create variables
  for (const tokenVar of manifest.variables) {
    await createVariable(collection, tokenVar, modeMap);
  }

  console.log(`Created ${manifest.variables.length} variables in "${manifest.name}"`);
}

async function createVariable(
  collection: any,
  tokenVar: TokenVariable,
  modeMap: Map<string, any>
): Promise<void> {

  if (tokenVar.type === 'color') {
    // Color variable with mode values
    const lightValue = tokenVar.values?.light || '#000000';
    const variable = await collection.createColorVariable(tokenVar.path, lightValue);

    // Set dark mode value if exists
    if (tokenVar.values?.dark) {
      const darkMode = modeMap.get('dark');
      if (darkMode) {
        await variable.set(tokenVar.values.dark, darkMode);
      }
    }

  } else if (tokenVar.type === 'fontFamily') {
    // Font family variable (single value, no modes)
    await collection.createFontFamilyVariable(tokenVar.path, tokenVar.value || 'inherit');
  }
}
```

### 6.3 Types (types.ts)

```typescript
// src/types.ts

export interface TokenManifest {
  schemaVersion: string;
  name: string;
  slug: string;
  namespace: string;
  modes: string[];
  variables: TokenVariable[];
  fonts?: FontConfig;
}

export interface TokenVariable {
  path: string;
  type: 'color' | 'fontFamily';
  cssVar: string;
  values?: {
    light: string;
    dark: string;
  };
  value?: string;
}

export interface FontConfig {
  googleFonts: string;
  headSnippet: string;
}
```

### 6.4 Variable Binding Strategy (Required for Component Insert)
To bind component styles to Variables:
1. Create variables and collect their **IDs** from the Designer API.
2. Build a `cssVar -> variableId` map.
3. When inserting components:
   - If using Webflow JSON, inject variable IDs into the payload before paste.
   - If using Designer API elements, set styles to use variables directly.

---

## 7. Development Workflow

### 7.1 Initial Setup

```bash
# 1. Create project directory
mkdir flow-stach-designer-extension
cd flow-stach-designer-extension

# 2. Initialize with Webflow CLI (if available)
webflow extension init .

# OR manually create files:
# - webflow.json
# - package.json
# - tsconfig.json
# - src/index.ts
# - public/index.html
# - public/styles.css

# 3. Install dependencies
npm install

# 4. Start development server
npm run dev
# OR
webflow extension serve
```

### 7.2 Testing in Webflow Designer

| Step | Action |
|------|--------|
| 1 | Go to `Workspace Settings > Apps & Integrations > App Development` |
| 2 | Find your app, click "..." menu |
| 3 | Select "Install" |
| 4 | Choose a test site |
| 5 | Open the test site in Designer |
| 6 | Press "E" key to open Extensions panel |
| 7 | Find "Flow Stach" in the list |
| 8 | Click "Launch development app" |
| 9 | Extension loads from `localhost:1337` |

### 7.3 Debug Tips

```typescript
// Add console logs to see Designer API responses
console.log('Collections:', await webflow.getVariableCollections());

// Check variable creation
const variable = await collection.createColorVariable('Test', '#ff0000');
console.log('Created variable:', variable.getName(), variable.getValue());
```

### 7.4 Production Build & Deploy

```bash
# 1. Build TypeScript
npm run build
# OR
tsc

# 2. Create bundle
webflow extension bundle
# Creates: bundle.zip

# 3. Upload to Webflow
# Workspace Settings > Apps > Your App > Upload Bundle
# Select bundle.zip
```

---

## 8. Implementation Phases

### Phase 1: Foundation (MVP Setup)
**Goal**: Working extension that shows UI in Designer

| Task | Details |
|------|---------|
| Create project structure | All files listed in Section 3.3 |
| Configure TypeScript | tsconfig.json with correct settings |
| Create webflow.json | Minimal manifest |
| Create basic UI | HTML + CSS from Section 5 |
| Register app in Webflow | Follow Section 3.1 |
| Test extension loads | Verify UI appears in Designer |

**Deliverable**: Extension loads and shows UI (no functionality yet)

---

### Phase 2: Token Import Core
**Goal**: Import hardcoded tokens into Webflow Variables

| Task | Details |
|------|---------|
| Embed token manifest | Hardcode fp-tokens.json in index.ts |
| Implement createVariableCollection | Single collection creation |
| Implement createVariableMode | Light + Dark modes |
| Implement createColorVariable | Loop through color tokens |
| Implement createFontFamilyVariable | Loop through font tokens |
| Set mode-specific values | Dark mode values on color variables |
| Test end-to-end | Verify variables appear in Webflow panel |

**Deliverable**: Click "Import" → Variables created in Webflow

---

### Phase 2.5: Variable ID Mapping
**Goal**: Build a mapping from CSS variables to Webflow Variable IDs

| Task | Details |
|------|---------|
| Capture variable IDs | Store IDs returned by create calls |
| Build cssVar map | Map `--fp-*` to variable IDs |
| Persist map | Keep in memory (MVP) or save via extension storage |

**Deliverable**: Variable map available for insertion

---

### Phase 3: Component Insertion
**Goal**: Insert Webflow elements with bindings

**Path A: Designer API Elements (Preferred)**
- Build a minimal element tree from parsed HTML
- Apply classes + styles + variable bindings via API

**Path B: Webflow JSON Payloads**
- Convert HTML to Webflow JSON in Flow Stach
- Extension rewrites payload to include variable IDs
- Paste payload through extension

**Deliverable**: "Insert Component" works in Designer

---

### Phase 4: Replace/Create Logic
**Goal**: Handle existing variables gracefully

| Task | Details |
|------|---------|
| Detect existing collection | Check by name |
| Show options UI | Radio buttons for replace/create |
| Implement replace flow | Delete old → Create new |
| Implement create new flow | Unique name with timestamp |
| Test both flows | Verify no duplicates, no errors |

**Deliverable**: User can choose to replace or create new

---

### Phase 5: Platform Integration (Future)
**Goal**: Fetch tokens dynamically from Flow Stach API

| Task | Details |
|------|---------|
| Define API endpoint | `GET /api/tokens/{id}` |
| Implement authentication | Flow Stach session/JWT |
| Configure CORS | Allow Designer Extension origin |
| Fetch tokens on load | Replace embedded manifest |
| Handle multiple design systems | Dropdown selector |
| Cache tokens | LocalStorage or similar |

**Deliverable**: Extension fetches tokens from Flow Stach

---

### Phase 5.5: Component Fetch + Insert
**Goal**: Load components from Flow Stach within the extension

| Task | Details |
|------|---------|
| Fetch components | `GET /api/components?designSystem=...` |
| Show list | Simple dropdown or list |
| Insert | Use Path A or Path B |

**Deliverable**: Pick a component and insert it in Designer

---

### Phase 6: Polish & Deploy
**Goal**: Production-ready extension

| Task | Details |
|------|---------|
| Error handling | Try/catch with user messages |
| Loading states | Disable button, show spinner |
| Success feedback | Clear confirmation message |
| Edge cases | Empty tokens, network errors |
| Bundle and upload | Production deployment |
| Documentation | README, user guide |

**Deliverable**: Stable, deployed extension

---

## 9. Security Considerations

| Area | Requirement |
|------|-------------|
| **Client ID** | Store in environment variable, not in code |
| **Client Secret** | Server-side only (if needed for API) |
| **API Authentication** | Validate user session before returning tokens |
| **CORS** | Whitelist Designer Extension origin only |
| **User Data** | Only show tokens user has access to |
| **Input Validation** | Sanitize token manifest before processing |

---

## 10. Success Criteria

| Criterion | Test |
|-----------|------|
| Extension loads | Press "E" in Designer, extension appears |
| Import works | Click button, variables created |
| Modes work | Light mode = default, Dark mode = alternate values |
| Types correct | Colors are colors, fonts are fonts |
| Replace works | Existing collection deleted, new created |
| Create new works | New collection with unique name |
| No duplicates | Running import twice (replace mode) doesn't duplicate |
| Error handling | Clear message on failure |
| UI matches brand | Creative Studio Warmth styling |

---

## 11. Out of Scope (Future Phases)

| Feature | Reason |
|---------|--------|
| Full fidelity HTML → Webflow JSON converter | Large scope, separate planning (only if Designer API lacks element creation) |
| Style creation | Already exists in current app |
| Variable export (Webflow → Flow Stach) | Reverse flow, different use case |
| Multiple simultaneous design systems | One at a time for MVP |
| Real-time sync | Polling/webhooks add complexity |

---

## 12. References

### Webflow Documentation
- [Designer Extensions Overview](https://developers.webflow.com/data/v2.0.0-beta/docs/designer-extensions)
- [Getting Started Guide](https://developers.webflow.com/data/docs/designer-extensions/getting-started)
- [Variables API](https://developers.webflow.com/designer/reference/variables-overview)
- [Variable Modes API](https://developers.webflow.com/designer/reference/variable-modes)
- [Webflow CLI Reference](https://developers.webflow.com/designer/reference/webflow-cli)
- [App Registration Guide](https://developers.webflow.com/apps/data/docs/register-an-app)

### Project Files
- `docs/variables-and-tokens-spec.md` - Token schema and rules
- `docs/fp-tokens.json` - Flow Party token manifest example
- `flow-stach-extension/` - Existing Chrome extension (clipboard helper)

---

## 13. Appendix: Full Token Manifest Example

```json
{
  "schemaVersion": "1.0",
  "name": "Flow Party",
  "slug": "flow-party",
  "namespace": "fp",
  "modes": ["light", "dark"],
  "variables": [
    { "path": "Colors / Background / Base", "type": "color", "cssVar": "--fp-bg", "values": { "light": "#f5f5f5", "dark": "#2d2f2e" } },
    { "path": "Colors / Background / Card", "type": "color", "cssVar": "--fp-bg-card", "values": { "light": "#ffffff", "dark": "#434645" } },
    { "path": "Colors / Text / Primary", "type": "color", "cssVar": "--fp-text", "values": { "light": "#171717", "dark": "#ffffff" } },
    { "path": "Colors / Text / Muted", "type": "color", "cssVar": "--fp-text-muted", "values": { "light": "#afb6b4", "dark": "#767f7a" } },
    { "path": "Colors / Border", "type": "color", "cssVar": "--fp-border", "values": { "light": "#dddfde", "dark": "rgba(255, 255, 255, 0.1)" } },
    { "path": "Colors / Accent / Lightest", "type": "color", "cssVar": "--fp-accent-lightest", "values": { "light": "#fff0eb", "dark": "#fff0eb" } },
    { "path": "Colors / Accent / Light", "type": "color", "cssVar": "--fp-accent-light", "values": { "light": "#ffc8b8", "dark": "#ffc8b8" } },
    { "path": "Colors / Accent / Medium", "type": "color", "cssVar": "--fp-accent-medium", "values": { "light": "#ff9d80", "dark": "#ff9d80" } },
    { "path": "Colors / Accent / Strong", "type": "color", "cssVar": "--fp-accent", "values": { "light": "#ff531f", "dark": "#ff531f" } },
    { "path": "Colors / Accent / Vivid", "type": "color", "cssVar": "--fp-accent-vivid", "values": { "light": "#ff825c", "dark": "#ff825c" } },
    { "path": "Colors / Link / Default", "type": "color", "cssVar": "--fp-link", "values": { "light": "#ff531f", "dark": "#ffffff" } },
    { "path": "Colors / Link / Hover", "type": "color", "cssVar": "--fp-link-hover", "values": { "light": "#ff825c", "dark": "#ff825c" } },
    { "path": "Typography / Body", "type": "fontFamily", "cssVar": "--fp-font-body", "value": "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif" },
    { "path": "Typography / Display", "type": "fontFamily", "cssVar": "--fp-font-display", "value": "'Antonio', sans-serif" }
  ],
  "fonts": {
    "googleFonts": "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Antonio:wght@700&display=swap",
    "headSnippet": "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"><link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin><link href=\"https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Antonio:wght@700&display=swap\" rel=\"stylesheet\">"
  }
}
```

---

**End of Plan Document**

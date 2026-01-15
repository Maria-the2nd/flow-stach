# Action Plan 4: React Project Conversion

## Overview

Convert React projects (folder/zip upload) to single-file HTML/CSS/Vanilla JS for Webflow import.

## Key Principle

**JavaScript is NOT included in the auto-copy Webflow paste.** User must manually copy:
- Vanilla JS code → Webflow embed element OR Project Settings → Custom Code → Before body
- Library CDN links → Project Settings → Custom Code → Head Code

---

## Architecture

```
User Upload (React Project)
    ↓
Parse Project Structure
    ↓
Static Build (or use pre-built dist)
    ↓
┌─────────────────────────────────────┐
│  Extract HTML  │  Extract CSS  │  Convert JS  │  Detect Libs  │
└─────────────────────────────────────┘
    ↓
Output UI (4 copyable sections)
```

---

## Task 4.1: Create React Import Page UI

**Location:** `app/admin/import-react/page.tsx` (NEW)

### Features

- Folder/zip upload component
- Project type detection display (CRA, Vite, Next.js)
- Build status/progress indicator
- Output tabs: HTML, CSS, JavaScript, Libraries, Instructions

### Implementation

```tsx
'use client'

import { useState } from 'react'
import { parseReactProject, type ReactProjectInfo } from '@/lib/react-parser'
import { extractCssFromReact } from '@/lib/react-css-extractor'
import { convertReactToVanilla } from '@/lib/react-to-vanilla'

export default function ImportReactPage() {
  const [projectInfo, setProjectInfo] = useState<ReactProjectInfo | null>(null)
  const [buildStatus, setBuildStatus] = useState<'idle' | 'parsing' | 'building' | 'done' | 'error'>('idle')
  const [outputs, setOutputs] = useState<{
    html: string
    css: string
    vanillaJs: string
    externalLibs: string[]
  } | null>(null)

  const handleUpload = async (files: FileList) => {
    setBuildStatus('parsing')
    const info = await parseReactProject(files)
    setProjectInfo(info)

    setBuildStatus('building')
    // Process and extract outputs
    // ...

    setBuildStatus('done')
  }

  return (
    <div className="container py-8">
      <h1>Import React Project</h1>

      {/* Upload Section */}
      <UploadZone onUpload={handleUpload} />

      {/* Project Info */}
      {projectInfo && <ProjectInfoCard info={projectInfo} />}

      {/* Build Status */}
      {buildStatus !== 'idle' && <BuildStatusIndicator status={buildStatus} />}

      {/* Output Tabs */}
      {outputs && <OutputTabs outputs={outputs} />}
    </div>
  )
}
```

### Subtasks

- [ ] Create page layout with upload zone
- [ ] Create `UploadZone` component (drag & drop, file picker)
- [ ] Create `ProjectInfoCard` component
- [ ] Create `BuildStatusIndicator` component
- [ ] Create `OutputTabs` component with 4 tabs
- [ ] Add route to admin navigation

---

## Task 4.2: Create React Project Parser

**Location:** `lib/react-parser.ts` (NEW)

### Interface

```typescript
export interface ReactProjectInfo {
  framework: 'cra' | 'vite' | 'nextjs' | 'unknown'
  hasTypeScript: boolean
  entryFile: string
  componentFiles: string[]
  cssStrategy: 'css-files' | 'css-modules' | 'tailwind' | 'styled-components' | 'mixed'
  dependencies: Record<string, string>
  externalLibraries: string[]  // GSAP, anime.js, etc.
}

export async function parseReactProject(files: FileList | File[]): Promise<ReactProjectInfo>
```

### Implementation Details

**Framework Detection:**
```typescript
function detectFramework(packageJson: any): ReactProjectInfo['framework'] {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }

  if (deps['next']) return 'nextjs'
  if (deps['vite'] || packageJson.scripts?.dev?.includes('vite')) return 'vite'
  if (deps['react-scripts']) return 'cra'

  return 'unknown'
}
```

**CSS Strategy Detection:**
```typescript
function detectCssStrategy(files: Map<string, string>): ReactProjectInfo['cssStrategy'] {
  const hasModules = [...files.keys()].some(f => f.includes('.module.css'))
  const hasTailwind = files.has('tailwind.config.js') || files.has('tailwind.config.ts')
  const hasStyledComponents = packageJson.dependencies?.['styled-components']

  // Return most specific match
  if (hasStyledComponents) return 'styled-components'
  if (hasTailwind) return 'tailwind'
  if (hasModules) return 'css-modules'
  return 'css-files'
}
```

**External Library Detection:**
```typescript
const KNOWN_ANIMATION_LIBS = ['gsap', 'animejs', 'framer-motion', 'locomotive-scroll', 'lenis', 'swiper']

function detectExternalLibraries(packageJson: any): string[] {
  const deps = Object.keys(packageJson.dependencies || {})
  return deps.filter(dep => KNOWN_ANIMATION_LIBS.some(lib => dep.includes(lib)))
}
```

### Subtasks

- [ ] Implement `parseReactProject` function
- [ ] Implement `detectFramework`
- [ ] Implement `detectCssStrategy`
- [ ] Implement `detectExternalLibraries`
- [ ] Add TypeScript detection
- [ ] Add entry file detection for each framework

---

## Task 4.3: Create React Static Builder

**Location:** `lib/react-builder.ts` (NEW)

### Interface

```typescript
export interface BuildResult {
  html: string
  cssFiles: string[]
  jsBundle: string
  success: boolean
  errors: string[]
}

export async function buildReactToStatic(
  projectInfo: ReactProjectInfo,
  files: Map<string, string>
): Promise<BuildResult>
```

### MVP Approach: Pre-Built Upload

For MVP, require user to upload already-built `dist/` or `build/` folder:

```typescript
export async function extractFromBuild(files: Map<string, string>): Promise<BuildResult> {
  // Look for build output
  const indexHtml = files.get('dist/index.html') || files.get('build/index.html')
  const cssFiles = [...files.entries()]
    .filter(([path]) => path.endsWith('.css'))
    .map(([_, content]) => content)
  const jsBundle = [...files.entries()]
    .filter(([path]) => path.endsWith('.js') && !path.includes('chunk'))
    .map(([_, content]) => content)
    .join('\n')

  return {
    html: indexHtml || '',
    cssFiles,
    jsBundle,
    success: !!indexHtml,
    errors: indexHtml ? [] : ['No index.html found in dist/build folder']
  }
}
```

### Future: Browser-Based Building

Options for future enhancement:
1. **WebContainers** - StackBlitz's technology
2. **esbuild-wasm** - Fast bundler in browser
3. **Backend service** - Node.js server runs build

### Subtasks

- [ ] Implement `extractFromBuild` for pre-built projects
- [ ] Add dist/build folder detection
- [ ] Handle missing build output gracefully
- [ ] Document "build locally first" requirement in UI

---

## Task 4.4: Create CSS Extractor

**Location:** `lib/react-css-extractor.ts` (NEW)

### Interface

```typescript
export interface CssExtractionResult {
  combinedCss: string
  tokensCss: string      // CSS variables from :root
  componentCss: string   // Component-specific styles
  tailwindCss?: string   // If Tailwind detected
  warnings: string[]
}

export function extractCssFromReact(
  buildResult: BuildResult,
  projectInfo: ReactProjectInfo
): CssExtractionResult
```

### Implementation

```typescript
export function extractCssFromReact(
  buildResult: BuildResult,
  projectInfo: ReactProjectInfo
): CssExtractionResult {
  const combinedCss = buildResult.cssFiles.join('\n\n')

  // Extract :root variables
  const rootMatch = combinedCss.match(/:root\s*\{[^}]+\}/g)
  const tokensCss = rootMatch ? rootMatch.join('\n') : ''

  // Remove :root from component CSS
  const componentCss = combinedCss.replace(/:root\s*\{[^}]+\}/g, '')

  const warnings: string[] = []

  // Handle CSS Modules (class names get hashed)
  if (projectInfo.cssStrategy === 'css-modules') {
    warnings.push('CSS Modules detected: class names may be hashed. Consider using regular CSS for Webflow compatibility.')
  }

  // Handle Tailwind
  let tailwindCss: string | undefined
  if (projectInfo.cssStrategy === 'tailwind') {
    // Tailwind output is already in the built CSS
    tailwindCss = combinedCss
  }

  return {
    combinedCss,
    tokensCss,
    componentCss,
    tailwindCss,
    warnings
  }
}
```

### Subtasks

- [ ] Implement `extractCssFromReact`
- [ ] Extract `:root` CSS variables
- [ ] Handle CSS Modules (warn about hashed names)
- [ ] Handle Tailwind (extract from build output)
- [ ] Handle styled-components (extract from build)
- [ ] Return warnings for unsupported patterns

---

## Task 4.5: Create React-to-Vanilla JS Converter

**Location:** `lib/react-to-vanilla.ts` (NEW)

### Interface

```typescript
export interface VanillaConversionResult {
  vanillaJs: string
  unconvertedPatterns: string[]
  externalDependencies: string[]
  warnings: string[]
}

export function convertReactToVanilla(
  jsBundle: string,
  projectInfo: ReactProjectInfo
): VanillaConversionResult
```

### Conversion Patterns

| React Pattern | Vanilla JS Equivalent |
|--------------|----------------------|
| `useState` for toggles | `element.classList.toggle()` |
| `useState` for visibility | `element.style.display` |
| `onClick` handlers | `element.addEventListener('click', ...)` |
| `useEffect` for scroll | `window.addEventListener('scroll', ...)` |
| `useEffect` for intersection | `IntersectionObserver` |
| GSAP animations | Keep as-is (GSAP is vanilla-compatible) |
| Framer Motion | Convert to GSAP or CSS animations |

### Implementation Approach

For MVP, focus on extracting and preserving GSAP/vanilla-compatible code:

```typescript
export function convertReactToVanilla(
  jsBundle: string,
  projectInfo: ReactProjectInfo
): VanillaConversionResult {
  const warnings: string[] = []
  const unconvertedPatterns: string[] = []

  // Extract GSAP animations (already vanilla-compatible)
  const gsapCode = extractGsapAnimations(jsBundle)

  // Extract vanilla event listeners
  const eventListeners = extractEventListeners(jsBundle)

  // Identify patterns we can't convert
  if (jsBundle.includes('useState')) {
    unconvertedPatterns.push('useState (React state management)')
  }
  if (jsBundle.includes('useContext')) {
    unconvertedPatterns.push('useContext (React context)')
  }
  if (jsBundle.includes('framer-motion')) {
    unconvertedPatterns.push('Framer Motion animations')
    warnings.push('Framer Motion detected. Consider recreating animations with Webflow Interactions or GSAP.')
  }

  const vanillaJs = [
    '// Extracted animations and interactions',
    gsapCode,
    eventListeners,
  ].filter(Boolean).join('\n\n')

  return {
    vanillaJs,
    unconvertedPatterns,
    externalDependencies: projectInfo.externalLibraries,
    warnings
  }
}
```

### Subtasks

- [ ] Implement basic `convertReactToVanilla`
- [ ] Create `extractGsapAnimations` helper
- [ ] Create `extractEventListeners` helper
- [ ] Identify and report unconvertible patterns
- [ ] Document limitations clearly

---

## Task 4.6: Create Output UI Component

**Location:** `app/admin/import-react/components/ReactOutput.tsx` (NEW)

### Four Sections

1. **HTML** - Auto-copies to Webflow clipboard
2. **CSS** - Included with HTML in Webflow paste
3. **JavaScript** - Manual copy with instructions
4. **External Libraries** - Manual copy with instructions

### Implementation

```tsx
interface ReactOutputProps {
  html: string
  css: string
  vanillaJs: string
  externalLibs: string[]
  warnings: string[]
  unconvertedPatterns: string[]
}

export function ReactOutput({
  html, css, vanillaJs, externalLibs, warnings, unconvertedPatterns
}: ReactOutputProps) {
  return (
    <Tabs defaultValue="html">
      <TabsList>
        <TabsTrigger value="html">HTML</TabsTrigger>
        <TabsTrigger value="css">CSS</TabsTrigger>
        <TabsTrigger value="js">JavaScript</TabsTrigger>
        <TabsTrigger value="libs">Libraries</TabsTrigger>
      </TabsList>

      <TabsContent value="html">
        <Card>
          <CardHeader>
            <CardTitle>HTML for Webflow</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => copyToWebflowClipboard(html, css)}>
              Copy HTML+CSS for Webflow
            </Button>
            <CodePreview code={html} language="html" />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="js">
        <Card>
          <CardHeader>
            <CardTitle>JavaScript (Manual Copy)</CardTitle>
            <CardDescription>
              This code must be added manually to Webflow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                <strong>How to add to Webflow:</strong>
                <ul className="list-disc list-inside mt-2">
                  <li>Option A: Add HTML Embed element, wrap in {'<script>'} tags</li>
                  <li>Option B: Project Settings → Custom Code → Before {'</body>'}</li>
                </ul>
              </AlertDescription>
            </Alert>
            <Button onClick={() => copyToClipboard(vanillaJs)}>
              Copy JavaScript
            </Button>
            <CodePreview code={vanillaJs} language="javascript" />
          </CardContent>
        </Card>

        {unconvertedPatterns.length > 0 && (
          <Alert variant="warning">
            <AlertTitle>Patterns Not Converted</AlertTitle>
            <AlertDescription>
              <p>These React patterns couldn't be automatically converted:</p>
              <ul className="list-disc list-inside">
                {unconvertedPatterns.map(p => <li key={p}>{p}</li>)}
              </ul>
              <p className="mt-2">You may need to recreate these interactions in Webflow.</p>
            </AlertDescription>
          </Alert>
        )}
      </TabsContent>

      <TabsContent value="libs">
        <LibraryInstructions libraries={externalLibs} />
      </TabsContent>
    </Tabs>
  )
}
```

### Subtasks

- [ ] Create `ReactOutput` component
- [ ] Create `CodePreview` component with syntax highlighting
- [ ] Create `LibraryInstructions` component
- [ ] Add copy buttons for each section
- [ ] Display warnings and unconverted patterns

---

## Common Library CDN Mappings

```typescript
export const LIBRARY_CDNS: Record<string, string> = {
  'gsap': 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js',
  'gsap/ScrollTrigger': 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js',
  'gsap/ScrollToPlugin': 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollToPlugin.min.js',
  'animejs': 'https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js',
  'locomotive-scroll': 'https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.js',
  'swiper': 'https://cdn.jsdelivr.net/npm/swiper@10/swiper-bundle.min.js',
  'lenis': 'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.19/dist/lenis.min.js',
}
```

---

## Limitations to Document

Clearly communicate these limitations in the UI:

| Category | Status | Notes |
|----------|--------|-------|
| Toggle states | Supported | Converts to classList.toggle() |
| Visibility | Supported | Converts to style.display |
| Scroll animations | Supported | GSAP/Intersection Observer |
| GSAP | Fully Supported | Already vanilla-compatible |
| Form validation | Partial | Basic validation only |
| Complex state (Redux, Zustand) | Not Supported | Recommend Webflow CMS |
| API calls | Not Supported | Use Webflow integrations |
| Routing | Not Supported | Use Webflow pages |
| Server components | Not Supported | N/A for static sites |
| Framer Motion | Partial | Recommend GSAP conversion |

---

## Acceptance Criteria

- [ ] React import page accessible at `/admin/import-react`
- [ ] Folder/zip upload working
- [ ] Project info (framework, CSS strategy) displayed
- [ ] HTML output copyable to Webflow
- [ ] CSS combined and included with HTML
- [ ] JavaScript displayed with clear manual copy instructions
- [ ] External libraries listed with CDN links
- [ ] Warnings displayed for unconvertible patterns
- [ ] Documentation of limitations visible to user

## Dependencies

- **Action Plan 1 (CSS Unit Support)** - Ensures extracted CSS preserves units
- **JSZip library** - For zip file handling

## MVP Scope

For initial release:
1. Support pre-built projects (user runs `npm build` first)
2. Support CRA and Vite frameworks
3. Extract HTML/CSS from build output
4. Detect and list external libraries
5. Show warnings for unsupported patterns (don't try to convert everything)

Future enhancements:
- Browser-based building (WebContainers or esbuild-wasm)
- Next.js static export support
- Framer Motion → GSAP conversion
- More sophisticated state extraction

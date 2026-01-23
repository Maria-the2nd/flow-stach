# PROMPT 7: Canvas/WebGL Detection & Container Validation

**Priority:** CRITICAL  
**Complexity:** Low  
**Estimated Time:** 30 minutes  
**Coverage Impact:** +1.5%

---

## Context

Flow Bridge converts HTML to Webflow JSON. Three.js, Matter.js, Curtains.js, and other canvas-based libraries require a container element with a specific ID for rendering. The JS library detector already identifies these libraries, but we don't validate that the HTML contains the required container elements.

When a user pastes a Three.js component without a proper canvas container, the JavaScript executes but has nowhere to render—resulting in a blank section with console errors.

---

## Requirements

### 1. Detect Canvas/WebGL Usage Patterns in JavaScript

Add detection for these patterns:

```javascript
// Three.js
new THREE.WebGLRenderer()
new THREE.Scene()
THREE.WebGLRenderer
renderer.setSize()

// Matter.js
Matter.Engine.create()
Matter.Render.create()
Matter.Runner.create()

// Curtains.js
new Curtains()
Curtains({

// Generic Canvas
document.createElement('canvas')
.getContext('webgl')
.getContext('webgl2')
.getContext('2d')
canvas.getContext

// PixiJS
new PIXI.Application()
PIXI.autoDetectRenderer()

// p5.js
createCanvas(
new p5(
```

### 2. Scan HTML for Existing Canvas Containers

Look for:
- `<canvas>` elements (with or without ID)
- `<canvas id="xxx">` - extract the ID
- Container divs with common IDs:
  - `#canvas-container`
  - `#webgl-container`
  - `#three-container`
  - `#matter-container`
  - `#gl-canvas`
  - `#app` (common for Three.js)
  - `#scene`

### 3. Cross-Reference and Validate

If canvas/WebGL detected in JS:
1. Check if HTML contains `<canvas>` element
2. Check if HTML contains container with matching ID pattern
3. If neither found → WARNING with suggestion

### 4. Preserve Canvas Attributes

When canvas element exists, preserve all attributes:
- `id`
- `width` / `height`
- `data-*` attributes
- `class`
- `style`

---

## Files to Modify

### `lib/js-library-detector.ts`

Add new functions and extend existing detection:

```typescript
// Add to existing file

export interface CanvasDetectionResult {
  detected: boolean;
  libraries: CanvasLibrary[];
  patterns: CanvasPattern[];
  suggestedContainerId: string;
  suggestedContainerHtml: string;
}

export type CanvasLibrary = 
  | 'threejs' 
  | 'matterjs' 
  | 'curtainsjs' 
  | 'pixijs' 
  | 'p5js'
  | 'generic-canvas' 
  | 'generic-webgl';

export interface CanvasPattern {
  library: CanvasLibrary;
  pattern: string;
  line?: number;
}

export function detectCanvasWebGL(jsCode: string): CanvasDetectionResult;

export interface CanvasContainerValidation {
  hasCanvas: boolean;
  hasContainer: boolean;
  canvasIds: string[];
  containerIds: string[];
  isValid: boolean;
  warnings: ValidationWarning[];
}

export function validateCanvasContainer(
  html: string, 
  detection: CanvasDetectionResult
): CanvasContainerValidation;
```

### `lib/preflight-validator.ts`

Add canvas validation to the preflight checks:

```typescript
// Add to runPreflightValidation()

const canvasDetection = detectCanvasWebGL(jsCode);
if (canvasDetection.detected) {
  const containerValidation = validateCanvasContainer(html, canvasDetection);
  if (!containerValidation.isValid) {
    results.warnings.push(...containerValidation.warnings);
  }
}
```

### `lib/webflow-converter.ts`

Include canvas validation in meta output:

```typescript
// Add to WebflowPayload.meta interface
canvasValidation?: {
  detected: boolean;
  libraries: string[];
  hasContainer: boolean;
  warnings: string[];
};
```

---

## Implementation Details

### Detection Regex Patterns

```typescript
const CANVAS_PATTERNS: Record<CanvasLibrary, RegExp[]> = {
  threejs: [
    /new\s+THREE\./,
    /THREE\.WebGLRenderer/,
    /THREE\.Scene\s*\(/,
    /THREE\.PerspectiveCamera/,
    /THREE\.OrthographicCamera/,
  ],
  matterjs: [
    /Matter\.Engine\.create/,
    /Matter\.Render\.create/,
    /Matter\.Runner\.create/,
    /Matter\.World\./,
    /Matter\.Bodies\./,
  ],
  curtainsjs: [
    /new\s+Curtains\s*\(/,
    /Curtains\s*\(\s*\{/,
  ],
  pixijs: [
    /new\s+PIXI\.Application/,
    /PIXI\.autoDetectRenderer/,
    /new\s+PIXI\.Renderer/,
  ],
  p5js: [
    /createCanvas\s*\(/,
    /new\s+p5\s*\(/,
  ],
  'generic-canvas': [
    /document\.createElement\s*\(\s*['"]canvas['"]\s*\)/,
    /\.getContext\s*\(\s*['"]2d['"]\s*\)/,
  ],
  'generic-webgl': [
    /\.getContext\s*\(\s*['"]webgl2?['"]\s*\)/,
    /WebGLRenderingContext/,
    /WebGL2RenderingContext/,
  ],
};
```

### Container Detection

```typescript
const CONTAINER_ID_PATTERNS = [
  /id\s*=\s*["']([^"']*canvas[^"']*)["']/gi,
  /id\s*=\s*["']([^"']*webgl[^"']*)["']/gi,
  /id\s*=\s*["']([^"']*three[^"']*)["']/gi,
  /id\s*=\s*["']([^"']*matter[^"']*)["']/gi,
  /id\s*=\s*["']([^"']*gl[^"']*)["']/gi,
  /id\s*=\s*["'](app|scene|container)["']/gi,
];

const CANVAS_ELEMENT_REGEX = /<canvas\b[^>]*>/gi;
```

### Suggested Container HTML

```typescript
function getSuggestedContainer(libraries: CanvasLibrary[]): string {
  const primaryLib = libraries[0];
  const id = `${primaryLib}-container`;
  
  return `<div id="${id}" style="width: 100%; height: 100vh;"></div>`;
}
```

---

## Test Cases

```typescript
describe('detectCanvasWebGL', () => {
  it('should detect Three.js', () => {
    const js = `
      const scene = new THREE.Scene();
      const renderer = new THREE.WebGLRenderer();
    `;
    const result = detectCanvasWebGL(js);
    expect(result.detected).toBe(true);
    expect(result.libraries).toContain('threejs');
  });

  it('should detect Matter.js', () => {
    const js = `
      const engine = Matter.Engine.create();
      const render = Matter.Render.create({ element: container });
    `;
    const result = detectCanvasWebGL(js);
    expect(result.detected).toBe(true);
    expect(result.libraries).toContain('matterjs');
  });

  it('should detect generic canvas', () => {
    const js = `
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
    `;
    const result = detectCanvasWebGL(js);
    expect(result.detected).toBe(true);
    expect(result.libraries).toContain('generic-canvas');
  });

  it('should not detect when no canvas usage', () => {
    const js = `
      const button = document.querySelector('.btn');
      button.addEventListener('click', () => console.log('clicked'));
    `;
    const result = detectCanvasWebGL(js);
    expect(result.detected).toBe(false);
  });
});

describe('validateCanvasContainer', () => {
  it('should pass when canvas element exists', () => {
    const html = `<div><canvas id="myCanvas"></canvas></div>`;
    const detection = { detected: true, libraries: ['threejs'] };
    const result = validateCanvasContainer(html, detection);
    expect(result.isValid).toBe(true);
  });

  it('should pass when container div exists', () => {
    const html = `<div id="three-container"></div>`;
    const detection = { detected: true, libraries: ['threejs'] };
    const result = validateCanvasContainer(html, detection);
    expect(result.isValid).toBe(true);
  });

  it('should warn when no container found', () => {
    const html = `<div class="hero"><h1>Hello</h1></div>`;
    const detection = { detected: true, libraries: ['threejs'], suggestedContainerId: 'threejs-container' };
    const result = validateCanvasContainer(html, detection);
    expect(result.isValid).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].message).toContain('canvas container');
  });
});
```

---

## Warning Message Templates

```typescript
const CANVAS_WARNINGS = {
  NO_CONTAINER: (lib: string, suggestedId: string) => ({
    severity: 'warning' as const,
    code: 'CANVAS_NO_CONTAINER',
    message: `${lib} detected but no canvas container found in HTML`,
    suggestion: `Add a container element: <div id="${suggestedId}" style="width: 100%; height: 100vh;"></div>`,
  }),
  
  NO_CANVAS_ELEMENT: (lib: string) => ({
    severity: 'warning' as const,
    code: 'CANVAS_NO_ELEMENT',
    message: `${lib} detected but no <canvas> element found`,
    suggestion: `Ensure your JavaScript creates the canvas or add: <canvas id="canvas"></canvas>`,
  }),
  
  MULTIPLE_CANVAS: (count: number) => ({
    severity: 'info' as const,
    code: 'CANVAS_MULTIPLE',
    message: `Multiple canvas elements detected (${count})`,
    suggestion: `Verify each canvas has a unique ID for proper JavaScript targeting`,
  }),
};
```

---

## Integration Checklist

- [ ] Add `CanvasDetectionResult` interface to `js-library-detector.ts`
- [ ] Implement `detectCanvasWebGL()` function
- [ ] Implement `validateCanvasContainer()` function
- [ ] Add canvas validation to `runPreflightValidation()` in `preflight-validator.ts`
- [ ] Add `canvasValidation` to `WebflowPayload.meta` interface
- [ ] Update admin import page to display canvas warnings
- [ ] Add unit tests
- [ ] Test with real Three.js/Matter.js examples

---

## Success Criteria

1. Three.js code without container generates WARNING
2. Matter.js code without container generates WARNING
3. Code with proper canvas element passes validation
4. Code with container div (matching ID pattern) passes validation
5. Warning message includes suggested HTML to add
6. No false positives on non-canvas JavaScript

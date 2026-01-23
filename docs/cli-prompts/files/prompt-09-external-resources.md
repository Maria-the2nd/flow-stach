# PROMPT 9: External Resource Detection & Warnings

**Priority:** CRITICAL  
**Complexity:** Low  
**Estimated Time:** 20 minutes  
**Coverage Impact:** +1%

---

## Context

External stylesheets (`<link rel="stylesheet">`) and scripts (`<script src="">`) referenced in HTML won't be automatically included in the Webflow paste. Users need explicit warnings about these resources so they can manually add them to Webflow's custom code settings.

The JS library detector handles known libraries (GSAP, Swiper, etc.), but unknown external resources slip through silently.

---

## Requirements

### 1. Detect External Stylesheets

```html
<!-- CDN stylesheets -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">

<!-- Relative stylesheets (PROBLEM) -->
<link rel="stylesheet" href="./styles/main.css">
<link rel="stylesheet" href="../assets/theme.css">
<link rel="stylesheet" href="/css/custom.css">
```

### 2. Detect External Scripts

```html
<!-- CDN scripts -->
<script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>

<!-- Relative scripts (PROBLEM) -->
<script src="./js/app.js"></script>
<script src="../scripts/custom.js"></script>
```

### 3. Classify Resources

| URL Type | Example | Severity | Action |
|----------|---------|----------|--------|
| CDN (known) | cdnjs.cloudflare.com | INFO | Already handled by library detector |
| CDN (unknown) | some-cdn.com/lib.js | WARNING | User must add to custom code |
| Google Fonts | fonts.googleapis.com | INFO | Detected and reported |
| Relative | ./styles/main.css | ERROR | Cannot load - must inline or host |
| Protocol-relative | //cdn.com/lib.js | WARNING | Upgrade to https:// |

### 4. Known CDN Domains

```typescript
const KNOWN_CDN_DOMAINS = [
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'ajax.googleapis.com',
  'code.jquery.com',
  'stackpath.bootstrapcdn.com',
  'cdn.tailwindcss.com',
  'kit.fontawesome.com',
  'use.fontawesome.com',
  'cdn.fontawesome.com',
  'cdn.plyr.io',
  'player.vimeo.com',
  'www.youtube.com',
  'cdn.ampproject.org',
];
```

---

## Files to Create/Modify

### Create: `lib/external-resource-detector.ts`

```typescript
/**
 * External Resource Detector
 * Detects and classifies external stylesheets and scripts in HTML
 */

export interface ExternalResource {
  type: 'stylesheet' | 'script';
  url: string;
  originalTag: string;        // The full HTML tag
  urlType: 'cdn' | 'relative' | 'protocol-relative' | 'absolute-unknown';
  cdnDomain?: string;         // If CDN, which domain
  isKnownCDN: boolean;        // Is it a known/trusted CDN
  isHandledByLibraryDetector: boolean;  // Already handled?
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion: string;
}

export interface ExternalResourceResult {
  stylesheets: ExternalResource[];
  scripts: ExternalResource[];
  googleFonts: GoogleFontInfo[];
  
  // Summary
  hasErrors: boolean;         // Any relative resources
  hasWarnings: boolean;       // Any unknown CDN resources
  errorCount: number;
  warningCount: number;
  infoCount: number;
  
  // Actionable output
  customCodeInstructions: string[];  // What user needs to add to Webflow
}

export interface GoogleFontInfo {
  url: string;
  families: string[];
  weights: string[];
}

// Main functions
export function detectExternalResources(html: string): ExternalResourceResult;
export function classifyURL(url: string): ExternalResource['urlType'];
export function isKnownCDN(url: string): boolean;
export function parseGoogleFontsURL(url: string): GoogleFontInfo | null;
```

### Modify: `lib/html-parser.ts`

Add resource detection to HTML parsing:

```typescript
import { detectExternalResources } from './external-resource-detector';

// In extractStyleContent or similar
export function parseHTML(html: string) {
  // ... existing parsing ...
  
  const externalResources = detectExternalResources(html);
  
  return {
    // ... existing return values ...
    externalResources,
  };
}
```

### Modify: `lib/webflow-converter.ts`

Add to payload meta:

```typescript
// In WebflowPayload.meta
externalResources?: {
  hasErrors: boolean;
  hasWarnings: boolean;
  stylesheets: number;
  scripts: number;
  instructions: string[];
};
```

---

## Implementation Details

### Regex Patterns

```typescript
// Stylesheet detection
const LINK_STYLESHEET_PATTERN = /<link\s+[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi;
const LINK_HREF_PATTERN = /href\s*=\s*["']([^"']+)["']/i;

// Script detection (with src attribute only)
const SCRIPT_SRC_PATTERN = /<script\s+[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi;

// URL classification
function classifyURL(url: string): 'cdn' | 'relative' | 'protocol-relative' | 'absolute-unknown' {
  if (url.startsWith('//')) {
    return 'protocol-relative';
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Check if known CDN
    const domain = new URL(url).hostname;
    if (KNOWN_CDN_DOMAINS.some(cdn => domain.includes(cdn))) {
      return 'cdn';
    }
    return 'absolute-unknown';
  }
  // Relative: starts with ./, ../, /, or just filename
  return 'relative';
}
```

### Google Fonts Parsing

```typescript
function parseGoogleFontsURL(url: string): GoogleFontInfo | null {
  if (!url.includes('fonts.googleapis.com')) {
    return null;
  }
  
  try {
    const urlObj = new URL(url);
    const family = urlObj.searchParams.get('family');
    
    if (!family) return null;
    
    // Parse "Inter:wght@400;700" format
    const families: string[] = [];
    const weights: string[] = [];
    
    family.split('|').forEach(f => {
      const [name, specs] = f.split(':');
      families.push(name.replace(/\+/g, ' '));
      
      if (specs) {
        const weightMatch = specs.match(/wght@([0-9;]+)/);
        if (weightMatch) {
          weights.push(...weightMatch[1].split(';'));
        }
      }
    });
    
    return { url, families, weights };
  } catch {
    return null;
  }
}
```

### Message Generation

```typescript
function generateMessage(resource: Partial<ExternalResource>): { message: string; suggestion: string } {
  const { type, url, urlType } = resource;
  
  switch (urlType) {
    case 'relative':
      return {
        message: `Relative ${type} "${url}" cannot be loaded in Webflow`,
        suggestion: `Inline this ${type === 'stylesheet' ? 'CSS' : 'JavaScript'} or host it externally and use an absolute URL`,
      };
    
    case 'protocol-relative':
      return {
        message: `Protocol-relative ${type} "${url}" should use HTTPS`,
        suggestion: `Change to https:${url}`,
      };
    
    case 'absolute-unknown':
      return {
        message: `External ${type} from unknown source: ${url}`,
        suggestion: `Add this to Webflow Project Settings → Custom Code → ${type === 'stylesheet' ? 'Head' : 'Footer'} Code`,
      };
    
    case 'cdn':
      return {
        message: `External ${type} from CDN: ${url}`,
        suggestion: `This may be auto-handled. If not, add to Webflow custom code.`,
      };
    
    default:
      return { message: '', suggestion: '' };
  }
}
```

---

## Test Cases

```typescript
describe('detectExternalResources', () => {
  it('should detect CDN stylesheets', () => {
    const html = `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">`;
    const result = detectExternalResources(html);
    expect(result.stylesheets).toHaveLength(1);
    expect(result.stylesheets[0].isKnownCDN).toBe(true);
    expect(result.stylesheets[0].severity).toBe('info');
  });

  it('should flag relative stylesheets as error', () => {
    const html = `<link rel="stylesheet" href="./styles/main.css">`;
    const result = detectExternalResources(html);
    expect(result.stylesheets).toHaveLength(1);
    expect(result.stylesheets[0].urlType).toBe('relative');
    expect(result.stylesheets[0].severity).toBe('error');
    expect(result.hasErrors).toBe(true);
  });

  it('should detect Google Fonts', () => {
    const html = `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">`;
    const result = detectExternalResources(html);
    expect(result.googleFonts).toHaveLength(1);
    expect(result.googleFonts[0].families).toContain('Inter');
    expect(result.googleFonts[0].weights).toContain('400');
    expect(result.googleFonts[0].weights).toContain('700');
  });

  it('should detect external scripts', () => {
    const html = `<script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>`;
    const result = detectExternalResources(html);
    expect(result.scripts).toHaveLength(1);
    expect(result.scripts[0].isKnownCDN).toBe(true);
  });

  it('should flag relative scripts as error', () => {
    const html = `<script src="./js/app.js"></script>`;
    const result = detectExternalResources(html);
    expect(result.scripts).toHaveLength(1);
    expect(result.scripts[0].severity).toBe('error');
  });

  it('should ignore inline scripts', () => {
    const html = `<script>console.log('hello');</script>`;
    const result = detectExternalResources(html);
    expect(result.scripts).toHaveLength(0);
  });

  it('should warn about unknown CDNs', () => {
    const html = `<script src="https://unknown-cdn.com/lib.js"></script>`;
    const result = detectExternalResources(html);
    expect(result.scripts[0].urlType).toBe('absolute-unknown');
    expect(result.scripts[0].severity).toBe('warning');
    expect(result.hasWarnings).toBe(true);
  });

  it('should generate custom code instructions', () => {
    const html = `
      <link rel="stylesheet" href="https://some-cdn.com/style.css">
      <script src="https://some-cdn.com/app.js"></script>
    `;
    const result = detectExternalResources(html);
    expect(result.customCodeInstructions.length).toBeGreaterThan(0);
  });
});

describe('parseGoogleFontsURL', () => {
  it('should parse single family', () => {
    const url = 'https://fonts.googleapis.com/css2?family=Inter';
    const result = parseGoogleFontsURL(url);
    expect(result?.families).toContain('Inter');
  });

  it('should parse multiple families', () => {
    const url = 'https://fonts.googleapis.com/css2?family=Inter|Roboto';
    const result = parseGoogleFontsURL(url);
    expect(result?.families).toContain('Inter');
    expect(result?.families).toContain('Roboto');
  });

  it('should parse weights', () => {
    const url = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700';
    const result = parseGoogleFontsURL(url);
    expect(result?.weights).toEqual(['400', '500', '700']);
  });
});
```

---

## UI Display

In the admin import page, show:

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ External Resources Detected                              │
├─────────────────────────────────────────────────────────────┤
│ ❌ ERROR: ./styles/main.css cannot be loaded                │
│    → Inline this CSS or host externally                     │
│                                                             │
│ ⚠️ WARNING: https://some-cdn.com/lib.js                     │
│    → Add to Webflow Project Settings → Custom Code          │
│                                                             │
│ ℹ️ Google Fonts: Inter (400, 700)                           │
│    → Already handled via Google Fonts integration           │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration Checklist

- [ ] Create `lib/external-resource-detector.ts`
- [ ] Implement URL classification logic
- [ ] Implement Google Fonts URL parsing
- [ ] Add known CDN domain list
- [ ] Generate actionable messages and suggestions
- [ ] Integrate into HTML parsing pipeline
- [ ] Add to `WebflowPayload.meta`
- [ ] Update admin import page to display warnings
- [ ] Add unit tests
- [ ] Test with real HTML containing mixed resources

---

## Success Criteria

1. Relative stylesheets flagged as ERROR
2. Relative scripts flagged as ERROR
3. Unknown CDN resources flagged as WARNING
4. Known CDN resources flagged as INFO
5. Google Fonts parsed and families/weights extracted
6. Inline scripts/styles ignored (not external)
7. Clear instructions for user action
8. Protocol-relative URLs get upgrade suggestion

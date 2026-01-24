# Style Guide Developer Guide

Technical reference for developers working with the Style Guide system.

## Architecture Overview

### Three-Layer System

```
┌─────────────────────────────────────────┐
│          Presentation Layer             │
│  (React Components + UI Logic)          │
│  - style-guide-view.tsx                 │
│  - Individual section components        │
│  - Copy buttons with toast feedback     │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│          Business Logic Layer           │
│  (Token Processing + Generation)        │
│  - token-extractor.ts                   │
│  - webflow-style-guide-generator.ts     │
│  - Token categorization & formatting    │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│            Data Layer                   │
│  (Convex Database + Artifacts)          │
│  - importProjects.designTokens          │
│  - importArtifacts (styles_css)         │
└─────────────────────────────────────────┘
```

## File Structure

```
flow-stach/
├── lib/
│   ├── token-extractor.ts              # Core extraction logic
│   └── webflow-style-guide-generator.ts # Webflow payload generation
│
├── components/
│   ├── workspace/
│   │   └── project-details-view.tsx    # Integration point
│   └── project/
│       └── style-guide/                # UI components
│           ├── style-guide-view.tsx    # Main orchestrator
│           ├── copy-button.tsx         # Copy utilities
│           ├── variables-section.tsx   # Colors
│           ├── typography-section.tsx  # Typography
│           ├── spacing-section.tsx     # Spacing
│           ├── radius-section.tsx      # Border radius
│           └── shadows-section.tsx     # Shadows
│
├── convex/
│   ├── schema.ts                       # Database schema
│   └── import.ts                       # Import mutations
│
└── docs/
    └── features/
        ├── STYLE_GUIDE.md              # User docs
        ├── STYLE_GUIDE_QUICK_REFERENCE.md
        ├── STYLE_GUIDE_WORKFLOW.md
        ├── STYLE_GUIDE_COMPARISON.md
        └── STYLE_GUIDE_DEVELOPER_GUIDE.md  # This file
```

## Core Modules

### 1. Token Extractor (`lib/token-extractor.ts`)

**Purpose:** Parse CSS and extract design tokens

**Key Functions:**

```typescript
// Main extraction entry point
extractEnhancedTokens(css: string, html?: string, name?: string): EnhancedTokenExtraction

// Individual extractors
extractRadiusTokens(css: string): RadiusToken[]
extractShadowTokens(css: string): ShadowToken[]
extractUIElements(css: string): { buttons?, inputs? }

// Legacy support
extractTokens(css: string, html?: string, name?: string): TokenExtraction
```

**How It Works:**

1. **Find :root blocks** using regex pattern matching
2. **Extract CSS variables** with pattern `--variable-name: value;`
3. **Categorize** based on name patterns and value formats
4. **Pair light/dark** mode variants if detected
5. **Return structured data** ready for UI consumption

**Regex Patterns:**
```typescript
// CSS variable pattern
/--([\w-]+)\s*:\s*([^;]+);/g

// Radius tokens
/--radius-([\w-]+)\s*:\s*([^;]+);/g

// Shadow tokens
/--shadow-([\w-]+)\s*:\s*([^;]+);/g

// Button classes
/\.(btn|button|cta|action)[-\w]*\s*\{([^}]+)\}/gi
```

**Categorization Logic:**
```typescript
// Color detection
isColor = value.startsWith('#') || 
          value.startsWith('rgb') || 
          name.includes('color') ||
          name.includes('bg') ||
          name.includes('text');

// Spacing detection
isSpacing = name.includes('spacing') ||
            name.includes('padding') ||
            name.includes('margin') ||
            name.includes('gap');
```

### 2. Webflow Generator (`lib/webflow-style-guide-generator.ts`)

**Purpose:** Generate Webflow-compatible visual style guide payload

**Main Function:**

```typescript
generateStyleGuidePayload(
  tokens: EnhancedTokenExtraction,
  options?: StyleGuideOptions
): WebflowPayload
```

**Generation Strategy:**

1. **Create base styles** (container, section, heading, etc.)
2. **Generate nodes** for each token category
3. **Apply inline styles** for visual representation
4. **Build node hierarchy** (container → sections → items)
5. **Return Webflow payload** ready for clipboard

**Node Structure:**
```typescript
// Example: Color swatch
{
  _id: "sg-color-swatch-1",
  type: "Block",
  tag: "div",
  classes: ["sg-swatch"],
  children: [],
  data: {
    tag: "div",
    text: false,
    xattr: [{
      name: "style",
      value: "background-color: #3B82F6;"
    }]
  }
}
```

**Why Inline Styles?**
- Webflow doesn't automatically apply our generated classes
- Inline styles ensure visual representation works immediately
- Users can later convert to classes in Webflow if desired

### 3. UI Components (`components/project/style-guide/`)

**Purpose:** Present tokens in a beautiful, Relume-style interface

#### Component Props Reference

**StyleGuideView**
```typescript
interface StyleGuideViewProps {
  tokens: EnhancedTokenExtraction;  // All extracted tokens
  onCopyWebflowPayload?: () => void; // Webflow export handler
}
```

**VariablesSection**
```typescript
interface VariablesSectionProps {
  primitiveColors: ColorToken[];
  semanticColors?: SemanticColorScheme;
}
```

**TypographySection**
```typescript
interface TypographySectionProps {
  headingTypeface?: Typeface;
  bodyTypeface?: Typeface;
  headings?: HeadingStyle[];
  bodyText?: BodyTextStyle[];
  allTypographyTokens?: Token[];
}
```

**Copy Buttons**
```typescript
// Individual token copy
<CopyButton 
  value="#3B82F6" 
  label="Primary Color" 
  variant="individual" 
/>

// Category copy
<CategoryCopyButton 
  tokens={colorTokens} 
  category="Color" 
/>
```

### 4. Database Integration

**Schema Definition:**
```typescript
// convex/schema.ts
importProjects: defineTable({
  // ... existing fields
  designTokens: v.optional(v.object({
    colors: v.array(v.object({
      name: v.string(),
      value: v.string(),
    })),
    typography: v.array(v.object({
      name: v.string(),
      value: v.string(),
    })),
    spacing: v.optional(v.array(v.object({
      name: v.string(),
      value: v.string(),
    }))),
    radius: v.optional(v.array(v.object({
      name: v.string(),
      value: v.string(),
      size: v.string(),
    }))),
    shadows: v.optional(v.array(v.object({
      name: v.string(),
      value: v.string(),
      intensity: v.string(),
    }))),
  })),
})
```

**Storage Strategy:**
- Tokens stored in both `importProjects.designTokens` (quick access) and `importArtifacts` (full data)
- `tokens_json` artifact contains complete enhanced extraction
- `styles_css` artifact used for runtime re-extraction

**Why Two Locations?**
1. **designTokens field**: Fast queries, summary data, backward compatible
2. **tokens_json artifact**: Full data, re-processable, extensible

## Extension Guide

### Adding a New Token Type

**Example:** Adding "Animation" tokens

#### Step 1: Define Interface
```typescript
// lib/token-extractor.ts
export interface AnimationToken {
  name: string;
  value: string;
  duration: string;
  easing?: string;
}

export interface EnhancedTokenExtraction extends TokenExtraction {
  // ... existing fields
  animations?: AnimationToken[];
}
```

#### Step 2: Create Extractor
```typescript
// lib/token-extractor.ts
export function extractAnimationTokens(css: string): AnimationToken[] {
  const tokens: AnimationToken[] = [];
  const varRegex = /--animation-([\w-]+)\s*:\s*([^;]+);/g;
  let match;

  while ((match = varRegex.exec(css)) !== null) {
    const [, name, value] = match;
    
    // Parse animation value (e.g., "fadeIn 0.3s ease-in-out")
    const parts = value.trim().split(/\s+/);
    
    tokens.push({
      name,
      value: parts[0] || value,
      duration: parts[1] || '0.3s',
      easing: parts[2],
    });
  }

  return tokens;
}

// Update extractEnhancedTokens
export function extractEnhancedTokens(...) {
  return {
    ...baseExtraction,
    animations: extractAnimationTokens(css), // ADD THIS
  };
}
```

#### Step 3: Create UI Component
```tsx
// components/project/style-guide/animations-section.tsx
export function AnimationsSection({ tokens }: { tokens: AnimationToken[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Animations</CardTitle>
      </CardHeader>
      <CardContent>
        {tokens.map(token => (
          <div key={token.name}>
            <AnimationPreview animation={token} />
            <CopyButton value={token.value} label={token.name} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

#### Step 4: Integrate into Main View
```tsx
// components/project/style-guide/style-guide-view.tsx
import { AnimationsSection } from "./animations-section";

export function StyleGuideView({ tokens }: StyleGuideViewProps) {
  return (
    <div>
      {/* ... existing sections */}
      
      {tokens.animations && tokens.animations.length > 0 && (
        <AnimationsSection tokens={tokens.animations} />
      )}
    </div>
  );
}
```

#### Step 5: Update Schema
```typescript
// convex/schema.ts
designTokens: v.optional(v.object({
  // ... existing fields
  animations: v.optional(v.array(v.object({
    name: v.string(),
    value: v.string(),
    duration: v.string(),
    easing: v.optional(v.string()),
  }))),
}))
```

#### Step 6: Update Import Flow
```typescript
// components/admin/ImportWizard.tsx
const animationTokens = tokens.animations?.map(a => ({
  name: a.name,
  value: a.value,
  duration: a.duration,
})) || [];

// Add to tokensJson:
animations: animationTokens,
```

#### Step 7: Add Webflow Generator
```typescript
// lib/webflow-style-guide-generator.ts
if (tokens.animations && tokens.animations.length > 0) {
  const animationSectionId = generateAnimationsSection(
    tokens.animations, 
    namespace, 
    nodes, 
    genId
  );
  childrenIds.push(animationSectionId);
}

function generateAnimationsSection(...) {
  // Create visual animation demonstrations
  // Return section node ID
}
```

## Debugging Guide

### Common Issues

#### Issue 1: Tokens Not Appearing

**Symptoms:** Style Guide tab shows "No tokens found"

**Debug Steps:**
```typescript
// 1. Check CSS artifact exists
console.log('CSS artifact:', cssArtifact?.content?.length);

// 2. Verify :root block exists
const hasRoot = css.includes(':root');
console.log('Has :root:', hasRoot);

// 3. Check variable format
const vars = css.match(/--[\w-]+\s*:\s*[^;]+;/g);
console.log('Found variables:', vars?.length);

// 4. Test extraction
const tokens = extractEnhancedTokens(css);
console.log('Extracted tokens:', tokens);
```

**Common Causes:**
- CSS doesn't use CSS variables
- Variables not in `:root` block
- Typo in variable syntax
- CSS artifact not saved correctly

#### Issue 2: Section Not Rendering

**Symptoms:** Specific section (e.g., Radius) doesn't appear

**Debug Steps:**
```typescript
// Check if tokens exist
console.log('Radius tokens:', tokens.radius);

// Verify not empty
console.log('Has radius:', tokens.radius && tokens.radius.length > 0);

// Check naming pattern
const hasRadiusPrefix = css.includes('--radius-');
console.log('Uses --radius- prefix:', hasRadiusPrefix);
```

**Common Causes:**
- No tokens of that type detected
- Naming doesn't match expected pattern
- Tokens exist but categorized differently

#### Issue 3: Copy Button Doesn't Work

**Symptoms:** Click copy button, nothing happens

**Debug Steps:**
```typescript
// Check clipboard API availability
console.log('Clipboard API:', !!navigator.clipboard);

// Check HTTPS
console.log('Protocol:', window.location.protocol);

// Test manual copy
navigator.clipboard.writeText('test')
  .then(() => console.log('Copy works'))
  .catch(err => console.error('Copy failed:', err));
```

**Common Causes:**
- Browser doesn't support Clipboard API
- HTTP (not HTTPS) - clipboard requires secure context
- Browser permissions blocked

#### Issue 4: Webflow Paste Creates Wrong Structure

**Symptoms:** Pasted style guide looks broken in Webflow

**Debug Steps:**
```typescript
// Validate payload structure
const payload = generateStyleGuidePayload(tokens);
console.log('Payload valid:', payload.type === '@webflow/XscpData');
console.log('Nodes count:', payload.payload.nodes.length);
console.log('Styles count:', payload.payload.styles.length);

// Check for circular references
const nodeIds = new Set(payload.payload.nodes.map(n => n._id));
payload.payload.nodes.forEach(node => {
  node.children?.forEach(childId => {
    if (!nodeIds.has(childId)) {
      console.error('Orphan child:', childId, 'in node:', node._id);
    }
  });
});
```

**Common Causes:**
- Payload too large (>1MB)
- Malformed node structure
- Circular references in node tree
- Invalid inline styles

### Logging & Debugging

Enable verbose logging:

```typescript
// In token-extractor.ts
const DEBUG = true;

if (DEBUG) {
  console.log('[token-extractor] Found variables:', variables.length);
  console.log('[token-extractor] Colors:', colorTokens.length);
  console.log('[token-extractor] Radius:', radiusTokens.length);
  console.log('[token-extractor] Shadows:', shadowTokens.length);
}
```

## Performance Optimization

### Token Extraction Performance

**Current:** ~50-100ms for typical projects (200-500 CSS variables)

**Optimization Techniques:**

1. **Regex Efficiency:**
```typescript
// ✅ Good: Specific pattern, minimal backtracking
/--radius-([\w-]+)\s*:\s*([^;]+);/g

// ❌ Bad: Greedy, potential catastrophic backtracking
/--radius-(.+):\s*(.+);/g
```

2. **Early Returns:**
```typescript
if (!css.includes(':root')) {
  return { variables: [], ... }; // Skip expensive parsing
}
```

3. **Memoization:**
```typescript
// In StyleGuideTab component
const enhancedTokens = useMemo(() => {
  return extractEnhancedTokens(cssContent);
}, [cssContent]);
```

### UI Rendering Performance

**Current:** First render ~100-200ms for 50 tokens

**Optimization Techniques:**

1. **Lazy Load Sections:**
```typescript
const [visibleSections, setVisibleSections] = useState(['colors']);

// Load other sections on scroll or interaction
```

2. **Virtual Scrolling** (for large token sets):
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const tokenVirtualizer = useVirtualizer({
  count: tokens.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 80,
});
```

3. **Debounced Copy:**
```typescript
const debouncedCopy = useMemo(
  () => debounce(handleCopy, 300),
  [handleCopy]
);
```

## Testing

### Unit Tests

**Token Extraction:**
```typescript
// tests/token-extractor.test.ts
describe('extractEnhancedTokens', () => {
  it('extracts color tokens', () => {
    const css = ':root { --primary: #3B82F6; }';
    const tokens = extractEnhancedTokens(css);
    
    expect(tokens.variables).toHaveLength(1);
    expect(tokens.variables[0].type).toBe('color');
    expect(tokens.variables[0].value).toBe('#3B82F6');
  });

  it('extracts radius tokens', () => {
    const css = ':root { --radius-medium: 8px; }';
    const tokens = extractEnhancedTokens(css);
    
    expect(tokens.radius).toHaveLength(1);
    expect(tokens.radius[0].size).toBe('medium');
  });
});
```

**Webflow Generation:**
```typescript
// tests/webflow-style-guide-generator.test.ts
describe('generateStyleGuidePayload', () => {
  it('generates valid Webflow payload', () => {
    const tokens = createMockTokens();
    const payload = generateStyleGuidePayload(tokens);
    
    expect(payload.type).toBe('@webflow/XscpData');
    expect(payload.payload.nodes.length).toBeGreaterThan(0);
    expect(payload.payload.styles.length).toBeGreaterThan(0);
  });

  it('includes inline styles for colors', () => {
    const tokens = { variables: [{ cssVar: '--primary', type: 'color', value: '#3B82F6' }] };
    const payload = generateStyleGuidePayload(tokens);
    
    const swatchNode = payload.payload.nodes.find(n => 
      n.data?.xattr?.some(attr => 
        attr.name === 'style' && attr.value.includes('background-color')
      )
    );
    expect(swatchNode).toBeDefined();
  });
});
```

### Integration Tests

```typescript
// tests/style-guide-integration.test.ts
describe('Style Guide Integration', () => {
  it('renders style guide from imported project', async () => {
    const { render } = renderWithProviders(<ProjectDetailsView id="test-id" />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Style Guide')).toBeInTheDocument();
    });
    
    // Click tab
    fireEvent.click(screen.getByText('Style Guide'));
    
    // Verify sections render
    expect(screen.getByText('Colors')).toBeInTheDocument();
    expect(screen.getByText('Typography')).toBeInTheDocument();
  });

  it('copies individual token on click', async () => {
    render(<CopyButton value="#3B82F6" label="Primary" />);
    
    // Mock clipboard
    const clipboardSpy = jest.spyOn(navigator.clipboard, 'writeText');
    
    fireEvent.click(screen.getByRole('button'));
    
    expect(clipboardSpy).toHaveBeenCalledWith('#3B82F6');
  });
});
```

### Manual Test Checklist

- [ ] Import project with comprehensive tokens
- [ ] Open Style Guide tab
- [ ] Verify all sections render
- [ ] Test individual copy (each token type)
- [ ] Test category copy (verify CSS format)
- [ ] Test Webflow export
- [ ] Paste in Webflow, verify structure
- [ ] Test with minimal tokens (only colors)
- [ ] Test with no tokens (empty state)
- [ ] Test on mobile viewport

## Code Style & Conventions

### Component Organization

```tsx
// 1. Imports
import { Card } from "@/components/ui/card";
import { CopyButton } from "./copy-button";

// 2. Interfaces
interface SectionProps {
  tokens: Token[];
}

// 3. Main Component
export function Section({ tokens }: SectionProps) {
  // Component logic
}

// 4. Sub-components (if complex)
function SubComponent() {
  // Sub-component logic
}
```

### Naming Conventions

**Files:**
- Kebab-case: `style-guide-view.tsx`
- Descriptive: `variables-section.tsx` not `colors.tsx`

**Components:**
- PascalCase: `StyleGuideView`
- Noun-based: `VariablesSection` not `ShowVariables`

**Functions:**
- camelCase: `extractRadiusTokens`
- Verb-based: `generateStyleGuidePayload` not `styleGuidePayload`

**Types:**
- PascalCase: `RadiusToken`
- Descriptive: `EnhancedTokenExtraction` not `TokensEx`

### CSS Patterns

**Use Tailwind consistently:**
```tsx
// ✅ Good
<div className="space-y-4 p-6 bg-slate-50 rounded-2xl">

// ❌ Avoid inline styles (except for dynamic colors)
<div style={{ padding: '24px', background: '#f1f5f9' }}>
```

**Exception: Dynamic values from tokens:**
```tsx
// ✅ OK - dynamic color
<div style={{ backgroundColor: token.value }} />

// ✅ OK - dynamic font
<p style={{ fontFamily: token.family }}>
```

## Security Considerations

### XSS Prevention

**Token values are user-controlled** (from imported CSS). Sanitize before display:

```typescript
// ✅ Safe - React escapes by default
<p>{token.value}</p>

// ⚠️ Risky - inline styles with dynamic values
<div style={{ backgroundColor: token.value }} />
// Safe because CSS values are validated

// ❌ Never do this
<div dangerouslySetInnerHTML={{ __html: token.value }} />
```

### Clipboard Safety

```typescript
// ✅ Safe - controlled values
await navigator.clipboard.writeText(token.value);

// ✅ Safe - formatted CSS
await navigator.clipboard.writeText(`:root { --${name}: ${value}; }`);

// ⚠️ Be careful with large payloads
if (payload.length > 10_000_000) { // 10MB
  throw new Error('Payload too large for clipboard');
}
```

## Maintenance

### Regular Tasks

1. **Update token patterns** as new CSS features emerge
2. **Monitor extraction accuracy** via user feedback
3. **Optimize UI performance** for large token sets
4. **Keep Webflow compatibility** as Webflow updates
5. **Update documentation** when adding features

### Deprecation Strategy

**Don't break existing code:**
- Keep `extractTokens()` for backward compatibility
- `extractEnhancedTokens()` is new, optional upgrade
- Old `DesignTokensCard` still works (in Overview tab)
- New `StyleGuideView` is additive (in Style Guide tab)

## Resources

### Internal Documentation
- [Implementation Details](../STYLE_GUIDE_IMPLEMENTATION.md)
- [User Guide](./STYLE_GUIDE.md)
- [Workflow Diagrams](./STYLE_GUIDE_WORKFLOW.md)

### External References
- [Relume Design System](https://www.relume.io/)
- [Webflow XscpData Format](https://developers.webflow.com/)
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)

### Code References
- [`lib/token-extractor.ts`](../../lib/token-extractor.ts)
- [`lib/webflow-style-guide-generator.ts`](../../lib/webflow-style-guide-generator.ts)
- [`components/project/style-guide/`](../../components/project/style-guide/)

---

**Target Audience:** Developers maintaining or extending the Style Guide system  
**Last Updated:** January 24, 2026  
**Version:** 1.0.0

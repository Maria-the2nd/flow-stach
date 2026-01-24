# Style Guide Workflow & Architecture

## User Workflow

This document explains how the Style Guide feature integrates into the import and export workflow.

### Complete Import-to-Webflow Flow

```mermaid
graph TD
    Start[User Imports HTML/CSS] --> Parse[Parse & Normalize]
    Parse --> Extract[Extract Enhanced Tokens]
    Extract --> Store[Store in Database]
    Store --> View[View in Project Details]
    View --> StyleGuide[Open Style Guide Tab]
    StyleGuide --> Choice{What to Copy?}
    
    Choice -->|Individual Token| CopyToken[Copy Single Value]
    Choice -->|Category| CopyCategory[Copy All as CSS]
    Choice -->|Full Guide| CopyWebflow[Generate Webflow Payload]
    
    CopyToken --> Clipboard1[Clipboard: #3B82F6]
    CopyCategory --> Clipboard2[Clipboard: CSS Variables]
    CopyWebflow --> Clipboard3[Clipboard: Webflow JSON]
    
    Clipboard3 --> WebflowDesigner[Paste in Webflow]
    WebflowDesigner --> Result[Visual Style Guide Page]
```

## Technical Architecture

### Data Flow

```mermaid
graph LR
    subgraph Import
        HTML[HTML Input] --> Parser[HTML Parser]
        CSS[CSS Input] --> TokenExtractor[Token Extractor]
    end
    
    subgraph Processing
        TokenExtractor --> Enhanced[Enhanced Tokens]
        Enhanced --> Colors[Colors]
        Enhanced --> Typography[Typography]
        Enhanced --> Spacing[Spacing]
        Enhanced --> Radius[Radius]
        Enhanced --> Shadows[Shadows]
    end
    
    subgraph Storage
        Colors --> DB[(Convex DB)]
        Typography --> DB
        Spacing --> DB
        Radius --> DB
        Shadows --> DB
    end
    
    subgraph Display
        DB --> UIComponents[UI Components]
        DB --> WebflowGen[Webflow Generator]
        UIComponents --> StyleGuideTab[Style Guide Tab]
        WebflowGen --> WebflowPayload[Webflow Payload]
    end
```

### Component Hierarchy

```mermaid
graph TD
    ProjectDetails[project-details-view.tsx] --> StyleGuideTab[StyleGuideTab Component]
    StyleGuideTab --> ExtractTokens[extractEnhancedTokens]
    StyleGuideTab --> StyleGuideView[StyleGuideView]
    
    StyleGuideView --> VariablesSection[VariablesSection]
    StyleGuideView --> TypographySection[TypographySection]
    StyleGuideView --> SpacingSection[SpacingSection]
    StyleGuideView --> RadiusSection[RadiusSection]
    StyleGuideView --> ShadowsSection[ShadowsSection]
    
    VariablesSection --> CopyButton[CopyButton]
    TypographySection --> CopyButton
    SpacingSection --> CopyButton
    RadiusSection --> CopyButton
    ShadowsSection --> CopyButton
    
    VariablesSection --> CategoryCopy[CategoryCopyButton]
    TypographySection --> CategoryCopy
    SpacingSection --> CategoryCopy
    
    StyleGuideView --> WebflowExport[generateStyleGuidePayload]
    WebflowExport --> WebflowPayload[Webflow JSON]
```

## Token Extraction Pipeline

### Phase 1: CSS Parsing

```mermaid
sequenceDiagram
    participant User
    participant Import as Import Wizard
    participant Extractor as Token Extractor
    participant Parser as CSS Parser
    
    User->>Import: Paste HTML + CSS
    Import->>Parser: Parse CSS
    Parser->>Extractor: Extract :root variables
    Extractor->>Extractor: Categorize by pattern
    Extractor->>Extractor: Extract radius tokens
    Extractor->>Extractor: Extract shadow tokens
    Extractor->>Extractor: Detect UI elements
    Extractor->>Import: Return EnhancedTokenExtraction
```

### Phase 2: Token Categorization

```mermaid
graph TD
    CSSVar[CSS Variable] --> Analyze{Analyze Name & Value}
    
    Analyze -->|Pattern: color/bg/text| ColorToken[Color Token]
    Analyze -->|Pattern: font-* | TypoToken[Typography Token]
    Analyze -->|Pattern: spacing/padding/margin| SpacingToken[Spacing Token]
    Analyze -->|Pattern: radius-*| RadiusToken[Radius Token]
    Analyze -->|Pattern: shadow-*| ShadowToken[Shadow Token]
    
    ColorToken --> Store[Store in Database]
    TypoToken --> Store
    SpacingToken --> Store
    RadiusToken --> Store
    ShadowToken --> Store
```

### Phase 3: Display & Export

```mermaid
sequenceDiagram
    participant User
    participant Tab as Style Guide Tab
    participant DB as Database
    participant UI as UI Components
    participant Webflow as Webflow Generator
    
    User->>Tab: Open Style Guide
    Tab->>DB: Fetch project data
    DB->>Tab: Return artifacts + tokens
    Tab->>UI: Render sections
    UI->>User: Display visual guide
    
    alt Copy Individual Token
        User->>UI: Click copy icon
        UI->>User: Copy value to clipboard
    else Copy Category
        User->>UI: Click "Copy All"
        UI->>User: Copy CSS variables
    else Export to Webflow
        User->>Tab: Click "Copy to Webflow"
        Tab->>Webflow: Generate payload
        Webflow->>Tab: Return Webflow JSON
        Tab->>User: Copy to clipboard
        User->>Webflow: Paste in Designer
        Webflow->>User: Create style guide page
    end
```

## Token Detection Logic

### Color Detection

```typescript
// Pattern matching
const isColor = 
  name.includes('bg') ||
  name.includes('text') ||
  name.includes('color') ||
  value.startsWith('#') ||
  value.startsWith('rgb') ||
  value.startsWith('hsl');
```

### Radius Detection

```typescript
// Must use --radius- prefix
const radiusPattern = /--radius-([\w-]+)\s*:\s*([^;]+);/g;

// Size categorization
if (name.includes('small')) size = 'small';
if (name.includes('medium')) size = 'medium';
if (name.includes('large')) size = 'large';
```

### Shadow Detection

```typescript
// Must use --shadow- prefix
const shadowPattern = /--shadow-([\w-]+)\s*:\s*([^;]+);/g;

// Intensity levels
const intensityMap = {
  'xxs': 'xxsmall',
  'xs': 'xsmall',
  'sm': 'small',
  'md': 'medium',
  'lg': 'large',
  'xl': 'xlarge',
  'xxl': 'xxlarge'
};
```

## Copy Functionality

### Individual Token Copy

```typescript
async function copyToken(value: string) {
  await navigator.clipboard.writeText(value);
  // Output: "#3B82F6"
}
```

### Category Copy

```typescript
async function copyCategory(tokens: Token[]) {
  const css = `:root {\n${tokens.map(t => 
    `  --${t.name}: ${t.value};`
  ).join('\n')}\n}`;
  await navigator.clipboard.writeText(css);
  // Output: Full CSS variable block
}
```

### Webflow Payload Generation

```typescript
function generateStyleGuidePayload(tokens) {
  // 1. Create container and section nodes
  // 2. Generate color swatches with inline styles
  // 3. Create typography samples
  // 4. Build spacing/radius/shadow demonstrations
  // 5. Package as Webflow JSON
  return webflowPayload;
}
```

## State Management

### Token Storage

```mermaid
graph LR
    Import[Import Process] --> DB[Convex Database]
    DB --> Project[importProjects table]
    DB --> Artifacts[importArtifacts table]
    
    Project --> Metadata[Project metadata + tokens]
    Artifacts --> Files[tokens_json, styles_css, etc.]
    
    Metadata --> Display[Display in UI]
    Files --> Processing[Processing/Regeneration]
```

### Runtime Extraction

When opening the Style Guide tab:

1. Fetch project artifacts from database
2. Extract `styles_css` artifact content
3. Run `extractEnhancedTokens()` on CSS
4. Generate structured token data
5. Pass to `StyleGuideView` component
6. Render visual sections

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**: Style Guide tab only processes tokens when opened
2. **Memoization**: Token extraction cached during tab session
3. **Incremental Rendering**: Sections render independently
4. **Efficient Parsing**: Regex-based token extraction (no DOM parsing)

### Scale Limits

| Metric | Recommended | Maximum |
|--------|-------------|---------|
| Color tokens | 20-50 | 200 |
| Typography tokens | 5-10 | 50 |
| Spacing tokens | 8-12 | 30 |
| Radius tokens | 4-6 | 15 |
| Shadow tokens | 5-7 | 20 |

**Note:** Large token sets may cause:
- Slow initial render (first open of tab)
- Large Webflow payloads (clipboard size limits)
- Cluttered UI (too many tokens to scan)

## Error Handling

### Graceful Degradation

```mermaid
graph TD
    ExtractTokens[Extract Tokens] --> HasTokens{Has Tokens?}
    
    HasTokens -->|Yes| RenderGuide[Render Style Guide]
    HasTokens -->|No| ShowEmpty[Show Empty State]
    
    RenderGuide --> RenderSection{Render Section}
    RenderSection -->|Has Colors| ColorSection[Colors Section]
    RenderSection -->|Has Typography| TypoSection[Typography Section]
    RenderSection -->|Has Spacing| SpacingSection[Spacing Section]
    RenderSection -->|No Tokens| SkipSection[Skip Section]
    
    ShowEmpty --> Message[Display: No tokens found]
```

### Error States

1. **No Tokens Detected**: Display helpful message with token format example
2. **Extraction Failed**: Catch error, show fallback UI
3. **Copy Failed**: Toast notification with error message
4. **Webflow Generation Failed**: Log error, notify user

## Extension Points

### Adding New Token Types

To add a new token category (e.g., "Animations"):

1. **Update `lib/token-extractor.ts`:**
```typescript
export interface AnimationToken {
  name: string;
  value: string;
  duration: string;
}

export interface EnhancedTokenExtraction {
  // ... existing types
  animations?: AnimationToken[];
}

export function extractAnimationTokens(css: string): AnimationToken[] {
  // Implementation
}
```

2. **Create component:**
```
components/project/style-guide/animations-section.tsx
```

3. **Update `style-guide-view.tsx`:**
```typescript
{tokens.animations && tokens.animations.length > 0 && (
  <AnimationsSection tokens={tokens.animations} />
)}
```

4. **Update schema:**
```typescript
// convex/schema.ts
animations: v.optional(v.array(v.object({
  name: v.string(),
  value: v.string(),
  duration: v.string(),
})))
```

5. **Update Webflow generator:**
```typescript
// lib/webflow-style-guide-generator.ts
if (tokens.animations) {
  const animationSectionId = generateAnimationsSection(...);
  childrenIds.push(animationSectionId);
}
```

## Testing Checklist

- [ ] Import project with all token types
- [ ] Verify Style Guide tab appears
- [ ] Check each section renders correctly
- [ ] Test individual token copy
- [ ] Test category copy (verify CSS format)
- [ ] Test Webflow export
- [ ] Verify Webflow paste creates visual guide
- [ ] Test with projects missing certain token types
- [ ] Test with empty project (no tokens)
- [ ] Test responsive layout (mobile, tablet, desktop)

## Resources

- [User Documentation](./STYLE_GUIDE.md)
- [Implementation Details](../STYLE_GUIDE_IMPLEMENTATION.md)
- [Quick Reference](./STYLE_GUIDE_QUICK_REFERENCE.md)
- [System Manifest](../../SYSTEM_MANIFEST.md)

---

**Document Version:** 1.0  
**Last Updated:** January 24, 2026

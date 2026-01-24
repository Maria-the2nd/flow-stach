# Flow Bridge: Complete Validation Gap Closure + Embed Fallback Strategy

**Replaces:** Nothing (extends previous implementation)
**Purpose:** Close remaining validation gaps, add embed fallback for unsalvageable elements
**Target:** Claude CLI (Sonnet 4.5, Extended Thinking Enabled)
**Budget:** 32,000 thinking tokens
**Task Type:** Agentic Coding - Critical Validation Enhancement

---

<role>
You are a senior full-stack engineer completing the validation system for Flow Bridge. You've already implemented basic validation (variant keys, reserved classes, depth limits). Now you must close the remaining gaps that still cause Webflow Designer crashes.

Your philosophy: **If it can't be fixed, route it to embeds.** The 5-output system (designTokens, webflowJson, cssEmbed, jsEmbed, libraryImports) exists specifically so that problematic elements can be extracted from the Webflow JSON and placed into embed blocks where they work safely.
</role>

<context>
## What's Already Implemented

From previous work:
- ✅ Valid breakpoint names (main, medium, small, tiny, xl, xxl)
- ✅ Valid pseudo states (hover, focus, active, etc.)
- ✅ Reserved class name blocking (w-* prefix)
- ✅ Max node depth (50 levels)
- ✅ Duplicate UUID detection
- ✅ Circular reference detection
- ✅ Basic structure validation

## What's Still Missing (From Crash Analysis)

### 1. Ghost Keys / Orphan References
Variant keys that reference node IDs that don't exist in the payload.

**Example of bad data:**
```json
{
  "styles": [{
    "_id": "style-123",
    "variants": {
      "abc-def-ghi": {  // This ID doesn't exist as a node!
        "color": "red"
      }
    }
  }]
}
```

### 2. UUID Format Validation
Variant keys should be proper UUIDs, not legacy strings like "variant-1" or "Style 2".

**Bad:** `"variant-1": { ... }`
**Good:** `"a245c12d-995b-55ee-5ec7-aa36a6cad623": { ... }`

### 3. Components Array Validation
The `payload.components` array (if present) has its own variant structure that needs validation.

### 4. ix2 Interaction References
Interactions that reference elements that don't exist in the nodes array.

**Example:**
```json
{
  "ix2": {
    "interactions": [{
      "trigger": {
        "target": "node-xyz"  // This node doesn't exist!
      }
    }]
  }
}
```

### 5. Asset Reference Validation
Asset IDs referenced in nodes that don't exist in the assets array.

### 6. Nested Component Variants
Components inside components - validation must recurse.

### 7. Schema Version Mismatch
Legacy format detection - some old structures can't be migrated.

## The Embed Fallback Strategy

When validation finds elements that CANNOT be fixed:

1. **Complex interactions (ix2)** → Strip from webflowJson, generate equivalent JS in `jsEmbed`
2. **Invalid CSS in styleLess** → Strip from styles, add to `cssEmbed`
3. **Problematic HTML structures** → Strip node, add raw HTML to a new `htmlEmbed` or document for manual paste
4. **Ghost variants** → Strip entirely (they reference nothing anyway)
5. **Legacy format data** → Attempt migration, if fails strip and warn

The goal: **webflowJson should ALWAYS paste safely.** Anything risky goes to embeds.
</context>

<instructions>

## Phase 1: Add Missing Validators

### 1.1 Ghost Key / Orphan Reference Detection

Create or update validation to check:

```typescript
// Every variant key in styles must reference an existing node OR be a valid breakpoint/state
function validateVariantReferences(payload: WebflowPayload): ValidationIssue[] {
  const nodeIds = new Set(payload.payload.nodes.map(n => n._id));
  const validBreakpoints = new Set(['main', 'medium', 'small', 'tiny', 'xl', 'xxl']);
  const validStates = new Set(['hover', 'focus', 'active', 'visited', 'focus-visible', 'focus-within']);
  
  const issues: ValidationIssue[] = [];
  
  payload.payload.styles.forEach(style => {
    if (style.variants) {
      Object.keys(style.variants).forEach(key => {
        // Key must be either:
        // 1. A valid breakpoint name
        // 2. A valid pseudo state
        // 3. A UUID that exists in nodes (for component overrides)
        
        const isBreakpoint = validBreakpoints.has(key);
        const isState = validStates.has(key);
        const isExistingNode = nodeIds.has(key);
        const isValidUUID = isUUIDFormat(key);
        
        if (!isBreakpoint && !isState && !isExistingNode) {
          issues.push({
            code: 'GHOST_VARIANT_KEY',
            severity: 'ERROR',
            message: `Style "${style.name}" has variant key "${key}" that references non-existent node`,
            path: `styles.${style._id}.variants.${key}`,
            autoFixable: true  // Can be stripped
          });
        }
      });
    }
  });
  
  return issues;
}
```

### 1.2 UUID Format Validation

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUIDFormat(str: string): boolean {
  return UUID_REGEX.test(str);
}

function validateUUIDFormats(payload: WebflowPayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // Check node IDs
  payload.payload.nodes.forEach(node => {
    if (!isUUIDFormat(node._id)) {
      issues.push({
        code: 'INVALID_UUID_FORMAT',
        severity: 'ERROR',
        message: `Node has invalid UUID format: "${node._id}"`,
        path: `nodes.${node._id}`,
        autoFixable: true  // Can regenerate UUID
      });
    }
  });
  
  // Check style IDs
  payload.payload.styles.forEach(style => {
    if (!isUUIDFormat(style._id)) {
      issues.push({
        code: 'INVALID_UUID_FORMAT',
        severity: 'ERROR',
        message: `Style has invalid UUID format: "${style._id}"`,
        path: `styles.${style._id}`,
        autoFixable: true
      });
    }
  });
  
  return issues;
}
```

### 1.3 ix2 Interaction Reference Validation

```typescript
function validateInteractionReferences(payload: WebflowPayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(payload.payload.nodes.map(n => n._id));
  
  if (!payload.payload.ix2?.interactions) return issues;
  
  payload.payload.ix2.interactions.forEach((interaction, idx) => {
    // Check trigger targets
    const targets = extractTargetIds(interaction);
    
    targets.forEach(targetId => {
      if (!nodeIds.has(targetId)) {
        issues.push({
          code: 'ORPHAN_INTERACTION_TARGET',
          severity: 'ERROR',
          message: `Interaction ${idx} references non-existent node: "${targetId}"`,
          path: `ix2.interactions.${idx}`,
          autoFixable: true,  // Strip interaction, move to jsEmbed
          fallbackStrategy: 'JS_EMBED'
        });
      }
    });
  });
  
  return issues;
}
```

### 1.4 Asset Reference Validation

```typescript
function validateAssetReferences(payload: WebflowPayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const assetIds = new Set((payload.payload.assets || []).map(a => a._id));
  
  payload.payload.nodes.forEach(node => {
    // Check for asset references in node data
    if (node.data?.asset && !assetIds.has(node.data.asset)) {
      issues.push({
        code: 'ORPHAN_ASSET_REFERENCE',
        severity: 'WARNING',
        message: `Node "${node._id}" references non-existent asset: "${node.data.asset}"`,
        path: `nodes.${node._id}.data.asset`,
        autoFixable: true  // Can strip asset reference
      });
    }
  });
  
  return issues;
}
```

### 1.5 Children Reference Validation

```typescript
function validateChildrenReferences(payload: WebflowPayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(payload.payload.nodes.map(n => n._id));
  
  payload.payload.nodes.forEach(node => {
    if (node.children) {
      node.children.forEach(childId => {
        if (!nodeIds.has(childId)) {
          issues.push({
            code: 'ORPHAN_CHILD_REFERENCE',
            severity: 'FATAL',  // This WILL crash Designer
            message: `Node "${node._id}" has child "${childId}" that doesn't exist`,
            path: `nodes.${node._id}.children`,
            autoFixable: true  // Remove from children array
          });
        }
      });
    }
  });
  
  return issues;
}
```

---

## Phase 2: Add Sanitizers with Embed Fallback

### 2.1 Ghost Variant Sanitizer

```typescript
function sanitizeGhostVariants(payload: WebflowPayload): {
  sanitized: WebflowPayload;
  stripped: StrippedContent[];
} {
  const nodeIds = new Set(payload.payload.nodes.map(n => n._id));
  const validKeys = new Set([
    'main', 'medium', 'small', 'tiny', 'xl', 'xxl',
    'hover', 'focus', 'active', 'visited', 'focus-visible', 'focus-within'
  ]);
  
  const stripped: StrippedContent[] = [];
  
  const sanitizedStyles = payload.payload.styles.map(style => {
    if (!style.variants) return style;
    
    const cleanVariants: Record<string, any> = {};
    
    Object.entries(style.variants).forEach(([key, value]) => {
      if (validKeys.has(key) || nodeIds.has(key)) {
        cleanVariants[key] = value;
      } else {
        // Strip it, record what was removed
        stripped.push({
          type: 'ghost_variant',
          className: style.name,
          key: key,
          value: value,
          suggestion: 'This variant referenced a non-existent element and was removed.'
        });
      }
    });
    
    return {
      ...style,
      variants: Object.keys(cleanVariants).length > 0 ? cleanVariants : undefined
    };
  });
  
  return {
    sanitized: {
      ...payload,
      payload: {
        ...payload.payload,
        styles: sanitizedStyles
      }
    },
    stripped
  };
}
```

### 2.2 Interaction to JS Embed Extractor

When ix2 interactions reference bad nodes, extract them as vanilla JS:

```typescript
function extractBrokenInteractionsToJS(
  payload: WebflowPayload,
  brokenInteractionIndexes: number[]
): {
  sanitizedPayload: WebflowPayload;
  jsEmbed: string;
} {
  const brokenInteractions = brokenInteractionIndexes.map(
    idx => payload.payload.ix2?.interactions?.[idx]
  ).filter(Boolean);
  
  // Generate equivalent vanilla JS for the interactions
  let jsCode = '// Interactions extracted from Webflow (had invalid references)\n';
  jsCode += '// You may need to update the selectors to match your elements\n\n';
  
  brokenInteractions.forEach((interaction, idx) => {
    jsCode += `// Interaction ${idx + 1}: ${interaction.name || 'Unnamed'}\n`;
    jsCode += convertInteractionToGSAP(interaction);
    jsCode += '\n\n';
  });
  
  // Remove broken interactions from payload
  const cleanInteractions = payload.payload.ix2?.interactions?.filter(
    (_, idx) => !brokenInteractionIndexes.includes(idx)
  );
  
  return {
    sanitizedPayload: {
      ...payload,
      payload: {
        ...payload.payload,
        ix2: cleanInteractions?.length ? {
          ...payload.payload.ix2,
          interactions: cleanInteractions
        } : undefined
      }
    },
    jsEmbed: jsCode
  };
}

function convertInteractionToGSAP(interaction: any): string {
  // Convert Webflow IX2 format to GSAP
  // This is a best-effort conversion
  
  const trigger = interaction.trigger?.type || 'click';
  const selector = interaction.trigger?.selector || '.element';
  
  let code = '';
  
  if (trigger === 'scroll') {
    code = `gsap.to("${selector}", {
  scrollTrigger: {
    trigger: "${selector}",
    start: "top 80%",
    toggleActions: "play none none reverse"
  },
  opacity: 1,
  y: 0,
  duration: 0.6
});`;
  } else if (trigger === 'click') {
    code = `document.querySelector("${selector}")?.addEventListener("click", () => {
  // Add your click animation here
  gsap.to("${selector}", { scale: 1.1, duration: 0.2 });
});`;
  } else if (trigger === 'hover') {
    code = `document.querySelector("${selector}")?.addEventListener("mouseenter", () => {
  gsap.to("${selector}", { scale: 1.05, duration: 0.3 });
});
document.querySelector("${selector}")?.addEventListener("mouseleave", () => {
  gsap.to("${selector}", { scale: 1, duration: 0.3 });
});`;
  }
  
  return code;
}
```

### 2.3 Invalid CSS to Embed Extractor

When styleLess contains CSS that would fail, extract it:

```typescript
function extractInvalidCSSToEmbed(
  payload: WebflowPayload
): {
  sanitizedPayload: WebflowPayload;
  cssEmbed: string;
} {
  const invalidPatterns = [
    /oklch\([^)]+\)/gi,
    /color-mix\([^)]+\)/gi,
    /@container[^{]+\{/gi,
    /:has\([^)]+\)/gi,
    /backdrop-filter:[^;]+;/gi,
  ];
  
  let extractedCSS = '/* CSS extracted from Webflow (unsupported features) */\n\n';
  let hasExtracted = false;
  
  const sanitizedStyles = payload.payload.styles.map(style => {
    let css = style.styleLess || '';
    let hadInvalid = false;
    
    invalidPatterns.forEach(pattern => {
      const matches = css.match(pattern);
      if (matches) {
        hadInvalid = true;
        hasExtracted = true;
        
        // Add to embed
        extractedCSS += `.${style.name} {\n`;
        matches.forEach(match => {
          extractedCSS += `  ${match}\n`;
        });
        extractedCSS += '}\n\n';
        
        // Remove from styleLess
        css = css.replace(pattern, '/* extracted to embed */');
      }
    });
    
    return hadInvalid ? { ...style, styleLess: css } : style;
  });
  
  return {
    sanitizedPayload: {
      ...payload,
      payload: {
        ...payload.payload,
        styles: sanitizedStyles
      }
    },
    cssEmbed: hasExtracted ? extractedCSS : ''
  };
}
```

---

## Phase 3: Update Main Validation Pipeline

Update `runPreflightValidation` to include ALL new checks:

```typescript
export function runPreflightValidation(
  payload: WebflowPayload,
  options: ValidationOptions = {}
): PreflightResult {
  const issues: ValidationIssue[] = [];
  
  // === EXISTING CHECKS ===
  issues.push(...validateUniqueIds(payload));
  issues.push(...validateCircularReferences(payload));
  issues.push(...validateNodeDepth(payload));
  issues.push(...validateStyles(payload));  // variant keys, reserved classes
  
  // === NEW CHECKS ===
  issues.push(...validateGhostVariants(payload));           // Ghost keys
  issues.push(...validateUUIDFormats(payload));             // UUID format
  issues.push(...validateChildrenReferences(payload));      // Orphan children
  issues.push(...validateInteractionReferences(payload));   // ix2 targets
  issues.push(...validateAssetReferences(payload));         // Asset refs
  issues.push(...validateComponentVariants(payload));       // Nested components
  
  // Categorize
  const fatal = issues.filter(i => i.severity === 'FATAL');
  const errors = issues.filter(i => i.severity === 'ERROR');
  const warnings = issues.filter(i => i.severity === 'WARNING');
  
  return {
    valid: fatal.length === 0 && errors.length === 0,
    canAutoFix: issues.filter(i => i.autoFixable).length > 0,
    issues,
    fatal,
    errors,
    warnings
  };
}
```

---

## Phase 4: Update Sanitization Pipeline with Embed Routing

Update `sanitizeWebflowPayload` to route unfixable content to embeds:

```typescript
export function sanitizeWebflowPayload(
  payload: WebflowPayload,
  validation: PreflightResult
): SanitizationResult {
  let current = structuredClone(payload);
  const embedContent: EmbedContent = {
    css: '',
    js: '',
    html: '',
    warnings: []
  };
  
  // 1. Regenerate all UUIDs (always safe)
  current = regenerateAllUUIDs(current);
  
  // 2. Strip ghost variants
  const ghostResult = sanitizeGhostVariants(current);
  current = ghostResult.sanitized;
  if (ghostResult.stripped.length > 0) {
    embedContent.warnings.push(
      `Removed ${ghostResult.stripped.length} ghost variant references`
    );
  }
  
  // 3. Extract invalid CSS to embed
  const cssResult = extractInvalidCSSToEmbed(current);
  current = cssResult.sanitizedPayload;
  if (cssResult.cssEmbed) {
    embedContent.css += cssResult.cssEmbed;
  }
  
  // 4. Extract broken interactions to JS embed
  const brokenIxIndexes = validation.issues
    .filter(i => i.code === 'ORPHAN_INTERACTION_TARGET')
    .map(i => parseInt(i.path.split('.')[2]));
  
  if (brokenIxIndexes.length > 0) {
    const ixResult = extractBrokenInteractionsToJS(current, brokenIxIndexes);
    current = ixResult.sanitizedPayload;
    if (ixResult.jsEmbed) {
      embedContent.js += ixResult.jsEmbed;
    }
  }
  
  // 5. Fix orphan children references
  current = removeOrphanChildReferences(current);
  
  // 6. Rename reserved classes
  current = sanitizeReservedClassNames(current);
  
  // 7. Remove invalid variant keys
  current = sanitizeInvalidVariantKeys(current);
  
  // 8. Strip ix2 entirely if still problematic
  if (hasProblematicInteractions(current)) {
    embedContent.warnings.push(
      'All interactions were removed due to unresolvable references. See jsEmbed for alternatives.'
    );
    current = stripAllInteractions(current);
  }
  
  // Re-validate after sanitization
  const revalidation = runPreflightValidation(current, { skipAutoFixable: true });
  
  return {
    sanitizedPayload: current,
    embedContent,
    valid: revalidation.valid,
    remainingIssues: revalidation.issues
  };
}
```

---

## Phase 5: Update API Response

Ensure the conversion API includes extracted embed content:

```typescript
// In route.ts response
return NextResponse.json({
  // Existing 5 outputs
  designTokens: result.designTokens,
  webflowJson: result.webflowJson,
  cssEmbed: result.cssEmbed + (sanitization.embedContent.css || ''),
  jsEmbed: result.jsEmbed + (sanitization.embedContent.js || ''),
  libraryImports: result.libraryImports,
  
  // Validation metadata
  validationResults: {
    ...result.validationResults,
    sanitizationWarnings: sanitization.embedContent.warnings
  },
  
  // New: extracted content warnings
  extractedToEmbed: {
    hasCSSExtracted: !!sanitization.embedContent.css,
    hasJSExtracted: !!sanitization.embedContent.js,
    warnings: sanitization.embedContent.warnings
  }
});
```

---

## Phase 6: Update UI to Show Extraction Warnings

When content was extracted to embeds, tell the user:

```tsx
// In MultiStepCopyModal.tsx
{extractedToEmbed?.warnings?.length > 0 && (
  <div className="extraction-warning">
    <AlertIcon />
    <div>
      <strong>Some content was moved to embeds for safety:</strong>
      <ul>
        {extractedToEmbed.warnings.map((warning, i) => (
          <li key={i}>{warning}</li>
        ))}
      </ul>
      <p>Make sure to complete Steps 3 and 4 (CSS and JS embeds) for full functionality.</p>
    </div>
  </div>
)}
```

</instructions>

<output_format>

## Deliverables

1. **Updated validation-types.ts** - New error codes
2. **Updated preflight-validator.ts** - All new validation functions
3. **Updated webflow-sanitizer.ts** - Embed extraction functions
4. **Updated route.ts** - Include extracted embed content in response
5. **Updated MultiStepCopyModal.tsx** - Show extraction warnings

## Report Format

```markdown
# Validation Gap Closure Report

## New Validations Added
- [ ] Ghost variant detection
- [ ] UUID format validation
- [ ] Children reference validation
- [ ] ix2 interaction reference validation
- [ ] Asset reference validation
- [ ] Nested component validation

## Embed Fallback Implemented
- [ ] Invalid CSS → cssEmbed
- [ ] Broken interactions → jsEmbed (GSAP equivalent)
- [ ] Ghost variants → stripped with warning

## Files Modified
- file.ts: [changes]

## Test Results
- All validations pass on clean input
- Problematic content correctly routed to embeds
- webflowJson always pastes safely
```

</output_format>

<constraints>
## CRITICAL REQUIREMENTS

1. **webflowJson MUST always paste safely** - This is non-negotiable
2. **Never silently discard content** - If something is stripped, warn OR route to embed
3. **Embed fallback is the safety net** - When in doubt, extract to embed
4. **UUID regeneration on EVERY copy** - Not optional
5. **Validate AFTER sanitization** - Confirm the fix worked

## ANTI-LAZINESS

- DO NOT skip any validation type listed
- DO NOT implement partial validators - each must check ALL instances
- DO NOT forget to update the UI to show warnings
- DO NOT leave dead code paths - remove broken ix2, don't just flag it
- Test with the problematic file that caused the original crash

## FORBIDDEN

- Silently discarding user content without warning
- Leaving invalid references in webflowJson
- Skipping UUID regeneration
- Assuming LLM output is valid without validation
</constraints>

<task>
Implement all missing validations and the embed fallback strategy.

After implementation:
1. Run the test file `flow-bridge-test-all-outputs.html` through conversion
2. Verify webflowJson pastes without crashing Webflow Designer
3. Verify any extracted content appears correctly in cssEmbed/jsEmbed
4. Report all changes made

The goal: **Zero crashes. Ever. Anything risky goes to embeds.**
</task>

# Flow Bridge: Complete Validation System Implementation
## (Updated for Multi-Step Workflow)

**Target:** Claude CLI (Sonnet 4.5, Extended Thinking Enabled)
**Budget:** 25,000 thinking tokens
**Task Type:** Agentic Coding - Critical Multi-Layer Validation System

---

## Updated Context

<context>
Flow Bridge converts AI-generated HTML/CSS to Webflow components. The workflow involves THREE distinct copy-paste operations:

1. **Design Tokens** → Paste in Webflow Global Styles
2. **Basic Structure** → Paste in Webflow Designer  
3. **Advanced Code** → Paste in Custom Code Embeds

Each step requires different validation. The system MUST validate BEFORE the user clicks "Copy" - not after pasting into Webflow.

## Critical Requirements

### The Problem
- Users discover validation errors AFTER pasting into Webflow
- Designer crashes, projects corrupt, no way to recover
- No feedback about which CSS goes where (native vs embed)

### The Solution
- Validate BEFORE copy button is clicked
- Show validation UI with errors/warnings
- Guide user through 3-step copy process
- Block copy if critical errors exist
- Warn about advanced CSS that needs embeds

## Files Already Created (Need Integration)

The user has these files in their project (downloaded but not integrated):

1. `webflow-validator.ts` - Validates Webflow JSON structure
2. `html-sanitizer.ts` - Fixes HTML structure issues  
3. `webflow-corruption-analysis.md` - Documentation
4. `multi-step-workflow.md` - Explains the 3-step process

Your job: INTEGRATE these into the actual Flow Bridge codebase.
</context>

---

## Instructions

<instructions>

### Phase 1: Discovery & Architecture Planning

1. **Audit the codebase** to find:
   - Frontend: Where users click "Copy to Webflow" button
   - Backend: Where HTML/CSS is converted via Claude API
   - Convex mutations: Where conversion results are stored
   - UI components: Template cards, conversion result displays
   - Current conversion prompt used for Claude API

2. **Locate validation files** (downloaded by user):
   - `webflow-validator.ts` 
   - `html-sanitizer.ts`
   - Check if they're in project root, /lib, /utils, or /downloads

3. **Map the current flow**:
   ```
   Current state:
   User uploads HTML → Conversion → Storage → User clicks Copy → Paste → ERROR

   Target state:
   User uploads HTML → Sanitize → Convert → Split into 3 sections → 
   Validate each → Store → User sees validation UI → Clicks Copy (validated) → 
   Paste → SUCCESS
   ```

4. **Create implementation plan** with:
   - Where to place validator files
   - Which components need validation UI
   - How to split conversion into 3 sections
   - Testing strategy

**STOP - Present plan, wait for approval**

---

### Phase 2: Core Integration

#### 2.1 Setup Validation Modules

**A. Move validator files to appropriate location:**
```typescript
// Likely structure:
/lib/validation/
  ├── webflow-validator.ts
  ├── html-sanitizer.ts
  └── embed-validator.ts (new)
```

**B. Create CSS splitter module:**
```typescript
// /lib/validation/css-splitter.ts

export function splitCSSForWebflow(css: string): {
  nativeCSS: string;      // Can go in Webflow directly
  embedCSS: string;       // Needs custom code
  warnings: string[];
} {
  const warnings = [];
  const native = [];
  const embed = [];
  
  // Parse CSS and split by feature support
  const rules = parseCSS(css);
  
  rules.forEach(rule => {
    if (needsEmbed(rule)) {
      embed.push(rule);
      warnings.push(`"${rule.selector}" uses ${detectFeature(rule)} - needs embed`);
    } else {
      native.push(rule);
    }
  });
  
  return {
    nativeCSS: native.join('\n'),
    embedCSS: embed.join('\n'),
    warnings
  };
}

function needsEmbed(rule: CSSRule): boolean {
  const embedFeatures = [
    'oklch', 'color-mix', 'lch', 'lab',
    '@container', 'container-type',
    'backdrop-filter',
    ':has(', ':where(', ':is(',
    '@layer', '@scope'
  ];
  
  return embedFeatures.some(feature => 
    rule.css.includes(feature)
  );
}
```

#### 2.2 Update Claude API Conversion

**Enhance the conversion prompt to output 3 sections:**

```typescript
const ENHANCED_CONVERSION_PROMPT = `You are converting HTML/CSS to Webflow.

CRITICAL: Split output into 3 distinct sections:

1. DESIGN TOKENS - Webflow Global Styles
   Only basic CSS properties: colors (hex/rgb), fonts, spacing (px/rem)
   NO: oklch, color-mix, clamp with viewport units

2. BASIC STRUCTURE - Webflow JSON
   HTML nodes + basic CSS (flexbox, grid, positioning, colors, typography)
   NO: advanced CSS, animations, complex selectors
   
3. ADVANCED CODE - Custom Embeds
   Modern CSS features, GSAP, complex animations, third-party libraries

VALIDATION RULES (programmatically checked):
- Unique UUIDs for all nodes/styles
- No circular class references  
- State variants need parent classes (:hover needs base)
- Valid class names (kebab-case)
- No <br> inside inline elements with text

Output format:
{
  "designTokens": {
    "colors": { "primary": "#1A1A1A", ... },
    "typography": { "base": "16px", ... },
    "spacing": { "xl": "64px", ... }
  },
  "basicStructure": {
    "type": "@webflow/XscpData",
    "payload": {
      "nodes": [...],
      "styles": [...],
      "assets": []
    }
  },
  "embedCode": {
    "css": "/* Advanced CSS here */",
    "javascript": "/* JS libraries/animations */",
    "dependencies": ["https://cdn.../gsap.min.js"]
  }
}`;
```

**Update conversion mutation:**

```typescript
import { sanitizeHTMLForWebflow } from '@/lib/validation/html-sanitizer';
import { validateWebflowPayload } from '@/lib/validation/webflow-validator';
import { splitCSSForWebflow } from '@/lib/validation/css-splitter';

export const convertHTMLToWebflow = mutation({
  handler: async (ctx, args: { html: string, css: string, name: string }) => {
    
    // STEP 1: Sanitize HTML
    const { sanitizedHTML, validation: htmlValidation } = 
      prepareHTMLForWebflow(args.html);
    
    if (!htmlValidation.valid) {
      throw new Error(`HTML structure invalid: ${htmlValidation.errors.join(', ')}`);
    }
    
    // STEP 2: Pre-split CSS
    const { nativeCSS, embedCSS, warnings: cssWarnings } = 
      splitCSSForWebflow(args.css);
    
    // STEP 3: Convert with Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 6000,
        messages: [{
          role: "user",
          content: `${ENHANCED_CONVERSION_PROMPT}

HTML (pre-sanitized):
${sanitizedHTML}

CSS (native-compatible):
${nativeCSS}

CSS (for embed):
${embedCSS}

Convert to 3-section format.`
        }],
      }),
    });
    
    const data = await response.json();
    const conversion = JSON.parse(data.content[0].text);
    
    // STEP 4: Validate Webflow JSON
    const structureValidation = validateWebflowPayload(
      conversion.basicStructure, 
      true // auto-sanitize
    );
    
    if (!structureValidation.valid) {
      throw new Error(`Webflow validation failed: ${structureValidation.errors.join(', ')}`);
    }
    
    // STEP 5: Store with validation metadata
    const templateId = await ctx.db.insert("templates", {
      name: args.name,
      
      // Store all 3 sections
      designTokens: conversion.designTokens,
      basicStructure: structureValidation.sanitizedPayload || conversion.basicStructure,
      embedCode: conversion.embedCode,
      
      // Store validation results for UI display
      htmlWarnings: htmlValidation.warnings,
      cssWarnings: cssWarnings,
      structureWarnings: structureValidation.warnings,
      
      // Metadata
      createdAt: Date.now(),
      hasEmbed: !!conversion.embedCode,
    });
    
    return {
      templateId,
      validationSummary: {
        htmlValid: htmlValidation.valid,
        structureValid: structureValidation.valid,
        totalWarnings: 
          htmlValidation.warnings.length + 
          cssWarnings.length + 
          structureValidation.warnings.length
      }
    };
  }
});
```

#### 2.3 Frontend: Multi-Step Copy UI

**Create validation status component:**

```tsx
// /app/components/ValidationStatus.tsx

interface ValidationStatusProps {
  errors: ValidationError[];
  warnings: ValidationError[];
  onDismiss?: () => void;
}

export function ValidationStatus({ errors, warnings, onDismiss }: ValidationStatusProps) {
  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div className="validation-success">
        ✅ All validations passed
      </div>
    );
  }
  
  return (
    <div className="validation-panel">
      {errors.length > 0 && (
        <div className="validation-errors">
          <h4>❌ Errors (Must fix before copying)</h4>
          <ul>
            {errors.map((error, i) => (
              <li key={i}>
                <strong>[{error.rule}]</strong> {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {warnings.length > 0 && (
        <div className="validation-warnings">
          <h4>⚠️ Warnings (Recommended to review)</h4>
          <ul>
            {warnings.map((warning, i) => (
              <li key={i}>
                <strong>[{warning.rule}]</strong> {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {onDismiss && (
        <button onClick={onDismiss}>Dismiss</button>
      )}
    </div>
  );
}
```

**Create 3-step copy component:**

```tsx
// /app/components/MultiStepCopy.tsx

import { useState } from 'react';
import { validateWebflowPayload } from '@/lib/validation/webflow-validator';
import { ValidationStatus } from './ValidationStatus';

interface MultiStepCopyProps {
  template: {
    designTokens: any;
    basicStructure: any;
    embedCode?: any;
    structureWarnings: any[];
  };
}

export function MultiStepCopy({ template }: MultiStepCopyProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [showValidation, setShowValidation] = useState(false);
  
  const handleCopyTokens = async () => {
    // Simple copy - no complex validation needed
    const css = convertTokensToCSS(template.designTokens);
    await navigator.clipboard.writeText(css);
    
    toast.success('✅ Design tokens copied! Paste in Webflow Global Styles');
    setCurrentStep(2);
  };
  
  const handleCopyStructure = async () => {
    // CRITICAL: Validate BEFORE copying
    const validation = validateWebflowPayload(template.basicStructure, true);
    
    if (!validation.valid) {
      // BLOCK the copy
      setShowValidation(true);
      toast.error(`Cannot copy - ${validation.errors.length} errors found`);
      return;
    }
    
    // Show warnings but allow copy
    if (validation.warnings.length > 0) {
      setShowValidation(true);
      toast.warning(`⚠️ ${validation.warnings.length} warnings - check validation panel`);
    }
    
    // Use sanitized payload
    const payload = validation.sanitizedPayload || template.basicStructure;
    
    const blob = new Blob([JSON.stringify(payload)], { 
      type: 'application/json' 
    });
    
    await navigator.clipboard.write([
      new ClipboardItem({ 'application/json': blob })
    ]);
    
    toast.success('✅ Structure copied! Paste in Webflow (Cmd+V)');
    
    if (template.embedCode) {
      setCurrentStep(3);
    }
  };
  
  const handleCopyEmbed = async () => {
    if (!template.embedCode) return;
    
    const embedHTML = generateEmbedHTML(template.embedCode);
    await navigator.clipboard.writeText(embedHTML);
    
    toast.success('✅ Embed code copied! Paste in Page Settings > Custom Code');
  };
  
  return (
    <div className="multi-step-copy">
      {showValidation && (
        <ValidationStatus
          errors={[]}
          warnings={template.structureWarnings}
          onDismiss={() => setShowValidation(false)}
        />
      )}
      
      <div className="steps">
        <CopyStep
          number={1}
          active={currentStep === 1}
          completed={currentStep > 1}
          title="Design Tokens"
          description="Paste into: Webflow Global Styles panel"
          buttonText="Copy Tokens"
          onCopy={handleCopyTokens}
        />
        
        <CopyStep
          number={2}
          active={currentStep === 2}
          completed={currentStep > 2}
          title="Structure & Layout"
          description="Paste into: Webflow Designer canvas (Cmd+V)"
          buttonText="Copy Structure"
          onCopy={handleCopyStructure}
        />
        
        {template.embedCode && (
          <CopyStep
            number={3}
            active={currentStep === 3}
            title="Advanced Code"
            description="Paste into: Page Settings > Custom Code"
            buttonText="Copy Embed"
            onCopy={handleCopyEmbed}
            optional
          />
        )}
      </div>
    </div>
  );
}

function CopyStep({ number, active, completed, title, description, buttonText, onCopy, optional }) {
  return (
    <div className={`step ${active ? 'active' : ''} ${completed ? 'completed' : ''}`}>
      <div className="step-number">{completed ? '✓' : number}</div>
      <div className="step-content">
        <h4>
          {title}
          {optional && <span className="optional"> (Optional)</span>}
        </h4>
        <p className="description">{description}</p>
        <button 
          onClick={onCopy}
          disabled={!active}
          className={active ? 'primary' : 'secondary'}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}
```

#### 2.4 Update Template Card Component

Find the existing template card and add validation display:

```tsx
// Find: /app/components/TemplateCard.tsx (or similar)

export function TemplateCard({ template }: { template: Template }) {
  const [showCopyFlow, setShowCopyFlow] = useState(false);
  
  // Pre-validate on component mount
  const validationStatus = useMemo(() => {
    return validateWebflowPayload(template.basicStructure, false);
  }, [template]);
  
  return (
    <div className="template-card">
      <h3>{template.name}</h3>
      
      {/* Show validation badge */}
      <div className="validation-badge">
        {validationStatus.valid ? (
          <span className="badge-success">✅ Valid</span>
        ) : (
          <span className="badge-error">
            ❌ {validationStatus.errors.length} errors
          </span>
        )}
        
        {validationStatus.warnings.length > 0 && (
          <span className="badge-warning">
            ⚠️ {validationStatus.warnings.length} warnings
          </span>
        )}
      </div>
      
      <button onClick={() => setShowCopyFlow(true)}>
        Copy to Webflow
      </button>
      
      {showCopyFlow && (
        <Modal onClose={() => setShowCopyFlow(false)}>
          <MultiStepCopy template={template} />
        </Modal>
      )}
    </div>
  );
}
```

---

### Phase 3: Testing

1. **Unit tests for validators:**
   ```typescript
   // /tests/validation.test.ts
   
   describe('Webflow Validation', () => {
     it('blocks duplicate UUIDs', () => {
       const payload = createPayloadWithDuplicateIDs();
       const result = validateWebflowPayload(payload);
       expect(result.valid).toBe(false);
       expect(result.errors[0].rule).toBe('unique-ids');
     });
     
     it('blocks orphaned state variants', () => {
       const payload = createPayloadWithOrphanedHover();
       const result = validateWebflowPayload(payload);
       expect(result.valid).toBe(false);
     });
     
     it('auto-sanitizes when enabled', () => {
       const payload = createPayloadWithDuplicateIDs();
       const result = validateWebflowPayload(payload, true);
       expect(result.sanitizedPayload).toBeDefined();
       
       // Re-validate sanitized payload
       const recheck = validateWebflowPayload(result.sanitizedPayload!);
       expect(recheck.valid).toBe(true);
     });
   });
   ```

2. **Integration test:**
   ```typescript
   it('complete conversion flow', async () => {
     const html = '<div><span>Test</span></div>';
     const css = '.test { color: red; }';
     
     const result = await convertHTMLToWebflow({ html, css, name: 'Test' });
     
     expect(result.validationSummary.structureValid).toBe(true);
     expect(result.templateId).toBeDefined();
   });
   ```

3. **Manual testing checklist:**
   - [ ] Upload HTML with `<br>` inside `<span>` → Should sanitize
   - [ ] Convert component with advanced CSS → Should split to embed
   - [ ] Click "Copy Structure" with errors → Should be blocked
   - [ ] Click "Copy Structure" with warnings → Should allow but warn
   - [ ] Paste in Webflow → Should work without errors
   - [ ] Test all 3 copy steps in sequence

---

### Phase 4: Documentation

1. Update README with:
   - How validation works
   - 3-step copy process
   - What goes in embeds vs native

2. Add developer docs:
   - How to add new validation rules
   - How to extend CSS splitter
   - Testing guide

</instructions>

---

## Constraints

<constraints>
CRITICAL SAFETY RULES:

1. **Validation ALWAYS runs before copy** - No exceptions
2. **Block copy if errors exist** - Users cannot bypass
3. **Show validation UI** - Users must see what's wrong
4. **Auto-sanitize when safe** - Use sanitized payloads
5. **Log everything** - Validation results, errors, warnings

IMPLEMENTATION RULES:

1. **Don't break existing functionality** - Only add validation
2. **Preserve user data** - Store original HTML + sanitized version
3. **Clear error messages** - User-friendly, actionable
4. **Performance** - Validation should be < 100ms
5. **Type safety** - Strict TypeScript, no `any`

UX RULES:

1. **Progressive disclosure** - Show validation on demand
2. **Don't block workflow** - Warnings allow proceeding
3. **Guide the user** - Clear steps, what to paste where
4. **Visual feedback** - Success/error/warning states
</constraints>

---

## Output Format

<output_format>

### Phase 1 (Planning):

```markdown
## Implementation Plan

### Files Located
- ✅ webflow-validator.ts found at: /lib/validation/webflow-validator.ts
- ✅ html-sanitizer.ts found at: /downloads/html-sanitizer.ts (needs moving)

### Files to Modify
- [ ] /convex/mutations/convert.ts - Add 3-section conversion
- [ ] /app/components/TemplateCard.tsx - Add validation display
- [ ] /app/lib/claude-api.ts - Update conversion prompt

### Files to Create
- [ ] /lib/validation/css-splitter.ts - Split CSS by feature support
- [ ] /lib/validation/embed-validator.ts - Validate embed code
- [ ] /app/components/MultiStepCopy.tsx - 3-step copy UI
- [ ] /app/components/ValidationStatus.tsx - Validation display

### Integration Points
1. Conversion mutation: sanitize → convert → validate → store
2. Template card: show validation badges
3. Copy buttons: validate before clipboard write
4. UI: multi-step guided flow

### Testing Strategy
- Unit tests for each validator
- Integration test for full flow
- Manual test with portfolio.html
```

**STOP - Wait for approval**

### Phase 2+ (Implementation):

For each change:
```markdown
## ✅ Modified: /path/to/file.ts

**What:** Added validation before copy operation
**Why:** Prevents Designer corruption
**How:** Calls validateWebflowPayload(), blocks if errors

**Code:**
[Show changes]

**Tested:**
- [x] Unit test passes
- [ ] Integration test pending
```

### Final Output:

```markdown
## ✅ Complete Validation System Implemented

### Summary
- ✅ HTML sanitization (pre-conversion)
- ✅ 3-section conversion (tokens/structure/embed)
- ✅ Webflow JSON validation (post-conversion)
- ✅ Multi-step copy UI with validation feedback
- ✅ Tests passing

### How Users See It

1. Upload HTML/CSS
2. See "✅ Valid" or "❌ X errors" badge on template
3. Click "Copy to Webflow"
4. Modal opens with 3 steps:
   - Step 1: Copy Tokens → Paste in Global Styles
   - Step 2: Copy Structure → Paste in Designer (validated!)
   - Step 3: Copy Embed → Paste in Custom Code
5. If errors, copy is blocked with clear message
6. If warnings, copy allowed but user sees them

### Files Modified
[List]

### Next Steps
1. Deploy to staging
2. Test with production templates
3. Monitor validation errors in logs
4. Iterate based on real usage

### Testing
```bash
npm test                # Run all tests
npm run test:validation # Run validation tests only
npm run dev            # Start dev server and test manually
```
```
</output_format>

---

## API Configuration

**Model:** Claude Sonnet 4.5
**Extended Thinking:** YES - 25,000 tokens
**Temperature:** 0.0
**Max Tokens:** 8000

---

## Success Criteria

✅ Validation runs BEFORE copy (not after paste)
✅ Multi-step UI guides user through process
✅ Errors block copy, warnings allow with notice
✅ All 3 sections validated independently
✅ Tests confirm validation catches issues
✅ User sees clear, actionable feedback

❌ Any path allows unvalidated copy
❌ Users discover errors only in Webflow
❌ Silent failures or unclear error messages

---

Ready to begin. Start with Phase 1: Discovery & Planning.

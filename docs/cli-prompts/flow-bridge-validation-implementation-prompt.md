# Flow Bridge: Implement Webflow Validation System

**Target:** Claude CLI (Sonnet 4.5, Extended Thinking Enabled)
**Budget:** 20,000 thinking tokens
**Task Type:** Agentic Coding - Critical Infrastructure Implementation

---

## Role & Context

<role>
You are a senior full-stack engineer implementing a critical validation system for Flow Bridge, an HTML-to-Webflow conversion platform. Your expertise includes Convex backend architecture, Next.js frontend development, Claude API integration, and Webflow's internal data structures.

The project recently experienced a catastrophic Designer corruption caused by malformed JSON payloads from AI-generated conversions. You are implementing a validation pipeline to prevent this from ever happening again.
</role>

<context>
## Project Architecture

Flow Bridge consists of:
- **Frontend**: Next.js app (likely in `/app` or `/src`)
- **Backend**: Convex (likely in `/convex`)
- **Conversion Pipeline**: Claude Sonnet 4 API calls that transform HTML/CSS to Webflow JSON
- **Storage**: Templates table in Convex with JSON payloads
- **Extension**: Webflow Designer Extension (if exists in `/extension` or similar)

## Critical Background

The user has downloaded three validation files into their project:
1. `webflow-corruption-analysis.md` - Documents the corruption patterns
2. `webflow-validator.ts` - Production-ready TypeScript validation code
3. `flow-bridge-integration.md` - Integration examples and patterns

These files contain the complete validation logic that MUST be integrated at every point where Webflow JSON payloads are:
- Generated (Claude API)
- Stored (Convex mutations)
- Retrieved (Convex queries)
- Copied to clipboard (Frontend)

## The Problem

Previous conversions created payloads with:
- Duplicate UUIDs
- Circular class references
- Orphaned state variants (`:hover` without base class)
- Missing required properties
- Invalid class names

These caused Webflow Designer to freeze and corrupt projects irreparably.

## The Solution

Implement validation at EVERY conversion point using the validator code provided. No payload should EVER reach the clipboard or Designer without passing validation.
</context>

---

## Instructions

<instructions>
Your mission is to implement comprehensive validation throughout the Flow Bridge codebase. This is a CRITICAL safety system.

### Phase 1: Discovery & Planning

1. **Audit the codebase** to find:
   - Where HTML/CSS is sent to Claude API for conversion
   - Where conversion results are stored in Convex
   - Where payloads are retrieved and copied to clipboard
   - Any existing validation or sanitization logic
   - The current Claude API conversion prompt

2. **Locate the validator files** the user downloaded:
   - `webflow-corruption-analysis.md`
   - `webflow-validator.ts`
   - `flow-bridge-integration.md`

3. **Create an implementation plan** as a checklist with:
   - Files to modify
   - New files to create
   - Integration points for validation
   - Testing approach

**STOP HERE** - Present your plan and wait for approval before executing.

### Phase 2: Core Integration

After approval, implement in this order:

#### 2.1 Setup Validation Module

- Move `webflow-validator.ts` to appropriate location (likely `/lib/webflow-validator.ts` or `/convex/webflow-validator.ts`)
- Install required dependencies (`uuid` if not present)
- Export validation functions for use across codebase

#### 2.2 Backend Integration (Convex)

Find the mutation that converts HTML/CSS and stores results. Integrate validation:

```typescript
// BEFORE (unsafe):
const payload = await convertWithClaude(html, css);
await ctx.db.insert("templates", { payload });

// AFTER (safe):
const rawPayload = await convertWithClaude(html, css);
const validation = validateWebflowPayload(rawPayload, true);

if (!validation.valid) {
  throw new Error(`Validation failed: ${formatValidationErrors(validation)}`);
}

const safePayload = validation.sanitizedPayload || rawPayload;
await ctx.db.insert("templates", { 
  payload: safePayload,
  validationWarnings: validation.warnings 
});
```

**Critical**: Update ALL conversion mutations to use this pattern.

#### 2.3 Claude API Prompt Enhancement

Find where the Claude API conversion prompt is defined. Enhance it with validation requirements:

```typescript
const CONVERSION_PROMPT = `You are converting HTML/CSS to Webflow JSON format.

CRITICAL VALIDATION RULES (programmatically checked):

1. UUID Uniqueness
   - Every node._id must be unique
   - Every style._id must be unique
   - Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx

2. No Circular References
   - Styles cannot reference themselves in children arrays
   - No dependency cycles: A -> B -> C -> A

3. State Variants Need Parents
   - "button:hover" requires base "button" class
   - Pattern: [base]:[state] where [base] exists

4. Required Style Properties
   {
     "_id": "uuid",
     "fake": false,
     "type": "class",
     "name": "kebab-case-name",
     "namespace": "",
     "comb": "",
     "styleLess": "/* valid css */",
     "variants": {},
     "children": [],
     "selector": null
   }

5. Valid Class Names
   - kebab-case only: "hero-section" not "Hero Section"
   - No spaces or special characters

Output format:
{
  "type": "@webflow/XscpData",
  "payload": {
    "nodes": [...],
    "styles": [...],
    "assets": []
  }
}`;
```

#### 2.4 Frontend Validation (Pre-Copy)

Find the copy-to-clipboard function. Add pre-flight validation:

```typescript
// BEFORE (unsafe):
const handleCopy = async () => {
  await navigator.clipboard.write([...]);
};

// AFTER (safe):
const handleCopy = async () => {
  // Validate before copying
  const validation = validateWebflowPayload(template.payload, true);
  
  if (!validation.valid) {
    showError(`Cannot copy - validation errors:\n${formatValidationErrors(validation)}`);
    return;
  }
  
  // Use sanitized payload
  const safePayload = validation.sanitizedPayload || template.payload;
  await navigator.clipboard.write([...]);
  
  // Show warnings if any
  if (validation.warnings.length > 0) {
    showWarning(`Copied with ${validation.warnings.length} warnings`);
  }
};
```

#### 2.5 Add Validation Status UI

Create a validation indicator component:

```tsx
<ValidationStatus 
  errors={validationResult.errors}
  warnings={validationResult.warnings}
/>
```

Show this on template cards BEFORE the user clicks copy.

### Phase 3: Testing & Verification

1. **Add unit tests** for validation functions
2. **Test with real AI conversions** - run existing templates through validator
3. **Create test payloads** with known issues (duplicate IDs, circular refs)
4. **Verify error messages** are user-friendly

### Phase 4: Documentation

1. **Update project README** with validation info
2. **Add developer docs** explaining validation rules
3. **Document recovery process** if validation fails
</instructions>

---

## Constraints

<constraints>
CRITICAL SAFETY RULES:

1. **NEVER bypass validation** - No "quick paste" or "skip validation" option
2. **ALWAYS use sanitized payloads** - If validation.sanitizedPayload exists, use it
3. **FAIL LOUDLY** - Validation errors must be visible to users and logged
4. **NO SILENT FAILURES** - Never catch and swallow validation errors
5. **TEST EXTENSIVELY** - Corrupted Designer projects are catastrophic

IMPLEMENTATION RULES:

1. **Minimal, surgical changes** - Don't refactor unrelated code
2. **Preserve existing functionality** - Only add validation, don't break features
3. **Use TypeScript strictly** - No `any` types in validation code
4. **Follow existing code style** - Match the project's patterns
5. **Add comments** - Explain WHY validation is critical at each point

ERROR HANDLING:

1. **User-facing errors** - Use plain language, not technical jargon
2. **Developer errors** - Log full validation results to console
3. **Telemetry** - Consider adding error tracking (Sentry, LogRocket)
</constraints>

---

## Output Format

<output_format>
### Phase 1 Output (Planning)

```markdown
## Implementation Plan

### Files to Modify
- [ ] `/convex/convert.ts` - Add validation to conversion mutation
- [ ] `/app/components/TemplateCard.tsx` - Add pre-copy validation
- [ ] ...

### Files to Create
- [ ] `/lib/webflow-validator.ts` - Move validator here
- [ ] `/app/components/ValidationStatus.tsx` - New UI component
- [ ] ...

### Integration Points
1. Convex mutation: `convertHTMLToWebflow` (line X)
2. Frontend copy handler: `handleCopyToWebflow` (line Y)
3. ...

### Testing Strategy
- Unit tests for validator functions
- Integration test with AI conversion
- Manual test with known-bad payloads
```

**STOP - Wait for approval before proceeding to Phase 2**

### Phase 2+ Output (Implementation)

For each change:
```markdown
## ✅ Modified: /path/to/file.ts

**What changed:**
- Added validateWebflowPayload call before storing
- Enhanced error handling to show validation messages
- Added logging for validation warnings

**Why:**
Prevents malformed payloads from corrupting Webflow Designer

**Code:**
```typescript
// Show the actual code changes
```

**Tested:**
- [x] Unit test passes
- [x] Converts sample HTML successfully
- [x] Blocks payload with duplicate UUIDs
```

### Final Output

```markdown
## ✅ Validation System Implemented

### Summary
- ✅ Backend validation (Convex mutations)
- ✅ Frontend validation (clipboard operations)
- ✅ Enhanced Claude prompts
- ✅ UI feedback for validation status
- ✅ Tests added and passing

### Files Modified
1. `/convex/convert.ts`
2. `/app/components/TemplateCard.tsx`
3. ...

### Files Created
1. `/lib/webflow-validator.ts`
2. `/tests/validation.test.ts`
3. ...

### Next Steps
1. Deploy to staging
2. Test with production data
3. Monitor validation errors in logs
4. Update user documentation

### How to Test
```bash
npm test
npm run dev
# Try converting sample HTML
# Verify validation warnings appear in UI
```
```
</output_format>

---

## Examples

<examples>
<example>
<context>User has a Convex mutation that stores Claude API results directly</context>
<bad_code>
```typescript
export const convertTemplate = mutation({
  handler: async (ctx, args) => {
    const result = await callClaudeAPI(args.html);
    const payload = JSON.parse(result.content);
    
    // UNSAFE: No validation!
    await ctx.db.insert("templates", { payload });
  }
});
```
</bad_code>
<good_code>
```typescript
import { validateWebflowPayload, formatValidationErrors } from "./webflow-validator";

export const convertTemplate = mutation({
  handler: async (ctx, args) => {
    const result = await callClaudeAPI(args.html);
    const rawPayload = JSON.parse(result.content);
    
    // SAFE: Validate and sanitize
    const validation = validateWebflowPayload(rawPayload, true);
    
    if (!validation.valid) {
      console.error("Validation failed:", formatValidationErrors(validation));
      throw new Error(`Conversion produced invalid Webflow JSON:\n${formatValidationErrors(validation)}`);
    }
    
    // Use sanitized payload
    const safePayload = validation.sanitizedPayload || rawPayload;
    
    await ctx.db.insert("templates", { 
      payload: safePayload,
      validationWarnings: validation.warnings.map(w => w.message)
    });
    
    return { 
      success: true, 
      warnings: validation.warnings.length 
    };
  }
});
```
</good_code>
</example>

<example>
<context>Frontend copy button needs validation</context>
<bad_code>
```tsx
const handleCopy = async () => {
  const blob = new Blob([JSON.stringify(template.payload)], {
    type: 'application/json'
  });
  await navigator.clipboard.write([new ClipboardItem({ 'application/json': blob })]);
  toast.success('Copied!');
};
```
</bad_code>
<good_code>
```tsx
import { validateWebflowPayload, formatValidationErrors } from '@/lib/webflow-validator';

const handleCopy = async () => {
  // Pre-flight validation
  const validation = validateWebflowPayload(template.payload, true);
  
  if (!validation.valid) {
    toast.error(`Cannot copy - has validation errors. See console for details.`);
    console.error(formatValidationErrors(validation));
    return;
  }
  
  // Use sanitized payload if available
  const safePayload = validation.sanitizedPayload || template.payload;
  
  const blob = new Blob([JSON.stringify(safePayload)], {
    type: 'application/json'
  });
  await navigator.clipboard.write([new ClipboardItem({ 'application/json': blob })]);
  
  // Show success with warnings if any
  if (validation.warnings.length > 0) {
    toast.warning(`Copied with ${validation.warnings.length} warnings - check console`);
    console.warn('Validation warnings:', validation.warnings);
  } else {
    toast.success('✅ Copied! Paste in Webflow with Cmd+V');
  }
};
```
</good_code>
</example>
</examples>

---

## Task Execution Protocol

<execution_protocol>
### WORKING RULES (Follow Strictly)

1. **THINK FIRST** - Use extended thinking to:
   - Map the codebase structure
   - Identify all conversion points
   - Plan the safest implementation order

2. **PLAN WITH CHECKLIST** - Create detailed task list

3. **STOP** - Present plan and wait for approval

4. **EXECUTE INCREMENTALLY**:
   - One file at a time
   - Mark tasks complete as you go
   - Summarize each change

5. **SIMPLICITY IS LAW**:
   - Minimal changes only
   - Don't refactor unrelated code
   - Preserve existing patterns

6. **NO LAZY FIXES**:
   - Find root causes
   - Fix at all integration points
   - Don't add workarounds

7. **ADD REVIEW SECTION**:
   - What you changed
   - Why it matters
   - How to test
</execution_protocol>

---

## API Configuration

**Model:** Claude Sonnet 4.5 (claude-sonnet-4-5-20250514)
**Extended Thinking:** YES - Budget 20,000 tokens
**Temperature:** 0.0 (deterministic, critical safety code)
**Max Tokens:** 8000

---

## Success Criteria

The implementation succeeds when:

- ✅ All conversion paths include validation
- ✅ No payload can reach clipboard without validation
- ✅ Validation errors are shown to users
- ✅ Tests verify validation catches known-bad payloads
- ✅ Code includes comments explaining why validation is critical
- ✅ Documentation updated with validation info

The implementation fails if:

- ❌ Any conversion path skips validation
- ❌ Users can bypass validation
- ❌ Validation fails silently
- ❌ No tests verify validation works

---

## Final Notes

This is CRITICAL INFRASTRUCTURE. A single missed validation point could corrupt user projects and destroy trust in the platform.

Take your time. Think deeply. Test thoroughly.

The goal is not speed - it's ensuring this NEVER happens again.

Ready to begin? Start with Phase 1: Discovery & Planning.

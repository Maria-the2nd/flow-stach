# How to Use This Prompt with Claude CLI

## Setup

1. **Ensure you have Claude CLI installed:**
   ```bash
   # If not installed:
   npm install -g @anthropic-ai/claude-cli
   
   # Verify installation:
   claude --version
   ```

2. **Configure API key (if not already done):**
   ```bash
   export ANTHROPIC_API_KEY="your-api-key-here"
   ```

3. **Navigate to your Flow Bridge project root:**
   ```bash
   cd /path/to/flow-bridge
   ```

## Method 1: Direct File Input (Recommended)

Save the prompt as a file in your project and run:

```bash
# Copy the prompt to your project
cp flow-bridge-validation-implementation-prompt.md ./VALIDATION_TASK.md

# Run Claude CLI with the prompt
claude -f VALIDATION_TASK.md
```

## Method 2: Interactive Mode

Start interactive session:

```bash
claude
```

Then paste the entire prompt from `flow-bridge-validation-implementation-prompt.md` into the session.

## Method 3: Piped Input

```bash
cat flow-bridge-validation-implementation-prompt.md | claude
```

## Expected Workflow

### Phase 1: Planning (You'll see this first)

Claude will:
1. Audit your codebase
2. Locate all conversion points
3. Find the validation files you downloaded
4. Present an implementation plan with checklist

**Example output:**
```markdown
## Implementation Plan

### Files to Modify
- [ ] /convex/mutations/convert.ts - Add validation to conversion mutation
- [ ] /app/components/templates/TemplateCard.tsx - Add pre-copy validation
- [ ] /app/lib/claude-api.ts - Enhance conversion prompt

### Files to Create  
- [ ] /lib/webflow-validator.ts - Move validator here
- [ ] /app/components/ValidationStatus.tsx - UI component
- [ ] /tests/validation.test.ts - Test suite

### Integration Points
1. Convex mutation `convertHTMLToWebflow` in convex/mutations/convert.ts:45
2. Frontend copy handler in app/components/templates/TemplateCard.tsx:78
3. Claude API prompt in app/lib/claude-api.ts:12

### Testing Strategy
- Unit tests for all validator functions
- Integration test with sample HTML conversion
- Manual test with intentionally broken payloads
```

**STOP HERE** - Claude will wait for your approval. Review the plan carefully!

### Approving the Plan

If the plan looks good, respond:
```
✅ Approved - proceed with implementation
```

If you need changes:
```
The plan looks good except:
- Don't modify X file, instead modify Y
- Add validation to Z component as well
```

### Phase 2: Implementation

Claude will execute the plan step-by-step:
- Modify/create files
- Add validation at all integration points  
- Update prompts
- Add tests
- Document changes

For each change, you'll see:
```markdown
## ✅ Modified: /convex/mutations/convert.ts

**What changed:**
- Added validateWebflowPayload import and call
- Enhanced error handling with formatValidationErrors
- Now stores validationWarnings in database

**Why:**
Prevents malformed payloads from corrupting Webflow Designer by validating before storage.

**Code:**
[Shows the actual code changes]

**Testing:**
- [x] TypeScript compiles
- [x] Convex schema updated
- [ ] Integration test pending
```

### Phase 3: Review & Testing

After implementation, Claude will provide:
- Summary of all changes
- Testing instructions
- Next steps for deployment

## Configuration Notes

The prompt is configured for:
- **Model:** Sonnet 4.5 (best coder)
- **Extended Thinking:** Enabled (20K tokens)
- **Temperature:** 0.0 (deterministic for safety-critical code)

If using Claude CLI's config file, ensure these match:

```json
{
  "model": "claude-sonnet-4-5-20250514",
  "thinking": {
    "type": "enabled",
    "budget": 20000
  },
  "temperature": 0.0
}
```

## Tips for Success

### 1. Give Claude Full Context
Claude CLI has access to your entire project directory. It will:
- Read your existing code
- Understand your project structure
- Preserve your coding patterns

### 2. Review Before Approving
The planning phase is critical. Make sure:
- All conversion points are identified
- The integration points make sense
- No critical files are missing

### 3. Test Incrementally
After Claude makes changes:
```bash
# Check TypeScript compilation
npm run typecheck

# Run tests
npm test

# Try the conversion flow
npm run dev
```

### 4. Ask Questions
If anything is unclear:
```
Can you explain why you're modifying X file?
What happens if validation fails in Y scenario?
How do I test the Z integration?
```

### 5. Iterate if Needed
If the first implementation has issues:
```
The validation works but the error messages aren't showing in the UI. 
Can you update the TemplateCard component to display validation errors 
in a toast notification?
```

## Common Issues

### Issue: Claude can't find the validator files

**Solution:**
```
The validation files are located at:
- /lib/webflow-validator.ts
- /docs/webflow-corruption-analysis.md
- /docs/flow-bridge-integration.md

Please use these paths.
```

### Issue: Claude modifies too many files

**Solution:**
```
Please make minimal changes. Only modify files directly related to:
1. Conversion (where Claude API is called)
2. Storage (where results are saved to Convex)
3. Copy (where payloads are sent to clipboard)

Do not refactor other parts of the codebase.
```

### Issue: Validation is too strict

**Solution:**
After seeing results:
```
The validation is blocking legitimate components. Can you:
1. Make the class name validation a WARNING instead of ERROR
2. Allow class names with uppercase (just warn about convention)
```

## Advanced: Custom Validation Rules

If you need additional validation beyond what's in the validator:

```
After implementing the base validation, please add an additional check:

Rule: Maximum 100 classes per component
Severity: Warning (not error)
Message: "Component has {count} classes. Consider refactoring for maintainability."

Add this to the validateClassCount function.
```

## Monitoring After Implementation

Once deployed, monitor:
1. **Convex logs** - Check for validation errors
2. **Frontend console** - Watch for validation warnings
3. **User feedback** - Do copy operations succeed?

Add Sentry or LogRocket:
```typescript
if (!validation.valid) {
  Sentry.captureMessage('Webflow validation failed', {
    level: 'error',
    extra: {
      errors: validation.errors,
      componentName: template.name,
    },
  });
}
```

## Success Indicators

✅ You'll know it's working when:
- All conversions show validation status in UI
- Users see clear error messages if validation fails
- No corrupted Designer projects occur
- Tests confirm validation catches known issues

## Get Help

If you encounter issues:
1. Share the exact error message
2. Show the relevant code Claude generated
3. Describe what you expected vs what happened
4. Claude CLI can help debug: "The validation is failing with X error, can you investigate?"

---

## Quick Start (TL;DR)

```bash
# 1. Save prompt to project
cp flow-bridge-validation-implementation-prompt.md ./VALIDATION_TASK.md

# 2. Run Claude CLI
cd /path/to/flow-bridge
claude -f VALIDATION_TASK.md

# 3. Review plan, approve, let it work

# 4. Test
npm test
npm run dev
# Try converting sample HTML

# 5. Deploy
git add .
git commit -m "Add Webflow payload validation system"
git push
```

That's it! Claude CLI will handle the rest, asking for your input at key decision points.

# Flow Bridge Integration Examples

## How to Integrate Validation into Your Pipeline

### 1. Convex Backend Integration

Add validation BEFORE storing converted payloads in Convex database:

```typescript
// convex/convert.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { validateWebflowPayload, formatValidationErrors } from "./webflow-validator";

export const convertAndValidate = mutation({
  args: {
    html: v.string(),
    css: v.string(),
    componentName: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Call Claude Sonnet 4 API for conversion
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `Convert this HTML/CSS to Webflow JSON format:
          
HTML:
${args.html}

CSS:
${args.css}

Return ONLY valid @webflow/XscpData JSON. Ensure:
- All UUIDs are unique
- No circular class references
- All state variants (:hover, :focus) have parent classes
- Class names use kebab-case
- No orphaned references`
        }],
      }),
    });

    const data = await response.json();
    const rawPayload = JSON.parse(data.content[0].text);

    // 2. CRITICAL: Validate and sanitize
    const validationResult = validateWebflowPayload(rawPayload, true);

    if (!validationResult.valid) {
      // If sanitization failed, log errors and throw
      console.error("Validation failed:", formatValidationErrors(validationResult));
      
      if (validationResult.errors.length > 0) {
        throw new Error(`Conversion validation failed:\n${formatValidationErrors(validationResult)}`);
      }
    }

    // 3. Store the SANITIZED payload
    const finalPayload = validationResult.sanitizedPayload || rawPayload;

    const templateId = await ctx.db.insert("templates", {
      name: args.componentName,
      category: "Full Page",
      payload: finalPayload,
      validationWarnings: validationResult.warnings,
      createdAt: Date.now(),
    });

    return {
      templateId,
      validationResult: {
        valid: validationResult.valid,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      },
    };
  },
});
```

### 2. Frontend Pre-Paste Validation

Show validation UI BEFORE allowing user to paste:

```tsx
// app/components/TemplateCard.tsx
import { useState } from 'react';
import { validateWebflowPayload, formatValidationErrors } from '@/lib/webflow-validator';

export function TemplateCard({ template }) {
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState(null);

  const handleCopyWithValidation = async () => {
    setValidating(true);

    // Pre-flight validation
    const result = validateWebflowPayload(template.payload, true);
    setValidationStatus(result);

    if (result.errors.length > 0) {
      // Show errors, block paste
      alert(`Cannot paste - validation errors:\n${formatValidationErrors(result)}`);
      setValidating(false);
      return;
    }

    // Use sanitized payload if available
    const payloadToCopy = result.sanitizedPayload || template.payload;

    // Copy to clipboard
    try {
      const blob = new Blob([JSON.stringify(payloadToCopy)], {
        type: 'application/json',
      });
      const data = [new ClipboardItem({ 'application/json': blob })];
      await navigator.clipboard.write(data);

      // Show success with warnings if any
      if (result.warnings.length > 0) {
        console.warn('Paste succeeded with warnings:', result.warnings);
      }
      
      alert('✅ Copied to clipboard! Switch to Webflow and paste (Cmd+V)');
    } catch (err) {
      console.error('Copy failed:', err);
      alert('❌ Copy failed - see console for details');
    }

    setValidating(false);
  };

  return (
    <div className="template-card">
      <h3>{template.name}</h3>
      
      {validationStatus && (
        <div className={validationStatus.valid ? 'status-ok' : 'status-error'}>
          {validationStatus.valid ? '✅ Validated' : '❌ Has errors'}
          {validationStatus.warnings.length > 0 && (
            <span> (⚠️ {validationStatus.warnings.length} warnings)</span>
          )}
        </div>
      )}
      
      <button 
        onClick={handleCopyWithValidation}
        disabled={validating}
      >
        {validating ? 'Validating...' : 'Copy to Webflow'}
      </button>
    </div>
  );
}
```

### 3. Add Validation to Claude Conversion Prompt

Update your Claude API system prompt to include validation requirements:

```typescript
const CONVERSION_SYSTEM_PROMPT = `You are a Webflow JSON generator. Convert HTML/CSS to valid @webflow/XscpData format.

CRITICAL VALIDATION RULES (these will be programmatically checked):

1. UUID Uniqueness
   - Every node._id must be unique
   - Every style._id must be unique
   - Use proper UUID v4 format: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'

2. No Circular References
   - A style cannot reference itself in style.children
   - No circular dependency chains: A -> B -> C -> A

3. State Variants Must Have Parents
   - If you create "button:hover", you MUST have "button" base class
   - Pattern: [base-name]:[state] where [base-name] exists

4. Required Properties
   Every style object MUST have:
   {
     "_id": "uuid-here",
     "fake": false,
     "type": "class",
     "name": "class-name",
     "namespace": "",
     "comb": "",
     "styleLess": "/* css here */",
     "variants": {},
     "children": [],
     "selector": null
   }

5. Valid Class Names
   - Use kebab-case: "hero-section" not "Hero Section"
   - Only alphanumeric, hyphens, underscores
   - No spaces, special chars

6. No Orphaned References
   - All node.children IDs must exist in nodes array
   - All style.children IDs must exist in styles array

OUTPUT FORMAT:
{
  "type": "@webflow/XscpData",
  "payload": {
    "nodes": [...],
    "styles": [...],
    "assets": []
  }
}

Do not include interaction data (ix2). Do not include symbols.`;
```

### 4. Real-Time Validation Dashboard

Create admin panel showing validation status of all templates:

```tsx
// app/admin/validation-dashboard.tsx
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { validateWebflowPayload } from '@/lib/webflow-validator';

export function ValidationDashboard() {
  const templates = useQuery(api.templates.list);

  const validateAll = async () => {
    if (!templates) return;

    const results = templates.map(template => ({
      name: template.name,
      ...validateWebflowPayload(template.payload, false)
    }));

    // Group by status
    const valid = results.filter(r => r.valid);
    const hasErrors = results.filter(r => r.errors.length > 0);
    const hasWarnings = results.filter(r => r.warnings.length > 0 && r.errors.length === 0);

    console.log(`
📊 Validation Results:
✅ Valid: ${valid.length}
❌ Errors: ${hasErrors.length}
⚠️  Warnings only: ${hasWarnings.length}
    `);

    // Show details for error cases
    hasErrors.forEach(result => {
      console.error(`\n❌ ${result.name}:`);
      result.errors.forEach(err => {
        console.error(`  - [${err.rule}] ${err.message}`);
      });
    });

    return results;
  };

  return (
    <div className="validation-dashboard">
      <h1>Template Validation Status</h1>
      <button onClick={validateAll}>Run Validation on All Templates</button>
      
      <table>
        <thead>
          <tr>
            <th>Template</th>
            <th>Status</th>
            <th>Errors</th>
            <th>Warnings</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {templates?.map(template => {
            const result = validateWebflowPayload(template.payload, false);
            return (
              <tr key={template._id}>
                <td>{template.name}</td>
                <td>
                  {result.valid ? '✅' : '❌'}
                </td>
                <td>{result.errors.length}</td>
                <td>{result.warnings.length}</td>
                <td>
                  {!result.valid && (
                    <button onClick={() => fixTemplate(template._id)}>
                      Auto-Fix
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

### 5. Automated Testing

Add validation tests to catch issues before deployment:

```typescript
// tests/webflow-validation.test.ts
import { describe, it, expect } from 'vitest';
import { validateWebflowPayload } from '../lib/webflow-validator';

describe('Webflow Payload Validation', () => {
  it('should reject duplicate UUIDs', () => {
    const payload = {
      type: '@webflow/XscpData',
      payload: {
        nodes: [
          { _id: 'same-id', type: 'Block', tag: 'div', classes: [], children: [] },
          { _id: 'same-id', type: 'Block', tag: 'div', classes: [], children: [] },
        ],
        styles: [],
        assets: [],
      },
    };

    const result = validateWebflowPayload(payload, false);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rule).toBe('unique-ids');
  });

  it('should reject orphaned state variants', () => {
    const payload = {
      type: '@webflow/XscpData',
      payload: {
        nodes: [],
        styles: [
          {
            _id: 'style-1',
            type: 'class',
            name: 'button:hover',
            styleLess: 'background: blue;',
            variants: {},
            children: [],
            selector: null,
          },
          // Missing base "button" class!
        ],
        assets: [],
      },
    };

    const result = validateWebflowPayload(payload, false);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.rule === 'no-orphaned-states')).toBe(true);
  });

  it('should auto-sanitize on validation failure', () => {
    const payload = {
      type: '@webflow/XscpData',
      payload: {
        nodes: [
          { _id: 'dup', type: 'Block', tag: 'div', classes: [], children: [] },
          { _id: 'dup', type: 'Block', tag: 'div', classes: [], children: [] },
        ],
        styles: [],
        assets: [],
      },
    };

    const result = validateWebflowPayload(payload, true); // auto-sanitize
    expect(result.sanitizedPayload).toBeDefined();
    
    // Check sanitized payload has unique IDs
    const ids = result.sanitizedPayload.payload.nodes.map(n => n._id);
    expect(new Set(ids).size).toBe(ids.length); // All unique
  });
});
```

## Deployment Checklist

Before deploying to production:

- [ ] Add validation to Convex conversion mutation
- [ ] Add pre-paste validation to frontend copy buttons
- [ ] Update Claude conversion prompt with validation rules
- [ ] Create validation dashboard for monitoring
- [ ] Add automated tests for critical validation rules
- [ ] Set up error logging for validation failures
- [ ] Document validation errors for users
- [ ] Test with real AI-generated conversions

## Emergency Recovery

If you encounter a corrupted Webflow project:

1. **Don't try to save** - Designer may be frozen
2. Open new tab to Webflow Dashboard
3. Export the project (if possible)
4. Run the exported JSON through validator:
   ```bash
   node validate-export.js export.json
   ```
5. Fix errors automatically or manually
6. Re-import to fresh project

## Monitoring

Add Sentry or LogRocket to catch validation errors in production:

```typescript
import * as Sentry from '@sentry/nextjs';

try {
  const result = validateWebflowPayload(payload, true);
  if (!result.valid) {
    Sentry.captureMessage('Webflow validation failed', {
      level: 'warning',
      extra: {
        errors: result.errors,
        warnings: result.warnings,
        templateName: template.name,
      },
    });
  }
} catch (err) {
  Sentry.captureException(err);
}
```

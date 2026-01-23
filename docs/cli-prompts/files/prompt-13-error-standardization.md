# PROMPT 13: Error Level Standardization

**Priority:** HIGH  
**Complexity:** Medium  
**Estimated Time:** 30 minutes  
**Coverage Impact:** +1.5%

---

## Context

Flow Bridge has multiple validation modules (preflight-validator, asset-validator, css-embed-router, js-library-detector, flowbridge-semantic), each using different severity naming and structures. This makes it difficult to:

1. Present consistent error messaging to users
2. Determine if conversion should proceed
3. Aggregate errors from different sources
4. Filter by severity in the UI

We need a unified error system across all validators.

---

## Requirements

### 1. Standard Severity Levels

```typescript
export enum ValidationSeverity {
  FATAL = 'fatal',     // Blocks conversion entirely - output would be corrupted
  ERROR = 'error',     // Conversion proceeds but paste will likely fail
  WARNING = 'warning', // Conversion proceeds, paste works but issues exist
  INFO = 'info',       // Informational - no action required
}
```

### 2. Severity Classification

| Severity | Description | User Action | Conversion |
|----------|-------------|-------------|------------|
| FATAL | Output would corrupt Webflow project | Must fix | BLOCKED |
| ERROR | Paste will likely fail or produce broken result | Should fix | Proceeds with warning |
| WARNING | May cause issues but paste will work | Can fix | Proceeds |
| INFO | Informational notice | Optional | Proceeds |

### 3. FATAL Examples (Blocks Conversion)

- Duplicate UUIDs in generated output
- Circular node references (parent→child→parent)
- Malformed Webflow JSON structure
- Invalid node type mappings

### 4. ERROR Examples (Paste May Fail)

- Orphan node references (child references non-existent parent)
- Relative asset URLs (images won't load)
- Missing required Webflow properties
- External scripts not loadable
- Embed size exceeds hard limit (>100KB)

### 5. WARNING Examples (Paste Works)

- Missing alt attributes on images
- Non-standard breakpoints (embedded but may not match intent)
- Large embed size approaching limit (>10KB)
- Unknown CSS properties
- Class name collisions
- PX units not converted

### 6. INFO Examples

- AI fallback used (mock mode)
- Library detected and CDN injected
- Class renamed
- CSS routed to embed
- Google Fonts detected

---

## Files to Modify

### 1. Create: `lib/validation-types.ts`

```typescript
/**
 * Unified Validation Types for Flow Bridge
 * All validators should use these types for consistency
 */

export enum ValidationSeverity {
  FATAL = 'fatal',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

export interface ValidationMessage {
  severity: ValidationSeverity;
  code: string;                    // Unique code like 'UUID_DUPLICATE'
  category: ValidationCategory;    // Which validator produced this
  message: string;                 // Human-readable message
  location?: ValidationLocation;   // Where in the source
  suggestion?: string;             // How to fix
  metadata?: Record<string, any>;  // Additional context
}

export type ValidationCategory =
  | 'preflight'
  | 'asset'
  | 'css'
  | 'html'
  | 'js'
  | 'ai'
  | 'output';

export interface ValidationLocation {
  type: 'line' | 'element' | 'class' | 'selector' | 'property';
  value: string | number;
  context?: string;  // Surrounding code snippet
}

export interface ValidationResult {
  isValid: boolean;           // No FATAL errors
  canProceed: boolean;        // No FATAL errors (same as isValid)
  hasFatal: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  
  fatal: ValidationMessage[];
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
  info: ValidationMessage[];
  
  // Aggregate counts
  counts: {
    fatal: number;
    error: number;
    warning: number;
    info: number;
    total: number;
  };
  
  // Categorized
  byCategory: Record<ValidationCategory, ValidationMessage[]>;
}

// Helper to create validation messages
export function createValidationMessage(
  severity: ValidationSeverity,
  code: string,
  category: ValidationCategory,
  message: string,
  options?: {
    location?: ValidationLocation;
    suggestion?: string;
    metadata?: Record<string, any>;
  }
): ValidationMessage;

// Helper to merge multiple validation results
export function mergeValidationResults(
  ...results: ValidationResult[]
): ValidationResult;

// Helper to filter messages by severity
export function filterBySeverity(
  messages: ValidationMessage[],
  severity: ValidationSeverity | ValidationSeverity[]
): ValidationMessage[];

// Helper to create empty result
export function createEmptyValidationResult(): ValidationResult;

// Helper to add message to result
export function addValidationMessage(
  result: ValidationResult,
  message: ValidationMessage
): void;
```

### 2. Define Error Codes: `lib/validation-codes.ts`

```typescript
/**
 * Centralized validation error codes
 * Format: CATEGORY_SPECIFIC_ISSUE
 */

export const ValidationCodes = {
  // Preflight / Structure
  PREFLIGHT_DUPLICATE_UUID: 'PREFLIGHT_DUPLICATE_UUID',
  PREFLIGHT_CIRCULAR_REF: 'PREFLIGHT_CIRCULAR_REF',
  PREFLIGHT_ORPHAN_NODE: 'PREFLIGHT_ORPHAN_NODE',
  PREFLIGHT_INVALID_STRUCTURE: 'PREFLIGHT_INVALID_STRUCTURE',
  PREFLIGHT_MISSING_PROPERTY: 'PREFLIGHT_MISSING_PROPERTY',
  
  // Asset
  ASSET_RELATIVE_URL: 'ASSET_RELATIVE_URL',
  ASSET_DATA_URI: 'ASSET_DATA_URI',
  ASSET_INVALID_URL: 'ASSET_INVALID_URL',
  ASSET_EXTERNAL_RESOURCE: 'ASSET_EXTERNAL_RESOURCE',
  
  // CSS
  CSS_EMBED_SIZE_ERROR: 'CSS_EMBED_SIZE_ERROR',
  CSS_EMBED_SIZE_WARNING: 'CSS_EMBED_SIZE_WARNING',
  CSS_UNKNOWN_PROPERTY: 'CSS_UNKNOWN_PROPERTY',
  CSS_ROUTED_TO_EMBED: 'CSS_ROUTED_TO_EMBED',
  CSS_BREAKPOINT_ROUNDED: 'CSS_BREAKPOINT_ROUNDED',
  CSS_BREAKPOINT_NONSTANDARD: 'CSS_BREAKPOINT_NONSTANDARD',
  
  // HTML
  HTML_NESTED_FORM: 'HTML_NESTED_FORM',
  HTML_MISSING_ALT: 'HTML_MISSING_ALT',
  HTML_EMPTY_LINK: 'HTML_EMPTY_LINK',
  HTML_INVALID_NESTING: 'HTML_INVALID_NESTING',
  HTML_DEPRECATED_ELEMENT: 'HTML_DEPRECATED_ELEMENT',
  HTML_DUPLICATE_ID: 'HTML_DUPLICATE_ID',
  
  // JavaScript
  JS_LIBRARY_DETECTED: 'JS_LIBRARY_DETECTED',
  JS_PAID_PLUGIN: 'JS_PAID_PLUGIN',
  JS_ORPHAN_ID_REF: 'JS_ORPHAN_ID_REF',
  JS_ORPHAN_CLASS_REF: 'JS_ORPHAN_CLASS_REF',
  JS_CANVAS_NO_CONTAINER: 'JS_CANVAS_NO_CONTAINER',
  JS_EXTERNAL_SCRIPT: 'JS_EXTERNAL_SCRIPT',
  
  // AI
  AI_FALLBACK_USED: 'AI_FALLBACK_USED',
  AI_CLASS_RENAMED: 'AI_CLASS_RENAMED',
  AI_COMPONENT_DETECTED: 'AI_COMPONENT_DETECTED',
  AI_HIGH_RISK_CLASS: 'AI_HIGH_RISK_CLASS',
  
  // Output
  OUTPUT_MALFORMED_JSON: 'OUTPUT_MALFORMED_JSON',
  OUTPUT_MISSING_TYPE: 'OUTPUT_MISSING_TYPE',
  OUTPUT_INVALID_NODE: 'OUTPUT_INVALID_NODE',
} as const;

export type ValidationCode = typeof ValidationCodes[keyof typeof ValidationCodes];

// Default severities for each code
export const CodeSeverityMap: Record<ValidationCode, ValidationSeverity> = {
  // FATAL
  [ValidationCodes.PREFLIGHT_DUPLICATE_UUID]: ValidationSeverity.FATAL,
  [ValidationCodes.PREFLIGHT_CIRCULAR_REF]: ValidationSeverity.FATAL,
  [ValidationCodes.OUTPUT_MALFORMED_JSON]: ValidationSeverity.FATAL,
  
  // ERROR
  [ValidationCodes.PREFLIGHT_ORPHAN_NODE]: ValidationSeverity.ERROR,
  [ValidationCodes.ASSET_RELATIVE_URL]: ValidationSeverity.ERROR,
  [ValidationCodes.CSS_EMBED_SIZE_ERROR]: ValidationSeverity.ERROR,
  [ValidationCodes.JS_ORPHAN_ID_REF]: ValidationSeverity.ERROR,
  [ValidationCodes.HTML_NESTED_FORM]: ValidationSeverity.ERROR,
  
  // WARNING
  [ValidationCodes.ASSET_DATA_URI]: ValidationSeverity.WARNING,
  [ValidationCodes.ASSET_EXTERNAL_RESOURCE]: ValidationSeverity.WARNING,
  [ValidationCodes.CSS_EMBED_SIZE_WARNING]: ValidationSeverity.WARNING,
  [ValidationCodes.CSS_UNKNOWN_PROPERTY]: ValidationSeverity.WARNING,
  [ValidationCodes.CSS_BREAKPOINT_ROUNDED]: ValidationSeverity.WARNING,
  [ValidationCodes.HTML_MISSING_ALT]: ValidationSeverity.WARNING,
  [ValidationCodes.HTML_EMPTY_LINK]: ValidationSeverity.WARNING,
  [ValidationCodes.JS_ORPHAN_CLASS_REF]: ValidationSeverity.WARNING,
  [ValidationCodes.JS_PAID_PLUGIN]: ValidationSeverity.WARNING,
  [ValidationCodes.JS_CANVAS_NO_CONTAINER]: ValidationSeverity.WARNING,
  [ValidationCodes.AI_HIGH_RISK_CLASS]: ValidationSeverity.WARNING,
  
  // INFO
  [ValidationCodes.JS_LIBRARY_DETECTED]: ValidationSeverity.INFO,
  [ValidationCodes.CSS_ROUTED_TO_EMBED]: ValidationSeverity.INFO,
  [ValidationCodes.AI_FALLBACK_USED]: ValidationSeverity.INFO,
  [ValidationCodes.AI_CLASS_RENAMED]: ValidationSeverity.INFO,
  [ValidationCodes.AI_COMPONENT_DETECTED]: ValidationSeverity.INFO,
  
  // ... more mappings
};
```

### 3. Update: `lib/preflight-validator.ts`

```typescript
import { 
  ValidationSeverity, 
  ValidationMessage, 
  ValidationResult,
  createValidationMessage,
  createEmptyValidationResult,
  addValidationMessage,
} from './validation-types';
import { ValidationCodes } from './validation-codes';

// Update existing functions to use new types
export function validateUUIDs(payload: any): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const seenUUIDs = new Set<string>();
  
  function checkNode(node: any) {
    if (node._id) {
      if (seenUUIDs.has(node._id)) {
        messages.push(createValidationMessage(
          ValidationSeverity.FATAL,  // Was 'error', now standardized
          ValidationCodes.PREFLIGHT_DUPLICATE_UUID,
          'preflight',
          `Duplicate UUID detected: ${node._id}`,
          {
            location: { type: 'element', value: node._id },
            suggestion: 'UUIDs must be unique. Regenerate the payload.',
          }
        ));
      }
      seenUUIDs.add(node._id);
    }
    // ... continue traversal
  }
  
  // ... implementation
  return messages;
}

// Update main function
export function runPreflightValidation(payload: any): ValidationResult {
  const result = createEmptyValidationResult();
  
  // Run validations
  const uuidMessages = validateUUIDs(payload);
  const refMessages = validateNodeReferences(payload);
  const circularMessages = detectCircularReferences(payload);
  
  // Add all messages
  [...uuidMessages, ...refMessages, ...circularMessages].forEach(msg => {
    addValidationMessage(result, msg);
  });
  
  // Update flags
  result.isValid = result.fatal.length === 0;
  result.canProceed = result.isValid;
  
  return result;
}
```

### 4. Update: `lib/asset-validator.ts`

```typescript
import { 
  ValidationSeverity, 
  ValidationMessage,
  createValidationMessage,
} from './validation-types';
import { ValidationCodes } from './validation-codes';

export function validateAssetURL(url: string, context?: string): ValidationMessage | null {
  if (isRelativeURL(url)) {
    return createValidationMessage(
      ValidationSeverity.ERROR,
      ValidationCodes.ASSET_RELATIVE_URL,
      'asset',
      `Relative URL cannot be loaded: ${url}`,
      {
        location: context ? { type: 'element', value: context } : undefined,
        suggestion: 'Host the asset externally and use an absolute URL (https://...)',
      }
    );
  }
  
  if (isDataURI(url)) {
    return createValidationMessage(
      ValidationSeverity.WARNING,
      ValidationCodes.ASSET_DATA_URI,
      'asset',
      `Data URI detected: ${truncate(url, 50)}`,
      {
        suggestion: 'Consider hosting this image externally for better performance',
      }
    );
  }
  
  return null;
}
```

### 5. Update: `lib/css-embed-router.ts`

```typescript
import { 
  ValidationSeverity, 
  ValidationMessage,
  createValidationMessage,
} from './validation-types';
import { ValidationCodes } from './validation-codes';

export function validateEmbedSize(css: string): ValidationMessage | null {
  const size = new Blob([css]).size;
  
  if (size > 100_000) {
    return createValidationMessage(
      ValidationSeverity.ERROR,
      ValidationCodes.CSS_EMBED_SIZE_ERROR,
      'css',
      `Embed CSS exceeds 100KB limit (${Math.round(size / 1024)}KB)`,
      {
        metadata: { size, limit: 100000 },
        suggestion: 'Split complex animations into multiple components or simplify CSS',
      }
    );
  }
  
  if (size > 10_000) {
    return createValidationMessage(
      ValidationSeverity.WARNING,
      ValidationCodes.CSS_EMBED_SIZE_WARNING,
      'css',
      `Embed CSS is large (${Math.round(size / 1024)}KB) - consider optimizing`,
      {
        metadata: { size, softLimit: 10000 },
        suggestion: 'Minify CSS or reduce complexity to improve performance',
      }
    );
  }
  
  return null;
}
```

---

## Implementation Details

### Helper Functions

```typescript
// lib/validation-types.ts

export function createValidationMessage(
  severity: ValidationSeverity,
  code: string,
  category: ValidationCategory,
  message: string,
  options?: {
    location?: ValidationLocation;
    suggestion?: string;
    metadata?: Record<string, any>;
  }
): ValidationMessage {
  return {
    severity,
    code,
    category,
    message,
    location: options?.location,
    suggestion: options?.suggestion,
    metadata: options?.metadata,
  };
}

export function createEmptyValidationResult(): ValidationResult {
  return {
    isValid: true,
    canProceed: true,
    hasFatal: false,
    hasErrors: false,
    hasWarnings: false,
    fatal: [],
    errors: [],
    warnings: [],
    info: [],
    counts: { fatal: 0, error: 0, warning: 0, info: 0, total: 0 },
    byCategory: {
      preflight: [],
      asset: [],
      css: [],
      html: [],
      js: [],
      ai: [],
      output: [],
    },
  };
}

export function addValidationMessage(
  result: ValidationResult,
  message: ValidationMessage
): void {
  // Add to severity bucket
  switch (message.severity) {
    case ValidationSeverity.FATAL:
      result.fatal.push(message);
      result.hasFatal = true;
      result.isValid = false;
      result.canProceed = false;
      break;
    case ValidationSeverity.ERROR:
      result.errors.push(message);
      result.hasErrors = true;
      break;
    case ValidationSeverity.WARNING:
      result.warnings.push(message);
      result.hasWarnings = true;
      break;
    case ValidationSeverity.INFO:
      result.info.push(message);
      break;
  }
  
  // Add to category bucket
  result.byCategory[message.category].push(message);
  
  // Update counts
  result.counts[message.severity]++;
  result.counts.total++;
}

export function mergeValidationResults(
  ...results: ValidationResult[]
): ValidationResult {
  const merged = createEmptyValidationResult();
  
  for (const result of results) {
    result.fatal.forEach(m => addValidationMessage(merged, m));
    result.errors.forEach(m => addValidationMessage(merged, m));
    result.warnings.forEach(m => addValidationMessage(merged, m));
    result.info.forEach(m => addValidationMessage(merged, m));
  }
  
  return merged;
}
```

---

## Test Cases

```typescript
describe('ValidationResult', () => {
  it('should create empty result', () => {
    const result = createEmptyValidationResult();
    expect(result.isValid).toBe(true);
    expect(result.counts.total).toBe(0);
  });

  it('should add FATAL and invalidate', () => {
    const result = createEmptyValidationResult();
    const message = createValidationMessage(
      ValidationSeverity.FATAL,
      'TEST_FATAL',
      'preflight',
      'Fatal error'
    );
    addValidationMessage(result, message);
    
    expect(result.isValid).toBe(false);
    expect(result.canProceed).toBe(false);
    expect(result.hasFatal).toBe(true);
    expect(result.fatal).toHaveLength(1);
    expect(result.counts.fatal).toBe(1);
  });

  it('should add ERROR but keep valid', () => {
    const result = createEmptyValidationResult();
    const message = createValidationMessage(
      ValidationSeverity.ERROR,
      'TEST_ERROR',
      'asset',
      'Error message'
    );
    addValidationMessage(result, message);
    
    expect(result.isValid).toBe(true);  // Only FATAL makes invalid
    expect(result.hasErrors).toBe(true);
    expect(result.errors).toHaveLength(1);
  });

  it('should categorize messages', () => {
    const result = createEmptyValidationResult();
    
    addValidationMessage(result, createValidationMessage(
      ValidationSeverity.WARNING, 'CSS_TEST', 'css', 'CSS warning'
    ));
    addValidationMessage(result, createValidationMessage(
      ValidationSeverity.INFO, 'JS_TEST', 'js', 'JS info'
    ));
    
    expect(result.byCategory.css).toHaveLength(1);
    expect(result.byCategory.js).toHaveLength(1);
    expect(result.byCategory.html).toHaveLength(0);
  });

  it('should merge results', () => {
    const result1 = createEmptyValidationResult();
    const result2 = createEmptyValidationResult();
    
    addValidationMessage(result1, createValidationMessage(
      ValidationSeverity.WARNING, 'A', 'css', 'Warning A'
    ));
    addValidationMessage(result2, createValidationMessage(
      ValidationSeverity.ERROR, 'B', 'js', 'Error B'
    ));
    
    const merged = mergeValidationResults(result1, result2);
    
    expect(merged.warnings).toHaveLength(1);
    expect(merged.errors).toHaveLength(1);
    expect(merged.counts.total).toBe(2);
  });
});
```

---

## Migration Checklist

Update these files to use the new validation types:

- [ ] Create `lib/validation-types.ts`
- [ ] Create `lib/validation-codes.ts`
- [ ] Update `lib/preflight-validator.ts`
- [ ] Update `lib/asset-validator.ts`
- [ ] Update `lib/css-embed-router.ts`
- [ ] Update `lib/js-library-detector.ts`
- [ ] Update `lib/flowbridge-semantic.ts`
- [ ] Update `lib/html-validator.ts` (if created)
- [ ] Update `lib/webflow-converter.ts` to use merged results
- [ ] Update admin import page to use new result format
- [ ] Add unit tests for helper functions
- [ ] Document severity guidelines for future code

---

## Success Criteria

1. All validators use `ValidationSeverity` enum
2. All validators use `ValidationMessage` interface
3. All error codes are centralized in `validation-codes.ts`
4. FATAL errors block conversion
5. Results can be merged from multiple validators
6. Results can be filtered by severity and category
7. UI can display consistent error formatting
8. Clear distinction between what blocks vs. warns

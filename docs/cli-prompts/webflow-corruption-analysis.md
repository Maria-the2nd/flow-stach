# Webflow Designer Corruption Analysis

## Error Signature
```
[PersistentUIState] invalid keys ignored when saving UI state: Object
```

## What This Means

Webflow Designer uses a state persistence system that saves UI state (selections, panel states, etc.) to localStorage. When it encounters data that doesn't match expected types/schemas, it logs these warnings and tries to continue - but if the corruption is deep enough, it cascades into save failures.

## Common Corruption Sources in HTML→Webflow Conversion

### 1. Malformed Style Objects
**Problem:** AI-generated CSS converted to Webflow classes without proper structure
```json
// BROKEN - Missing required fields
{
  "name": "container",
  "styleLess": "display: flex;" 
  // Missing: "namespace", "comb", "variants"
}

// CORRECT
{
  "_id": "abc123",
  "fake": false,
  "type": "class",
  "name": "container",
  "namespace": "",
  "comb": "",
  "styleLess": "display: flex; flex-direction: column;",
  "variants": {},
  "children": [],
  "selector": null
}
```

### 2. Circular Class References
**Problem:** Class inheritance loops
```json
// BROKEN
{
  "name": "parent",
  "children": ["child"]
},
{
  "name": "child", 
  "children": ["parent"]  // Circular!
}
```

### 3. Orphaned State Variants
**Problem:** Hover/focus states without parent classes
```json
// BROKEN - "container:hover" exists but "container" doesn't
{
  "name": "container:hover",
  "variants": {"pseudo": "hover"}
  // Parent "container" class is missing
}
```

### 4. Invalid Breakpoint Data
**Problem:** Mobile-first CSS causing desktop variant corruption
```json
// BROKEN - Desktop styles in base, no mobile fallback
{
  "styleLess": "display: grid; grid-template-columns: repeat(3, 1fr);",
  "variants": {
    // Empty - should have main-small, main-medium definitions
  }
}
```

### 5. Duplicate UUIDs
**Problem:** Reusing IDs across paste operations
```json
// BROKEN - Same _id used twice
{
  "_id": "db912598-80db-237e-1156-3d29aaf71b2e",
  "type": "Block"
},
{
  "_id": "db912598-80db-237e-1156-3d29aaf71b2e", // Duplicate!
  "type": "Section"
}
```

## Your Specific Issue: The Style Deletion Failure

Based on the screenshots, you have **hundreds of classes** (image 3). When you try to "Delete All Unused Styles", Webflow attempts to:

1. Iterate through every style object
2. Check if it's used in the DOM
3. Prepare a batch delete transaction
4. Persist the new state

**It's failing at step 4** because some of these style objects have invalid keys that the persistence layer rejects.

## Prevention Requirements for Flow Bridge

### Pre-Paste Validation Pipeline

```typescript
interface ValidationRule {
  name: string;
  check: (payload: WebflowJSON) => ValidationError[];
  severity: 'error' | 'warning';
}

const CRITICAL_VALIDATORS: ValidationRule[] = [
  {
    name: 'UUID Uniqueness',
    check: (payload) => {
      const ids = new Set();
      const duplicates = [];
      payload.nodes.forEach(node => {
        if (ids.has(node._id)) {
          duplicates.push(`Duplicate UUID: ${node._id}`);
        }
        ids.add(node._id);
      });
      return duplicates;
    },
    severity: 'error'
  },
  
  {
    name: 'Circular Class References',
    check: (payload) => {
      // Build dependency graph, detect cycles
      // Return errors if cycles found
    },
    severity: 'error'
  },
  
  {
    name: 'Orphaned State Variants',
    check: (payload) => {
      const baseClasses = new Set(
        payload.styles
          .filter(s => !s.name.includes(':'))
          .map(s => s.name)
      );
      
      const orphans = payload.styles
        .filter(s => s.name.includes(':'))
        .filter(s => {
          const base = s.name.split(':')[0];
          return !baseClasses.has(base);
        });
      
      return orphans.map(s => `Orphaned state: ${s.name}`);
    },
    severity: 'error'
  },
  
  {
    name: 'Required Style Properties',
    check: (payload) => {
      const required = ['_id', 'type', 'name', 'styleLess'];
      return payload.styles
        .filter(style => !required.every(prop => prop in style))
        .map(s => `Missing required props in: ${s.name || 'unnamed'}`);
    },
    severity: 'error'
  },
  
  {
    name: 'Class Name Sanitization',
    check: (payload) => {
      const invalid = payload.styles
        .filter(s => {
          // Webflow class names must match specific pattern
          return !/^[a-z0-9-_]+$/i.test(s.name);
        });
      return invalid.map(s => `Invalid class name: ${s.name}`);
    },
    severity: 'warning'
  }
];
```

### Automatic Sanitization

```typescript
function sanitizeWebflowPayload(payload: WebflowJSON): WebflowJSON {
  // 1. Regenerate ALL UUIDs
  const idMap = new Map();
  payload.nodes = payload.nodes.map(node => {
    const newId = generateUUID();
    idMap.set(node._id, newId);
    return {...node, _id: newId};
  });
  
  // 2. Update references to use new IDs
  payload.nodes = payload.nodes.map(node => {
    if (node.children) {
      node.children = node.children.map(childId => idMap.get(childId) || childId);
    }
    return node;
  });
  
  // 3. Strip ALL interaction data (ix2)
  delete payload.ix2;
  
  // 4. Remove circular references in styles
  const styleGraph = buildStyleDependencyGraph(payload.styles);
  const cycles = detectCycles(styleGraph);
  cycles.forEach(cyclePath => {
    // Break cycle by removing last child reference
    const parentClass = payload.styles.find(s => s.name === cyclePath[cyclePath.length - 1]);
    if (parentClass) {
      parentClass.children = parentClass.children.filter(
        child => child !== cyclePath[0]
      );
    }
  });
  
  // 5. Ensure all state variants have parent classes
  const baseClassNames = new Set(
    payload.styles
      .filter(s => !s.name.includes(':'))
      .map(s => s.name)
  );
  
  payload.styles = payload.styles.filter(style => {
    if (style.name.includes(':')) {
      const baseName = style.name.split(':')[0];
      if (!baseClassNames.has(baseName)) {
        console.warn(`Removing orphaned state variant: ${style.name}`);
        return false; // Filter out orphans
      }
    }
    return true;
  });
  
  return payload;
}
```

## Debugging Your Current Issue

To understand WHAT data is corrupted:

```javascript
// Run this in Webflow Designer console
(async () => {
  // Get the raw site data
  const siteData = window.__SITE_DATA__;
  
  // Check for problematic patterns
  const styles = siteData.document.styles || [];
  
  console.log('Total styles:', styles.length);
  
  // Find styles missing required properties
  const malformed = styles.filter(s => 
    !s._id || !s.type || !s.name || s.styleLess === undefined
  );
  console.log('Malformed styles:', malformed);
  
  // Find duplicate IDs
  const ids = styles.map(s => s._id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  console.log('Duplicate IDs:', [...new Set(duplicates)]);
  
  // Find orphaned state variants
  const baseNames = new Set(
    styles.filter(s => !s.name.includes(':')).map(s => s.name)
  );
  const orphans = styles.filter(s => {
    if (s.name.includes(':')) {
      const base = s.name.split(':')[0];
      return !baseNames.has(base);
    }
    return false;
  });
  console.log('Orphaned states:', orphans.map(s => s.name));
})();
```

## Recommended Workflow Changes

1. **Never paste raw AI HTML→Webflow conversion**
2. **Always validate through Claude Sonnet 4 API call first**
3. **Store "pre-flight validated" payloads in Convex**
4. **Show validation warnings in UI before paste**
5. **Implement "Safe Mode" paste that auto-sanitizes**

## Emergency Recovery Pattern

When Designer is frozen:
1. Don't try to save/publish
2. Open new tab to Webflow Dashboard
3. Export code (if possible)
4. Delete corrupted project
5. Create fresh project
6. Re-import ONLY validated components

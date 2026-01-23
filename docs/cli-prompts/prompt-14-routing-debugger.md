# PROMPT 14: Visual CSS Routing Debugger

**Priority:** POLISH (Tier 3)  
**Complexity:** High  
**Estimated Time:** 2-3 hours  
**Coverage Impact:** +2%

---

## Context

When CSS is converted, some rules go to native Webflow styles and others go to embed blocks. Currently, users have no visibility into why a particular rule was routed where it was. This makes debugging difficult when:

1. A hover effect doesn't work (was it routed to embed?)
2. Styles look different (did breakpoint mapping change something?)
3. An animation isn't playing (did @keyframes get extracted correctly?)

A visual debugger would show exactly how each CSS rule was processed.

---

## Requirements

### 1. Rule-by-Rule Breakdown

For each CSS rule in the input, show:
- Original selector
- Destination (Native / Embed)
- Reason for routing decision
- Transformed output (if any)

### 2. Interactive UI Component

```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 CSS Routing Debugger                        [Expand All] │
├─────────────────────────────────────────────────────────────┤
│ ▼ .hero { ... }                               → NATIVE ✅  │
│   ├─ width: 100%           → native (standard property)    │
│   ├─ display: flex         → native (layout property)      │
│   └─ gap: 2rem            → native (flexbox property)      │
│                                                             │
│ ▼ .hero::before { ... }                       → EMBED ⚠️   │
│   ├─ Reason: Pseudo-element (::before) not native          │
│   └─ All properties moved to embed block                   │
│                                                             │
│ ▼ @keyframes fadeIn { ... }                   → EMBED ⚠️   │
│   ├─ Reason: @keyframes not supported natively             │
│   └─ Full animation definition in embed                    │
│                                                             │
│ ▼ .card:nth-child(odd) { ... }                → EMBED ⚠️   │
│   └─ Reason: Complex pseudo-class (:nth-child)             │
│                                                             │
│ ▼ @media (max-width: 768px) { .hero { ... } } → NATIVE ✅  │
│   └─ Mapped to Webflow "medium" breakpoint                 │
│                                                             │
│ ▼ @media (prefers-color-scheme: dark) { ... } → EMBED ⚠️   │
│   └─ Reason: Non-standard media query                      │
└─────────────────────────────────────────────────────────────┘
```

### 3. Filtering Options

- Show All / Native Only / Embed Only
- Search by selector or property
- Filter by routing reason

### 4. Export Capability

- Copy routing report as Markdown
- Download as JSON for programmatic access

---

## Data Structure

### `CSSRoutingTrace`

```typescript
export interface CSSRoutingTrace {
  // Input
  originalCSS: string;
  
  // Parsed rules
  rules: RoutedRule[];
  
  // Summary
  summary: {
    totalRules: number;
    nativeRules: number;
    embedRules: number;
    breakpointMappings: number;
  };
  
  // Timing (optional)
  parseTime?: number;
  routeTime?: number;
}

export interface RoutedRule {
  id: string;                    // Unique ID for UI key
  selector: string;              // Original selector
  originalCSS: string;           // Original rule text
  destination: 'native' | 'embed' | 'split';
  
  // Why it was routed this way
  reasons: RoutingReason[];
  
  // The properties within this rule
  properties: RoutedProperty[];
  
  // If breakpoint, which one
  breakpoint?: {
    original: string;            // @media (max-width: 768px)
    mapped: string;              // Webflow "medium"
    wasRounded: boolean;
  };
  
  // Output
  nativeOutput?: string;         // What went to native
  embedOutput?: string;          // What went to embed
}

export interface RoutedProperty {
  property: string;              // e.g., "display"
  value: string;                 // e.g., "flex"
  destination: 'native' | 'embed';
  reason: string;                // e.g., "Standard layout property"
  transformed?: {
    from: string;
    to: string;
    reason: string;              // e.g., "PX to REM conversion"
  };
}

export type RoutingReason = 
  | { type: 'pseudo-element'; element: string }
  | { type: 'pseudo-class-complex'; class: string }
  | { type: 'at-rule'; rule: string }
  | { type: 'combinator'; combinator: string }
  | { type: 'id-selector' }
  | { type: 'tag-selector'; tag: string }
  | { type: 'attribute-selector'; attribute: string }
  | { type: 'descendant-selector' }
  | { type: 'vendor-prefix'; prefix: string }
  | { type: 'css-variable' }
  | { type: 'standard-property' }
  | { type: 'native-state'; state: string }
  | { type: 'breakpoint-mapped'; from: string; to: string }
  | { type: 'breakpoint-nonstandard' };
```

---

## Files to Create/Modify

### 1. Create: `lib/css-routing-tracer.ts`

```typescript
/**
 * CSS Routing Tracer
 * Records detailed routing decisions for debugging
 */

import { RoutedRule, CSSRoutingTrace, RoutingReason } from './routing-types';

export class CSSRoutingTracer {
  private rules: RoutedRule[] = [];
  private startTime: number = 0;
  
  constructor() {
    this.startTime = performance.now();
  }
  
  // Called when a rule is analyzed
  traceRule(
    selector: string,
    originalCSS: string,
    destination: 'native' | 'embed' | 'split',
    reasons: RoutingReason[]
  ): string {
    const id = `rule-${this.rules.length}`;
    this.rules.push({
      id,
      selector,
      originalCSS,
      destination,
      reasons,
      properties: [],
    });
    return id;
  }
  
  // Called when a property is analyzed
  traceProperty(
    ruleId: string,
    property: string,
    value: string,
    destination: 'native' | 'embed',
    reason: string,
    transformed?: { from: string; to: string; reason: string }
  ): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.properties.push({
        property,
        value,
        destination,
        reason,
        transformed,
      });
    }
  }
  
  // Generate final trace
  finalize(originalCSS: string): CSSRoutingTrace {
    const endTime = performance.now();
    
    return {
      originalCSS,
      rules: this.rules,
      summary: {
        totalRules: this.rules.length,
        nativeRules: this.rules.filter(r => r.destination === 'native').length,
        embedRules: this.rules.filter(r => r.destination === 'embed').length,
        breakpointMappings: this.rules.filter(r => r.breakpoint).length,
      },
      parseTime: endTime - this.startTime,
    };
  }
}
```

### 2. Create: `components/routing-debugger.tsx`

```tsx
'use client';

import { useState, useMemo } from 'react';
import { CSSRoutingTrace, RoutedRule } from '@/lib/routing-types';

interface RoutingDebuggerProps {
  trace: CSSRoutingTrace;
}

export function RoutingDebugger({ trace }: RoutingDebuggerProps) {
  const [filter, setFilter] = useState<'all' | 'native' | 'embed'>('all');
  const [search, setSearch] = useState('');
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  
  const filteredRules = useMemo(() => {
    return trace.rules.filter(rule => {
      // Filter by destination
      if (filter !== 'all' && rule.destination !== filter) {
        return false;
      }
      
      // Filter by search
      if (search && !rule.selector.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }, [trace.rules, filter, search]);
  
  const toggleRule = (id: string) => {
    setExpandedRules(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  const expandAll = () => {
    setExpandedRules(new Set(trace.rules.map(r => r.id)));
  };
  
  const collapseAll = () => {
    setExpandedRules(new Set());
  };
  
  return (
    <div className="routing-debugger">
      {/* Header */}
      <div className="debugger-header">
        <h3>🔍 CSS Routing Debugger</h3>
        <div className="debugger-actions">
          <button onClick={expandAll}>Expand All</button>
          <button onClick={collapseAll}>Collapse All</button>
        </div>
      </div>
      
      {/* Summary */}
      <div className="debugger-summary">
        <span>Total: {trace.summary.totalRules}</span>
        <span className="native">Native: {trace.summary.nativeRules}</span>
        <span className="embed">Embed: {trace.summary.embedRules}</span>
      </div>
      
      {/* Filters */}
      <div className="debugger-filters">
        <select value={filter} onChange={e => setFilter(e.target.value as any)}>
          <option value="all">All Rules</option>
          <option value="native">Native Only</option>
          <option value="embed">Embed Only</option>
        </select>
        
        <input
          type="text"
          placeholder="Search selectors..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      
      {/* Rules List */}
      <div className="debugger-rules">
        {filteredRules.map(rule => (
          <RuleItem
            key={rule.id}
            rule={rule}
            expanded={expandedRules.has(rule.id)}
            onToggle={() => toggleRule(rule.id)}
          />
        ))}
      </div>
      
      {/* Export */}
      <div className="debugger-export">
        <button onClick={() => exportAsMarkdown(trace)}>
          📋 Copy as Markdown
        </button>
        <button onClick={() => exportAsJSON(trace)}>
          📥 Download JSON
        </button>
      </div>
    </div>
  );
}

function RuleItem({ 
  rule, 
  expanded, 
  onToggle 
}: { 
  rule: RoutedRule; 
  expanded: boolean; 
  onToggle: () => void;
}) {
  const destinationIcon = rule.destination === 'native' ? '✅' : '⚠️';
  const destinationLabel = rule.destination.toUpperCase();
  
  return (
    <div className={`rule-item ${rule.destination}`}>
      <div className="rule-header" onClick={onToggle}>
        <span className="rule-toggle">{expanded ? '▼' : '▶'}</span>
        <code className="rule-selector">{rule.selector}</code>
        <span className="rule-destination">
          → {destinationLabel} {destinationIcon}
        </span>
      </div>
      
      {expanded && (
        <div className="rule-details">
          {/* Reasons */}
          <div className="rule-reasons">
            {rule.reasons.map((reason, i) => (
              <div key={i} className="reason">
                └─ {formatReason(reason)}
              </div>
            ))}
          </div>
          
          {/* Properties */}
          {rule.properties.length > 0 && (
            <div className="rule-properties">
              {rule.properties.map((prop, i) => (
                <div key={i} className={`property ${prop.destination}`}>
                  <span className="prop-name">{prop.property}:</span>
                  <span className="prop-value">{prop.value}</span>
                  <span className="prop-dest">→ {prop.destination}</span>
                  {prop.transformed && (
                    <span className="prop-transformed">
                      ({prop.transformed.from} → {prop.transformed.to})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Breakpoint mapping */}
          {rule.breakpoint && (
            <div className="breakpoint-mapping">
              📱 {rule.breakpoint.original} → Webflow "{rule.breakpoint.mapped}"
              {rule.breakpoint.wasRounded && ' (rounded)'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatReason(reason: RoutingReason): string {
  switch (reason.type) {
    case 'pseudo-element':
      return `Pseudo-element (${reason.element}) requires embed`;
    case 'pseudo-class-complex':
      return `Complex pseudo-class (${reason.class}) requires embed`;
    case 'at-rule':
      return `At-rule (${reason.rule}) requires embed`;
    case 'combinator':
      return `Combinator (${reason.combinator}) requires embed`;
    case 'id-selector':
      return 'ID selector requires embed';
    case 'tag-selector':
      return `Tag selector (${reason.tag}) requires embed`;
    case 'attribute-selector':
      return `Attribute selector (${reason.attribute}) requires embed`;
    case 'descendant-selector':
      return 'Descendant selector requires embed';
    case 'vendor-prefix':
      return `Vendor prefix (${reason.prefix}) requires embed`;
    case 'css-variable':
      return 'CSS variable requires embed';
    case 'standard-property':
      return 'Standard property - native';
    case 'native-state':
      return `State (${reason.state}) supported natively`;
    case 'breakpoint-mapped':
      return `Breakpoint mapped: ${reason.from} → ${reason.to}`;
    case 'breakpoint-nonstandard':
      return 'Non-standard breakpoint - moved to embed';
    default:
      return 'Unknown reason';
  }
}

function exportAsMarkdown(trace: CSSRoutingTrace): void {
  let md = `# CSS Routing Report\n\n`;
  md += `## Summary\n`;
  md += `- Total Rules: ${trace.summary.totalRules}\n`;
  md += `- Native: ${trace.summary.nativeRules}\n`;
  md += `- Embed: ${trace.summary.embedRules}\n\n`;
  md += `## Rules\n\n`;
  
  for (const rule of trace.rules) {
    md += `### \`${rule.selector}\` → ${rule.destination.toUpperCase()}\n`;
    for (const reason of rule.reasons) {
      md += `- ${formatReason(reason)}\n`;
    }
    md += `\n`;
  }
  
  navigator.clipboard.writeText(md);
}

function exportAsJSON(trace: CSSRoutingTrace): void {
  const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'css-routing-trace.json';
  a.click();
  URL.revokeObjectURL(url);
}
```

### 3. Modify: `lib/css-embed-router.ts`

Add tracing to the routing logic:

```typescript
import { CSSRoutingTracer } from './css-routing-tracer';

export function routeCSS(css: string, options?: { trace?: boolean }): {
  nativeCSS: string;
  embedCSS: string;
  trace?: CSSRoutingTrace;
} {
  const tracer = options?.trace ? new CSSRoutingTracer() : null;
  
  // ... existing routing logic ...
  
  // When analyzing a rule:
  if (tracer) {
    const ruleId = tracer.traceRule(
      selector,
      originalRuleText,
      destination,
      reasons
    );
    
    // When analyzing each property:
    for (const prop of properties) {
      tracer.traceProperty(
        ruleId,
        prop.name,
        prop.value,
        prop.destination,
        prop.reason,
        prop.transformed
      );
    }
  }
  
  // ... continue routing ...
  
  return {
    nativeCSS,
    embedCSS,
    trace: tracer?.finalize(css),
  };
}
```

---

## CSS for Debugger UI

```css
.routing-debugger {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  border: 1px solid #333;
  border-radius: 8px;
  background: #1a1a1a;
  color: #e0e0e0;
}

.debugger-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #333;
}

.debugger-summary {
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  background: #222;
}

.debugger-summary .native { color: #4ade80; }
.debugger-summary .embed { color: #fbbf24; }

.debugger-filters {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid #333;
}

.rule-item {
  border-bottom: 1px solid #2a2a2a;
}

.rule-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
}

.rule-header:hover {
  background: #252525;
}

.rule-item.native .rule-destination { color: #4ade80; }
.rule-item.embed .rule-destination { color: #fbbf24; }

.rule-details {
  padding: 8px 16px 16px 32px;
  background: #151515;
}

.rule-reasons, .rule-properties {
  margin-top: 8px;
}

.reason {
  color: #888;
  margin-left: 16px;
}

.property {
  display: flex;
  gap: 8px;
  margin-left: 16px;
  color: #aaa;
}

.property.native .prop-dest { color: #4ade80; }
.property.embed .prop-dest { color: #fbbf24; }

.prop-transformed {
  color: #60a5fa;
  font-size: 11px;
}

.breakpoint-mapping {
  margin-top: 8px;
  color: #a78bfa;
}

.debugger-export {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #333;
}
```

---

## Integration

Add to admin import page:

```tsx
// In app/admin/import/page.tsx

const [showDebugger, setShowDebugger] = useState(false);
const [routingTrace, setRoutingTrace] = useState<CSSRoutingTrace | null>(null);

// When routing CSS
const routingResult = routeCSS(css, { trace: true });
setRoutingTrace(routingResult.trace);

// In render
{showDebugger && routingTrace && (
  <RoutingDebugger trace={routingTrace} />
)}
```

---

## Success Criteria

1. Every CSS rule shows routing destination
2. Reasons are human-readable
3. Property-level detail available
4. Breakpoint mappings shown
5. Transformations (PX→REM) visible
6. Filter and search work
7. Export to Markdown works
8. Export to JSON works
9. Performance acceptable (<100ms for typical CSS)

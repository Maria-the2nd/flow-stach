'use client';

import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  CSSRoutingTrace,
  RoutedRule,
  RoutingReason,
  RoutingFilter,
  RuleCategory,
} from '@/lib/routing-types';
import {
  formatRoutingReason,
  getDestinationIcon,
  getCategoryIcon,
} from '@/lib/css-routing-tracer';

// ============================================
// TYPES
// ============================================

interface RoutingDebuggerProps {
  trace: CSSRoutingTrace;
  className?: string;
  defaultExpanded?: boolean;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function RoutingDebugger({
  trace,
  className,
  defaultExpanded = false,
}: RoutingDebuggerProps) {
  const [filter, setFilter] = useState<RoutingFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<RuleCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [expandedRules, setExpandedRules] = useState<Set<string>>(
    () => new Set(defaultExpanded ? trace.rules.map(r => r.id) : [])
  );

  // Filter rules
  const filteredRules = useMemo(() => {
    return trace.rules.filter(rule => {
      // Filter by destination
      if (filter !== 'all' && rule.destination !== filter) {
        return false;
      }

      // Filter by category
      if (categoryFilter !== 'all' && rule.category !== categoryFilter) {
        return false;
      }

      // Filter by search
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSelector = rule.selector.toLowerCase().includes(searchLower);
        const matchesProperty = rule.properties.some(
          p => p.property.toLowerCase().includes(searchLower) ||
               p.value.toLowerCase().includes(searchLower)
        );
        if (!matchesSelector && !matchesProperty) {
          return false;
        }
      }

      return true;
    });
  }, [trace.rules, filter, categoryFilter, search]);

  // Toggle rule expansion
  const toggleRule = useCallback((id: string) => {
    setExpandedRules(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Expand/collapse all
  const expandAll = useCallback(() => {
    setExpandedRules(new Set(filteredRules.map(r => r.id)));
  }, [filteredRules]);

  const collapseAll = useCallback(() => {
    setExpandedRules(new Set());
  }, []);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<RuleCategory>();
    trace.rules.forEach(r => cats.add(r.category));
    return Array.from(cats);
  }, [trace.rules]);

  return (
    <div className={cn('routing-debugger', className)}>
      {/* Header */}
      <div className="debugger-header">
        <h3 className="debugger-title">
          <span className="debugger-icon">🔍</span>
          CSS Routing Debugger
        </h3>
        <div className="debugger-actions">
          <button
            onClick={expandAll}
            className="debugger-btn"
            title="Expand All"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="debugger-btn"
            title="Collapse All"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="debugger-summary">
        <div className="summary-item">
          <span className="summary-label">Total:</span>
          <span className="summary-value">{trace.summary.totalRules}</span>
        </div>
        <div className="summary-item native">
          <span className="summary-label">Native:</span>
          <span className="summary-value">{trace.summary.nativeRules}</span>
        </div>
        <div className="summary-item embed">
          <span className="summary-label">Embed:</span>
          <span className="summary-value">{trace.summary.embedRules}</span>
        </div>
        {trace.summary.splitRules > 0 && (
          <div className="summary-item split">
            <span className="summary-label">Split:</span>
            <span className="summary-value">{trace.summary.splitRules}</span>
          </div>
        )}
        {trace.parseTime !== undefined && (
          <div className="summary-item timing">
            <span className="summary-label">Time:</span>
            <span className="summary-value">{trace.parseTime.toFixed(1)}ms</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="debugger-filters">
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as RoutingFilter)}
          className="debugger-select"
        >
          <option value="all">All Rules</option>
          <option value="native">Native Only</option>
          <option value="embed">Embed Only</option>
        </select>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value as RuleCategory | 'all')}
          className="debugger-select"
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {getCategoryIcon(cat)} {cat}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search selectors or properties..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="debugger-search"
        />
      </div>

      {/* Results count */}
      <div className="debugger-results-count">
        Showing {filteredRules.length} of {trace.rules.length} rules
      </div>

      {/* Rules List */}
      <div className="debugger-rules">
        {filteredRules.length === 0 ? (
          <div className="debugger-empty">
            No rules match the current filters
          </div>
        ) : (
          filteredRules.map(rule => (
            <RuleItem
              key={rule.id}
              rule={rule}
              expanded={expandedRules.has(rule.id)}
              onToggle={() => toggleRule(rule.id)}
            />
          ))
        )}
      </div>

      {/* Export */}
      <div className="debugger-export">
        <button
          onClick={() => exportAsMarkdown(trace)}
          className="debugger-btn export-btn"
        >
          📋 Copy as Markdown
        </button>
        <button
          onClick={() => exportAsJSON(trace)}
          className="debugger-btn export-btn"
        >
          📥 Download JSON
        </button>
      </div>

      <style jsx>{`
        .routing-debugger {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px;
          border: 1px solid #333;
          border-radius: 8px;
          background: #1a1a1a;
          color: #e0e0e0;
          overflow: hidden;
        }

        .debugger-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid #333;
          background: #222;
        }

        .debugger-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          margin: 0;
        }

        .debugger-icon {
          font-size: 16px;
        }

        .debugger-actions {
          display: flex;
          gap: 8px;
        }

        .debugger-btn {
          padding: 4px 10px;
          font-size: 11px;
          background: #333;
          border: 1px solid #444;
          border-radius: 4px;
          color: #ccc;
          cursor: pointer;
          transition: all 0.15s;
        }

        .debugger-btn:hover {
          background: #444;
          border-color: #555;
        }

        .debugger-summary {
          display: flex;
          gap: 16px;
          padding: 10px 16px;
          background: #1e1e1e;
          border-bottom: 1px solid #333;
        }

        .summary-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .summary-label {
          color: #888;
        }

        .summary-value {
          font-weight: 600;
        }

        .summary-item.native .summary-value {
          color: #4ade80;
        }

        .summary-item.embed .summary-value {
          color: #fbbf24;
        }

        .summary-item.split .summary-value {
          color: #60a5fa;
        }

        .summary-item.timing .summary-value {
          color: #a78bfa;
        }

        .debugger-filters {
          display: flex;
          gap: 8px;
          padding: 10px 16px;
          border-bottom: 1px solid #333;
          flex-wrap: wrap;
        }

        .debugger-select {
          padding: 6px 10px;
          font-size: 11px;
          background: #2a2a2a;
          border: 1px solid #444;
          border-radius: 4px;
          color: #ccc;
        }

        .debugger-search {
          flex: 1;
          min-width: 150px;
          padding: 6px 10px;
          font-size: 11px;
          background: #2a2a2a;
          border: 1px solid #444;
          border-radius: 4px;
          color: #ccc;
        }

        .debugger-search::placeholder {
          color: #666;
        }

        .debugger-results-count {
          padding: 6px 16px;
          font-size: 10px;
          color: #666;
          background: #1a1a1a;
          border-bottom: 1px solid #2a2a2a;
        }

        .debugger-rules {
          max-height: 400px;
          overflow-y: auto;
        }

        .debugger-empty {
          padding: 24px 16px;
          text-align: center;
          color: #666;
        }

        .debugger-export {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          border-top: 1px solid #333;
          background: #1e1e1e;
        }

        .export-btn {
          flex: 1;
        }
      `}</style>
    </div>
  );
}

// ============================================
// RULE ITEM COMPONENT
// ============================================

interface RuleItemProps {
  rule: RoutedRule;
  expanded: boolean;
  onToggle: () => void;
}

function RuleItem({ rule, expanded, onToggle }: RuleItemProps) {
  const destinationIcon = getDestinationIcon(rule.destination);
  const categoryIcon = getCategoryIcon(rule.category);
  const destinationLabel = rule.destination.toUpperCase();

  return (
    <div className={cn('rule-item', rule.destination)}>
      <div className="rule-header" onClick={onToggle}>
        <span className="rule-toggle">{expanded ? '▼' : '▶'}</span>
        <span className="rule-category" title={rule.category}>
          {categoryIcon}
        </span>
        <code className="rule-selector">{truncateSelector(rule.selector)}</code>
        <span className="rule-destination">
          → {destinationLabel} {destinationIcon}
        </span>
      </div>

      {expanded && (
        <div className="rule-details">
          {/* Original CSS */}
          {rule.originalCSS && (
            <div className="rule-original">
              <div className="detail-label">Original:</div>
              <pre className="detail-code">{formatCSS(rule.originalCSS)}</pre>
            </div>
          )}

          {/* Reasons */}
          <div className="rule-reasons">
            <div className="detail-label">Reasons:</div>
            {rule.reasons.map((reason, i) => (
              <div key={i} className="reason">
                <span className="reason-prefix">└─</span>
                {formatRoutingReason(reason)}
              </div>
            ))}
          </div>

          {/* Properties */}
          {rule.properties.length > 0 && (
            <div className="rule-properties">
              <div className="detail-label">Properties:</div>
              {rule.properties.map((prop, i) => (
                <div key={i} className={cn('property', prop.destination)}>
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
              <span className="bp-icon">📱</span>
              <span className="bp-original">{rule.breakpoint.original}</span>
              <span className="bp-arrow">→</span>
              <span className="bp-mapped">Webflow &ldquo;{rule.breakpoint.mapped}&rdquo;</span>
              {rule.breakpoint.wasRounded && (
                <span className="bp-rounded">(rounded)</span>
              )}
            </div>
          )}

          {/* Output */}
          {(rule.nativeOutput || rule.embedOutput) && (
            <div className="rule-output">
              {rule.nativeOutput && (
                <div className="output-section native">
                  <div className="output-label">Native Output:</div>
                  <pre className="output-code">{rule.nativeOutput}</pre>
                </div>
              )}
              {rule.embedOutput && (
                <div className="output-section embed">
                  <div className="output-label">Embed Output:</div>
                  <pre className="output-code">{rule.embedOutput}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .rule-item {
          border-bottom: 1px solid #2a2a2a;
        }

        .rule-item:last-child {
          border-bottom: none;
        }

        .rule-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .rule-header:hover {
          background: #252525;
        }

        .rule-toggle {
          width: 12px;
          font-size: 10px;
          color: #666;
        }

        .rule-category {
          font-size: 12px;
        }

        .rule-selector {
          flex: 1;
          font-size: 11px;
          color: #e0e0e0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rule-destination {
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
        }

        .rule-item.native .rule-destination {
          color: #4ade80;
        }

        .rule-item.embed .rule-destination {
          color: #fbbf24;
        }

        .rule-item.split .rule-destination {
          color: #60a5fa;
        }

        .rule-details {
          padding: 8px 16px 16px 40px;
          background: #151515;
          border-top: 1px solid #2a2a2a;
        }

        .detail-label {
          font-size: 10px;
          color: #666;
          text-transform: uppercase;
          margin-bottom: 4px;
          margin-top: 12px;
        }

        .detail-label:first-child {
          margin-top: 0;
        }

        .detail-code,
        .output-code {
          font-size: 11px;
          padding: 8px;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 4px;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-all;
          margin: 0;
        }

        .rule-reasons {
          margin-top: 8px;
        }

        .reason {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #888;
          font-size: 11px;
          padding: 2px 0;
        }

        .reason-prefix {
          color: #444;
        }

        .rule-properties {
          margin-top: 8px;
        }

        .property {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 3px 0;
          font-size: 11px;
        }

        .prop-name {
          color: #a78bfa;
        }

        .prop-value {
          color: #fbbf24;
        }

        .prop-dest {
          font-size: 10px;
          color: #666;
        }

        .property.native .prop-dest {
          color: #4ade80;
        }

        .property.embed .prop-dest {
          color: #fbbf24;
        }

        .prop-transformed {
          font-size: 10px;
          color: #60a5fa;
        }

        .breakpoint-mapping {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 12px;
          padding: 8px;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 4px;
          font-size: 11px;
        }

        .bp-icon {
          font-size: 12px;
        }

        .bp-original {
          color: #888;
        }

        .bp-arrow {
          color: #444;
        }

        .bp-mapped {
          color: #a78bfa;
        }

        .bp-rounded {
          font-size: 10px;
          color: #666;
        }

        .rule-output {
          margin-top: 12px;
        }

        .output-section {
          margin-top: 8px;
        }

        .output-section:first-child {
          margin-top: 0;
        }

        .output-label {
          font-size: 10px;
          margin-bottom: 4px;
        }

        .output-section.native .output-label {
          color: #4ade80;
        }

        .output-section.embed .output-label {
          color: #fbbf24;
        }
      `}</style>
    </div>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Truncate long selectors for display
 */
function truncateSelector(selector: string, maxLength: number = 60): string {
  if (selector.length <= maxLength) return selector;
  return selector.slice(0, maxLength - 3) + '...';
}

/**
 * Format CSS for display (basic prettification)
 */
function formatCSS(css: string): string {
  // Simple formatting - don't overcomplicate
  return css.trim();
}

/**
 * Export trace as Markdown
 */
function exportAsMarkdown(trace: CSSRoutingTrace): void {
  let md = `# CSS Routing Report\n\n`;

  // Summary
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Rules | ${trace.summary.totalRules} |\n`;
  md += `| Native | ${trace.summary.nativeRules} |\n`;
  md += `| Embed | ${trace.summary.embedRules} |\n`;
  if (trace.summary.splitRules > 0) {
    md += `| Split | ${trace.summary.splitRules} |\n`;
  }
  md += `| Breakpoint Mappings | ${trace.summary.breakpointMappings} |\n`;
  md += `| At-Rules Extracted | ${trace.summary.atRulesExtracted} |\n`;
  if (trace.parseTime !== undefined) {
    md += `| Parse Time | ${trace.parseTime.toFixed(1)}ms |\n`;
  }
  md += `\n`;

  // Rules by destination
  md += `## Rules\n\n`;

  // Native rules
  const nativeRules = trace.rules.filter(r => r.destination === 'native');
  if (nativeRules.length > 0) {
    md += `### Native (${nativeRules.length})\n\n`;
    for (const rule of nativeRules) {
      md += `- \`${rule.selector}\`\n`;
    }
    md += `\n`;
  }

  // Embed rules
  const embedRules = trace.rules.filter(r => r.destination === 'embed');
  if (embedRules.length > 0) {
    md += `### Embed (${embedRules.length})\n\n`;
    for (const rule of embedRules) {
      md += `#### \`${rule.selector}\`\n\n`;
      md += `**Reasons:**\n`;
      for (const reason of rule.reasons) {
        md += `- ${formatRoutingReason(reason)}\n`;
      }
      md += `\n`;
    }
  }

  // Copy to clipboard
  navigator.clipboard.writeText(md).then(() => {
    // Could show a toast here
    console.log('Markdown copied to clipboard');
  });
}

/**
 * Export trace as JSON file
 */
function exportAsJSON(trace: CSSRoutingTrace): void {
  const json = JSON.stringify(trace, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `css-routing-trace-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

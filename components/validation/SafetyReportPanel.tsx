"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { WebflowSafetyReport } from "@/lib/webflow-safety-gate"
import type { ClassRenamingReport } from "@/lib/validation-types"

interface SafetyReportPanelProps {
  report: WebflowSafetyReport
}

interface ClassRenamingReportPanelProps {
  report: ClassRenamingReport
}

interface ExpandableListProps {
  items: string[]
  title: string
  initialLimit?: number
}

function ExpandableList({ items, title, initialLimit = 5 }: ExpandableListProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (items.length === 0) return null

  const displayItems = isExpanded ? items : items.slice(0, initialLimit)
  const hasMore = items.length > initialLimit

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide">
          {title} ({items.length})
        </p>
        {hasMore && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-[10px] font-medium opacity-70 hover:opacity-100 transition-opacity"
          >
            {isExpanded ? (
              <>Show less <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>Show all <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        )}
      </div>
      <ul className={`mt-2 space-y-1 text-xs ${isExpanded ? 'max-h-60 overflow-y-auto' : ''}`}>
        {displayItems.map((item, index) => (
          <li key={index} className="break-words">• {item}</li>
        ))}
      </ul>
    </div>
  )
}

interface WarningCategoryProps {
  items: string[]
  title: string
  hint?: string
}

function WarningCategory({ items, title, hint }: WarningCategoryProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (items.length === 0) return null

  const initialLimit = 5
  const displayItems = isExpanded ? items : items.slice(0, initialLimit)
  const hasMore = items.length > initialLimit

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide">
          {title} ({items.length})
        </p>
        {hasMore && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-[10px] font-medium opacity-70 hover:opacity-100 transition-opacity"
          >
            {isExpanded ? (
              <>Show less <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>Show all <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        )}
      </div>
      {hint && (
        <p className="text-[10px] opacity-60 mt-1 italic">{hint}</p>
      )}
      <ul className={`mt-2 space-y-1 text-xs ${isExpanded ? 'max-h-60 overflow-y-auto' : ''}`}>
        {displayItems.map((item, index) => (
          <li key={index} className="break-words">• {item}</li>
        ))}
      </ul>
    </div>
  )
}

export function SafetyReportPanel({ report }: SafetyReportPanelProps) {
  const isBlocked = report.status === "block"
  const isWarn = report.status === "warn"

  const tone = isBlocked
    ? "border-red-200 bg-red-50 text-red-900"
    : isWarn
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-emerald-200 bg-emerald-50 text-emerald-900"

  // Categorize warnings for better UX
  const categorizedWarnings = categorizeWarnings(report.warnings)
  const categorizedAutoFixes = categorizeAutoFixes(report.autoFixes)

  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold">
            Safety Report
          </h4>
          <p className="text-xs opacity-80">
            {isBlocked
              ? "Export blocked until critical issues are resolved."
              : isWarn
                ? "Export allowed with warnings. Create these classes in Webflow, or paste the CSS from the Embeds tab."
                : "Export is safe to paste in Webflow."}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold">
          {report.status}
        </span>
      </div>

      <ExpandableList items={report.fatalIssues} title="Blocked Issues" />

      {/* Placeholder styles auto-fix - highlight this as it eliminates missing style warnings */}
      {categorizedAutoFixes.placeholderStyles.length > 0 && (
        <div className="mt-3 p-2 rounded bg-emerald-100/50 border border-emerald-200">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800 mb-1">
            Auto-Fixed: Placeholder Styles Created ({categorizedAutoFixes.placeholderClassNames.length})
          </p>
          <p className="text-xs text-emerald-700 mb-2">
            Empty placeholder styles were auto-created for classes referenced in your HTML.
            This prevents &quot;missing style&quot; warnings in Webflow.
          </p>
          {(categorizedAutoFixes.embedOnlyCount > 0 || categorizedAutoFixes.noStyleCount > 0) && (
            <div className="text-[10px] text-emerald-600 mb-2 space-y-0.5">
              {categorizedAutoFixes.embedOnlyCount > 0 && (
                <p>• {categorizedAutoFixes.embedOnlyCount} class(es) have styles in the CSS embed</p>
              )}
              {categorizedAutoFixes.noStyleCount > 0 && (
                <p>• {categorizedAutoFixes.noStyleCount} class(es) are structural only (no CSS rules)</p>
              )}
            </div>
          )}
          {categorizedAutoFixes.placeholderClassNames.length > 0 && (
            <p className="text-xs font-mono text-emerald-800 break-words">
              {categorizedAutoFixes.placeholderClassNames.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Other sanitization auto-fixes */}
      {(categorizedAutoFixes.sanitization.length > 0 || categorizedAutoFixes.other.length > 0) && (
        <ExpandableList
          items={[...categorizedAutoFixes.sanitization, ...categorizedAutoFixes.other]}
          title="Other Auto-Fixes Applied"
        />
      )}

      {/* Categorized warnings with actionable hints */}
      {categorizedWarnings.missingStyles.length > 0 && (
        <>
          {/* Quick summary of unique class names */}
          <div className="mt-3 p-2 rounded bg-black/5">
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1">
              Classes to create ({categorizedWarnings.missingStyleNames.length})
            </p>
            <p className="text-xs font-mono break-words">
              {categorizedWarnings.missingStyleNames.join(', ')}
            </p>
          </div>
          <WarningCategory
            items={categorizedWarnings.missingStyles}
            title="Missing Styles Details"
            hint="These classes aren't in the payload. Create them in Webflow, or add the CSS from the Embeds tab."
          />
        </>
      )}
      {categorizedWarnings.embedIssues.length > 0 && (
        <WarningCategory
          items={categorizedWarnings.embedIssues}
          title="Embed Issues"
          hint="These use HTML embeds. Go to the Embeds tab to copy the code for Webflow embed elements."
        />
      )}
      {categorizedWarnings.other.length > 0 && (
        <ExpandableList
          items={categorizedWarnings.other}
          title="Other Warnings"
        />
      )}

      {(report.embedSize.errors.length > 0 || report.embedSize.warnings.length > 0) && (
        <ExpandableList
          items={[...report.embedSize.errors, ...report.embedSize.warnings]}
          title="Embed Size"
        />
      )}
    </div>
  )
}

function categorizeWarnings(warnings: string[]) {
  const missingStyles: string[] = []
  const missingStyleNames = new Set<string>()
  const embedIssues: string[] = []
  const other: string[] = []

  for (const warning of warnings) {
    if (warning.includes("missing style") || warning.includes("Missing style")) {
      missingStyles.push(warning)
      // Extract class name from "references missing style: className"
      const match = warning.match(/missing style:\s*(\S+)/i)
      if (match?.[1]) {
        missingStyleNames.add(match[1])
      }
    } else if (warning.includes("HtmlEmbed") || warning.includes("embed") || warning.includes("Embed")) {
      embedIssues.push(warning)
    } else {
      other.push(warning)
    }
  }

  return {
    missingStyles,
    missingStyleNames: Array.from(missingStyleNames).sort(),
    embedIssues,
    other
  }
}

function categorizeAutoFixes(autoFixes: string[]) {
  const placeholderStyles: string[] = []
  const placeholderClassNames: string[] = []
  const embedOnlyCount = { count: 0 }
  const noStyleCount = { count: 0 }
  const sanitization: string[] = []
  const other: string[] = []

  for (const fix of autoFixes) {
    if (fix.includes("placeholder style") || fix.includes("Placeholder style")) {
      placeholderStyles.push(fix)
      // Extract class names from "missing classes: className1, className2, ..."
      const match = fix.match(/missing classes:\s*(.+)/i)
      if (match?.[1]) {
        // Split by comma and clean up
        const classes = match[1].split(",").map(s => s.trim().replace(/\.\.\..*$/, "").replace(/^\+\d+ more$/, "").trim()).filter(Boolean)
        placeholderClassNames.push(...classes)
      }
    } else if (fix.includes("have styles in CSS embed")) {
      // Extract count from "→ X class(es) have styles in CSS embed"
      const countMatch = fix.match(/(\d+) class/)
      if (countMatch) embedOnlyCount.count = parseInt(countMatch[1], 10)
    } else if (fix.includes("have no CSS rules")) {
      // Extract count from "→ X class(es) have no CSS rules"
      const countMatch = fix.match(/(\d+) class/)
      if (countMatch) noStyleCount.count = parseInt(countMatch[1], 10)
    } else if (
      fix.includes("Regenerated") ||
      fix.includes("Removed") ||
      fix.includes("Broke circular") ||
      fix.includes("Flattened") ||
      fix.includes("Sanitized") ||
      fix.includes("Renamed")
    ) {
      sanitization.push(fix)
    } else {
      other.push(fix)
    }
  }

  return {
    placeholderStyles,
    placeholderClassNames: Array.from(new Set(placeholderClassNames)).sort(),
    embedOnlyCount: embedOnlyCount.count,
    noStyleCount: noStyleCount.count,
    sanitization,
    other
  }
}

/**
 * Panel for displaying BEM class renaming report
 */
export function ClassRenamingReportPanel({ report }: ClassRenamingReportPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // Determine badge color based on status
  const statusBadgeClass = report.status === "pass"
    ? "bg-green-100 text-green-700"
    : "bg-amber-100 text-amber-700"

  const hasRenames = report.summary.renamed > 0
  const hasHighRisk = report.summary.highRiskNeutralized > 0

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200 p-6 shadow-lg shadow-slate-200/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-slate-900">Class Renaming</h3>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${statusBadgeClass}`}>
            {report.status}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <span>{report.summary.totalClasses} classes</span>
          {hasRenames && (
            <span className="text-blue-600">{report.summary.renamed} renamed</span>
          )}
          {hasHighRisk && (
            <span className="text-amber-600">{report.summary.highRiskNeutralized} high-risk</span>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-slate-900">{report.summary.totalClasses}</div>
          <div className="text-xs text-slate-500 font-medium">Total Classes</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{report.summary.renamed}</div>
          <div className="text-xs text-slate-500 font-medium">Renamed</div>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-amber-600">{report.summary.highRiskNeutralized}</div>
          <div className="text-xs text-slate-500 font-medium">High-Risk</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-slate-600">{report.summary.preserved}</div>
          <div className="text-xs text-slate-500 font-medium">Preserved</div>
        </div>
      </div>

      {/* Warnings */}
      {report.warnings.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
          <div className="text-sm text-amber-800 font-medium">
            {report.warnings.map((warning, i) => (
              <div key={i}>{warning}</div>
            ))}
          </div>
        </div>
      )}

      {/* High-risk classes detected */}
      {report.categories.highRiskDetected.length > 0 && (
        <CollapsibleClassList
          title="High-Risk Classes Neutralized"
          items={report.categories.highRiskDetected.map(cls => ({
            label: cls,
            description: "Generic name that could conflict with Webflow"
          }))}
          isExpanded={expandedSections["highRisk"]}
          onToggle={() => toggleSection("highRisk")}
          badgeClass="bg-amber-100 text-amber-700"
        />
      )}

      {/* BEM renamed classes */}
      {report.categories.bemRenamed.length > 0 && (
        <CollapsibleClassList
          title="BEM Renamed"
          items={report.categories.bemRenamed.map(r => ({
            label: `${r.original} → ${r.renamed}`,
            description: `Block: ${r.block}`
          }))}
          isExpanded={expandedSections["bem"]}
          onToggle={() => toggleSection("bem")}
          badgeClass="bg-blue-100 text-blue-700"
        />
      )}

      {/* Utility namespaced classes */}
      {report.categories.utilityNamespaced.length > 0 && (
        <CollapsibleClassList
          title="Utility Namespaced"
          items={report.categories.utilityNamespaced.map(r => ({
            label: `${r.original} → ${r.renamed}`,
            description: "Simple namespace prefix"
          }))}
          isExpanded={expandedSections["utility"]}
          onToggle={() => toggleSection("utility")}
          badgeClass="bg-purple-100 text-purple-700"
        />
      )}

      {/* Preserved classes */}
      {report.categories.preserved.length > 0 && (
        <CollapsibleClassList
          title="Preserved (Design Tokens)"
          items={report.categories.preserved.map(p => ({
            label: p.className,
            description: p.reason
          }))}
          isExpanded={expandedSections["preserved"]}
          onToggle={() => toggleSection("preserved")}
          badgeClass="bg-slate-100 text-slate-600"
        />
      )}
    </div>
  )
}

interface CollapsibleClassListProps {
  title: string
  items: Array<{ label: string; description: string }>
  isExpanded: boolean
  onToggle: () => void
  badgeClass: string
}

function CollapsibleClassList({ title, items, isExpanded, onToggle, badgeClass }: CollapsibleClassListProps) {
  const displayLimit = 5
  const hasMore = items.length > displayLimit
  const displayItems = isExpanded ? items : items.slice(0, displayLimit)

  return (
    <div className="mt-4">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left group"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">{title}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${badgeClass}`}>
            {items.length}
          </span>
        </div>
        {hasMore && (
          <span className="text-slate-400 group-hover:text-slate-600">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        )}
      </button>
      <div className="mt-2 space-y-1">
        {displayItems.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 bg-slate-50 rounded-lg">
            <code className="font-mono text-slate-700">{item.label}</code>
            <span className="text-slate-400 text-[10px]">{item.description}</span>
          </div>
        ))}
        {!isExpanded && hasMore && (
          <button
            onClick={onToggle}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Show {items.length - displayLimit} more...
          </button>
        )}
      </div>
    </div>
  )
}

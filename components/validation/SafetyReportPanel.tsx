"use client"

import type { WebflowSafetyReport } from "@/lib/webflow-safety-gate"

interface SafetyReportPanelProps {
  report: WebflowSafetyReport
}

export function SafetyReportPanel({ report }: SafetyReportPanelProps) {
  const isBlocked = report.status === "block"
  const isWarn = report.status === "warn"

  const tone = isBlocked
    ? "border-red-200 bg-red-50 text-red-900"
    : isWarn
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-emerald-200 bg-emerald-50 text-emerald-900"

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
                ? "Export allowed with warnings and auto-fixes."
                : "Export is safe to paste in Webflow."}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold">
          {report.status}
        </span>
      </div>

      {report.fatalIssues.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide">Blocked Issues</p>
          <ul className="mt-2 space-y-1 text-xs">
            {report.fatalIssues.slice(0, 5).map((issue, index) => (
              <li key={index}>• {issue}</li>
            ))}
            {report.fatalIssues.length > 5 && (
              <li>• ...and {report.fatalIssues.length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      {report.autoFixes.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide">Auto-Fixes Applied</p>
          <ul className="mt-2 space-y-1 text-xs">
            {report.autoFixes.slice(0, 5).map((fix, index) => (
              <li key={index}>• {fix}</li>
            ))}
            {report.autoFixes.length > 5 && (
              <li>• ...and {report.autoFixes.length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      {report.warnings.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide">Warnings</p>
          <ul className="mt-2 space-y-1 text-xs">
            {report.warnings.slice(0, 5).map((warning, index) => (
              <li key={index}>• {warning}</li>
            ))}
            {report.warnings.length > 5 && (
              <li>• ...and {report.warnings.length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      {(report.embedSize.errors.length > 0 || report.embedSize.warnings.length > 0) && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide">Embed Size</p>
          <ul className="mt-2 space-y-1 text-xs">
            {report.embedSize.errors.map((issue, index) => (
              <li key={`e-${index}`}>• {issue}</li>
            ))}
            {report.embedSize.warnings.map((issue, index) => (
              <li key={`w-${index}`}>• {issue}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

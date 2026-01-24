"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { CopyButton } from "./CopyButton"
import { SafetyReportPanel } from "./SafetyReportPanel"
import { LibraryImportGuide } from "./LibraryImportGuide"
import { copyWebflowJson, copyText } from "@/lib/clipboard"
import type { WebflowSafetyReport } from "@/lib/webflow-safety-gate"

interface PayloadData {
  designTokens?: string | null
  webflowJson?: string | null
  cssEmbed?: string | null
  jsEmbed?: string | null
  libraryImports?: {
    scripts: string[]
    styles: string[]
  } | null
  validationResults?: {
    designTokens: { valid: boolean; errors: string[]; warnings: string[] }
    webflowJson: { valid: boolean; errors: string[]; warnings: string[] }
    cssEmbed: { valid: boolean; errors: string[]; warnings: string[] }
    jsEmbed: { valid: boolean; errors: string[]; warnings: string[] }
  }
  detectedLibraries?: string[]
  /** Metadata about content that was extracted to embeds for safety */
  extractedToEmbed?: {
    hasCSSExtracted: boolean
    hasJSExtracted: boolean
    warnings: string[]
  }
  /** Safety gate report */
  safetyReport?: WebflowSafetyReport
}

interface MultiStepCopyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payload: PayloadData
  assetTitle?: string
}

export function MultiStepCopyModal({ open, onOpenChange, payload, assetTitle }: MultiStepCopyModalProps) {
  const hasDesignTokens = !!payload.designTokens
  const hasCSSEmbed = !!payload.cssEmbed
  const hasJSEmbed = !!payload.jsEmbed
  const hasLibraries = !!(payload.libraryImports?.scripts.length || payload.libraryImports?.styles.length)
  const hasExtractionWarnings = !!(payload.extractedToEmbed?.warnings?.length)

  // Custom copy handlers that use our clipboard utilities
  const handleCopyWebflow = async () => {
    if (payload.webflowJson) {
      await copyWebflowJson(payload.webflowJson)
    }
  }

  const handleCopyDesignTokens = async () => {
    if (payload.designTokens) {
      await copyText(payload.designTokens)
    }
  }

  const handleCopyCSSEmbed = async () => {
    if (payload.cssEmbed) {
      await copyText(payload.cssEmbed)
    }
  }

  const handleCopyJSEmbed = async () => {
    if (payload.jsEmbed) {
      await copyText(payload.jsEmbed)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Copy to Webflow</DialogTitle>
          <DialogDescription>
            {assetTitle && `${assetTitle} - `}
            Follow these steps to paste into Webflow
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {payload.safetyReport && (
            <SafetyReportPanel report={payload.safetyReport} />
          )}
          {/* Extraction Warnings Banner */}
          {hasExtractionWarnings && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div className="flex-1 space-y-2">
                  <h4 className="font-semibold text-amber-800 dark:text-amber-200">
                    Content was moved to embeds for safety
                  </h4>
                  <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
                    {payload.extractedToEmbed?.warnings.map((warning, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Make sure to complete{" "}
                    {payload.extractedToEmbed?.hasCSSExtracted && payload.extractedToEmbed?.hasJSExtracted
                      ? "Steps 3 and 4 (CSS and JS embeds)"
                      : payload.extractedToEmbed?.hasCSSExtracted
                        ? "Step 3 (CSS embed)"
                        : "Step 4 (JS embed)"}{" "}
                    for full functionality.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Style Guide (Design Tokens) (Optional) */}
          {hasDesignTokens && (
            <>
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-mono bg-muted px-2 py-1 rounded">STEP 1</span>
                  <h3 className="font-semibold">Style Guide (Design Tokens) (Optional)</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Paste in Webflow: <strong>Site Settings → Custom Code → Head Code</strong> (inside <code>&lt;style&gt;</code> tags)
                </p>
                <CopyButton
                  label="Style Guide (Design Tokens) JSON"
                  content={payload.designTokens}
                  validation={payload.validationResults?.designTokens}
                  onCopy={handleCopyDesignTokens}
                  variant="outline"
                />
              </div>
              <Separator />
            </>
          )}

          {/* Step 2: Webflow Structure (Main) */}
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-mono bg-primary text-primary-foreground px-2 py-1 rounded">
                STEP {hasDesignTokens ? "2" : "1"}
              </span>
              <h3 className="font-semibold">Webflow Structure (Required)</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Paste in Webflow: <strong>Designer Canvas (Cmd/Ctrl + V)</strong>
            </p>
            <CopyButton
              label="Webflow JSON"
              content={payload.webflowJson}
              validation={payload.validationResults?.webflowJson}
              onCopy={handleCopyWebflow}
              variant="default"
            />
          </div>

          {/* Step 3: CSS Embed (If Needed) */}
          {hasCSSEmbed && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-mono bg-amber-500 text-white px-2 py-1 rounded">
                    STEP {hasDesignTokens ? "3" : "2"}
                  </span>
                  <h3 className="font-semibold">CSS Embed (Required for Advanced Features)</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Paste in Webflow: <strong>Add HTML Embed element → Paste inside <code>&lt;style&gt;</code> tags</strong>
                </p>
                {payload.detectedLibraries && payload.detectedLibraries.length > 0 && (
                  <div className="text-xs text-amber-700  bg-amber-50  p-2 rounded">
                    ⚠️ This component uses modern CSS features that require custom code
                  </div>
                )}
                <CopyButton
                  label="CSS Embed"
                  content={payload.cssEmbed}
                  validation={payload.validationResults?.cssEmbed}
                  onCopy={handleCopyCSSEmbed}
                  variant="outline"
                />
              </div>
            </>
          )}

          {/* Step 4: JS Embed (If Needed) */}
          {hasJSEmbed && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-mono bg-blue-500 text-white px-2 py-1 rounded">
                    STEP {hasDesignTokens && hasCSSEmbed ? "4" : hasDesignTokens || hasCSSEmbed ? "3" : "2"}
                  </span>
                  <h3 className="font-semibold">JavaScript Embed (Required for Interactions)</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Paste in Webflow: <strong>Page Settings → Custom Code → Before &lt;/body&gt; tag</strong>
                </p>
                <CopyButton
                  label="JavaScript"
                  content={payload.jsEmbed}
                  validation={payload.validationResults?.jsEmbed}
                  onCopy={handleCopyJSEmbed}
                  variant="outline"
                />
              </div>
            </>
          )}

          {/* Step 5: External Libraries (If Needed) */}
          {hasLibraries && payload.libraryImports && (
            <>
              <Separator />
              <LibraryImportGuide
                libraries={payload.libraryImports}
                detectedNames={payload.detectedLibraries}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

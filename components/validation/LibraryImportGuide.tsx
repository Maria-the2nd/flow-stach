"use client"

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Link03Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

interface LibraryImportGuideProps {
  libraries: {
    scripts: string[]
    styles: string[]
  }
  detectedNames?: string[]
  validation?: {
    valid: boolean
    errors: string[]
    warnings: string[]
  }
}

export function LibraryImportGuide({ libraries, detectedNames, validation }: LibraryImportGuideProps) {
  const hasLibraries = libraries.scripts.length > 0 || libraries.styles.length > 0

  if (!hasLibraries) {
    return null
  }

  const handleCopyScripts = async () => {
    const scriptTags = libraries.scripts
      .map((url) => `<script src="${url}"></script>`)
      .join("\n")

    try {
      await navigator.clipboard.writeText(scriptTags)
      toast.success("Script tags copied to clipboard")
    } catch (error) {
      console.error("Copy failed:", error)
      toast.error("Failed to copy script tags")
    }
  }

  const handleCopyStyles = async () => {
    const linkTags = libraries.styles
      .map((url) => `<link rel="stylesheet" href="${url}">`)
      .join("\n")

    try {
      await navigator.clipboard.writeText(linkTags)
      toast.success("Link tags copied to clipboard")
    } catch (error) {
      console.error("Copy failed:", error)
      toast.error("Failed to copy link tags")
    }
  }

  return (
    <Card className="border-purple-500/50 bg-purple-50/50 ">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-purple-700 ">
          <HugeiconsIcon icon={Link03Icon} size={20} />
          External Libraries Detected
        </CardTitle>
        {detectedNames && detectedNames.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Found: {detectedNames.join(", ")}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded bg-purple-100  text-sm">
          <p className="font-medium text-purple-900  mb-2">
            Installation Required:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-purple-800 ">
            <li>
              Go to <strong>Project Settings → Custom Code</strong> in Webflow
            </li>
            <li>
              Add script tags to <strong>&ldquo;Head Code&rdquo;</strong> section
            </li>
            {libraries.styles.length > 0 && (
              <li>
                Add link tags to <strong>&ldquo;Head Code&rdquo;</strong> section
              </li>
            )}
            <li>Save and publish your site</li>
          </ol>
        </div>

        {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div className="space-y-2">
            {validation.errors.length > 0 && (
              <div className="p-3 rounded bg-red-50 border border-red-200">
                <p className="font-medium text-red-900 mb-2 text-sm">Validation Errors:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                  {validation.errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="p-3 rounded bg-amber-50 border border-amber-200">
                <p className="font-medium text-amber-900 mb-2 text-sm">Validation Warnings:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-amber-800">
                  {validation.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {libraries.scripts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">JavaScript Libraries</span>
              <Button variant="outline" size="sm" onClick={handleCopyScripts}>
                <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1" />
                Copy Script Tags
              </Button>
            </div>
            <pre className="bg-muted rounded-lg p-3 text-xs overflow-auto max-h-32 font-mono border border-border">
              {libraries.scripts.map((url) => `<script src="${url}"></script>`).join("\n")}
            </pre>
          </div>
        )}

        {libraries.styles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">CSS Libraries</span>
              <Button variant="outline" size="sm" onClick={handleCopyStyles}>
                <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1" />
                Copy Link Tags
              </Button>
            </div>
            <pre className="bg-muted rounded-lg p-3 text-xs overflow-auto max-h-32 font-mono border border-border">
              {libraries.styles.map((url) => `<link rel="stylesheet" href="${url}">`).join("\n")}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

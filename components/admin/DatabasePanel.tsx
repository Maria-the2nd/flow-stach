"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete01Icon, CheckmarkCircle01Icon, Alert01Icon } from "@hugeicons/core-free-icons"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface DatabasePanelProps {
  onActionComplete?: () => void
}

export function DatabasePanel({ onActionComplete }: DatabasePanelProps) {
  const clearAllAssets = useMutation(api.admin.clearAllAssets)
  const counts = useQuery(api.assets.categoryCounts, {})
  const templates = useQuery(api.templates.listWithCounts, {})
  const clearTemplateData = useMutation(api.admin.clearTemplateData)

  const [isClearing, setIsClearing] = useState(false)
  const [clearResult, setClearResult] = useState<{
    deletedAssets: number
    deletedPayloads: number
    deletedFavorites: number
    deletedTemplates: number
  } | null>(null)
  const [templateClearing, setTemplateClearing] = useState<Record<string, boolean>>({})
  const [templateDeleting, setTemplateDeleting] = useState<Record<string, boolean>>({})

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to delete ALL assets, payloads, favorites, and templates? This cannot be undone.")) {
      return
    }

    setIsClearing(true)
    setClearResult(null)

    try {
      const res = await clearAllAssets()
      setClearResult(res)
      toast.success(
        `Cleared ${res.deletedAssets} assets, ${res.deletedPayloads} payloads, ${res.deletedFavorites} favorites, ${res.deletedTemplates} templates`
      )
      onActionComplete?.()
    } catch (error) {
      console.error("Clear error:", error)
      toast.error("Failed to clear assets. Check console.")
    } finally {
      setIsClearing(false)
    }
  }

  const handleClearTemplate = async (templateId: Id<"templates">, templateName: string) => {
    if (!confirm(`Delete all assets, payloads, and favorites for template "${templateName}"? This cannot be undone.`)) {
      return
    }

    setTemplateClearing((prev) => ({ ...prev, [templateId]: true }))
    try {
      const res = await clearTemplateData({ templateId, deleteTemplate: false })
      toast.success(
        `Cleared ${res.deletedAssets} assets, ${res.deletedPayloads} payloads, ${res.deletedFavorites} favorites for "${templateName}"`
      )
      onActionComplete?.()
    } catch (error) {
      console.error("Template clear error:", error)
      toast.error(`Failed to clear template "${templateName}". Check console.`)
    } finally {
      setTemplateClearing((prev) => ({ ...prev, [templateId]: false }))
    }
  }

  const handleDeleteTemplate = async (templateId: Id<"templates">, templateName: string) => {
    if (!confirm(`Delete template "${templateName}" and all of its assets, payloads, and favorites? This cannot be undone.`)) {
      return
    }
    setTemplateDeleting((prev) => ({ ...prev, [templateId]: true }))
    try {
      const res = await clearTemplateData({ templateId, deleteTemplate: true })
      toast.success(
        `Deleted template "${templateName}" and cleared ${res.deletedAssets} assets, ${res.deletedPayloads} payloads, ${res.deletedFavorites} favorites`
      )
      onActionComplete?.()
    } catch (error) {
      console.error("Template delete error:", error)
      toast.error(`Failed to delete template "${templateName}". Check console.`)
    } finally {
      setTemplateDeleting((prev) => ({ ...prev, [templateId]: false }))
    }
  }

  return (
    <div className="space-y-4">
      {/* Database stats */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-4">
        <span className="text-sm font-medium">Database Stats</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Badge variant="cyan">
            {counts?.total ?? 0} Assets
          </Badge>
          {counts?.byCategory && Object.entries(counts.byCategory).map(([cat, count]) => (
            <Badge key={cat} variant="outline" className="capitalize">
              {cat}: {count}
            </Badge>
          ))}
        </div>
      </div>

      {/* Clear by template */}
      {templates && templates.length > 0 && (
        <div className="rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-500/10 p-2">
              <HugeiconsIcon icon={Alert01Icon} className="h-4 w-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium">Clear Template Data</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Delete all assets, payloads, and favorites for a single template. Templates remain for re-import.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {templates.map((t) => (
                  <div key={t._id} className="flex items-center justify-between rounded-md border p-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {t.name}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Assets: {t.assetCount ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleClearTemplate(t._id, t.name)}
                        disabled={templateClearing[t._id] === true || templateDeleting[t._id] === true}
                        variant="outline"
                        size="sm"
                      >
                        {templateClearing[t._id] ? "Clearing..." : "Clear Data"}
                      </Button>
                      <Button
                        onClick={() => handleDeleteTemplate(t._id, t.name)}
                        disabled={templateDeleting[t._id] === true}
                        variant="destructive"
                        size="sm"
                      >
                        <HugeiconsIcon icon={Delete01Icon} className="mr-1.5 h-3.5 w-3.5" />
                        {templateDeleting[t._id] ? "Deleting..." : "Delete Template"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear action */}
      <div className="rounded-lg border border-destructive/30 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-destructive/10 p-2">
            <HugeiconsIcon icon={Alert01Icon} className="h-4 w-4 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium">Clear All Data</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Permanently delete all assets, payloads, favorites, and templates from the database. This action cannot be undone.
            </p>
            <Button
              onClick={handleClearAll}
              disabled={isClearing}
              variant="destructive"
              size="sm"
              className="mt-3"
            >
              <HugeiconsIcon icon={Delete01Icon} className="mr-1.5 h-3.5 w-3.5" />
              {isClearing ? "Clearing..." : "Clear All Assets"}
            </Button>
          </div>
        </div>
      </div>

      {/* Clear result */}
      {clearResult && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
          <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-4 w-4 text-emerald-600" />
          <span className="font-medium text-emerald-600">Cleared Successfully</span>
          <div className="ml-auto flex gap-3 text-xs text-muted-foreground">
            <span>Assets: {clearResult.deletedAssets}</span>
            <span>Payloads: {clearResult.deletedPayloads}</span>
            <span>Favorites: {clearResult.deletedFavorites}</span>
            <span>Templates: {clearResult.deletedTemplates}</span>
          </div>
        </div>
      )}
    </div>
  )
}

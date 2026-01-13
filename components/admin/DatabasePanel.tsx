"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete01Icon, CheckmarkCircle01Icon, Alert01Icon } from "@hugeicons/core-free-icons"

import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface DatabasePanelProps {
  onActionComplete?: () => void
}

export function DatabasePanel({ onActionComplete }: DatabasePanelProps) {
  const clearAllAssets = useMutation(api.admin.clearAllAssets)
  const counts = useQuery(api.assets.categoryCounts, {})

  const [isClearing, setIsClearing] = useState(false)
  const [clearResult, setClearResult] = useState<{
    deletedAssets: number
    deletedPayloads: number
    deletedFavorites: number
  } | null>(null)

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to delete ALL assets, payloads, and favorites? This cannot be undone.")) {
      return
    }

    setIsClearing(true)
    setClearResult(null)

    try {
      const res = await clearAllAssets()
      setClearResult(res)
      toast.success(`Cleared ${res.deletedAssets} assets, ${res.deletedPayloads} payloads, ${res.deletedFavorites} favorites`)
      onActionComplete?.()
    } catch (error) {
      console.error("Clear error:", error)
      toast.error("Failed to clear assets. Check console.")
    } finally {
      setIsClearing(false)
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

      {/* Clear action */}
      <div className="rounded-lg border border-destructive/30 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-destructive/10 p-2">
            <HugeiconsIcon icon={Alert01Icon} className="h-4 w-4 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium">Clear All Data</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Permanently delete all assets, payloads, and favorites from the database. This action cannot be undone.
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
          </div>
        </div>
      )}
    </div>
  )
}

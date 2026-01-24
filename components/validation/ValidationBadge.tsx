"use client"

import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick02Icon, CancelCircleIcon, Alert02Icon } from "@hugeicons/core-free-icons"

interface ValidationBadgeProps {
  valid: boolean
  errors?: number
  warnings?: number
  compact?: boolean
}

export function ValidationBadge({ valid, errors = 0, warnings = 0, compact = false }: ValidationBadgeProps) {
  if (valid && warnings === 0) {
    return (
      <Badge variant="default" className="bg-emerald-500 text-white gap-1">
        <HugeiconsIcon icon={Tick02Icon} size={12} />
        {!compact && "Valid"}
      </Badge>
    )
  }

  if (errors > 0) {
    return (
      <Badge variant="destructive" className="gap-1">
        <HugeiconsIcon icon={CancelCircleIcon} size={12} />
        {compact ? errors : `${errors} error${errors > 1 ? 's' : ''}`}
      </Badge>
    )
  }

  if (warnings > 0) {
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-700  gap-1">
        <HugeiconsIcon icon={Alert02Icon} size={12} />
        {compact ? warnings : `${warnings} warning${warnings > 1 ? 's' : ''}`}
      </Badge>
    )
  }

  return null
}

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Tick02Icon, CancelCircleIcon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { ValidationBadge } from "./ValidationBadge"

interface CopyButtonProps {
  label: string
  content: string | null | undefined
  validation?: {
    valid: boolean
    errors: string[]
    warnings: string[]
  }
  onCopy?: () => Promise<void> | void
  disabled?: boolean
  variant?: "default" | "outline" | "secondary"
  size?: "default" | "sm" | "lg"
  showValidation?: boolean
}

export function CopyButton({
  label,
  content,
  validation,
  onCopy,
  disabled = false,
  variant = "outline",
  size = "default",
  showValidation = true,
}: CopyButtonProps) {
  const [copying, setCopying] = useState(false)
  const [copied, setCopied] = useState(false)

  const isAvailable = !!content
  const hasErrors = validation && !validation.valid
  const isDisabled = disabled || !isAvailable || hasErrors

  const handleCopy = async () => {
    if (isDisabled || !content) return

    // Show warnings before copying
    if (validation && validation.warnings.length > 0) {
      toast.warning(`${validation.warnings.length} warning(s)`, {
        description: validation.warnings[0],
      })
    }

    setCopying(true)
    try {
      if (onCopy) {
        await onCopy()
      } else {
        // Default: copy to clipboard as text
        await navigator.clipboard.writeText(content)
        toast.success(`${label} copied to clipboard`)
      }

      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Copy failed:", error)
      toast.error(`Failed to copy ${label}`)
    } finally {
      setCopying(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {showValidation && validation && (
          <ValidationBadge
            valid={validation.valid}
            errors={validation.errors.length}
            warnings={validation.warnings.length}
            compact
          />
        )}
      </div>

      <Button
        onClick={handleCopy}
        disabled={isDisabled}
        variant={variant}
        size={size}
        className="w-full justify-start"
      >
        {copied ? (
          <>
            <HugeiconsIcon icon={Tick02Icon} size={16} className="mr-2" />
            Copied!
          </>
        ) : hasErrors ? (
          <>
            <HugeiconsIcon icon={CancelCircleIcon} size={16} className="mr-2" />
            Cannot copy - {validation!.errors.length} error{validation!.errors.length > 1 ? 's' : ''}
          </>
        ) : !isAvailable ? (
          <>
            <HugeiconsIcon icon={Copy01Icon} size={16} className="mr-2 opacity-50" />
            Not available
          </>
        ) : copying ? (
          <>
            <HugeiconsIcon icon={Copy01Icon} size={16} className="mr-2 animate-pulse" />
            Copying...
          </>
        ) : (
          <>
            <HugeiconsIcon icon={Copy01Icon} size={16} className="mr-2" />
            Copy
          </>
        )}
      </Button>

      {/* Show errors if any */}
      {hasErrors && validation && (
        <div className="text-xs text-destructive space-y-1">
          {validation.errors.slice(0, 3).map((error, i) => (
            <div key={i}>• {error}</div>
          ))}
          {validation.errors.length > 3 && (
            <div>• ... and {validation.errors.length - 3} more</div>
          )}
        </div>
      )}
    </div>
  )
}

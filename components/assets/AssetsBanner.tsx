"use client"

import { cn } from "@/lib/utils"

interface AssetsBannerProps {
  eyebrow?: string
  title: string
  description?: string
  meta?: string
  className?: string
}

export function AssetsBanner({
  eyebrow = "Template Library",
  title,
  description,
  meta,
  className,
}: AssetsBannerProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/70",
        "bg-[linear-gradient(45deg,#ED9A00,#FD6F01,#FFB000)]",
        "px-6 py-8 sm:px-8 sm:py-10",
        className
      )}
    >
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/30 blur-2xl" />
      <div className="absolute -bottom-12 right-24 h-32 w-32 rounded-full bg-white/20 blur-3xl" />
      <div className="relative flex flex-col gap-3 text-black">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-black/70">
          <span className="font-display">(01)</span>
          <span className="font-display">{eyebrow}</span>
        </div>
        <h1 className="font-display text-3xl uppercase tracking-tight text-black sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-black/70 sm:text-base">
            {description}
          </p>
        ) : null}
        {meta ? (
          <div className="text-xs uppercase tracking-[0.2em] text-black/70">
            {meta}
          </div>
        ) : null}
      </div>
    </section>
  )
}

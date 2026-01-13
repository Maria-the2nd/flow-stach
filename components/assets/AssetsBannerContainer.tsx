"use client"

import { useSearchParams } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { AssetsBanner } from "@/components/assets/AssetsBanner"

export function AssetsBannerContainer() {
  const searchParams = useSearchParams()
  const { isLoaded, isSignedIn } = useAuth()
  const templateFilter = searchParams.get("template")
  const showTemplateLibrary = !templateFilter

  const templates = useQuery(
    api.templates.list,
    isLoaded && isSignedIn ? {} : "skip"
  )

  const activeTemplate = templates?.find((template) => template.slug === templateFilter)

  return (
    <AssetsBanner
      eyebrow={showTemplateLibrary ? "Template Library" : "Component Library"}
      title={showTemplateLibrary ? "Explore the Template Library" : activeTemplate?.name || "Components"}
      description={
        showTemplateLibrary
          ? "Each template opens a full component library. Choose a template to dive into every section."
          : "All components for the selected template. Copy to Webflow or clean up entries as you build."
      }
      meta={showTemplateLibrary ? "Curated templates" : `Template: ${activeTemplate?.name ?? "All"}`}
    />
  )
}

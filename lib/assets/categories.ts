export interface AssetCategory {
  label: string
  slug: string
}

export const ASSET_CATEGORIES: AssetCategory[] = [
  { label: "All Templates", slug: "" },
  { label: "Cursor", slug: "cursor" },
  { label: "Scroll", slug: "scroll" },
  { label: "Buttons", slug: "buttons" },
  { label: "Navigation", slug: "navigation" },
  { label: "Hover", slug: "hover" },
  { label: "Media", slug: "media" },
  { label: "Typography", slug: "typography" },
  { label: "Utilities", slug: "utilities" },
  { label: "Sections", slug: "sections" },
  { label: "Tokens", slug: "tokens" },
]

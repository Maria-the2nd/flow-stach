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
  { label: "Hero", slug: "hero" },
  { label: "Hover", slug: "hover" },
  { label: "Media", slug: "media" },
  { label: "Typography", slug: "typography" },
  { label: "Utilities", slug: "utilities" },
  { label: "Templates", slug: "template" },
  { label: "Sections", slug: "sections" },
  { label: "Full Page", slug: "full-page" },
  { label: "Design Tokens", slug: "tokens" },
]

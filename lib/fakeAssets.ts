export type Asset = {
  slug: string
  title: string
  category: string
  isNew: boolean
  updatedAt: string
  tags: string[]
}

// Categories matching the Sidebar CATEGORIES
export const categories = [
  "cursor",
  "scroll",
  "buttons",
  "navigation",
  "hover",
  "media",
  "typography",
  "utilities",
  "sections",
] as const

export type Category = (typeof categories)[number]

export const fakeAssets: Asset[] = [
  {
    slug: "magnetic-cursor-effect",
    title: "Magnetic Cursor Effect",
    category: "cursor",
    isNew: true,
    updatedAt: "2024-01-10",
    tags: ["cursor", "magnetic", "interaction"],
  },
  {
    slug: "custom-cursor-trails",
    title: "Custom Cursor Trails",
    category: "cursor",
    isNew: false,
    updatedAt: "2023-12-15",
    tags: ["cursor", "trails", "animation"],
  },
  {
    slug: "smooth-scroll-anchor",
    title: "Smooth Scroll Anchor",
    category: "scroll",
    isNew: true,
    updatedAt: "2024-01-09",
    tags: ["scroll", "smooth", "anchor"],
  },
  {
    slug: "parallax-scroll-sections",
    title: "Parallax Scroll Sections",
    category: "scroll",
    isNew: false,
    updatedAt: "2023-11-20",
    tags: ["scroll", "parallax", "sections"],
  },
  {
    slug: "animated-cta-button",
    title: "Animated CTA Button",
    category: "buttons",
    isNew: true,
    updatedAt: "2024-01-08",
    tags: ["button", "cta", "animation"],
  },
  {
    slug: "gradient-border-button",
    title: "Gradient Border Button",
    category: "buttons",
    isNew: false,
    updatedAt: "2023-10-05",
    tags: ["button", "gradient", "border"],
  },
  {
    slug: "mobile-nav-drawer",
    title: "Mobile Nav Drawer",
    category: "navigation",
    isNew: true,
    updatedAt: "2024-01-07",
    tags: ["navigation", "mobile", "drawer"],
  },
  {
    slug: "mega-menu-dropdown",
    title: "Mega Menu Dropdown",
    category: "navigation",
    isNew: false,
    updatedAt: "2023-09-12",
    tags: ["navigation", "menu", "dropdown"],
  },
  {
    slug: "card-hover-tilt",
    title: "Card Hover Tilt",
    category: "hover",
    isNew: true,
    updatedAt: "2024-01-05",
    tags: ["hover", "card", "tilt", "3d"],
  },
  {
    slug: "image-hover-zoom",
    title: "Image Hover Zoom",
    category: "hover",
    isNew: false,
    updatedAt: "2023-08-30",
    tags: ["hover", "image", "zoom"],
  },
  {
    slug: "video-background-hero",
    title: "Video Background Hero",
    category: "media",
    isNew: true,
    updatedAt: "2024-01-04",
    tags: ["video", "background", "hero"],
  },
  {
    slug: "image-gallery-lightbox",
    title: "Image Gallery Lightbox",
    category: "media",
    isNew: false,
    updatedAt: "2023-07-15",
    tags: ["gallery", "lightbox", "images"],
  },
  {
    slug: "animated-text-reveal",
    title: "Animated Text Reveal",
    category: "typography",
    isNew: true,
    updatedAt: "2024-01-03",
    tags: ["text", "animation", "reveal"],
  },
  {
    slug: "gradient-text-effect",
    title: "Gradient Text Effect",
    category: "typography",
    isNew: false,
    updatedAt: "2023-06-20",
    tags: ["text", "gradient", "effect"],
  },
  {
    slug: "copy-to-clipboard",
    title: "Copy to Clipboard",
    category: "utilities",
    isNew: false,
    updatedAt: "2023-05-10",
    tags: ["clipboard", "copy", "utility"],
  },
  {
    slug: "dark-mode-toggle",
    title: "Dark Mode Toggle",
    category: "utilities",
    isNew: true,
    updatedAt: "2024-01-02",
    tags: ["dark-mode", "toggle", "theme"],
  },
  {
    slug: "hero-split-section",
    title: "Hero Split Section",
    category: "sections",
    isNew: false,
    updatedAt: "2023-04-25",
    tags: ["hero", "section", "layout"],
  },
  {
    slug: "testimonial-carousel",
    title: "Testimonial Carousel",
    category: "sections",
    isNew: true,
    updatedAt: "2024-01-01",
    tags: ["testimonial", "carousel", "section"],
  },
]

export function getAssetBySlug(slug: string): Asset | undefined {
  return fakeAssets.find((asset) => asset.slug === slug)
}

export function getAllAssets(): Asset[] {
  return fakeAssets
}

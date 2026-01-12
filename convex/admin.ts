import { mutation } from "./_generated/server"
import { requireAdmin } from "./auth"

// Demo data based on existing fakeAssets
const demoAssets = [
  {
    slug: "magnetic-cursor-effect",
    title: "Magnetic Cursor Effect",
    category: "cursor",
    description: "A smooth magnetic cursor effect that follows interactive elements",
    tags: ["cursor", "magnetic", "interaction"],
    isNew: true,
  },
  {
    slug: "custom-cursor-trails",
    title: "Custom Cursor Trails",
    category: "cursor",
    description: "Beautiful cursor trails with customizable effects",
    tags: ["cursor", "trails", "animation"],
    isNew: false,
  },
  {
    slug: "smooth-scroll-anchor",
    title: "Smooth Scroll Anchor",
    category: "scroll",
    description: "Smooth scrolling to anchor sections with easing",
    tags: ["scroll", "smooth", "anchor"],
    isNew: true,
  },
  {
    slug: "parallax-scroll-sections",
    title: "Parallax Scroll Sections",
    category: "scroll",
    description: "Multi-layer parallax scrolling for immersive experiences",
    tags: ["scroll", "parallax", "sections"],
    isNew: false,
  },
  {
    slug: "animated-cta-button",
    title: "Animated CTA Button",
    category: "buttons",
    description: "Eye-catching animated call-to-action button",
    tags: ["button", "cta", "animation"],
    isNew: true,
  },
  {
    slug: "gradient-border-button",
    title: "Gradient Border Button",
    category: "buttons",
    description: "Button with animated gradient border effect",
    tags: ["button", "gradient", "border"],
    isNew: false,
  },
  {
    slug: "mobile-nav-drawer",
    title: "Mobile Nav Drawer",
    category: "navigation",
    description: "Responsive mobile navigation drawer component",
    tags: ["navigation", "mobile", "drawer"],
    isNew: true,
  },
  {
    slug: "mega-menu-dropdown",
    title: "Mega Menu Dropdown",
    category: "navigation",
    description: "Large dropdown menu for complex navigation structures",
    tags: ["navigation", "menu", "dropdown"],
    isNew: false,
  },
  {
    slug: "card-hover-tilt",
    title: "Card Hover Tilt",
    category: "hover",
    description: "3D tilt effect on card hover with smooth animation",
    tags: ["hover", "card", "tilt", "3d"],
    isNew: true,
  },
  {
    slug: "image-hover-zoom",
    title: "Image Hover Zoom",
    category: "hover",
    description: "Smooth zoom effect on image hover",
    tags: ["hover", "image", "zoom"],
    isNew: false,
  },
  {
    slug: "video-background-hero",
    title: "Video Background Hero",
    category: "media",
    description: "Full-screen video background for hero sections",
    tags: ["video", "background", "hero"],
    isNew: true,
  },
  {
    slug: "image-gallery-lightbox",
    title: "Image Gallery Lightbox",
    category: "media",
    description: "Interactive image gallery with lightbox modal",
    tags: ["gallery", "lightbox", "images"],
    isNew: false,
  },
  {
    slug: "animated-text-reveal",
    title: "Animated Text Reveal",
    category: "typography",
    description: "Text reveal animation with various effects",
    tags: ["text", "animation", "reveal"],
    isNew: true,
  },
  {
    slug: "gradient-text-effect",
    title: "Gradient Text Effect",
    category: "typography",
    description: "Animated gradient text with CSS effects",
    tags: ["text", "gradient", "effect"],
    isNew: false,
  },
  {
    slug: "copy-to-clipboard",
    title: "Copy to Clipboard",
    category: "utilities",
    description: "One-click copy to clipboard utility",
    tags: ["clipboard", "copy", "utility"],
    isNew: false,
  },
  {
    slug: "dark-mode-toggle",
    title: "Dark Mode Toggle",
    category: "utilities",
    description: "Smooth dark mode toggle with system preference detection",
    tags: ["dark-mode", "toggle", "theme"],
    isNew: true,
  },
  {
    slug: "hero-split-section",
    title: "Hero Split Section",
    category: "sections",
    description: "Split-screen hero section layout",
    tags: ["hero", "section", "layout"],
    isNew: false,
  },
  {
    slug: "testimonial-carousel",
    title: "Testimonial Carousel",
    category: "sections",
    description: "Responsive testimonial carousel with auto-play",
    tags: ["testimonial", "carousel", "section"],
    isNew: true,
  },
]

// Seed demo data - admin only
export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const now = Date.now()
    const results = { assets: 0, payloads: 0 }

    for (const asset of demoAssets) {
      // Check if asset already exists
      const existing = await ctx.db
        .query("assets")
        .withIndex("by_slug", (q) => q.eq("slug", asset.slug))
        .unique()

      if (existing) {
        continue // Skip if already exists
      }

      // Create asset
      const assetId = await ctx.db.insert("assets", {
        slug: asset.slug,
        title: asset.title,
        category: asset.category,
        description: asset.description,
        tags: asset.tags,
        isNew: asset.isNew,
        status: "published",
        createdAt: now,
        updatedAt: now,
      })
      results.assets++

      // Create placeholder payload
      await ctx.db.insert("payloads", {
        assetId,
        webflowJson: JSON.stringify({ placeholder: true }),
        codePayload: `// ${asset.title}\n// TODO: Add implementation`,
        dependencies: [],
        createdAt: now,
        updatedAt: now,
      })
      results.payloads++
    }

    return results
  },
})

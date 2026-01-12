import { mutation } from "./_generated/server"
import { requireAdmin } from "./auth"

// ============================================================================
// REAL PAYLOADS FOR HERO ASSETS
// ============================================================================

const magneticCursorWebflowJson = {
  type: "@webflow/XscpData",
  payload: {
    nodes: [
      {
        _id: "mc-wrapper-001",
        type: "Block",
        tag: "div",
        classes: ["mc-style-wrapper"],
        children: ["mc-cursor-001", "mc-demo-001"],
        data: {
          tag: "div",
          text: false,
          xattr: [],
        },
      },
      {
        _id: "mc-cursor-001",
        type: "Block",
        tag: "div",
        classes: ["mc-style-cursor"],
        children: [],
        data: {
          tag: "div",
          text: false,
          xattr: [{ name: "data-magnetic-cursor", value: "" }],
        },
      },
      {
        _id: "mc-demo-001",
        type: "Block",
        tag: "div",
        classes: ["mc-style-demo-container"],
        children: ["mc-button-001"],
        data: {
          tag: "div",
          text: false,
          xattr: [],
        },
      },
      {
        _id: "mc-button-001",
        type: "Link",
        tag: "a",
        classes: ["mc-style-button"],
        children: ["mc-button-text-001"],
        data: {
          button: true,
          link: { mode: "external", url: "#" },
          xattr: [
            { name: "data-magnetic", value: "" },
            { name: "data-magnetic-strength", value: "0.3" },
          ],
        },
      },
      {
        _id: "mc-button-text-001",
        text: true,
        v: "Hover Me",
      },
    ],
    styles: [
      {
        _id: "mc-style-wrapper",
        fake: false,
        type: "class",
        name: "magnetic-wrapper",
        namespace: "",
        comb: "",
        styleLess: "position: relative; min-height: 400px;",
        variants: {},
        children: [],
      },
      {
        _id: "mc-style-cursor",
        fake: false,
        type: "class",
        name: "magnetic-cursor",
        namespace: "",
        comb: "",
        styleLess:
          "position: fixed; top: 0; left: 0; width: 20px; height: 20px; background-color: #6366f1; border-radius: 50%; pointer-events: none; z-index: 9999; transform: translate(-50%, -50%); opacity: 0; transition: opacity 0.3s ease;",
        variants: {},
        children: [],
      },
      {
        _id: "mc-style-demo-container",
        fake: false,
        type: "class",
        name: "magnetic-demo",
        namespace: "",
        comb: "",
        styleLess:
          "display: flex; align-items: center; justify-content: center; min-height: 400px; padding: 60px;",
        variants: {},
        children: [],
      },
      {
        _id: "mc-style-button",
        fake: false,
        type: "class",
        name: "magnetic-button",
        namespace: "",
        comb: "",
        styleLess:
          "display: inline-flex; align-items: center; justify-content: center; padding: 16px 32px; background-color: #18181b; color: #ffffff; border-radius: 8px; font-size: 16px; font-weight: 500; text-decoration: none; transition: transform 0.15s ease-out;",
        variants: {},
        children: [],
      },
    ],
    assets: [],
    ix1: [],
    ix2: { interactions: [], events: [], actionLists: [] },
  },
  meta: {
    unlinkedSymbolCount: 0,
    droppedLinks: 0,
    dynBindRemovedCount: 0,
    dynListBindRemovedCount: 0,
    paginationRemovedCount: 0,
  },
}

const magneticCursorCodePayload = `/**
 * Magnetic Cursor Effect
 * Dependencies: gsap@3.x
 *
 * Usage:
 *   1. Include GSAP: <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
 *   2. Add data-magnetic-cursor to your cursor element
 *   3. Add data-magnetic to elements that should attract the cursor
 *   4. Optional: data-magnetic-strength="0.3" (default: 0.3, range: 0.1-1.0)
 *
 * Cleanup:
 *   Call magneticCursor.destroy() when removing the component
 */

(function() {
  const cursor = document.querySelector('[data-magnetic-cursor]');
  const magnets = document.querySelectorAll('[data-magnetic]');

  if (!cursor || !window.gsap) {
    console.warn('Magnetic Cursor: Missing cursor element or GSAP');
    return;
  }

  let mouseX = 0, mouseY = 0;
  let cursorX = 0, cursorY = 0;
  let rafId = null;

  // Show cursor on mouse enter
  document.addEventListener('mouseenter', () => {
    gsap.to(cursor, { opacity: 1, duration: 0.3 });
  });

  document.addEventListener('mouseleave', () => {
    gsap.to(cursor, { opacity: 0, duration: 0.3 });
  });

  // Track mouse position
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // Smooth cursor follow
  function animateCursor() {
    cursorX += (mouseX - cursorX) * 0.15;
    cursorY += (mouseY - cursorY) * 0.15;
    cursor.style.left = cursorX + 'px';
    cursor.style.top = cursorY + 'px';
    rafId = requestAnimationFrame(animateCursor);
  }
  animateCursor();

  // Magnetic effect for each magnet element
  magnets.forEach((magnet) => {
    const strength = parseFloat(magnet.dataset.magneticStrength) || 0.3;

    magnet.addEventListener('mouseenter', () => {
      gsap.to(cursor, { scale: 2, duration: 0.3 });
    });

    magnet.addEventListener('mouseleave', () => {
      gsap.to(cursor, { scale: 1, duration: 0.3 });
      gsap.to(magnet, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
    });

    magnet.addEventListener('mousemove', (e) => {
      const rect = magnet.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = (e.clientX - centerX) * strength;
      const deltaY = (e.clientY - centerY) * strength;
      gsap.to(magnet, { x: deltaX, y: deltaY, duration: 0.3, ease: 'power2.out' });
    });
  });

  // Expose cleanup for SPA usage
  window.magneticCursor = {
    destroy: () => {
      if (rafId) cancelAnimationFrame(rafId);
      gsap.set(cursor, { clearProps: 'all' });
      magnets.forEach(m => gsap.set(m, { clearProps: 'all' }));
    }
  };
})();
`

// Asset-specific payloads (only for assets with real implementations)
const assetPayloads: Record<
  string,
  { webflowJson: string; codePayload: string; dependencies: string[] }
> = {
  "magnetic-cursor-effect": {
    webflowJson: JSON.stringify(magneticCursorWebflowJson),
    codePayload: magneticCursorCodePayload,
    dependencies: ["gsap@3.x"],
  },
}

// ============================================================================
// DEMO ASSETS
// ============================================================================

// Demo data based on existing fakeAssets
// Preview images use placeholder service - replace with real assets in production
const demoAssets = [
  {
    slug: "magnetic-cursor-effect",
    title: "Magnetic Cursor Effect",
    category: "cursor",
    description: "A smooth magnetic cursor effect that follows interactive elements",
    tags: ["cursor", "magnetic", "interaction"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/1a1a2e/eee?text=Magnetic+Cursor",
  },
  {
    slug: "custom-cursor-trails",
    title: "Custom Cursor Trails",
    category: "cursor",
    description: "Beautiful cursor trails with customizable effects",
    tags: ["cursor", "trails", "animation"],
    isNew: false,
    previewImageUrl: "https://placehold.co/800x600/16213e/eee?text=Cursor+Trails",
  },
  {
    slug: "smooth-scroll-anchor",
    title: "Smooth Scroll Anchor",
    category: "scroll",
    description: "Smooth scrolling to anchor sections with easing",
    tags: ["scroll", "smooth", "anchor"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/0f3460/eee?text=Smooth+Scroll",
  },
  {
    slug: "parallax-scroll-sections",
    title: "Parallax Scroll Sections",
    category: "scroll",
    description: "Multi-layer parallax scrolling for immersive experiences",
    tags: ["scroll", "parallax", "sections"],
    isNew: false,
    previewImageUrl: "https://placehold.co/800x600/533483/eee?text=Parallax+Scroll",
  },
  {
    slug: "animated-cta-button",
    title: "Animated CTA Button",
    category: "buttons",
    description: "Eye-catching animated call-to-action button",
    tags: ["button", "cta", "animation"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/e94560/eee?text=CTA+Button",
  },
  {
    slug: "gradient-border-button",
    title: "Gradient Border Button",
    category: "buttons",
    description: "Button with animated gradient border effect",
    tags: ["button", "gradient", "border"],
    isNew: false,
    previewImageUrl: "https://placehold.co/800x600/ff6b6b/eee?text=Gradient+Button",
  },
  {
    slug: "mobile-nav-drawer",
    title: "Mobile Nav Drawer",
    category: "navigation",
    description: "Responsive mobile navigation drawer component",
    tags: ["navigation", "mobile", "drawer"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/4ecdc4/222?text=Nav+Drawer",
  },
  {
    slug: "mega-menu-dropdown",
    title: "Mega Menu Dropdown",
    category: "navigation",
    description: "Large dropdown menu for complex navigation structures",
    tags: ["navigation", "menu", "dropdown"],
    isNew: false,
    previewImageUrl: "https://placehold.co/800x600/45b7d1/222?text=Mega+Menu",
  },
  {
    slug: "card-hover-tilt",
    title: "Card Hover Tilt",
    category: "hover",
    description: "3D tilt effect on card hover with smooth animation",
    tags: ["hover", "card", "tilt", "3d"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/96ceb4/222?text=Card+Tilt",
  },
  {
    slug: "image-hover-zoom",
    title: "Image Hover Zoom",
    category: "hover",
    description: "Smooth zoom effect on image hover",
    tags: ["hover", "image", "zoom"],
    isNew: false,
    previewImageUrl: "https://placehold.co/800x600/ffeaa7/222?text=Hover+Zoom",
  },
  {
    slug: "video-background-hero",
    title: "Video Background Hero",
    category: "media",
    description: "Full-screen video background for hero sections",
    tags: ["video", "background", "hero"],
    isNew: true,
    previewVideoUrl: "https://placehold.co/800x600/dfe6e9/222?text=Video+Hero",
  },
  {
    slug: "image-gallery-lightbox",
    title: "Image Gallery Lightbox",
    category: "media",
    description: "Interactive image gallery with lightbox modal",
    tags: ["gallery", "lightbox", "images"],
    isNew: false,
    previewImageUrl: "https://placehold.co/800x600/b2bec3/222?text=Gallery",
  },
  {
    slug: "animated-text-reveal",
    title: "Animated Text Reveal",
    category: "typography",
    description: "Text reveal animation with various effects",
    tags: ["text", "animation", "reveal"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/636e72/eee?text=Text+Reveal",
  },
  {
    slug: "gradient-text-effect",
    title: "Gradient Text Effect",
    category: "typography",
    description: "Animated gradient text with CSS effects",
    tags: ["text", "gradient", "effect"],
    isNew: false,
    previewImageUrl: "https://placehold.co/800x600/2d3436/eee?text=Gradient+Text",
  },
  {
    slug: "copy-to-clipboard",
    title: "Copy to Clipboard",
    category: "utilities",
    description: "One-click copy to clipboard utility",
    tags: ["clipboard", "copy", "utility"],
    isNew: false,
    previewImageUrl: "https://placehold.co/800x600/00b894/eee?text=Clipboard",
  },
  {
    slug: "dark-mode-toggle",
    title: "Dark Mode Toggle",
    category: "utilities",
    description: "Smooth dark mode toggle with system preference detection",
    tags: ["dark-mode", "toggle", "theme"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/6c5ce7/eee?text=Dark+Mode",
  },
  {
    slug: "hero-split-section",
    title: "Hero Split Section",
    category: "sections",
    description: "Split-screen hero section layout",
    tags: ["hero", "section", "layout"],
    isNew: false,
    previewImageUrl: "https://placehold.co/800x600/a29bfe/222?text=Hero+Split",
  },
  {
    slug: "testimonial-carousel",
    title: "Testimonial Carousel",
    category: "sections",
    description: "Responsive testimonial carousel with auto-play",
    tags: ["testimonial", "carousel", "section"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/fd79a8/222?text=Testimonials",
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
        previewImageUrl: "previewImageUrl" in asset ? asset.previewImageUrl : undefined,
        previewVideoUrl: "previewVideoUrl" in asset ? asset.previewVideoUrl : undefined,
        createdAt: now,
        updatedAt: now,
      })
      results.assets++

      // Create payload - use real payload if available, otherwise placeholder
      const realPayload = assetPayloads[asset.slug]
      await ctx.db.insert("payloads", {
        assetId,
        webflowJson: realPayload?.webflowJson ?? JSON.stringify({ placeholder: true }),
        codePayload: realPayload?.codePayload ?? `// ${asset.title}\n// TODO: Add implementation`,
        dependencies: realPayload?.dependencies ?? [],
        createdAt: now,
        updatedAt: now,
      })
      results.payloads++
    }

    return results
  },
})

import { mutation } from "./_generated/server"
import { requireAdmin } from "./auth"

// ============================================================================
// FLOW PARTY DESIGN TOKENS
// ============================================================================

// Design Tokens - Webflow Variables Setup
// This creates CSS custom properties that all Flow Party components reference
const fpDesignTokensWebflowJson = {
  type: "@webflow/XscpData",
  payload: {
    nodes: [],
    styles: [
      // Root variables container - applied to body or html
      {
        _id: "fp-root",
        fake: false,
        type: "class",
        name: "fp-root",
        namespace: "",
        comb: "",
        styleLess: `
          --dark-bg: #2d2f2e;
          --dark-secondary: #434645;
          --light-bg: #f5f5f5;
          --card-bg: #ffffff;
          --text-light: #ffffff;
          --text-dark: #171717;
          --text-muted: #afb6b4;
          --text-muted-dark: #767f7a;
          --border: #dddfde;
          --coral-lightest: #fff0eb;
          --coral-light: #ffc8b8;
          --coral-medium: #ff9d80;
          --coral-strong: #ff531f;
          --coral-vivid: #ff825c;
          --radius-sm: 24px;
          --radius-md: 32px;
          --radius-lg: 40px;
          --radius-xl: 48px;
          --radius-pill: 9999px;
          --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          --font-logo: 'Antonio', sans-serif;
        `.replace(/\s+/g, ' ').trim(),
        variants: {},
        children: [],
      },
    ],
    assets: [],
    ix1: [],
    ix2: { interactions: [], events: [], actionLists: [] },
  },
  meta: { unlinkedSymbolCount: 0, droppedLinks: 0, dynBindRemovedCount: 0, dynListBindRemovedCount: 0, paginationRemovedCount: 0 },
}

const fpDesignTokensCodePayload = `/**
 * Flow Party Design Tokens
 * Paste into Site Settings > Custom Code (Head).
 */

<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Antonio:wght@700&display=swap" rel="stylesheet">

<style>
/* ============================================
   DESIGN TOKENS - Flow Party
   Copy this entire block to each section file
   ============================================ */
:root {
    /* Dark Palette */
    --dark-bg: #2d2f2e;
    --dark-secondary: #434645;
    --text-light: #ffffff;
    --text-muted-dark: #767f7a;

    /* Light Palette */
    --light-bg: #f5f5f5;
    --card-bg: #ffffff;
    --text-dark: #171717;
    --text-muted: #afb6b4;
    --border: #dddfde;

    /* Coral Gradient Scale */
    --coral-lightest: #fff0eb;
    --coral-light: #ffc8b8;
    --coral-medium: #ff9d80;
    --coral-strong: #ff531f;
    --coral-vivid: #ff825c;

    /* Border Radius */
    --radius-sm: 24px;
    --radius-md: 32px;
    --radius-lg: 40px;
    --radius-xl: 48px;
    --radius-pill: 9999px;

    /* Typography */
    --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    --font-logo: 'Antonio', sans-serif;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: var(--font-body);
    line-height: 1.5;
    overflow-x: hidden;
}

img {
    max-width: 100%;
    height: auto;
}

/* ============================================
   SHARED COMPONENTS
   Include if section uses these elements
   ============================================ */

/* Primary Button */
.btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--coral-strong);
    color: var(--text-light);
    padding: 0.875rem 1.75rem;
    border-radius: var(--radius-pill);
    text-decoration: none;
    font-weight: 600;
    font-size: 0.9rem;
    border: none;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.btn-primary:hover {
    background: #e64a1a;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(255, 83, 31, 0.3);
}

.btn-arrow {
    transition: transform 0.2s ease;
}

.btn-primary:hover .btn-arrow {
    transform: translateX(3px);
}

/* Secondary Button */
.btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: transparent;
    color: var(--text-light);
    padding: 0.875rem 1.75rem;
    border-radius: var(--radius-pill);
    text-decoration: none;
    font-weight: 600;
    font-size: 0.9rem;
    border: 1px solid rgba(255, 255, 255, 0.25);
    cursor: pointer;
    transition: border-color 0.2s ease, background 0.2s ease;
}

.btn-secondary:hover {
    border-color: rgba(255, 255, 255, 0.5);
    background: rgba(255, 255, 255, 0.05);
}

/* Link Arrow */
.link-arrow {
    color: var(--coral-strong);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    transition: gap 0.2s ease;
}

.link-arrow:hover {
    gap: 0.75rem;
}
</style>`

// ============================================================================
// FLOW PARTY SECTIONS - WEBFLOW JSON PAYLOADS
// ============================================================================

// Navigation Section
const fpNavWebflowJson = {
  type: "@webflow/XscpData",
  payload: {
    nodes: [
      {
        _id: "fp-nav-001",
        type: "Block",
        tag: "nav",
        classes: ["fp-nav"],
        children: ["fp-logo-001", "fp-nav-links-001", "fp-nav-right-001"],
        data: { tag: "nav", text: false, xattr: [{ name: "id", value: "nav" }] },
      },
      {
        _id: "fp-logo-001",
        type: "Link",
        tag: "a",
        classes: ["fp-logo"],
        children: ["fp-logo-text-001"],
        data: { link: { mode: "external", url: "#" } },
      },
      {
        _id: "fp-logo-text-001",
        text: true,
        v: "FLOWPARTY™",
      },
      {
        _id: "fp-nav-links-001",
        type: "Block",
        tag: "div",
        classes: ["fp-nav-links"],
        children: ["fp-nav-link-1", "fp-nav-link-2", "fp-nav-link-3", "fp-nav-link-4"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-nav-link-1", type: "Link", tag: "a", classes: ["fp-nav-link"], children: ["fp-nav-link-1-text"], data: { link: { mode: "external", url: "#stash" } } },
      { _id: "fp-nav-link-1-text", text: true, v: "The Stash" },
      { _id: "fp-nav-link-2", type: "Link", tag: "a", classes: ["fp-nav-link"], children: ["fp-nav-link-2-text"], data: { link: { mode: "external", url: "#packs" } } },
      { _id: "fp-nav-link-2-text", text: true, v: "Party Packs" },
      { _id: "fp-nav-link-3", type: "Link", tag: "a", classes: ["fp-nav-link"], children: ["fp-nav-link-3-text"], data: { link: { mode: "external", url: "#collaborators" } } },
      { _id: "fp-nav-link-3-text", text: true, v: "Collaborators" },
      { _id: "fp-nav-link-4", type: "Link", tag: "a", classes: ["fp-nav-link"], children: ["fp-nav-link-4-text"], data: { link: { mode: "external", url: "#pricing" } } },
      { _id: "fp-nav-link-4-text", text: true, v: "Pricing" },
      {
        _id: "fp-nav-right-001",
        type: "Block",
        tag: "div",
        classes: ["fp-nav-right"],
        children: ["fp-nav-login-001", "fp-nav-cta-001"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-nav-login-001", type: "Link", tag: "a", classes: ["fp-nav-link-secondary"], children: ["fp-nav-login-text"], data: { link: { mode: "external", url: "#login" } } },
      { _id: "fp-nav-login-text", text: true, v: "Log in" },
      { _id: "fp-nav-cta-001", type: "Link", tag: "a", classes: ["fp-btn-primary"], children: ["fp-nav-cta-text", "fp-nav-cta-arrow"], data: { link: { mode: "external", url: "#signup" } } },
      { _id: "fp-nav-cta-text", text: true, v: "Get Started " },
      { _id: "fp-nav-cta-arrow", type: "Block", tag: "span", classes: ["fp-btn-arrow"], children: ["fp-nav-cta-arrow-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-nav-cta-arrow-text", text: true, v: "→" },
    ],
    styles: [
      { _id: "fp-nav", fake: false, type: "class", name: "fp-nav", namespace: "", comb: "", styleLess: "position: fixed; top: 0px; left: 0px; right: 0px; z-index: 1000; padding-top: 1.25rem; padding-bottom: 1.25rem; padding-left: 5vw; padding-right: 5vw; display: flex; justify-content: space-between; align-items: center; transition: background 0.3s ease, padding 0.3s ease;", variants: {}, children: [] },
      { _id: "fp-logo", fake: false, type: "class", name: "fp-logo", namespace: "", comb: "", styleLess: "font-family: 'Antonio', sans-serif; font-size: 1.35rem; font-weight: 700; color: #ffffff; text-decoration: none; text-transform: uppercase; letter-spacing: 0.02em;", variants: {}, children: [] },
      { _id: "fp-nav-links", fake: false, type: "class", name: "fp-nav-links", namespace: "", comb: "", styleLess: "display: flex; gap: 2rem; align-items: center;", variants: {}, children: [] },
      { _id: "fp-nav-link", fake: false, type: "class", name: "fp-nav-link", namespace: "", comb: "", styleLess: "color: #ffffff; text-decoration: none; font-weight: 500; font-size: 0.9rem; opacity: 0.85; transition: opacity 0.2s ease;", variants: { hover: { styleLess: "opacity: 1;" } }, children: [] },
      { _id: "fp-nav-right", fake: false, type: "class", name: "fp-nav-right", namespace: "", comb: "", styleLess: "display: flex; align-items: center; gap: 1.5rem;", variants: {}, children: [] },
      { _id: "fp-nav-link-secondary", fake: false, type: "class", name: "fp-nav-link-secondary", namespace: "", comb: "", styleLess: "color: #ffffff; text-decoration: none; font-weight: 500; font-size: 0.9rem; opacity: 0.85; transition: opacity 0.2s ease;", variants: { hover: { styleLess: "opacity: 1;" } }, children: [] },
      { _id: "fp-btn-primary", fake: false, type: "class", name: "fp-btn-primary", namespace: "", comb: "", styleLess: "display: inline-flex; align-items: center; gap: 0.5rem; background-color: #ff531f; color: #ffffff; padding-top: 0.75rem; padding-bottom: 0.75rem; padding-left: 1.5rem; padding-right: 1.5rem; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 0.875rem; border: none; cursor: pointer; transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;", variants: { hover: { styleLess: "background-color: #e64a1a; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(255, 83, 31, 0.3);" } }, children: [] },
      { _id: "fp-btn-arrow", fake: false, type: "class", name: "fp-btn-arrow", namespace: "", comb: "", styleLess: "transition: transform 0.2s ease;", variants: {}, children: [] },
    ],
    assets: [],
    ix1: [],
    ix2: { interactions: [], events: [], actionLists: [] },
  },
  meta: { unlinkedSymbolCount: 0, droppedLinks: 0, dynBindRemovedCount: 0, dynListBindRemovedCount: 0, paginationRemovedCount: 0 },
}

const fpNavCodePayload = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Party - Creative Development Marketplace</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Antonio:wght@700&display=swap" rel="stylesheet">
    <style>
        /* ============================================
           DESIGN TOKENS - Flow Party
           ============================================ */
        :root {
            /* Dark Palette */
            --dark-bg: #2d2f2e;
            --dark-secondary: #434645;
            --text-light: #ffffff;
            --text-muted-dark: #767f7a;
            
            /* Light Palette */
            --light-bg: #f5f5f5;
            --card-bg: #ffffff;
            --text-dark: #171717;
            --text-muted: #afb6b4;
            --border: #dddfde;
            
            /* Coral Gradient Scale */
            --coral-lightest: #fff0eb;
            --coral-light: #ffc8b8;
            --coral-medium: #ff9d80;
            --coral-strong: #ff531f;
            --coral-vivid: #ff825c;
            
            /* Border Radius */
            --radius-sm: 24px;
            --radius-md: 32px;
            --radius-lg: 40px;
            --radius-xl: 48px;
            --radius-pill: 9999px;
            
            /* Typography */
            --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            --font-logo: 'Antonio', sans-serif;
        }
        
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }
        
        body {
            font-family: var(--font-body);
            background: var(--dark-bg);
            color: var(--text-dark);
            line-height: 1.5;
            overflow-x: hidden;
        }
        
        /* ============================================
           ANIMATIONS
           ============================================ */
        @keyframes fadeUp {
            from { 
                opacity: 0; 
                transform: translateY(30px) scale(0.96); 
            }
            to { 
                opacity: 1; 
                transform: translateY(0) scale(1); 
            }
        }
        
        @keyframes slideFromLeft {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
        }
        
        @keyframes slideFromBottom {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
        }
        
        .animate-fade-up {
            animation: fadeUp 0.6s cubic-bezier(0.93, 0.03, 0.56, 1) forwards;
        }
        
        .delay-1 { animation-delay: 0.2s; opacity: 0; }
        .delay-2 { animation-delay: 0.4s; opacity: 0; }
        .delay-3 { animation-delay: 0.6s; opacity: 0; }
        
        /* ============================================
           NAVIGATION
           ============================================ */
        .nav {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            padding: 1.25rem 5vw;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.3s ease, padding 0.3s ease;
        }
        
        /* Scroll state - add via JS or use :has() for modern browsers */
        .nav.scrolled,
        body:has(.hero:not(:hover)) .nav {
            background: rgba(45, 47, 46, 0.95);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            padding: 1rem 5vw;
        }
        
        .logo {
            font-family: var(--font-logo);
            font-size: 1.35rem;
            font-weight: 700;
            color: var(--text-light);
            text-decoration: none;
            text-transform: uppercase;
            letter-spacing: 0.02em;
            display: flex;
            align-items: baseline;
            gap: 0.15rem;
        }
        
        .logo-accent {
            color: var(--coral-strong);
        }
        
        .logo-tm { 
            font-size: 0.55rem; 
            vertical-align: super;
            opacity: 0.6;
        }
        
        .nav-center {
            display: flex;
            gap: 2.5rem;
        }
        
        .nav-links {
            display: flex;
            gap: 2rem;
            align-items: center;
        }
        
        .nav-links a {
            color: var(--text-light);
            text-decoration: none;
            font-weight: 500;
            font-size: 0.9rem;
            opacity: 0.85;
            transition: opacity 0.2s ease, color 0.2s ease;
            position: relative;
        }
        
        .nav-links a::after {
            content: '';
            position: absolute;
            bottom: -4px;
            left: 0;
            width: 0;
            height: 2px;
            background: var(--coral-strong);
            transition: width 0.3s ease;
        }
        
        .nav-links a:hover { 
            opacity: 1; 
        }
        
        .nav-links a:hover::after {
            width: 100%;
        }
        
        .nav-right {
            display: flex;
            align-items: center;
            gap: 1.5rem;
        }
        
        .nav-link-secondary {
            color: var(--text-light);
            text-decoration: none;
            font-weight: 500;
            font-size: 0.9rem;
            opacity: 0.85;
            transition: opacity 0.2s ease;
        }
        
        .nav-link-secondary:hover {
            opacity: 1;
        }
        
        .btn-primary {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: var(--coral-strong);
            color: var(--text-light);
            padding: 0.75rem 1.5rem;
            border-radius: var(--radius-pill);
            text-decoration: none;
            font-weight: 600;
            font-size: 0.875rem;
            border: none;
            cursor: pointer;
            transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .btn-primary:hover {
            background: #e64a1a;
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(255, 83, 31, 0.3);
        }
        
        .btn-arrow {
            transition: transform 0.2s ease;
        }
        
        .btn-primary:hover .btn-arrow {
            transform: translateX(3px);
        }
        
        /* Mobile Menu Toggle */
        .menu-toggle {
            display: none;
            background: none;
            border: none;
            color: var(--text-light);
            cursor: pointer;
            padding: 0.5rem;
            z-index: 1001;
        }
        
        .menu-toggle span {
            display: block;
            width: 24px;
            height: 2px;
            background: currentColor;
            margin: 6px 0;
            transition: transform 0.3s ease, opacity 0.3s ease;
        }
        
        /* Mobile Menu - CSS Only with checkbox hack */
        .menu-state {
            display: none;
        }
        
        .mobile-menu {
            display: none;
        }
        
        /* ============================================
           HERO SECTION
           ============================================ */
        .hero {
            min-height: 100vh;
            background: var(--dark-bg);
            padding: 8rem 5vw 6rem;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        
        .hero-watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-family: var(--font-logo);
            font-size: clamp(8rem, 20vw, 16rem);
            font-weight: 700;
            color: var(--dark-secondary);
            opacity: 0.4;
            pointer-events: none;
            white-space: nowrap;
            text-transform: uppercase;
            animation: slideFromLeft 1.4s cubic-bezier(1, -0.13, 0.18, 0.96) forwards;
        }
        
        .hero-content {
            position: relative;
            z-index: 1;
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        
        .hero-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4rem;
            align-items: center;
        }
        
        .hero-text {
            max-width: 560px;
        }
        
        .hero-label {
            display: inline-flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1.5rem;
        }
        
        .hero-label-line {
            width: 40px;
            height: 1px;
            background: var(--coral-strong);
        }
        
        .hero-label-text {
            font-size: 0.8rem;
            font-weight: 600;
            color: var(--coral-strong);
            text-transform: uppercase;
            letter-spacing: 0.1em;
        }
        
        .hero-headline {
            font-size: clamp(2.5rem, 5vw, 4rem);
            font-weight: 700;
            color: var(--text-light);
            line-height: 1.1;
            margin-bottom: 1.5rem;
        }
        
        .hero-headline-accent {
            color: var(--coral-strong);
        }
        
        .hero-description {
            font-size: 1.1rem;
            color: var(--text-muted-dark);
            margin-bottom: 2rem;
            line-height: 1.6;
            max-width: 480px;
        }
        
        .hero-ctas {
            display: flex;
            gap: 1rem;
            align-items: center;
            flex-wrap: wrap;
        }
        
        .btn-secondary {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: transparent;
            color: var(--text-light);
            padding: 0.75rem 1.5rem;
            border-radius: var(--radius-pill);
            text-decoration: none;
            font-weight: 600;
            font-size: 0.875rem;
            border: 1px solid rgba(255, 255, 255, 0.25);
            cursor: pointer;
            transition: border-color 0.2s ease, background 0.2s ease;
        }
        
        .btn-secondary:hover {
            border-color: rgba(255, 255, 255, 0.5);
            background: rgba(255, 255, 255, 0.05);
        }
        
        .hero-image-wrapper {
            position: relative;
            display: flex;
            justify-content: center;
        }
        
        .hero-image {
            position: relative;
            width: 100%;
            max-width: 480px;
            border-radius: var(--radius-md);
            overflow: hidden;
            box-shadow: 0 40px 80px rgba(0, 0, 0, 0.4);
            animation: slideFromBottom 0.9s cubic-bezier(1, -0.13, 0.18, 0.96) 0.5s forwards;
            transform: translateY(100%);
        }
        
        .hero-image img {
            width: 100%;
            height: auto;
            display: block;
            aspect-ratio: 4/5;
            object-fit: cover;
            transition: transform 0.6s ease;
        }
        
        .hero-image:hover img { 
            transform: scale(1.03); 
        }
        
        .hero-image-badge {
            position: absolute;
            bottom: 1.5rem;
            left: 1.5rem;
            background: rgba(45, 47, 46, 0.9);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            padding: 1rem 1.25rem;
            border-radius: var(--radius-sm);
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }
        
        .hero-badge-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--text-light);
        }
        
        .hero-badge-label {
            font-size: 0.75rem;
            color: var(--text-muted-dark);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        /* Services List in Hero */
        .hero-services {
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .hero-services-list {
            display: flex;
            gap: 2rem;
            flex-wrap: wrap;
        }
        
        .hero-service-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--text-muted-dark);
            font-size: 0.875rem;
            font-weight: 500;
        }
        
        .hero-service-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--coral-strong);
        }
        
        /* ============================================
           RESPONSIVE
           ============================================ */
        @media (max-width: 1024px) {
            .hero-grid {
                grid-template-columns: 1fr;
                gap: 3rem;
                text-align: center;
            }
            
            .hero-text {
                max-width: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            
            .hero-description {
                max-width: 560px;
            }
            
            .hero-image-wrapper {
                order: -1;
            }
            
            .hero-image {
                max-width: 380px;
            }
            
            .hero-services-list {
                justify-content: center;
            }
        }
        
        @media (max-width: 768px) {
            .nav-links,
            .nav-link-secondary {
                display: none;
            }
            
            .menu-toggle {
                display: block;
            }
            
            /* Mobile Menu Styles */
            .mobile-menu {
                display: block;
                position: fixed;
                top: 0;
                right: -100%;
                width: 80%;
                max-width: 320px;
                height: 100vh;
                background: var(--dark-bg);
                padding: 6rem 2rem 2rem;
                transition: right 0.3s ease;
                z-index: 999;
                border-left: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .menu-state:checked ~ .mobile-menu {
                right: 0;
            }
            
            .menu-state:checked ~ .nav .menu-toggle span:nth-child(1) {
                transform: rotate(45deg) translate(6px, 6px);
            }
            
            .menu-state:checked ~ .nav .menu-toggle span:nth-child(2) {
                opacity: 0;
            }
            
            .menu-state:checked ~ .nav .menu-toggle span:nth-child(3) {
                transform: rotate(-45deg) translate(6px, -6px);
            }
            
            .mobile-menu-links {
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
            }
            
            .mobile-menu-links a {
                color: var(--text-light);
                text-decoration: none;
                font-size: 1.25rem;
                font-weight: 500;
                transition: color 0.2s ease;
            }
            
            .mobile-menu-links a:hover {
                color: var(--coral-strong);
            }
            
            .mobile-menu-cta {
                margin-top: 2rem;
            }
            
            .menu-overlay {
                display: none;
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 998;
            }
            
            .menu-state:checked ~ .menu-overlay {
                display: block;
            }
            
            .hero {
                padding: 7rem 5vw 4rem;
            }
            
            .hero-headline {
                font-size: clamp(2rem, 8vw, 3rem);
            }
            
            .hero-image {
                max-width: 280px;
            }
            
            .hero-services-list {
                flex-direction: column;
                gap: 1rem;
                align-items: center;
            }
            
            .hero-ctas {
                flex-direction: column;
                width: 100%;
            }
            
            .hero-ctas .btn-primary,
            .hero-ctas .btn-secondary {
                width: 100%;
                justify-content: center;
            }
        }
        
        @media (max-width: 480px) {
            .nav {
                padding: 1rem 4vw;
            }
            
            .logo {
                font-size: 1.15rem;
            }
            
            .hero-watermark {
                font-size: 5rem;
            }
        }
    </style>
</head>
<body>
    <!-- Mobile Menu State (CSS-only toggle) -->
    <input type="checkbox" id="menu-state" class="menu-state">
    
    <!-- Mobile Menu Overlay -->
    <label for="menu-state" class="menu-overlay"></label>
    
    <!-- Mobile Menu Panel -->
    <nav class="mobile-menu">
        <div class="mobile-menu-links">
            <a href="#stash">The Stash</a>
            <a href="#templates">Templates</a>
            <a href="#components">Components</a>
            <a href="#collaborators">Collaborators</a>
            <a href="#pricing">Pricing</a>
            <a href="#login">Log in</a>
        </div>
        <div class="mobile-menu-cta">
            <a href="#signup" class="btn-primary">
                Get Started
                <span class="btn-arrow">→</span>
            </a>
        </div>
    </nav>
    
    <!-- Navigation -->
    <nav class="nav" id="nav">
        <a href="#" class="logo">
            FLOW<span class="logo-accent">PARTY</span><span class="logo-tm">™</span>
        </a>
        
        <div class="nav-links">
            <a href="#stash">The Stash</a>
            <a href="#templates">Templates</a>
            <a href="#components">Components</a>
            <a href="#collaborators">Collaborators</a>
            <a href="#pricing">Pricing</a>
        </div>
        
        <div class="nav-right">
            <a href="#login" class="nav-link-secondary">Log in</a>
            <a href="#signup" class="btn-primary">
                Get Started
                <span class="btn-arrow">→</span>
            </a>
            <label for="menu-state" class="menu-toggle">
                <span></span>
                <span></span>
                <span></span>
            </label>
        </div>
    </nav>
    
    <!-- Hero Section -->
    <section class="hero">
        <div class="hero-watermark">FLOWPARTY</div>
        
        <div class="hero-content">
            <div class="hero-grid">
                <div class="hero-text animate-fade-up delay-1">
                    <div class="hero-label">
                        <span class="hero-label-line"></span>
                        <span class="hero-label-text">Premium Asset Library</span>
                    </div>
                    
                    <h1 class="hero-headline">
                        Ship faster with<br>
                        <span class="hero-headline-accent">complete launch kits</span>
                    </h1>
                    
                    <p class="hero-description">
                        The premium Webflow marketplace for creative developers. 
                        Templates, components, and complete Party Packs to help you 
                        launch polished sites in record time.
                    </p>
                    
                    <div class="hero-ctas">
                        <a href="#explore" class="btn-primary">
                            Explore The Stash
                            <span class="btn-arrow">→</span>
                        </a>
                        <a href="#demo" class="btn-secondary">
                            Watch Demo
                        </a>
                    </div>
                    
                    <div class="hero-services">
                        <div class="hero-services-list">
                            <div class="hero-service-item">
                                <span class="hero-service-dot"></span>
                                <span>Full Templates</span>
                            </div>
                            <div class="hero-service-item">
                                <span class="hero-service-dot"></span>
                                <span>UI Components</span>
                            </div>
                            <div class="hero-service-item">
                                <span class="hero-service-dot"></span>
                                <span>Figma Files</span>
                            </div>
                            <div class="hero-service-item">
                                <span class="hero-service-dot"></span>
                                <span>Launch Guides</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="hero-image-wrapper animate-fade-up delay-2">
                    <div class="hero-image">
                        <img 
                            src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&h=1000&fit=crop&q=80" 
                            alt="Abstract gradient design showcasing creative development"
                        >
                        <div class="hero-image-badge">
                            <span class="hero-badge-value">140+</span>
                            <span class="hero-badge-label">Premium Resources</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
    
    <!-- Minimal JS for scroll effect (optional - can remove for pure CSS) -->
    <script>
        // Navigation scroll effect
        const nav = document.getElementById('nav');
        let lastScroll = 0;
        
        window.addEventListener('scroll', () => {
            const currentScroll = window.scrollY;
            
            if (currentScroll > 50) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
            
            lastScroll = currentScroll;
        }, { passive: true });
        
        // Close mobile menu when clicking links
        document.querySelectorAll('.mobile-menu a').forEach(link => {
            link.addEventListener('click', () => {
                document.getElementById('menu-state').checked = false;
            });
        });
    </script>
</body>
</html>`

// Hero Section
const fpHeroWebflowJson = {
  type: "@webflow/XscpData",
  payload: {
    nodes: [
      {
        _id: "fp-hero-001",
        type: "Block",
        tag: "section",
        classes: ["fp-hero"],
        children: ["fp-hero-watermark", "fp-hero-content"],
        data: { tag: "section", text: false, xattr: [] },
      },
      {
        _id: "fp-hero-watermark",
        type: "Block",
        tag: "div",
        classes: ["fp-hero-watermark"],
        children: ["fp-hero-watermark-text"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-hero-watermark-text", text: true, v: "FLOWPARTY" },
      {
        _id: "fp-hero-content",
        type: "Block",
        tag: "div",
        classes: ["fp-hero-content"],
        children: ["fp-hero-grid"],
        data: { tag: "div", text: false, xattr: [] },
      },
      {
        _id: "fp-hero-grid",
        type: "Block",
        tag: "div",
        classes: ["fp-hero-grid"],
        children: ["fp-hero-text", "fp-hero-image-wrapper"],
        data: { tag: "div", text: false, xattr: [] },
      },
      {
        _id: "fp-hero-text",
        type: "Block",
        tag: "div",
        classes: ["fp-hero-text"],
        children: ["fp-hero-label", "fp-hero-headline", "fp-hero-desc", "fp-hero-ctas", "fp-hero-services"],
        data: { tag: "div", text: false, xattr: [] },
      },
      {
        _id: "fp-hero-label",
        type: "Block",
        tag: "div",
        classes: ["fp-hero-label"],
        children: ["fp-hero-label-line", "fp-hero-label-text"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-hero-label-line", type: "Block", tag: "span", classes: ["fp-hero-label-line"], children: [], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-hero-label-text", type: "Block", tag: "span", classes: ["fp-hero-label-text"], children: ["fp-hero-label-text-v"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-hero-label-text-v", text: true, v: "Premium Asset Library" },
      {
        _id: "fp-hero-headline",
        type: "Heading",
        tag: "h1",
        classes: ["fp-hero-headline"],
        children: ["fp-hero-headline-1", "fp-hero-headline-accent"],
        data: { tag: "h1", text: false, xattr: [] },
      },
      { _id: "fp-hero-headline-1", text: true, v: "Ship faster with " },
      { _id: "fp-hero-headline-accent", type: "Block", tag: "span", classes: ["fp-hero-headline-accent"], children: ["fp-hero-headline-accent-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-hero-headline-accent-text", text: true, v: "complete launch kits" },
      {
        _id: "fp-hero-desc",
        type: "Paragraph",
        tag: "p",
        classes: ["fp-hero-description"],
        children: ["fp-hero-desc-text"],
        data: { tag: "p", text: false, xattr: [] },
      },
      { _id: "fp-hero-desc-text", text: true, v: "The premium Webflow marketplace for creative developers. Templates, components, and complete Party Packs to help you launch polished sites in record time." },
      {
        _id: "fp-hero-ctas",
        type: "Block",
        tag: "div",
        classes: ["fp-hero-ctas"],
        children: ["fp-hero-cta-primary", "fp-hero-cta-secondary"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-hero-cta-primary", type: "Link", tag: "a", classes: ["fp-btn-primary"], children: ["fp-hero-cta-primary-text", "fp-hero-cta-primary-arrow"], data: { link: { mode: "external", url: "#stash" } } },
      { _id: "fp-hero-cta-primary-text", text: true, v: "Explore The Stash " },
      { _id: "fp-hero-cta-primary-arrow", type: "Block", tag: "span", classes: ["fp-btn-arrow"], children: ["fp-hero-cta-primary-arrow-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-hero-cta-primary-arrow-text", text: true, v: "→" },
      { _id: "fp-hero-cta-secondary", type: "Link", tag: "a", classes: ["fp-btn-secondary"], children: ["fp-hero-cta-secondary-text"], data: { link: { mode: "external", url: "#demo" } } },
      { _id: "fp-hero-cta-secondary-text", text: true, v: "Watch Demo" },
      {
        _id: "fp-hero-services",
        type: "Block",
        tag: "div",
        classes: ["fp-hero-services"],
        children: ["fp-hero-services-list"],
        data: { tag: "div", text: false, xattr: [] },
      },
      {
        _id: "fp-hero-services-list",
        type: "Block",
        tag: "div",
        classes: ["fp-hero-services-list"],
        children: ["fp-hero-service-1", "fp-hero-service-2", "fp-hero-service-3", "fp-hero-service-4"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-hero-service-1", type: "Block", tag: "div", classes: ["fp-hero-service-item"], children: ["fp-hero-service-1-dot", "fp-hero-service-1-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-hero-service-1-dot", type: "Block", tag: "span", classes: ["fp-hero-service-dot"], children: [], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-hero-service-1-text", type: "Block", tag: "span", classes: [], children: ["fp-hero-service-1-text-v"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-hero-service-1-text-v", text: true, v: "Full Templates" },
      { _id: "fp-hero-service-2", type: "Block", tag: "div", classes: ["fp-hero-service-item"], children: ["fp-hero-service-2-dot", "fp-hero-service-2-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-hero-service-2-dot", type: "Block", tag: "span", classes: ["fp-hero-service-dot"], children: [], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-hero-service-2-text", type: "Block", tag: "span", classes: [], children: ["fp-hero-service-2-text-v"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-hero-service-2-text-v", text: true, v: "UI Components" },
      { _id: "fp-hero-service-3", type: "Block", tag: "div", classes: ["fp-hero-service-item"], children: ["fp-hero-service-3-dot", "fp-hero-service-3-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-hero-service-3-dot", type: "Block", tag: "span", classes: ["fp-hero-service-dot"], children: [], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-hero-service-3-text", type: "Block", tag: "span", classes: [], children: ["fp-hero-service-3-text-v"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-hero-service-3-text-v", text: true, v: "Figma Files" },
      { _id: "fp-hero-service-4", type: "Block", tag: "div", classes: ["fp-hero-service-item"], children: ["fp-hero-service-4-dot", "fp-hero-service-4-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-hero-service-4-dot", type: "Block", tag: "span", classes: ["fp-hero-service-dot"], children: [], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-hero-service-4-text", type: "Block", tag: "span", classes: [], children: ["fp-hero-service-4-text-v"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-hero-service-4-text-v", text: true, v: "Launch Guides" },
      {
        _id: "fp-hero-image-wrapper",
        type: "Block",
        tag: "div",
        classes: ["fp-hero-image-wrapper"],
        children: ["fp-hero-image"],
        data: { tag: "div", text: false, xattr: [] },
      },
      {
        _id: "fp-hero-image",
        type: "Block",
        tag: "div",
        classes: ["fp-hero-image"],
        children: ["fp-hero-image-badge"],
        data: { tag: "div", text: false, xattr: [] },
      },
      {
        _id: "fp-hero-image-badge",
        type: "Block",
        tag: "div",
        classes: ["fp-hero-image-badge"],
        children: ["fp-hero-badge-value", "fp-hero-badge-label"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-hero-badge-value", type: "Block", tag: "span", classes: ["fp-hero-badge-value"], children: ["fp-hero-badge-value-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-hero-badge-value-text", text: true, v: "140+" },
      { _id: "fp-hero-badge-label", type: "Block", tag: "span", classes: ["fp-hero-badge-label"], children: ["fp-hero-badge-label-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-hero-badge-label-text", text: true, v: "Premium Resources" },
    ],
    styles: [
      { _id: "fp-hero", fake: false, type: "class", name: "fp-hero", namespace: "", comb: "", styleLess: "min-height: 100vh; background-color: #2d2f2e; padding-top: 8rem; padding-bottom: 6rem; padding-left: 5vw; padding-right: 5vw; position: relative; overflow: hidden; display: flex; flex-direction: column;", variants: {}, children: [] },
      { _id: "fp-hero-watermark", fake: false, type: "class", name: "fp-hero-watermark", namespace: "", comb: "", styleLess: "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-family: 'Antonio', sans-serif; font-size: 16rem; font-weight: 700; color: #434645; opacity: 0.4; pointer-events: none; white-space: nowrap; text-transform: uppercase;", variants: {}, children: [] },
      { _id: "fp-hero-content", fake: false, type: "class", name: "fp-hero-content", namespace: "", comb: "", styleLess: "position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; justify-content: center;", variants: {}, children: [] },
      { _id: "fp-hero-grid", fake: false, type: "class", name: "fp-hero-grid", namespace: "", comb: "", styleLess: "display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center;", variants: {}, children: [] },
      { _id: "fp-hero-text", fake: false, type: "class", name: "fp-hero-text", namespace: "", comb: "", styleLess: "max-width: 560px;", variants: {}, children: [] },
      { _id: "fp-hero-label", fake: false, type: "class", name: "fp-hero-label", namespace: "", comb: "", styleLess: "display: inline-flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;", variants: {}, children: [] },
      { _id: "fp-hero-label-line", fake: false, type: "class", name: "fp-hero-label-line", namespace: "", comb: "", styleLess: "width: 40px; height: 1px; background-color: #ff531f;", variants: {}, children: [] },
      { _id: "fp-hero-label-text", fake: false, type: "class", name: "fp-hero-label-text", namespace: "", comb: "", styleLess: "font-size: 0.8rem; font-weight: 600; color: #ff531f; text-transform: uppercase; letter-spacing: 0.1em;", variants: {}, children: [] },
      { _id: "fp-hero-headline", fake: false, type: "class", name: "fp-hero-headline", namespace: "", comb: "", styleLess: "font-size: 4rem; font-weight: 700; color: #ffffff; line-height: 1.1; margin-bottom: 1.5rem;", variants: {}, children: [] },
      { _id: "fp-hero-headline-accent", fake: false, type: "class", name: "fp-hero-headline-accent", namespace: "", comb: "", styleLess: "color: #ff531f;", variants: {}, children: [] },
      { _id: "fp-hero-description", fake: false, type: "class", name: "fp-hero-description", namespace: "", comb: "", styleLess: "font-size: 1.1rem; color: #767f7a; margin-bottom: 2rem; line-height: 1.6; max-width: 480px;", variants: {}, children: [] },
      { _id: "fp-hero-ctas", fake: false, type: "class", name: "fp-hero-ctas", namespace: "", comb: "", styleLess: "display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;", variants: {}, children: [] },
      { _id: "fp-btn-secondary", fake: false, type: "class", name: "fp-btn-secondary", namespace: "", comb: "", styleLess: "display: inline-flex; align-items: center; gap: 0.5rem; background-color: transparent; color: #ffffff; padding-top: 0.75rem; padding-bottom: 0.75rem; padding-left: 1.5rem; padding-right: 1.5rem; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 0.875rem; border: 1px solid rgba(255, 255, 255, 0.25); cursor: pointer; transition: border-color 0.2s ease, background 0.2s ease;", variants: { hover: { styleLess: "border-color: rgba(255, 255, 255, 0.5); background-color: rgba(255, 255, 255, 0.05);" } }, children: [] },
      { _id: "fp-hero-services", fake: false, type: "class", name: "fp-hero-services", namespace: "", comb: "", styleLess: "margin-top: 3rem; padding-top: 2rem; border-top: 1px solid rgba(255, 255, 255, 0.1);", variants: {}, children: [] },
      { _id: "fp-hero-services-list", fake: false, type: "class", name: "fp-hero-services-list", namespace: "", comb: "", styleLess: "display: flex; gap: 2rem; flex-wrap: wrap;", variants: {}, children: [] },
      { _id: "fp-hero-service-item", fake: false, type: "class", name: "fp-hero-service-item", namespace: "", comb: "", styleLess: "display: flex; align-items: center; gap: 0.5rem; color: #767f7a; font-size: 0.875rem; font-weight: 500;", variants: {}, children: [] },
      { _id: "fp-hero-service-dot", fake: false, type: "class", name: "fp-hero-service-dot", namespace: "", comb: "", styleLess: "width: 6px; height: 6px; border-radius: 50%; background-color: #ff531f;", variants: {}, children: [] },
      { _id: "fp-hero-image-wrapper", fake: false, type: "class", name: "fp-hero-image-wrapper", namespace: "", comb: "", styleLess: "display: flex; justify-content: center;", variants: {}, children: [] },
      { _id: "fp-hero-image", fake: false, type: "class", name: "fp-hero-image", namespace: "", comb: "", styleLess: "position: relative; width: 100%; max-width: 480px; border-radius: 32px; overflow: hidden; box-shadow: 0 40px 80px rgba(0, 0, 0, 0.4); aspect-ratio: 4/5; min-height: 400px; background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);", variants: {}, children: [] },
      { _id: "fp-hero-image-badge", fake: false, type: "class", name: "fp-hero-image-badge", namespace: "", comb: "", styleLess: "position: absolute; bottom: 1.5rem; left: 1.5rem; background-color: rgba(45, 47, 46, 0.9); backdrop-filter: blur(8px); padding-top: 1rem; padding-bottom: 1rem; padding-left: 1.25rem; padding-right: 1.25rem; border-radius: 24px;", variants: {}, children: [] },
      { _id: "fp-hero-badge-value", fake: false, type: "class", name: "fp-hero-badge-value", namespace: "", comb: "", styleLess: "font-size: 1.5rem; font-weight: 700; color: #ffffff; display: block;", variants: {}, children: [] },
      { _id: "fp-hero-badge-label", fake: false, type: "class", name: "fp-hero-badge-label", namespace: "", comb: "", styleLess: "font-size: 0.75rem; color: #767f7a; text-transform: uppercase; letter-spacing: 0.05em;", variants: {}, children: [] },
    ],
    assets: [],
    ix1: [],
    ix2: { interactions: [], events: [], actionLists: [] },
  },
  meta: { unlinkedSymbolCount: 0, droppedLinks: 0, dynBindRemovedCount: 0, dynListBindRemovedCount: 0, paginationRemovedCount: 0 },
}

const fpHeroCodePayload = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Party - Creative Development Marketplace</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Antonio:wght@700&display=swap" rel="stylesheet">
    <style>
        /* ============================================
           DESIGN TOKENS - Flow Party
           ============================================ */
        :root {
            /* Dark Palette */
            --dark-bg: #2d2f2e;
            --dark-secondary: #434645;
            --text-light: #ffffff;
            --text-muted-dark: #767f7a;

            /* Light Palette */
            --light-bg: #f5f5f5;
            --card-bg: #ffffff;
            --text-dark: #171717;
            --text-muted: #afb6b4;
            --border: #dddfde;

            /* Coral Gradient Scale */
            --coral-lightest: #fff0eb;
            --coral-light: #ffc8b8;
            --coral-medium: #ff9d80;
            --coral-strong: #ff531f;
            --coral-vivid: #ff825c;

            /* Border Radius */
            --radius-sm: 24px;
            --radius-md: 32px;
            --radius-lg: 40px;
            --radius-xl: 48px;
            --radius-pill: 9999px;

            /* Typography */
            --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            --font-logo: 'Antonio', sans-serif;
        }
        
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }
        
        body {
            font-family: var(--font-body);
            background: var(--dark-bg);
            color: var(--text-light);
            line-height: 1.5;
            overflow-x: hidden;
        }
        
        /* Animations */
        @keyframes fadeUp {
            from { 
                opacity: 0; 
                transform: translateY(30px) scale(0.96); 
            }
            to { 
                opacity: 1; 
                transform: translateY(0) scale(1); 
            }
        }
        
        @keyframes slideFromLeft {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
        }
        
        @keyframes slideFromBottom {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
        }
        
        .animate-fade-up {
            animation: fadeUp 0.6s cubic-bezier(0.93, 0.03, 0.56, 1) forwards;
        }
        
        .delay-1 { animation-delay: 0.2s; opacity: 0; }
        .delay-2 { animation-delay: 0.4s; opacity: 0; }
        
        /* Hero Section */
        .hero {
            min-height: 100vh;
            background: var(--dark-bg);
            padding: 4rem 5vw;
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: center;
        }
        
        .hero-watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-family: var(--font-logo);
            font-size: clamp(8rem, 20vw, 16rem);
            font-weight: 700;
            color: var(--dark-secondary);
            opacity: 0.4;
            pointer-events: none;
            white-space: nowrap;
            text-transform: uppercase;
            animation: slideFromLeft 1.4s cubic-bezier(1, -0.13, 0.18, 0.96) forwards;
        }
        
        .hero-content {
            position: relative;
            z-index: 1;
            width: 100%;
        }
        
        .hero-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4rem;
            align-items: center;
        }
        
        .hero-text {
            max-width: 560px;
        }
        
        .hero-label {
            display: inline-flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1.5rem;
        }
        
        .hero-label-line {
            width: 40px;
            height: 1px;
            background: var(--coral-strong);
        }
        
        .hero-label-text {
            font-size: 0.8rem;
            font-weight: 600;
            color: var(--coral-strong);
            text-transform: uppercase;
            letter-spacing: 0.1em;
        }
        
        .hero-headline {
            font-size: clamp(2.5rem, 5vw, 4rem);
            font-weight: 700;
            color: var(--text-light);
            line-height: 1.1;
            margin-bottom: 1.5rem;
        }
        
        .hero-headline-accent {
            color: var(--coral-strong);
        }
        
        .hero-description {
            font-size: 1.1rem;
            color: var(--text-muted-dark);
            margin-bottom: 2rem;
            line-height: 1.6;
            max-width: 480px;
        }
        
        .hero-ctas {
            display: flex;
            gap: 1rem;
            align-items: center;
            flex-wrap: wrap;
        }
        
        .btn-primary {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: var(--coral-strong);
            color: var(--text-light);
            padding: 0.875rem 1.75rem;
            border-radius: var(--radius-pill);
            text-decoration: none;
            font-weight: 600;
            font-size: 0.9rem;
            border: none;
            cursor: pointer;
            transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .btn-primary:hover {
            background: #e64a1a;
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(255, 83, 31, 0.3);
        }
        
        .btn-arrow {
            transition: transform 0.2s ease;
        }
        
        .btn-primary:hover .btn-arrow {
            transform: translateX(3px);
        }
        
        .btn-secondary {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: transparent;
            color: var(--text-light);
            padding: 0.875rem 1.75rem;
            border-radius: var(--radius-pill);
            text-decoration: none;
            font-weight: 600;
            font-size: 0.9rem;
            border: 1px solid rgba(255, 255, 255, 0.25);
            cursor: pointer;
            transition: border-color 0.2s ease, background 0.2s ease;
        }
        
        .btn-secondary:hover {
            border-color: rgba(255, 255, 255, 0.5);
            background: rgba(255, 255, 255, 0.05);
        }
        
        .hero-image-wrapper {
            display: flex;
            justify-content: center;
        }
        
        .hero-image {
            position: relative;
            width: 100%;
            max-width: 480px;
            border-radius: var(--radius-md);
            overflow: hidden;
            box-shadow: 0 40px 80px rgba(0, 0, 0, 0.4);
            animation: slideFromBottom 0.9s cubic-bezier(1, -0.13, 0.18, 0.96) 0.5s forwards;
            transform: translateY(100%);
        }
        
        .hero-image img {
            width: 100%;
            height: auto;
            display: block;
            aspect-ratio: 4/5;
            object-fit: cover;
            transition: transform 0.6s ease;
        }
        
        .hero-image:hover img { 
            transform: scale(1.03); 
        }
        
        .hero-image-badge {
            position: absolute;
            bottom: 1.5rem;
            left: 1.5rem;
            background: rgba(45, 47, 46, 0.9);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            padding: 1rem 1.25rem;
            border-radius: var(--radius-sm);
        }
        
        .hero-badge-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--text-light);
        }
        
        .hero-badge-label {
            font-size: 0.75rem;
            color: var(--text-muted-dark);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        /* Services List */
        .hero-services {
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .hero-services-list {
            display: flex;
            gap: 2rem;
            flex-wrap: wrap;
        }
        
        .hero-service-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--text-muted-dark);
            font-size: 0.875rem;
            font-weight: 500;
        }
        
        .hero-service-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--coral-strong);
        }
        
        /* Responsive */
        @media (max-width: 1024px) {
            .hero-grid {
                grid-template-columns: 1fr;
                gap: 3rem;
                text-align: center;
            }
            
            .hero-text {
                max-width: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            
            .hero-description {
                max-width: 560px;
            }
            
            .hero-image-wrapper {
                order: -1;
            }
            
            .hero-image {
                max-width: 380px;
            }
            
            .hero-services-list {
                justify-content: center;
            }
        }
        
        @media (max-width: 768px) {
            .hero {
                padding: 3rem 5vw;
            }
            
            .hero-headline {
                font-size: clamp(2rem, 8vw, 3rem);
            }
            
            .hero-image {
                max-width: 280px;
            }
            
            .hero-services-list {
                flex-direction: column;
                gap: 1rem;
                align-items: center;
            }
            
            .hero-ctas {
                flex-direction: column;
                width: 100%;
            }
            
            .hero-ctas .btn-primary,
            .hero-ctas .btn-secondary {
                width: 100%;
                justify-content: center;
            }
        }
        
        @media (max-width: 480px) {
            .hero-watermark {
                font-size: 5rem;
            }
        }
    </style>
</head>
<body>
    <section class="hero">
        <div class="hero-watermark">FLOWPARTY</div>
        
        <div class="hero-content">
            <div class="hero-grid">
                <div class="hero-text animate-fade-up delay-1">
                    <div class="hero-label">
                        <span class="hero-label-line"></span>
                        <span class="hero-label-text">Premium Asset Library</span>
                    </div>
                    
                    <h1 class="hero-headline">
                        Ship faster with<br>
                        <span class="hero-headline-accent">complete launch kits</span>
                    </h1>
                    
                    <p class="hero-description">
                        The premium Webflow marketplace for creative developers. 
                        Templates, components, and complete Party Packs to help you 
                        launch polished sites in record time.
                    </p>
                    
                    <div class="hero-ctas">
                        <a href="#explore" class="btn-primary">
                            Explore The Stash
                            <span class="btn-arrow">→</span>
                        </a>
                        <a href="#demo" class="btn-secondary">
                            Watch Demo
                        </a>
                    </div>
                    
                    <div class="hero-services">
                        <div class="hero-services-list">
                            <div class="hero-service-item">
                                <span class="hero-service-dot"></span>
                                <span>Full Templates</span>
                            </div>
                            <div class="hero-service-item">
                                <span class="hero-service-dot"></span>
                                <span>UI Components</span>
                            </div>
                            <div class="hero-service-item">
                                <span class="hero-service-dot"></span>
                                <span>Figma Files</span>
                            </div>
                            <div class="hero-service-item">
                                <span class="hero-service-dot"></span>
                                <span>Launch Guides</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="hero-image-wrapper animate-fade-up delay-2">
                    <div class="hero-image">
                        <img 
                            src="https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800&q=80" 
                            alt="Abstract gradient design"
                        >
                        <div class="hero-image-badge">
                            <span class="hero-badge-value">140+</span>
                            <span class="hero-badge-label">Premium Resources</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</body>
</html>`

// Client Bar Section
const fpClientBarWebflowJson = {
  type: "@webflow/XscpData",
  payload: {
    nodes: [
      {
        _id: "fp-client-bar-001",
        type: "Block",
        tag: "div",
        classes: ["fp-client-bar"],
        children: ["fp-client-label", "fp-client-line", "fp-client-logos"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-client-label", type: "Block", tag: "span", classes: ["fp-client-label"], children: ["fp-client-label-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-client-label-text", text: true, v: "Trusted by teams at" },
      { _id: "fp-client-line", type: "Block", tag: "div", classes: ["fp-client-line"], children: [], data: { tag: "div", text: false, xattr: [] } },
      {
        _id: "fp-client-logos",
        type: "Block",
        tag: "div",
        classes: ["fp-client-logos"],
        children: ["fp-client-1", "fp-client-2", "fp-client-3", "fp-client-4", "fp-client-5", "fp-client-6"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-client-1", type: "Block", tag: "span", classes: ["fp-client-logo"], children: ["fp-client-1-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-client-1-text", text: true, v: "Vercel" },
      { _id: "fp-client-2", type: "Block", tag: "span", classes: ["fp-client-logo"], children: ["fp-client-2-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-client-2-text", text: true, v: "Linear" },
      { _id: "fp-client-3", type: "Block", tag: "span", classes: ["fp-client-logo"], children: ["fp-client-3-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-client-3-text", text: true, v: "Notion" },
      { _id: "fp-client-4", type: "Block", tag: "span", classes: ["fp-client-logo"], children: ["fp-client-4-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-client-4-text", text: true, v: "Figma" },
      { _id: "fp-client-5", type: "Block", tag: "span", classes: ["fp-client-logo"], children: ["fp-client-5-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-client-5-text", text: true, v: "Stripe" },
      { _id: "fp-client-6", type: "Block", tag: "span", classes: ["fp-client-logo"], children: ["fp-client-6-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-client-6-text", text: true, v: "Framer" },
    ],
    styles: [
      { _id: "fp-client-bar", fake: false, type: "class", name: "fp-client-bar", namespace: "", comb: "", styleLess: "padding-top: 3rem; padding-bottom: 3rem; padding-left: 5vw; padding-right: 5vw; display: flex; align-items: center; gap: 2rem; border-bottom: 1px solid #dddfde; overflow-x: auto; background-color: #f5f5f5;", variants: {}, children: [] },
      { _id: "fp-client-label", fake: false, type: "class", name: "fp-client-label", namespace: "", comb: "", styleLess: "font-size: 0.875rem; color: #afb6b4; white-space: nowrap;", variants: {}, children: [] },
      { _id: "fp-client-line", fake: false, type: "class", name: "fp-client-line", namespace: "", comb: "", styleLess: "flex: 0 0 60px; height: 1px; background-color: #dddfde;", variants: {}, children: [] },
      { _id: "fp-client-logos", fake: false, type: "class", name: "fp-client-logos", namespace: "", comb: "", styleLess: "display: flex; gap: 3rem; flex-wrap: nowrap;", variants: {}, children: [] },
      { _id: "fp-client-logo", fake: false, type: "class", name: "fp-client-logo", namespace: "", comb: "", styleLess: "font-size: 0.875rem; font-weight: 600; color: #171717; opacity: 0.5; white-space: nowrap; transition: opacity 0.2s;", variants: { hover: { styleLess: "opacity: 1;" } }, children: [] },
    ],
    assets: [],
    ix1: [],
    ix2: { interactions: [], events: [], actionLists: [] },
  },
  meta: { unlinkedSymbolCount: 0, droppedLinks: 0, dynBindRemovedCount: 0, dynListBindRemovedCount: 0, paginationRemovedCount: 0 },
}

const fpClientBarCodePayload = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Party - Client Bar</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        /* ============================================
           DESIGN TOKENS - Flow Party
           ============================================ */
        :root {
            /* Dark Palette */
            --dark-bg: #2d2f2e;
            --dark-secondary: #434645;
            --text-light: #ffffff;
            --text-muted-dark: #767f7a;

            /* Light Palette */
            --light-bg: #f5f5f5;
            --card-bg: #ffffff;
            --text-dark: #171717;
            --text-muted: #afb6b4;
            --border: #dddfde;

            /* Coral Gradient Scale */
            --coral-lightest: #fff0eb;
            --coral-light: #ffc8b8;
            --coral-medium: #ff9d80;
            --coral-strong: #ff531f;
            --coral-vivid: #ff825c;

            /* Border Radius */
            --radius-sm: 24px;
            --radius-md: 32px;
            --radius-lg: 40px;
            --radius-xl: 48px;
            --radius-pill: 9999px;

            /* Typography */
            --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            --font-logo: 'Antonio', sans-serif;
        }
        
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }
        
        body {
            font-family: var(--font-body);
            background: var(--light-bg);
            line-height: 1.5;
        }
        
        /* Client / Trust Bar */
        .client-bar {
            padding: 3rem 5vw;
            display: flex;
            align-items: center;
            gap: 2rem;
            border-bottom: 1px solid var(--border);
            overflow-x: auto;
        }
        
        .client-label {
            font-size: 0.875rem;
            color: var(--text-muted);
            white-space: nowrap;
        }
        
        .client-line {
            flex: 0 0 60px;
            height: 1px;
            background: var(--border);
        }
        
        .client-logos {
            display: flex;
            gap: 3rem;
            flex-wrap: nowrap;
        }
        
        .client-logos span {
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--text-dark);
            opacity: 0.5;
            white-space: nowrap;
            transition: opacity 0.2s;
        }
        
        .client-logos span:hover { 
            opacity: 1; 
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .client-bar {
                padding: 2rem 5vw;
                gap: 1.5rem;
            }
            
            .client-logos {
                gap: 2rem;
            }
        }
        
        @media (max-width: 480px) {
            .client-line {
                display: none;
            }
            
            .client-bar {
                flex-wrap: wrap;
                justify-content: center;
            }
            
            .client-label {
                width: 100%;
                text-align: center;
            }
            
            .client-logos {
                flex-wrap: wrap;
                justify-content: center;
                gap: 1.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="client-bar">
        <span class="client-label">Trusted by teams at</span>
        <div class="client-line"></div>
        <div class="client-logos">
            <span>Vercel</span>
            <span>Linear</span>
            <span>Notion</span>
            <span>Figma</span>
            <span>Stripe</span>
            <span>Framer</span>
        </div>
    </div>
</body>
</html>`

// Pricing Section
const fpPricingWebflowJson = {
  type: "@webflow/XscpData",
  payload: {
    nodes: [
      {
        _id: "fp-pricing-001",
        type: "Block",
        tag: "section",
        classes: ["fp-pricing-section"],
        children: ["fp-pricing-header", "fp-pricing-grid"],
        data: { tag: "section", text: false, xattr: [{ name: "id", value: "pricing" }] },
      },
      {
        _id: "fp-pricing-header",
        type: "Block",
        tag: "div",
        classes: ["fp-pricing-header"],
        children: ["fp-pricing-title", "fp-pricing-subtitle"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-pricing-title", type: "Heading", tag: "h2", classes: ["fp-pricing-title"], children: ["fp-pricing-title-text"], data: { tag: "h2", text: false, xattr: [] } },
      { _id: "fp-pricing-title-text", text: true, v: "Simple pricing" },
      { _id: "fp-pricing-subtitle", type: "Paragraph", tag: "p", classes: ["fp-pricing-subtitle"], children: ["fp-pricing-subtitle-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-pricing-subtitle-text", text: true, v: "Choose the plan that fits your workflow. All plans include lifetime access to purchased resources." },
      {
        _id: "fp-pricing-grid",
        type: "Block",
        tag: "div",
        classes: ["fp-pricing-grid"],
        children: ["fp-pricing-card-1", "fp-pricing-card-2", "fp-pricing-card-3"],
        data: { tag: "div", text: false, xattr: [] },
      },
      // Starter card
      {
        _id: "fp-pricing-card-1",
        type: "Block",
        tag: "div",
        classes: ["fp-pricing-card"],
        children: ["fp-pricing-tier-1", "fp-pricing-price-1", "fp-pricing-desc-1", "fp-pricing-features-1", "fp-pricing-btn-1"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-pricing-tier-1", type: "Block", tag: "div", classes: ["fp-pricing-tier"], children: ["fp-pricing-tier-1-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pricing-tier-1-text", text: true, v: "Starter" },
      { _id: "fp-pricing-price-1", type: "Block", tag: "div", classes: ["fp-pricing-price"], children: ["fp-pricing-price-1-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pricing-price-1-text", text: true, v: "$0 /mo" },
      { _id: "fp-pricing-desc-1", type: "Paragraph", tag: "p", classes: ["fp-pricing-desc"], children: ["fp-pricing-desc-1-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-pricing-desc-1-text", text: true, v: "Perfect for exploring what Flow Party offers." },
      {
        _id: "fp-pricing-features-1",
        type: "Block",
        tag: "div",
        classes: ["fp-pricing-features"],
        children: ["fp-pricing-feature-1-1", "fp-pricing-feature-1-2", "fp-pricing-feature-1-3"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-pricing-feature-1-1", type: "Block", tag: "div", classes: ["fp-pricing-feature"], children: ["fp-pricing-feature-1-1-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pricing-feature-1-1-text", text: true, v: "5 free components" },
      { _id: "fp-pricing-feature-1-2", type: "Block", tag: "div", classes: ["fp-pricing-feature"], children: ["fp-pricing-feature-1-2-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pricing-feature-1-2-text", text: true, v: "Community access" },
      { _id: "fp-pricing-feature-1-3", type: "Block", tag: "div", classes: ["fp-pricing-feature"], children: ["fp-pricing-feature-1-3-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pricing-feature-1-3-text", text: true, v: "Email support" },
      { _id: "fp-pricing-btn-1", type: "Link", tag: "a", classes: ["fp-btn-secondary", "fp-btn-full"], children: ["fp-pricing-btn-1-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-pricing-btn-1-text", text: true, v: "Get Started" },
      // Pro card (popular)
      {
        _id: "fp-pricing-card-2",
        type: "Block",
        tag: "div",
        classes: ["fp-pricing-card", "fp-pricing-popular"],
        children: ["fp-popular-badge", "fp-pricing-tier-2", "fp-pricing-price-2", "fp-pricing-desc-2", "fp-pricing-features-2", "fp-pricing-btn-2"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-popular-badge", type: "Block", tag: "div", classes: ["fp-popular-badge"], children: ["fp-popular-badge-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-popular-badge-text", text: true, v: "Most Popular" },
      { _id: "fp-pricing-tier-2", type: "Block", tag: "div", classes: ["fp-pricing-tier"], children: ["fp-pricing-tier-2-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pricing-tier-2-text", text: true, v: "Pro" },
      { _id: "fp-pricing-price-2", type: "Block", tag: "div", classes: ["fp-pricing-price"], children: ["fp-pricing-price-2-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pricing-price-2-text", text: true, v: "$29 /mo" },
      { _id: "fp-pricing-desc-2", type: "Paragraph", tag: "p", classes: ["fp-pricing-desc"], children: ["fp-pricing-desc-2-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-pricing-desc-2-text", text: true, v: "Full access to The Stash. Ship faster, every project." },
      {
        _id: "fp-pricing-features-2",
        type: "Block",
        tag: "div",
        classes: ["fp-pricing-features"],
        children: ["fp-pricing-feature-2-1", "fp-pricing-feature-2-2", "fp-pricing-feature-2-3", "fp-pricing-feature-2-4", "fp-pricing-feature-2-5"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-pricing-feature-2-1", type: "Block", tag: "div", classes: ["fp-pricing-feature"], children: ["fp-pricing-feature-2-1-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pricing-feature-2-1-text", text: true, v: "All 140+ resources" },
      { _id: "fp-pricing-feature-2-2", type: "Block", tag: "div", classes: ["fp-pricing-feature"], children: ["fp-pricing-feature-2-2-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pricing-feature-2-2-text", text: true, v: "All Party Packs" },
      { _id: "fp-pricing-feature-2-3", type: "Block", tag: "div", classes: ["fp-pricing-feature"], children: ["fp-pricing-feature-2-3-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pricing-feature-2-3-text", text: true, v: "Figma files included" },
      { _id: "fp-pricing-feature-2-4", type: "Block", tag: "div", classes: ["fp-pricing-feature"], children: ["fp-pricing-feature-2-4-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pricing-feature-2-4-text", text: true, v: "Priority support" },
      { _id: "fp-pricing-feature-2-5", type: "Block", tag: "div", classes: ["fp-pricing-feature"], children: ["fp-pricing-feature-2-5-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pricing-feature-2-5-text", text: true, v: "New releases weekly" },
      { _id: "fp-pricing-btn-2", type: "Link", tag: "a", classes: ["fp-btn-primary", "fp-btn-full"], children: ["fp-pricing-btn-2-text", "fp-pricing-btn-2-arrow"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-pricing-btn-2-text", text: true, v: "Start Pro Trial " },
      { _id: "fp-pricing-btn-2-arrow", type: "Block", tag: "span", classes: ["fp-btn-arrow"], children: ["fp-pricing-btn-2-arrow-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-pricing-btn-2-arrow-text", text: true, v: "→" },
      // Lifetime card
      {
        _id: "fp-pricing-card-3",
        type: "Block",
        tag: "div",
        classes: ["fp-pricing-card"],
        children: ["fp-pricing-tier-3", "fp-pricing-price-3", "fp-pricing-desc-3", "fp-pricing-features-3", "fp-pricing-btn-3"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-pricing-tier-3", type: "Block", tag: "div", classes: ["fp-pricing-tier"], children: ["fp-pricing-tier-3-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pricing-tier-3-text", text: true, v: "Lifetime" },
      { _id: "fp-pricing-price-3", type: "Block", tag: "div", classes: ["fp-pricing-price"], children: ["fp-pricing-price-3-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pricing-price-3-text", text: true, v: "$299 once" },
      { _id: "fp-pricing-desc-3", type: "Paragraph", tag: "p", classes: ["fp-pricing-desc"], children: ["fp-pricing-desc-3-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-pricing-desc-3-text", text: true, v: "One payment, forever access. Best value for agencies." },
      {
        _id: "fp-pricing-features-3",
        type: "Block",
        tag: "div",
        classes: ["fp-pricing-features"],
        children: ["fp-pricing-feature-3-1", "fp-pricing-feature-3-2", "fp-pricing-feature-3-3", "fp-pricing-feature-3-4"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-pricing-feature-3-1", type: "Block", tag: "div", classes: ["fp-pricing-feature"], children: ["fp-pricing-feature-3-1-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pricing-feature-3-1-text", text: true, v: "Everything in Pro" },
      { _id: "fp-pricing-feature-3-2", type: "Block", tag: "div", classes: ["fp-pricing-feature"], children: ["fp-pricing-feature-3-2-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pricing-feature-3-2-text", text: true, v: "Lifetime updates" },
      { _id: "fp-pricing-feature-3-3", type: "Block", tag: "div", classes: ["fp-pricing-feature"], children: ["fp-pricing-feature-3-3-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pricing-feature-3-3-text", text: true, v: "Team sharing (5 seats)" },
      { _id: "fp-pricing-feature-3-4", type: "Block", tag: "div", classes: ["fp-pricing-feature"], children: ["fp-pricing-feature-3-4-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pricing-feature-3-4-text", text: true, v: "Early access" },
      { _id: "fp-pricing-btn-3", type: "Link", tag: "a", classes: ["fp-btn-dark", "fp-btn-full"], children: ["fp-pricing-btn-3-text", "fp-pricing-btn-3-arrow"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-pricing-btn-3-text", text: true, v: "Get Lifetime " },
      { _id: "fp-pricing-btn-3-arrow", type: "Block", tag: "span", classes: ["fp-btn-arrow"], children: ["fp-pricing-btn-3-arrow-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-pricing-btn-3-arrow-text", text: true, v: "→" },
    ],
    styles: [
      { _id: "fp-pricing-section", fake: false, type: "class", name: "fp-pricing-section", namespace: "", comb: "", styleLess: "background-color: #ffffff; padding-top: 6rem; padding-bottom: 6rem; padding-left: 5vw; padding-right: 5vw;", variants: {}, children: [] },
      { _id: "fp-pricing-header", fake: false, type: "class", name: "fp-pricing-header", namespace: "", comb: "", styleLess: "text-align: center; max-width: 600px; margin-left: auto; margin-right: auto; margin-bottom: 4rem;", variants: {}, children: [] },
      { _id: "fp-pricing-title", fake: false, type: "class", name: "fp-pricing-title", namespace: "", comb: "", styleLess: "font-size: 4rem; font-weight: 700; margin-bottom: 1rem;", variants: {}, children: [] },
      { _id: "fp-pricing-subtitle", fake: false, type: "class", name: "fp-pricing-subtitle", namespace: "", comb: "", styleLess: "font-size: 1.1rem; color: #afb6b4;", variants: {}, children: [] },
      { _id: "fp-pricing-grid", fake: false, type: "class", name: "fp-pricing-grid", namespace: "", comb: "", styleLess: "display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; max-width: 1100px; margin-left: auto; margin-right: auto;", variants: {}, children: [] },
      { _id: "fp-pricing-card", fake: false, type: "class", name: "fp-pricing-card", namespace: "", comb: "", styleLess: "background-color: #f5f5f5; border-radius: 32px; padding: 2.5rem; position: relative; transition: transform 0.3s ease;", variants: { hover: { styleLess: "transform: translateY(-4px);" } }, children: [] },
      { _id: "fp-pricing-popular", fake: false, type: "class", name: "fp-pricing-popular", namespace: "", comb: "", styleLess: "background-color: #2d2f2e; color: #ffffff;", variants: {}, children: [] },
      { _id: "fp-popular-badge", fake: false, type: "class", name: "fp-popular-badge", namespace: "", comb: "", styleLess: "position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background-color: #ff531f; color: #ffffff; font-size: 0.7rem; font-weight: 600; padding-top: 0.4rem; padding-bottom: 0.4rem; padding-left: 1rem; padding-right: 1rem; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em;", variants: {}, children: [] },
      { _id: "fp-pricing-tier", fake: false, type: "class", name: "fp-pricing-tier", namespace: "", comb: "", styleLess: "font-size: 0.8rem; font-weight: 600; color: #ff531f; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;", variants: {}, children: [] },
      { _id: "fp-pricing-price", fake: false, type: "class", name: "fp-pricing-price", namespace: "", comb: "", styleLess: "font-size: 3rem; font-weight: 700; line-height: 1; margin-bottom: 0.5rem;", variants: {}, children: [] },
      { _id: "fp-pricing-desc", fake: false, type: "class", name: "fp-pricing-desc", namespace: "", comb: "", styleLess: "font-size: 0.9rem; color: #afb6b4; margin-bottom: 2rem; line-height: 1.4;", variants: {}, children: [] },
      { _id: "fp-pricing-features", fake: false, type: "class", name: "fp-pricing-features", namespace: "", comb: "", styleLess: "display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2rem;", variants: {}, children: [] },
      { _id: "fp-pricing-feature", fake: false, type: "class", name: "fp-pricing-feature", namespace: "", comb: "", styleLess: "font-size: 0.9rem; color: #afb6b4; display: flex; align-items: center; gap: 0.75rem;", variants: {}, children: [] },
      { _id: "fp-btn-full", fake: false, type: "class", name: "fp-btn-full", namespace: "", comb: "", styleLess: "width: 100%; justify-content: center;", variants: {}, children: [] },
      { _id: "fp-btn-dark", fake: false, type: "class", name: "fp-btn-dark", namespace: "", comb: "", styleLess: "display: inline-flex; align-items: center; gap: 0.5rem; background-color: #171717; color: #ffffff; padding-top: 0.75rem; padding-bottom: 0.75rem; padding-left: 1.5rem; padding-right: 1.5rem; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 0.875rem; border: none; cursor: pointer; transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;", variants: { hover: { styleLess: "background-color: #333; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);" } }, children: [] },
    ],
    assets: [],
    ix1: [],
    ix2: { interactions: [], events: [], actionLists: [] },
  },
  meta: { unlinkedSymbolCount: 0, droppedLinks: 0, dynBindRemovedCount: 0, dynListBindRemovedCount: 0, paginationRemovedCount: 0 },
}

const fpPricingCodePayload = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Party - Pricing</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet">
    <style>
        /* ============================================
           DESIGN TOKENS - Flow Party
           ============================================ */
        :root {
            /* Dark Palette */
            --dark-bg: #2d2f2e;
            --dark-secondary: #434645;
            --text-light: #ffffff;
            --text-muted-dark: #767f7a;

            /* Light Palette */
            --light-bg: #f5f5f5;
            --card-bg: #ffffff;
            --text-dark: #171717;
            --text-muted: #afb6b4;
            --border: #dddfde;

            /* Coral Gradient Scale */
            --coral-lightest: #fff0eb;
            --coral-light: #ffc8b8;
            --coral-medium: #ff9d80;
            --coral-strong: #ff531f;
            --coral-vivid: #ff825c;

            /* Border Radius */
            --radius-sm: 24px;
            --radius-md: 32px;
            --radius-lg: 40px;
            --radius-xl: 48px;
            --radius-pill: 9999px;

            /* Typography */
            --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            --font-logo: 'Antonio', sans-serif;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--font-body);
            background: var(--card-bg);
            color: var(--text-dark);
            line-height: 1.5;
        }

        /* Pricing Section */
        .pricing-section {
            padding: 6rem 5vw;
        }

        .pricing-header {
            text-align: center;
            max-width: 600px;
            margin: 0 auto 4rem;
        }

        .pricing-header h2 {
            font-size: clamp(2.5rem, 5vw, 4rem);
            font-weight: 700;
            margin-bottom: 1rem;
        }

        .pricing-header p {
            font-size: 1.1rem;
            color: var(--text-muted);
        }

        .pricing-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 2rem;
            max-width: 1100px;
            margin: 0 auto;
        }

        .pricing-card {
            background: var(--light-bg);
            border-radius: var(--radius-md);
            padding: 2.5rem;
            position: relative;
            transition: transform 0.3s ease;
        }

        .pricing-card:hover {
            transform: translateY(-4px);
        }

        .pricing-card.popular {
            background: var(--dark-bg);
            color: var(--text-light);
        }

        .pricing-card.popular .pricing-desc {
            color: var(--text-muted-dark);
        }

        .pricing-card.popular .pricing-feature {
            color: var(--text-muted-dark);
        }

        .pricing-card.popular .pricing-feature::before {
            background: var(--coral-strong);
        }

        .popular-badge {
            position: absolute;
            top: -12px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--coral-strong);
            color: var(--text-light);
            font-size: 0.7rem;
            font-weight: 600;
            padding: 0.4rem 1rem;
            border-radius: var(--radius-pill);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .pricing-tier {
            font-size: 0.8rem;
            font-weight: 600;
            color: var(--coral-strong);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 1rem;
        }

        .pricing-price {
            font-size: 3rem;
            font-weight: 700;
            line-height: 1;
            margin-bottom: 0.5rem;
        }

        .pricing-price span {
            font-size: 1rem;
            font-weight: 500;
            opacity: 0.6;
        }

        .pricing-desc {
            font-size: 0.9rem;
            color: var(--text-muted);
            margin-bottom: 2rem;
            line-height: 1.4;
        }

        .pricing-features {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            margin-bottom: 2rem;
        }

        .pricing-feature {
            font-size: 0.9rem;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .pricing-feature::before {
            content: '✓';
            width: 18px;
            height: 18px;
            background: var(--coral-lightest);
            color: var(--coral-strong);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.65rem;
            flex-shrink: 0;
        }

        .btn-primary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            background: var(--coral-strong);
            color: var(--text-light);
            padding: 0.875rem 1.75rem;
            border-radius: var(--radius-pill);
            text-decoration: none;
            font-weight: 600;
            font-size: 0.9rem;
            border: none;
            cursor: pointer;
            width: 100%;
            transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }

        .btn-primary:hover {
            background: #e64a1a;
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(255, 83, 31, 0.3);
        }

        .btn-secondary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            background: transparent;
            color: var(--text-dark);
            padding: 0.875rem 1.75rem;
            border-radius: var(--radius-pill);
            text-decoration: none;
            font-weight: 600;
            font-size: 0.9rem;
            border: 1px solid var(--border);
            cursor: pointer;
            width: 100%;
            transition: border-color 0.2s ease, background 0.2s ease;
        }

        .btn-secondary:hover {
            border-color: var(--text-dark);
            background: rgba(0, 0, 0, 0.02);
        }

        .btn-dark {
            background: var(--text-dark);
        }

        .btn-dark:hover {
            background: #333;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }

        .btn-arrow {
            transition: transform 0.2s ease;
        }

        .btn-primary:hover .btn-arrow {
            transform: translateX(3px);
        }

        /* Responsive */
        @media (max-width: 1024px) {
            .pricing-grid {
                grid-template-columns: 1fr;
                max-width: 400px;
            }
        }

        @media (max-width: 768px) {
            .pricing-section {
                padding: 4rem 5vw;
            }
        }
    </style>
</head>

<body>
    <section class="pricing-section" id="pricing">
        <div class="pricing-header">
            <h2>Simple pricing</h2>
            <p>Choose the plan that fits your workflow. All plans include lifetime access to purchased resources.</p>
        </div>
        <div class="pricing-grid">
            <div class="pricing-card">
                <div class="pricing-tier">Starter</div>
                <div class="pricing-price">$0 <span>/mo</span></div>
                <p class="pricing-desc">Perfect for exploring what Flow Party offers.</p>
                <div class="pricing-features">
                    <div class="pricing-feature">5 free components</div>
                    <div class="pricing-feature">Community access</div>
                    <div class="pricing-feature">Email support</div>
                </div>
                <a href="#" class="btn-secondary">Get Started</a>
            </div>
            <div class="pricing-card popular">
                <div class="popular-badge">Most Popular</div>
                <div class="pricing-tier">Pro</div>
                <div class="pricing-price">$29 <span>/mo</span></div>
                <p class="pricing-desc">Full access to The Stash. Ship faster, every project.</p>
                <div class="pricing-features">
                    <div class="pricing-feature">All 140+ resources</div>
                    <div class="pricing-feature">All Party Packs</div>
                    <div class="pricing-feature">Figma files included</div>
                    <div class="pricing-feature">Priority support</div>
                    <div class="pricing-feature">New releases weekly</div>
                </div>
                <a href="#" class="btn-primary">Start Pro Trial <span class="btn-arrow">→</span></a>
            </div>
            <div class="pricing-card">
                <div class="pricing-tier">Lifetime</div>
                <div class="pricing-price">$299 <span>once</span></div>
                <p class="pricing-desc">One payment, forever access. Best value for agencies.</p>
                <div class="pricing-features">
                    <div class="pricing-feature">Everything in Pro</div>
                    <div class="pricing-feature">Lifetime updates</div>
                    <div class="pricing-feature">Team sharing (5 seats)</div>
                    <div class="pricing-feature">Early access</div>
                </div>
                <a href="#" class="btn-dark btn-primary">Get Lifetime <span class="btn-arrow">→</span></a>
            </div>
        </div>
    </section>
</body>

</html>`

// CTA Section
const fpCtaWebflowJson = {
  type: "@webflow/XscpData",
  payload: {
    nodes: [
      {
        _id: "fp-cta-001",
        type: "Block",
        tag: "section",
        classes: ["fp-cta-section"],
        children: ["fp-cta-watermark", "fp-cta-content"],
        data: { tag: "section", text: false, xattr: [] },
      },
      { _id: "fp-cta-watermark", type: "Block", tag: "div", classes: ["fp-cta-watermark"], children: ["fp-cta-watermark-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-cta-watermark-text", text: true, v: "PARTY" },
      {
        _id: "fp-cta-content",
        type: "Block",
        tag: "div",
        classes: ["fp-cta-content"],
        children: ["fp-cta-title", "fp-cta-desc", "fp-cta-buttons"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-cta-title", type: "Heading", tag: "h2", classes: ["fp-cta-title"], children: ["fp-cta-title-text"], data: { tag: "h2", text: false, xattr: [] } },
      { _id: "fp-cta-title-text", text: true, v: "Ready to ship faster?" },
      { _id: "fp-cta-desc", type: "Paragraph", tag: "p", classes: ["fp-cta-desc"], children: ["fp-cta-desc-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-cta-desc-text", text: true, v: "Join 500+ creative developers already building with Flow Party. Start with our free resources or go Pro for full access." },
      {
        _id: "fp-cta-buttons",
        type: "Block",
        tag: "div",
        classes: ["fp-cta-buttons"],
        children: ["fp-cta-btn-primary", "fp-cta-btn-secondary"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-cta-btn-primary", type: "Link", tag: "a", classes: ["fp-btn-primary"], children: ["fp-cta-btn-primary-text", "fp-cta-btn-primary-arrow"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-cta-btn-primary-text", text: true, v: "Start Free " },
      { _id: "fp-cta-btn-primary-arrow", type: "Block", tag: "span", classes: ["fp-btn-arrow"], children: ["fp-cta-btn-primary-arrow-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-cta-btn-primary-arrow-text", text: true, v: "→" },
      { _id: "fp-cta-btn-secondary", type: "Link", tag: "a", classes: ["fp-btn-secondary"], children: ["fp-cta-btn-secondary-text"], data: { link: { mode: "external", url: "#pricing" } } },
      { _id: "fp-cta-btn-secondary-text", text: true, v: "View Pricing" },
    ],
    styles: [
      { _id: "fp-cta-section", fake: false, type: "class", name: "fp-cta-section", namespace: "", comb: "", styleLess: "background-color: #2d2f2e; padding-top: 8rem; padding-bottom: 8rem; padding-left: 5vw; padding-right: 5vw; text-align: center; position: relative; overflow: hidden;", variants: {}, children: [] },
      { _id: "fp-cta-watermark", fake: false, type: "class", name: "fp-cta-watermark", namespace: "", comb: "", styleLess: "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-family: 'Antonio', sans-serif; font-size: 12rem; font-weight: 700; color: #434645; opacity: 0.3; pointer-events: none; white-space: nowrap;", variants: {}, children: [] },
      { _id: "fp-cta-content", fake: false, type: "class", name: "fp-cta-content", namespace: "", comb: "", styleLess: "position: relative; z-index: 1; max-width: 700px; margin-left: auto; margin-right: auto;", variants: {}, children: [] },
      { _id: "fp-cta-title", fake: false, type: "class", name: "fp-cta-title", namespace: "", comb: "", styleLess: "font-size: 4rem; font-weight: 700; color: #ffffff; margin-bottom: 1.5rem; line-height: 1.1;", variants: {}, children: [] },
      { _id: "fp-cta-desc", fake: false, type: "class", name: "fp-cta-desc", namespace: "", comb: "", styleLess: "font-size: 1.1rem; color: #767f7a; margin-bottom: 2.5rem;", variants: {}, children: [] },
      { _id: "fp-cta-buttons", fake: false, type: "class", name: "fp-cta-buttons", namespace: "", comb: "", styleLess: "display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;", variants: {}, children: [] },
    ],
    assets: [],
    ix1: [],
    ix2: { interactions: [], events: [], actionLists: [] },
  },
  meta: { unlinkedSymbolCount: 0, droppedLinks: 0, dynBindRemovedCount: 0, dynListBindRemovedCount: 0, paginationRemovedCount: 0 },
}

const fpCtaCodePayload = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Party - CTA</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Antonio:wght@700&display=swap"
        rel="stylesheet">
    <style>
        /* ============================================
           DESIGN TOKENS - Flow Party
           ============================================ */
        :root {
            /* Dark Palette */
            --dark-bg: #2d2f2e;
            --dark-secondary: #434645;
            --text-light: #ffffff;
            --text-muted-dark: #767f7a;

            /* Light Palette */
            --light-bg: #f5f5f5;
            --card-bg: #ffffff;
            --text-dark: #171717;
            --text-muted: #afb6b4;
            --border: #dddfde;

            /* Coral Gradient Scale */
            --coral-lightest: #fff0eb;
            --coral-light: #ffc8b8;
            --coral-medium: #ff9d80;
            --coral-strong: #ff531f;
            --coral-vivid: #ff825c;

            /* Border Radius */
            --radius-sm: 24px;
            --radius-md: 32px;
            --radius-lg: 40px;
            --radius-xl: 48px;
            --radius-pill: 9999px;

            /* Typography */
            --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            --font-logo: 'Antonio', sans-serif;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--font-body);
            background: var(--dark-bg);
            color: var(--text-light);
            line-height: 1.5;
        }

        /* CTA Section */
        .cta-section {
            padding: 8rem 5vw;
            text-align: center;
            position: relative;
            overflow: hidden;
        }

        .cta-watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-family: var(--font-logo);
            font-size: clamp(6rem, 15vw, 12rem);
            font-weight: 700;
            color: var(--dark-secondary);
            opacity: 0.3;
            pointer-events: none;
            white-space: nowrap;
        }

        .cta-content {
            position: relative;
            z-index: 1;
            max-width: 700px;
            margin: 0 auto;
        }

        .cta-content h2 {
            font-size: clamp(2.5rem, 5vw, 4rem);
            font-weight: 700;
            color: var(--text-light);
            margin-bottom: 1.5rem;
            line-height: 1.1;
        }

        .cta-content p {
            font-size: 1.1rem;
            color: var(--text-muted-dark);
            margin-bottom: 2.5rem;
        }

        .cta-buttons {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
        }

        .btn-primary {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: var(--coral-strong);
            color: var(--text-light);
            padding: 0.875rem 1.75rem;
            border-radius: var(--radius-pill);
            text-decoration: none;
            font-weight: 600;
            font-size: 0.9rem;
            border: none;
            cursor: pointer;
            transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }

        .btn-primary:hover {
            background: #e64a1a;
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(255, 83, 31, 0.3);
        }

        .btn-secondary {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: transparent;
            color: var(--text-light);
            padding: 0.875rem 1.75rem;
            border-radius: var(--radius-pill);
            text-decoration: none;
            font-weight: 600;
            font-size: 0.9rem;
            border: 1px solid rgba(255, 255, 255, 0.25);
            cursor: pointer;
            transition: border-color 0.2s ease, background 0.2s ease;
        }

        .btn-secondary:hover {
            border-color: rgba(255, 255, 255, 0.5);
            background: rgba(255, 255, 255, 0.05);
        }

        .btn-arrow {
            transition: transform 0.2s ease;
        }

        .btn-primary:hover .btn-arrow {
            transform: translateX(3px);
        }

        /* Responsive */
        @media (max-width: 768px) {
            .cta-section {
                padding: 6rem 5vw;
            }

            .cta-buttons {
                flex-direction: column;
                align-items: center;
            }

            .btn-primary,
            .btn-secondary {
                width: 100%;
                max-width: 300px;
                justify-content: center;
            }
        }

        @media (max-width: 480px) {
            .cta-watermark {
                font-size: 4rem;
            }
        }
    </style>
</head>

<body>
    <section class="cta-section">
        <div class="cta-watermark">PARTY</div>
        <div class="cta-content">
            <h2>Ready to ship faster?</h2>
            <p>Join 500+ creative developers already building with Flow Party. Start with our free resources or go Pro
                for full access.</p>
            <div class="cta-buttons">
                <a href="#" class="btn-primary">Start Free <span class="btn-arrow">→</span></a>
                <a href="#" class="btn-secondary">View Pricing</a>
            </div>
        </div>
    </section>
</body>

</html>`

// Footer Section
const fpFooterWebflowJson = {
  type: "@webflow/XscpData",
  payload: {
    nodes: [
      {
        _id: "fp-footer-001",
        type: "Block",
        tag: "footer",
        classes: ["fp-footer"],
        children: ["fp-footer-top", "fp-footer-bottom"],
        data: { tag: "footer", text: false, xattr: [] },
      },
      {
        _id: "fp-footer-top",
        type: "Block",
        tag: "div",
        classes: ["fp-footer-top"],
        children: ["fp-footer-logo", "fp-footer-links"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-footer-logo", type: "Block", tag: "span", classes: ["fp-footer-logo"], children: ["fp-footer-logo-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-footer-logo-text", text: true, v: "FLOWPARTY™" },
      {
        _id: "fp-footer-links",
        type: "Block",
        tag: "div",
        classes: ["fp-footer-links"],
        children: ["fp-footer-col-1", "fp-footer-col-2", "fp-footer-col-3", "fp-footer-col-4"],
        data: { tag: "div", text: false, xattr: [] },
      },
      // Column 1 - Product
      { _id: "fp-footer-col-1", type: "Block", tag: "div", classes: ["fp-footer-col"], children: ["fp-footer-col-1-title", "fp-footer-col-1-link-1", "fp-footer-col-1-link-2", "fp-footer-col-1-link-3", "fp-footer-col-1-link-4"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-footer-col-1-title", type: "Heading", tag: "h4", classes: ["fp-footer-col-title"], children: ["fp-footer-col-1-title-text"], data: { tag: "h4", text: false, xattr: [] } },
      { _id: "fp-footer-col-1-title-text", text: true, v: "Product" },
      { _id: "fp-footer-col-1-link-1", type: "Link", tag: "a", classes: ["fp-footer-link"], children: ["fp-footer-col-1-link-1-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-footer-col-1-link-1-text", text: true, v: "The Stash" },
      { _id: "fp-footer-col-1-link-2", type: "Link", tag: "a", classes: ["fp-footer-link"], children: ["fp-footer-col-1-link-2-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-footer-col-1-link-2-text", text: true, v: "Party Packs" },
      { _id: "fp-footer-col-1-link-3", type: "Link", tag: "a", classes: ["fp-footer-link"], children: ["fp-footer-col-1-link-3-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-footer-col-1-link-3-text", text: true, v: "Pricing" },
      { _id: "fp-footer-col-1-link-4", type: "Link", tag: "a", classes: ["fp-footer-link"], children: ["fp-footer-col-1-link-4-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-footer-col-1-link-4-text", text: true, v: "Changelog" },
      // Column 2 - Community
      { _id: "fp-footer-col-2", type: "Block", tag: "div", classes: ["fp-footer-col"], children: ["fp-footer-col-2-title", "fp-footer-col-2-link-1", "fp-footer-col-2-link-2", "fp-footer-col-2-link-3", "fp-footer-col-2-link-4"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-footer-col-2-title", type: "Heading", tag: "h4", classes: ["fp-footer-col-title"], children: ["fp-footer-col-2-title-text"], data: { tag: "h4", text: false, xattr: [] } },
      { _id: "fp-footer-col-2-title-text", text: true, v: "Community" },
      { _id: "fp-footer-col-2-link-1", type: "Link", tag: "a", classes: ["fp-footer-link"], children: ["fp-footer-col-2-link-1-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-footer-col-2-link-1-text", text: true, v: "Collaborators" },
      { _id: "fp-footer-col-2-link-2", type: "Link", tag: "a", classes: ["fp-footer-link"], children: ["fp-footer-col-2-link-2-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-footer-col-2-link-2-text", text: true, v: "Discord" },
      { _id: "fp-footer-col-2-link-3", type: "Link", tag: "a", classes: ["fp-footer-link"], children: ["fp-footer-col-2-link-3-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-footer-col-2-link-3-text", text: true, v: "Showcase" },
      { _id: "fp-footer-col-2-link-4", type: "Link", tag: "a", classes: ["fp-footer-link"], children: ["fp-footer-col-2-link-4-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-footer-col-2-link-4-text", text: true, v: "Blog" },
      // Column 3 - Resources
      { _id: "fp-footer-col-3", type: "Block", tag: "div", classes: ["fp-footer-col"], children: ["fp-footer-col-3-title", "fp-footer-col-3-link-1", "fp-footer-col-3-link-2", "fp-footer-col-3-link-3", "fp-footer-col-3-link-4"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-footer-col-3-title", type: "Heading", tag: "h4", classes: ["fp-footer-col-title"], children: ["fp-footer-col-3-title-text"], data: { tag: "h4", text: false, xattr: [] } },
      { _id: "fp-footer-col-3-title-text", text: true, v: "Resources" },
      { _id: "fp-footer-col-3-link-1", type: "Link", tag: "a", classes: ["fp-footer-link"], children: ["fp-footer-col-3-link-1-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-footer-col-3-link-1-text", text: true, v: "Documentation" },
      { _id: "fp-footer-col-3-link-2", type: "Link", tag: "a", classes: ["fp-footer-link"], children: ["fp-footer-col-3-link-2-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-footer-col-3-link-2-text", text: true, v: "Tutorials" },
      { _id: "fp-footer-col-3-link-3", type: "Link", tag: "a", classes: ["fp-footer-link"], children: ["fp-footer-col-3-link-3-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-footer-col-3-link-3-text", text: true, v: "Support" },
      { _id: "fp-footer-col-3-link-4", type: "Link", tag: "a", classes: ["fp-footer-link"], children: ["fp-footer-col-3-link-4-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-footer-col-3-link-4-text", text: true, v: "FAQ" },
      // Column 4 - Legal
      { _id: "fp-footer-col-4", type: "Block", tag: "div", classes: ["fp-footer-col"], children: ["fp-footer-col-4-title", "fp-footer-col-4-link-1", "fp-footer-col-4-link-2", "fp-footer-col-4-link-3"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-footer-col-4-title", type: "Heading", tag: "h4", classes: ["fp-footer-col-title"], children: ["fp-footer-col-4-title-text"], data: { tag: "h4", text: false, xattr: [] } },
      { _id: "fp-footer-col-4-title-text", text: true, v: "Legal" },
      { _id: "fp-footer-col-4-link-1", type: "Link", tag: "a", classes: ["fp-footer-link"], children: ["fp-footer-col-4-link-1-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-footer-col-4-link-1-text", text: true, v: "Terms" },
      { _id: "fp-footer-col-4-link-2", type: "Link", tag: "a", classes: ["fp-footer-link"], children: ["fp-footer-col-4-link-2-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-footer-col-4-link-2-text", text: true, v: "Privacy" },
      { _id: "fp-footer-col-4-link-3", type: "Link", tag: "a", classes: ["fp-footer-link"], children: ["fp-footer-col-4-link-3-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-footer-col-4-link-3-text", text: true, v: "Licensing" },
      // Footer bottom
      {
        _id: "fp-footer-bottom",
        type: "Block",
        tag: "div",
        classes: ["fp-footer-bottom"],
        children: ["fp-footer-copyright", "fp-footer-credit"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-footer-copyright", type: "Block", tag: "span", classes: ["fp-footer-text"], children: ["fp-footer-copyright-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-footer-copyright-text", text: true, v: "© 2025 Flow Party. All rights reserved." },
      { _id: "fp-footer-credit", type: "Block", tag: "span", classes: ["fp-footer-text"], children: ["fp-footer-credit-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-footer-credit-text", text: true, v: "Built with Webflow" },
    ],
    styles: [
      { _id: "fp-footer", fake: false, type: "class", name: "fp-footer", namespace: "", comb: "", styleLess: "background-color: #ffffff; margin-top: 2rem; margin-bottom: 2rem; margin-left: 5vw; margin-right: 5vw; border-radius: 32px; padding: 4rem;", variants: {}, children: [] },
      { _id: "fp-footer-top", fake: false, type: "class", name: "fp-footer-top", namespace: "", comb: "", styleLess: "display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4rem;", variants: {}, children: [] },
      { _id: "fp-footer-logo", fake: false, type: "class", name: "fp-footer-logo", namespace: "", comb: "", styleLess: "font-family: 'Antonio', sans-serif; font-size: 1.5rem; font-weight: 700;", variants: {}, children: [] },
      { _id: "fp-footer-links", fake: false, type: "class", name: "fp-footer-links", namespace: "", comb: "", styleLess: "display: flex; gap: 4rem;", variants: {}, children: [] },
      { _id: "fp-footer-col", fake: false, type: "class", name: "fp-footer-col", namespace: "", comb: "", styleLess: "", variants: {}, children: [] },
      { _id: "fp-footer-col-title", fake: false, type: "class", name: "fp-footer-col-title", namespace: "", comb: "", styleLess: "font-size: 0.7rem; font-weight: 600; color: #afb6b4; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1.25rem;", variants: {}, children: [] },
      { _id: "fp-footer-link", fake: false, type: "class", name: "fp-footer-link", namespace: "", comb: "", styleLess: "display: block; color: #171717; text-decoration: none; font-size: 0.9rem; margin-bottom: 0.75rem; transition: color 0.2s;", variants: { hover: { styleLess: "color: #ff531f;" } }, children: [] },
      { _id: "fp-footer-bottom", fake: false, type: "class", name: "fp-footer-bottom", namespace: "", comb: "", styleLess: "display: flex; justify-content: space-between; padding-top: 2rem; border-top: 1px solid #dddfde;", variants: {}, children: [] },
      { _id: "fp-footer-text", fake: false, type: "class", name: "fp-footer-text", namespace: "", comb: "", styleLess: "font-size: 0.8rem; color: #afb6b4;", variants: {}, children: [] },
    ],
    assets: [],
    ix1: [],
    ix2: { interactions: [], events: [], actionLists: [] },
  },
  meta: { unlinkedSymbolCount: 0, droppedLinks: 0, dynBindRemovedCount: 0, dynListBindRemovedCount: 0, paginationRemovedCount: 0 },
}

const fpFooterCodePayload = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Party - Footer</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Antonio:wght@700&display=swap"
        rel="stylesheet">
    <style>
        /* ============================================
           DESIGN TOKENS - Flow Party
           ============================================ */
        :root {
            /* Dark Palette */
            --dark-bg: #2d2f2e;
            --dark-secondary: #434645;
            --text-light: #ffffff;
            --text-muted-dark: #767f7a;

            /* Light Palette */
            --light-bg: #f5f5f5;
            --card-bg: #ffffff;
            --text-dark: #171717;
            --text-muted: #afb6b4;
            --border: #dddfde;

            /* Coral Gradient Scale */
            --coral-lightest: #fff0eb;
            --coral-light: #ffc8b8;
            --coral-medium: #ff9d80;
            --coral-strong: #ff531f;
            --coral-vivid: #ff825c;

            /* Border Radius */
            --radius-sm: 24px;
            --radius-md: 32px;
            --radius-lg: 40px;
            --radius-xl: 48px;
            --radius-pill: 9999px;

            /* Typography */
            --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            --font-logo: 'Antonio', sans-serif;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--font-body);
            background: var(--dark-bg);
            color: var(--text-dark);
            line-height: 1.5;
        }

        /* Footer */
        .footer {
            background: var(--card-bg);
            margin: 2rem 5vw;
            border-radius: var(--radius-md);
            padding: 4rem;
        }

        .footer-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 4rem;
        }

        .footer-logo {
            font-family: var(--font-logo);
            font-size: 1.5rem;
            font-weight: 700;
        }

        .footer-logo-accent {
            color: var(--coral-strong);
        }

        .footer-links {
            display: flex;
            gap: 4rem;
        }

        .footer-col h4 {
            font-size: 0.7rem;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 1.25rem;
        }

        .footer-col a {
            display: block;
            color: var(--text-dark);
            text-decoration: none;
            font-size: 0.9rem;
            margin-bottom: 0.75rem;
            transition: color 0.2s;
        }

        .footer-col a:hover {
            color: var(--coral-strong);
        }

        .footer-bottom {
            display: flex;
            justify-content: space-between;
            padding-top: 2rem;
            border-top: 1px solid var(--border);
        }

        .footer-bottom span {
            font-size: 0.8rem;
            color: var(--text-muted);
        }

        /* Responsive */
        @media (max-width: 768px) {
            .footer {
                margin: 1rem;
                padding: 2rem;
            }

            .footer-top {
                flex-direction: column;
                gap: 2rem;
            }

            .footer-links {
                flex-wrap: wrap;
                gap: 2rem;
            }

            .footer-bottom {
                flex-direction: column;
                gap: 0.5rem;
            }
        }
    </style>
</head>

<body>
    <footer class="footer">
        <div class="footer-top">
            <span class="footer-logo">FLOW<span class="footer-logo-accent">PARTY</span>™</span>
            <div class="footer-links">
                <div class="footer-col">
                    <h4>Product</h4>
                    <a href="#">The Stash</a>
                    <a href="#">Party Packs</a>
                    <a href="#">Pricing</a>
                    <a href="#">Changelog</a>
                </div>
                <div class="footer-col">
                    <h4>Community</h4>
                    <a href="#">Collaborators</a>
                    <a href="#">Discord</a>
                    <a href="#">Showcase</a>
                    <a href="#">Blog</a>
                </div>
                <div class="footer-col">
                    <h4>Resources</h4>
                    <a href="#">Documentation</a>
                    <a href="#">Tutorials</a>
                    <a href="#">Support</a>
                    <a href="#">FAQ</a>
                </div>
                <div class="footer-col">
                    <h4>Legal</h4>
                    <a href="#">Terms</a>
                    <a href="#">Privacy</a>
                    <a href="#">Licensing</a>
                </div>
            </div>
        </div>
        <div class="footer-bottom">
            <span>© 2025 Flow Party. All rights reserved.</span>
            <span>Built with Webflow</span>
        </div>
    </footer>
</body>

</html>`

// Intro Section
const fpIntroWebflowJson = {
  type: "@webflow/XscpData",
  payload: {
    nodes: [
      {
        _id: "fp-intro-001",
        type: "Section",
        tag: "section",
        classes: ["fp-intro-section"],
        children: ["fp-intro-left", "fp-intro-right"],
        data: { tag: "section", text: false, xattr: [] },
      },
      { _id: "fp-intro-left", type: "Block", tag: "div", classes: ["fp-big-number"], children: ["fp-intro-left-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-intro-left-text", text: true, v: "0→1" },
      {
        _id: "fp-intro-right",
        type: "Block",
        tag: "div",
        classes: ["fp-intro-right"],
        children: ["fp-intro-header", "fp-intro-headline"],
        data: { tag: "div", text: false, xattr: [] },
      },
      {
        _id: "fp-intro-header",
        type: "Block",
        tag: "div",
        classes: ["fp-intro-header"],
        children: ["fp-brand-badge", "fp-trust-signals"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-brand-badge", type: "Block", tag: "span", classes: ["fp-brand-badge"], children: ["fp-brand-badge-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-brand-badge-text", text: true, v: "FLOWPARTY ™" },
      {
        _id: "fp-trust-signals",
        type: "Block",
        tag: "div",
        classes: ["fp-trust-signals"],
        children: ["fp-avatar-stack", "fp-trust-label", "fp-stars"],
        data: { tag: "div", text: false, xattr: [] },
      },
      {
        _id: "fp-avatar-stack",
        type: "Block",
        tag: "div",
        classes: ["fp-avatar-stack"],
        children: ["fp-avatar-1", "fp-avatar-2", "fp-avatar-3", "fp-avatar-4", "fp-avatar-count"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-avatar-1", type: "Block", tag: "div", classes: ["fp-avatar"], children: [], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-avatar-2", type: "Block", tag: "div", classes: ["fp-avatar"], children: [], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-avatar-3", type: "Block", tag: "div", classes: ["fp-avatar"], children: [], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-avatar-4", type: "Block", tag: "div", classes: ["fp-avatar"], children: [], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-avatar-count", type: "Block", tag: "div", classes: ["fp-avatar-count"], children: ["fp-avatar-count-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-avatar-count-text", text: true, v: "50+" },
      { _id: "fp-trust-label", type: "Block", tag: "span", classes: ["fp-trust-label"], children: ["fp-trust-label-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-trust-label-text", text: true, v: "Creative developers shipping" },
      { _id: "fp-stars", type: "Block", tag: "span", classes: ["fp-stars"], children: ["fp-stars-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-stars-text", text: true, v: "★★★★★" },
      { _id: "fp-intro-headline", type: "Heading", tag: "h3", classes: ["fp-intro-headline"], children: ["fp-intro-headline-text"], data: { tag: "h3", text: false, xattr: [] } },
      { _id: "fp-intro-headline-text", text: true, v: "Stop piecing together components from five different libraries. Get complete launch solutions—template, components, Figma file, and guides—in one Party Pack." },
    ],
    styles: [
      { _id: "fp-intro-section", fake: false, type: "class", name: "fp-intro-section", namespace: "", comb: "", styleLess: "padding: 5rem 5vw; display: grid; grid-template-columns: 1fr 2fr; gap: 4rem;", variants: {}, children: [] },
      { _id: "fp-big-number", fake: false, type: "class", name: "fp-big-number", namespace: "", comb: "", styleLess: "font-size: 7rem; font-weight: 700; color: #171717; line-height: 0.9;", variants: {}, children: [] },
      { _id: "fp-intro-right", fake: false, type: "class", name: "fp-intro-right", namespace: "", comb: "", styleLess: "", variants: {}, children: [] },
      { _id: "fp-intro-header", fake: false, type: "class", name: "fp-intro-header", namespace: "", comb: "", styleLess: "display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;", variants: {}, children: [] },
      { _id: "fp-brand-badge", fake: false, type: "class", name: "fp-brand-badge", namespace: "", comb: "", styleLess: "font-family: 'Antonio', sans-serif; font-size: 0.875rem; font-weight: 700;", variants: {}, children: [] },
      { _id: "fp-trust-signals", fake: false, type: "class", name: "fp-trust-signals", namespace: "", comb: "", styleLess: "display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end;", variants: {}, children: [] },
      { _id: "fp-avatar-stack", fake: false, type: "class", name: "fp-avatar-stack", namespace: "", comb: "", styleLess: "display: flex;", variants: {}, children: [] },
      { _id: "fp-avatar", fake: false, type: "class", name: "fp-avatar", namespace: "", comb: "", styleLess: "width: 36px; height: 36px; border-radius: 50%; border: 2px solid #f5f5f5; margin-left: -10px; background: linear-gradient(135deg, #ffc8b8, #ff531f); overflow: hidden;", variants: {}, children: [] },
      { _id: "fp-avatar-count", fake: false, type: "class", name: "fp-avatar-count", namespace: "", comb: "", styleLess: "width: 36px; height: 36px; border-radius: 50%; background-color: #171717; color: #ffffff; font-size: 0.65rem; font-weight: 600; display: flex; align-items: center; justify-content: center; margin-left: -10px;", variants: {}, children: [] },
      { _id: "fp-trust-label", fake: false, type: "class", name: "fp-trust-label", namespace: "", comb: "", styleLess: "font-size: 0.75rem; color: #afb6b4;", variants: {}, children: [] },
      { _id: "fp-stars", fake: false, type: "class", name: "fp-stars", namespace: "", comb: "", styleLess: "color: #ff531f; font-size: 0.875rem;", variants: {}, children: [] },
      { _id: "fp-intro-headline", fake: false, type: "class", name: "fp-intro-headline", namespace: "", comb: "", styleLess: "font-size: 2rem; font-weight: 600; line-height: 1.3; max-width: 520px;", variants: {}, children: [] },
    ],
    assets: [],
    ix1: [],
    ix2: { interactions: [], events: [], actionLists: [] },
  },
  meta: { unlinkedSymbolCount: 0, droppedLinks: 0, dynBindRemovedCount: 0, dynListBindRemovedCount: 0, paginationRemovedCount: 0 },
}

const fpIntroCodePayload = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Party - Intro Section</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Antonio:wght@700&display=swap"
        rel="stylesheet">
    <style>
        /* ============================================
           DESIGN TOKENS - Flow Party
           ============================================ */
        :root {
            /* Dark Palette */
            --dark-bg: #2d2f2e;
            --dark-secondary: #434645;
            --text-light: #ffffff;
            --text-muted-dark: #767f7a;

            /* Light Palette */
            --light-bg: #f5f5f5;
            --card-bg: #ffffff;
            --text-dark: #171717;
            --text-muted: #afb6b4;
            --border: #dddfde;

            /* Coral Gradient Scale */
            --coral-lightest: #fff0eb;
            --coral-light: #ffc8b8;
            --coral-medium: #ff9d80;
            --coral-strong: #ff531f;
            --coral-vivid: #ff825c;

            /* Border Radius */
            --radius-sm: 24px;
            --radius-md: 32px;
            --radius-lg: 40px;
            --radius-xl: 48px;
            --radius-pill: 9999px;

            /* Typography */
            --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            --font-logo: 'Antonio', sans-serif;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--font-body);
            background: var(--light-bg);
            color: var(--text-dark);
            line-height: 1.5;
        }

        /* Intro Section */
        .intro-section {
            padding: 5rem 5vw;
            display: grid;
            grid-template-columns: 1fr 2fr;
            gap: 4rem;
        }

        .big-number {
            font-size: clamp(4rem, 9vw, 7rem);
            font-weight: 700;
            color: var(--text-dark);
            line-height: 0.9;
        }

        .intro-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 2rem;
        }

        .brand-badge {
            font-family: var(--font-logo);
            font-size: 0.875rem;
            font-weight: 700;
        }

        .trust-signals {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            align-items: flex-end;
        }

        .avatar-stack {
            display: flex;
        }

        .avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 2px solid var(--light-bg);
            margin-left: -10px;
            background: linear-gradient(135deg, var(--coral-light), var(--coral-strong));
            overflow: hidden;
        }

        .avatar:first-child {
            margin-left: 0;
        }

        .avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .avatar-count {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: var(--text-dark);
            color: var(--text-light);
            font-size: 0.65rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: -10px;
        }

        .trust-label {
            font-size: 0.75rem;
            color: var(--text-muted);
        }

        .stars {
            color: var(--coral-strong);
            font-size: 0.875rem;
        }

        .intro-headline {
            font-size: clamp(1.5rem, 2.5vw, 2rem);
            font-weight: 600;
            line-height: 1.3;
            max-width: 520px;
        }

        /* Responsive */
        @media (max-width: 1024px) {
            .intro-section {
                grid-template-columns: 1fr;
                gap: 2rem;
            }
        }

        @media (max-width: 768px) {
            .intro-section {
                padding: 3rem 5vw;
            }

            .intro-header {
                flex-direction: column;
                gap: 1.5rem;
            }

            .trust-signals {
                align-items: flex-start;
            }
        }
    </style>
</head>

<body>
    <section class="intro-section">
        <div class="big-number">0→1</div>
        <div class="intro-right">
            <div class="intro-header">
                <span class="brand-badge">FLOWPARTY ™</span>
                <div class="trust-signals">
                    <div class="avatar-stack">
                        <div class="avatar" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                        </div>
                        <div class="avatar" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                        </div>
                        <div class="avatar" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
                        </div>
                        <div class="avatar" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);">
                        </div>
                        <div class="avatar-count">50+</div>
                    </div>
                    <span class="trust-label">Creative developers shipping</span>
                    <span class="stars">★★★★★</span>
                </div>
            </div>
            <h3 class="intro-headline">
                Stop piecing together components from five different libraries.
                Get complete launch solutions—template, components, Figma file, and guides—in one Party Pack.
            </h3>
        </div>
    </section>
</body>

</html>`

// FAQ Section
const fpFaqWebflowJson = {
  type: "@webflow/XscpData",
  payload: {
    nodes: [
      {
        _id: "fp-faq-001",
        type: "Section",
        tag: "section",
        classes: ["fp-faq-section"],
        children: ["fp-faq-container"],
        data: { tag: "section", text: false, xattr: [{ name: "id", value: "faq" }] },
      },
      {
        _id: "fp-faq-container",
        type: "Block",
        tag: "div",
        classes: ["fp-faq-container"],
        children: ["fp-faq-left", "fp-faq-right"],
        data: { tag: "div", text: false, xattr: [] },
      },
      {
        _id: "fp-faq-left",
        type: "Block",
        tag: "div",
        classes: ["fp-faq-left"],
        children: ["fp-faq-title", "fp-faq-desc", "fp-faq-link"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-faq-title", type: "Heading", tag: "h2", classes: ["fp-faq-title"], children: ["fp-faq-title-text"], data: { tag: "h2", text: false, xattr: [] } },
      { _id: "fp-faq-title-text", text: true, v: "FAQ" },
      { _id: "fp-faq-desc", type: "Paragraph", tag: "p", classes: ["fp-faq-desc"], children: ["fp-faq-desc-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-faq-desc-text", text: true, v: "Common questions about Flow Party and how it works." },
      { _id: "fp-faq-link", type: "Link", tag: "a", classes: ["fp-link-arrow"], children: ["fp-faq-link-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-faq-link-text", text: true, v: "Contact support →" },
      {
        _id: "fp-faq-right",
        type: "Block",
        tag: "div",
        classes: ["fp-faq-right"],
        children: ["fp-faq-item-1", "fp-faq-item-2", "fp-faq-item-3"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-faq-item-1", type: "Block", tag: "div", classes: ["fp-faq-item"], children: ["fp-faq-q-row-1", "fp-faq-answer-1"], data: { tag: "div", text: false, xattr: [{ name: "data-faq", value: "" }] } },
      { _id: "fp-faq-q-row-1", type: "Block", tag: "div", classes: ["fp-faq-question-row"], children: ["fp-faq-q-1", "fp-faq-num-1"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-faq-q-1", type: "Block", tag: "span", classes: ["fp-faq-question"], children: ["fp-faq-q-1-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-faq-q-1-text", text: true, v: "How does copy & paste work?" },
      { _id: "fp-faq-num-1", type: "Block", tag: "span", classes: ["fp-faq-number"], children: ["fp-faq-num-1-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-faq-num-1-text", text: true, v: "01" },
      { _id: "fp-faq-answer-1", type: "Block", tag: "div", classes: ["fp-faq-answer"], children: ["fp-faq-answer-1-p"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-faq-answer-1-p", type: "Paragraph", tag: "p", classes: [], children: ["fp-faq-answer-1-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-faq-answer-1-text", text: true, v: "Click copy on any component in The Stash, then paste directly into your Webflow Designer. The component arrives with all classes, interactions, and settings intact." },
      { _id: "fp-faq-item-2", type: "Block", tag: "div", classes: ["fp-faq-item"], children: ["fp-faq-q-row-2", "fp-faq-answer-2"], data: { tag: "div", text: false, xattr: [{ name: "data-faq", value: "" }] } },
      { _id: "fp-faq-q-row-2", type: "Block", tag: "div", classes: ["fp-faq-question-row"], children: ["fp-faq-q-2", "fp-faq-num-2"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-faq-q-2", type: "Block", tag: "span", classes: ["fp-faq-question"], children: ["fp-faq-q-2-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-faq-q-2-text", text: true, v: "What's included in a Party Pack?" },
      { _id: "fp-faq-num-2", type: "Block", tag: "span", classes: ["fp-faq-number"], children: ["fp-faq-num-2-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-faq-num-2-text", text: true, v: "02" },
      { _id: "fp-faq-answer-2", type: "Block", tag: "div", classes: ["fp-faq-answer"], children: ["fp-faq-answer-2-p"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-faq-answer-2-p", type: "Paragraph", tag: "p", classes: [], children: ["fp-faq-answer-2-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-faq-answer-2-text", text: true, v: "Each Party Pack includes a complete Webflow template, matching component library, Figma source files, and a detailed launch guide." },
      { _id: "fp-faq-item-3", type: "Block", tag: "div", classes: ["fp-faq-item"], children: ["fp-faq-q-row-3", "fp-faq-answer-3"], data: { tag: "div", text: false, xattr: [{ name: "data-faq", value: "" }] } },
      { _id: "fp-faq-q-row-3", type: "Block", tag: "div", classes: ["fp-faq-question-row"], children: ["fp-faq-q-3", "fp-faq-num-3"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-faq-q-3", type: "Block", tag: "span", classes: ["fp-faq-question"], children: ["fp-faq-q-3-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-faq-q-3-text", text: true, v: "Can I use resources for client projects?" },
      { _id: "fp-faq-num-3", type: "Block", tag: "span", classes: ["fp-faq-number"], children: ["fp-faq-num-3-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-faq-num-3-text", text: true, v: "03" },
      { _id: "fp-faq-answer-3", type: "Block", tag: "div", classes: ["fp-faq-answer"], children: ["fp-faq-answer-3-p"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-faq-answer-3-p", type: "Paragraph", tag: "p", classes: [], children: ["fp-faq-answer-3-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-faq-answer-3-text", text: true, v: "Yes! All resources come with a commercial license. Use them for unlimited personal and client projects." },
    ],
    styles: [
      { _id: "fp-faq-section", fake: false, type: "class", name: "fp-faq-section", namespace: "", comb: "", styleLess: "background-color: #f5f5f5; padding: 6rem 5vw;", variants: {}, children: [] },
      { _id: "fp-faq-container", fake: false, type: "class", name: "fp-faq-container", namespace: "", comb: "", styleLess: "display: grid; grid-template-columns: 1fr 2fr; gap: 4rem;", variants: {}, children: [] },
      { _id: "fp-faq-left", fake: false, type: "class", name: "fp-faq-left", namespace: "", comb: "", styleLess: "", variants: {}, children: [] },
      { _id: "fp-faq-title", fake: false, type: "class", name: "fp-faq-title", namespace: "", comb: "", styleLess: "font-size: 4rem; font-weight: 700; margin-bottom: 1.5rem;", variants: {}, children: [] },
      { _id: "fp-faq-desc", fake: false, type: "class", name: "fp-faq-desc", namespace: "", comb: "", styleLess: "font-size: 1rem; color: #afb6b4; margin-bottom: 2rem; max-width: 280px;", variants: {}, children: [] },
      { _id: "fp-link-arrow", fake: false, type: "class", name: "fp-link-arrow", namespace: "", comb: "", styleLess: "color: #ff531f; font-size: 0.875rem; font-weight: 500; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem; transition: gap 0.2s ease;", variants: { hover: { styleLess: "gap: 0.75rem;" } }, children: [] },
      { _id: "fp-faq-right", fake: false, type: "class", name: "fp-faq-right", namespace: "", comb: "", styleLess: "", variants: {}, children: [] },
      { _id: "fp-faq-item", fake: false, type: "class", name: "fp-faq-item", namespace: "", comb: "", styleLess: "padding: 1.5rem 0; border-bottom: 1px solid #dddfde; cursor: pointer;", variants: {}, children: [] },
      { _id: "fp-faq-question-row", fake: false, type: "class", name: "fp-faq-question-row", namespace: "", comb: "", styleLess: "display: flex; justify-content: space-between; align-items: center;", variants: {}, children: [] },
      { _id: "fp-faq-question", fake: false, type: "class", name: "fp-faq-question", namespace: "", comb: "", styleLess: "font-size: 1rem; font-weight: 500; transition: color 0.2s;", variants: {}, children: [] },
      { _id: "fp-faq-number", fake: false, type: "class", name: "fp-faq-number", namespace: "", comb: "", styleLess: "font-size: 1.5rem; font-weight: 700; opacity: 0.15; transition: opacity 0.2s, color 0.2s;", variants: {}, children: [] },
      { _id: "fp-faq-answer", fake: false, type: "class", name: "fp-faq-answer", namespace: "", comb: "", styleLess: "max-height: 0; overflow: hidden; transition: max-height 0.4s ease, padding 0.4s ease;", variants: {}, children: [] },
    ],
    assets: [],
    ix1: [],
    ix2: { interactions: [], events: [], actionLists: [] },
  },
  meta: { unlinkedSymbolCount: 0, droppedLinks: 0, dynBindRemovedCount: 0, dynListBindRemovedCount: 0, paginationRemovedCount: 0 },
}

const fpFaqCodePayload = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Party - FAQ</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet">
    <style>
        /* ============================================
           DESIGN TOKENS - Flow Party
           ============================================ */
        :root {
            /* Dark Palette */
            --dark-bg: #2d2f2e;
            --dark-secondary: #434645;
            --text-light: #ffffff;
            --text-muted-dark: #767f7a;

            /* Light Palette */
            --light-bg: #f5f5f5;
            --card-bg: #ffffff;
            --text-dark: #171717;
            --text-muted: #afb6b4;
            --border: #dddfde;

            /* Coral Gradient Scale */
            --coral-lightest: #fff0eb;
            --coral-light: #ffc8b8;
            --coral-medium: #ff9d80;
            --coral-strong: #ff531f;
            --coral-vivid: #ff825c;

            /* Border Radius */
            --radius-sm: 24px;
            --radius-md: 32px;
            --radius-lg: 40px;
            --radius-xl: 48px;
            --radius-pill: 9999px;

            /* Typography */
            --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            --font-logo: 'Antonio', sans-serif;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--font-body);
            background: var(--light-bg);
            color: var(--text-dark);
            line-height: 1.5;
        }

        /* FAQ Section */
        .faq-section {
            padding: 6rem 5vw;
        }

        .faq-container {
            display: grid;
            grid-template-columns: 1fr 2fr;
            gap: 4rem;
        }

        .faq-left h2 {
            font-size: clamp(2.5rem, 6vw, 4rem);
            font-weight: 700;
            margin-bottom: 1.5rem;
        }

        .faq-left>p {
            font-size: 1rem;
            color: var(--text-muted);
            margin-bottom: 2rem;
            max-width: 280px;
        }

        .link-arrow {
            color: var(--coral-strong);
            font-size: 0.875rem;
            font-weight: 500;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            transition: gap 0.2s ease;
        }

        .link-arrow:hover {
            gap: 0.75rem;
        }

        .faq-item {
            padding: 1.5rem 0;
            border-bottom: 1px solid var(--border);
            cursor: pointer;
        }

        .faq-question-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .faq-question {
            font-size: 1rem;
            font-weight: 500;
            transition: color 0.2s;
        }

        .faq-item:hover .faq-question {
            color: var(--coral-strong);
        }

        .faq-number {
            font-size: 1.5rem;
            font-weight: 700;
            opacity: 0.15;
            transition: opacity 0.2s, color 0.2s;
        }

        .faq-item:hover .faq-number,
        .faq-item.active .faq-number {
            opacity: 1;
            color: var(--coral-strong);
        }

        .faq-answer {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.4s ease, padding 0.4s ease;
        }

        .faq-item.active .faq-answer {
            max-height: 200px;
            padding-top: 1rem;
        }

        .faq-answer p {
            font-size: 0.9rem;
            color: var(--text-muted);
            line-height: 1.6;
        }

        /* Responsive */
        @media (max-width: 1024px) {
            .faq-container {
                grid-template-columns: 1fr;
                gap: 2rem;
            }
        }

        @media (max-width: 768px) {
            .faq-section {
                padding: 4rem 5vw;
            }
        }
    </style>
</head>

<body>
    <section class="faq-section" id="faq">
        <div class="faq-container">
            <div class="faq-left">
                <h2>FAQ</h2>
                <p>Common questions about Flow Party and how it works.</p>
                <a href="#" class="link-arrow">Contact support →</a>
            </div>
            <div class="faq-right">
                <div class="faq-item" data-faq>
                    <div class="faq-question-row">
                        <span class="faq-question">How does copy & paste work?</span>
                        <span class="faq-number">01</span>
                    </div>
                    <div class="faq-answer">
                        <p>Click copy on any component in The Stash, then paste directly into your Webflow Designer. The
                            component arrives with all classes, interactions, and settings intact. No plugins required.
                        </p>
                    </div>
                </div>
                <div class="faq-item" data-faq>
                    <div class="faq-question-row">
                        <span class="faq-question">What's included in a Party Pack?</span>
                        <span class="faq-number">02</span>
                    </div>
                    <div class="faq-answer">
                        <p>Each Party Pack includes a complete Webflow template, matching component library, Figma
                            source files, and a detailed launch guide. Everything you need to ship a polished site.</p>
                    </div>
                </div>
                <div class="faq-item" data-faq>
                    <div class="faq-question-row">
                        <span class="faq-question">Can I use resources for client projects?</span>
                        <span class="faq-number">03</span>
                    </div>
                    <div class="faq-answer">
                        <p>Yes! All resources come with a commercial license. Use them for unlimited personal and client
                            projects. The only restriction is redistributing or reselling the raw assets.</p>
                    </div>
                </div>
                <div class="faq-item" data-faq>
                    <div class="faq-question-row">
                        <span class="faq-question">Do I need GSAP knowledge?</span>
                        <span class="faq-number">04</span>
                    </div>
                    <div class="faq-answer">
                        <p>Nope. Interactions work out of the box. But if you want to customize, we include
                            documentation explaining how each animation works so you can learn as you build.</p>
                    </div>
                </div>
                <div class="faq-item" data-faq>
                    <div class="faq-question-row">
                        <span class="faq-question">What if I cancel my subscription?</span>
                        <span class="faq-number">05</span>
                    </div>
                    <div class="faq-answer">
                        <p>You keep access to everything you've already copied or downloaded. You just won't be able to
                            access new resources or updates until you resubscribe.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <script>
        // FAQ accordion
        document.querySelectorAll('[data-faq]').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('[data-faq]').forEach(other => {
                    if (other !== item) other.classList.remove('active');
                });
                item.classList.toggle('active');
            });
        });
    </script>
</body>

</html>`

// Features Section
const fpFeaturesWebflowJson = {
  type: "@webflow/XscpData",
  payload: {
    nodes: [
      {
        _id: "fp-features-001",
        type: "Section",
        tag: "section",
        classes: ["fp-features-section"],
        children: ["fp-features-header", "fp-features-list"],
        data: { tag: "section", text: false, xattr: [{ name: "id", value: "features" }] },
      },
      {
        _id: "fp-features-header",
        type: "Block",
        tag: "div",
        classes: ["fp-features-header"],
        children: ["fp-features-label", "fp-features-intro"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-features-label", type: "Block", tag: "span", classes: ["fp-features-label"], children: ["fp-features-label-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-features-label-text", text: true, v: "(02)" },
      {
        _id: "fp-features-intro",
        type: "Block",
        tag: "div",
        classes: ["fp-features-intro"],
        children: ["fp-features-intro-p"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-features-intro-p", type: "Paragraph", tag: "p", classes: [], children: ["fp-features-intro-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-features-intro-text", text: true, v: "Built different. Every resource in The Stash is crafted with production quality in mind—not just pretty demos." },
      {
        _id: "fp-features-list",
        type: "Block",
        tag: "div",
        classes: ["fp-features-list"],
        children: ["fp-feature-row-1", "fp-feature-row-2", "fp-feature-row-3", "fp-feature-row-4"],
        data: { tag: "div", text: false, xattr: [] },
      },
      // Feature Row 1
      { _id: "fp-feature-row-1", type: "Block", tag: "div", classes: ["fp-feature-row"], children: ["fp-feature-name-1", "fp-feature-tags-1"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-feature-name-1", type: "Heading", tag: "h3", classes: ["fp-feature-name"], children: ["fp-feature-name-1-text"], data: { tag: "h3", text: false, xattr: [] } },
      { _id: "fp-feature-name-1-text", text: true, v: "Copy & Paste Ready" },
      { _id: "fp-feature-tags-1", type: "Block", tag: "div", classes: ["fp-feature-tags"], children: ["fp-tag-1-1", "fp-tag-1-2", "fp-tag-1-3"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-tag-1-1", type: "Block", tag: "span", classes: [], children: ["fp-tag-1-1-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-tag-1-1-text", text: true, v: "Webflow native" },
      { _id: "fp-tag-1-2", type: "Block", tag: "span", classes: [], children: ["fp-tag-1-2-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-tag-1-2-text", text: true, v: "No plugins required" },
      { _id: "fp-tag-1-3", type: "Block", tag: "span", classes: [], children: ["fp-tag-1-3-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-tag-1-3-text", text: true, v: "Clean class naming" },
      // Feature Row 2
      { _id: "fp-feature-row-2", type: "Block", tag: "div", classes: ["fp-feature-row"], children: ["fp-feature-name-2", "fp-feature-tags-2"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-feature-name-2", type: "Heading", tag: "h3", classes: ["fp-feature-name"], children: ["fp-feature-name-2-text"], data: { tag: "h3", text: false, xattr: [] } },
      { _id: "fp-feature-name-2-text", text: true, v: "GSAP Interactions" },
      { _id: "fp-feature-tags-2", type: "Block", tag: "div", classes: ["fp-feature-tags"], children: ["fp-tag-2-1", "fp-tag-2-2", "fp-tag-2-3"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-tag-2-1", type: "Block", tag: "span", classes: [], children: ["fp-tag-2-1-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-tag-2-1-text", text: true, v: "ScrollTrigger" },
      { _id: "fp-tag-2-2", type: "Block", tag: "span", classes: [], children: ["fp-tag-2-2-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-tag-2-2-text", text: true, v: "SplitText" },
      { _id: "fp-tag-2-3", type: "Block", tag: "span", classes: [], children: ["fp-tag-2-3-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-tag-2-3-text", text: true, v: "Flip animations" },
      // Feature Row 3
      { _id: "fp-feature-row-3", type: "Block", tag: "div", classes: ["fp-feature-row"], children: ["fp-feature-name-3", "fp-feature-tags-3"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-feature-name-3", type: "Heading", tag: "h3", classes: ["fp-feature-name"], children: ["fp-feature-name-3-text"], data: { tag: "h3", text: false, xattr: [] } },
      { _id: "fp-feature-name-3-text", text: true, v: "Figma Included" },
      { _id: "fp-feature-tags-3", type: "Block", tag: "div", classes: ["fp-feature-tags"], children: ["fp-tag-3-1", "fp-tag-3-2", "fp-tag-3-3"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-tag-3-1", type: "Block", tag: "span", classes: [], children: ["fp-tag-3-1-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-tag-3-1-text", text: true, v: "Auto-layout" },
      { _id: "fp-tag-3-2", type: "Block", tag: "span", classes: [], children: ["fp-tag-3-2-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-tag-3-2-text", text: true, v: "Design tokens" },
      { _id: "fp-tag-3-3", type: "Block", tag: "span", classes: [], children: ["fp-tag-3-3-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-tag-3-3-text", text: true, v: "Component variants" },
      // Feature Row 4
      { _id: "fp-feature-row-4", type: "Block", tag: "div", classes: ["fp-feature-row"], children: ["fp-feature-name-4", "fp-feature-tags-4"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-feature-name-4", type: "Heading", tag: "h3", classes: ["fp-feature-name"], children: ["fp-feature-name-4-text"], data: { tag: "h3", text: false, xattr: [] } },
      { _id: "fp-feature-name-4-text", text: true, v: "Launch Guides" },
      { _id: "fp-feature-tags-4", type: "Block", tag: "div", classes: ["fp-feature-tags"], children: ["fp-tag-4-1", "fp-tag-4-2", "fp-tag-4-3"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-tag-4-1", type: "Block", tag: "span", classes: [], children: ["fp-tag-4-1-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-tag-4-1-text", text: true, v: "Setup walkthroughs" },
      { _id: "fp-tag-4-2", type: "Block", tag: "span", classes: [], children: ["fp-tag-4-2-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-tag-4-2-text", text: true, v: "Customization tips" },
      { _id: "fp-tag-4-3", type: "Block", tag: "span", classes: [], children: ["fp-tag-4-3-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-tag-4-3-text", text: true, v: "Best practices" },
    ],
    styles: [
      { _id: "fp-features-section", fake: false, type: "class", name: "fp-features-section", namespace: "", comb: "", styleLess: "background-color: #2d2f2e; padding: 6rem 5vw;", variants: {}, children: [] },
      { _id: "fp-features-header", fake: false, type: "class", name: "fp-features-header", namespace: "", comb: "", styleLess: "display: grid; grid-template-columns: auto 1fr; gap: 4rem; margin-bottom: 4rem; padding-bottom: 3rem; border-bottom: 1px solid rgba(255,255,255,0.1);", variants: {}, children: [] },
      { _id: "fp-features-label", fake: false, type: "class", name: "fp-features-label", namespace: "", comb: "", styleLess: "font-size: 0.875rem; color: #767f7a;", variants: {}, children: [] },
      { _id: "fp-features-intro", fake: false, type: "class", name: "fp-features-intro", namespace: "", comb: "", styleLess: "font-size: 1.25rem; font-weight: 500; color: #ffffff; line-height: 1.4; max-width: 500px;", variants: {}, children: [] },
      { _id: "fp-features-list", fake: false, type: "class", name: "fp-features-list", namespace: "", comb: "", styleLess: "", variants: {}, children: [] },
      { _id: "fp-feature-row", fake: false, type: "class", name: "fp-feature-row", namespace: "", comb: "", styleLess: "display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; padding: 2.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: default; transition: padding-left 0.3s ease;", variants: { hover: { styleLess: "padding-left: 1rem;" }, "last-child": { styleLess: "border-bottom: none;" } }, children: [] },
      { _id: "fp-feature-name", fake: false, type: "class", name: "fp-feature-name", namespace: "", comb: "", styleLess: "font-size: 2.5rem; font-weight: 600; color: #ffffff; transition: color 0.3s ease;", variants: {}, children: [] },
      { _id: "fp-feature-tags", fake: false, type: "class", name: "fp-feature-tags", namespace: "", comb: "", styleLess: "display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem;", variants: {}, children: [] },
    ],
    assets: [],
    ix1: [],
    ix2: { interactions: [], events: [], actionLists: [] },
  },
  meta: { unlinkedSymbolCount: 0, droppedLinks: 0, dynBindRemovedCount: 0, dynListBindRemovedCount: 0, paginationRemovedCount: 0 },
}

const fpFeaturesCodePayload = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Party - Features</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet">
    <style>
        /* ============================================
           DESIGN TOKENS - Flow Party
           ============================================ */
        :root {
            /* Dark Palette */
            --dark-bg: #2d2f2e;
            --dark-secondary: #434645;
            --text-light: #ffffff;
            --text-muted-dark: #767f7a;

            /* Light Palette */
            --light-bg: #f5f5f5;
            --card-bg: #ffffff;
            --text-dark: #171717;
            --text-muted: #afb6b4;
            --border: #dddfde;

            /* Coral Gradient Scale */
            --coral-lightest: #fff0eb;
            --coral-light: #ffc8b8;
            --coral-medium: #ff9d80;
            --coral-strong: #ff531f;
            --coral-vivid: #ff825c;

            /* Border Radius */
            --radius-sm: 24px;
            --radius-md: 32px;
            --radius-lg: 40px;
            --radius-xl: 48px;
            --radius-pill: 9999px;

            /* Typography */
            --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            --font-logo: 'Antonio', sans-serif;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--font-body);
            background: var(--dark-bg);
            color: var(--text-light);
            line-height: 1.5;
        }

        /* Features Section */
        .features-section {
            padding: 6rem 5vw;
        }

        .features-header {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 4rem;
            margin-bottom: 4rem;
            padding-bottom: 3rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .features-label {
            font-size: 0.875rem;
            color: var(--text-muted-dark);
        }

        .features-intro p {
            font-size: 1.25rem;
            font-weight: 500;
            color: var(--text-light);
            line-height: 1.4;
            margin-bottom: 1.5rem;
            max-width: 500px;
        }

        .feature-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4rem;
            align-items: center;
            padding: 2.5rem 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            cursor: default;
            transition: padding-left 0.3s ease;
        }

        .feature-row:hover {
            padding-left: 1rem;
        }

        .feature-row:last-child {
            border-bottom: none;
        }

        .feature-name {
            font-size: clamp(1.5rem, 3.5vw, 2.5rem);
            font-weight: 600;
            color: var(--text-light);
            transition: color 0.3s ease;
        }

        .feature-row:hover .feature-name {
            color: var(--coral-vivid);
        }

        .feature-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem 1.5rem;
        }

        .feature-tags span {
            font-size: 0.875rem;
            color: var(--text-muted-dark);
            white-space: nowrap;
        }

        /* Responsive */
        @media (max-width: 1024px) {
            .features-header {
                grid-template-columns: 1fr;
                gap: 2rem;
            }

            .feature-row {
                grid-template-columns: 1fr;
                gap: 1rem;
            }
        }

        @media (max-width: 768px) {
            .features-section {
                padding: 4rem 5vw;
            }
        }
    </style>
</head>

<body>
    <section class="features-section" id="features">
        <div class="features-header">
            <span class="features-label">(02)</span>
            <div class="features-intro">
                <p>Built different. Every resource in The Stash is crafted with production quality in mind—not just
                    pretty demos.</p>
            </div>
        </div>
        <div class="feature-row">
            <h3 class="feature-name">Copy & Paste Ready</h3>
            <div class="feature-tags">
                <span>Webflow native</span>
                <span>No plugins required</span>
                <span>Clean class naming</span>
            </div>
        </div>
        <div class="feature-row">
            <h3 class="feature-name">GSAP Interactions</h3>
            <div class="feature-tags">
                <span>ScrollTrigger</span>
                <span>SplitText</span>
                <span>Flip animations</span>
            </div>
        </div>
        <div class="feature-row">
            <h3 class="feature-name">Figma Included</h3>
            <div class="feature-tags">
                <span>Auto-layout</span>
                <span>Design tokens</span>
                <span>Component variants</span>
            </div>
        </div>
        <div class="feature-row">
            <h3 class="feature-name">Launch Guides</h3>
            <div class="feature-tags">
                <span>Setup walkthroughs</span>
                <span>Customization tips</span>
                <span>Best practices</span>
            </div>
        </div>
    </section>
</body>

</html>`

// Collaborators Section
const fpCollaboratorsWebflowJson = {
  type: "@webflow/XscpData",
  payload: {
    nodes: [
      {
        _id: "fp-collab-001",
        type: "Section",
        tag: "section",
        classes: ["fp-collaborators-section"],
        children: ["fp-collab-header", "fp-collab-grid"],
        data: { tag: "section", text: false, xattr: [{ name: "id", value: "collaborators" }] },
      },
      {
        _id: "fp-collab-header",
        type: "Block",
        tag: "div",
        classes: ["fp-collaborators-header"],
        children: ["fp-collab-title", "fp-collab-desc"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-collab-title", type: "Heading", tag: "h2", classes: ["fp-collab-title"], children: ["fp-collab-title-text"], data: { tag: "h2", text: false, xattr: [] } },
      { _id: "fp-collab-title-text", text: true, v: "Collaborators" },
      { _id: "fp-collab-desc", type: "Paragraph", tag: "p", classes: ["fp-collab-desc"], children: ["fp-collab-desc-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-collab-desc-text", text: true, v: "Learn from the best. Our collaborators are award-winning designers and developers who teach what they ship." },
      {
        _id: "fp-collab-grid",
        type: "Block",
        tag: "div",
        classes: ["fp-collaborators-grid"],
        children: ["fp-collab-card-1", "fp-collab-card-2", "fp-collab-card-3", "fp-collab-card-4"],
        data: { tag: "div", text: false, xattr: [] },
      },
      // Card 1
      { _id: "fp-collab-card-1", type: "Block", tag: "div", classes: ["fp-collaborator-card"], children: ["fp-collab-avatar-1", "fp-collab-name-1", "fp-collab-role-1", "fp-collab-stats-1"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-collab-avatar-1", type: "Block", tag: "div", classes: ["fp-collaborator-avatar"], children: [], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-collab-name-1", type: "Heading", tag: "h4", classes: ["fp-collaborator-name"], children: ["fp-collab-name-1-text"], data: { tag: "h4", text: false, xattr: [] } },
      { _id: "fp-collab-name-1-text", text: true, v: "Alex Rivera" },
      { _id: "fp-collab-role-1", type: "Paragraph", tag: "p", classes: ["fp-collaborator-role"], children: ["fp-collab-role-1-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-collab-role-1-text", text: true, v: "Creative Developer" },
      { _id: "fp-collab-stats-1", type: "Block", tag: "div", classes: ["fp-collaborator-stats"], children: ["fp-collab-stat-1a", "fp-collab-stat-1b"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-collab-stat-1a", type: "Block", tag: "div", classes: [], children: ["fp-collab-stat-1a-val", "fp-collab-stat-1a-label"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-collab-stat-1a-val", type: "Block", tag: "div", classes: ["fp-collab-stat-value"], children: ["fp-collab-stat-1a-val-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-collab-stat-1a-val-text", text: true, v: "12" },
      { _id: "fp-collab-stat-1a-label", type: "Block", tag: "div", classes: ["fp-collab-stat-label"], children: ["fp-collab-stat-1a-label-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-collab-stat-1a-label-text", text: true, v: "Resources" },
      { _id: "fp-collab-stat-1b", type: "Block", tag: "div", classes: [], children: ["fp-collab-stat-1b-val", "fp-collab-stat-1b-label"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-collab-stat-1b-val", type: "Block", tag: "div", classes: ["fp-collab-stat-value"], children: ["fp-collab-stat-1b-val-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-collab-stat-1b-val-text", text: true, v: "2.4k" },
      { _id: "fp-collab-stat-1b-label", type: "Block", tag: "div", classes: ["fp-collab-stat-label"], children: ["fp-collab-stat-1b-label-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-collab-stat-1b-label-text", text: true, v: "Downloads" },
      // Card 2 (simplified)
      { _id: "fp-collab-card-2", type: "Block", tag: "div", classes: ["fp-collaborator-card"], children: ["fp-collab-avatar-2", "fp-collab-name-2", "fp-collab-role-2", "fp-collab-stats-2"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-collab-avatar-2", type: "Block", tag: "div", classes: ["fp-collaborator-avatar"], children: [], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-collab-name-2", type: "Heading", tag: "h4", classes: ["fp-collaborator-name"], children: ["fp-collab-name-2-text"], data: { tag: "h4", text: false, xattr: [] } },
      { _id: "fp-collab-name-2-text", text: true, v: "Maya Johnson" },
      { _id: "fp-collab-role-2", type: "Paragraph", tag: "p", classes: ["fp-collaborator-role"], children: ["fp-collab-role-2-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-collab-role-2-text", text: true, v: "UI/UX Designer" },
      { _id: "fp-collab-stats-2", type: "Block", tag: "div", classes: ["fp-collaborator-stats"], children: [], data: { tag: "div", text: false, xattr: [] } },
      // Card 3
      { _id: "fp-collab-card-3", type: "Block", tag: "div", classes: ["fp-collaborator-card"], children: ["fp-collab-avatar-3", "fp-collab-name-3", "fp-collab-role-3", "fp-collab-stats-3"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-collab-avatar-3", type: "Block", tag: "div", classes: ["fp-collaborator-avatar"], children: [], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-collab-name-3", type: "Heading", tag: "h4", classes: ["fp-collaborator-name"], children: ["fp-collab-name-3-text"], data: { tag: "h4", text: false, xattr: [] } },
      { _id: "fp-collab-name-3-text", text: true, v: "James Park" },
      { _id: "fp-collab-role-3", type: "Paragraph", tag: "p", classes: ["fp-collaborator-role"], children: ["fp-collab-role-3-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-collab-role-3-text", text: true, v: "Motion Designer" },
      { _id: "fp-collab-stats-3", type: "Block", tag: "div", classes: ["fp-collaborator-stats"], children: [], data: { tag: "div", text: false, xattr: [] } },
      // Card 4
      { _id: "fp-collab-card-4", type: "Block", tag: "div", classes: ["fp-collaborator-card"], children: ["fp-collab-avatar-4", "fp-collab-name-4", "fp-collab-role-4", "fp-collab-stats-4"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-collab-avatar-4", type: "Block", tag: "div", classes: ["fp-collaborator-avatar"], children: [], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-collab-name-4", type: "Heading", tag: "h4", classes: ["fp-collaborator-name"], children: ["fp-collab-name-4-text"], data: { tag: "h4", text: false, xattr: [] } },
      { _id: "fp-collab-name-4-text", text: true, v: "Emma Wilson" },
      { _id: "fp-collab-role-4", type: "Paragraph", tag: "p", classes: ["fp-collaborator-role"], children: ["fp-collab-role-4-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-collab-role-4-text", text: true, v: "Webflow Expert" },
      { _id: "fp-collab-stats-4", type: "Block", tag: "div", classes: ["fp-collaborator-stats"], children: [], data: { tag: "div", text: false, xattr: [] } },
    ],
    styles: [
      { _id: "fp-collaborators-section", fake: false, type: "class", name: "fp-collaborators-section", namespace: "", comb: "", styleLess: "background-color: #f5f5f5; padding: 6rem 5vw;", variants: {}, children: [] },
      { _id: "fp-collaborators-header", fake: false, type: "class", name: "fp-collaborators-header", namespace: "", comb: "", styleLess: "display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 4rem;", variants: {}, children: [] },
      { _id: "fp-collab-title", fake: false, type: "class", name: "fp-collab-title", namespace: "", comb: "", styleLess: "font-size: 4rem; font-weight: 700;", variants: {}, children: [] },
      { _id: "fp-collab-desc", fake: false, type: "class", name: "fp-collab-desc", namespace: "", comb: "", styleLess: "font-size: 1rem; color: #afb6b4; max-width: 400px; text-align: right;", variants: {}, children: [] },
      { _id: "fp-collaborators-grid", fake: false, type: "class", name: "fp-collaborators-grid", namespace: "", comb: "", styleLess: "display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem;", variants: {}, children: [] },
      { _id: "fp-collaborator-card", fake: false, type: "class", name: "fp-collaborator-card", namespace: "", comb: "", styleLess: "background-color: #ffffff; border-radius: 24px; padding: 2rem; text-align: center; transition: transform 0.3s ease, box-shadow 0.3s ease;", variants: { hover: { styleLess: "transform: translateY(-4px); box-shadow: 0 16px 32px rgba(0,0,0,0.08);" } }, children: [] },
      { _id: "fp-collaborator-avatar", fake: false, type: "class", name: "fp-collaborator-avatar", namespace: "", comb: "", styleLess: "width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 1.5rem; background: linear-gradient(135deg, #ffc8b8, #ff531f); overflow: hidden;", variants: {}, children: [] },
      { _id: "fp-collaborator-name", fake: false, type: "class", name: "fp-collaborator-name", namespace: "", comb: "", styleLess: "font-size: 1rem; font-weight: 600; margin-bottom: 0.25rem;", variants: {}, children: [] },
      { _id: "fp-collaborator-role", fake: false, type: "class", name: "fp-collaborator-role", namespace: "", comb: "", styleLess: "font-size: 0.8rem; color: #afb6b4; margin-bottom: 1rem;", variants: {}, children: [] },
      { _id: "fp-collaborator-stats", fake: false, type: "class", name: "fp-collaborator-stats", namespace: "", comb: "", styleLess: "display: flex; justify-content: center; gap: 1.5rem; padding-top: 1rem; border-top: 1px solid #dddfde;", variants: {}, children: [] },
      { _id: "fp-collab-stat-value", fake: false, type: "class", name: "fp-collab-stat-value", namespace: "", comb: "", styleLess: "font-size: 1rem; font-weight: 700;", variants: {}, children: [] },
      { _id: "fp-collab-stat-label", fake: false, type: "class", name: "fp-collab-stat-label", namespace: "", comb: "", styleLess: "font-size: 0.7rem; color: #afb6b4;", variants: {}, children: [] },
    ],
    assets: [],
    ix1: [],
    ix2: { interactions: [], events: [], actionLists: [] },
  },
  meta: { unlinkedSymbolCount: 0, droppedLinks: 0, dynBindRemovedCount: 0, dynListBindRemovedCount: 0, paginationRemovedCount: 0 },
}

const fpCollaboratorsCodePayload = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Party - Collaborators</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet">
    <style>
        /* ============================================
           DESIGN TOKENS - Flow Party
           ============================================ */
        :root {
            /* Dark Palette */
            --dark-bg: #2d2f2e;
            --dark-secondary: #434645;
            --text-light: #ffffff;
            --text-muted-dark: #767f7a;

            /* Light Palette */
            --light-bg: #f5f5f5;
            --card-bg: #ffffff;
            --text-dark: #171717;
            --text-muted: #afb6b4;
            --border: #dddfde;

            /* Coral Gradient Scale */
            --coral-lightest: #fff0eb;
            --coral-light: #ffc8b8;
            --coral-medium: #ff9d80;
            --coral-strong: #ff531f;
            --coral-vivid: #ff825c;

            /* Border Radius */
            --radius-sm: 24px;
            --radius-md: 32px;
            --radius-lg: 40px;
            --radius-xl: 48px;
            --radius-pill: 9999px;

            /* Typography */
            --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            --font-logo: 'Antonio', sans-serif;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--font-body);
            background: var(--light-bg);
            color: var(--text-dark);
            line-height: 1.5;
        }

        /* Collaborators Section */
        .collaborators-section {
            padding: 6rem 5vw;
        }

        .collaborators-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 4rem;
        }

        .collaborators-header h2 {
            font-size: clamp(2.5rem, 5vw, 4rem);
            font-weight: 700;
        }

        .collaborators-header p {
            font-size: 1rem;
            color: var(--text-muted);
            max-width: 400px;
            text-align: right;
        }

        .collaborators-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1.5rem;
        }

        .collaborator-card {
            background: var(--card-bg);
            border-radius: var(--radius-sm);
            padding: 2rem;
            text-align: center;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .collaborator-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 16px 32px rgba(0, 0, 0, 0.08);
        }

        .collaborator-avatar {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            margin: 0 auto 1.5rem;
            background: linear-gradient(135deg, var(--coral-light), var(--coral-strong));
            overflow: hidden;
        }

        .collaborator-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .collaborator-name {
            font-size: 1rem;
            font-weight: 600;
            margin-bottom: 0.25rem;
        }

        .collaborator-role {
            font-size: 0.8rem;
            color: var(--text-muted);
            margin-bottom: 1rem;
        }

        .collaborator-stats {
            display: flex;
            justify-content: center;
            gap: 1.5rem;
            padding-top: 1rem;
            border-top: 1px solid var(--border);
        }

        .collab-stat-value {
            font-size: 1rem;
            font-weight: 700;
        }

        .collab-stat-label {
            font-size: 0.7rem;
            color: var(--text-muted);
        }

        /* Responsive */
        @media (max-width: 1024px) {
            .collaborators-grid {
                grid-template-columns: repeat(2, 1fr);
            }

            .collaborators-header {
                flex-direction: column;
                gap: 1rem;
                align-items: flex-start;
            }

            .collaborators-header p {
                text-align: left;
            }
        }

        @media (max-width: 768px) {
            .collaborators-section {
                padding: 4rem 5vw;
            }

            .collaborators-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>

<body>
    <section class="collaborators-section" id="collaborators">
        <div class="collaborators-header">
            <h2>Collaborators</h2>
            <p>Learn from the best. Our collaborators are award-winning designers and developers who teach what they
                ship.</p>
        </div>
        <div class="collaborators-grid">
            <div class="collaborator-card">
                <div class="collaborator-avatar" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                </div>
                <h4 class="collaborator-name">Alex Rivera</h4>
                <p class="collaborator-role">Creative Developer</p>
                <div class="collaborator-stats">
                    <div>
                        <div class="collab-stat-value">12</div>
                        <div class="collab-stat-label">Resources</div>
                    </div>
                    <div>
                        <div class="collab-stat-value">2.4k</div>
                        <div class="collab-stat-label">Downloads</div>
                    </div>
                </div>
            </div>
            <div class="collaborator-card">
                <div class="collaborator-avatar" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                </div>
                <h4 class="collaborator-name">Maya Johnson</h4>
                <p class="collaborator-role">UI/UX Designer</p>
                <div class="collaborator-stats">
                    <div>
                        <div class="collab-stat-value">8</div>
                        <div class="collab-stat-label">Resources</div>
                    </div>
                    <div>
                        <div class="collab-stat-value">1.8k</div>
                        <div class="collab-stat-label">Downloads</div>
                    </div>
                </div>
            </div>
            <div class="collaborator-card">
                <div class="collaborator-avatar" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
                </div>
                <h4 class="collaborator-name">James Park</h4>
                <p class="collaborator-role">Motion Designer</p>
                <div class="collaborator-stats">
                    <div>
                        <div class="collab-stat-value">15</div>
                        <div class="collab-stat-label">Resources</div>
                    </div>
                    <div>
                        <div class="collab-stat-value">3.1k</div>
                        <div class="collab-stat-label">Downloads</div>
                    </div>
                </div>
            </div>
            <div class="collaborator-card">
                <div class="collaborator-avatar" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);">
                </div>
                <h4 class="collaborator-name">Emma Wilson</h4>
                <p class="collaborator-role">Webflow Expert</p>
                <div class="collaborator-stats">
                    <div>
                        <div class="collab-stat-value">10</div>
                        <div class="collab-stat-label">Resources</div>
                    </div>
                    <div>
                        <div class="collab-stat-value">2.2k</div>
                        <div class="collab-stat-label">Downloads</div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</body>

</html>`

// Product Section (The Stash)
const fpProductWebflowJson = {
  type: "@webflow/XscpData",
  payload: {
    nodes: [
      {
        _id: "fp-product-001",
        type: "Section",
        tag: "section",
        classes: ["fp-product-section"],
        children: ["fp-product-header", "fp-product-grid", "fp-product-cta"],
        data: { tag: "section", text: false, xattr: [{ name: "id", value: "stash" }] },
      },
      {
        _id: "fp-product-header",
        type: "Block",
        tag: "div",
        classes: ["fp-product-header"],
        children: ["fp-product-label", "fp-product-intro"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-product-label", type: "Block", tag: "span", classes: ["fp-product-label"], children: ["fp-product-label-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-product-label-text", text: true, v: "(01)" },
      {
        _id: "fp-product-intro",
        type: "Block",
        tag: "div",
        classes: ["fp-product-intro"],
        children: ["fp-product-title", "fp-product-desc", "fp-product-link"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-product-title", type: "Heading", tag: "h2", classes: [], children: ["fp-product-title-text"], data: { tag: "h2", text: false, xattr: [] } },
      { _id: "fp-product-title-text", text: true, v: "The Stash" },
      { _id: "fp-product-desc", type: "Paragraph", tag: "p", classes: [], children: ["fp-product-desc-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-product-desc-text", text: true, v: "Premium Webflow resources curated for creative developers. Every component battle-tested, every interaction polished." },
      { _id: "fp-product-link", type: "Link", tag: "a", classes: ["fp-link-arrow"], children: ["fp-product-link-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-product-link-text", text: true, v: "Browse all resources →" },
      {
        _id: "fp-product-grid",
        type: "Block",
        tag: "div",
        classes: ["fp-product-grid"],
        children: ["fp-product-card-1", "fp-product-card-2", "fp-product-card-3"],
        data: { tag: "div", text: false, xattr: [] },
      },
      // Card 1
      { _id: "fp-product-card-1", type: "Block", tag: "div", classes: ["fp-product-card"], children: ["fp-product-card-1-img", "fp-product-card-1-content"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-product-card-1-img", type: "Block", tag: "div", classes: ["fp-product-card-image"], children: [], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-product-card-1-content", type: "Block", tag: "div", classes: ["fp-product-card-content"], children: ["fp-product-card-1-tag", "fp-product-card-1-title", "fp-product-card-1-desc"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-product-card-1-tag", type: "Block", tag: "span", classes: ["fp-product-card-tag"], children: ["fp-product-card-1-tag-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-product-card-1-tag-text", text: true, v: "Component" },
      { _id: "fp-product-card-1-title", type: "Heading", tag: "h4", classes: ["fp-product-card-title"], children: ["fp-product-card-1-title-text"], data: { tag: "h4", text: false, xattr: [] } },
      { _id: "fp-product-card-1-title-text", text: true, v: "Mega Navbar" },
      { _id: "fp-product-card-1-desc", type: "Paragraph", tag: "p", classes: ["fp-product-card-desc"], children: ["fp-product-card-1-desc-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-product-card-1-desc-text", text: true, v: "Full-featured navigation with dropdown, mobile menu, and animations." },
      // Card 2
      { _id: "fp-product-card-2", type: "Block", tag: "div", classes: ["fp-product-card"], children: ["fp-product-card-2-img", "fp-product-card-2-content"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-product-card-2-img", type: "Block", tag: "div", classes: ["fp-product-card-image"], children: [], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-product-card-2-content", type: "Block", tag: "div", classes: ["fp-product-card-content"], children: ["fp-product-card-2-tag", "fp-product-card-2-title", "fp-product-card-2-desc"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-product-card-2-tag", type: "Block", tag: "span", classes: ["fp-product-card-tag"], children: ["fp-product-card-2-tag-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-product-card-2-tag-text", text: true, v: "Section" },
      { _id: "fp-product-card-2-title", type: "Heading", tag: "h4", classes: ["fp-product-card-title"], children: ["fp-product-card-2-title-text"], data: { tag: "h4", text: false, xattr: [] } },
      { _id: "fp-product-card-2-title-text", text: true, v: "Split Hero" },
      { _id: "fp-product-card-2-desc", type: "Paragraph", tag: "p", classes: ["fp-product-card-desc"], children: ["fp-product-card-2-desc-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-product-card-2-desc-text", text: true, v: "High-converting hero with animated text reveal and parallax." },
      // Card 3
      { _id: "fp-product-card-3", type: "Block", tag: "div", classes: ["fp-product-card"], children: ["fp-product-card-3-img", "fp-product-card-3-content"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-product-card-3-img", type: "Block", tag: "div", classes: ["fp-product-card-image"], children: [], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-product-card-3-content", type: "Block", tag: "div", classes: ["fp-product-card-content"], children: ["fp-product-card-3-tag", "fp-product-card-3-title", "fp-product-card-3-desc"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-product-card-3-tag", type: "Block", tag: "span", classes: ["fp-product-card-tag"], children: ["fp-product-card-3-tag-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-product-card-3-tag-text", text: true, v: "Interaction" },
      { _id: "fp-product-card-3-title", type: "Heading", tag: "h4", classes: ["fp-product-card-title"], children: ["fp-product-card-3-title-text"], data: { tag: "h4", text: false, xattr: [] } },
      { _id: "fp-product-card-3-title-text", text: true, v: "Scroll Reveal" },
      { _id: "fp-product-card-3-desc", type: "Paragraph", tag: "p", classes: ["fp-product-card-desc"], children: ["fp-product-card-3-desc-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-product-card-3-desc-text", text: true, v: "GSAP-powered scroll animations with stagger effects." },
      // CTA
      { _id: "fp-product-cta", type: "Block", tag: "div", classes: ["fp-product-cta"], children: ["fp-product-cta-btn"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-product-cta-btn", type: "Link", tag: "a", classes: ["fp-btn-primary"], children: ["fp-product-cta-btn-text", "fp-product-cta-btn-arrow"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-product-cta-btn-text", text: true, v: "View All 140+ Resources " },
      { _id: "fp-product-cta-btn-arrow", type: "Block", tag: "span", classes: ["fp-btn-arrow"], children: ["fp-product-cta-btn-arrow-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-product-cta-btn-arrow-text", text: true, v: "→" },
    ],
    styles: [
      { _id: "fp-product-section", fake: false, type: "class", name: "fp-product-section", namespace: "", comb: "", styleLess: "background-color: #2d2f2e; padding: 6rem 5vw;", variants: {}, children: [] },
      { _id: "fp-product-header", fake: false, type: "class", name: "fp-product-header", namespace: "", comb: "", styleLess: "display: grid; grid-template-columns: auto 1fr; gap: 4rem; margin-bottom: 4rem; padding-bottom: 3rem; border-bottom: 1px solid rgba(255,255,255,0.1);", variants: {}, children: [] },
      { _id: "fp-product-label", fake: false, type: "class", name: "fp-product-label", namespace: "", comb: "", styleLess: "font-size: 0.875rem; color: #767f7a;", variants: {}, children: [] },
      { _id: "fp-product-intro", fake: false, type: "class", name: "fp-product-intro", namespace: "", comb: "", styleLess: "", variants: {}, children: [] },
      { _id: "fp-product-grid", fake: false, type: "class", name: "fp-product-grid", namespace: "", comb: "", styleLess: "display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;", variants: {}, children: [] },
      { _id: "fp-product-card", fake: false, type: "class", name: "fp-product-card", namespace: "", comb: "", styleLess: "background-color: #434645; border-radius: 24px; overflow: hidden; transition: transform 0.3s ease, box-shadow 0.3s ease;", variants: { hover: { styleLess: "transform: translateY(-8px); box-shadow: 0 24px 48px rgba(0,0,0,0.3);" } }, children: [] },
      { _id: "fp-product-card-image", fake: false, type: "class", name: "fp-product-card-image", namespace: "", comb: "", styleLess: "aspect-ratio: 16/10; overflow: hidden; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);", variants: {}, children: [] },
      { _id: "fp-product-card-content", fake: false, type: "class", name: "fp-product-card-content", namespace: "", comb: "", styleLess: "padding: 1.5rem;", variants: {}, children: [] },
      { _id: "fp-product-card-tag", fake: false, type: "class", name: "fp-product-card-tag", namespace: "", comb: "", styleLess: "display: inline-block; font-size: 0.7rem; font-weight: 600; color: #ff531f; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;", variants: {}, children: [] },
      { _id: "fp-product-card-title", fake: false, type: "class", name: "fp-product-card-title", namespace: "", comb: "", styleLess: "font-size: 1.1rem; font-weight: 600; color: #ffffff; margin-bottom: 0.5rem;", variants: {}, children: [] },
      { _id: "fp-product-card-desc", fake: false, type: "class", name: "fp-product-card-desc", namespace: "", comb: "", styleLess: "font-size: 0.85rem; color: #767f7a; line-height: 1.4;", variants: {}, children: [] },
      { _id: "fp-product-cta", fake: false, type: "class", name: "fp-product-cta", namespace: "", comb: "", styleLess: "text-align: center; margin-top: 4rem;", variants: {}, children: [] },
    ],
    assets: [],
    ix1: [],
    ix2: { interactions: [], events: [], actionLists: [] },
  },
  meta: { unlinkedSymbolCount: 0, droppedLinks: 0, dynBindRemovedCount: 0, dynListBindRemovedCount: 0, paginationRemovedCount: 0 },
}

const fpProductCodePayload = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Party - The Stash</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet">
    <style>
        /* ============================================
           DESIGN TOKENS - Flow Party
           ============================================ */
        :root {
            /* Dark Palette */
            --dark-bg: #2d2f2e;
            --dark-secondary: #434645;
            --text-light: #ffffff;
            --text-muted-dark: #767f7a;

            /* Light Palette */
            --light-bg: #f5f5f5;
            --card-bg: #ffffff;
            --text-dark: #171717;
            --text-muted: #afb6b4;
            --border: #dddfde;

            /* Coral Gradient Scale */
            --coral-lightest: #fff0eb;
            --coral-light: #ffc8b8;
            --coral-medium: #ff9d80;
            --coral-strong: #ff531f;
            --coral-vivid: #ff825c;

            /* Border Radius */
            --radius-sm: 24px;
            --radius-md: 32px;
            --radius-lg: 40px;
            --radius-xl: 48px;
            --radius-pill: 9999px;

            /* Typography */
            --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            --font-logo: 'Antonio', sans-serif;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--font-body);
            background: var(--dark-bg);
            color: var(--text-light);
            line-height: 1.5;
        }

        /* Product Section - The Stash */
        .product-section {
            padding: 6rem 5vw;
        }

        .product-header {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 4rem;
            margin-bottom: 4rem;
            padding-bottom: 3rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .product-label {
            font-size: 0.875rem;
            color: var(--text-muted-dark);
        }

        .product-intro h2 {
            font-size: clamp(2.5rem, 5vw, 4rem);
            font-weight: 700;
            color: var(--text-light);
            line-height: 1.1;
            margin-bottom: 1.5rem;
        }

        .product-intro p {
            font-size: 1.1rem;
            color: var(--text-muted-dark);
            max-width: 500px;
            margin-bottom: 1.5rem;
            line-height: 1.5;
        }

        .link-arrow {
            color: var(--coral-strong);
            font-size: 0.875rem;
            font-weight: 500;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            transition: gap 0.2s ease;
        }

        .link-arrow:hover {
            gap: 0.75rem;
        }

        .product-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1.5rem;
        }

        .product-card {
            background: var(--dark-secondary);
            border-radius: var(--radius-sm);
            overflow: hidden;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .product-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 24px 48px rgba(0, 0, 0, 0.3);
        }

        .product-card-image {
            aspect-ratio: 16/10;
            overflow: hidden;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .product-card-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.4s ease;
        }

        .product-card:hover .product-card-image img {
            transform: scale(1.05);
        }

        .product-card-content {
            padding: 1.5rem;
        }

        .product-card-tag {
            display: inline-block;
            font-size: 0.7rem;
            font-weight: 600;
            color: var(--coral-strong);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.75rem;
        }

        .product-card-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--text-light);
            margin-bottom: 0.5rem;
        }

        .product-card-desc {
            font-size: 0.85rem;
            color: var(--text-muted-dark);
            line-height: 1.4;
        }

        .product-cta {
            text-align: center;
            margin-top: 4rem;
        }

        .btn-primary {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: var(--coral-strong);
            color: var(--text-light);
            padding: 0.875rem 1.75rem;
            border-radius: var(--radius-pill);
            text-decoration: none;
            font-weight: 600;
            font-size: 0.9rem;
            border: none;
            cursor: pointer;
            transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }

        .btn-primary:hover {
            background: #e64a1a;
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(255, 83, 31, 0.3);
        }

        .btn-arrow {
            transition: transform 0.2s ease;
        }

        .btn-primary:hover .btn-arrow {
            transform: translateX(3px);
        }

        /* Responsive */
        @media (max-width: 1024px) {
            .product-header {
                grid-template-columns: 1fr;
                gap: 2rem;
            }

            .product-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }

        @media (max-width: 768px) {
            .product-section {
                padding: 4rem 5vw;
            }

            .product-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>

<body>
    <section class="product-section" id="stash">
        <div class="product-header">
            <span class="product-label">(01)</span>
            <div class="product-intro">
                <h2>The Stash</h2>
                <p>Premium Webflow resources curated for creative developers. Every component battle-tested, every
                    interaction polished.</p>
                <a href="#" class="link-arrow">Browse all resources →</a>
            </div>
        </div>
        <div class="product-grid">
            <div class="product-card">
                <div class="product-card-image" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                </div>
                <div class="product-card-content">
                    <span class="product-card-tag">Component</span>
                    <h4 class="product-card-title">Mega Navbar</h4>
                    <p class="product-card-desc">Full-featured navigation with dropdown, mobile menu, and animations.
                    </p>
                </div>
            </div>
            <div class="product-card">
                <div class="product-card-image" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                </div>
                <div class="product-card-content">
                    <span class="product-card-tag">Section</span>
                    <h4 class="product-card-title">Split Hero</h4>
                    <p class="product-card-desc">High-converting hero with animated text reveal and parallax.</p>
                </div>
            </div>
            <div class="product-card">
                <div class="product-card-image" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
                </div>
                <div class="product-card-content">
                    <span class="product-card-tag">Interaction</span>
                    <h4 class="product-card-title">Scroll Reveal</h4>
                    <p class="product-card-desc">GSAP-powered scroll animations with stagger effects.</p>
                </div>
            </div>
        </div>
        <div class="product-cta">
            <a href="#" class="btn-primary">View All 140+ Resources <span class="btn-arrow">→</span></a>
        </div>
    </section>
</body>

</html>`

// Bento Grid Section
const fpBentoWebflowJson = {
  type: "@webflow/XscpData",
  payload: {
    nodes: [
      {
        _id: "fp-bento-001",
        type: "Section",
        tag: "section",
        classes: ["fp-bento-section"],
        children: ["fp-bento-header", "fp-bento-grid"],
        data: { tag: "section", text: false, xattr: [] },
      },
      {
        _id: "fp-bento-header",
        type: "Block",
        tag: "div",
        classes: ["fp-bento-header"],
        children: ["fp-bento-label", "fp-bento-title"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-bento-label", type: "Block", tag: "span", classes: ["fp-section-label"], children: ["fp-bento-label-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-bento-label-text", text: true, v: "Why Flow Party" },
      { _id: "fp-bento-title", type: "Heading", tag: "h2", classes: ["fp-bento-title"], children: ["fp-bento-title-text"], data: { tag: "h2", text: false, xattr: [] } },
      { _id: "fp-bento-title-text", text: true, v: "Everything you need to ship faster" },
      {
        _id: "fp-bento-grid",
        type: "Block",
        tag: "div",
        classes: ["fp-bento-grid"],
        children: ["fp-bento-card-1", "fp-bento-card-2", "fp-bento-card-3", "fp-bento-card-4", "fp-bento-card-5"],
        data: { tag: "div", text: false, xattr: [] },
      },
      // Card 1 - Large (spans 2 columns)
      { _id: "fp-bento-card-1", type: "Block", tag: "div", classes: ["fp-bento-card", "fp-bento-card-lg"], children: ["fp-bento-card-1-icon", "fp-bento-card-1-content"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-bento-card-1-icon", type: "Block", tag: "div", classes: ["fp-bento-icon"], children: ["fp-bento-card-1-icon-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-bento-card-1-icon-text", text: true, v: "🚀" },
      { _id: "fp-bento-card-1-content", type: "Block", tag: "div", classes: ["fp-bento-content"], children: ["fp-bento-card-1-title", "fp-bento-card-1-desc"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-bento-card-1-title", type: "Heading", tag: "h3", classes: ["fp-bento-card-title"], children: ["fp-bento-card-1-title-text"], data: { tag: "h3", text: false, xattr: [] } },
      { _id: "fp-bento-card-1-title-text", text: true, v: "Ship 10x Faster" },
      { _id: "fp-bento-card-1-desc", type: "Paragraph", tag: "p", classes: ["fp-bento-card-desc"], children: ["fp-bento-card-1-desc-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-bento-card-1-desc-text", text: true, v: "Stop rebuilding the same sections. Copy, paste, and customize in minutes instead of hours." },
      // Card 2 - Regular
      { _id: "fp-bento-card-2", type: "Block", tag: "div", classes: ["fp-bento-card"], children: ["fp-bento-card-2-icon", "fp-bento-card-2-content"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-bento-card-2-icon", type: "Block", tag: "div", classes: ["fp-bento-icon"], children: ["fp-bento-card-2-icon-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-bento-card-2-icon-text", text: true, v: "🎨" },
      { _id: "fp-bento-card-2-content", type: "Block", tag: "div", classes: ["fp-bento-content"], children: ["fp-bento-card-2-title", "fp-bento-card-2-desc"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-bento-card-2-title", type: "Heading", tag: "h3", classes: ["fp-bento-card-title"], children: ["fp-bento-card-2-title-text"], data: { tag: "h3", text: false, xattr: [] } },
      { _id: "fp-bento-card-2-title-text", text: true, v: "Design System Ready" },
      { _id: "fp-bento-card-2-desc", type: "Paragraph", tag: "p", classes: ["fp-bento-card-desc"], children: ["fp-bento-card-2-desc-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-bento-card-2-desc-text", text: true, v: "Every component uses CSS variables for easy theming." },
      // Card 3 - Regular
      { _id: "fp-bento-card-3", type: "Block", tag: "div", classes: ["fp-bento-card"], children: ["fp-bento-card-3-icon", "fp-bento-card-3-content"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-bento-card-3-icon", type: "Block", tag: "div", classes: ["fp-bento-icon"], children: ["fp-bento-card-3-icon-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-bento-card-3-icon-text", text: true, v: "📱" },
      { _id: "fp-bento-card-3-content", type: "Block", tag: "div", classes: ["fp-bento-content"], children: ["fp-bento-card-3-title", "fp-bento-card-3-desc"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-bento-card-3-title", type: "Heading", tag: "h3", classes: ["fp-bento-card-title"], children: ["fp-bento-card-3-title-text"], data: { tag: "h3", text: false, xattr: [] } },
      { _id: "fp-bento-card-3-title-text", text: true, v: "Mobile First" },
      { _id: "fp-bento-card-3-desc", type: "Paragraph", tag: "p", classes: ["fp-bento-card-desc"], children: ["fp-bento-card-3-desc-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-bento-card-3-desc-text", text: true, v: "Responsive by default with carefully crafted breakpoints." },
      // Card 4 - Tall (spans 2 rows)
      { _id: "fp-bento-card-4", type: "Block", tag: "div", classes: ["fp-bento-card", "fp-bento-card-tall"], children: ["fp-bento-card-4-icon", "fp-bento-card-4-content"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-bento-card-4-icon", type: "Block", tag: "div", classes: ["fp-bento-icon"], children: ["fp-bento-card-4-icon-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-bento-card-4-icon-text", text: true, v: "⚡" },
      { _id: "fp-bento-card-4-content", type: "Block", tag: "div", classes: ["fp-bento-content"], children: ["fp-bento-card-4-title", "fp-bento-card-4-desc", "fp-bento-card-4-list"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-bento-card-4-title", type: "Heading", tag: "h3", classes: ["fp-bento-card-title"], children: ["fp-bento-card-4-title-text"], data: { tag: "h3", text: false, xattr: [] } },
      { _id: "fp-bento-card-4-title-text", text: true, v: "Performance Optimized" },
      { _id: "fp-bento-card-4-desc", type: "Paragraph", tag: "p", classes: ["fp-bento-card-desc"], children: ["fp-bento-card-4-desc-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-bento-card-4-desc-text", text: true, v: "Built with performance in mind:" },
      { _id: "fp-bento-card-4-list", type: "Block", tag: "ul", classes: ["fp-bento-list"], children: ["fp-bento-card-4-li1", "fp-bento-card-4-li2", "fp-bento-card-4-li3"], data: { tag: "ul", text: false, xattr: [] } },
      { _id: "fp-bento-card-4-li1", type: "Block", tag: "li", classes: [], children: ["fp-bento-card-4-li1-text"], data: { tag: "li", text: false, xattr: [] } },
      { _id: "fp-bento-card-4-li1-text", text: true, v: "Zero JS bloat" },
      { _id: "fp-bento-card-4-li2", type: "Block", tag: "li", classes: [], children: ["fp-bento-card-4-li2-text"], data: { tag: "li", text: false, xattr: [] } },
      { _id: "fp-bento-card-4-li2-text", text: true, v: "Optimized CSS" },
      { _id: "fp-bento-card-4-li3", type: "Block", tag: "li", classes: [], children: ["fp-bento-card-4-li3-text"], data: { tag: "li", text: false, xattr: [] } },
      { _id: "fp-bento-card-4-li3-text", text: true, v: "Lazy loading" },
      // Card 5 - Regular
      { _id: "fp-bento-card-5", type: "Block", tag: "div", classes: ["fp-bento-card"], children: ["fp-bento-card-5-icon", "fp-bento-card-5-content"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-bento-card-5-icon", type: "Block", tag: "div", classes: ["fp-bento-icon"], children: ["fp-bento-card-5-icon-text"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-bento-card-5-icon-text", text: true, v: "🔧" },
      { _id: "fp-bento-card-5-content", type: "Block", tag: "div", classes: ["fp-bento-content"], children: ["fp-bento-card-5-title", "fp-bento-card-5-desc"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-bento-card-5-title", type: "Heading", tag: "h3", classes: ["fp-bento-card-title"], children: ["fp-bento-card-5-title-text"], data: { tag: "h3", text: false, xattr: [] } },
      { _id: "fp-bento-card-5-title-text", text: true, v: "Easy Customization" },
      { _id: "fp-bento-card-5-desc", type: "Paragraph", tag: "p", classes: ["fp-bento-card-desc"], children: ["fp-bento-card-5-desc-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-bento-card-5-desc-text", text: true, v: "Fully editable in Webflow Designer with clean class naming." },
    ],
    styles: [
      { _id: "fp-bento-section", fake: false, type: "class", name: "fp-bento-section", namespace: "", comb: "", styleLess: "background-color: #f5f5f5; padding: 6rem 5vw;", variants: {}, children: [] },
      { _id: "fp-bento-header", fake: false, type: "class", name: "fp-bento-header", namespace: "", comb: "", styleLess: "text-align: center; margin-bottom: 4rem;", variants: {}, children: [] },
      { _id: "fp-section-label", fake: false, type: "class", name: "fp-section-label", namespace: "", comb: "", styleLess: "display: inline-block; font-size: 0.8rem; font-weight: 600; color: #ff531f; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1rem;", variants: {}, children: [] },
      { _id: "fp-bento-title", fake: false, type: "class", name: "fp-bento-title", namespace: "", comb: "", styleLess: "font-size: clamp(2rem, 4vw, 3rem); font-weight: 700; color: #171717;", variants: {}, children: [] },
      { _id: "fp-bento-grid", fake: false, type: "class", name: "fp-bento-grid", namespace: "", comb: "", styleLess: "display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, auto); gap: 1.5rem;", variants: {}, children: [] },
      { _id: "fp-bento-card", fake: false, type: "class", name: "fp-bento-card", namespace: "", comb: "", styleLess: "background-color: #ffffff; border-radius: 24px; padding: 2rem; transition: transform 0.3s ease, box-shadow 0.3s ease;", variants: { hover: { styleLess: "transform: translateY(-4px); box-shadow: 0 16px 32px rgba(0,0,0,0.08);" } }, children: [] },
      { _id: "fp-bento-card-lg", fake: false, type: "class", name: "fp-bento-card-lg", namespace: "", comb: "", styleLess: "grid-column: span 2;", variants: {}, children: [] },
      { _id: "fp-bento-card-tall", fake: false, type: "class", name: "fp-bento-card-tall", namespace: "", comb: "", styleLess: "grid-row: span 2;", variants: {}, children: [] },
      { _id: "fp-bento-icon", fake: false, type: "class", name: "fp-bento-icon", namespace: "", comb: "", styleLess: "font-size: 2rem; margin-bottom: 1rem;", variants: {}, children: [] },
      { _id: "fp-bento-content", fake: false, type: "class", name: "fp-bento-content", namespace: "", comb: "", styleLess: "", variants: {}, children: [] },
      { _id: "fp-bento-card-title", fake: false, type: "class", name: "fp-bento-card-title", namespace: "", comb: "", styleLess: "font-size: 1.25rem; font-weight: 600; color: #171717; margin-bottom: 0.5rem;", variants: {}, children: [] },
      { _id: "fp-bento-card-desc", fake: false, type: "class", name: "fp-bento-card-desc", namespace: "", comb: "", styleLess: "font-size: 0.9rem; color: #767f7a; line-height: 1.5;", variants: {}, children: [] },
      { _id: "fp-bento-list", fake: false, type: "class", name: "fp-bento-list", namespace: "", comb: "", styleLess: "margin-top: 1rem; padding-left: 1.25rem; font-size: 0.85rem; color: #767f7a; line-height: 1.8;", variants: {}, children: [] },
    ],
    assets: [],
    ix1: [],
    ix2: { interactions: [], events: [], actionLists: [] },
  },
  meta: { unlinkedSymbolCount: 0, droppedLinks: 0, dynBindRemovedCount: 0, dynListBindRemovedCount: 0, paginationRemovedCount: 0 },
}

const fpBentoCodePayload = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Party - Bento Grid</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet">
    <style>
        /* ============================================
           DESIGN TOKENS - Flow Party
           ============================================ */
        :root {
            /* Dark Palette */
            --dark-bg: #2d2f2e;
            --dark-secondary: #434645;
            --text-light: #ffffff;
            --text-muted-dark: #767f7a;

            /* Light Palette */
            --light-bg: #f5f5f5;
            --card-bg: #ffffff;
            --text-dark: #171717;
            --text-muted: #afb6b4;
            --border: #dddfde;

            /* Coral Gradient Scale */
            --coral-lightest: #fff0eb;
            --coral-light: #ffc8b8;
            --coral-medium: #ff9d80;
            --coral-strong: #ff531f;
            --coral-vivid: #ff825c;

            /* Border Radius */
            --radius-sm: 24px;
            --radius-md: 32px;
            --radius-lg: 40px;
            --radius-xl: 48px;
            --radius-pill: 9999px;

            /* Typography */
            --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            --font-logo: 'Antonio', sans-serif;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--font-body);
            background: var(--light-bg);
            color: var(--text-dark);
            line-height: 1.5;
        }

        /* Bento Grid */
        .bento-section {
            padding: 2rem 5vw 4rem;
        }

        .bento-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            grid-template-areas:
                "testimonial stat1     showcase"
                "testimonial process   showcase"
                "timeline    timeline  stat2";
            gap: 1.5rem;
        }

        .bento-card {
            background: var(--card-bg);
            border-radius: var(--radius-sm);
            padding: 2rem;
            position: relative;
            overflow: hidden;
            min-height: 200px;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .bento-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }

        .testimonial-card {
            grid-area: testimonial;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        .stat-card-1 {
            grid-area: stat1;
        }

        .stat-card-2 {
            grid-area: stat2;
        }

        .showcase-card {
            grid-area: showcase;
            padding: 0;
            min-height: 400px;
        }

        .process-card {
            grid-area: process;
        }

        .timeline-card {
            grid-area: timeline;
        }

        .bento-card h3 {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 1rem;
        }

        .bento-card>p {
            color: var(--text-muted);
            font-size: 0.9rem;
            line-height: 1.5;
        }

        .testimonial-text {
            font-size: 1rem;
            line-height: 1.5;
            color: var(--text-dark);
        }

        .testimonial-author {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-top: auto;
            padding-top: 1.5rem;
        }

        .avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 2px solid var(--light-bg);
            background: linear-gradient(135deg, var(--coral-light), var(--coral-strong));
            overflow: hidden;
        }

        .author-name {
            font-weight: 600;
            font-size: 0.875rem;
        }

        .author-role {
            font-size: 0.75rem;
            color: var(--text-muted);
        }

        .watermark-number {
            position: absolute;
            bottom: 0.5rem;
            right: 1rem;
            font-size: 7rem;
            font-weight: 700;
            opacity: 0.03;
            line-height: 1;
            pointer-events: none;
        }

        .stat-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }

        .stat-label {
            font-size: 0.75rem;
            color: var(--text-muted);
            font-weight: 500;
        }

        .stat-icon {
            width: 32px;
            height: 32px;
            border: 1px solid var(--border);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.875rem;
        }

        .stat-value {
            font-size: clamp(2.5rem, 5vw, 3.5rem);
            font-weight: 700;
            line-height: 1;
            margin-bottom: 0.5rem;
        }

        .stat-value span {
            font-size: 0.5em;
            vertical-align: top;
        }

        .stat-desc {
            font-size: 0.875rem;
            color: var(--text-muted);
        }

        .showcase-card img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .showcase-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 2rem;
            background: linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent);
            color: var(--text-light);
        }

        .showcase-overlay h3 {
            font-size: 1.25rem;
            margin-bottom: 0.5rem;
            color: var(--text-light);
        }

        .showcase-overlay p {
            font-size: 0.875rem;
            color: var(--text-muted-dark);
            margin-bottom: 1rem;
        }

        .link-arrow {
            color: var(--coral-strong);
            font-size: 0.875rem;
            font-weight: 500;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            transition: gap 0.2s ease;
        }

        .link-arrow:hover {
            gap: 0.75rem;
        }

        .timeline-header {
            margin-bottom: 1.5rem;
        }

        .timeline-title {
            font-weight: 600;
            font-size: 0.9rem;
        }

        .timeline-subtitle {
            font-size: 0.75rem;
            color: var(--text-muted);
        }

        .timeline-bars {
            display: flex;
            gap: 0.5rem;
            height: 8px;
        }

        .timeline-bar {
            flex: 1;
            border-radius: 4px;
            background: var(--border);
        }

        .timeline-bar.active {
            background: var(--coral-strong);
        }

        .process-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }

        .process-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-size: 0.875rem;
            color: var(--text-muted);
        }

        .process-check {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: var(--coral-lightest);
            color: var(--coral-strong);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.7rem;
            flex-shrink: 0;
        }

        /* Responsive */
        @media (max-width: 1024px) {
            .bento-grid {
                grid-template-columns: 1fr 1fr;
                grid-template-areas:
                    "testimonial stat1"
                    "testimonial process"
                    "showcase   showcase"
                    "timeline   stat2";
            }
        }

        @media (max-width: 768px) {
            .bento-grid {
                grid-template-columns: 1fr;
                grid-template-areas:
                    "testimonial"
                    "stat1"
                    "showcase"
                    "process"
                    "timeline"
                    "stat2";
            }

            .bento-section {
                padding: 2rem 5vw;
            }
        }
    </style>
</head>

<body>
    <section class="bento-section">
        <div class="bento-grid">
            <div class="bento-card testimonial-card">
                <p class="testimonial-text">"Flow Party saved me 40+ hours on my last client project. The Party Pack
                    approach is genius—everything just works together."</p>
                <div class="testimonial-author">
                    <div class="avatar" style="background: linear-gradient(135deg, #ff531f 0%, #f093fb 100%);"></div>
                    <div>
                        <div class="author-name">Sarah Chen</div>
                        <div class="author-role">Freelance Developer</div>
                    </div>
                </div>
            </div>

            <div class="bento-card stat-card-1">
                <div class="stat-header">
                    <span class="stat-label">Time Saved</span>
                    <div class="stat-icon">⏱</div>
                </div>
                <div class="stat-value">40<span>hrs</span></div>
                <div class="stat-desc">Average per project launch</div>
                <div class="watermark-number">40</div>
            </div>

            <div class="bento-card showcase-card"
                style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                <div class="showcase-overlay">
                    <h3>SaaS Starter Pack</h3>
                    <p>Complete launch kit for your next product</p>
                    <a href="#" class="link-arrow">View Pack →</a>
                </div>
            </div>

            <div class="bento-card process-card">
                <h3>What's Included</h3>
                <div class="process-list">
                    <div class="process-item"><span class="process-check">✓</span> Webflow Template</div>
                    <div class="process-item"><span class="process-check">✓</span> Component Library</div>
                    <div class="process-item"><span class="process-check">✓</span> Figma Source Files</div>
                    <div class="process-item"><span class="process-check">✓</span> Launch Guide</div>
                </div>
            </div>

            <div class="bento-card timeline-card">
                <div class="timeline-header">
                    <div class="timeline-title">From idea to launch</div>
                    <div class="timeline-subtitle">Average project timeline</div>
                </div>
                <div class="timeline-bars">
                    <div class="timeline-bar active"></div>
                    <div class="timeline-bar active"></div>
                    <div class="timeline-bar active"></div>
                    <div class="timeline-bar"></div>
                    <div class="timeline-bar"></div>
                </div>
            </div>

            <div class="bento-card stat-card-2">
                <div class="stat-header">
                    <span class="stat-label">Resources</span>
                    <div class="stat-icon">📦</div>
                </div>
                <div class="stat-value">140<span>+</span></div>
                <div class="stat-desc">Premium assets in The Stash</div>
                <div class="watermark-number">140</div>
            </div>
        </div>
    </section>
</body>

</html>`

// Party Packs Section
const fpPartyPacksWebflowJson = {
  type: "@webflow/XscpData",
  payload: {
    nodes: [
      {
        _id: "fp-packs-001",
        type: "Section",
        tag: "section",
        classes: ["fp-packs-section"],
        children: ["fp-packs-header", "fp-packs-grid"],
        data: { tag: "section", text: false, xattr: [{ name: "id", value: "party-packs" }] },
      },
      {
        _id: "fp-packs-header",
        type: "Block",
        tag: "div",
        classes: ["fp-packs-header"],
        children: ["fp-packs-badge", "fp-packs-title", "fp-packs-desc"],
        data: { tag: "div", text: false, xattr: [] },
      },
      { _id: "fp-packs-badge", type: "Block", tag: "span", classes: ["fp-packs-badge"], children: ["fp-packs-badge-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-packs-badge-text", text: true, v: "New" },
      { _id: "fp-packs-title", type: "Heading", tag: "h2", classes: ["fp-packs-title"], children: ["fp-packs-title-text"], data: { tag: "h2", text: false, xattr: [] } },
      { _id: "fp-packs-title-text", text: true, v: "Party Packs" },
      { _id: "fp-packs-desc", type: "Paragraph", tag: "p", classes: ["fp-packs-desc"], children: ["fp-packs-desc-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-packs-desc-text", text: true, v: "Complete launch kits with everything you need to ship a polished site. Each pack includes templates, components, and guides." },
      {
        _id: "fp-packs-grid",
        type: "Block",
        tag: "div",
        classes: ["fp-packs-grid"],
        children: ["fp-pack-card-1", "fp-pack-card-2", "fp-pack-card-3"],
        data: { tag: "div", text: false, xattr: [] },
      },
      // Pack 1
      { _id: "fp-pack-card-1", type: "Block", tag: "div", classes: ["fp-pack-card"], children: ["fp-pack-card-1-visual", "fp-pack-card-1-content"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pack-card-1-visual", type: "Block", tag: "div", classes: ["fp-pack-visual"], children: ["fp-pack-card-1-tag"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pack-card-1-tag", type: "Block", tag: "span", classes: ["fp-pack-tag"], children: ["fp-pack-card-1-tag-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-pack-card-1-tag-text", text: true, v: "12 Templates" },
      { _id: "fp-pack-card-1-content", type: "Block", tag: "div", classes: ["fp-pack-content"], children: ["fp-pack-card-1-title", "fp-pack-card-1-desc", "fp-pack-card-1-features", "fp-pack-card-1-cta"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pack-card-1-title", type: "Heading", tag: "h3", classes: ["fp-pack-title"], children: ["fp-pack-card-1-title-text"], data: { tag: "h3", text: false, xattr: [] } },
      { _id: "fp-pack-card-1-title-text", text: true, v: "Agency Pack" },
      { _id: "fp-pack-card-1-desc", type: "Paragraph", tag: "p", classes: ["fp-pack-desc"], children: ["fp-pack-card-1-desc-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-pack-card-1-desc-text", text: true, v: "For creative agencies and studios. Modern layouts with case study showcases." },
      { _id: "fp-pack-card-1-features", type: "Block", tag: "div", classes: ["fp-pack-features"], children: ["fp-pack-1-f1", "fp-pack-1-f2", "fp-pack-1-f3"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pack-1-f1", type: "Block", tag: "span", classes: ["fp-pack-feature"], children: ["fp-pack-1-f1-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-pack-1-f1-text", text: true, v: "Portfolio Grid" },
      { _id: "fp-pack-1-f2", type: "Block", tag: "span", classes: ["fp-pack-feature"], children: ["fp-pack-1-f2-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-pack-1-f2-text", text: true, v: "Team Section" },
      { _id: "fp-pack-1-f3", type: "Block", tag: "span", classes: ["fp-pack-feature"], children: ["fp-pack-1-f3-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-pack-1-f3-text", text: true, v: "Contact Forms" },
      { _id: "fp-pack-card-1-cta", type: "Link", tag: "a", classes: ["fp-pack-cta"], children: ["fp-pack-card-1-cta-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-pack-card-1-cta-text", text: true, v: "Explore Pack →" },
      // Pack 2
      { _id: "fp-pack-card-2", type: "Block", tag: "div", classes: ["fp-pack-card", "fp-pack-featured"], children: ["fp-pack-card-2-visual", "fp-pack-card-2-content"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pack-card-2-visual", type: "Block", tag: "div", classes: ["fp-pack-visual"], children: ["fp-pack-card-2-tag"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pack-card-2-tag", type: "Block", tag: "span", classes: ["fp-pack-tag"], children: ["fp-pack-card-2-tag-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-pack-card-2-tag-text", text: true, v: "18 Templates" },
      { _id: "fp-pack-card-2-content", type: "Block", tag: "div", classes: ["fp-pack-content"], children: ["fp-pack-card-2-title", "fp-pack-card-2-desc", "fp-pack-card-2-features", "fp-pack-card-2-cta"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pack-card-2-title", type: "Heading", tag: "h3", classes: ["fp-pack-title"], children: ["fp-pack-card-2-title-text"], data: { tag: "h3", text: false, xattr: [] } },
      { _id: "fp-pack-card-2-title-text", text: true, v: "SaaS Pack" },
      { _id: "fp-pack-card-2-desc", type: "Paragraph", tag: "p", classes: ["fp-pack-desc"], children: ["fp-pack-card-2-desc-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-pack-card-2-desc-text", text: true, v: "For software products. Conversion-optimized with pricing tables and feature grids." },
      { _id: "fp-pack-card-2-features", type: "Block", tag: "div", classes: ["fp-pack-features"], children: ["fp-pack-2-f1", "fp-pack-2-f2", "fp-pack-2-f3"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pack-2-f1", type: "Block", tag: "span", classes: ["fp-pack-feature"], children: ["fp-pack-2-f1-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-pack-2-f1-text", text: true, v: "Pricing Tables" },
      { _id: "fp-pack-2-f2", type: "Block", tag: "span", classes: ["fp-pack-feature"], children: ["fp-pack-2-f2-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-pack-2-f2-text", text: true, v: "Feature Grid" },
      { _id: "fp-pack-2-f3", type: "Block", tag: "span", classes: ["fp-pack-feature"], children: ["fp-pack-2-f3-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-pack-2-f3-text", text: true, v: "Changelog" },
      { _id: "fp-pack-card-2-cta", type: "Link", tag: "a", classes: ["fp-pack-cta"], children: ["fp-pack-card-2-cta-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-pack-card-2-cta-text", text: true, v: "Explore Pack →" },
      // Pack 3
      { _id: "fp-pack-card-3", type: "Block", tag: "div", classes: ["fp-pack-card"], children: ["fp-pack-card-3-visual", "fp-pack-card-3-content"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pack-card-3-visual", type: "Block", tag: "div", classes: ["fp-pack-visual"], children: ["fp-pack-card-3-tag"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pack-card-3-tag", type: "Block", tag: "span", classes: ["fp-pack-tag"], children: ["fp-pack-card-3-tag-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-pack-card-3-tag-text", text: true, v: "8 Templates" },
      { _id: "fp-pack-card-3-content", type: "Block", tag: "div", classes: ["fp-pack-content"], children: ["fp-pack-card-3-title", "fp-pack-card-3-desc", "fp-pack-card-3-features", "fp-pack-card-3-cta"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pack-card-3-title", type: "Heading", tag: "h3", classes: ["fp-pack-title"], children: ["fp-pack-card-3-title-text"], data: { tag: "h3", text: false, xattr: [] } },
      { _id: "fp-pack-card-3-title-text", text: true, v: "Personal Pack" },
      { _id: "fp-pack-card-3-desc", type: "Paragraph", tag: "p", classes: ["fp-pack-desc"], children: ["fp-pack-card-3-desc-text"], data: { tag: "p", text: false, xattr: [] } },
      { _id: "fp-pack-card-3-desc-text", text: true, v: "For freelancers and creatives. Minimalist layouts with blog and portfolio." },
      { _id: "fp-pack-card-3-features", type: "Block", tag: "div", classes: ["fp-pack-features"], children: ["fp-pack-3-f1", "fp-pack-3-f2", "fp-pack-3-f3"], data: { tag: "div", text: false, xattr: [] } },
      { _id: "fp-pack-3-f1", type: "Block", tag: "span", classes: ["fp-pack-feature"], children: ["fp-pack-3-f1-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-pack-3-f1-text", text: true, v: "Blog Layout" },
      { _id: "fp-pack-3-f2", type: "Block", tag: "span", classes: ["fp-pack-feature"], children: ["fp-pack-3-f2-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-pack-3-f2-text", text: true, v: "About Page" },
      { _id: "fp-pack-3-f3", type: "Block", tag: "span", classes: ["fp-pack-feature"], children: ["fp-pack-3-f3-text"], data: { tag: "span", text: false, xattr: [] } },
      { _id: "fp-pack-3-f3-text", text: true, v: "Newsletter" },
      { _id: "fp-pack-card-3-cta", type: "Link", tag: "a", classes: ["fp-pack-cta"], children: ["fp-pack-card-3-cta-text"], data: { link: { mode: "external", url: "#" } } },
      { _id: "fp-pack-card-3-cta-text", text: true, v: "Explore Pack →" },
    ],
    styles: [
      { _id: "fp-packs-section", fake: false, type: "class", name: "fp-packs-section", namespace: "", comb: "", styleLess: "background-color: #2d2f2e; padding: 6rem 5vw;", variants: {}, children: [] },
      { _id: "fp-packs-header", fake: false, type: "class", name: "fp-packs-header", namespace: "", comb: "", styleLess: "text-align: center; margin-bottom: 4rem; max-width: 600px; margin-left: auto; margin-right: auto;", variants: {}, children: [] },
      { _id: "fp-packs-badge", fake: false, type: "class", name: "fp-packs-badge", namespace: "", comb: "", styleLess: "display: inline-block; background-color: #ff531f; color: #ffffff; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.375rem 0.75rem; border-radius: 9999px; margin-bottom: 1rem;", variants: {}, children: [] },
      { _id: "fp-packs-title", fake: false, type: "class", name: "fp-packs-title", namespace: "", comb: "", styleLess: "font-size: clamp(2.5rem, 5vw, 4rem); font-weight: 700; color: #ffffff; margin-bottom: 1rem;", variants: {}, children: [] },
      { _id: "fp-packs-desc", fake: false, type: "class", name: "fp-packs-desc", namespace: "", comb: "", styleLess: "font-size: 1.1rem; color: #767f7a; line-height: 1.6;", variants: {}, children: [] },
      { _id: "fp-packs-grid", fake: false, type: "class", name: "fp-packs-grid", namespace: "", comb: "", styleLess: "display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem;", variants: {}, children: [] },
      { _id: "fp-pack-card", fake: false, type: "class", name: "fp-pack-card", namespace: "", comb: "", styleLess: "background-color: #434645; border-radius: 24px; overflow: hidden; transition: transform 0.3s ease, box-shadow 0.3s ease;", variants: { hover: { styleLess: "transform: translateY(-8px); box-shadow: 0 24px 48px rgba(0,0,0,0.3);" } }, children: [] },
      { _id: "fp-pack-featured", fake: false, type: "class", name: "fp-pack-featured", namespace: "", comb: "", styleLess: "border: 2px solid #ff531f;", variants: {}, children: [] },
      { _id: "fp-pack-visual", fake: false, type: "class", name: "fp-pack-visual", namespace: "", comb: "", styleLess: "aspect-ratio: 16/10; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: flex-end; justify-content: flex-start; padding: 1.5rem; position: relative;", variants: {}, children: [] },
      { _id: "fp-pack-tag", fake: false, type: "class", name: "fp-pack-tag", namespace: "", comb: "", styleLess: "display: inline-block; background: rgba(255,255,255,0.2); backdrop-filter: blur(8px); color: #ffffff; font-size: 0.75rem; font-weight: 600; padding: 0.5rem 0.75rem; border-radius: 8px;", variants: {}, children: [] },
      { _id: "fp-pack-content", fake: false, type: "class", name: "fp-pack-content", namespace: "", comb: "", styleLess: "padding: 1.5rem;", variants: {}, children: [] },
      { _id: "fp-pack-title", fake: false, type: "class", name: "fp-pack-title", namespace: "", comb: "", styleLess: "font-size: 1.25rem; font-weight: 600; color: #ffffff; margin-bottom: 0.5rem;", variants: {}, children: [] },
      { _id: "fp-pack-desc", fake: false, type: "class", name: "fp-pack-desc", namespace: "", comb: "", styleLess: "font-size: 0.9rem; color: #767f7a; line-height: 1.5; margin-bottom: 1rem;", variants: {}, children: [] },
      { _id: "fp-pack-features", fake: false, type: "class", name: "fp-pack-features", namespace: "", comb: "", styleLess: "display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem;", variants: {}, children: [] },
      { _id: "fp-pack-feature", fake: false, type: "class", name: "fp-pack-feature", namespace: "", comb: "", styleLess: "font-size: 0.75rem; color: #afb6b4; background: rgba(255,255,255,0.05); padding: 0.375rem 0.625rem; border-radius: 6px;", variants: {}, children: [] },
      { _id: "fp-pack-cta", fake: false, type: "class", name: "fp-pack-cta", namespace: "", comb: "", styleLess: "display: inline-flex; font-size: 0.9rem; font-weight: 600; color: #ff531f; text-decoration: none; transition: color 0.2s ease;", variants: { hover: { styleLess: "color: #ff825c;" } }, children: [] },
    ],
    assets: [],
    ix1: [],
    ix2: { interactions: [], events: [], actionLists: [] },
  },
  meta: { unlinkedSymbolCount: 0, droppedLinks: 0, dynBindRemovedCount: 0, dynListBindRemovedCount: 0, paginationRemovedCount: 0 },
}

const fpPartyPacksCodePayload = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Party - Party Packs</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet">
    <style>
        /* ============================================
           DESIGN TOKENS - Flow Party
           ============================================ */
        :root {
            /* Dark Palette */
            --dark-bg: #2d2f2e;
            --dark-secondary: #434645;
            --text-light: #ffffff;
            --text-muted-dark: #767f7a;

            /* Light Palette */
            --light-bg: #f5f5f5;
            --card-bg: #ffffff;
            --text-dark: #171717;
            --text-muted: #afb6b4;
            --border: #dddfde;

            /* Coral Gradient Scale */
            --coral-lightest: #fff0eb;
            --coral-light: #ffc8b8;
            --coral-medium: #ff9d80;
            --coral-strong: #ff531f;
            --coral-vivid: #ff825c;

            /* Border Radius */
            --radius-sm: 24px;
            --radius-md: 32px;
            --radius-lg: 40px;
            --radius-xl: 48px;
            --radius-pill: 9999px;

            /* Typography */
            --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            --font-logo: 'Antonio', sans-serif;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--font-body);
            background: var(--light-bg);
            color: var(--text-dark);
            line-height: 1.5;
        }

        /* Party Packs Section */
        .packs-section {
            padding: 6rem 5vw;
        }

        .packs-header {
            text-align: center;
            max-width: 700px;
            margin: 0 auto 4rem;
        }

        .packs-header h2 {
            font-size: clamp(2.5rem, 5vw, 4rem);
            font-weight: 700;
            margin-bottom: 1rem;
        }

        .packs-header p {
            font-size: 1.1rem;
            color: var(--text-muted);
            line-height: 1.5;
        }

        .packs-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 2rem;
        }

        .pack-card {
            background: var(--card-bg);
            border-radius: var(--radius-md);
            padding: 2.5rem;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            align-items: center;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .pack-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
        }

        .pack-card.featured {
            grid-column: span 2;
            background: var(--dark-bg);
            color: var(--text-light);
        }

        .pack-card.featured .pack-title {
            color: var(--text-light);
        }

        .pack-card.featured .pack-desc {
            color: var(--text-muted-dark);
        }

        .pack-card.featured .pack-includes span {
            color: var(--text-muted-dark);
            background: var(--dark-secondary);
        }

        .pack-image {
            border-radius: var(--radius-sm);
            overflow: hidden;
            aspect-ratio: 4/3;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .pack-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .pack-badge {
            display: inline-block;
            font-size: 0.7rem;
            font-weight: 600;
            color: var(--coral-strong);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.75rem;
        }

        .pack-title {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 0.75rem;
            color: var(--text-dark);
        }

        .pack-desc {
            font-size: 0.95rem;
            color: var(--text-muted);
            line-height: 1.5;
            margin-bottom: 1.5rem;
        }

        .pack-includes {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-bottom: 1.5rem;
        }

        .pack-includes span {
            font-size: 0.8rem;
            color: var(--text-muted);
            background: var(--light-bg);
            padding: 0.35rem 0.75rem;
            border-radius: var(--radius-pill);
        }

        .btn-primary {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: var(--coral-strong);
            color: var(--text-light);
            padding: 0.875rem 1.75rem;
            border-radius: var(--radius-pill);
            text-decoration: none;
            font-weight: 600;
            font-size: 0.9rem;
            border: none;
            cursor: pointer;
            transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }

        .btn-primary:hover {
            background: #e64a1a;
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(255, 83, 31, 0.3);
        }

        .btn-dark {
            background: var(--text-dark);
        }

        .btn-dark:hover {
            background: #333;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }

        .btn-arrow {
            transition: transform 0.2s ease;
        }

        .btn-primary:hover .btn-arrow {
            transform: translateX(3px);
        }

        /* Responsive */
        @media (max-width: 1024px) {
            .packs-grid {
                grid-template-columns: 1fr;
            }

            .pack-card {
                grid-template-columns: 1fr;
            }

            .pack-card.featured {
                grid-column: span 1;
            }
        }

        @media (max-width: 768px) {
            .packs-section {
                padding: 4rem 5vw;
            }
        }
    </style>
</head>

<body>
    <section class="packs-section" id="packs">
        <div class="packs-header">
            <h2>Party Packs</h2>
            <p>Complete launch solutions. Everything you need to ship a polished site—template, components, Figma, and
                guides—bundled together.</p>
        </div>
        <div class="packs-grid">
            <div class="pack-card featured">
                <div class="pack-image" style="background: linear-gradient(135deg, #ff531f 0%, #f093fb 100%);"></div>
                <div class="pack-content">
                    <span class="pack-badge">Most Popular</span>
                    <h3 class="pack-title">SaaS Starter Pack</h3>
                    <p class="pack-desc">Everything you need to launch your SaaS marketing site. Includes pricing
                        tables, feature grids, testimonials, and full CMS setup.</p>
                    <div class="pack-includes">
                        <span>12-page template</span>
                        <span>45 components</span>
                        <span>Figma file</span>
                        <span>Launch guide</span>
                    </div>
                    <a href="#" class="btn-primary">Get Pack <span class="btn-arrow">→</span></a>
                </div>
            </div>
            <div class="pack-card">
                <div class="pack-image" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"></div>
                <div class="pack-content">
                    <span class="pack-badge">New</span>
                    <h3 class="pack-title">Agency Pack</h3>
                    <p class="pack-desc">Premium agency portfolio with case studies, team pages, and service breakdowns.
                    </p>
                    <div class="pack-includes">
                        <span>8-page template</span>
                        <span>32 components</span>
                        <span>Figma file</span>
                    </div>
                    <a href="#" class="btn-dark btn-primary">Get Pack <span class="btn-arrow">→</span></a>
                </div>
            </div>
            <div class="pack-card">
                <div class="pack-image" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);"></div>
                <div class="pack-content">
                    <span class="pack-badge">Creative</span>
                    <h3 class="pack-title">Portfolio Pack</h3>
                    <p class="pack-desc">Stunning portfolio for designers and developers with project showcases.</p>
                    <div class="pack-includes">
                        <span>6-page template</span>
                        <span>28 components</span>
                        <span>Figma file</span>
                    </div>
                    <a href="#" class="btn-dark btn-primary">Get Pack <span class="btn-arrow">→</span></a>
                </div>
            </div>
        </div>
    </section>
</body>

</html>`

// ============================================================================
// ASSET PAYLOADS MAP
// ============================================================================

const assetPayloads: Record<
  string,
  { webflowJson: string; codePayload: string; dependencies: string[] }
> = {
  "fp-design-tokens": {
    webflowJson: JSON.stringify(fpDesignTokensWebflowJson),
    codePayload: fpDesignTokensCodePayload,
    dependencies: [],
  },
  "fp-navigation": {
    webflowJson: JSON.stringify(fpNavWebflowJson),
    codePayload: fpNavCodePayload,
    dependencies: ["fp-design-tokens"],
  },
  "fp-hero": {
    webflowJson: JSON.stringify(fpHeroWebflowJson),
    codePayload: fpHeroCodePayload,
    dependencies: ["fp-design-tokens"],
  },
  "fp-client-bar": {
    webflowJson: JSON.stringify(fpClientBarWebflowJson),
    codePayload: fpClientBarCodePayload,
    dependencies: ["fp-design-tokens"],
  },
  "fp-pricing": {
    webflowJson: JSON.stringify(fpPricingWebflowJson),
    codePayload: fpPricingCodePayload,
    dependencies: ["fp-design-tokens"],
  },
  "fp-cta": {
    webflowJson: JSON.stringify(fpCtaWebflowJson),
    codePayload: fpCtaCodePayload,
    dependencies: ["fp-design-tokens"],
  },
  "fp-footer": {
    webflowJson: JSON.stringify(fpFooterWebflowJson),
    codePayload: fpFooterCodePayload,
    dependencies: ["fp-design-tokens"],
  },
  "fp-intro": {
    webflowJson: JSON.stringify(fpIntroWebflowJson),
    codePayload: fpIntroCodePayload,
    dependencies: ["fp-design-tokens"],
  },
  "fp-faq": {
    webflowJson: JSON.stringify(fpFaqWebflowJson),
    codePayload: fpFaqCodePayload,
    dependencies: ["fp-design-tokens"],
  },
  "fp-features": {
    webflowJson: JSON.stringify(fpFeaturesWebflowJson),
    codePayload: fpFeaturesCodePayload,
    dependencies: ["fp-design-tokens"],
  },
  "fp-collaborators": {
    webflowJson: JSON.stringify(fpCollaboratorsWebflowJson),
    codePayload: fpCollaboratorsCodePayload,
    dependencies: ["fp-design-tokens"],
  },
  "fp-product": {
    webflowJson: JSON.stringify(fpProductWebflowJson),
    codePayload: fpProductCodePayload,
    dependencies: ["fp-design-tokens"],
  },
  "fp-bento": {
    webflowJson: JSON.stringify(fpBentoWebflowJson),
    codePayload: fpBentoCodePayload,
    dependencies: ["fp-design-tokens"],
  },
  "fp-packs": {
    webflowJson: JSON.stringify(fpPartyPacksWebflowJson),
    codePayload: fpPartyPacksCodePayload,
    dependencies: ["fp-design-tokens"],
  },
}

// ============================================================================
// DEMO ASSETS - FLOW PARTY SECTIONS
// ============================================================================

const demoAssets = [
  {
    slug: "fp-design-tokens",
    title: "Flow Party Design Tokens",
    category: "utilities",
    description: "CSS custom properties (variables) for the Flow Party design system. Paste this FIRST before using other components. Includes colors, typography, and spacing tokens.",
    tags: ["tokens", "variables", "setup", "colors", "typography", "design-system"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/ff531f/fff?text=Design+Tokens",
    pasteReliability: "full" as const,
    supportsCodeCopy: true,
    capabilityNotes: "Pastes fully. For Webflow paste, add 'fp-root' class to Body. See code for font setup.",
  },
  {
    slug: "fp-navigation",
    title: "Flow Party Header",
    category: "navigation",
    description: "Header layout with navigation, hero content, and mobile menu. Includes scroll state change and responsive toggle.",
    tags: ["navigation", "header", "hero", "nav", "fixed", "responsive", "backdrop-blur"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/2d2f2e/ff531f?text=FP+Header",
    pasteReliability: "partial" as const,
    supportsCodeCopy: true,
    capabilityNotes: "Structure pastes. Add scroll effect via custom JS.",
  },
  {
    slug: "fp-hero",
    title: "Flow Party Hero",
    category: "hero",
    description: "Full viewport hero section with large watermark background, two-column grid layout, gradient image placeholder with badge overlay, and service list.",
    tags: ["hero", "landing", "section", "grid", "responsive", "watermark"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/2d2f2e/ff531f?text=FP+Hero",
    pasteReliability: "partial" as const,
    supportsCodeCopy: true,
    capabilityNotes: "Structure pastes. Animations need custom CSS.",
  },
  {
    slug: "fp-client-bar",
    title: "Flow Party Client Bar",
    category: "sections",
    description: "Trust/client logo bar with horizontal layout. Shows company logos with hover opacity effect. Perfect for social proof.",
    tags: ["clients", "logos", "trust", "social-proof", "section"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/f5f5f5/171717?text=FP+Client+Bar",
    pasteReliability: "full" as const,
    supportsCodeCopy: true,
    capabilityNotes: "Pastes fully. Replace logo text with actual logo images.",
  },
  {
    slug: "fp-pricing",
    title: "Flow Party Pricing",
    category: "sections",
    description: "Three-tier pricing section with featured/popular card highlighting. Includes feature lists, pricing badges, and multiple CTA button styles.",
    tags: ["pricing", "cards", "section", "tiers", "cta"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/ffffff/171717?text=FP+Pricing",
    pasteReliability: "partial" as const,
    supportsCodeCopy: true,
    capabilityNotes: "Structure pastes. Hover effects need custom CSS.",
  },
  {
    slug: "fp-cta",
    title: "Flow Party CTA Section",
    category: "sections",
    description: "Dark call-to-action section with large watermark text, centered content, and dual button layout. Perfect for page endings.",
    tags: ["cta", "call-to-action", "section", "dark", "watermark"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/2d2f2e/ff531f?text=FP+CTA",
    pasteReliability: "full" as const,
    supportsCodeCopy: true,
    capabilityNotes: "Pastes fully with all styles.",
  },
  {
    slug: "fp-footer",
    title: "Flow Party Footer",
    category: "navigation",
    description: "Rounded corner footer with multi-column link layout, logo, and bottom copyright bar. Clean, modern footer design.",
    tags: ["footer", "navigation", "links", "section"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/ffffff/171717?text=FP+Footer",
    pasteReliability: "partial" as const,
    supportsCodeCopy: true,
    capabilityNotes: "Structure pastes. Link hover colors need custom CSS.",
  },
  {
    slug: "fp-intro",
    title: "Flow Party Intro",
    category: "sections",
    description: "Two-column intro section with large 0→1 typography, avatar stack trust signals, and compelling headline. Perfect after hero.",
    tags: ["intro", "section", "typography", "trust", "avatars"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/f5f5f5/171717?text=FP+Intro",
    pasteReliability: "full" as const,
    supportsCodeCopy: true,
    capabilityNotes: "Pastes fully. Replace avatar gradients with actual images.",
  },
  {
    slug: "fp-bento",
    title: "Flow Party Bento Grid",
    category: "sections",
    description: "Bento grid layout with testimonial, stats, showcase, and process cards. Ideal for social proof and highlights.",
    tags: ["bento", "grid", "stats", "testimonial", "section"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/f5f5f5/171717?text=FP+Bento",
    pasteReliability: "full" as const,
    supportsCodeCopy: true,
    capabilityNotes: "Pastes fully. Replace imagery and metrics as needed.",
  },
  {
    slug: "fp-packs",
    title: "Flow Party Party Packs",
    category: "sections",
    description: "Party Packs showcase with featured card, badges, and CTA buttons for bundled offerings.",
    tags: ["packs", "cards", "pricing", "cta", "section"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/2d2f2e/ff531f?text=FP+Packs",
    pasteReliability: "full" as const,
    supportsCodeCopy: true,
    capabilityNotes: "Pastes fully. Replace pack images and copy.",
  },
  {
    slug: "fp-faq",
    title: "Flow Party FAQ",
    category: "sections",
    description: "Two-column FAQ section with accordion-style questions. Features numbered questions with hover effects and expandable answers.",
    tags: ["faq", "accordion", "section", "questions", "support"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/f5f5f5/171717?text=FP+FAQ",
    pasteReliability: "partial" as const,
    supportsCodeCopy: true,
    capabilityNotes: "Structure pastes. Add accordion JS from code payload.",
  },
  {
    slug: "fp-features",
    title: "Flow Party Features",
    category: "sections",
    description: "Icon-based feature grid with 3x2 layout. Each card has icon, heading, and description. Dark background with coral accents.",
    tags: ["features", "grid", "cards", "icons", "section"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/2d2f2e/ff531f?text=FP+Features",
    pasteReliability: "full" as const,
    supportsCodeCopy: true,
    capabilityNotes: "Pastes fully. Replace icon placeholders with actual icons.",
  },
  {
    slug: "fp-collaborators",
    title: "Flow Party Collaborators",
    category: "sections",
    description: "Team/collaborator showcase grid with avatar images, names, roles, and stats. 4-column responsive layout with hover effects.",
    tags: ["team", "collaborators", "grid", "avatars", "section"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/f5f5f5/171717?text=FP+Collaborators",
    pasteReliability: "full" as const,
    supportsCodeCopy: true,
    capabilityNotes: "Pastes fully. Replace avatar gradients with actual images.",
  },
  {
    slug: "fp-product",
    title: "Flow Party Product (The Stash)",
    category: "sections",
    description: "Product showcase section with header, 3-column card grid, and CTA. Cards have image placeholders with gradient backgrounds.",
    tags: ["products", "stash", "cards", "grid", "showcase", "section"],
    isNew: true,
    previewImageUrl: "https://placehold.co/800x600/2d2f2e/ff531f?text=FP+Product",
    pasteReliability: "full" as const,
    supportsCodeCopy: true,
    capabilityNotes: "Pastes fully. Replace card image placeholders with screenshots.",
  },
]

// ============================================================================
// MUTATIONS
// ============================================================================

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
        previewImageUrl: asset.previewImageUrl,
        pasteReliability: asset.pasteReliability,
        supportsCodeCopy: asset.supportsCodeCopy,
        capabilityNotes: asset.capabilityNotes,
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

// Clear all assets - admin only (for fresh start)
export const clearAllAssets = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    // Delete all payloads first (foreign key constraint)
    const allPayloads = await ctx.db.query("payloads").collect()
    for (const payload of allPayloads) {
      await ctx.db.delete(payload._id)
    }

    // Delete all assets
    const allAssets = await ctx.db.query("assets").collect()
    for (const asset of allAssets) {
      await ctx.db.delete(asset._id)
    }

    return { deletedAssets: allAssets.length, deletedPayloads: allPayloads.length }
  },
})

// Update existing assets with capability flags - admin only
export const updateAssetCapabilities = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const now = Date.now()
    let updated = 0

    for (const assetData of demoAssets) {
      const existing = await ctx.db
        .query("assets")
        .withIndex("by_slug", (q) => q.eq("slug", assetData.slug))
        .unique()

      if (existing) {
        await ctx.db.patch(existing._id, {
          pasteReliability: "pasteReliability" in assetData ? assetData.pasteReliability : undefined,
          supportsCodeCopy: "supportsCodeCopy" in assetData ? assetData.supportsCodeCopy : undefined,
          capabilityNotes: "capabilityNotes" in assetData ? assetData.capabilityNotes : undefined,
          updatedAt: now,
        })
        updated++
      }
    }

    return { updated }
  },
})

// Update existing payloads with new code - admin only
export const updatePayloads = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const now = Date.now()
    let updated = 0

    for (const [slug, payloadData] of Object.entries(assetPayloads)) {
      // Find the asset
      const asset = await ctx.db
        .query("assets")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique()

      if (!asset) continue

      // Find and update the payload
      const existingPayload = await ctx.db
        .query("payloads")
        .withIndex("by_asset_id", (q) => q.eq("assetId", asset._id))
        .unique()

      if (existingPayload) {
        await ctx.db.patch(existingPayload._id, {
          webflowJson: payloadData.webflowJson,
          codePayload: payloadData.codePayload,
          updatedAt: now,
        })
        updated++
      }
    }

    return { updated }
  },
})

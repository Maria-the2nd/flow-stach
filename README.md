# Flow Stach (Flow Bridge)

**THE SYSTEM MANIFEST IS THE SOURCE OF TRUTH**: Always refer to `SYSTEM_MANIFEST.md` for current routing, features, and UI architecture.

## Overview
Flow Stach is a premium Webflow ecosystem designed for high-end developers. It bridges the gap between raw code/AI-generated HTML and semantic Webflow structures.

## Core Pillars
1.  **Flow Bridge**: The AI-powered tool for importing and converting HTML/CSS to Webflow.
2.  **Flow Stach Library**: A collection of premium, purchased templates and components.

## ✨ Key Features

### Design Tokens Style Guide
Automatically generate beautiful, Relume-style design system documentation:
- **Visual Token Display**: Colors, typography, spacing, radius, shadows
- **Copy Functionality**: Individual tokens or entire categories as CSS
- **Webflow Export**: One-click export to create style guide pages in Webflow
- **Automatic Extraction**: Detects tokens from CSS custom properties

📖 **[Read the full documentation →](./docs/features/STYLE_GUIDE.md)**

### Import & Convert
- Multi-step HTML/CSS import wizard
- Automatic component detection
- Design token extraction
- Webflow-compatible payload generation

## Quick Links
- **Workspace**: `/workspace/projects` (Your Imports)
- **Marketplace**: `/explore` (Store)
- **Import Tool**: `/workspace/import`
- **Documentation**: [docs/README.md](./docs/README.md)

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Runtime**: Bun
- **Database**: Convex
- **Auth**: Clerk
- **Styling**: Tailwind CSS 4

## Development
```bash
bun install
bun run dev
```

## Documentation

- **[User Documentation](./docs/README.md)** - Feature guides and how-tos
- **[Style Guide Feature](./docs/features/STYLE_GUIDE.md)** - Design tokens documentation
- **[System Manifest](./SYSTEM_MANIFEST.md)** - Architecture and routing tables
- **[Implementation Details](./docs/STYLE_GUIDE_IMPLEMENTATION.md)** - Technical implementation

For detailed architecture, technical patterns, and routing tables, please consult **[SYSTEM_MANIFEST.md](./SYSTEM_MANIFEST.md)**.

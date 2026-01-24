# Flow-Stach Features Documentation

Complete guide to all features available in Flow-Stach.

## 🎨 Design & Tokens

### [Design Tokens Style Guide](./STYLE_GUIDE.md)
Generate beautiful, Relume-style design system documentation with automatic token extraction and Webflow export.

**Key Features:**
- Visual token display (colors, typography, spacing, radius, shadows)
- Individual and category copy functionality
- One-click Webflow export
- Automatic CSS variable detection

**Quick Links:**
- [Full Documentation](./STYLE_GUIDE.md)
- [Quick Reference](./STYLE_GUIDE_QUICK_REFERENCE.md)
- [Implementation Details](../STYLE_GUIDE_IMPLEMENTATION.md)

---

## 📦 Asset Management

### [Assets Data](./assets-data.md)
Manage and organize your design assets, components, and templates.

### [Favorites](./favorites.md)
Save and organize your favorite components for quick access.

---

## 🎯 Advanced Features

### [Clipboard Integration](./clipboard.md)
Copy components and styles directly to Webflow with smart formatting.

### [Grid Layout Compatibility](./grid-layout-compatibility.md)
Ensure your grid layouts work perfectly in Webflow.

### [Gradient Transform Decoupling](./gradient-transform-decoupling.md)
Handle complex gradient and transform combinations.

### [Seeding](./seeding.md)
Populate your database with sample data for testing.

---

## 🔄 Import & Conversion

### Import Wizard
Multi-step wizard for importing HTML/CSS projects:
- Automatic component detection
- Design token extraction
- Font and image analysis
- Webflow payload generation

**Documentation:** [Multi-Step Workflow](../cli-prompts/multi-step-workflow.md)

### Flow Bridge Integration
Advanced conversion with validation and semantic analysis.

**Documentation:** [Flow Bridge Integration](../cli-prompts/flow-bridge-integration.md)

---

## 📋 Feature Comparison

| Feature | What It Does | Best For |
|---------|-------------|----------|
| **Style Guide** | Visual design token documentation | Design systems, handoffs |
| **Import Wizard** | Convert HTML/CSS to Webflow | Full site imports |
| **Component Library** | Reusable component catalog | Building pages quickly |
| **Clipboard Tools** | Copy to Webflow with validation | Individual components |
| **Asset Manager** | Organize templates and designs | Large libraries |

---

## 🆕 Recent Additions

### January 2026
- ✅ **Design Tokens Style Guide** - Visual documentation with Webflow export
- ✅ Enhanced token extraction (radius, shadows, UI elements)
- ✅ Category and individual copy functionality

---

## 📖 Documentation Structure

```
docs/features/
├── STYLE_GUIDE.md                    # Design tokens feature (NEW)
├── STYLE_GUIDE_QUICK_REFERENCE.md    # Quick reference card (NEW)
├── assets-data.md                     # Asset management
├── clipboard.md                       # Clipboard integration
├── favorites.md                       # Favorites system
├── gradient-transform-decoupling.md   # Advanced CSS handling
├── grid-layout-compatibility.md       # Grid system
├── seeding.md                         # Database seeding
└── README.md                          # This file
```

---

## 🚀 Getting Started

### New Users
1. Read [Quick Start Guide](../cli-prompts/START-HERE.md)
2. Try [Style Guide Feature](./STYLE_GUIDE.md)
3. Import your first project using [Import Wizard](../cli-prompts/multi-step-workflow.md)

### Existing Users
- Check out the new **[Style Guide Feature](./STYLE_GUIDE.md)**
- Review [Recent Updates](#-recent-additions)

### Developers
- See [Implementation Documentation](../STYLE_GUIDE_IMPLEMENTATION.md)
- Review [System Manifest](../../SYSTEM_MANIFEST.md)

---

## 📞 Support & Resources

- **Full Documentation**: [docs/README.md](../README.md)
- **Technical Details**: [Implementation Docs](../)
- **Quick Reference**: [Style Guide Cheat Sheet](./STYLE_GUIDE_QUICK_REFERENCE.md)

---

**Last Updated:** January 24, 2026

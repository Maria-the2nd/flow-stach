# Flow-Stach Documentation

Welcome to the Flow-Stach documentation. This guide will help you understand and use all features of the platform.

**🧭 Lost?** See the [Navigation Guide](./NAVIGATION_GUIDE.md) to find exactly what you need.

## 📚 Table of Contents

### Getting Started
- [Quick Start Guide](./cli-prompts/START-HERE.md)
- [Usage Guide](./cli-prompts/USAGE_GUIDE.md)

### Features

#### Core Features
- **[Design Tokens Style Guide](./features/STYLE_GUIDE.md)** - Visual documentation of design tokens with Webflow export
- **[Import Wizard](./cli-prompts/multi-step-workflow.md)** - Import HTML/CSS projects
- **[Flow Bridge Integration](./cli-prompts/flow-bridge-integration.md)** - Advanced conversion features

#### Component Management
- Component Library
- Asset Management
- Template System

#### Validation & Quality
- **[Validation System](./cli-prompts/flow-bridge-validation-implementation-prompt.md)** - Multi-layer validation
- **[Three-Output System](./three-output-system.md)** - Webflow JSON, CSS Embed, JS Embed

### Technical Documentation

#### Architecture
- [Three-Output System Architecture](./three-output-system.md)
- [Webflow Conversion Pipeline](./cli-prompts/webflow-corruption-analysis.md)
- [Implementation Details](./STYLE_GUIDE_IMPLEMENTATION.md)

#### Debugging & Troubleshooting
- [Webflow Crash Investigation](./DEBUG-webflow-crash-investigation.md)
- [React Error 137 Fix](./cli-prompts/react-error-137-fix.md)
- [Validation Gap Closure](./IMPLEMENT-validation-gap-closure.md)

#### Research & References
- [Webflow Custom Code Limitations](./Webflow%20Custom%20Code%20Limitations%20Research.pdf)
- [Final Implementation Prompt](./FINAL-implementation-prompt.md)

## 🎨 Feature Highlights

### Design Tokens Style Guide

Automatically generate beautiful, Relume-style design system documentation:

- **Visual Token Display**: Colors, typography, spacing, radius, shadows
- **Copy Functionality**: Individual tokens or entire categories as CSS
- **Webflow Export**: One-click export to create style guide pages in Webflow
- **Automatic Extraction**: Detects tokens from CSS custom properties

[Learn more →](./features/STYLE_GUIDE.md)

### Import Wizard

Import any HTML/CSS project and convert it to Webflow-compatible format:

- Multi-step validation
- Component detection and extraction
- Font and image analysis
- Design token extraction
- Webflow payload generation

### Three-Output System

Every import generates three optimized outputs:

1. **Webflow JSON**: Native Webflow elements
2. **CSS Embed**: Advanced CSS features (animations, pseudo-elements)
3. **JS Embed**: Interactive functionality and libraries

## 🚀 Quick Links

### Most Common Tasks

| Task | Documentation |
|------|---------------|
| Import a new project | [Import Wizard Guide](./cli-prompts/multi-step-workflow.md) |
| View design tokens | [Style Guide Feature](./features/STYLE_GUIDE.md) |
| Copy individual token | [Quick Reference](./features/STYLE_GUIDE_QUICK_REFERENCE.md) |
| Copy all tokens as CSS | [Category Copy](./features/STYLE_GUIDE.md#category-copy) |
| Export to Webflow | [Webflow Export Guide](./features/STYLE_GUIDE.md#webflow-style-guide-export) |
| Fix validation errors | [Validation System](./cli-prompts/flow-bridge-validation-implementation-prompt.md) |
| Debug issues | [Troubleshooting](./features/STYLE_GUIDE.md#troubleshooting) |
| Extend the feature | [Developer Guide](./features/STYLE_GUIDE_DEVELOPER_GUIDE.md) |

## 📖 Documentation Structure

```
docs/
├── features/              # User-facing feature documentation
│   └── STYLE_GUIDE.md    # Design Tokens Style Guide
├── cli-prompts/          # Development and CLI documentation
│   ├── START-HERE.md     # Quick start guide
│   ├── USAGE_GUIDE.md    # Comprehensive usage guide
│   └── ...               # Additional technical docs
├── *.md                  # Technical implementation docs
└── README.md             # This file
```

## 🔧 For Developers

### Implementation Documentation
- [Style Guide Implementation](./STYLE_GUIDE_IMPLEMENTATION.md) - Complete implementation details
- [Validation Gap Closure](./IMPLEMENT-validation-gap-closure.md) - Validation system architecture
- [Three-Output System](./three-output-system.md) - Output generation architecture

### Code Examples
- [HTML Sanitizer](./cli-prompts/html-sanitizer.ts)
- [Webflow Validator](./cli-prompts/webflow-validator.ts)
- [Test Examples](./cli-prompts/flow-bridge-test-all-outputs.html)

## 📝 Contributing to Documentation

When adding new features, please:

1. Create feature documentation in `docs/features/`
2. Add implementation details to `docs/FEATURE_NAME_IMPLEMENTATION.md`
3. Update this README with links to new documentation
4. Include code examples and troubleshooting sections

## 🆘 Getting Help

1. **Navigation Guide**: [Find docs by role or task](./NAVIGATION_GUIDE.md) 🧭
2. **Check Documentation**: Search this docs folder for your topic
3. **Review Examples**: Look at test files in `docs/cli-prompts/`
4. **Quick Reference**: [Style Guide Cheat Sheet](./features/STYLE_GUIDE_QUICK_REFERENCE.md)
5. **Troubleshooting**: [Common Issues](./features/STYLE_GUIDE.md#troubleshooting)
6. **Submit Issue**: If problem persists, create a GitHub issue

## 📅 Recent Updates

### January 2026
- ✅ **New**: Design Tokens Style Guide with Webflow export
- ✅ Enhanced token extraction (radius, shadows, UI elements)
- ✅ Visual style guide components (Relume-style layout)
- ✅ Category and individual token copy functionality
- ✅ Complete documentation suite (user + developer guides)
- ✅ **v2 Update**: Self-contained inline styles (no conflicts!)
- ✅ **v2 Update**: UI Components section (buttons, cards, inputs)
- ✅ **v2 Update**: Default spacing tokens (always visible)

**📖 See:** [Complete Documentation Index](./features/INDEX.md) | **✨ [v2 Improvements](./STYLE_GUIDE_V2_IMPROVEMENTS.md)**

---

**Last Updated:** January 24, 2026  
**Maintained by:** Flow-Stach Team

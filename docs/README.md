# Flow Bridge Documentation

Welcome to the Flow Bridge documentation. This guide will help you understand and use all features of the platform.

See the [Navigation Guide](./NAVIGATION_GUIDE.md) to find docs by role or task.

## Table of Contents

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
- **[Pipeline Checklist](./html-to-webflow-pipeline-checklist.md)** - Conversion integrity checklist

### Technical Documentation

#### Architecture
- **[Panel-First Sanitization Playbook](./webflow-panel-first-sanitization-playbook.md)** - Current pipeline strategy and tuning workflow
- [Webflow Conversion Pipeline](./cli-prompts/webflow-corruption-analysis.md)
- [BEM Class Renaming](./bem-class-renaming.md)
- [Implementation Details](./STYLE_GUIDE_IMPLEMENTATION.md)

#### Debugging & Troubleshooting
- [Webflow Crash Investigation](./DEBUG-webflow-crash-investigation.md)
- [React Error 137 Fix](./cli-prompts/react-error-137-fix.md)
- [Validation Gap Closure](./IMPLEMENT-validation-gap-closure.md)

#### Research & References
- [Webflow Custom Code Limitations](./WEBFLOW_CUSTOM_CODE_LIMITATIONS.md)
- [CodePen to Webflow Gap Analysis](./codepen-to-webflow-gap-analysis.md)

## Feature Highlights

### Design Tokens Style Guide

Automatically generate Relume-style design system documentation:

- Visual token display: colors, typography, spacing, radius, shadows
- Copy functionality: individual tokens or entire categories as CSS
- Webflow export: one-click export to create style guide pages in Webflow
- Automatic extraction from CSS custom properties

[Learn more](./features/STYLE_GUIDE.md)

### Import Wizard

Import any HTML/CSS project and convert it to Webflow-compatible format:

- Two-phase CSS routing (panel-first strategy)
- Modifier class creation for descendant selectors
- Component detection and extraction
- Font, image, and design token extraction
- Webflow JSON payload generation with embed CSS/JS

### Pipeline Output

Each import produces:

- **Webflow JSON**: Native Webflow elements and styles (single hidden div with `delete-me` class)
- **Embed CSS**: Non-native rules (pseudo-elements, animations, non-Webflow breakpoints, stateful selectors)
- **Embed JS**: Interactive functionality and external library tags

## Quick Links

| Task | Documentation |
|------|---------------|
| Import a new project | [Import Wizard Guide](./cli-prompts/multi-step-workflow.md) |
| Fine-tune conversion locally | [Panel-First Sanitization Playbook](./webflow-panel-first-sanitization-playbook.md) |
| View design tokens | [Style Guide Feature](./features/STYLE_GUIDE.md) |
| Understand CSS routing | [BEM Class Renaming](./bem-class-renaming.md) |
| Fix validation errors | [Validation System](./cli-prompts/flow-bridge-validation-implementation-prompt.md) |
| Extend the feature | [Developer Guide](./features/STYLE_GUIDE_DEVELOPER_GUIDE.md) |

## Documentation Structure

```
docs/
├── features/              # User-facing feature documentation
│   └── STYLE_GUIDE.md    # Design Tokens Style Guide
├── cli-prompts/          # Development and CLI documentation
│   ├── START-HERE.md     # Quick start guide
│   └── USAGE_GUIDE.md    # Comprehensive usage guide
├── archive/              # Deprecated/historical docs
├── *.md                  # Technical implementation docs
└── README.md             # This file
```

## For Developers

### Implementation Documentation
- [Style Guide Implementation](./STYLE_GUIDE_IMPLEMENTATION.md)
- [Validation Gap Closure](./IMPLEMENT-validation-gap-closure.md)
- [Pipeline Checklist](./html-to-webflow-pipeline-checklist.md)

## Contributing to Documentation

When adding new features:

1. Create feature documentation in `docs/features/`
2. Update the [Panel-First Playbook](./webflow-panel-first-sanitization-playbook.md) if pipeline behavior changes
3. Update [CHANGELOG.md](./CHANGELOG.md) with entries
4. Update this README with links to new documentation

## Recent Updates

### February 2026
- Modifier class creation for descendant element selectors (`.hero h1` -> `hero-h1`)
- Pseudo-class rules in min-width media queries preserved (not dropped)
- Flattenable elements bypass router safety net (stay native)
- Removed hardcoded CSS classes from app globals (`btn-premium`, etc.)
- Pipeline audit harness with smart CSS analysis
- 550 tests passing

### January 2026
- Design Tokens Style Guide with Webflow export
- BEM combo class pattern for typography inheritance
- Comprehensive nth-child to BEM conversion
- Two-phase CSS routing (hard-blockers + full)

See [CHANGELOG.md](./CHANGELOG.md) for full history.

---

**Last Updated:** February 7, 2026
**Maintained by:** Flow Bridge Team

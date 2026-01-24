# Asset Contract v1

## Purpose
Every asset in Flow Stach must be:
- discoverable (metadata)
- previewable (image/video)
- deployable (Webflow + code)
- explainable (steps + docs)
- maintainable (dependencies + updates)

If it can't meet this contract, it doesn't ship.

## Asset Types
- `component` — single interaction/feature
- `template` — page/site level build
- `pack` — bundle of assets + docs

## Required Metadata Fields
**Required**
- `slug` (kebab-case, unique)
- `title`
- `type` (`component|template|pack`)
- `category` (must match sidebar categories)
- `tags[]` (min 3)
- `description` (1–3 sentences)
- `previewVideoUrl` OR `previewImageUrl`
- `status` (`draft|published`)
- `isNew` (boolean)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

**Recommended**
- `creatorName`
- `difficulty` (`easy|medium|hard`)
- `compatibility[]` (e.g. Webflow, GSAP, Lenis)

## Payload Contract (Deployables)
Every asset ships with **two payloads**:

### A) Webflow Payload
- `webflowJson` (string)
- Must paste into Webflow Designer successfully
- Must not override unrelated styles
- Must include required `data-*` hooks in structure (if used)

### B) Code Payload
- `codePayload` (string)
- Must include at the top:
  - dependency notes
  - init usage
  - cleanup usage (if listeners/raf)

### Dependencies
- `dependencies[]` list of strings
Examples:
- `gsap@3.x`
- `lenis@1.x`

## Asset Page UX Contract
Layout:
- **Center:** Preview + tabs
- **Right:** Details + actions

Tabs (required):
1. Preview
2. Webflow
3. Code
4. Docs

Right panel actions (required):
- Copy to Webflow
- Copy Code
- Favorite

## Webflow Tab Structure (Step-Based)
Always present these steps:

1) **Copy Structure**
- Button: "Copy to Webflow"
- Instruction: paste in Webflow Designer

2) **Add JS**
- Code block + copy button
- If none needed: "No custom JS required."

3) **Add CSS**
- Code block + copy button
- If none needed: "No custom CSS required."

4) **Configure**
- List of `data-*` attributes and what they do
- If none: "No configuration required."

## Docs Tab Required Sections
- What it does (1 paragraph)
- Markup requirements (what elements/attributes must exist)
- Options (data attributes / props)
- Common mistakes (3 bullets)
- Performance notes (if relevant)

## Definition of Done (Per Asset)
✅ metadata complete
✅ preview works
✅ webflowJson pastes into Webflow
✅ codePayload runs as described
✅ dependencies declared
✅ docs sections filled

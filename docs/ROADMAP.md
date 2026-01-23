# Flow Bridge Roadmap

**Goal**: User imports HTML → gets template → opens Webflow Designer → copies full site.

---

## Data Model

```
templates (need to add userId)
    ↓
assets (category: "Design Tokens", "Navigation", "Hero", "Sections", "Full Page")
    ↓
payloads (webflowJson, codePayload)
```

"Full Page" = the entire site as one Webflow JSON payload.

---

## Current State

| Component | Status |
|-----------|--------|
| Web app import HTML → template | ✅ Working |
| Template → assets → payloads | ✅ Working |
| "Copy Full Site" on web app | ✅ Working |
| **Templates have userId** | ❌ Missing |
| **Extension shows user's templates** | ❌ Not connected |
| **Extension copies Full Page** | ❌ Not connected |

---

## Phase 1: Add userId to Templates

**Prompt**: `flow-stach/docs/cli-prompts/03-user-scoped-templates.md`

**Run in**: `flow-stach/` folder

Changes:
1. Add `userId` field to `templates` table
2. Add `by_user` index
3. Create `templates.listMine` — list user's templates
4. Create `templates.getFullPagePayload` — get Webflow JSON for full site
5. Update import to set `userId` when creating templates

---

## Phase 2: Connect Extension to Backend

**Prompt**: `Flow-Goodies-extension/docs/03b-connect-to-templates.md`

**Run in**: `Flow-Goodies-extension/` folder

Changes:
1. Add Convex + Clerk dependencies
2. Copy `convex/_generated/` from flow-stach
3. Setup ClerkProvider with syncHost
4. Setup ConvexProvider
5. Fetch templates via `templates.listMine`
6. "Copy Full Site" button that calls `templates.getFullPagePayload`

---

## Phase 3: Test

1. `cd flow-stach && bun run dev`
2. Sign in at localhost:3000
3. Import HTML (if no templates exist)
4. `cd Flow-Goodies-extension && bun run dev`
5. Open Webflow Designer, press E
6. See your templates
7. Click "Copy Full Site"
8. Paste in Designer

---

## Phase 4: Components (Later)

Once full site works, expand extension to show:
- Template → Component groups (Design Tokens, Navigation, etc.)
- Copy individual components

---

## CLI Prompts

| # | File | Purpose | Status |
|---|------|---------|--------|
| 00 | `00-full-project-audit.md` | Project audit | ✅ Done |
| 03 | `03-user-scoped-templates.md` | Add userId to templates, create queries | 📋 Ready |
| 03b | `Flow-Goodies-extension/docs/03b-connect-to-templates.md` | Connect extension | 📋 Ready |

---

## Next Step

Run prompt **03** in flow-stach folder first.

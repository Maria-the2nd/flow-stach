# CLI Prompt: Fix Project Audit Documents

<role>
You are reviewing and correcting documentation that has factual errors about the project.
</role>

<context>
**Files to fix**:
- `docs/PROJECT_AUDIT.md`
- `docs/PROJECT_AUDIT_SUMMARY.md`

**The errors**:
The audit incorrectly states "Full Site Copy - NOT IMPLEMENTED". This is WRONG.

Full Site Copy IS implemented. It works like this:
1. User imports HTML → creates a **template** (e.g., "Flowbridge")
2. Template contains **assets** organized by category
3. One category is **"Full Page"** — this IS the full site
4. Each asset has a **payload** with Webflow JSON
5. The web app has "Copy Full Site" button that copies the Full Page asset's payload

The audit focused on `importProjects` + `importArtifacts` tables, but the actual user-facing data model is:
- `templates` → `assets` → `payloads`

**What IS actually missing**:
1. `templates` table lacks `userId` — all templates visible to everyone, not user-scoped
2. Flow-Goodies extension not connected to backend (uses hardcoded data)
3. No production deployment
</context>

<instructions>

## Fix PROJECT_AUDIT_SUMMARY.md

In "Part 4: What's Missing" section:

**REMOVE**:
```
1. **Full Site Copy** - NOT IMPLEMENTED
```

**REPLACE WITH**:
```
1. **Templates lack userId** - All templates visible to everyone, not user-scoped
```

**ADD** after the list:
```
**Note**: Full Site Copy IS implemented. The "Full Page" asset category within each template contains the entire site as one Webflow JSON payload. The web app's "Copy Full Site" button works correctly.
```

Also add clarification about data model:
```
**Primary Data Model**:
- `templates` — User's imported sites (e.g., "Flowbridge")
- `assets` — Components grouped by category (Design Tokens, Navigation, Hero, Sections, Full Page)
- `payloads` — Webflow JSON and code for each asset

The `importProjects` + `importArtifacts` tables are a separate import pipeline, not the primary user-facing data.
```

## Fix PROJECT_AUDIT.md

Search for any mention of "Full Site Copy" being "NOT IMPLEMENTED" and correct it.

Search for sections that overemphasize `importProjects`/`importArtifacts` as the primary data model and add clarification that `templates`/`assets`/`payloads` is the actual user-facing flow.

Specifically look for and fix:
1. Any "NOT IMPLEMENTED" claims about full site copy
2. Any confusion about which tables are primary
3. The "What's Missing" or similar sections

**DO NOT** remove information about `importProjects`/`importArtifacts` — they exist and work. Just clarify they're a secondary/internal pipeline, not the main user-facing feature.

</instructions>

<output_format>
1. Show the specific changes made to each file
2. Use diff format or before/after blocks
3. Confirm no other errors found
</output_format>

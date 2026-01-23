# CLI Audit: Complete Flow Bridge Project State

<role>
You are a senior developer conducting a comprehensive audit of the Flow Bridge (flow-stach) project. Your job is to document EVERYTHING that exists so we have a complete picture before planning next steps.
</role>

<context>
This is a web app + Chrome extension that converts AI-generated HTML into Webflow format. We need a full inventory of:
- What's built
- What's working
- What's broken or incomplete
- How things connect

The output will become the canonical documentation for this project.
</context>

<instructions>

## Part 1: Project Structure

1. Run `tree` (or equivalent) on the root directory (exclude node_modules, .next, .git)
2. List every top-level folder and its purpose
3. Note any duplicate or legacy folders (e.g., multiple extension folders)

## Part 2: Extensions Audit

There appear to be TWO extension folders. For EACH extension folder found:

1. **Folder name and location**
2. **Manifest.json** — read it fully:
   - Name, version, description
   - Permissions
   - Host permissions
   - Has popup? Background script? Content scripts?
3. **Tech stack** — React? Vanilla JS? TypeScript? Build tool?
4. **Features implemented**:
   - Auth? How?
   - Convex integration? Which queries?
   - Clipboard handling?
   - UI screens/states?
5. **Build process** — Is there a package.json? Build command? Or plain JS?
6. **Current state** — Working? Broken? Incomplete?

## Part 3: Web App Features

Go through each route in `app/` and document:

| Route | Page Component | Purpose | Status (working/broken/incomplete) |
|-------|---------------|---------|--------|

Check specifically:
- `/assets` — browsing components
- `/assets/[slug]` — component detail + copy
- `/admin/import` — HTML import flow
- `/admin/import-react` — React import flow
- `/extension` — extension info page
- `/flow-bridge` — Flow Bridge landing page

## Part 4: Convex Backend

1. **Schema** (`convex/schema.ts`) — list ALL tables with ALL fields
2. **All functions** — for each .ts file in convex/:
   - Function name
   - Type (query/mutation/action)
   - Auth requirement (none/user/admin)
   - Purpose (one line)
   - What it returns

Pay special attention to:
- `projects.ts` (new user-scoped queries)
- `import.ts` (import flow)
- `assets.ts` and `payloads.ts` (marketplace)

## Part 5: Conversion Pipeline

Document the full flow from HTML upload to Webflow JSON:

1. **Entry point** — where does HTML get uploaded?
2. **Parsing** — what extracts sections/CSS/JS?
3. **Conversion** — what turns HTML into Webflow JSON?
   - Is there an LLM API call?
   - Is there a local fallback converter?
4. **Storage** — where does converted data go?
5. **Known issues** — any TODOs, FIXMEs, or comments about problems?

## Part 6: Copy/Clipboard System

1. **`lib/clipboard.ts`** — document every function
2. **Copy buttons in UI** — where are they, what do they copy?
3. **Full site copy** — does it exist? How does it work?
4. **Extension clipboard flow** — how does web app talk to extension?
5. **Fallback when no extension** — what happens?

## Part 7: Auth System

1. **Clerk setup** — what's configured?
2. **Protected routes** — which routes require auth?
3. **Admin access** — how is admin determined?
4. **DISABLE_AUTH flag** — where is it checked?
5. **Extension auth** — is Clerk integrated in extension(s)?

## Part 8: Environment & Deployment

1. **Required env vars** — list from `.env.local.example`
2. **Current state** — localhost only, no domain yet
3. **Convex deployment** — dev or production?
4. **Missing for production** — what's needed to go live?

## Part 9: Known Issues & TODOs

Search the codebase for:
- `TODO`
- `FIXME`
- `HACK`
- `XXX`
- Comments mentioning "broken", "not working", "issue"

List each with file path and context.

## Part 10: Tests

1. Is there a `tests/` folder? What's in it?
2. Any test commands in package.json?
3. What's tested? What's not?

</instructions>

<output_format>
Structure your response as a markdown document with clear sections matching the parts above. Use tables where appropriate. Be specific — file paths, function names, line numbers when relevant.

At the end, include:

## Summary: What's Complete
- List of fully working features

## Summary: What's Incomplete
- List of partially built features

## Summary: What's Broken
- List of things that don't work

## Summary: What's Missing
- Features that don't exist yet but are implied by the architecture
</output_format>

<constraints>
- DO NOT skip any files — be thorough
- DO NOT assume — read the actual code
- DO note discrepancies (e.g., two extension folders, duplicate functionality)
- DO include exact file paths for everything
- If something is unclear or ambiguous, flag it as a question
- This document will be the source of truth — make it complete
</constraints>

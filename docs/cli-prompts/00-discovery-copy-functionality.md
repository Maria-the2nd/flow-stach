# CLI Discovery: What Copy Functionality Already Exists?

<role>
You are auditing existing copy functionality in the Flow Bridge web app to understand what the Chrome extension needs to call vs. rebuild.
</role>

<context>
We're building a Chrome extension companion. The web app already has copy buttons that work (with some reliability issues). Before writing more extension code, we need to know exactly what exists.

The extension should CALL existing logic, not duplicate it.
</context>

<instructions>
1. **Find all copy-related code** in `lib/clipboard.ts` and document:
   - What functions exist
   - What each does (single component? full site? code?)
   - What format they output

2. **Find copy buttons in the UI** — search for "copy" in components:
   - Where are they?
   - What do they call?
   - Is there a "Copy Full Site" button? Where?

3. **Check the import panel** (`components/admin/ImportPanel.tsx` or similar):
   - After import, what copy options exist?
   - How does full site copy work?

4. **Check artifact handling**:
   - Which artifact types are copyable?
   - What's the flow from artifact → clipboard?

5. **Document the existing flow**:
   - User uploads HTML → conversion → storage → copy button → clipboard
   - What Convex queries/functions are involved in the copy step?
</instructions>

<output_format>
## Existing Copy Functions (lib/clipboard.ts)
| Function | Purpose | Input | Output Format |

## Copy Buttons in UI
| Location | Button Text | Calls | Copies What |

## Full Site Copy
- Does it exist? Yes/No
- Where is it triggered?
- How does it combine artifacts?

## Artifact Type → Copy Action Mapping
| Artifact Type | Copyable? | Copy Function | Format |

## What Extension Needs
Based on what exists:
- Functions the extension can reuse
- Functions that need new Convex queries
- Anything missing
</output_format>

<constraints>
- DO NOT assume — read the actual code
- Report exact file paths and function names
- If something doesn't exist, say so clearly
</constraints>

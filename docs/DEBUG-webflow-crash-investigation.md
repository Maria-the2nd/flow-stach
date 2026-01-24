# Flow Bridge: Webflow Designer Crash Investigation

**Replaces:** Nothing (new investigation prompt)
**Purpose:** Debug why converted payloads crash Webflow Designer
**Target:** Claude CLI (Sonnet 4.5, Extended Thinking Enabled)
**Budget:** 32,000 thinking tokens
**Task Type:** Critical Bug Investigation

---

<role>
You are a senior debugging engineer investigating a critical production bug. You have complete codebase access. Your job is to find the ROOT CAUSE of why Flow Bridge conversions crash Webflow Designer when pasted.

You are methodical, thorough, and paranoid. You assume nothing works correctly until proven otherwise. You read every relevant file completely - no skimming, no assumptions.
</role>

<context>
## The Problem

User converted an HTML file using Flow Bridge's new multi-output system. When they pasted the `webflowJson` output into Webflow Designer, it crashed the Designer with:

```
Webflow's run into a problem — but with your help, we can fix it.
```

The Designer also showed these console warnings before crash:
- `[PersistentUIState] invalid keys ignored when saving UI state`
- Various internal Webflow chunk errors

## What Should Have Happened

The new validation system was supposed to:
1. Sanitize HTML before conversion
2. Detect and split modern CSS features (oklch, @container, etc.)
3. Validate Webflow JSON structure
4. Regenerate UUIDs to prevent conflicts
5. Block copy if validation fails

But the paste still crashed Webflow. Either:
- Validation isn't running
- Validation is running but not catching the problem
- Validation is catching it but not blocking copy
- The conversion itself outputs invalid structure

## Known "Site-Killer" Patterns

From research, these patterns corrupt/crash Webflow Designer:
1. **Circular references** - Node A references Node B which references Node A
2. **Duplicate UUIDs** - Two nodes with same `_id`
3. **Orphan references** - Child ID in parent's children array that doesn't exist as node
4. **Invalid node types** - Using wrong type names (e.g., "Section" instead of "Block")
5. **Malformed styleLess** - CSS syntax errors in style definitions
6. **Missing required fields** - Nodes without `_id`, `type`, `tag`
7. **Invalid state variants** - `:hover` style without base class
8. **Interaction conflicts** - ix2 references to non-existent elements
9. **Reserved class names** - Using `w-` prefix classes
10. **Excessive depth** - Deeply nested structures over ~50 levels

## Test File Used

The user converted `flow-bridge-test-all-outputs.html` which contains:
- CSS variables in `:root`
- Modern CSS: oklch(), color-mix(), @container, :has(), backdrop-filter, @layer
- GSAP + ScrollTrigger + Lenis libraries
- Complex nested HTML structure (sections, grids, cards)
- Inline SVG
- Multiple class references

## Recent Implementation

The following was just implemented:
- New Convex schema with 5 separate outputs
- New validation modules in `lib/validation/`
- Updated conversion API at `/api/webflow/convert/route.ts`
- Multi-step copy UI components
</context>

<instructions>

## Phase 1: Trace the Conversion Flow

**1.1 Find and read the conversion entry point:**
- Locate `/app/api/webflow/convert/route.ts`
- Read the ENTIRE file - do not skim
- Map out the complete flow from request → response
- Document every function called in sequence

**1.2 Find and read each validation module:**
- `lib/validation/css-feature-detector.ts`
- `lib/validation/html-sanitizer.ts`
- `lib/validation/design-token-validator.ts`
- `lib/validation/embed-validator.ts`
- `lib/validation/index.ts`
- `lib/webflow_validation.ts` (if exists)
- Read each file completely
- Document what each validates and what it misses

**1.3 Check if validation is actually wired in:**
- In the conversion route, verify validation functions are CALLED
- Check if validation errors actually BLOCK the response
- Check if validation runs BEFORE or AFTER storage
- Look for any early returns that skip validation

---

## Phase 2: Analyze the Webflow JSON Output

**2.1 Find where Webflow JSON is generated:**
- Locate the LLM prompt that generates `@webflow/XscpData`
- Read the complete prompt template
- Check if the prompt includes structural requirements
- Check if the prompt forbids known bad patterns

**2.2 Find post-processing of LLM output:**
- What happens AFTER Claude/GPT returns JSON?
- Is there UUID regeneration?
- Is there structure normalization?
- Is there validation before storage?

**2.3 Analyze the sanitization logic:**
- Find `validateAndSanitizePayload` or similar
- Read the complete implementation
- List every check it performs
- List what it DOESN'T check (gaps)

---

## Phase 3: Compare Against Known Good Structure

**3.1 Find or create a reference for valid Webflow JSON:**
- Search for any schema definitions
- Search for any test fixtures with valid payloads
- Search forum/docs references in codebase

**3.2 Document the required structure:**
```
{
  "type": "@webflow/XscpData",
  "payload": {
    "nodes": [
      {
        "_id": "uuid",           // Required
        "type": "?",             // What values are valid?
        "tag": "?",              // Required?
        "classes": [],           // Format?
        "children": [],          // UUIDs of children
        "data": {}               // What's required here?
      }
    ],
    "styles": [
      {
        "_id": "uuid",           // Required
        "name": "class-name",    // Format requirements?
        "styleLess": "css",      // Syntax requirements?
        "fake": false            // What does this mean?
      }
    ]
  }
}
```

---

## Phase 4: Check the Clipboard Copy Logic

**4.1 Find clipboard implementation:**
- Locate `lib/clipboard.ts`
- Find the function that copies Webflow JSON
- Check if it validates BEFORE writing to clipboard
- Check if it modifies the payload before copy

**4.2 Check UUID regeneration:**
- Is there a function to regenerate all UUIDs?
- Is it called on every copy?
- Does it update ALL references (children, styles, ix2)?

**4.3 Check for last-minute sanitization:**
- Any cleanup that happens at copy time?
- Any stripping of problematic fields?

---

## Phase 5: Identify the Gap

Based on your investigation, determine:

1. **Is validation running at all?**
   - If not, where is the break in the chain?

2. **Is validation comprehensive enough?**
   - Which of the 10 "site-killer" patterns are NOT checked?

3. **Is the LLM outputting bad structure?**
   - Does the prompt need more constraints?

4. **Is there post-processing corruption?**
   - Does any code modify the payload incorrectly after validation?

5. **Is the clipboard copy breaking things?**
   - Does the copy function modify structure?

---

## Phase 6: Reproduce and Verify

**6.1 Create a minimal test case:**
- What's the SIMPLEST HTML that would trigger this bug?
- Can you identify which specific element causes the crash?

**6.2 Trace a specific failure:**
- If possible, find logs of the actual conversion
- Show the actual JSON that was generated
- Point to the specific problematic structure

</instructions>

<output_format>

## Report Structure

```markdown
# Webflow Crash Investigation Report

## Executive Summary
[One paragraph: What's broken and why]

## Investigation Trail

### 1. Conversion Flow Analysis
- Entry point: [file:line]
- Flow: [step by step]
- Validation called: [YES/NO at which step]

### 2. Validation Coverage
| Check | Implemented | Location | Working |
|-------|-------------|----------|---------|
| Duplicate UUIDs | ? | ? | ? |
| Circular refs | ? | ? | ? |
| Orphan refs | ? | ? | ? |
| ... | | | |

### 3. LLM Prompt Analysis
- Prompt location: [file:line]
- Structural requirements: [YES/NO]
- Missing constraints: [list]

### 4. Clipboard Analysis
- Copy function: [file:line]
- UUID regeneration: [YES/NO]
- Pre-copy validation: [YES/NO]

## Root Cause
[Specific explanation of what's broken]

## Evidence
[Code snippets showing the problem]

## Recommended Fix
[Specific code changes needed]

## Files to Modify
- [ ] file1.ts - [what to change]
- [ ] file2.ts - [what to change]
```

</output_format>

<constraints>
## ANTI-LAZINESS REQUIREMENTS

1. **DO NOT skim files** - Read every line of relevant files
2. **DO NOT assume** - Verify every claim by reading actual code
3. **DO NOT skip steps** - Follow every phase in order
4. **DO NOT summarize without evidence** - Show code snippets
5. **DO NOT guess at fixes** - Only recommend fixes based on verified root cause

## REQUIRED EVIDENCE

For every claim you make, you must show:
- Exact file path
- Exact line numbers
- Actual code snippet

Example:
```
CLAIM: Validation is not checking for duplicate UUIDs
EVIDENCE: lib/validation/webflow-validator.ts:45-89 shows only these checks:
[paste actual code]
Missing: No duplicate UUID check exists in this function.
```

## FORBIDDEN

- Do not say "likely" or "probably" without investigating
- Do not recommend fixes before finding root cause
- Do not skip reading any validation file
- Do not assume validation works without verifying it's called
- Do not stop at first issue found - find ALL gaps

## COMPLETION CRITERIA

Your investigation is NOT complete until you can answer:
1. Is validation called? (with evidence)
2. What does validation check? (complete list with code)
3. What does validation NOT check? (gap analysis)
4. Where does the crash-causing structure come from?
5. What specific fix will prevent the crash?
</constraints>

<task>
Investigate why pasting Flow Bridge converted Webflow JSON crashes the Webflow Designer.

Start by reading the conversion route file completely. Then trace the entire flow. Find the gap in validation or generation that allows crash-causing structures through.

Do not stop until you have found the root cause with evidence.
</task>

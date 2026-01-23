# Flow Bridge Implementation Discovery Prompt

**Model:** Claude Sonnet 4.5 (Claude Code / CLI)  
**Extended Thinking:** YES (complex codebase analysis)  
**Purpose:** Audit existing implementation against spec, report gaps

---

## PROMPT

```
<role>
You are a senior code auditor analyzing the Flow Bridge codebase. Your task is to systematically discover what functionality exists and what's missing compared to a detailed specification. Be thorough, precise, and report findings with file paths and code evidence.
</role>

<context>
Flow Bridge is an HTML-to-Webflow conversion tool. The codebase should handle:
- HTML/CSS/JS input parsing
- Breakpoint transformation to Webflow's system
- CSS routing (native Webflow styles vs embed blocks)
- JavaScript bundling with library detection
- AI-assisted class renaming
- Webflow JSON output generation

The project uses:
- Next.js
- Convex backend
- Claude Sonnet 4 API for AI-assisted conversion
- Bun package manager
</context>

<spec_requirements>
## 1. INPUT FORMAT HANDLING
- [ ] Combined input mode (HTML with inline <style> and <script>)
- [ ] Separated input mode (three separate inputs: HTML, CSS, JS)
- [ ] Extract <style> content from combined input
- [ ] Extract <script> content from combined input
- [ ] Handle external stylesheet references (src attribute)
- [ ] Handle external script references (src attribute)
- [ ] Concatenate multiple <style> blocks
- [ ] Concatenate multiple <script> blocks

## 2. BREAKPOINT MAPPING
- [ ] Parse @media queries from CSS
- [ ] Map min-width: 1920px+ → 1920px breakpoint
- [ ] Map min-width: 1440px → 1440px breakpoint
- [ ] Map min-width: 1280px → 1280px breakpoint
- [ ] Map min-width: 992px → Desktop base
- [ ] Map max-width: 991px → Tablet
- [ ] Map max-width: 767px → Mobile Landscape
- [ ] Map max-width: 478px → Mobile Portrait
- [ ] Handle non-standard breakpoint values (round to nearest)
- [ ] Extract non-standard media queries to embed (@container, prefers-color-scheme, etc.)

## 3. HTML VALIDATION
- [ ] Detect PX units in CSS
- [ ] Convert PX to REM (base 16)
- [ ] Validate BEM class naming pattern
- [ ] Flag non-BEM classes for review
- [ ] Detect tag selectors (div {}, p {})
- [ ] Detect ID selectors (#id {})
- [ ] Detect descendant selectors (.parent .child)
- [ ] Detect child combinators (.parent > .child)
- [ ] Detect sibling combinators (+ and ~)
- [ ] Detect compound selectors (.class1.class2)
- [ ] Detect complex pseudo-selectors (::before, ::after, :nth-child)
- [ ] Strip HTML comments
- [ ] Flag nested forms as error
- [ ] Flag images without alt attribute

## 4. CSS ROUTING - NATIVE
- [ ] Route simple class selectors to native Webflow styles
- [ ] Route :hover state to native Webflow Hover state
- [ ] Route :focus state to native Webflow Focused state
- [ ] Route :active state to native Webflow Pressed state
- [ ] Route :visited state to native Webflow Visited state
- [ ] Handle all layout properties (display, position, z-index, overflow)
- [ ] Handle all box model properties (width, height, margin, padding)
- [ ] Handle all flexbox properties
- [ ] Handle all grid properties
- [ ] Handle all typography properties
- [ ] Handle all background properties
- [ ] Handle all border properties
- [ ] Handle effects (box-shadow, opacity, filter)
- [ ] Handle transforms
- [ ] Handle transitions

## 5. CSS ROUTING - EMBED
- [ ] Route @keyframes to embed
- [ ] Route ::before, ::after to embed
- [ ] Route complex pseudo-classes (:nth-child, :not, :has) to embed
- [ ] Route descendant selectors to embed
- [ ] Route child/sibling combinators to embed
- [ ] Route ID selectors to embed
- [ ] Route tag selectors to embed
- [ ] Route attribute selectors to embed
- [ ] Route compound selectors to embed
- [ ] Route @font-face to embed
- [ ] Route @supports to embed
- [ ] Route CSS variables (:root declarations) to embed
- [ ] Route vendor prefixes to embed

## 6. DATA ATTRIBUTES & ID PRESERVATION
- [ ] Preserve id attributes for JS targeting
- [ ] Preserve data-* attributes
- [ ] Preserve aria-* attributes
- [ ] Preserve role attributes
- [ ] Preserve tabindex attributes
- [ ] Scan JS for getElementById references
- [ ] Scan JS for querySelector references
- [ ] Scan JS for dataset property access
- [ ] Cross-reference JS references with HTML attributes
- [ ] Flag orphan references (JS references non-existent IDs)

## 7. JAVASCRIPT HANDLING
- [ ] Bundle all JS into embed block
- [ ] Detect GSAP usage → add CDN
- [ ] Detect ScrollTrigger usage → add CDN
- [ ] Detect Lenis usage → add CDN
- [ ] Detect Barba.js usage → add CDN
- [ ] Detect Swiper usage → add CDN
- [ ] Detect Split Type usage → add CDN
- [ ] Detect Matter.js usage → add CDN
- [ ] Detect Three.js usage → add CDN
- [ ] Detect Locomotive Scroll usage → add CDN
- [ ] Detect Anime.js usage → add CDN
- [ ] Wrap component code in DOMContentLoaded
- [ ] Handle canvas element setup for WebGL libraries
- [ ] Add CSS CDNs for libraries that need styles (Swiper, Locomotive)

## 8. ASSET MANAGEMENT
- [ ] Detect absolute URL images → keep as-is
- [ ] Detect data URI images → flag for conversion
- [ ] Detect relative path images → flag error
- [ ] Handle background-image URLs
- [ ] Handle SVG inline → keep as embed
- [ ] Detect Google Fonts links → extract font family
- [ ] Detect @font-face declarations → move to embed
- [ ] Generate asset manifest

## 9. UNIT CONVERSION
- [ ] Convert font-size PX to REM
- [ ] Convert padding/margin PX to REM
- [ ] Convert border-radius PX to REM
- [ ] Keep 1px borders as PX
- [ ] Keep media query values as PX
- [ ] Convert letter-spacing to EM

## 10. VALIDATION & ERROR HANDLING
- [ ] Check for duplicate UUIDs in output
- [ ] Check for orphan node references
- [ ] Check for circular dependencies
- [ ] Validate CSS syntax in embeds
- [ ] Warn if embed exceeds 10k characters
- [ ] Error severity levels (FATAL, ERROR, WARNING, INFO)
- [ ] Recovery strategy for partial failures

## 11. AI CLASS RENAMING
- [ ] Claude Sonnet 4 integration for class analysis
- [ ] Infer component purpose from HTML context
- [ ] Generate semantic BEM names
- [ ] Add namespace prefix (configurable)
- [ ] Maintain class mapping table
- [ ] Update CSS selectors with new names
- [ ] Update JS class references with new names
- [ ] Detect high-risk generic class names
- [ ] User configuration for namespace prefix
- [ ] User configuration to enable/disable renaming
- [ ] User configuration for class whitelist
- [ ] Output class mapping report

## 12. OUTPUT GENERATION
- [ ] Generate Webflow JSON (@webflow/XscpData format)
- [ ] Generate CSS embed block with proper breakpoint media queries
- [ ] Generate JS embed block with CDN dependencies
- [ ] Copy to clipboard functionality
- [ ] UUID generation for nodes
- [ ] Breakpoint-specific styleLess values
</spec_requirements>

<instructions>
## Your Task

Systematically audit the Flow Bridge codebase to determine implementation status of each requirement.

### Step 1: Discover Project Structure
- Find the main application directory (likely flow-stach or similar)
- Map out the file structure
- Identify key modules: parser, converter, validator, output generator

### Step 2: Audit Each Requirement
For EACH checkbox item in <spec_requirements>:

1. Search the codebase for relevant code
2. Determine status:
   - ✅ IMPLEMENTED - Found working code (cite file:line)
   - 🟡 PARTIAL - Some code exists but incomplete (explain gaps)
   - ❌ NOT FOUND - No implementation detected
   - ❓ UNCLEAR - Code exists but purpose uncertain

3. Note the specific file(s) and function(s) involved

### Step 3: Deep Dive on Critical Systems
For these core systems, provide detailed analysis:

**A. CSS Parser/Router**
- How does it currently parse CSS?
- What's the routing logic for native vs embed?
- What selectors are handled?

**B. Breakpoint Handling**
- Does breakpoint transformation exist?
- What's the current mapping logic?

**C. Webflow JSON Generation**
- Is @webflow/XscpData generation implemented?
- What's the node/style structure?

**D. AI Integration**
- Is Claude API integrated?
- What is it currently used for?
- Is class renaming implemented?

### Step 4: Identify Dependencies
List all npm packages used that relate to:
- HTML parsing
- CSS parsing
- Code transformation
- Clipboard handling
</instructions>

<output_format>
Provide your findings in this exact structure:

## DISCOVERY REPORT: Flow Bridge Implementation Audit

### Project Structure
```
[Directory tree of relevant folders]
```

### Implementation Status

#### 1. INPUT FORMAT HANDLING
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Combined input mode | ✅/🟡/❌ | file.ts:123 - description |
| ... | ... | ... |

[Repeat table for each section 1-12]

### Core System Analysis

#### A. CSS Parser/Router
**Current Implementation:**
[Detailed description]

**Files Involved:**
- path/to/file.ts - purpose

**Gaps:**
- [List what's missing]

[Repeat for B, C, D]

### Dependency Analysis
| Package | Purpose | Version |
|---------|---------|---------|
| postcss | CSS parsing | x.x.x |
| ... | ... | ... |

### Summary

**Implemented:** X/Y requirements (Z%)
**Partial:** X items
**Not Implemented:** X items

### Priority Gaps
1. [Most critical missing feature]
2. [Second most critical]
3. [Third most critical]

### Recommendations
[Brief notes on implementation approach for top gaps]
</output_format>

<constraints>
- Do NOT modify any code during this audit
- Do NOT skip any requirement - check every single checkbox item
- Cite specific file paths and line numbers as evidence
- If a file is too large, note the relevant sections
- Be honest about uncertainty - use ❓ when unclear
- Focus on the conversion pipeline, not UI/auth/database
</constraints>

<task>
Begin the audit now. Start by exploring the project structure, then systematically check each requirement in the spec.
</task>
```

---

## Usage Notes

1. **Run in project root** - CLI needs access to the full codebase
2. **Extended thinking ON** - This is a complex analysis task
3. **Be patient** - Full audit may take several minutes
4. **Save the output** - Copy the full report for planning session

## After Discovery

Bring the CLI's report back. We'll use it to:
1. Identify exactly what needs building
2. Prioritize implementation order
3. Create targeted implementation prompts for each gap

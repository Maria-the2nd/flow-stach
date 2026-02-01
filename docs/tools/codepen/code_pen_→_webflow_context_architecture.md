# CodePen → Webflow Tool — Context & Architecture

## 1. Overview

The **CodePen → Webflow** tool allows users to import a public CodePen and convert it into **Webflow‑ready output** using the same pipeline that already powers **HTML → Webflow** imports.

CodePen is treated as a **source of HTML, CSS, JavaScript, and external libraries**, not as a special project type and not as a parallel system.

In practical terms:
- A CodePen is just another way of supplying **HTML + CSS + JS + external URLs**.
- Once resolved, it becomes indistinguishable from a manual multi‑file import.
- From that point on, it flows through the **exact same pipeline, storage model, and project inspection UI**.

This tool exists to bridge real‑world frontend experimentation (CodePen) with professional Webflow editing workflows.

---

## 2. Product Philosophy

### One pipeline, many sources

Flowbridge is built around a **single import pipeline** that converts static frontend code into Webflow structures. The source of that code is interchangeable:
- Uploaded HTML bundle
- Manual multi‑file paste (HTML/CSS/JS)
- CodePen URL

Adding CodePen support does **not** justify creating a new pipeline.

### No special projects

CodePen imports create **normal Flowbridge projects**.
- Same project card
- Same inspect view
- Same outputs (components, tokens, code)

There is intentionally **no “CodePen project” concept**.

### Webflow is the editing surface of truth

Flowbridge does not try to recreate Webflow’s editor or runtime. Its role is to:
- Translate raw code into Webflow‑compatible structures
- Surface constraints and issues early
- Hand control back to Webflow for real editing

If something cannot be represented natively, it becomes **custom code** — explicitly and transparently.

---

## 3. User Flow (High‑Level)

1. User navigates to **Explore → Tools → CodePen → Webflow**
2. They are routed to **Workspace → Import** with `source=codepen`
3. User pastes a **public CodePen URL**
4. Flowbridge **fetches and resolves** the pen into:
   - HTML
   - CSS
   - JavaScript
   - External CSS URLs
   - External JS URLs
5. User reviews and edits the resolved code in the **Multi‑File editor**
6. User clicks **Import Project**
7. A standard Flowbridge **Project** is created
8. User lands in the **Project Inspect** view

At no point does the user enter a CodePen‑specific project environment.

---

## 4. Current State

As of now:
- The **CodePen Import UI is already implemented**
- It lives inside the existing **Import Project** screen
- It reuses the **Multi‑File editor** (HTML / CSS / JS + external libraries)
- Navigation from **Explore → Tools** correctly routes into Import

What is currently missing:
- Real CodePen fetch + resolution
- Validation beyond basic stubs

The UI is considered **done enough** to proceed with backend and validation work.

---

## 5. Technical Architecture

### Role of the CodePen Resolver

The **CodePen Resolver** is a small, isolated module whose only responsibility is:

> Turn a CodePen URL into the same input shape used by Multi‑File imports.

It does **not**:
- Modify the core import pipeline
- Create projects
- Apply Webflow logic

### Normalized Output Contract

The resolver outputs a normalized structure containing:
- `htmlText`
- `cssText`
- `jsText`
- `cssUrls[]`
- `jsUrls[]`
- `provenance: "codepen"`

Optional metadata (author, preprocessors, source URL) is kept separate and does not affect pipeline logic.

Once resolved, the data is passed into the **existing import pipeline unchanged**.

---

## 6. Validation & Safety Model

### Preflight vs Postflight

Validation is intentionally split into two phases:

**Preflight (before project creation)**
- Runs immediately after resolving a CodePen
- Prevents known‑broken or unsafe imports
- Blocks only when failure is guaranteed

**Postflight (after project creation)**
- Surfaces quality and compatibility issues
- Helps users debug and refine results

### Severity Levels

- **BLOCK** — Import cannot proceed
- **WARN** — Import allowed, but may be partially broken
- **INFO** — Informational only

This hierarchy avoids over‑blocking while still protecting users from dead‑end imports.

---

## 7. Constraints & Non‑Goals

### Explicit Constraints

- Only **public CodePens** are supported
- Preprocessors (SCSS, TypeScript, Babel) are accepted only as **compiled output**
- External resources must be **absolute URLs**
- Webflow size and embed limits always apply

### Non‑Goals

The tool explicitly does **not** attempt to:
- Support React, Vue, or build systems
- Execute server‑side code
- Fix all frontend anti‑patterns automatically
- Mirror CodePen’s iframe runtime behavior

Flowbridge aims for **clarity and control**, not magic.

---

## 8. Relationship to Other Documents

This document defines **intent and scope**.

For implementation details, edge cases, and concrete work items, see:
- `docs/codepen-to-webflow-gap-analysis.md`

If there is ever a conflict:
- **This document defines *what the tool is***
- **The gap analysis defines *what needs to be built***

---

## 9. Design Principle (Summary)

> A CodePen is not special.
> It is simply another way of providing HTML, CSS, and JavaScript.

Everything else follows from that.


# Flow Bridge — Project Overview

## What This Is

Flow Bridge is a conversion tool that lets users migrate AI-generated websites into Webflow.

## The Problem

Users "vibecode" their apps using AI tools — Claude Code, Cursor, ChatGPT, Lovable, Bolt, whatever. These tools output HTML/CSS/JS. But users want to **visually edit** their sites in Webflow, not stay in code forever.

The gap: AI outputs code → Webflow needs its proprietary JSON format.

Flow Bridge closes that gap.

## How It Works

1. **User uploads HTML** (with embedded or linked CSS/JS) to Flow Bridge web app
2. **Flow Bridge converts** the HTML into Webflow's `@webflow/XscpData` JSON format
3. **User copies** the converted components/site
4. **User pastes** directly into Webflow Designer
5. **User visually edits** in Webflow — full control, no code

## The Chrome Extension

The Chrome extension is the **companion to the web app**. It lives inside the browser so users can:

- Access their converted projects without leaving Webflow
- Browse their components
- Copy individual components OR the full site
- Paste directly into the Designer canvas

Every paid user has their own account with their own projects.

## Key Data Flow

```
User's AI-generated HTML
        ↓
    [Upload to Flow Bridge]
        ↓
    importProjects table (stores project metadata)
    importArtifacts table (stores converted pieces)
        ↓
    [Extension fetches user's projects]
        ↓
    [User clicks Copy]
        ↓
    Webflow JSON → Clipboard
        ↓
    [Paste in Webflow Designer]
        ↓
    Visual editing begins
```

## Current Limitations (Why Extension Exists)

The web app has copy buttons but:
- Clipboard API is unreliable across browsers
- Some conversions have errors
- No way to access projects FROM Webflow (tab switching friction)

The extension solves the clipboard reliability (via `chrome.clipboard` APIs) and the UX friction (access projects without leaving Designer).

## Related Docs

- `html-breakdown-process.md` — How HTML parsing works
- `phase-1-plumbing.md` — Initial architecture decisions
- `status.md` — Current project status

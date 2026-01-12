# Seed Playbook v1

## Goal
Load the first batch of assets safely **without an admin portal**.

We seed in two phases:
- **Phase A:** demo data (fast)
- **Phase B:** real asset import (later)

## Phase A — Demo Seed (Now)
Create 12–18 assets with:
- full metadata
- preview URLs
- payloads can be `"TODO"` placeholders

Purpose:
- UI becomes real
- favorites/testing works
- browsing/search works

## Phase B — Real Seed (Next)
Introduce a file like:
- `seed/seed.json`

And a Convex admin mutation later:
- `admin.seedFromFile()`

This lets you add 30–100 assets without manual clicking.

## Seed Checklist Per Asset (Fast)
1) slug + title
2) category + tags
3) description
4) preview video/image URL
5) webflowJson (or TODO)
6) codePayload (or TODO)
7) docs text (or TODO)

## Temporary Admin Rule (Simple)
Admin by email env var:
- `ADMIN_EMAIL=your@email.com`

If Clerk email matches, role becomes `admin`.
(Replace later with proper admin UI.)

## Definition of Done (Seed)
✅ Seed mutation inserts demo assets
✅ Assets appear in `/assets`
✅ Clicking asset opens `/assets/[slug]`
✅ Payload record exists (even if TODO)

# Flow Stach — Project Status

## Shipped / Merged

- Next.js (Bun) + shadcn UI scaffold
- Clerk auth + Convex plumbing merged
- Vault UI:
  - /assets browse (search + category filter)
  - /assets/[slug] detail (tabs + context panel)
  - skeleton loading + improved empty states
  - / redirects to /assets
- Favorites (UI-only, localStorage)
- Convex schema + queries/mutations + seed function code exists (but not runnable yet from dashboard)
- Clipboard actions:
  - Copy Code
  - Copy to Webflow (ClipboardItem attempt + fallback + toasts)
  - docs/features/clipboard.md
- Hero asset payload merged:
  - magnetic cursor Webflow JSON + JS payload + docs/assets/magnetic-cursor-effect.md
- CodePen candidates list exists:
  - docs/research/codepen-candidates-v1.md

## Waiting / Open PRs

- PR #10: Auth indicator (UserButton / sign out) — https://github.com/Maria-the2nd/flow-stach/pull/10
- PR #11: Theme toggle (next-themes) — https://github.com/Maria-the2nd/flow-stach/pull/11

## Current Blocker

- Database is empty because admin:seedDemoData cannot be run from Convex dashboard:
  - "Act as a user" does not pass identity token
  - Mutation fails with "Authentication required"
- Result: /assets is empty and /assets/magnetic-cursor-effect returns Not Found

## Next Steps (In Order)

1) Unblock seeding (highest priority)
   - Add in-app admin seed page (/admin/seed) that calls api.admin.seedDemoData
   - Restrict by env allowlist ADMIN_EMAILS
2) Validate hero loop
   - Seed assets
   - Open /assets/magnetic-cursor-effect
   - Copy to Webflow → paste into Webflow Designer
   - Iterate payload until reliable
3) Merge UI PRs
   - Merge PR #11 (theme toggle)
   - Merge PR #10 (auth indicator)
4) Convert 3–5 CodePens into real assets
   - Real payloads + docs for Webflow + c

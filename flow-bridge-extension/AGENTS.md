# `flow-bridge-extension/` — Chrome extension (Vite)

This folder is a **separate build** from the Next.js app. It provides clipboard/system integration and (optionally) sync behaviors.

## Setup & run (from this folder)

```bash
bun install
bun run dev      # vite build --watch (development mode)
bun run build
bun run typecheck
```

## Build notes

- Build tool: Vite (`vite.config.ts`)
- Outputs to `dist/`
- Static files are copied into `dist/` in the Vite `closeBundle` hook (manifest + icons).

## Entrypoints

See `vite.config.ts` rollup inputs:

- `popup.html` / `popup` entry
- `src/background.ts` (service worker/background)
- `offscreen.html` / offscreen entry

## Env vars (inlined at build time)

`vite.config.ts` inlines:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CONVEX_URL`
- `VITE_SYNC_HOST` (defaults to `http://localhost:3000`)

Do not commit real secrets/keys.


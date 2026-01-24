# `tests/` — Conversion/import test harness

This folder contains TS-based tests and repro scripts for the Flow Bridge conversion pipeline.

## How to run

From repo root:

```bash
bun run test:flowbridge
```

To run an individual test file (uses `tsx`):

```bash
bun x tsx tests/css-minifier.test.ts
```

## What belongs here

- Focused regression tests for conversion/sanitization/validation logic
- Repro scripts (`repro_*.ts`) for isolating issues

## Guardrails

- Keep tests deterministic (no external network dependency unless explicitly mocked).
- When behavior changes, update docs only if they are authoritative:
  - `AUTHORITATIVE_CURRENT_STATE.md` (canonical)
  - `SYSTEM_MANIFEST.md` (aligned summary)


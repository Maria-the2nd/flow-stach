# Convex types codegen (required after schema changes)

When you change the Convex schema or public function signatures, regenerate the Convex generated types in `convex/_generated/`.

## When to run this

- After edits to `convex/schema.ts`
- After adding/removing/renaming Convex functions (queries/mutations/actions), since `convex/_generated/api.*` reflects the API surface

## How to run

From repo root:

```bash
bunx convex codegen
```

Notes:

- Running `bun run convex:dev` also generates types while developing (see `convex/README.md`).
- If the generated files change, **commit the updated `convex/_generated/*`** so CI/teammates stay in sync.


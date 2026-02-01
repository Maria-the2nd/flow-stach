# CodePen Import Contract (Resolver + Validation)

Purpose: lock the data contract for CodePen resolution and validation without changing the existing import pipeline.

## 1) Resolver Return Shape

```ts
export type ResolverResult = {
  input: ImportInput;
  meta?: CodePenMeta;
  diagnostics: {
    preflight: ValidationMessage[];
    postflight?: ValidationMessage[];
  };
};
```

Notes:
- Resolver MUST always return `input` and `diagnostics.preflight` (empty array allowed).
- `postflight` is populated after pipeline processing (not by the resolver).

## 2) ImportInput (pipeline-facing, minimal)

```ts
export type ImportInput = {
  projectName: string;
  htmlText: string;
  cssText: string;
  jsText: string;
  cssUrls: string[];
  jsUrls: string[];
  provenance: 'codepen';
};
```

Constraints:
- `htmlText` must be non-empty (see BLOCK rules).
- External URLs MUST be absolute (see BLOCK rules).

## 3) Meta (UI/debug only, optional)

```ts
export type CodePenMeta = {
  penUrl?: string;
  user?: string;
  slug?: string;
  title?: string;
  author?: string;
  preprocessors?: string[];
  fetchedAt?: string; // ISO string
  sourceEndpoint?: string;
};
```

Notes:
- Meta MUST NOT influence pipeline logic or storage contracts.
- `preprocessors` is informational (see WARN rule).

## 4) ValidationMessage Schema

```ts
export type ValidationMessage = {
  severity: 'block' | 'warn' | 'info';
  field: 'libraries' | 'html' | 'css' | 'js' | 'general';
  code: string;
  title: string;
  detail: string;
  evidence?: string[];
  action?: {
    label: string;
    kind: string;
    payload?: Record<string, unknown>;
  };
};
```

Guidance:
- `code` must be stable and machine-friendly (e.g., `js.eval`, `html.empty`).
- `evidence` contains short snippets or URLs that triggered the message.
- `action` is optional and UI-facing only.

## 5) Validation Split

Preflight (fast checks):
- Runs immediately after Fetch.
- Runs again on Import click (after user edits).
- Blocks only when failure is guaranteed.

Postflight (pipeline-result checks):
- Runs after pipeline processing.
- Focused on size limits, sanitizer diffs, or output integrity.

## 6) Minimum Severity Rules

BLOCK (must block import):
- `document.write` usage.
- `eval` or `new Function` usage.
- ES modules: `import`/`export` or `<script type="module">`.
- Empty `htmlText`.
- Relative external URLs in `cssUrls` or `jsUrls`.
- Clearly over embed limits (size caps).

WARN (allow import, surface risk):
- Canvas / WebGL usage.
- SVG filters or SMIL usage.
- Storage APIs (localStorage, sessionStorage, indexedDB).
- Fetch / XHR usage.
- Preprocessors detected (e.g., SCSS, Babel, TypeScript).

INFO (non-blocking notices):
- Provenance notices (CodePen source).
- General import notes that do not affect output integrity.

## 7) Non-goals

- No new project type.
- No forked pipeline.
- No feature additions beyond validation and resolution.

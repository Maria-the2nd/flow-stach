export type ImportInput = {
  projectName: string;
  htmlText: string;
  cssText: string;
  jsText: string;
  cssUrls: string[];
  jsUrls: string[];
  provenance: 'codepen';
};

export type CodePenMeta = {
  penUrl?: string;
  user?: string;
  slug?: string;
  title?: string;
  author?: string;
  preprocessors?: string[];
  fetchedAt?: string;
  sourceEndpoint?: string;
};

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

export type ResolverResult = {
  input: ImportInput;
  meta?: CodePenMeta;
  diagnostics: {
    preflight: ValidationMessage[];
    postflight?: ValidationMessage[];
  };
};

type CodePenUrlParts = {
  user: string;
  slug: string;
};

type CodePenPayload = {
  html?: string;
  css?: string;
  js?: string;
  css_external?: string | string[];
  js_external?: string | string[];
  title?: string;
  user?: string;
  author?: string;
  author_name?: string;
  username?: string;
  user_name?: string;
  css_pre_processor?: string;
  js_pre_processor?: string;
  html_pre_processor?: string;
};

const CODEPEN_HOST_PATTERN = /(^|\.)codepen\.io$/i;
const CODEPEN_VIEW_TYPES = new Set(['pen', 'full', 'debug']);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function firstString(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (isNonEmptyString(value)) {
      return value.trim();
    }
  }
  return undefined;
}

export function parseCodePenUrl(penUrl: string): CodePenUrlParts | null {
  let parsed: URL;
  try {
    parsed = new URL(penUrl);
  } catch {
    return null;
  }

  if (!CODEPEN_HOST_PATTERN.test(parsed.hostname)) {
    return null;
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 3) {
    return null;
  }

  const [user, view, slug] = segments;
  if (!isNonEmptyString(user) || !isNonEmptyString(slug)) {
    return null;
  }

  if (!CODEPEN_VIEW_TYPES.has(view)) {
    return null;
  }

  return { user, slug };
}

export function buildCodePenSourceUrl(parts: CodePenUrlParts): string {
  return `https://codepen.io/${parts.user}/pen/${parts.slug}.js`;
}

export function stripJsonp(jsonp: string): string {
  const trimmed = jsonp.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const match = trimmed.match(/^[^(]*\(([\s\S]*)\)\s*;?\s*$/);
  if (!match) {
    throw new Error('Invalid JSONP payload.');
  }

  return match[1].trim();
}

export function parseCodePenJsonp(jsonp: string): CodePenPayload {
  const payload = stripJsonp(jsonp);

  try {
    return JSON.parse(payload) as CodePenPayload;
  } catch (error) {
    // Provide more context about what went wrong
    const preview = payload.substring(0, 100);
    throw new Error(
      `Failed to parse CodePen response as JSON. The response might be blocked or malformed. ` +
      `Preview: "${preview}..."`
    );
  }
}

export function normalizeExternalUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    const cleaned = value.trim();
    if (!cleaned) {
      return [];
    }
    const tokens = cleaned.split(/\s+/g).filter(Boolean);
    const urls: string[] = [];

    for (const token of tokens) {
      const parts = token.split(/(?=https?:\/\/)/g);
      for (const part of parts) {
        const trimmed = part.trim().replace(/^[,;]+|[,;]+$/g, "");
        if (trimmed) {
          urls.push(trimmed);
        }
      }
    }

    return urls;
  }

  return [];
}

function extractPreprocessors(payload: CodePenPayload): string[] {
  const candidates = [payload.css_pre_processor, payload.js_pre_processor, payload.html_pre_processor]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0 && value.toLowerCase() !== 'none');

  return Array.from(new Set(candidates));
}

export async function resolveCodePen(penUrl: string): Promise<ResolverResult> {
  const parts = parseCodePenUrl(penUrl);
  if (!parts) {
    throw new Error('Invalid CodePen URL.');
  }

  // Use the API endpoint to avoid CORS and Cloudflare blocks
  const apiUrl = `/api/codepen/fetch?penUrl=${encodeURIComponent(penUrl)}`;
  const response = await fetch(apiUrl);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMessage = errorData?.error?.message ?? `CodePen fetch failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  const jsonp = await response.text();
  const payload = parseCodePenJsonp(jsonp);

  const htmlText = isNonEmptyString(payload.html) ? payload.html : '';
  const cssText = isNonEmptyString(payload.css) ? payload.css : '';
  const jsText = isNonEmptyString(payload.js) ? payload.js : '';
  const cssUrls = normalizeExternalUrls(payload.css_external);
  const jsUrls = normalizeExternalUrls(payload.js_external);

  const title = firstString(payload.title);
  const projectName = title ?? parts.slug;

  const input: ImportInput = {
    projectName,
    htmlText,
    cssText,
    jsText,
    cssUrls,
    jsUrls,
    provenance: 'codepen',
  };

  const preprocessors = extractPreprocessors(payload);
  const meta: CodePenMeta = {
    penUrl,
    user: parts.user,
    slug: parts.slug,
    title,
    author: firstString(payload.author, payload.author_name, payload.username, payload.user_name, payload.user),
    preprocessors: preprocessors.length > 0 ? preprocessors : undefined,
    fetchedAt: new Date().toISOString(),
    sourceEndpoint: 'pen.js',
  };

  return {
    input,
    meta,
    diagnostics: {
      preflight: [],
    },
  };
}

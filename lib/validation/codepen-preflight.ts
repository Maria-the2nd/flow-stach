import type { CodePenMeta, ImportInput, ValidationMessage } from '@/lib/codepen-resolver';

export type CodePenPreflightResult = {
  blockers: ValidationMessage[];
  warnings: ValidationMessage[];
  infos: ValidationMessage[];
};

const EMBED_HARD_LIMIT_BYTES = 50 * 1024;

function bytesOf(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  return text.length;
}

function pushMessage(
  list: ValidationMessage[],
  message: ValidationMessage
): void {
  list.push(message);
}

function hasRelativeUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }
  return (
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    !trimmed.startsWith('https://')
  );
}

function addPreprocessorWarning(
  warnings: ValidationMessage[],
  preprocessors?: string[]
): void {
  if (!preprocessors || preprocessors.length === 0) {
    return;
  }

  pushMessage(warnings, {
    severity: 'warn',
    field: 'general',
    code: 'meta.preprocessors',
    title: 'Preprocessors detected',
    detail: `This pen uses preprocessors (${preprocessors.join(', ')}). Output is compiled.`,
    evidence: preprocessors,
  });
}

function addLibraryConflictWarnings(
  warnings: ValidationMessage[],
  cssUrls: string[],
  jsUrls: string[]
): void {
  const normalizeUrl = (url: string) => url.trim();
  const allUrls = [...cssUrls, ...jsUrls].map(normalizeUrl).filter(Boolean);
  const extractSemver = (url: string): string | null => {
    const match = url.match(/@(\d+\.\d+\.\d+)/);
    if (match?.[1]) {
      return match[1];
    }
    const fallback = url.match(/\b(\d+\.\d+\.\d+)\b/);
    return fallback?.[1] ?? null;
  };

  const duplicates = allUrls.filter((url, index) => allUrls.indexOf(url) !== index);
  if (duplicates.length > 0) {
    const uniqueDuplicates = Array.from(new Set(duplicates));
    pushMessage(warnings, {
      severity: 'warn',
      field: 'libraries',
      code: 'libraries.duplicates',
      title: 'Duplicate library URLs detected',
      detail: 'Remove duplicates to avoid loading the same library multiple times.',
      evidence: uniqueDuplicates,
    });
  }

  const jqueryVersions = new Map<string, string[]>();
  for (const url of jsUrls) {
    if (!url.toLowerCase().includes('jquery')) {
      continue;
    }
    const version = extractSemver(url) ?? 'unknown';
    const entries = jqueryVersions.get(version) ?? [];
    entries.push(url);
    jqueryVersions.set(version, entries);
  }

  if (jqueryVersions.size > 1) {
    const versions = Array.from(jqueryVersions.keys());
    pushMessage(warnings, {
      severity: 'warn',
      field: 'libraries',
      code: 'libraries.jquery_conflict',
      title: 'Multiple jQuery versions detected',
      detail: `Align to a single jQuery version to avoid conflicts (${versions.join(', ')}).`,
      evidence: Array.from(jqueryVersions.values()).flat(),
    });
  }

  const gsapCoreVersions = new Map<string, string[]>();
  const gsapPluginVersions = new Map<string, string[]>();
  const gsapPluginNames = [
    'ScrollTrigger',
    'ScrollToPlugin',
    'ScrollSmoother',
    'Observer',
    'Draggable',
    'Flip',
    'MotionPathPlugin',
    'SplitText',
  ];

  for (const url of jsUrls) {
    const lower = url.toLowerCase();
    const pluginName = gsapPluginNames.find((name) => lower.includes(name.toLowerCase()));
    if (pluginName) {
      const version = extractSemver(url) ?? 'unknown';
      const entries = gsapPluginVersions.get(version) ?? [];
      entries.push(url);
      gsapPluginVersions.set(version, entries);
      continue;
    }

    if (lower.includes('gsap')) {
      const version = extractSemver(url) ?? 'unknown';
      const entries = gsapCoreVersions.get(version) ?? [];
      entries.push(url);
      gsapCoreVersions.set(version, entries);
    }
  }

  if (gsapCoreVersions.size > 1) {
    const versions = Array.from(gsapCoreVersions.keys());
    pushMessage(warnings, {
      severity: 'warn',
      field: 'libraries',
      code: 'libraries.gsap_multiple_versions',
      title: 'Multiple GSAP core versions detected',
      detail: `Align to a single GSAP core version (${versions.join(', ')}).`,
      evidence: Array.from(gsapCoreVersions.values()).flat(),
    });
  }

  if (gsapPluginVersions.size > 0 && gsapCoreVersions.size > 0) {
    const coreVersions = Array.from(gsapCoreVersions.keys()).filter((v) => v !== 'unknown');
    const pluginVersions = Array.from(gsapPluginVersions.keys()).filter((v) => v !== 'unknown');
    const mismatched =
      coreVersions.length > 0 &&
      pluginVersions.length > 0 &&
      !pluginVersions.every((v) => coreVersions.includes(v));

    if (mismatched) {
      pushMessage(warnings, {
        severity: 'warn',
        field: 'libraries',
        code: 'libraries.gsap_version_mismatch',
        title: 'GSAP core/plugin version mismatch',
        detail: 'Align GSAP core and plugins to the same version to prevent runtime errors.',
        evidence: [
          ...Array.from(gsapCoreVersions.values()).flat(),
          ...Array.from(gsapPluginVersions.values()).flat(),
        ],
      });
    }
  }
}

export function runCodePenPreflight(
  input: ImportInput,
  meta?: CodePenMeta
): CodePenPreflightResult {
  const blockers: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];
  const infos: ValidationMessage[] = [];

  if (!input.htmlText.trim()) {
    pushMessage(blockers, {
      severity: 'block',
      field: 'html',
      code: 'html.empty',
      title: 'HTML is empty',
      detail: 'HTML content is required to import a project.',
    });
  }

  if (/document\.write\s*\(/i.test(input.jsText)) {
    pushMessage(blockers, {
      severity: 'block',
      field: 'js',
      code: 'js.document_write',
      title: 'document.write() detected',
      detail: 'document.write() breaks Webflow embeds and must be removed.',
      evidence: ['document.write(...)'],
    });
  }

  if (/eval\s*\(/i.test(input.jsText) || /new\s+Function\s*\(/i.test(input.jsText)) {
    pushMessage(blockers, {
      severity: 'block',
      field: 'js',
      code: 'js.dynamic_eval',
      title: 'Dynamic code execution detected',
      detail: 'eval() or new Function() is blocked for security.',
    });
  }

  if (/\bimport\s+|^\s*export\s+/m.test(input.jsText) || /<script[^>]*type\s*=\s*['"]module['"]/i.test(input.htmlText)) {
    pushMessage(blockers, {
      severity: 'block',
      field: 'js',
      code: 'js.es_modules',
      title: 'ES modules detected',
      detail: 'ES module syntax is not supported. Bundle scripts before import.',
    });
  }

  const relativeCssUrls = input.cssUrls.filter(hasRelativeUrl);
  if (relativeCssUrls.length > 0) {
    pushMessage(blockers, {
      severity: 'block',
      field: 'libraries',
      code: 'libraries.relative_css',
      title: 'Relative CSS URLs detected',
      detail: 'External CSS URLs must be absolute HTTPS links.',
      evidence: relativeCssUrls,
    });
  }

  const relativeJsUrls = input.jsUrls.filter(hasRelativeUrl);
  if (relativeJsUrls.length > 0) {
    pushMessage(blockers, {
      severity: 'block',
      field: 'libraries',
      code: 'libraries.relative_js',
      title: 'Relative JS URLs detected',
      detail: 'External JS URLs must be absolute HTTPS links.',
      evidence: relativeJsUrls,
    });
  }

  if (bytesOf(input.cssText) > EMBED_HARD_LIMIT_BYTES) {
    pushMessage(blockers, {
      severity: 'block',
      field: 'css',
      code: 'css.embed_limit',
      title: 'CSS exceeds Webflow embed limit',
      detail: 'CSS is too large for a single Webflow embed. Reduce or split it.',
    });
  }

  if (bytesOf(input.jsText) > EMBED_HARD_LIMIT_BYTES) {
    pushMessage(blockers, {
      severity: 'block',
      field: 'js',
      code: 'js.embed_limit',
      title: 'JavaScript exceeds Webflow embed limit',
      detail: 'JavaScript is too large for a single Webflow embed. Reduce or split it.',
    });
  }

  if (/<canvas\b/i.test(input.htmlText) || /webgl/i.test(input.jsText)) {
    pushMessage(warnings, {
      severity: 'warn',
      field: 'html',
      code: 'html.canvas',
      title: 'Canvas/WebGL detected',
      detail: 'Canvas/WebGL content may require manual setup in Webflow.',
    });
  }

  if (/<filter\b/i.test(input.htmlText) || /<animate\b|<animateTransform\b|<animateMotion\b/i.test(input.htmlText)) {
    pushMessage(warnings, {
      severity: 'warn',
      field: 'html',
      code: 'html.svg_filters',
      title: 'SVG filters/SMIL detected',
      detail: 'SVG filters and SMIL animations may not render correctly in Webflow.',
    });
  }

  if (/localStorage|sessionStorage|indexedDB/i.test(input.jsText)) {
    pushMessage(warnings, {
      severity: 'warn',
      field: 'js',
      code: 'js.storage_api',
      title: 'Storage APIs detected',
      detail: 'Storage APIs work in Webflow but may behave differently per domain.',
    });
  }

  if (/fetch\s*\(|XMLHttpRequest/i.test(input.jsText)) {
    pushMessage(warnings, {
      severity: 'warn',
      field: 'js',
      code: 'js.network',
      title: 'Network requests detected',
      detail: 'Fetch/XHR calls may be blocked by CORS or require extra setup.',
    });
  }

  addPreprocessorWarning(warnings, meta?.preprocessors);
  addLibraryConflictWarnings(warnings, input.cssUrls, input.jsUrls);

  pushMessage(infos, {
    severity: 'info',
    field: 'general',
    code: 'general.provenance',
    title: 'Source: CodePen',
    detail: meta?.penUrl ? `Imported from ${meta.penUrl}` : 'Imported from CodePen.',
  });

  if (input.cssUrls.length > 0 || input.jsUrls.length > 0) {
    pushMessage(infos, {
      severity: 'info',
      field: 'libraries',
      code: 'libraries.review',
      title: 'Review external libraries',
      detail: 'Ensure all external URLs are trusted and accessible from Webflow.',
    });
  }

  return { blockers, warnings, infos };
}

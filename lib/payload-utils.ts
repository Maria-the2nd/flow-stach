/**
 * Shared utilities for working with Webflow payloads.
 * Consolidates duplicate logic from asset-detail components.
 */

/**
 * Check if a Webflow JSON payload is a placeholder or invalid.
 */
export function isPlaceholderPayload(json: string | undefined): boolean {
  if (!json) return true;
  try {
    const parsed = JSON.parse(json) as {
      placeholder?: boolean;
      type?: string;
      payload?: { nodes?: unknown; styles?: unknown };
    };
    if (parsed?.placeholder === true) return true;
    if (parsed?.type !== "@webflow/XscpData") return true;
    if (!parsed.payload) return true;

    const hasNodes =
      Array.isArray(parsed.payload.nodes) && parsed.payload.nodes.length > 0;
    const hasStyles =
      Array.isArray(parsed.payload.styles) && parsed.payload.styles.length > 0;
    return !(hasNodes || hasStyles);
  } catch {
    return true;
  }
}

/**
 * Format a timestamp to a human-readable date string.
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Parse code payload to extract HTML, CSS, and JS sections.
 */
export function parseCodePayload(codePayload: string | undefined): {
  html: string;
  css: string;
  js: string;
} {
  if (!codePayload) return { html: "", css: "", js: "" };

  const sections = { html: "", css: "", js: "" };

  // Look for CSS section (between /* CSS */ or <style> markers)
  const cssMatch =
    codePayload.match(
      /\/\*\s*CSS\s*\*\/\s*([\s\S]*?)(?=\/\*\s*(?:HTML|JS|JavaScript)\s*\*\/|$)/i
    ) || codePayload.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (cssMatch) sections.css = cssMatch[1].trim();

  // Look for HTML section
  const htmlMatch = codePayload.match(
    /\/\*\s*HTML\s*\*\/\s*([\s\S]*?)(?=\/\*\s*(?:CSS|JS|JavaScript)\s*\*\/|$)/i
  );
  if (htmlMatch) sections.html = htmlMatch[1].trim();

  // Look for JS section
  const jsMatch = codePayload.match(
    /\/\*\s*(?:JS|JavaScript)\s*\*\/\s*([\s\S]*?)(?=\/\*\s*(?:HTML|CSS)\s*\*\/|$)/i
  );
  if (jsMatch) sections.js = jsMatch[1].trim();

  // If no structured sections, try to intelligently detect type
  if (!sections.html && !sections.css && !sections.js) {
    if (
      codePayload.includes("{") &&
      codePayload.includes("}") &&
      (codePayload.includes(":") || codePayload.includes("@"))
    ) {
      sections.css = codePayload;
    } else if (
      codePayload.includes("function") ||
      codePayload.includes("const ") ||
      codePayload.includes("document.") ||
      codePayload.includes("=>")
    ) {
      sections.js = codePayload;
    } else {
      sections.html = codePayload;
    }
  }

  return sections;
}

"use client";

import { toast } from "sonner";
import { runPreflightValidation, type PreflightResult } from "./preflight-validator";
import { sanitizeWebflowPayload, type SanitizationResult } from "./webflow-sanitizer";
import type { WebflowPayload } from "./webflow-converter";

export type CopyResult = { success: true } | { success: false; reason: string };

/**
 * Extended copy result with validation info.
 * CRITICAL: Used to prevent corrupted payloads from reaching Webflow Designer.
 */
export type ValidatedCopyResult =
  | { success: true; warnings?: string[]; sanitized?: boolean }
  | { success: false; reason: string; validationErrors?: string[] };

/**
 * Remove transition declarations from Webflow styleLess strings.
 * Webflow's paste parser can choke on some transition syntax.
 */
function stripTransitions(styleLess: string): string {
  const withoutTransitions = styleLess.replace(
    /(^|[;\s])transition\s*:[^;]+;?/gi,
    "$1"
  );
  return withoutTransitions
    .replace(/;\s*;/g, ";")
    .replace(/\s{2,}/g, " ")
    .trim();
}

type WebflowStyle = {
  styleLess?: string;
  variants?: Record<string, { styleLess?: string }>;
  type?: string;
  name?: string;
};

type LooseWebflowPayload = {
  type?: string;
  payload?: {
    nodes?: unknown;
    styles?: WebflowStyle[];
  };
};

/**
 * Normalize Webflow JSON payloads to be safer to paste into Webflow Designer.
 */
function normalizeWebflowJson(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString) as LooseWebflowPayload;
    if (!parsed || parsed.type !== "@webflow/XscpData" || !parsed.payload) {
      return jsonString;
    }

    const { payload } = parsed;

    if (Array.isArray(payload.styles)) {
      payload.styles = payload.styles.map((style) => {
        const nextStyle: WebflowStyle = { ...style };

        if (typeof nextStyle.styleLess === "string") {
          nextStyle.styleLess = stripTransitions(nextStyle.styleLess);
        }

        if (nextStyle.variants && typeof nextStyle.variants === "object") {
          const nextVariants: WebflowStyle["variants"] = {};
          for (const [key, variant] of Object.entries(nextStyle.variants)) {
            nextVariants[key] = {
              ...variant,
              styleLess:
                typeof variant?.styleLess === "string"
                  ? stripTransitions(variant.styleLess)
                  : variant?.styleLess,
            };
          }
          nextStyle.variants = nextVariants;
        }

        return nextStyle;
      });
    }

    const hasNodes = Array.isArray(payload.nodes) && payload.nodes.length > 0;
    if (!hasNodes && Array.isArray(payload.styles) && payload.styles.length > 0) {
      const rootClass = payload.styles.find(
        (style) => style?.type === "class" && typeof style.name === "string"
      )?.name;

      if (rootClass) {
        payload.nodes = [
          {
            _id: "fp-token-root-node",
            type: "Block",
            tag: "div",
            classes: [rootClass],
            children: [],
            data: { tag: "div", text: false, xattr: [] },
          },
        ];
      }
    }

    return JSON.stringify(parsed);
  } catch (error) {
    console.warn("[clipboard] normalizeWebflowJson failed:", error);
    return jsonString;
  }
}

/**
 * Copy plain text to clipboard using navigator.clipboard.writeText
 */
export async function copyText(text: string): Promise<CopyResult> {
  if (!text || text === "TODO") {
    toast.error("Payload not ready");
    return { success: false, reason: "payload_not_ready" };
  }

  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
    return { success: true };
  } catch (error) {
    console.error("[clipboard] copyText failed:", error);
    toast.error("Failed to copy to clipboard");
    return { success: false, reason: "clipboard_write_failed" };
  }
}

/**
 * Check if the Flow Stach Chrome extension is installed.
 * The extension sets a data attribute on the document element when active.
 */
function isExtensionInstalled(): boolean {
  return document.documentElement.hasAttribute("data-flowstach-extension");
}

/**
 * Copy Webflow JSON using the modern Clipboard API with Blob.
 * This is the preferred method - works in Chrome/Edge without extension.
 * Webflow Designer recognizes application/json MIME type.
 */
async function copyWithClipboardApi(jsonString: string): Promise<CopyResult> {
  try {
    // Create blobs for both MIME types
    const jsonBlob = new Blob([jsonString], { type: "application/json" });
    const textBlob = new Blob([jsonString], { type: "text/plain" });

    // Use ClipboardItem to write multiple formats
    const clipboardItem = new ClipboardItem({
      "application/json": jsonBlob,
      "text/plain": textBlob,
    });

    await navigator.clipboard.write([clipboardItem]);
    toast.success("Copied! Paste in Webflow Designer (Cmd/Ctrl+V)");
    return { success: true };
  } catch (error) {
    console.warn("[clipboard] ClipboardItem API failed:", error);
    return { success: false, reason: "clipboard_api_failed" };
  }
}

/**
 * Copy Webflow JSON to clipboard via the Chrome extension.
 * Uses custom events to communicate with the content script.
 */
function copyViaExtension(jsonString: string): Promise<CopyResult> {
  return new Promise((resolve) => {
    let resolved = false;

    const handler = (event: Event) => {
      if (resolved) return;
      resolved = true;
      window.removeEventListener("flowstach-copy-result", handler);

      const detail = (event as CustomEvent).detail;
      if (detail?.success) {
        toast.success("Copied! Paste in Webflow Designer (Cmd+V)");
        resolve({ success: true });
      } else {
        toast.error("Copy failed: " + (detail?.error || "Unknown error"));
        resolve({ success: false, reason: "extension_error" });
      }
    };

    window.addEventListener("flowstach-copy-result", handler);

    // Dispatch event to content script
    window.dispatchEvent(
      new CustomEvent("flowstach-copy", {
        detail: { payload: jsonString }
      })
    );

    // Timeout fallback
    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      window.removeEventListener("flowstach-copy-result", handler);
      toast.error("Extension not responding. Try reloading the page.");
      resolve({ success: false, reason: "timeout" });
    }, 5000);
  });
}

/**
 * Fallback: Copy using document-based clipboard write.
 * Last resort - may not work reliably in all browsers.
 */
function copyFallback(jsonString: string): Promise<CopyResult> {
  return new Promise((resolve) => {
    const handler = (e: ClipboardEvent) => {
      e.preventDefault();
      e.clipboardData?.setData("application/json", jsonString);
      e.clipboardData?.setData("text/plain", jsonString);
      document.removeEventListener("copy", handler);
      toast.success("Copied! Try pasting in Webflow (Cmd/Ctrl+V)");
      resolve({ success: true });
    };

    document.addEventListener("copy", handler);

    const textarea = document.createElement("textarea");
    textarea.value = " ";
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.style.opacity = "0";
    textarea.setAttribute("readonly", "");
    document.body.appendChild(textarea);
    textarea.select();

    let success = false;
    try {
      success = document.execCommand("copy");
    } catch (error) {
      console.warn("[clipboard] execCommand('copy') failed:", error);
      success = false;
    }

    document.body.removeChild(textarea);

    if (!success) {
      document.removeEventListener("copy", handler);
      toast.error("Copy failed. Try Chrome or Edge browser.");
      resolve({ success: false, reason: "execCommand_failed" });
    }
  });
}

/**
 * Validate and sanitize a Webflow payload before copy.
 * CRITICAL: This prevents corrupted payloads from reaching Webflow Designer.
 *
 * Returns the validated/sanitized JSON string if safe, or null if blocked.
 */
function validateAndSanitizePayload(jsonString: string): {
  safeJson: string | null;
  validation: PreflightResult | null;
  sanitization: SanitizationResult | null;
  blocked: boolean;
  blockReason?: string;
} {
  let payload: WebflowPayload;

  try {
    payload = JSON.parse(jsonString) as WebflowPayload;
  } catch {
    return {
      safeJson: null,
      validation: null,
      sanitization: null,
      blocked: true,
      blockReason: "Invalid JSON - cannot parse payload",
    };
  }

  // Skip validation for placeholder payloads
  if (!payload || (payload as { placeholder?: boolean }).placeholder === true) {
    return {
      safeJson: null,
      validation: null,
      sanitization: null,
      blocked: true,
      blockReason: "Placeholder payload - no Webflow JSON available",
    };
  }

  // Validate the payload structure
  if (payload.type !== "@webflow/XscpData" || !payload.payload?.nodes || !payload.payload?.styles) {
    return {
      safeJson: null,
      validation: null,
      sanitization: null,
      blocked: true,
      blockReason: "Invalid Webflow payload structure",
    };
  }

  // Run preflight validation
  const validation = runPreflightValidation(payload);

  // If validation passes without critical issues, return as-is
  if (validation.canProceed && validation.isValid) {
    return {
      safeJson: jsonString,
      validation,
      sanitization: null,
      blocked: false,
    };
  }

  // If validation fails with blocking issues, try to sanitize
  if (!validation.canProceed) {
    console.warn("[clipboard] Validation failed, attempting sanitization:", validation.summary);

    const sanitization = sanitizeWebflowPayload(payload);

    // Re-validate after sanitization
    const revalidation = runPreflightValidation(sanitization.payload);

    if (revalidation.canProceed) {
      console.info("[clipboard] Sanitization fixed issues:", sanitization.changes);
      return {
        safeJson: JSON.stringify(sanitization.payload),
        validation: revalidation,
        sanitization,
        blocked: false,
      };
    }

    // Sanitization didn't fix all issues - BLOCK the copy
    console.error("[clipboard] Sanitization failed to fix all issues:", revalidation.summary);
    return {
      safeJson: null,
      validation: revalidation,
      sanitization,
      blocked: true,
      blockReason: "Payload has critical issues that cannot be auto-fixed",
    };
  }

  // Validation has warnings but can proceed - sanitize anyway to be safe
  const sanitization = sanitizeWebflowPayload(payload);
  if (sanitization.hadIssues) {
    console.info("[clipboard] Applied sanitization fixes:", sanitization.changes);
    return {
      safeJson: JSON.stringify(sanitization.payload),
      validation,
      sanitization,
      blocked: false,
    };
  }

  return {
    safeJson: jsonString,
    validation,
    sanitization: null,
    blocked: false,
  };
}

/**
 * Copy Webflow JSON to clipboard with validation.
 *
 * CRITICAL SAFETY: This function validates payloads before copying to prevent
 * corrupted JSON from reaching Webflow Designer and corrupting projects.
 *
 * Uses the modern Clipboard API (ClipboardItem) as the primary method,
 * which works in Chrome/Edge without any extension.
 *
 * Falls back to extension or document-based copy if needed.
 */
export async function copyWebflowJson(jsonString: string | undefined): Promise<ValidatedCopyResult> {
  if (!jsonString) {
    toast.error("No Webflow payload found");
    return { success: false, reason: "no_payload" };
  }

  const json = typeof jsonString === "string" ? jsonString : JSON.stringify(jsonString);
  const normalized = normalizeWebflowJson(json);

  if (!normalized || normalized === "undefined") {
    toast.error("No Webflow payload found");
    return { success: false, reason: "no_payload" };
  }

  // CRITICAL: Validate and sanitize before copy
  const { safeJson, validation, sanitization, blocked, blockReason } = validateAndSanitizePayload(normalized);

  if (blocked) {
    const errorMsg = blockReason || "Validation failed";
    toast.error(`Cannot copy - ${errorMsg}`);
    console.error("[clipboard] Copy blocked:", blockReason, validation?.summary);

    // Extract validation errors for detailed feedback
    const validationErrors = validation?.issues
      ?.filter((i) => i.severity === "fatal" || i.severity === "error")
      ?.map((i) => i.message) || [];

    return {
      success: false,
      reason: "validation_failed",
      validationErrors: validationErrors.length > 0 ? validationErrors : [blockReason || "Unknown error"],
    };
  }

  // Use the safe (potentially sanitized) payload
  const payloadToCopy = safeJson!;

  // Try modern Clipboard API first (works in Chrome/Edge without extension)
  const clipboardResult = await copyWithClipboardApi(payloadToCopy);
  if (clipboardResult.success) {
    // Show success with any warnings
    const warnings: string[] = [];

    if (sanitization?.hadIssues) {
      warnings.push(`Auto-fixed ${sanitization.changes.length} issue(s)`);
      console.info("[clipboard] Sanitization applied:", sanitization.changes);
    }

    const validationWarnings =
      validation?.issues.filter((issue) => issue.severity === "warning") || [];

    if (validation && !validation.isValid && validationWarnings.length > 0) {
      warnings.push(`${validationWarnings.length} warning(s) - check console`);
      console.warn("[clipboard] Validation warnings:", validationWarnings);
    }

    if (warnings.length > 0) {
      toast.warning(`Copied with fixes: ${warnings.join(", ")}`);
    }

    return { success: true, warnings, sanitized: sanitization?.hadIssues };
  }

  // Fall back to extension if installed
  if (isExtensionInstalled()) {
    const result = await copyViaExtension(payloadToCopy);
    if (result.success) {
      return { success: true, sanitized: sanitization?.hadIssues };
    }
    return result;
  }

  // Last resort: document-based copy
  const fallbackResult = await copyFallback(payloadToCopy);
  if (fallbackResult.success) {
    return { success: true, sanitized: sanitization?.hadIssues };
  }
  return fallbackResult;
}

// Aliases for consistency with import page
export const copyToWebflowClipboard = copyWebflowJson;
export const copyCodeToClipboard = copyText;

/**
 * Validate a Webflow payload without copying.
 * Use this to check payloads before showing copy button.
 */
export function validateWebflowPayload(jsonString: string | undefined): {
  isValid: boolean;
  canProceed: boolean;
  errors: string[];
  warnings: string[];
} {
  if (!jsonString) {
    return { isValid: false, canProceed: false, errors: ["No payload"], warnings: [] };
  }

  try {
    const payload = JSON.parse(jsonString) as WebflowPayload;

    // Skip placeholder payloads
    if (!payload || (payload as { placeholder?: boolean }).placeholder === true) {
      return { isValid: false, canProceed: false, errors: ["Placeholder payload"], warnings: [] };
    }

    // Basic structure check
    if (payload.type !== "@webflow/XscpData" || !payload.payload?.nodes || !payload.payload?.styles) {
      return { isValid: false, canProceed: false, errors: ["Invalid structure"], warnings: [] };
    }

    const validation = runPreflightValidation(payload);

    return {
      isValid: validation.isValid,
      canProceed: validation.canProceed,
      errors: validation.issues
        .filter((i) => i.severity === "fatal" || i.severity === "error")
        .map((i) => i.message),
      warnings: validation.issues
        .filter((i) => i.severity === "warning")
        .map((i) => i.message),
    };
  } catch {
    return { isValid: false, canProceed: false, errors: ["Invalid JSON"], warnings: [] };
  }
}

import { toast } from "sonner";

export type CopyResult = { success: true } | { success: false; reason: string };

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

type WebflowPayload = {
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
    const parsed = JSON.parse(jsonString) as WebflowPayload;
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
  } catch {
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
  } catch {
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
 * This works for web-to-web paste but NOT for native apps like Webflow Designer.
 */
function copyFallback(jsonString: string): Promise<CopyResult> {
  return new Promise((resolve) => {
    const handler = (e: ClipboardEvent) => {
      e.preventDefault();
      e.clipboardData?.setData("application/json", jsonString);
      e.clipboardData?.setData("text/plain", jsonString);
      document.removeEventListener("copy", handler);
      toast.warning("Copied (limited). Install extension for Webflow paste.", {
        action: {
          label: "Get Extension",
          onClick: () => window.open("/extension", "_blank")
        }
      });
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
    } catch {
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
 * Copy Webflow JSON to clipboard.
 *
 * If the Flow Stach Chrome extension is installed, uses the extension
 * to write application/json to the native clipboard (works with Webflow Designer).
 *
 * Otherwise, falls back to web-based copy which only works for web-to-web paste.
 */
export async function copyWebflowJson(jsonString: string | undefined): Promise<CopyResult> {
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

  // Use extension if available (required for Webflow Designer paste)
  if (isExtensionInstalled()) {
    return copyViaExtension(normalized);
  }

  // Fallback to web-based copy (won't work in Webflow Designer)
  return copyFallback(normalized);
}

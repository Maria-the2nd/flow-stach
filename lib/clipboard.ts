import { toast } from "sonner";

export type CopyResult = { success: true } | { success: false; reason: string };

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
 * Copy Webflow JSON to clipboard using ClipboardItem with JSON MIME type.
 * Falls back to warning if ClipboardItem API is not supported.
 */
export async function copyWebflowJson(jsonString: string): Promise<CopyResult> {
  if (!jsonString || jsonString === "TODO") {
    toast.error("Payload not ready");
    return { success: false, reason: "payload_not_ready" };
  }

  // Check if ClipboardItem is supported
  if (typeof ClipboardItem === "undefined") {
    toast.error("Use Chrome desktop for Webflow paste");
    return { success: false, reason: "clipboard_item_unsupported" };
  }

  try {
    const blob = new Blob([jsonString], { type: "application/json" });
    const item = new ClipboardItem({ "application/json": blob });
    await navigator.clipboard.write([item]);
    toast.success("Copied to clipboard");
    return { success: true };
  } catch {
    toast.error("Use Chrome desktop for Webflow paste");
    return { success: false, reason: "clipboard_write_failed" };
  }
}

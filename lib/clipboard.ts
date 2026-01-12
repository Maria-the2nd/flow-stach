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
 * Copy Webflow JSON to clipboard using writeText for reliability.
 */
export async function copyWebflowJson(jsonString: string | undefined): Promise<CopyResult> {
  if (!jsonString) {
    toast.error("No Webflow payload found");
    return { success: false, reason: "no_payload" };
  }

  const text = typeof jsonString === "string" ? jsonString : JSON.stringify(jsonString);

  if (!text || text === "undefined") {
    toast.error("No Webflow payload found");
    return { success: false, reason: "no_payload" };
  }

  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Clipboard write failed";
    toast.error(message);
    return { success: false, reason: "clipboard_write_failed" };
  }
}

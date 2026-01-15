/**
 * Clipboard Monitor
 * Monitors clipboard for @webflow/XscpData payloads
 */

import type { ClipboardPayload } from '../types';

export class ClipboardMonitor {
  private lastClipboardText: string = "";
  private checkInterval: number | null = null;
  private isMonitoring: boolean = false;

  start(): void {
    if (this.isMonitoring) {
      console.warn('[Flow Stach] Clipboard monitor already running');
      return;
    }

    this.isMonitoring = true;
    // Check clipboard every 500ms
    this.checkInterval = window.setInterval(() => {
      this.checkClipboard();
    }, 500);

    console.log('[Flow Stach] Clipboard monitor started');
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isMonitoring = false;
    console.log('[Flow Stach] Clipboard monitor stopped');
  }

  private async checkClipboard(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      if (text === this.lastClipboardText) return;
      this.lastClipboardText = text;

      // Try to parse as Webflow payload
      const parsed = this.parseWebflowPayload(text);
      if (parsed) {
        this.onPayloadDetected(parsed);
      }
    } catch (error) {
      // Clipboard access denied or not available
      // This is expected in some contexts, so we log at debug level
      if (error instanceof Error && error.name !== 'NotAllowedError') {
        console.debug('[Flow Stach] Clipboard not accessible:', error);
      }
    }
  }

  private parseWebflowPayload(text: string): ClipboardPayload | null {
    try {
      const parsed = JSON.parse(text);
      if (parsed?.type === "@webflow/XscpData" && parsed?.payload) {
        return parsed as ClipboardPayload;
      }
    } catch {
      // Not JSON or not a Webflow payload
    }
    return null;
  }

  private onPayloadDetected(payload: ClipboardPayload): void {
    // Emit event to extension UI
    window.dispatchEvent(new CustomEvent('flowstach:payload-detected', {
      detail: { payload }
    }));
    console.log('[Flow Stach] Payload detected:', {
      nodes: payload.payload.nodes.length,
      styles: payload.payload.styles.length
    });
  }

  isActive(): boolean {
    return this.isMonitoring;
  }
}

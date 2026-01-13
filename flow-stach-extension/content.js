// Flow Stach Chrome Extension - Content Script
// Bridges the webpage with the extension's background service worker

(function () {
  "use strict";

  // Mark that the extension is installed
  document.documentElement.setAttribute("data-flowstach-extension", "true");

  // Listen for copy requests from the webpage
  window.addEventListener("flowstach-copy", async (event) => {
    const { payload } = event.detail || {};

    if (!payload) {
      dispatchResult(false, "No payload provided");
      return;
    }

    try {
      // Send message to background script
      const response = await chrome.runtime.sendMessage({
        type: "COPY_WEBFLOW_JSON",
        payload: payload
      });

      if (response && response.success) {
        dispatchResult(true);
      } else {
        dispatchResult(false, response?.error || "Unknown error");
      }
    } catch (err) {
      console.error("Flow Stach Extension: Error sending message:", err);
      dispatchResult(false, err.message);
    }
  });

  function dispatchResult(success, error = null) {
    window.dispatchEvent(
      new CustomEvent("flowstach-copy-result", {
        detail: { success, error }
      })
    );
  }

  // Log that extension is active (helpful for debugging)
  console.log("Flow Stach Extension: Active on this page");
})();

// Flow Stach Chrome Extension - Offscreen Document
// Handles actual clipboard write operations

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.target !== "offscreen" || request.type !== "WRITE_CLIPBOARD") {
    return;
  }

  writeToClipboard(request.data)
    .then(() => {
      sendResponse({ success: true });
    })
    .catch((err) => {
      console.error("Flow Stach: Clipboard write error:", err);
      sendResponse({ success: false, error: err.message });
    });

  return true; // Keep channel open for async response
});

async function writeToClipboard(jsonString) {
  return new Promise((resolve, reject) => {
    // Create a handler for the copy event
    const copyHandler = (e) => {
      e.preventDefault();

      // Set both application/json (for Webflow) and text/plain (fallback)
      e.clipboardData.setData("application/json", jsonString);
      e.clipboardData.setData("text/plain", jsonString);

      document.removeEventListener("copy", copyHandler);
      resolve();
    };

    document.addEventListener("copy", copyHandler);

    // Use the textarea to trigger the copy
    const textarea = document.getElementById("clipboard-area");
    textarea.value = " "; // Non-empty to trigger copy
    textarea.select();

    const success = document.execCommand("copy");

    if (!success) {
      document.removeEventListener("copy", copyHandler);
      reject(new Error("execCommand('copy') failed"));
    }
  });
}

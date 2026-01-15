// Flow Stach Chrome Extension - Background Service Worker
// Handles clipboard operations via offscreen document

let creatingOffscreen = null;

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "COPY_WEBFLOW_JSON") {
    handleCopyRequest(request.payload)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }

  // Handle response from offscreen document
  if (request.type === "CLIPBOARD_WRITE_COMPLETE") {
    return false;
  }
});

async function handleCopyRequest(jsonString) {
  try {
    await setupOffscreenDocument();

    // Send message to offscreen document and wait for completion
    await chrome.runtime.sendMessage({
      type: "WRITE_CLIPBOARD",
      target: "offscreen",
      data: jsonString
    });

    return { success: true };
  } catch (err) {
    console.error("Flow Stach: Clipboard write failed:", err);
    return { success: false, error: err.message };
  }
}

async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL("offscreen.html");

  // Check if offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return; // Already exists
  }

  // Prevent race condition with multiple creation attempts
  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: [chrome.offscreen.Reason.CLIPBOARD],
    justification: "Write Webflow component JSON to clipboard"
  });

  await creatingOffscreen;
  creatingOffscreen = null;
}

/**
 * Background Service Worker
 * Handles clipboard operations via offscreen document
 */

// Track offscreen document state
let offscreenDocumentCreated = false

// Message handler
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Only handle clipboard messages
  if (message.type === 'COPY_WEBFLOW_JSON' || message.type === 'COPY_TEXT') {
    handleClipboardMessage(message)
      .then(sendResponse)
      .catch((error) => {
        console.error('Background script error:', error)
        sendResponse({ success: false, error: error.message })
      })

    // Return true to indicate async response
    return true
  }

  return false
})

async function handleClipboardMessage(message: { type: string; payload: string }) {
  try {
    await ensureOffscreenDocument()

    // Forward to offscreen document
    return await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: message.type,
      payload: message.payload,
    })
  } catch (error) {
    console.error('Failed to handle clipboard message:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Clipboard operation failed',
    }
  }
}

/**
 * Ensure offscreen document exists for clipboard operations
 */
async function ensureOffscreenDocument(): Promise<void> {
  if (offscreenDocumentCreated) {
    return
  }

  // Check if already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL('offscreen.html')],
  })

  if (existingContexts.length > 0) {
    offscreenDocumentCreated = true
    return
  }

  // Create offscreen document
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.CLIPBOARD],
    justification: 'Write to clipboard with Webflow MIME type',
  })

  offscreenDocumentCreated = true
}

// Initialize
console.log('Flow Bridge background script initialized')

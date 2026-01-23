/**
 * Offscreen Document for Clipboard Operations
 *
 * Chrome extensions with Manifest V3 cannot directly write to the clipboard
 * from service workers. This offscreen document handles clipboard writes.
 *
 * Webflow expects a specific MIME type for paste operations:
 * - application/json with the Webflow payload structure
 */

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') {
    return false
  }

  handleClipboardMessage(message)
    .then(sendResponse)
    .catch((error) => {
      console.error('Offscreen clipboard error:', error)
      sendResponse({ success: false, error: error.message })
    })

  return true
})

async function handleClipboardMessage(message: {
  type: string
  payload: string
}): Promise<{ success: boolean; error?: string }> {
  switch (message.type) {
    case 'COPY_WEBFLOW_JSON':
      return copyWebflowJson(message.payload)

    case 'COPY_TEXT':
      return copyText(message.payload)

    default:
      return { success: false, error: `Unknown clipboard operation: ${message.type}` }
  }
}

/**
 * Copy Webflow JSON payload to clipboard
 *
 * Webflow Designer expects clipboard data in a specific format:
 * - MIME type: application/json
 * - Content: JSON string with @webflow/XscpData type
 *
 * The ClipboardItem API allows us to write with the correct MIME type.
 */
async function copyWebflowJson(
  payload: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Parse to validate JSON
    let jsonPayload: unknown
    try {
      jsonPayload = JSON.parse(payload)
    } catch {
      // If not valid JSON, wrap it
      jsonPayload = payload
    }

    // Create the Webflow clipboard format if not already in that format
    let webflowPayload: string
    if (
      typeof jsonPayload === 'object' &&
      jsonPayload !== null &&
      'type' in jsonPayload &&
      (jsonPayload as { type: string }).type === '@webflow/XscpData'
    ) {
      webflowPayload = payload
    } else {
      // Wrap in Webflow format
      webflowPayload = JSON.stringify({
        type: '@webflow/XscpData',
        payload: jsonPayload,
      })
    }

    // Create blob with JSON MIME type
    const blob = new Blob([webflowPayload], { type: 'application/json' })

    // Write to clipboard using ClipboardItem
    await navigator.clipboard.write([
      new ClipboardItem({
        'application/json': blob,
        // Also write as text for fallback
        'text/plain': new Blob([webflowPayload], { type: 'text/plain' }),
      }),
    ])

    console.log('✓ Webflow JSON copied to clipboard')
    return { success: true }
  } catch (error) {
    console.error('Failed to copy Webflow JSON:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Clipboard write failed',
    }
  }
}

/**
 * Copy plain text to clipboard
 */
async function copyText(
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await navigator.clipboard.writeText(text)
    console.log('✓ Text copied to clipboard')
    return { success: true }
  } catch (error) {
    console.error('Failed to copy text:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Clipboard write failed',
    }
  }
}

console.log('Flow Bridge offscreen document initialized')

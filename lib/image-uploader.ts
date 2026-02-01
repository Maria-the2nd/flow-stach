/**
 * Image uploader utilities for Flow Bridge
 * Handles image extraction, filename preservation, and upload to Convex storage
 */

export interface UploadResult {
  originalUrl: string
  hostedUrl: string | null
  filename: string
  success: boolean
  error?: string
}

// Max file size for hosting (4MB to match Webflow limit)
export const MAX_IMAGE_SIZE = 4 * 1024 * 1024

/**
 * Extract filename from URL or path
 */
export function extractFilename(url: string): string {
  // Handle data URIs
  if (url.startsWith("data:")) {
    const mimeMatch = url.match(/^data:image\/(\w+);/)
    const ext = mimeMatch ? mimeMatch[1].replace("jpeg", "jpg") : "png"
    return `image_${Date.now()}.${ext}`
  }

  // Handle file paths and URLs
  const cleanUrl = url.split("?")[0].split("#")[0]
  const parts = cleanUrl.split(/[/\\]/)
  const filename = parts[parts.length - 1]

  // Ensure we have a valid filename with extension
  if (!filename || filename.length === 0) {
    return `image_${Date.now()}.png`
  }

  // Check if filename has an extension
  const hasExtension = /\.\w{2,4}$/.test(filename)
  if (!hasExtension) {
    return `${filename}.png`
  }

  return filename
}

/**
 * Get MIME type from filename or URL
 */
export function getMimeType(urlOrFilename: string): string {
  // Handle data URIs
  if (urlOrFilename.startsWith("data:")) {
    const mimeMatch = urlOrFilename.match(/^data:(image\/\w+);/)
    return mimeMatch ? mimeMatch[1] : "image/png"
  }

  // Extract extension
  const ext = urlOrFilename.split(".").pop()?.toLowerCase()

  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    avif: "image/avif",
  }

  return mimeTypes[ext || ""] || "image/png"
}

/**
 * Fetch image as blob (handles data URIs and absolute URLs)
 */
export async function fetchImageAsBlob(url: string): Promise<Blob | null> {
  try {
    // Handle data URIs
    if (url.startsWith("data:")) {
      const response = await fetch(url)
      return await response.blob()
    }

    // Handle absolute URLs
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const response = await fetch(url)
      if (!response.ok) return null
      return await response.blob()
    }

    // Relative/local paths cannot be fetched from browser
    return null
  } catch (error) {
    console.error("Failed to fetch image:", url, error)
    return null
  }
}

/**
 * Check if an image can be fetched from the browser
 */
export function canFetchImage(url: string): boolean {
  return (
    url.startsWith("data:") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  )
}

/**
 * Check if an image URL is a local/relative path that cannot be fetched
 */
export function isLocalPath(url: string): boolean {
  // Check for Windows absolute paths
  if (/^[A-Za-z]:[/\\]/.test(url)) return true

  // Check for Unix absolute paths (file://)
  if (url.startsWith("file://")) return true

  // Check for relative paths
  if (url.startsWith("./") || url.startsWith("../")) return true

  // Check for paths without protocol
  if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("data:")) {
    return true
  }

  return false
}

/**
 * Download an image file with a specific filename
 */
export async function downloadImage(url: string, filename: string): Promise<boolean> {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const downloadUrl = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = downloadUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    URL.revokeObjectURL(downloadUrl)
    return true
  } catch (error) {
    console.error("Failed to download image:", url, error)
    return false
  }
}

/**
 * Upload an image blob to Convex storage
 */
export async function uploadImageToConvex(
  blob: Blob,
  generateUploadUrl: () => Promise<string>
): Promise<{ storageId: string } | null> {
  try {
    // Get upload URL from Convex
    const uploadUrl = await generateUploadUrl()

    // Upload the blob
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": blob.type,
      },
      body: blob,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }

    const result = await response.json()
    return { storageId: result.storageId }
  } catch (error) {
    console.error("Failed to upload image to Convex:", error)
    return null
  }
}

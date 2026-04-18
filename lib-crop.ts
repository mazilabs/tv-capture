/**
 * TV Capture — Screenshot Cropping Utility
 *
 * Crops a data-URL screenshot to specified bounds.
 * Handles Device Pixel Ratio (DPR) scaling automatically:
 *   - Input bounds are in CSS pixels (from getBoundingClientRect)
 *   - Screenshot image is in physical pixels (from captureVisibleTab)
 *   - This module multiplies by DPR before cropping
 *
 * Service Worker compatible: uses createImageBitmap() + OffscreenCanvas
 * (no DOM APIs like Image or FileReader needed).
 */

import type { ChartBounds } from "./lib-messages"

/**
 * Convert a data URL to a Blob.
 * Works in Service Worker context (no DOM dependency).
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",")
  const mime = meta.match(/:(.*?);/)?.[1] || "image/jpeg"
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

/**
 * Convert a Blob to a data URL.
 * Works in Service Worker context (no FileReader needed).
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Failed to read blob"))
    reader.readAsDataURL(blob)
  })
}

/**
 * Crop a screenshot (data URL) to the chart bounds.
 *
 * Bounds are in CSS pixels. DPR from ChartBounds is used to
 * scale to physical pixel coordinates in the screenshot image.
 *
 * Returns the cropped image as a JPEG data URL.
 * On failure, returns the original data URL unchanged.
 *
 * Uses createImageBitmap() which is available in Service Workers.
 */
export async function cropScreenshot(
  dataUrl: string,
  bounds: ChartBounds
): Promise<string> {
  try {
    // Decode image using Service Worker–compatible API
    const blob = dataUrlToBlob(dataUrl)
    const bitmap = await createImageBitmap(blob)

    const dpr = bounds.devicePixelRatio || 1

    // Scale CSS-pixel bounds to physical pixels
    const sx = Math.round(bounds.x * dpr)
    const sy = Math.round(bounds.y * dpr)
    const sw = Math.round(bounds.width * dpr)
    const sh = Math.round(bounds.height * dpr)

    // Clamp to image dimensions
    const cx = Math.max(0, Math.min(sx, bitmap.width))
    const cy = Math.max(0, Math.min(sy, bitmap.height))
    const cw = Math.min(sw, bitmap.width - cx)
    const ch = Math.min(sh, bitmap.height - cy)

    // Sanity check
    if (cw <= 0 || ch <= 0) {
      return dataUrl
    }

    // Crop using OffscreenCanvas (available in Service Workers)
    const canvas = new OffscreenCanvas(cw, ch)
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      return dataUrl
    }

    ctx.drawImage(bitmap, cx, cy, cw, ch, 0, 0, cw, ch)

    const croppedBlob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: 0.92,
    })

    return await blobToDataUrl(croppedBlob)
  } catch {
    // Any error → return original screenshot unchanged
    return dataUrl
  }
}

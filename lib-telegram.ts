/**
 * TV Capture — Telegram Bot API Client
 *
 * Provides sendMessage() for sending text messages via Telegram Bot API.
 * Used for:
 *  - Test messages (Phase 3)
 *  - Screenshot notifications (Phase 4)
 *  - Trade messages (Phase 6+)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Telegram API response shape.
 */
export type TelegramResponse = {
  ok: boolean
  result?: unknown
  error_code?: number
  description?: string
}

/**
 * Result of sendMessage() call.
 * Discriminated union for type-safe error handling.
 */
export type SendMessageResult =
  | { success: true }
  | { success: false; error: string }

/**
 * Result of sendPhoto() call.
 * Discriminated union for type-safe error handling.
 */
export type SendPhotoResult =
  | { success: true }
  | { success: false; error: string }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TELEGRAM_API_BASE = "https://api.telegram.org"

// ---------------------------------------------------------------------------
// API Client
// ---------------------------------------------------------------------------

/**
 * Send a text message via Telegram Bot API.
 *
 * @param botToken - Telegram bot token (e.g., "123456:ABC-DEF...")
 * @param chatId - Target chat ID (e.g., "987654321" or "-1001234567890")
 * @param text - Message text to send
 * @returns SendMessageResult with success status or error message
 */
export async function sendMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<SendMessageResult> {
  // Validate inputs before making API call
  if (!botToken?.trim()) {
    return {
      success: false,
      error: "Bot token is empty.",
    }
  }

  if (!chatId?.trim()) {
    return {
      success: false,
      error: "Chat ID is empty.",
    }
  }

  const url = `${TELEGRAM_API_BASE}/bot${encodeURIComponent(botToken.trim())}/sendMessage`

  // Build query parameters
  const params = new URLSearchParams({
    chat_id: chatId.trim(),
    text: text,
  })

  try {
    const response = await fetch(`${url}?${params.toString()}`, {
      method: "GET",
    })

    const data = (await response.json()) as TelegramResponse

    if (data.ok) {
      return { success: true }
    }

    // Handle API errors
    const errorCode = data.error_code || 0
    const description = data.description || "Unknown error"

    return {
      success: false,
      error: mapError(errorCode, description),
    }
  } catch (error) {
    // Network or fetch error
    return {
      success: false,
      error: "Network error. Please check your internet connection.",
    }
  }
}

/**
 * Send a photo via Telegram Bot API using multipart/form-data.
 *
 * @param botToken - Telegram bot token
 * @param chatId - Target chat ID
 * @param dataUrl - Image data URL (data:image/jpeg;base64,...)
 * @param caption - Optional photo caption
 * @returns SendPhotoResult with success status or error message
 */
export async function sendPhoto(
  botToken: string,
  chatId: string,
  dataUrl: string,
  caption?: string
): Promise<SendPhotoResult> {
  // Validate inputs
  if (!botToken?.trim()) {
    return { success: false, error: "Bot token is empty." }
  }
  if (!chatId?.trim()) {
    return { success: false, error: "Chat ID is empty." }
  }
  if (!dataUrl?.startsWith("data:image/")) {
    return { success: false, error: "Invalid image data." }
  }

  const url = `${TELEGRAM_API_BASE}/bot${encodeURIComponent(botToken.trim())}/sendPhoto`

  try {
    // Convert data URL to Blob
    const blob = await dataUrlToBlob(dataUrl)
    
    // Build FormData
    const formData = new FormData()
    formData.append("chat_id", chatId.trim())
    formData.append("photo", blob, "screenshot.jpg")
    if (caption) {
      formData.append("caption", caption)
    }

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    })

    const data = (await response.json()) as TelegramResponse

    if (data.ok) {
      return { success: true }
    }

    const errorCode = data.error_code || 0
    const description = data.description || "Unknown error"

    return {
      success: false,
      error: mapError(errorCode, description),
    }
  } catch {
    return {
      success: false,
      error: "Network error. Please check your internet connection.",
    }
  }
}

/**
 * Convert a data URL to a Blob for multipart upload.
 */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  return response.blob()
}

// ---------------------------------------------------------------------------
// Error Mapping
// ---------------------------------------------------------------------------

/**
 * Map Telegram API error codes to user-friendly messages.
 */
function mapError(errorCode: number, description: string): string {
  switch (errorCode) {
    case 401:
      return "Invalid Bot Token. Please check your token."

    case 403:
      return "Bot does not have access to this chat. Start a conversation with the bot first."

    case 400:
      if (description.toLowerCase().includes("chat not found")) {
        return "Invalid Chat ID. Make sure the bot has access to this chat."
      }
      if (description.toLowerCase().includes("user not found")) {
        return "User not found. Make sure you've started a conversation with the bot."
      }
      return `Invalid request: ${description}`

    case 429:
      return "Too many requests. Please wait a moment and try again."

    default:
      return `Telegram error (${errorCode}): ${description}`
  }
}

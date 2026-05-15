/**
 * TV Capture — Discord Webhook API Client
 *
 * Sends messages and images via Discord webhooks.
 * Supports thread routing via ?thread_id= query parameter.
 *
 * Used for:
 *  - Test messages (Settings UI)
 *  - Screenshot sends (multi-channel background handler)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for Discord send functions. */
export type DiscordMessageOptions = {
  /** Discord Snowflake thread ID. When present, appends ?thread_id= to webhook URL. */
  threadId?: string
}

/** Result of sendDiscordMessage() or sendDiscordImage(). Discriminated union. */
export type DiscordSendResult =
  | { success: true }
  | { success: false; error: string }

// ---------------------------------------------------------------------------
// Error Mapping
// ---------------------------------------------------------------------------

/**
 * Map Discord HTTP status + response body to user-friendly error messages.
 */
function mapDiscordError(status: number, body: string): string {
  switch (status) {
    case 400:
      return "Invalid request. Check the webhook URL and thread ID."

    case 401:
    case 403:
      return "Invalid webhook token. Check your webhook URL."

    case 404:
      return "Webhook not found. It may have been deleted."

    case 429: {
      let retryAfter = "a few"
      try {
        const data = JSON.parse(body)
        if (data.retry_after) {
          retryAfter = String(Math.ceil(data.retry_after))
        }
      } catch {
        // Ignore parse failure — use default message
      }
      return `Rate limited. Please wait ${retryAfter} seconds and try again.`
    }

    default:
      if (status >= 500) {
        return "Discord server error. Please try again later."
      }
      return "Connection failed. Please check your webhook URL and try again."
  }
}

// ---------------------------------------------------------------------------
// URL Helpers
// ---------------------------------------------------------------------------

/**
 * Build thread-aware webhook URL.
 * Appends ?thread_id={snowflake} or &thread_id={snowflake} if threadId is present.
 */
function buildThreadUrl(webhookUrl: string, threadId?: string): string {
  const trimmed = webhookUrl.trim()
  if (!threadId?.trim()) return trimmed
  const separator = trimmed.includes("?") ? "&" : "?"
  return `${trimmed}${separator}thread_id=${encodeURIComponent(threadId.trim())}`
}

// ---------------------------------------------------------------------------
// Data Conversion
// ---------------------------------------------------------------------------

/** Convert a data URL to a Blob for multipart upload. */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  return response.blob()
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Send a text message via Discord webhook.
 *
 * @param webhookUrl - Discord webhook URL (e.g., "https://discord.com/api/webhooks/...")
 * @param text - Message text (max 2000 chars, Discord enforced)
 * @param options - Optional thread routing
 * @returns DiscordSendResult
 */
export async function sendDiscordMessage(
  webhookUrl: string,
  text: string,
  options?: DiscordMessageOptions
): Promise<DiscordSendResult> {
  if (!webhookUrl?.trim()) {
    return { success: false, error: "Webhook URL is empty." }
  }
  if (!text?.trim()) {
    return { success: false, error: "Message text is empty." }
  }

  const url = buildThreadUrl(webhookUrl, options?.threadId)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.trim() }),
    })

    if (response.ok) {
      return { success: true }
    }

    const body = await response.text()
    return { success: false, error: mapDiscordError(response.status, body) }
  } catch {
    return {
      success: false,
      error: "Network error. Please check your internet connection.",
    }
  }
}

/**
 * Send an image with optional caption via Discord webhook (multipart/form-data).
 *
 * @param webhookUrl - Discord webhook URL
 * @param dataUrl - Image data URL (data:image/jpeg;base64,...)
 * @param caption - Optional text caption
 * @param options - Optional thread routing
 * @returns DiscordSendResult
 */
export async function sendDiscordImage(
  webhookUrl: string,
  dataUrl: string,
  caption?: string,
  options?: DiscordMessageOptions
): Promise<DiscordSendResult> {
  if (!webhookUrl?.trim()) {
    return { success: false, error: "Webhook URL is empty." }
  }
  if (!dataUrl?.startsWith("data:image/")) {
    return { success: false, error: "Invalid image data." }
  }

  const url = buildThreadUrl(webhookUrl, options?.threadId)

  try {
    const blob = await dataUrlToBlob(dataUrl)

    const formData = new FormData()
    formData.append("file", blob, "screenshot.jpg")
    if (caption?.trim()) {
      formData.append("content", caption.trim())
    }

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    })

    if (response.ok) {
      return { success: true }
    }

    const body = await response.text()
    return { success: false, error: mapDiscordError(response.status, body) }
  } catch {
    return {
      success: false,
      error: "Network error. Please check your internet connection.",
    }
  }
}

/**
 * Test Discord webhook connectivity — sends test message to main channel (no thread).
 *
 * @param webhookUrl - Discord webhook URL
 * @param displayName - Channel display name (included in test message)
 * @returns DiscordSendResult
 */
export async function testDiscordConnection(
  webhookUrl: string,
  displayName: string
): Promise<DiscordSendResult> {
  return sendDiscordMessage(webhookUrl, `✅ TV Capture test message — ${displayName}`)
}

/**
 * Test Discord thread connectivity — sends test message to a specific thread.
 *
 * @param webhookUrl - Discord webhook URL
 * @param threadId - Discord Snowflake thread ID
 * @param threadName - Thread display name (included in test message)
 * @returns DiscordSendResult
 */
export async function testDiscordThread(
  webhookUrl: string,
  threadId: string,
  threadName: string
): Promise<DiscordSendResult> {
  return sendDiscordMessage(
    webhookUrl,
    `✅ TV Capture thread test — ${threadName}`,
    { threadId }
  )
}

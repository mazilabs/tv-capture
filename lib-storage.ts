/**
 * Settings type, defaults, storage helpers, and validation logic
 * for TV Capture extension.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Settings = {
  telegram: {
    botToken: string
    chatId: string
  }
  capture: {
    delay: number
  }
  ai: {
    apiKey: string
    model: string
  }
}

export type ValidationError = {
  field: string
  message: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS: Settings = {
  telegram: {
    botToken: "",
    chatId: "",
  },
  capture: {
    delay: 200,
  },
  ai: {
    apiKey: "",
    model: "",
  },
}

const STORAGE_KEY = "tv-capture-settings"

// ---------------------------------------------------------------------------
// Storage helpers (using raw chrome.storage.local)
// ---------------------------------------------------------------------------

/**
 * Load settings from chrome.storage.local.
 * Merges with defaults so new fields always have a value.
 */
export async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  const raw = result[STORAGE_KEY]
  if (!raw) return { ...DEFAULT_SETTINGS }
  return { ...DEFAULT_SETTINGS, ...raw } as Settings
}

/**
 * Save settings to chrome.storage.local.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings })
}

/**
 * Remove all stored settings (useful for testing).
 */
export async function clearSettings(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY)
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate settings and return an array of errors (empty = valid).
 *
 * Rules:
 * - If both telegram fields are empty → valid (user hasn't configured yet)
 * - If one telegram field is filled, the other must be too
 * - botToken must look like a Telegram bot token (starts with digit, contains ":")
 * - chatId must be numeric or start with "-"
 * - delay must be a number between 50 and 2000
 */
export function validateSettings(settings: Settings): ValidationError[] {
  const errors: ValidationError[] = []
  const { telegram, capture } = settings
  const tokenFilled = telegram.botToken.trim().length > 0
  const chatIdFilled = telegram.chatId.trim().length > 0

  // Telegram: partial fill check
  if (tokenFilled && !chatIdFilled) {
    errors.push({
      field: "telegram.chatId",
      message: "Chat ID is required when Bot Token is provided.",
    })
  }
  if (chatIdFilled && !tokenFilled) {
    errors.push({
      field: "telegram.botToken",
      message: "Bot Token is required when Chat ID is provided.",
    })
  }

  // Telegram: token format (only if filled)
  if (tokenFilled) {
    const token = telegram.botToken.trim()
    if (!/^\d/.test(token) || !token.includes(":")) {
      errors.push({
        field: "telegram.botToken",
        message: "Bot Token must start with a number and contain a colon (:).",
      })
    }
  }

  // Telegram: chat ID format (only if filled)
  if (chatIdFilled) {
    const chatId = telegram.chatId.trim()
    if (!/^-?\d+$/.test(chatId)) {
      errors.push({
        field: "telegram.chatId",
        message: "Chat ID must be a number (or negative number for groups).",
      })
    }
  }

  // Capture delay
  if (typeof capture.delay !== "number" || isNaN(capture.delay)) {
    errors.push({
      field: "capture.delay",
      message: "Delay must be a number.",
    })
  } else if (capture.delay < 50 || capture.delay > 2000) {
    errors.push({
      field: "capture.delay",
      message: "Delay must be between 50 and 2000 ms.",
    })
  }

  return errors
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Check if Telegram credentials are configured (non-empty).
 */
export function isConfigured(settings: Settings): boolean {
  return (
    settings.telegram.botToken.trim().length > 0 &&
    settings.telegram.chatId.trim().length > 0
  )
}

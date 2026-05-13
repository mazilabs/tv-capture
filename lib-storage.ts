/**
 * Settings type, defaults, storage helpers, and validation logic
 * for TV Capture extension.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Settings = {
  version?: number
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
  version: 2,
  telegram: { botToken: "", chatId: "" },
  capture: { delay: 200 },
  ai: { apiKey: "", model: "" },
}

const STORAGE_KEY = "tv-capture-settings"

/**
 * Current settings schema version.
 * undefined / missing = 0.1.0 format (no version field).
 * 2 = 0.2.0 format (channels-based).
 */
const CURRENT_VERSION = 2

// ---------------------------------------------------------------------------
// Storage helpers (using raw chrome.storage.local)
// ---------------------------------------------------------------------------

/**
 * Load settings from chrome.storage.local.
 * Merges with defaults so new fields always have a value.
 * Auto-migrates from 0.1.0 format (no version field) to 0.2.0.
 */
export async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  const raw = result[STORAGE_KEY]

  if (!raw) {
    return { ...DEFAULT_SETTINGS }
  }

  const settings: Settings = { ...DEFAULT_SETTINGS, ...raw } as Settings

  // Check raw stored version (not settings.version, which is masked by
  // DEFAULT_SETTINGS.version = 2 via the spread merge above).
  // When raw has no version field, raw.version is explicitly undefined,
  // indicating 0.1.0 format that needs migration.
  const storedVersion = (raw as Record<string, unknown>).version as
    | number
    | undefined
  if (storedVersion === undefined || storedVersion < CURRENT_VERSION) {
    await migrateToV2(settings)
  }

  return settings
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
// Migration
// ---------------------------------------------------------------------------

/**
 * Migrate settings from 0.1.0 to 0.2.0 format.
 * Creates a Telegram channel from existing telegram config.
 * Idempotent: guarded by version field check in loadSettings().
 * Uses dynamic import to avoid circular dependency with lib-channels.
 */
async function migrateToV2(settings: Settings): Promise<void> {
  // Check if old telegram config has data worth migrating
  const hasTelegram =
    settings.telegram?.botToken?.trim().length > 0 &&
    settings.telegram?.chatId?.trim().length > 0

  if (hasTelegram) {
    // Import dynamically to avoid circular dependency at module level
    const { loadChannelStorage, saveChannelStorage } = await import(
      "./lib-channels"
    )

    const storage = await loadChannelStorage()

    // Create migrated channel
    storage.channels.push({
      id: storage.idCounter,
      internalId: "tg-migrated-channel",
      type: "telegram",
      name: "Migrated Channel",
      displayName: "TG: Migrated Channel",
      credentials: {
        type: "telegram",
        botToken: settings.telegram.botToken.trim(),
        chatId: settings.telegram.chatId.trim(),
      },
      order: storage.channels.length,
    })
    storage.idCounter++

    await saveChannelStorage(storage)
  }

  // Mark as migrated
  settings.version = CURRENT_VERSION
  await saveSettings(settings)
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
 */
export function validateSettings(settings: Settings): ValidationError[] {
  const errors: ValidationError[] = []
  const { telegram } = settings
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

  // Capture: delay validation
  const delay = settings.capture?.delay
  if (delay !== undefined && (Number.isNaN(delay) || delay < 50 || delay > 2000)) {
    errors.push({
      field: "capture.delay",
      message: "Capture delay must be between 50 and 2000 milliseconds.",
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

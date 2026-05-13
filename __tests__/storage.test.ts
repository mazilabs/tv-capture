/**
 * Unit tests for lib-storage.ts
 *
 * Tests validation logic, defaults, merge behavior, isConfigured(),
 * and settings migration (0.1.0 → 0.2.0).
 * The chrome.storage.local API is mocked globally.
 */
import { describe, it, expect, beforeEach } from "vitest"
import {
  validateSettings,
  isConfigured,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  clearSettings,
} from "../lib-storage"
import type { Settings } from "../lib-storage"
import { loadChannelStorage } from "../lib-channels"

// ---------------------------------------------------------------------------
// Mock chrome.storage.local
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Fresh storage object for each test — prevents state bleeding between tests
  // since mock closures capture this specific local variable
  const testStorage: Record<string, unknown> = {}

  ;(globalThis as any).chrome = {
    storage: {
      local: {
        get(keys: string | string[]) {
          const keyList = Array.isArray(keys) ? keys : [keys]
          const result: Record<string, unknown> = {}
          for (const k of keyList) {
            if (k in testStorage) result[k] = testStorage[k]
          }
          return Promise.resolve(result)
        },
        set(items: Record<string, unknown>) {
          Object.assign(testStorage, items)
          return Promise.resolve()
        },
        remove(keys: string | string[]) {
          const keyList = Array.isArray(keys) ? keys : [keys]
          for (const k of keyList) delete testStorage[k]
          return Promise.resolve()
        },
      },
    },
  }
})

// ---------------------------------------------------------------------------
// DEFAULT_SETTINGS
// ---------------------------------------------------------------------------

describe("DEFAULT_SETTINGS", () => {
  it("has all expected keys including version", () => {
    expect(DEFAULT_SETTINGS).toHaveProperty("version", 2)
    expect(DEFAULT_SETTINGS).toHaveProperty("telegram.botToken", "")
    expect(DEFAULT_SETTINGS).toHaveProperty("telegram.chatId", "")
    expect(DEFAULT_SETTINGS).toHaveProperty("capture.delay", 200)
    expect(DEFAULT_SETTINGS).toHaveProperty("ai.apiKey", "")
    expect(DEFAULT_SETTINGS).toHaveProperty("ai.model", "")
  })
})

// ---------------------------------------------------------------------------
// validateSettings
// ---------------------------------------------------------------------------

describe("validateSettings", () => {
  it("returns no errors for default (empty) settings", () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toHaveLength(0)
  })

  it("returns error when botToken is filled but chatId is empty", () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      telegram: { botToken: "123456:ABC", chatId: "" },
    }
    const errors = validateSettings(s)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.field === "telegram.chatId")).toBe(true)
  })

  it("returns error when chatId is filled but botToken is empty", () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      telegram: { botToken: "", chatId: "987654321" },
    }
    const errors = validateSettings(s)
    expect(errors.some((e) => e.field === "telegram.botToken")).toBe(true)
  })

  it("accepts valid bot token format", () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      telegram: { botToken: "123456:ABC-DEF1234", chatId: "987654321" },
    }
    expect(validateSettings(s)).toHaveLength(0)
  })

  it("rejects bot token that does not start with a digit", () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      telegram: { botToken: "ABC:DEF", chatId: "123" },
    }
    expect(validateSettings(s).some((e) => e.field === "telegram.botToken")).toBe(true)
  })

  it("rejects bot token without colon", () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      telegram: { botToken: "123456ABC", chatId: "123" },
    }
    expect(validateSettings(s).some((e) => e.field === "telegram.botToken")).toBe(true)
  })

  it("accepts positive numeric chatId", () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      telegram: { botToken: "123:ABC", chatId: "987654321" },
    }
    expect(validateSettings(s)).toHaveLength(0)
  })

  it("accepts negative numeric chatId (group)", () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      telegram: { botToken: "123:ABC", chatId: "-1001234567890" },
    }
    expect(validateSettings(s)).toHaveLength(0)
  })

  it("rejects non-numeric chatId", () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      telegram: { botToken: "123:ABC", chatId: "abc" },
    }
    expect(validateSettings(s).some((e) => e.field === "telegram.chatId")).toBe(true)
  })

  it("accepts delay of 50 (lower bound)", () => {
    const s: Settings = { ...DEFAULT_SETTINGS, capture: { delay: 50 } }
    expect(validateSettings(s)).toHaveLength(0)
  })

  it("accepts delay of 2000 (upper bound)", () => {
    const s: Settings = { ...DEFAULT_SETTINGS, capture: { delay: 2000 } }
    expect(validateSettings(s)).toHaveLength(0)
  })

  it("rejects delay below 50", () => {
    const s: Settings = { ...DEFAULT_SETTINGS, capture: { delay: 49 } }
    expect(validateSettings(s).some((e) => e.field === "capture.delay")).toBe(true)
  })

  it("rejects delay above 2000", () => {
    const s: Settings = { ...DEFAULT_SETTINGS, capture: { delay: 2001 } }
    expect(validateSettings(s).some((e) => e.field === "capture.delay")).toBe(true)
  })

  it("rejects NaN delay", () => {
    const s: Settings = { ...DEFAULT_SETTINGS, capture: { delay: NaN } }
    expect(validateSettings(s).some((e) => e.field === "capture.delay")).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// isConfigured
// ---------------------------------------------------------------------------

describe("isConfigured", () => {
  it("returns false for default (empty) settings", () => {
    expect(isConfigured(DEFAULT_SETTINGS)).toBe(false)
  })

  it("returns false when only botToken is set", () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      telegram: { botToken: "123:ABC", chatId: "" },
    }
    expect(isConfigured(s)).toBe(false)
  })

  it("returns false when only chatId is set", () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      telegram: { botToken: "", chatId: "123" },
    }
    expect(isConfigured(s)).toBe(false)
  })

  it("returns true when both botToken and chatId are set", () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      telegram: { botToken: "123:ABC", chatId: "987654321" },
    }
    expect(isConfigured(s)).toBe(true)
  })

  it("returns false for whitespace-only values", () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      telegram: { botToken: "  ", chatId: "  " },
    }
    expect(isConfigured(s)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// loadSettings / saveSettings / clearSettings
// ---------------------------------------------------------------------------

describe("loadSettings", () => {
  it("returns defaults when nothing is stored", async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it("returns stored values merged with defaults", async () => {
    await saveSettings({
      ...DEFAULT_SETTINGS,
      telegram: { botToken: "123:ABC", chatId: "987" },
    })
    const settings = await loadSettings()
    expect(settings.telegram.botToken).toBe("123:ABC")
    expect(settings.telegram.chatId).toBe("987")
    expect(settings.capture.delay).toBe(200)
  })
})

describe("saveSettings", () => {
  it("persists settings that can be loaded back", async () => {
    const custom: Settings = {
      ...DEFAULT_SETTINGS,
      telegram: { botToken: "999:XYZ", chatId: "111" },
      capture: { delay: 500 },
    }
    await saveSettings(custom)
    expect(await loadSettings()).toEqual(custom)
  })
})

describe("clearSettings", () => {
  it("removes stored settings, loadSettings returns defaults", async () => {
    await saveSettings({
      ...DEFAULT_SETTINGS,
      telegram: { botToken: "123:ABC", chatId: "456" },
    })
    await clearSettings()
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})

// ---------------------------------------------------------------------------
// Migration (0.1.0 → 0.2.0)
// ---------------------------------------------------------------------------

describe("migration", () => {
  it("M1: fresh install returns DEFAULT_SETTINGS with version 2, no channels", async () => {
    const settings = await loadSettings()

    expect(settings.version).toBe(2)
    expect(settings.telegram).toEqual({ botToken: "", chatId: "" })
    expect(settings.capture).toEqual({ delay: 200 })
    expect(settings.ai).toEqual({ apiKey: "", model: "" })

    // No channels should be created on fresh install
    const channelStorage = await loadChannelStorage()
    expect(channelStorage.channels).toHaveLength(0)
  })

  it("M2: 0.1.0 format with configured telegram creates a channel", async () => {
    // Simulate 0.1.0 stored data: no version, no capture, no ai
    await chrome.storage.local.set({
      "tv-capture-settings": {
        telegram: { botToken: "123456:ABC-DEF1234", chatId: "987654321" },
      },
    })

    const settings = await loadSettings()

    expect(settings.version).toBe(2)
    expect(settings.telegram.botToken).toBe("123456:ABC-DEF1234")
    expect(settings.telegram.chatId).toBe("987654321")

    // A channel should have been created from migration
    const channelStorage = await loadChannelStorage()
    expect(channelStorage.channels).toHaveLength(1)
    expect(channelStorage.channels[0].credentials).toEqual({
      type: "telegram",
      botToken: "123456:ABC-DEF1234",
      chatId: "987654321",
    })
  })

  it("M3: 0.1.0 format with empty telegram does not create a channel", async () => {
    // Simulate 0.1.0 stored data with empty telegram
    await chrome.storage.local.set({
      "tv-capture-settings": {
        telegram: { botToken: "", chatId: "" },
      },
    })

    const settings = await loadSettings()

    expect(settings.version).toBe(2)

    // No channel should be created for empty telegram config
    const channelStorage = await loadChannelStorage()
    expect(channelStorage.channels).toHaveLength(0)
  })

  it("M4: idempotency — second loadSettings call does not duplicate", async () => {
    // Set up 0.1.0 data
    await chrome.storage.local.set({
      "tv-capture-settings": {
        telegram: { botToken: "123:ABC", chatId: "456" },
      },
    })

    // First call — migration fires
    await loadSettings()

    // Second call — migration should NOT fire
    await loadSettings()

    // Check only 1 channel was created
    const channelStorage = await loadChannelStorage()
    expect(channelStorage.channels).toHaveLength(1)
  })

  it("M5: version 2 already set does not trigger migration", async () => {
    // Set up data that already has version: 2
    await chrome.storage.local.set({
      "tv-capture-settings": {
        version: 2,
        telegram: { botToken: "123:ABC", chatId: "456" },
        capture: { delay: 200 },
        ai: { apiKey: "", model: "" },
      },
    })

    await loadSettings()

    // No channel should be created since version is already 2
    const channelStorage = await loadChannelStorage()
    expect(channelStorage.channels).toHaveLength(0)
  })

  it("M6: migration preserves other settings fields", async () => {
    // Set up 0.1.0 data with only telegram config
    await chrome.storage.local.set({
      "tv-capture-settings": {
        telegram: { botToken: "123:ABC", chatId: "456" },
      },
    })

    const settings = await loadSettings()

    // capture and ai fields should be preserved from defaults
    expect(settings.capture).toEqual({ delay: 200 })
    expect(settings.ai).toEqual({ apiKey: "", model: "" })
  })

  it("M7: migrated channel has correct hardcoded fields", async () => {
    // Set up 0.1.0 data
    await chrome.storage.local.set({
      "tv-capture-settings": {
        telegram: { botToken: "999:XYZ", chatId: "-1001234567890" },
      },
    })

    await loadSettings()

    const channelStorage = await loadChannelStorage()
    const channel = channelStorage.channels[0]

    expect(channel.internalId).toBe("tg-migrated-channel")
    expect(channel.displayName).toBe("TG: Migrated Channel")
    expect(channel.type).toBe("telegram")
    expect(channel.name).toBe("Migrated Channel")
    expect(channel.order).toBe(0)
    expect(channel.credentials).toEqual({
      type: "telegram",
      botToken: "999:XYZ",
      chatId: "-1001234567890",
    })
  })
})

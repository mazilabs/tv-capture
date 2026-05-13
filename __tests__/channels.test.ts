/**
 * Unit tests for lib-channels.ts
 *
 * Tests channel storage helpers, utility functions, and CRUD operations.
 * The chrome.storage.local API is mocked globally.
 */
import { describe, it, expect, beforeEach } from "vitest"
import {
  loadChannelStorage,
  saveChannelStorage,
  clearChannels,
  generateInternalId,
  generateDisplayName,
  areCredentialsValid,
  isAnyChannelConfigured,
  createChannel,
  getChannels,
  updateChannel,
  deleteChannel,
  updateChannelOrder,
  addThreadToChannel,
  removeThreadFromChannel,
  getThreadsForChannel,
} from "../lib-channels"
import type { Channel, ThreadConfig } from "../lib-channels"

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
// Storage Helpers
// ---------------------------------------------------------------------------

describe("loadChannelStorage", () => {
  it("returns default storage when nothing is stored", async () => {
    const result = await loadChannelStorage()
    expect(result).toEqual({ idCounter: 1, threadIdCounter: 1, channels: [] })
  })

  it("returns persisted data after manual save", async () => {
    // Initialize then save modified data via the API
    await loadChannelStorage()
    await saveChannelStorage({ idCounter: 5, channels: [{ id: 1, name: "test" } as Channel] })

    const result = await loadChannelStorage()
    expect(result.idCounter).toBe(5)
    expect(result.channels).toHaveLength(1)
  })

  it("returns persisted data after save", async () => {
    const data = await loadChannelStorage()
    data.idCounter = 10
    await saveChannelStorage(data)

    const loaded = await loadChannelStorage()
    expect(loaded.idCounter).toBe(10)
  })
})

describe("clearChannels", () => {
  it("removes storage, subsequent load returns defaults", async () => {
    const data = await loadChannelStorage()
    data.idCounter = 99
    await saveChannelStorage(data)

    await clearChannels()

    const result = await loadChannelStorage()
    expect(result).toEqual({ idCounter: 1, threadIdCounter: 1, channels: [] })
  })
})

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

describe("generateInternalId", () => {
  it('returns "tg-main-trading-group" for "Main Trading Group" on telegram', () => {
    expect(generateInternalId("Main Trading Group", "telegram")).toBe(
      "tg-main-trading-group"
    )
  })

  it('returns "dc-discord-alerts" for "Discord Alerts!" on discord', () => {
    expect(generateInternalId("Discord Alerts!", "discord")).toBe(
      "dc-discord-alerts"
    )
  })

  it('returns "tg-spaces" for "  Spaces  " on telegram', () => {
    expect(generateInternalId("  Spaces  ", "telegram")).toBe("tg-spaces")
  })

  it('returns "tg-channel" for empty name on telegram (fallback)', () => {
    expect(generateInternalId("", "telegram")).toBe("tg-channel")
  })

  it('returns "dc-abc-123-test" for "ABC-123 Test" on discord', () => {
    expect(generateInternalId("ABC-123 Test", "discord")).toBe(
      "dc-abc-123-test"
    )
  })
})

describe("generateDisplayName", () => {
  it('returns "TG: Main Group" for telegram', () => {
    expect(generateDisplayName("Main Group", "telegram")).toBe("TG: Main Group")
  })

  it('returns "DC: Alerts" for discord', () => {
    expect(generateDisplayName("Alerts", "discord")).toBe("DC: Alerts")
  })
})

describe("areCredentialsValid", () => {
  it("returns true for valid telegram credentials", () => {
    expect(
      areCredentialsValid({
        type: "telegram",
        botToken: "abc",
        chatId: "123",
      })
    ).toBe(true)
  })

  it("returns false for telegram with empty botToken", () => {
    expect(
      areCredentialsValid({
        type: "telegram",
        botToken: "",
        chatId: "123",
      })
    ).toBe(false)
  })

  it("returns false for telegram with empty chatId", () => {
    expect(
      areCredentialsValid({
        type: "telegram",
        botToken: "abc",
        chatId: "",
      })
    ).toBe(false)
  })

  it("returns false for telegram with whitespace-only values", () => {
    expect(
      areCredentialsValid({
        type: "telegram",
        botToken: "  ",
        chatId: "  ",
      })
    ).toBe(false)
  })

  it("returns true for valid discord credentials", () => {
    expect(
      areCredentialsValid({
        type: "discord",
        webhookUrl: "https://discord.com/api/webhooks/123/abc",
        threads: [],
      })
    ).toBe(true)
  })

  it("returns false for discord with empty webhookUrl", () => {
    expect(
      areCredentialsValid({
        type: "discord",
        webhookUrl: "",
        threads: [],
      })
    ).toBe(false)
  })
})

describe("isAnyChannelConfigured", () => {
  it("returns false for empty array", () => {
    expect(isAnyChannelConfigured([])).toBe(false)
  })

  it("returns true with one valid telegram channel", () => {
    const channels: Channel[] = [
      {
        id: 1,
        internalId: "tg-test",
        type: "telegram",
        name: "Test",
        displayName: "TG: Test",
        credentials: { type: "telegram", botToken: "abc", chatId: "123" },
        order: 0,
      },
    ]
    expect(isAnyChannelConfigured(channels)).toBe(true)
  })

  it("returns true with one valid discord channel", () => {
    const channels: Channel[] = [
      {
        id: 1,
        internalId: "dc-test",
        type: "discord",
        name: "Test",
        displayName: "DC: Test",
        credentials: {
          type: "discord",
          webhookUrl: "https://discord.com/api/webhooks/123/abc",
          threads: [],
        },
        order: 0,
      },
    ]
    expect(isAnyChannelConfigured(channels)).toBe(true)
  })

  it("returns false when all channels have invalid credentials", () => {
    const channels: Channel[] = [
      {
        id: 1,
        internalId: "tg-test",
        type: "telegram",
        name: "Test",
        displayName: "TG: Test",
        credentials: { type: "telegram", botToken: "", chatId: "" },
        order: 0,
      },
      {
        id: 2,
        internalId: "dc-test2",
        type: "discord",
        name: "Test2",
        displayName: "DC: Test2",
        credentials: { type: "discord", webhookUrl: "", threads: [] },
        order: 1,
      },
    ]
    expect(isAnyChannelConfigured(channels)).toBe(false)
  })

  it("returns true with mixed valid and invalid channels", () => {
    const channels: Channel[] = [
      {
        id: 1,
        internalId: "tg-invalid",
        type: "telegram",
        name: "Invalid",
        displayName: "TG: Invalid",
        credentials: { type: "telegram", botToken: "", chatId: "" },
        order: 0,
      },
      {
        id: 2,
        internalId: "dc-valid",
        type: "discord",
        name: "Valid",
        displayName: "DC: Valid",
        credentials: {
          type: "discord",
          webhookUrl: "https://discord.com/api/webhooks/123/abc",
          threads: [],
        },
        order: 1,
      },
    ]
    expect(isAnyChannelConfigured(channels)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// CRUD — createChannel
// ---------------------------------------------------------------------------

describe("createChannel", () => {
  it("creates a telegram channel with correct fields", async () => {
    const channel = await createChannel("My Group", "telegram", {
      type: "telegram",
      botToken: "abc123",
      chatId: "987654321",
    })

    expect(channel.id).toBe(1)
    expect(channel.type).toBe("telegram")
    expect(channel.name).toBe("My Group")
    expect(channel.displayName).toBe("TG: My Group")
    expect(channel.credentials).toEqual({
      type: "telegram",
      botToken: "abc123",
      chatId: "987654321",
    })
    expect(channel.order).toBe(0)
  })

  it("creates a discord channel with correct fields", async () => {
    const channel = await createChannel("Alerts", "discord", {
      type: "discord",
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      threads: [],
    })

    expect(channel.type).toBe("discord")
    expect(channel.credentials.type).toBe("discord")
    expect(channel.credentials.webhookUrl).toBe(
      "https://discord.com/api/webhooks/123/abc"
    )
    expect((channel.credentials as any).threads).toEqual([])
  })

  it("creates second channel with id=2 and order=1", async () => {
    await createChannel("First", "telegram", {
      type: "telegram",
      botToken: "a",
      chatId: "1",
    })

    const second = await createChannel("Second", "telegram", {
      type: "telegram",
      botToken: "b",
      chatId: "2",
    })

    expect(second.id).toBe(2)
    expect(second.order).toBe(1)
  })

  it("trims name on creation", async () => {
    const channel = await createChannel("  My Group  ", "telegram", {
      type: "telegram",
      botToken: "abc",
      chatId: "123",
    })

    expect(channel.name).toBe("My Group")
    expect(channel.displayName).toBe("TG: My Group")
  })

  it("handles colliding internalId by appending suffix", async () => {
    await createChannel("Trading", "telegram", {
      type: "telegram",
      botToken: "a",
      chatId: "1",
    })

    const second = await createChannel("Trading", "telegram", {
      type: "telegram",
      botToken: "b",
      chatId: "2",
    })

    expect(second.internalId).toBe("tg-trading-2")
  })

  it("does not collide across platforms with same name", async () => {
    const tg = await createChannel("Alerts", "telegram", {
      type: "telegram",
      botToken: "a",
      chatId: "1",
    })

    const dc = await createChannel("Alerts", "discord", {
      type: "discord",
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      threads: [],
    })

    expect(tg.internalId).toBe("tg-alerts")
    expect(dc.internalId).toBe("dc-alerts")
  })

  it("never decrements idCounter (delete then create)", async () => {
    await createChannel("A", "telegram", {
      type: "telegram",
      botToken: "a",
      chatId: "1",
    })
    await createChannel("B", "telegram", {
      type: "telegram",
      botToken: "b",
      chatId: "2",
    })
    await createChannel("C", "telegram", {
      type: "telegram",
      botToken: "c",
      chatId: "3",
    })

    await deleteChannel(2)

    const fourth = await createChannel("D", "telegram", {
      type: "telegram",
      botToken: "d",
      chatId: "4",
    })

    expect(fourth.id).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// CRUD — getChannels
// ---------------------------------------------------------------------------

describe("getChannels", () => {
  it("returns empty array when no channels exist", async () => {
    const channels = await getChannels()
    expect(channels).toEqual([])
  })

  it("returns channels sorted by order", async () => {
    // Create channels — they get order 0, 1, 2
    const ch1 = await createChannel("First", "telegram", {
      type: "telegram",
      botToken: "a",
      chatId: "1",
    })
    const ch2 = await createChannel("Second", "telegram", {
      type: "telegram",
      botToken: "b",
      chatId: "2",
    })
    const ch3 = await createChannel("Third", "telegram", {
      type: "telegram",
      botToken: "c",
      chatId: "3",
    })

    // Manually shuffle orders to test sort
    await updateChannelOrder([ch3.id, ch1.id, ch2.id])

    const sorted = await getChannels()
    expect(sorted[0].id).toBe(ch3.id)
    expect(sorted[1].id).toBe(ch1.id)
    expect(sorted[2].id).toBe(ch2.id)
  })
})

// ---------------------------------------------------------------------------
// CRUD — updateChannel
// ---------------------------------------------------------------------------

describe("updateChannel", () => {
  it("recomputes displayName and internalId on name change", async () => {
    const ch = await createChannel("Original", "telegram", {
      type: "telegram",
      botToken: "abc",
      chatId: "123",
    })

    await updateChannel(ch.id, { name: "Renamed" })

    const channels = await getChannels()
    expect(channels[0].name).toBe("Renamed")
    expect(channels[0].displayName).toBe("TG: Renamed")
    expect(channels[0].internalId).toBe("tg-renamed")
  })

  it("only updates credentials when credentials are provided", async () => {
    const ch = await createChannel("Test", "telegram", {
      type: "telegram",
      botToken: "old_token",
      chatId: "old_chat",
    })

    await updateChannel(ch.id, {
      credentials: { type: "telegram", botToken: "new_token", chatId: "new_chat" },
    })

    const channels = await getChannels()
    expect(channels[0].name).toBe("Test")
    expect(channels[0].displayName).toBe("TG: Test")
    expect(channels[0].internalId).toBe("tg-test")
    expect(channels[0].credentials).toEqual({
      type: "telegram",
      botToken: "new_token",
      chatId: "new_chat",
    })
  })

  it("handles internalId collision on rename", async () => {
    await createChannel("Alpha", "telegram", {
      type: "telegram",
      botToken: "a",
      chatId: "1",
    })
    const ch2 = await createChannel("Beta", "telegram", {
      type: "telegram",
      botToken: "b",
      chatId: "2",
    })

    await updateChannel(ch2.id, { name: "Alpha" })

    const channels = await getChannels()
    const updated = channels.find((c) => c.id === ch2.id)
    expect(updated?.internalId).toBe("tg-alpha-2")
  })

  it("throws on non-existent id", async () => {
    await expect(
      updateChannel(999, { name: "Ghost" })
    ).rejects.toThrow("Channel with id 999 not found")
  })

  it("throws when updating credentials with wrong type", async () => {
    const ch = await createChannel("Test", "telegram", {
      type: "telegram",
      botToken: "abc",
      chatId: "123",
    })

    await expect(
      updateChannel(ch.id, {
        credentials: {
          type: "discord",
          webhookUrl: "https://discord.com/api/webhooks/123/abc",
          threads: [],
        },
      })
    ).rejects.toThrow(
      'Cannot change channel type from "telegram" to "discord". Delete and recreate the channel instead.'
    )
  })
})

// ---------------------------------------------------------------------------
// CRUD — deleteChannel
// ---------------------------------------------------------------------------

describe("deleteChannel", () => {
  it("removes channel and re-orders remaining channels", async () => {
    await createChannel("A", "telegram", {
      type: "telegram",
      botToken: "a",
      chatId: "1",
    })
    await createChannel("B", "telegram", {
      type: "telegram",
      botToken: "b",
      chatId: "2",
    })
    await createChannel("C", "telegram", {
      type: "telegram",
      botToken: "c",
      chatId: "3",
    })

    await deleteChannel(2)

    const channels = await getChannels()
    expect(channels).toHaveLength(2)
    expect(channels.find((c) => c.id === 2)).toBeUndefined()
    // Remaining channels have consecutive order values
    expect(channels[0].order).toBe(0)
    expect(channels[1].order).toBe(1)
  })

  it("is a no-op for non-existent id", async () => {
    await createChannel("A", "telegram", {
      type: "telegram",
      botToken: "a",
      chatId: "1",
    })

    // Should not throw
    await deleteChannel(999)

    const channels = await getChannels()
    expect(channels).toHaveLength(1)
  })

  it("does not decrement idCounter after delete", async () => {
    await createChannel("A", "telegram", {
      type: "telegram",
      botToken: "a",
      chatId: "1",
    })
    await createChannel("B", "telegram", {
      type: "telegram",
      botToken: "b",
      chatId: "2",
    })
    await createChannel("C", "telegram", {
      type: "telegram",
      botToken: "c",
      chatId: "3",
    })

    await deleteChannel(2)

    const fourth = await createChannel("D", "telegram", {
      type: "telegram",
      botToken: "d",
      chatId: "4",
    })

    // idCounter was at 4 before delete, stays at 4
    expect(fourth.id).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// CRUD — updateChannelOrder
// ---------------------------------------------------------------------------

describe("updateChannelOrder", () => {
  it("reorders channels correctly", async () => {
    const ch1 = await createChannel("A", "telegram", {
      type: "telegram",
      botToken: "a",
      chatId: "1",
    })
    const ch2 = await createChannel("B", "telegram", {
      type: "telegram",
      botToken: "b",
      chatId: "2",
    })
    const ch3 = await createChannel("C", "telegram", {
      type: "telegram",
      botToken: "c",
      chatId: "3",
    })

    // Reverse order
    await updateChannelOrder([ch3.id, ch2.id, ch1.id])

    const channels = await getChannels()
    expect(channels[0].id).toBe(ch3.id)
    expect(channels[0].order).toBe(0)
    expect(channels[1].id).toBe(ch2.id)
    expect(channels[1].order).toBe(1)
    expect(channels[2].id).toBe(ch1.id)
    expect(channels[2].order).toBe(2)
  })

  it("ignores unknown ids in sortedIds", async () => {
    const ch1 = await createChannel("A", "telegram", {
      type: "telegram",
      botToken: "a",
      chatId: "1",
    })
    const ch2 = await createChannel("B", "telegram", {
      type: "telegram",
      botToken: "b",
      chatId: "2",
    })

    // sortedIds includes an unknown id 99 at index 0.
    // The known ids at indices 1 and 2 get those indices as order values.
    // Unknown ids are ignored but don't shift the indices of subsequent ids.
    await updateChannelOrder([99, ch1.id, ch2.id])

    const channels = await getChannels()
    // ch1.id was at index 1 in sortedIds → order=1
    expect(channels[0].id).toBe(ch1.id)
    expect(channels[0].order).toBe(1)
    // ch2.id was at index 2 in sortedIds → order=2
    expect(channels[1].id).toBe(ch2.id)
    expect(channels[1].order).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Thread CRUD
// ---------------------------------------------------------------------------

/**
 * Helper: create a Discord channel with default credentials.
 * Always includes threads: [] in credentials.
 */
async function createDiscordChannel(name: string): Promise<Channel> {
  return createChannel(name, "discord", {
    type: "discord",
    webhookUrl: "https://discord.com/api/webhooks/test-webhook",
    threads: [],
  })
}

describe("addThreadToChannel", () => {
  it("adds a thread to a Discord channel (T1)", async () => {
    const ch = await createDiscordChannel("Test Channel")

    const thread = await addThreadToChannel(ch.id, "AAPL Earnings", "1504005327639543898")

    expect(thread.id).toBe(1)
    expect(thread.threadId).toBe("1504005327639543898")
    expect(thread.name).toBe("AAPL Earnings")
    expect(thread.order).toBe(0)
  })

  it("auto-increments id and order for second thread (T2)", async () => {
    const ch = await createDiscordChannel("Test Channel")
    await addThreadToChannel(ch.id, "First", "100")
    const second = await addThreadToChannel(ch.id, "Second", "200")

    expect(second.id).toBe(2)
    expect(second.order).toBe(1)
  })

  it("auto-increments id and order for third thread (T3)", async () => {
    const ch = await createDiscordChannel("Test Channel")
    await addThreadToChannel(ch.id, "A", "100")
    await addThreadToChannel(ch.id, "B", "200")
    const third = await addThreadToChannel(ch.id, "C", "300")

    expect(third.id).toBe(3)
    expect(third.order).toBe(2)
  })

  it("threadIdCounter increments globally across channels (T4)", async () => {
    const chA = await createDiscordChannel("Channel A")
    const chB = await createDiscordChannel("Channel B")

    await addThreadToChannel(chA.id, "A1", "100")
    await addThreadToChannel(chA.id, "A2", "200")
    await addThreadToChannel(chA.id, "A3", "300")

    const bThread = await addThreadToChannel(chB.id, "B1", "400")

    expect(bThread.id).toBe(4) // global counter: 1,2,3 on chA → 4 on chB
    expect(bThread.order).toBe(0) // first thread on chB
  })

  it("trims whitespace from name and threadId (T5)", async () => {
    const ch = await createDiscordChannel("Test Channel")

    const thread = await addThreadToChannel(
      ch.id,
      "  AAPL Earnings  ",
      "  1504005327639543898  "
    )

    expect(thread.name).toBe("AAPL Earnings")
    expect(thread.threadId).toBe("1504005327639543898")
  })

  it("throws for non-existent channel (T6)", async () => {
    await expect(
      addThreadToChannel(999, "Test", "100")
    ).rejects.toThrow("Channel with id 999 not found")
  })

  it("throws for Telegram channel (T7)", async () => {
    const ch = await createChannel("TG Channel", "telegram", {
      type: "telegram",
      botToken: "abc",
      chatId: "123",
    })

    await expect(
      addThreadToChannel(ch.id, "Test", "100")
    ).rejects.toThrow("Cannot add threads to non-Discord channel (type: telegram)")
  })

  it("persists across load/save cycle (T8)", async () => {
    const ch = await createDiscordChannel("Test")
    await addThreadToChannel(ch.id, "Persistent", "100")

    // Reload storage (no clearChannels — data persists in mock)
    const storage = await loadChannelStorage()
    const reloadedChannel = storage.channels.find((c) => c.id === ch.id)!
    const creds = reloadedChannel.credentials as any
    expect(creds.threads).toHaveLength(1)
    expect(creds.threads[0].name).toBe("Persistent")
  })
})

describe("removeThreadFromChannel", () => {
  it("removes an existing thread and re-indexes order (T9)", async () => {
    const ch = await createDiscordChannel("Test")
    await addThreadToChannel(ch.id, "A", "100")
    await addThreadToChannel(ch.id, "B", "200")
    await addThreadToChannel(ch.id, "C", "300")

    await removeThreadFromChannel(ch.id, 2) // remove B

    const remaining = await getThreadsForChannel(ch.id)
    expect(remaining).toHaveLength(2)
    expect(remaining[0].id).toBe(1)
    expect(remaining[0].order).toBe(0)
    expect(remaining[1].id).toBe(3)
    expect(remaining[1].order).toBe(1)
  })

  it("removes middle thread correctly (T10)", async () => {
    const ch = await createDiscordChannel("Test")
    await addThreadToChannel(ch.id, "A", "100")
    await addThreadToChannel(ch.id, "B", "200")
    await addThreadToChannel(ch.id, "C", "300")

    await removeThreadFromChannel(ch.id, 2) // remove middle (B, id=2)

    const remaining = await getThreadsForChannel(ch.id)
    expect(remaining).toHaveLength(2)
    expect(remaining[0].id).toBe(1) // A
    expect(remaining[0].order).toBe(0)
    expect(remaining[1].id).toBe(3) // C
    expect(remaining[1].order).toBe(1)
  })

  it("removes only thread, channel has empty threads (T11)", async () => {
    const ch = await createDiscordChannel("Test")
    const thread = await addThreadToChannel(ch.id, "Only", "100")

    await removeThreadFromChannel(ch.id, thread.id)

    const threads = await getThreadsForChannel(ch.id)
    expect(threads).toEqual([])
  })

  it("is no-op for non-existent thread id (T12)", async () => {
    const ch = await createDiscordChannel("Test")
    await addThreadToChannel(ch.id, "A", "100")

    // Should not throw
    await removeThreadFromChannel(ch.id, 999)

    const threads = await getThreadsForChannel(ch.id)
    expect(threads).toHaveLength(1)
  })

  it("throws for non-existent channel (T13)", async () => {
    await expect(
      removeThreadFromChannel(999, 1)
    ).rejects.toThrow("Channel with id 999 not found")
  })

  it("throws for Telegram channel (T14)", async () => {
    const ch = await createChannel("TG", "telegram", {
      type: "telegram",
      botToken: "a",
      chatId: "1",
    })

    await expect(
      removeThreadFromChannel(ch.id, 1)
    ).rejects.toThrow("Cannot remove threads from non-Discord channel (type: telegram)")
  })

  it("does not decrement threadIdCounter after remove (T15)", async () => {
    const ch = await createDiscordChannel("Test")
    await addThreadToChannel(ch.id, "A", "100")
    await addThreadToChannel(ch.id, "B", "200")
    await addThreadToChannel(ch.id, "C", "300")

    await removeThreadFromChannel(ch.id, 2) // remove B (id=2)
    // threadIdCounter was at 4, should stay at 4

    const newThread = await addThreadToChannel(ch.id, "D", "400")
    expect(newThread.id).toBe(4) // not 2 (not reused)
  })

  it("persists across load/save cycle (T16)", async () => {
    const ch = await createDiscordChannel("Test")
    await addThreadToChannel(ch.id, "ToRemove", "100")
    await addThreadToChannel(ch.id, "Keep", "200")

    await removeThreadFromChannel(ch.id, 1)

    // Reload and verify
    const storage = await loadChannelStorage()
    const reloaded = storage.channels.find((c) => c.id === ch.id)!
    const creds = reloaded.credentials as any
    expect(creds.threads).toHaveLength(1)
    expect(creds.threads[0].name).toBe("Keep")
  })
})

describe("getThreadsForChannel", () => {
  it("returns threads sorted by order (T17)", async () => {
    const ch = await createDiscordChannel("Test")
    await addThreadToChannel(ch.id, "C", "300")
    await addThreadToChannel(ch.id, "A", "100")
    await addThreadToChannel(ch.id, "B", "200")

    const threads = await getThreadsForChannel(ch.id)
    expect(threads).toHaveLength(3)
    // Should be sorted by order: creation order = C(0), A(1), B(2)
    expect(threads[0].name).toBe("C")
    expect(threads[1].name).toBe("A")
    expect(threads[2].name).toBe("B")
  })

  it("returns empty array for channel with no threads (T18)", async () => {
    const ch = await createDiscordChannel("Test")
    const threads = await getThreadsForChannel(ch.id)
    expect(threads).toEqual([])
  })

  it("throws for non-existent channel (T19)", async () => {
    await expect(
      getThreadsForChannel(999)
    ).rejects.toThrow("Channel with id 999 not found")
  })

  it("throws for Telegram channel (T20)", async () => {
    const ch = await createChannel("TG", "telegram", {
      type: "telegram",
      botToken: "a",
      chatId: "1",
    })

    await expect(
      getThreadsForChannel(ch.id)
    ).rejects.toThrow("Cannot get threads from non-Discord channel (type: telegram)")
  })

  it("returns a copy, not a reference (T21)", async () => {
    const ch = await createDiscordChannel("Test")
    await addThreadToChannel(ch.id, "A", "100")

    const threads = await getThreadsForChannel(ch.id)
    threads.push({ id: 999, threadId: "hack", name: "Hack", order: 99 })

    // Reload and verify storage was not mutated
    const reloaded = await getThreadsForChannel(ch.id)
    expect(reloaded).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Migration — threadIdCounter / threads
// ---------------------------------------------------------------------------

describe("Migration — threadIdCounter / threads", () => {
  it("fresh storage has threadIdCounter: 1 and empty channels (T22)", async () => {
    const storage = await loadChannelStorage()
    expect(storage.idCounter).toBe(1)
    expect(storage.threadIdCounter).toBe(1)
    expect(storage.channels).toEqual([])
  })

  it("migrates storage without threadIdCounter (T23)", async () => {
    // Simulate old storage without threadIdCounter
    const oldStorage = { idCounter: 5, channels: [] }
    await saveChannelStorage(oldStorage as any)

    const storage = await loadChannelStorage()
    expect(storage.threadIdCounter).toBe(1)
    expect(storage.idCounter).toBe(5)
  })

  it("migrates Discord channel without threads field (T24)", async () => {
    // Create old-style Discord channel (no threads)
    const oldStorage = {
      idCounter: 2,
      threadIdCounter: 1,
      channels: [
        {
          id: 1,
          internalId: "dc-old",
          type: "discord" as const,
          name: "Old Channel",
          displayName: "DC: Old Channel",
          credentials: { type: "discord" as const, webhookUrl: "https://discord.com/api/webhooks/test" },
          order: 0,
        },
      ],
    }
    await saveChannelStorage(oldStorage as any)

    const storage = await loadChannelStorage()
    const discordCh = storage.channels.find((c) => c.id === 1)
    expect(discordCh).toBeDefined()
    const creds = discordCh!.credentials as any
    expect(creds.threads).toEqual([])
  })

  it("migrates Telegram-only storage (no Discord channels) (T25)", async () => {
    const oldStorage = {
      idCounter: 2,
      channels: [
        {
          id: 1,
          type: "telegram" as const,
          name: "TG Channel",
          internalId: "tg-channel",
          displayName: "TG: Channel",
          credentials: { type: "telegram" as const, botToken: "abc", chatId: "123" },
          order: 0,
        },
      ],
    }
    await saveChannelStorage(oldStorage as any)

    const storage = await loadChannelStorage()
    expect(storage.threadIdCounter).toBe(1)
    // Telegram channel should not have threads
    const tgCh = storage.channels[0]
    expect((tgCh.credentials as any).threads).toBeUndefined()
  })

  it("migrates mixed TG + DC storage (T26)", async () => {
    const oldStorage = {
      idCounter: 3,
      channels: [
        {
          id: 1,
          type: "telegram" as const,
          name: "TG",
          internalId: "tg-main",
          displayName: "TG: Main",
          credentials: { type: "telegram" as const, botToken: "a", chatId: "1" },
          order: 0,
        },
        {
          id: 2,
          type: "discord" as const,
          name: "DC",
          internalId: "dc-main",
          displayName: "DC: Main",
          credentials: { type: "discord" as const, webhookUrl: "https://discord.com/api/webhooks/test" },
          order: 1,
        },
      ],
    }
    await saveChannelStorage(oldStorage as any)

    const storage = await loadChannelStorage()
    expect(storage.threadIdCounter).toBe(1)

    const tgCh = storage.channels.find((c) => c.id === 1)!
    expect((tgCh.credentials as any).threads).toBeUndefined()

    const dcCh = storage.channels.find((c) => c.id === 2)!
    expect((dcCh.credentials as any).threads).toEqual([])
  })

  it("migration is idempotent (T27)", async () => {
    const oldStorage = {
      idCounter: 2,
      channels: [
        {
          id: 1,
          type: "discord" as const,
          name: "DC",
          internalId: "dc-main",
          displayName: "DC: Main",
          credentials: { type: "discord" as const, webhookUrl: "https://discord.com/api/webhooks/test" },
          order: 0,
        },
      ],
    }
    await saveChannelStorage(oldStorage as any)

    // First load — migration happens
    const first = await loadChannelStorage()
    expect(first.threadIdCounter).toBe(1)
    expect((first.channels[0].credentials as any).threads).toEqual([])

    // Second load — no migration, should be identical
    const second = await loadChannelStorage()
    expect(second.threadIdCounter).toBe(1)
    expect((second.channels[0].credentials as any).threads).toEqual([])
    expect(second.channels).toHaveLength(1)
  })

  it("already-migrated storage does not re-migrate (T28)", async () => {
    const migratedStorage = {
      idCounter: 3,
      threadIdCounter: 5,
      channels: [
        {
          id: 1,
          type: "discord" as const,
          name: "DC",
          internalId: "dc-main",
          displayName: "DC: Main",
          credentials: { type: "discord" as const, webhookUrl: "https://discord.com/api/webhooks/test", threads: [{ id: 1, threadId: "100", name: "Existing", order: 0 }] },
          order: 0,
        },
      ],
    }
    await saveChannelStorage(migratedStorage as any)

    const storage = await loadChannelStorage()
    // threadIdCounter should still be 5 (not reset to 1)
    expect(storage.threadIdCounter).toBe(5)
    // threads should still have 1 entry (not duplicated)
    const dcCh = storage.channels.find((c) => c.id === 1)!
    expect((dcCh.credentials as any).threads).toHaveLength(1)
    expect((dcCh.credentials as any).threads[0].name).toBe("Existing")
  })
})

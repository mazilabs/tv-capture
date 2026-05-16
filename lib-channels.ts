/**
 * TV Capture — Channel Storage Layer
 *
 * Manages output channels (Telegram, Discord, future platforms).
 * Channels are stored in chrome.storage.local under key "tv-capture-channels".
 * Pattern follows lib-templates.ts (idCounter + array + order).
 */

// ---------------------------------------------------------------------------
// Platform Types
// ---------------------------------------------------------------------------

/** Supported platform types. Extend this union to add new platforms. */
export type ChannelType = "telegram" | "discord"

/** Display prefix per platform type. */
export const CHANNEL_PREFIX: Record<ChannelType, string> = {
  telegram: "TG",
  discord: "DC",
}

/** Internal ID prefix per platform type. */
const INTERNAL_ID_PREFIX: Record<ChannelType, string> = {
  telegram: "tg",
  discord: "dc",
}

// ---------------------------------------------------------------------------
// Credential Types (Discriminated Union)
// ---------------------------------------------------------------------------

/**
 * Telegram credentials — Bot Token + Chat ID + Topic configurations.
 * Topics are always present (empty array if none configured).
 */
export type TelegramCredentials = {
  type: "telegram"
  botToken: string
  chatId: string
  /** Optional account name for grouping channels visually. */
  accountName?: string
  /** Topic configurations for this Telegram channel. Always present, default []. */
  topics: TopicConfig[]
}

/**
 * Discord credentials — Webhook URL + Thread configurations.
 * The webhook URL embeds channel ID and authentication token.
 * Threads are always present (empty array if none configured).
 */
export type DiscordCredentials = {
  type: "discord"
  webhookUrl: string
  /** Optional server name for grouping channels visually. */
  serverName?: string
  /** Thread configurations for this Discord channel. Always present, default []. */
  threads: ThreadConfig[]
}

/**
 * A single Discord thread configuration.
 * Threads are nested inside DiscordCredentials and belong to exactly one Discord channel.
 * Thread IDs are Discord Snowflakes obtained via Developer Mode.
 */
export type ThreadConfig = {
  /** Auto-incremented numeric ID. Never reused after removal. */
  id: number
  /** Discord Snowflake, e.g. "1504005327639543898". Obtained via Developer Mode. */
  threadId: string
  /** User-friendly display name, e.g. "AAPL Earnings". Set in Settings. */
  name: string
  /** Sort order within the channel. Follows creation order (no D&D for threads). */
  order: number
}

/**
 * A single Telegram topic configuration.
 * Topics are nested inside TelegramCredentials and belong to exactly one Telegram channel.
 * Topic IDs are opaque integers as strings, obtained from Share Links or Telegram.
 */
export type TopicConfig = {
  /** Auto-incremented numeric ID. Never reused after removal. */
  id: number
  /** Telegram topic ID as string, e.g. "17". Obtained from Share Link or manual entry. */
  topicId: string
  /** User-friendly display name, e.g. "Gold Analysis". Set in Settings. */
  name: string
  /** Sort order within the channel. 0-based. */
  order: number
}

/**
 * Discriminated union of platform-specific credentials.
 * Narrow with: if (credentials.type === "telegram") { ... }
 *
 * To add a new platform:
 * 1. Define a new credential type (e.g., SlackCredentials)
 * 2. Add it to this union
 * 3. Add the platform to ChannelType
 */
export type ChannelCredentials = TelegramCredentials | DiscordCredentials

// ---------------------------------------------------------------------------
// Channel Type
// ---------------------------------------------------------------------------

/**
 * A single output channel (Telegram group, Discord channel, etc.).
 */
export type Channel = {
  /** Auto-incremented numeric ID. Never reused after deletion. */
  id: number
  /** Machine-readable identifier, e.g., "tg-main-trading-group". */
  internalId: string
  /** Platform type — determines credential shape and send logic. */
  type: ChannelType
  /** User-defined name, e.g., "Main Trading Group". */
  name: string
  /** UI display name, e.g., "TG: Main Trading Group". Auto-computed. */
  displayName: string
  /** Platform-specific credentials (discriminated by type field). */
  credentials: ChannelCredentials
  /** Sort order in Settings (creation order). */
  order: number
  /** Sort order in Send UI. Default = order at creation. Updated by D&D in Send UI. */
  sendOrder: number
}

/**
 * Update payload for updateChannel().
 * Only name and credentials can change. Type is immutable.
 */
export type ChannelUpdate = {
  name?: string
  credentials?: ChannelCredentials
}

// ---------------------------------------------------------------------------
// Storage Type
// ---------------------------------------------------------------------------

/** Storage wrapper for channels (mirrors TemplateStorage pattern). */
export type ChannelStorage = {
  /** Next channel ID to assign. Incremented on create, never decremented. */
  idCounter: number
  /** Next thread ID to assign (global across all channels). Incremented on thread create, never decremented. */
  threadIdCounter: number
  /** Next topic ID to assign (global across all channels). Incremented on topic create, never decremented. */
  topicIdCounter: number
  /** All channels. */
  channels: Channel[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "tv-capture-channels"

/**
 * Creates a fresh copy of the default channel storage.
 * Must be called instead of spreading the const directly, because
 * `channels` is an array (reference type) — a shallow spread would
 * share the array reference and cause state bleeding across tests.
 */
function createDefaultChannelStorage(): ChannelStorage {
  return { idCounter: 1, threadIdCounter: 1, topicIdCounter: 1, channels: [] }
}

const DEFAULT_CHANNEL_STORAGE: ChannelStorage = {
  idCounter: 1,
  threadIdCounter: 1,
  topicIdCounter: 1,
  channels: [],
}

// ---------------------------------------------------------------------------
// Storage Helpers
// ---------------------------------------------------------------------------

/**
 * Load channel storage from chrome.storage.local.
 * Initializes with empty defaults on first call.
 * Auto-migrates: adds threadIdCounter and threads[] for existing Discord channels.
 */
export async function loadChannelStorage(): Promise<ChannelStorage> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  const raw = result[STORAGE_KEY]

  if (!raw) {
    // Always create a fresh storage object with a new channels array.
    // Using { ...DEFAULT_CHANNEL_STORAGE } would share the channels array
    // by reference (shallow spread), causing mutation to leak into the
    // module-level constant.
    const fresh = createDefaultChannelStorage()
    await chrome.storage.local.set({ [STORAGE_KEY]: fresh })
    return fresh
  }

  const storage = raw as ChannelStorage
  let needsSave = false

  // Phase 3 migration: add threadIdCounter if missing
  if (storage.threadIdCounter === undefined) {
    storage.threadIdCounter = 1
    needsSave = true
  }

  // Phase 3 migration: add threads: [] to Discord channels if missing
  for (const channel of storage.channels) {
    if (channel.type === "discord") {
      const creds = channel.credentials as DiscordCredentials
      if (!creds.threads) {
        creds.threads = []
        needsSave = true
      }
    }
  }

  // Phase 5 migration: add topicIdCounter if missing
  if (storage.topicIdCounter === undefined) {
    storage.topicIdCounter = 1
    needsSave = true
  }

  // Phase 5 migration: add topics: [] to Telegram channels if missing
  for (const channel of storage.channels) {
    if (channel.type === "telegram") {
      const creds = channel.credentials as TelegramCredentials
      if (!creds.topics) {
        creds.topics = []
        needsSave = true
      }
    }
  }

  // Phase 5 migration: add sendOrder to all channels if missing
  for (const channel of storage.channels) {
    if (channel.sendOrder === undefined) {
      channel.sendOrder = channel.order
      needsSave = true
    }
  }

  if (needsSave) {
    await chrome.storage.local.set({ [STORAGE_KEY]: storage })
  }

  return storage
}

/**
 * Save channel storage to chrome.storage.local.
 */
export async function saveChannelStorage(storage: ChannelStorage): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: storage })
}

/**
 * Remove all channels (for testing).
 */
export async function clearChannels(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY)
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/**
 * Sanitize a name into a URL-safe slug component.
 * Lowercase, replace non-alphanumeric with hyphens, collapse duplicates.
 */
function sanitizeForInternalId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Generate an internal ID from name and platform type.
 * Format: "{prefix}-{sanitized-name}"
 * Example: "tg-main-trading-group"
 */
export function generateInternalId(name: string, type: ChannelType): string {
  const slug = sanitizeForInternalId(name)
  const prefix = INTERNAL_ID_PREFIX[type]
  return slug ? `${prefix}-${slug}` : `${prefix}-channel`
}

/**
 * Generate a unique internal ID that doesn't collide with existing channels.
 * Appends -2, -3, etc. on collision.
 */
function generateUniqueInternalId(
  name: string,
  type: ChannelType,
  existingChannels: Channel[],
  excludeId?: number
): string {
  const baseId = generateInternalId(name, type)
  const others = existingChannels.filter((ch) => ch.id !== excludeId)
  const existingIds = new Set(others.map((ch) => ch.internalId))

  if (!existingIds.has(baseId)) return baseId

  let suffix = 2
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix++
  }
  return `${baseId}-${suffix}`
}

/**
 * Generate display name from name and platform type.
 * Format: "{PREFIX}: {name}"
 * Example: "TG: Main Trading Group"
 */
export function generateDisplayName(name: string, type: ChannelType): string {
  return `${CHANNEL_PREFIX[type]}: ${name.trim()}`
}

/**
 * Check if credentials are non-empty (basic validity).
 * Format validation (token format, URL format) is done in the UI layer.
 */
export function areCredentialsValid(credentials: ChannelCredentials): boolean {
  switch (credentials.type) {
    case "telegram":
      return (
        credentials.botToken.trim().length > 0 &&
        credentials.chatId.trim().length > 0
      )
    case "discord":
      return credentials.webhookUrl.trim().length > 0
  }
}

/**
 * Check if at least one channel has valid credentials.
 * Returns false for empty array.
 */
export function isAnyChannelConfigured(channels: Channel[]): boolean {
  return channels.some((ch) => areCredentialsValid(ch.credentials))
}

// ---------------------------------------------------------------------------
// CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Create a new channel.
 * Assigns next available ID, generates internalId and displayName.
 */
export async function createChannel(
  name: string,
  type: ChannelType,
  credentials: ChannelCredentials
): Promise<Channel> {
  const storage = await loadChannelStorage()
  const trimmedName = name.trim()

  const channel: Channel = {
    id: storage.idCounter,
    internalId: generateUniqueInternalId(trimmedName, type, storage.channels),
    type,
    name: trimmedName,
    displayName: generateDisplayName(trimmedName, type),
    credentials,
    order: storage.channels.length,
    sendOrder: storage.channels.length,
  }

  storage.channels.push(channel)
  storage.idCounter++

  await saveChannelStorage(storage)
  return channel
}

/**
 * Get all channels sorted by order field.
 */
export async function getChannels(): Promise<Channel[]> {
  const storage = await loadChannelStorage()
  return [...storage.channels].sort((a, b) => a.order - b.order)
}

/**
 * Update a channel's name and/or credentials.
 * Recomputes displayName and internalId if name changes.
 * Throws if channel not found.
 * Throws if credentials type doesn't match channel type.
 */
export async function updateChannel(
  id: number,
  updates: ChannelUpdate
): Promise<void> {
  const storage = await loadChannelStorage()
  const channel = storage.channels.find((ch) => ch.id === id)

  if (!channel) {
    throw new Error(`Channel with id ${id} not found`)
  }

  if (updates.name !== undefined) {
    const trimmedName = updates.name.trim()
    channel.name = trimmedName
    channel.displayName = generateDisplayName(trimmedName, channel.type)
    channel.internalId = generateUniqueInternalId(
      trimmedName,
      channel.type,
      storage.channels,
      id
    )
  }

  if (updates.credentials !== undefined) {
    if (updates.credentials.type !== channel.type) {
      throw new Error(
        `Cannot change channel type from "${channel.type}" to "${updates.credentials.type}". Delete and recreate the channel instead.`
      )
    }
    channel.credentials = updates.credentials
  }

  await saveChannelStorage(storage)
}

/**
 * Delete a channel by ID.
 * Re-calculates order for remaining channels.
 * ID counter is NOT decremented (IDs are never reused).
 * No-op if channel doesn't exist.
 */
export async function deleteChannel(id: number): Promise<void> {
  const storage = await loadChannelStorage()
  const index = storage.channels.findIndex((ch) => ch.id === id)

  if (index === -1) return

  storage.channels.splice(index, 1)

  // Re-calculate order
  storage.channels.sort((a, b) => a.order - b.order)
  storage.channels.forEach((ch, i) => {
    ch.order = i
  })

  await saveChannelStorage(storage)
}

/**
 * Update channel order after drag & drop.
 * sortedIds is an array of channel IDs in their new order.
 */
export async function updateChannelOrder(sortedIds: number[]): Promise<void> {
  const storage = await loadChannelStorage()

  sortedIds.forEach((id, index) => {
    const channel = storage.channels.find((ch) => ch.id === id)
    if (channel) {
      channel.order = index
    }
  })

  await saveChannelStorage(storage)
}

// ---------------------------------------------------------------------------
// Thread CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Add a thread to a Discord channel.
 * Auto-increments threadIdCounter and assigns order (append at end).
 * Throws if channel not found or channel is not Discord.
 *
 * @param channelId - The Channel.id to add the thread to
 * @param name - User-friendly thread name (trimmed)
 * @param threadId - Discord Snowflake (trimmed)
 * @returns The created ThreadConfig
 */
export async function addThreadToChannel(
  channelId: number,
  name: string,
  threadId: string
): Promise<ThreadConfig> {
  const storage = await loadChannelStorage()
  const channel = storage.channels.find((ch) => ch.id === channelId)

  if (!channel) {
    throw new Error(`Channel with id ${channelId} not found`)
  }

  if (channel.type !== "discord") {
    throw new Error(
      `Cannot add threads to non-Discord channel (type: ${channel.type})`
    )
  }

  const creds = channel.credentials as DiscordCredentials

  const threadConfig: ThreadConfig = {
    id: storage.threadIdCounter,
    threadId: threadId.trim(),
    name: name.trim(),
    order: creds.threads.length,
  }

  creds.threads.push(threadConfig)
  storage.threadIdCounter++

  await saveChannelStorage(storage)
  return threadConfig
}

/**
 * Remove a thread from a Discord channel.
 * Re-indexes order for remaining threads.
 * threadIdCounter is NOT decremented (IDs are never reused).
 * No-op if thread not found in the channel.
 * Throws if channel not found or channel is not Discord.
 *
 * @param channelId - The Channel.id that contains the thread
 * @param threadConfigId - The ThreadConfig.id to remove
 */
export async function removeThreadFromChannel(
  channelId: number,
  threadConfigId: number
): Promise<void> {
  const storage = await loadChannelStorage()
  const channel = storage.channels.find((ch) => ch.id === channelId)

  if (!channel) {
    throw new Error(`Channel with id ${channelId} not found`)
  }

  if (channel.type !== "discord") {
    throw new Error(
      `Cannot remove threads from non-Discord channel (type: ${channel.type})`
    )
  }

  const creds = channel.credentials as DiscordCredentials
  const index = creds.threads.findIndex((t) => t.id === threadConfigId)

  if (index === -1) return // no-op if not found

  creds.threads.splice(index, 1)

  // Re-index order (same pattern as deleteChannel)
  creds.threads.forEach((t, i) => {
    t.order = i
  })

  await saveChannelStorage(storage)
}

/**
 * Get all threads for a Discord channel, sorted by order.
 * Returns empty array if channel has no threads.
 * Throws if channel not found or channel is not Discord.
 *
 * @param channelId - The Channel.id to get threads for
 * @returns ThreadConfig[] sorted by order
 */
export async function getThreadsForChannel(
  channelId: number
): Promise<ThreadConfig[]> {
  const storage = await loadChannelStorage()
  const channel = storage.channels.find((ch) => ch.id === channelId)

  if (!channel) {
    throw new Error(`Channel with id ${channelId} not found`)
  }

  if (channel.type !== "discord") {
    throw new Error(
      `Cannot get threads from non-Discord channel (type: ${channel.type})`
    )
  }

  const creds = channel.credentials as DiscordCredentials
  return [...creds.threads].sort((a, b) => a.order - b.order)
}

// ---------------------------------------------------------------------------
// Topic CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Add a topic to a Telegram channel.
 * Auto-increments topicIdCounter and assigns order (append at end).
 * Blocks topic ID "1" (always resolves to General — sends to main channel).
 * Throws if channel not found or channel is not Telegram.
 */
export async function addTopicToChannel(
  channelId: number,
  name: string,
  topicId: string
): Promise<TopicConfig> {
  const trimmedTopicId = topicId.trim()

  // Block topic ID "1" — always resolves to General (D16)
  if (trimmedTopicId === "1") {
    throw new Error(
      `Cannot use topic ID "1" — it always resolves to the General topic. Use the main channel to send to General.`
    )
  }

  const storage = await loadChannelStorage()
  const channel = storage.channels.find((ch) => ch.id === channelId)

  if (!channel) {
    throw new Error(`Channel with id ${channelId} not found`)
  }

  if (channel.type !== "telegram") {
    throw new Error(
      `Cannot add topics to non-Telegram channel (type: ${channel.type})`
    )
  }

  const creds = channel.credentials as TelegramCredentials

  const topicConfig: TopicConfig = {
    id: storage.topicIdCounter,
    topicId: trimmedTopicId,
    name: name.trim(),
    order: creds.topics.length,
  }

  creds.topics.push(topicConfig)
  storage.topicIdCounter++

  await saveChannelStorage(storage)
  return topicConfig
}

/**
 * Remove a topic from a Telegram channel.
 * Re-indexes order for remaining topics.
 * topicIdCounter is NOT decremented (IDs are never reused).
 * No-op if topic not found in the channel.
 * Throws if channel not found or channel is not Telegram.
 */
export async function removeTopicFromChannel(
  channelId: number,
  topicConfigId: number
): Promise<void> {
  const storage = await loadChannelStorage()
  const channel = storage.channels.find((ch) => ch.id === channelId)

  if (!channel) {
    throw new Error(`Channel with id ${channelId} not found`)
  }

  if (channel.type !== "telegram") {
    throw new Error(
      `Cannot remove topics from non-Telegram channel (type: ${channel.type})`
    )
  }

  const creds = channel.credentials as TelegramCredentials
  const index = creds.topics.findIndex((t) => t.id === topicConfigId)

  if (index === -1) return

  creds.topics.splice(index, 1)

  // Re-index order
  creds.topics.forEach((t, i) => {
    t.order = i
  })

  await saveChannelStorage(storage)
}

/**
 * Get all topics for a Telegram channel, sorted by order.
 * Returns empty array if channel has no topics.
 * Throws if channel not found or channel is not Telegram.
 */
export async function getTopicsForChannel(
  channelId: number
): Promise<TopicConfig[]> {
  const storage = await loadChannelStorage()
  const channel = storage.channels.find((ch) => ch.id === channelId)

  if (!channel) {
    throw new Error(`Channel with id ${channelId} not found`)
  }

  if (channel.type !== "telegram") {
    throw new Error(
      `Cannot get topics from non-Telegram channel (type: ${channel.type})`
    )
  }

  const creds = channel.credentials as TelegramCredentials
  return [...creds.topics].sort((a, b) => a.order - b.order)
}

/**
 * Update a topic in a Telegram channel.
 * Only name and topicId can change. Internal id and order are preserved.
 * Blocks topic ID "1" (always resolves to General).
 * Throws if channel not found, channel is not Telegram, or topic not found.
 */
export async function updateTopicInChannel(
  channelId: number,
  topicConfigId: number,
  updates: { name?: string; topicId?: string }
): Promise<void> {
  const storage = await loadChannelStorage()
  const channel = storage.channels.find((ch) => ch.id === channelId)

  if (!channel) {
    throw new Error(`Channel with id ${channelId} not found`)
  }

  if (channel.type !== "telegram") {
    throw new Error(
      `Cannot update topics in non-Telegram channel (type: ${channel.type})`
    )
  }

  const creds = channel.credentials as TelegramCredentials
  const topic = creds.topics.find((t) => t.id === topicConfigId)

  if (!topic) {
    throw new Error(
      `Topic with config id ${topicConfigId} not found in channel ${channelId}`
    )
  }

  if (updates.name !== undefined) {
    topic.name = updates.name.trim()
  }

  if (updates.topicId !== undefined) {
    const trimmedTopicId = updates.topicId.trim()
    if (trimmedTopicId === "1") {
      throw new Error(
        `Cannot use topic ID "1" — it always resolves to the General topic. Use the main channel to send to General.`
      )
    }
    topic.topicId = trimmedTopicId
  }

  await saveChannelStorage(storage)
}

/**
 * Update a thread in a Discord channel.
 * Only name and threadId can change. Internal id and order are preserved.
 * Throws if channel not found, channel is not Discord, or thread not found.
 */
export async function updateThreadInChannel(
  channelId: number,
  threadConfigId: number,
  updates: { name?: string; threadId?: string }
): Promise<void> {
  const storage = await loadChannelStorage()
  const channel = storage.channels.find((ch) => ch.id === channelId)

  if (!channel) {
    throw new Error(`Channel with id ${channelId} not found`)
  }

  if (channel.type !== "discord") {
    throw new Error(
      `Cannot update threads in non-Discord channel (type: ${channel.type})`
    )
  }

  const creds = channel.credentials as DiscordCredentials
  const thread = creds.threads.find((t) => t.id === threadConfigId)

  if (!thread) {
    throw new Error(
      `Thread with config id ${threadConfigId} not found in channel ${channelId}`
    )
  }

  if (updates.name !== undefined) {
    thread.name = updates.name.trim()
  }

  if (updates.threadId !== undefined) {
    thread.threadId = updates.threadId.trim()
  }

  await saveChannelStorage(storage)
}

// ---------------------------------------------------------------------------
// Settings UI State
// ---------------------------------------------------------------------------

export type SettingsUIState = {
  collapsedCards: Record<string, boolean>
}

const SETTINGS_UI_KEY = "tv-capture-settings-ui"

function createDefaultSettingsUIState(): SettingsUIState {
  return { collapsedCards: {} }
}

export async function loadSettingsUIState(): Promise<SettingsUIState> {
  try {
    const result = await chrome.storage.local.get(SETTINGS_UI_KEY)
    const raw = result[SETTINGS_UI_KEY]
    if (!raw) {
      const fresh = createDefaultSettingsUIState()
      await chrome.storage.local.set({ [SETTINGS_UI_KEY]: fresh })
      return fresh
    }
    const state = raw as SettingsUIState
    if (!state.collapsedCards || typeof state.collapsedCards !== "object") {
      const fresh = createDefaultSettingsUIState()
      await chrome.storage.local.set({ [SETTINGS_UI_KEY]: fresh })
      return fresh
    }
    return state
  } catch {
    return createDefaultSettingsUIState()
  }
}

export async function saveSettingsUIState(state: SettingsUIState): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_UI_KEY]: state })
}

// ---------------------------------------------------------------------------
// Send UI Functions
// ---------------------------------------------------------------------------

/**
 * Update channel send order after drag & drop in Send UI.
 * sortedIds is an array of channel IDs in their new order.
 * Updates the sendOrder field (NOT the order field used by Settings).
 */
export async function updateChannelSendOrder(sortedIds: number[]): Promise<void> {
  const storage = await loadChannelStorage()

  sortedIds.forEach((id, index) => {
    const channel = storage.channels.find((ch) => ch.id === id)
    if (channel) {
      channel.sendOrder = index
    }
  })

  await saveChannelStorage(storage)
}

/**
 * Get all channels sorted by sendOrder field.
 * Used by Send UI for display order.
 */
export async function getChannelsSortedBySendOrder(): Promise<Channel[]> {
  const storage = await loadChannelStorage()
  return [...storage.channels].sort((a, b) => a.sendOrder - b.sendOrder)
}

/**
 * Update sub-entity order after drag & drop within a Send UI card.
 * sortedSubEntityIds is an array of TopicConfig.id or ThreadConfig.id in their new order.
 * type determines whether to update topics (Telegram) or threads (Discord).
 */
export async function updateSubEntityOrder(
  channelId: number,
  sortedSubEntityIds: number[],
  type: "topic" | "thread"
): Promise<void> {
  const storage = await loadChannelStorage()
  const channel = storage.channels.find((ch) => ch.id === channelId)

  if (!channel) {
    throw new Error(`Channel with id ${channelId} not found`)
  }

  if (type === "topic") {
    if (channel.type !== "telegram") {
      throw new Error(`Cannot update topic order for non-Telegram channel`)
    }
    const creds = channel.credentials as TelegramCredentials
    sortedSubEntityIds.forEach((subId, index) => {
      const topic = creds.topics.find((t) => t.id === subId)
      if (topic) {
        topic.order = index
      }
    })
  } else {
    if (channel.type !== "discord") {
      throw new Error(`Cannot update thread order for non-Discord channel`)
    }
    const creds = channel.credentials as DiscordCredentials
    sortedSubEntityIds.forEach((subId, index) => {
      const thread = creds.threads.find((t) => t.id === subId)
      if (thread) {
        thread.order = index
      }
    })
  }

  await saveChannelStorage(storage)
}

// ---------------------------------------------------------------------------
// Chat ID Auto-Correction
// ---------------------------------------------------------------------------

export type ChatIdCorrectionResult = {
  updated: boolean
  oldChatId: string
  newChatId: string
}

/**
 * Compare parsed Chat ID (from Share Link) with stored Chat ID.
 * If different, update the stored Chat ID (legacy group → supergroup migration).
 * Must be called BEFORE addTopicToChannel() so the correct chatId is used.
 *
 * @returns Correction result with updated flag and old/new values
 */
export async function resolveAndCorrectChatId(
  channelId: number,
  parsedChatId: string
): Promise<ChatIdCorrectionResult> {
  const storage = await loadChannelStorage()
  const channel = storage.channels.find((ch) => ch.id === channelId)

  if (!channel) {
    throw new Error(`Channel with id ${channelId} not found`)
  }

  if (channel.type !== "telegram") {
    throw new Error(
      `Cannot correct Chat ID for non-Telegram channel (type: ${channel.type})`
    )
  }

  const creds = channel.credentials as TelegramCredentials
  const oldChatId = creds.chatId
  const newChatId = parsedChatId.trim()

  if (oldChatId === newChatId) {
    return { updated: false, oldChatId, newChatId }
  }

  // Update stored Chat ID
  creds.chatId = newChatId
  await saveChannelStorage(storage)

  return { updated: true, oldChatId, newChatId }
}

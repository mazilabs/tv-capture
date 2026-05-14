/**
 * TV Capture — Telegram Share Link Parser
 *
 * Parses Telegram Share Links of the format:
 *   https://t.me/c/CHAT_ID/TOPIC_ID
 *
 * Where:
 *   - CHAT_ID is the numeric portion of the supergroup ID (without -100 prefix)
 *   - TOPIC_ID is the topic/message number
 *
 * The parser applies the -100 prefix to produce the full Chat ID
 * used by the Telegram Bot API.
 */

export type ParsedShareLink = {
  chatId: string       // Full Chat ID with -100 prefix, e.g. "-1003719682271"
  topicId: string      // Topic ID as string, e.g. "17"
}

/**
 * Parse a Telegram Share Link and extract Chat ID + Topic ID.
 * Returns null if the link cannot be parsed.
 *
 * Supported formats:
 *   - https://t.me/c/1234567890/17
 *   - https://t.me/c/1234567890/17?t=123 (with query params)
 *   - http://t.me/c/1234567890/17 (http also accepted)
 *
 * @param link - The share link string
 * @returns ParsedShareLink or null if invalid
 */
export function parseTelegramShareLink(link: string): ParsedShareLink | null {
  const trimmed = link.trim()

  // Match t.me/c/NUMBERS/NUMBERS pattern
  const match = trimmed.match(
    /^https?:\/\/t\.me\/c\/(\d+)\/(\d+)/i
  )

  if (!match) return null

  const rawChatId = match[1]
  const topicId = match[2]

  // Apply -100 prefix to get full supergroup Chat ID
  const chatId = `-100${rawChatId}`

  return { chatId, topicId }
}

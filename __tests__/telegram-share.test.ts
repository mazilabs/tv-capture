/**
 * Unit tests for lib-telegram-share.ts
 *
 * Tests the Telegram Share Link parser.
 */
import { describe, it, expect } from "vitest"
import { parseTelegramShareLink } from "../lib-telegram-share"

describe("parseTelegramShareLink", () => {
  it("parses valid https Share Link (S1)", () => {
    const result = parseTelegramShareLink("https://t.me/c/3719682271/17")
    expect(result).toEqual({
      chatId: "-1003719682271",
      topicId: "17",
    })
  })

  it("parses valid http Share Link (S2)", () => {
    const result = parseTelegramShareLink("http://t.me/c/3719682271/17")
    expect(result).toEqual({
      chatId: "-1003719682271",
      topicId: "17",
    })
  })

  it("parses valid Share Link with query params (S3)", () => {
    const result = parseTelegramShareLink("https://t.me/c/123/17?t=456")
    expect(result).toEqual({
      chatId: "-100123",
      topicId: "17",
    })
  })

  it("returns null for invalid URL (no t.me) (S4)", () => {
    expect(parseTelegramShareLink("https://example.com/c/123/17")).toBeNull()
  })

  it("returns null for non-numeric chat ID (S5)", () => {
    expect(parseTelegramShareLink("https://t.me/c/abc/17")).toBeNull()
  })

  it("returns null for non-numeric topic ID (S6)", () => {
    expect(parseTelegramShareLink("https://t.me/c/123/abc")).toBeNull()
  })

  it("returns null for missing topic ID (S7)", () => {
    expect(parseTelegramShareLink("https://t.me/c/123")).toBeNull()
  })

  it("returns null for empty string (S8)", () => {
    expect(parseTelegramShareLink("")).toBeNull()
  })

  it("returns null for completely wrong URL (S9)", () => {
    expect(parseTelegramShareLink("https://google.com")).toBeNull()
  })

  it("trims whitespace from input (S10)", () => {
    const result = parseTelegramShareLink("  https://t.me/c/123/17  ")
    expect(result).toEqual({
      chatId: "-100123",
      topicId: "17",
    })
  })
})

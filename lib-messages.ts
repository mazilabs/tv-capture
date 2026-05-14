/**
 * Message type constants for communication between
 * popup, side panels, content scripts, and background service worker.
 */

export const MESSAGE_TYPES = {
  // View navigation
  OPEN_SETTINGS: "open-settings",
  OPEN_CAPTURE: "open-capture",
  SETTINGS_UPDATED: "settings-updated",

  // Status
  GET_STATUS: "get-status",

  // Telegram
  SEND_TEST_MESSAGE: "send-test-message",

  // Screenshot (Phase 4 — manual capture from side panel)
  CAPTURE_SCREENSHOT: "capture-screenshot",
  SEND_SCREENSHOT: "send-screenshot",

  // Shortcut capture (Phase 5 — keyboard shortcut triggered)
  SHORTCUT_CAPTURE: "shortcut-capture",

  // Popup capture (Phase 5.1 — popup Capture button)
  POPUP_CAPTURE: "popup-capture",

  // Content script → background (chart bounds)
  GET_CHART_BOUNDS: "get-chart-bounds",

  // Send photo with optional caption (Phase 6)
  SEND_PHOTO_WITH_CAPTION: "send-photo-with-caption",

  // Multi-channel send (Phase 8 contract — handler in Phase 8)
  SEND_MULTI_CHANNEL: "send-multi-channel",
} as const

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES]

// ---------------------------------------------------------------------------
// Message shapes (sent TO background)
// ---------------------------------------------------------------------------

export type ExtensionMessage =
  | { type: typeof MESSAGE_TYPES.OPEN_SETTINGS; windowId: number }
  | { type: typeof MESSAGE_TYPES.OPEN_CAPTURE; windowId: number }
  | { type: typeof MESSAGE_TYPES.GET_STATUS }
  | { type: typeof MESSAGE_TYPES.SETTINGS_UPDATED; view?: string }
  | { type: typeof MESSAGE_TYPES.SEND_TEST_MESSAGE }
  | { type: typeof MESSAGE_TYPES.CAPTURE_SCREENSHOT }
  | { type: typeof MESSAGE_TYPES.SEND_SCREENSHOT; dataUrl: string }

// ---------------------------------------------------------------------------
// Response shapes (returned FROM background)
// ---------------------------------------------------------------------------

export type StatusResponse = {
  configured: boolean
}

export type TestMessageResponse = {
  success: boolean
  error?: string
}

export type SuccessResponse = {
  success: boolean
}

export type CaptureResponse =
  | { success: true; dataUrl: string }
  | { success: false; error: string }

export type SendScreenshotResponse =
  | { success: true }
  | { success: false; error: string }

// ---------------------------------------------------------------------------
// Content script types (chart bounds)
// ---------------------------------------------------------------------------

export type ChartBounds = {
  x: number
  y: number
  width: number
  height: number
  devicePixelRatio: number
  found: true
}

export type ChartBoundsNotFound = {
  found: false
}

export type ChartBoundsResponse = ChartBounds | ChartBoundsNotFound

// ---------------------------------------------------------------------------
// Shortcut capture message (background → side panel)
// ---------------------------------------------------------------------------

export type ShortcutCaptureMessage = {
  type: typeof MESSAGE_TYPES.SHORTCUT_CAPTURE
  dataUrl: string
  cropped: boolean
}

// ---------------------------------------------------------------------------
// Send photo with caption (Phase 6)
// ---------------------------------------------------------------------------

export type SendPhotoWithCaptionMessage = {
  type: typeof MESSAGE_TYPES.SEND_PHOTO_WITH_CAPTION
  dataUrl: string
  caption?: string
}

// ---------------------------------------------------------------------------
// Multi-channel send (Phase 7 contract definition — Phase 8 implements handler)
// ---------------------------------------------------------------------------

/** A single send target within a multi-channel send. */
export type SendTarget = {
  channelId: number
  subTargetType?: "topic" | "thread"   // undefined = main channel
  subTargetId?: string                  // topicId or threadId
}

/** Message sent to background for multi-channel send. */
export type SendMultiChannelMessage = {
  type: typeof MESSAGE_TYPES.SEND_MULTI_CHANNEL
  dataUrl: string
  caption?: string
  targets: SendTarget[]
}

/** Per-target result from multi-channel send. */
export type SendTargetResult = {
  target: SendTarget
  success: boolean
  error?: string
}

/** Response from multi-channel send. */
export type SendMultiChannelResponse = {
  results: SendTargetResult[]
}

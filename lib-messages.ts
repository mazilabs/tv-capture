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

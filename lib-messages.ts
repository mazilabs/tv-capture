/**
 * Message type constants for communication between
 * popup, side panels, and background service worker.
 */

export const MESSAGE_TYPES = {
  OPEN_SETTINGS: "open-settings",
  OPEN_CAPTURE: "open-capture",
  GET_STATUS: "get-status",
  SETTINGS_UPDATED: "settings-updated",
  SEND_TEST_MESSAGE: "send-test-message",
} as const

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES]

/**
 * Messages sent from popup / side panels to the background service worker.
 */
export type ExtensionMessage =
  | { type: typeof MESSAGE_TYPES.OPEN_SETTINGS; windowId: number }
  | { type: typeof MESSAGE_TYPES.OPEN_CAPTURE; windowId: number }
  | { type: typeof MESSAGE_TYPES.GET_STATUS }
  | { type: typeof MESSAGE_TYPES.SETTINGS_UPDATED }
  | { type: typeof MESSAGE_TYPES.SEND_TEST_MESSAGE }

/**
 * Response shape for GET_STATUS messages.
 */
export type StatusResponse = {
  configured: boolean
}

/**
 * Response shape for SEND_TEST_MESSAGE messages.
 */
export type TestMessageResponse = {
  success: boolean
  error?: string
}

/**
 * Generic success response.
 */
export type SuccessResponse = {
  success: boolean
}

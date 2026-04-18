/**
 * TV Capture — Background Service Worker
 *
 * Handles messages from popup, side panel, and keyboard shortcuts:
 *  - OPEN_SETTINGS / OPEN_CAPTURE → forward to side panel
 *  - GET_STATUS → return whether Telegram credentials are configured
 *  - CAPTURE_SCREENSHOT → manual capture from side panel
 *  - POPUP_CAPTURE → capture from popup button (opens panel + captures)
 *  - SEND_SCREENSHOT → send captured image to Telegram
 *  - Keyboard shortcut (Alt+S) → TradingView-aware capture + crop
 *
 * Gesture architecture (Phase 5.1):
 *  - Proactive windowId/tabId cache via tabs.onActivated/onUpdated
 *  - sidePanel.open() is called FIRST (synchronous, preserves gesture)
 *  - All async work (capture, crop, deliver) happens AFTER panel open
 */

import {
  MESSAGE_TYPES,
  type TestMessageResponse,
  type CaptureResponse,
  type SendScreenshotResponse,
  type ChartBoundsResponse,
} from "./lib-messages"
import { loadSettings, isConfigured } from "./lib-storage"
import { sendMessage, sendPhoto } from "./lib-telegram"
import { isTradingViewUrl } from "./lib-tradingview"
import { cropScreenshot } from "./lib-crop"
import { FLAGS } from "./lib-flags"

// ---------------------------------------------------------------------------
// Proactive window/tab cache (Phase 5.1)
// ---------------------------------------------------------------------------
// Always tracks the active tab/window. No gesture dependency.
// By the time a user triggers capture, the cache is always warm.

let cachedWindowId: number | undefined
let cachedTabId: number | undefined

chrome.tabs.onActivated.addListener((activeInfo) => {
  cachedWindowId = activeInfo.windowId
  cachedTabId = activeInfo.tabId
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && tab.windowId) {
    cachedWindowId = tab.windowId
    cachedTabId = tabId
  }
})

// ---------------------------------------------------------------------------
// Unified capture function (Phase 5.1)
// ---------------------------------------------------------------------------
// Single capture logic used by ALL three entry points.
// No side effects (no sidePanel.open inside) — caller controls panel opening.

async function performCapture(tab: chrome.tabs.Tab): Promise<{
  dataUrl: string
  cropped: boolean
}> {
  // Capture visible tab
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "jpeg",
    quality: 92,
  })

  if (!dataUrl) {
    throw new Error("Failed to capture screenshot")
  }

  let finalDataUrl = dataUrl
  let cropped = false

  const isTV = isTradingViewUrl(tab.url)

  // Crop if TradingView
  if (isTV && tab.id) {
    try {
      const bounds = (await chrome.tabs.sendMessage(tab.id, {
        type: MESSAGE_TYPES.GET_CHART_BOUNDS,
      })) as ChartBoundsResponse

      if (bounds.found) {
        // Extend crop area to viewport top (y=0) to include
        // the timeframe toolbar above the chart container.
        // Left, right, and bottom edges stay exactly as detected.
        const extendedBounds = {
          ...bounds,
          y: 0,
          height: bounds.y + bounds.height,
        }
        finalDataUrl = await cropScreenshot(dataUrl, extendedBounds)
        cropped = true
      }
    } catch {
      // Content script not injected or not responding — use full screenshot
      console.log("Chart bounds not available, using full screenshot")
    }
  }

  return { dataUrl: finalDataUrl, cropped }
}

// ---------------------------------------------------------------------------
// Deliver screenshot to side panel (shared helper)
// ---------------------------------------------------------------------------
// Waits for React to mount, then sends the screenshot data.

function deliverToPanel(dataUrl: string, cropped: boolean) {
  setTimeout(() => {
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SHORTCUT_CAPTURE,
      dataUrl,
      cropped,
    }).catch(() => {
      // Side panel may not have loaded yet
    })
  }, 400)
}

// ---------------------------------------------------------------------------
// Keyboard shortcut handler (Phase 5.1 — rewritten)
// ---------------------------------------------------------------------------
// sidePanel.open() is the FIRST synchronous call using cached windowId.
// This preserves the user gesture from the onCommand event.

chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-tradingview") {
    // sidePanel.open() FIRST — gesture is present here, use cached windowId
    if (cachedWindowId) {
      chrome.sidePanel.setOptions({ path: "sidepanel.html" })
      chrome.sidePanel.open({ windowId: cachedWindowId })
    }

    // Then do async capture (no gesture needed)
    handleShortcutCaptureAsync()
  }
})

async function handleShortcutCaptureAsync() {
  if (!cachedWindowId) return

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab) return

  const isTV = isTradingViewUrl(tab.url)
  if (FLAGS.TRADINGVIEW_ONLY && !isTV) return

  try {
    const result = await performCapture(tab)
    deliverToPanel(result.dataUrl, result.cropped)
  } catch {
    console.error("Shortcut capture failed")
  }
}

// ---------------------------------------------------------------------------
// Message handling (from popup / side panel)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const type = message?.type as string

  if (type === MESSAGE_TYPES.OPEN_SETTINGS) {
    openSidePanel(message.windowId, "settings")
    sendResponse({ success: true })
    return false
  }

  if (type === MESSAGE_TYPES.OPEN_CAPTURE) {
    openSidePanel(message.windowId, "capture")
    sendResponse({ success: true })
    return false
  }

  if (type === MESSAGE_TYPES.GET_STATUS) {
    loadSettings()
      .then((settings) => {
        sendResponse({ configured: isConfigured(settings) })
      })
      .catch(() => {
        sendResponse({ configured: false })
      })
    return true // async response
  }

  if (type === MESSAGE_TYPES.SEND_TEST_MESSAGE) {
    handleTestMessage()
      .then(sendResponse)
      .catch(() => {
        sendResponse({ success: false, error: "Unexpected error" })
      })
    return true // async response
  }

  if (type === MESSAGE_TYPES.CAPTURE_SCREENSHOT) {
    handleCapture()
      .then(sendResponse)
      .catch(() => {
        sendResponse({
          success: false,
          error: "Failed to capture screenshot",
        })
      })
    return true // async response
  }

  if (type === MESSAGE_TYPES.SEND_SCREENSHOT) {
    const messageWithDataUrl = message as {
      type: typeof MESSAGE_TYPES.SEND_SCREENSHOT
      dataUrl: string
    }
    handleSendScreenshot(messageWithDataUrl.dataUrl)
      .then(sendResponse)
      .catch(() => {
        sendResponse({
          success: false,
          error: "Failed to send screenshot",
        })
      })
    return true // async response
  }

  // Popup Capture (Phase 5.1)
  // sidePanel.open() is called SYNCHRONOUSLY in the message handler
  // to preserve the user gesture from the popup button click.
  if (type === MESSAGE_TYPES.POPUP_CAPTURE) {
    // Open side panel FIRST — synchronous, uses cached windowId, preserves gesture
    if (cachedWindowId) {
      chrome.sidePanel.setOptions({ path: "sidepanel.html" })
      chrome.sidePanel.open({ windowId: cachedWindowId })
    }

    // Then do async capture work (gesture no longer needed)
    handlePopupCaptureAsync()
      .then(sendResponse)
      .catch(() => {
        sendResponse({ success: false, error: "Capture failed" })
      })
    return true // async response
  }

  return false
})

// ---------------------------------------------------------------------------
// Popup capture handler (Phase 5.1)
// ---------------------------------------------------------------------------

async function handlePopupCaptureAsync(): Promise<{ success: boolean; error?: string }> {
  if (!cachedWindowId || !cachedTabId) {
    return { success: false, error: "No active tab" }
  }

  // Get fresh tab info (URL may have changed)
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab) {
    return { success: false, error: "No active tab" }
  }

  const isTV = isTradingViewUrl(tab.url)

  // If TRADINGVIEW_ONLY and not on TradingView, reject
  if (FLAGS.TRADINGVIEW_ONLY && !isTV) {
    return { success: false, error: "Not a TradingView page" }
  }

  // Perform the capture (panel is already opening)
  try {
    const result = await performCapture(tab)
    deliverToPanel(result.dataUrl, result.cropped)
    return { success: true }
  } catch {
    return { success: false, error: "Capture failed" }
  }
}

// ---------------------------------------------------------------------------
// Side panel helpers
// ---------------------------------------------------------------------------

async function openSidePanel(windowId: number, view: string) {
  if (!windowId) return
  chrome.sidePanel.setOptions({ path: "sidepanel.html" }).catch(() => {})
  await chrome.sidePanel.open({ windowId })
  setTimeout(() => {
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SETTINGS_UPDATED,
      view,
    }).catch(() => {})
  }, 200)
}

// ---------------------------------------------------------------------------
// Test message handler
// ---------------------------------------------------------------------------

async function handleTestMessage(): Promise<TestMessageResponse> {
  const settings = await loadSettings()

  if (!isConfigured(settings)) {
    return {
      success: false,
      error: "Please enter both Bot Token and Chat ID.",
    }
  }

  const result = await sendMessage(
    settings.telegram.botToken.trim(),
    settings.telegram.chatId.trim(),
    "✅ TV Capture test message successful!"
  )

  return result
}

// ---------------------------------------------------------------------------
// Screenshot handler — manual capture from side panel (Phase 5.1)
// ---------------------------------------------------------------------------
// Now uses performCapture() for TradingView cropping support.

async function handleCapture(): Promise<CaptureResponse> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })

    if (!tab?.id) {
      return {
        success: false,
        error: "No active tab found.",
      }
    }

    const isTV = isTradingViewUrl(tab.url)
    if (FLAGS.TRADINGVIEW_ONLY && !isTV) {
      return {
        success: false,
        error: "Not a TradingView page.",
      }
    }

    const result = await performCapture(tab)

    return { success: true, dataUrl: result.dataUrl }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("permission")) {
        return {
          success: false,
          error: "Permission denied. Please reload the extension.",
        }
      }
    }
    return {
      success: false,
      error: "Failed to capture screenshot.",
    }
  }
}

async function handleSendScreenshot(
  dataUrl: string
): Promise<SendScreenshotResponse> {
  const settings = await loadSettings()

  if (!isConfigured(settings)) {
    return {
      success: false,
      error: "Please configure Telegram settings first.",
    }
  }

  const result = await sendPhoto(
    settings.telegram.botToken.trim(),
    settings.telegram.chatId.trim(),
    dataUrl,
    "📸 Screenshot from TV Capture"
  )

  return result
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  console.log("TV Capture extension installed")
})

chrome.runtime.onStartup.addListener(() => {
  console.log("TV Capture extension started")
})

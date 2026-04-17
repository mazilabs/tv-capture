/**
 * TV Capture — Background Service Worker
 *
 * Handles messages from popup and side panel:
 *  - OPEN_SETTINGS → forward to side panel (switch to settings view)
 *  - OPEN_CAPTURE → forward to side panel (switch to capture view)
 *  - GET_STATUS → return whether Telegram credentials are configured
 *
 * Also handles:
 *  - Periodic update checks via GitHub API
 *  - Notification of available updates to UI
 *
 * Note: The side panel is a single HTML page with internal view switching.
 * When the popup sends OPEN_SETTINGS or OPEN_CAPTURE, the background
 * opens the side panel and sends a follow-up message to set the active view.
 */

import { MESSAGE_TYPES } from "./lib-messages"
import { loadSettings, isConfigured } from "./lib-storage"
import {
  scheduleUpdateChecks,
  handleUpdateAlarm,
  runBackgroundUpdateCheck,
} from "./lib-update"

// ---------------------------------------------------------------------------
// Message handling
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

  return false
})

// ---------------------------------------------------------------------------
// Side panel helpers
// ---------------------------------------------------------------------------

async function openSidePanel(windowId: number, view: string) {
  if (!windowId) return
  // Call setOptions synchronously (no await) to preserve user gesture context
  // If we await here, Chrome loses the "user gesture" before sidePanel.open()
  chrome.sidePanel.setOptions({ path: "sidepanel.html" }).catch(() => {})
  await chrome.sidePanel.open({ windowId })
  // Small delay to let the side panel load, then send the view instruction
  setTimeout(() => {
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SETTINGS_UPDATED,
      view,
    }).catch(() => {
      // Side panel may not have loaded yet, that's ok
    })
  }, 200)
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  console.log("TV Capture extension installed")
  runBackgroundUpdateCheck()
})

// Also check on browser startup
chrome.runtime.onStartup.addListener(() => {
  runBackgroundUpdateCheck()
})

// ---------------------------------------------------------------------------
// Update checking
// ---------------------------------------------------------------------------

// Schedule periodic update checks
scheduleUpdateChecks()

// Handle alarm for update checks
chrome.alarms.onAlarm.addListener((alarm) => {
  handleUpdateAlarm(alarm)
})

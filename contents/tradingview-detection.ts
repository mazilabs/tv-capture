/**
 * TV Capture — TradingView Chart Detection Content Script
 *
 * Injected ONLY into TradingView pages (see matches export below).
 * Listens for GET_CHART_BOUNDS messages from the background service worker
 * and returns the bounding box of the chart container element.
 *
 * Selector: div[data-qa-id="chart-container"]
 * Validated: 2026-04-18 across 5 scenarios (see docs/dom-snapshots/)
 *
 * This container includes: chart canvas + price axis + time axis + corner.
 * No fallbacks. If this selector breaks, fix the selector.
 */

import { MESSAGE_TYPES, type ChartBoundsResponse } from "../lib-messages"

// Plasmo: Only inject this content script on TradingView pages
export const config = {
  matches: ["*://*.tradingview.com/*"],
}

/**
 * The deterministic selector for TradingView's chart container.
 * This is a QA test attribute that TradingView's own tests depend on.
 */
const CHART_CONTAINER_SELECTOR = 'div[data-qa-id="chart-container"]'

/**
 * Detect the chart container bounds.
 *
 * Returns CSS-pixel coordinates relative to the viewport,
 * plus devicePixelRatio for correct cropping on high-DPI displays.
 */
function detectChartBounds(): ChartBoundsResponse {
  const element = document.querySelector(CHART_CONTAINER_SELECTOR)

  if (!element) {
    return { found: false }
  }

  const rect = element.getBoundingClientRect()

  // Sanity check: element must be visible and have reasonable size
  if (rect.width < 100 || rect.height < 100) {
    return { found: false }
  }

  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    devicePixelRatio: window.devicePixelRatio,
    found: true,
  }
}

// Listen for messages from the background service worker
chrome.runtime.onMessage.addListener(
  (message, _sender, sendResponse) => {
    if (message.type === MESSAGE_TYPES.GET_CHART_BOUNDS) {
      const bounds = detectChartBounds()
      sendResponse(bounds)
      return true
    }
    return false
  }
)

export {}

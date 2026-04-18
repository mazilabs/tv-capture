/**
 * TV Capture — TradingView Detection
 *
 * URL-based detection for TradingView pages.
 * Used by the background service worker to decide whether to
 * activate chart detection and cropping.
 */

/**
 * Check if a URL belongs to TradingView.
 *
 * Matches any hostname ending in "tradingview.com",
 * including subdomains like "www.tradingview.com".
 */
export function isTradingViewUrl(url: string | undefined): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.hostname.endsWith("tradingview.com")
  } catch {
    return false
  }
}

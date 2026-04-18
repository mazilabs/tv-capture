/**
 * TV Capture — Feature Flags
 *
 * Developer-level toggles that control extension behavior.
 * These are NOT user-facing settings. Flip them in code, rebuild.
 */

export const FLAGS = {
  /**
   * When true, the keyboard shortcut only captures on TradingView tabs.
   * Non-TradingView tabs are silently ignored.
   *
   * Flip to false to enable full-tab screenshots on any website.
   */
  TRADINGVIEW_ONLY: true,
} as const

/**
 * TV Capture — Popup
 *
 * Shows extension name, version, configuration status,
 * and two buttons: Settings and Capture.
 * 
 * Updated: Dark Glassmorphism theme (2026-04-20)
 */

import { useEffect, useState } from "react"
import { MESSAGE_TYPES } from "./lib-messages"

function Popup() {
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)

  // Check configuration status
  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: MESSAGE_TYPES.GET_STATUS },
      (response) => {
        if (response) {
          setConfigured(response.configured)
        }
        setLoading(false)
      },
    )
  }, [])

  const handleOpenSettings = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })
    if (!tab?.windowId) return
    // Wait for response before closing popup (preserves user gesture)
    chrome.runtime.sendMessage(
      {
        type: MESSAGE_TYPES.OPEN_SETTINGS,
        windowId: tab.windowId,
      },
      () => {
        window.close()
      },
    )
  }

  const handleCapture = () => {
    // Send POPUP_CAPTURE to background — triggers full capture flow:
    // side panel opens → screenshot captured → cropped (if TradingView) → preview shown
    chrome.runtime.sendMessage(
      { type: MESSAGE_TYPES.POPUP_CAPTURE },
      () => {
        window.close() // Close popup after triggering
      },
    )
  }

  const statusLabel = loading
    ? "Checking..."
    : configured
      ? "Configured"
      : "Not Configured"

  // Get current version from manifest
  const currentVersion = chrome.runtime.getManifest().version

  return (
    <main style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>TV Capture</h1>
        <span style={styles.version}>v{currentVersion}</span>
      </div>

      <div style={styles.statusRow}>
        <div
          style={{
            ...styles.dot,
            backgroundColor: configured ? "#10b981" : "#ef4444",
            boxShadow: configured 
              ? "0 0 8px rgba(16, 185, 129, 0.5)" 
              : "0 0 8px rgba(239, 68, 68, 0.5)",
          }}
        />
        <span style={styles.statusText}>{statusLabel}</span>
      </div>

      <div style={styles.buttonRow}>
        <button 
          style={styles.buttonSettings} 
          onClick={handleOpenSettings}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = "#2c3038"
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = "#252830"
          }}
        >
          Settings
        </button>
        <button 
          style={styles.buttonCapture} 
          onClick={handleCapture}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = "#14b8a6"
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = "#0d9488"
          }}
        >
          Capture
        </button>
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 20,
    minWidth: 280,
    minHeight: 140,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    color: "#e5e7eb",
    backgroundColor: "#1e2028",
    // No border-radius - fill entire Chrome popup frame
    margin: 0,
    boxSizing: "border-box" as const,
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
    color: "#e5e7eb",
  },
  version: {
    fontSize: 12,
    color: "#6b7280",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    padding: "10px 14px",
    borderRadius: 8,
    backgroundColor: "rgba(40, 48, 56, 0.7)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid #3a3f4a",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  statusText: {
    fontSize: 13,
    color: "#9ca3af",
  },
  buttonRow: {
    display: "flex",
    gap: 10,
  },
  buttonSettings: {
    flex: 1,
    padding: "12px 16px",
    border: "1px solid #3a3f4a",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: "#252830",
    color: "#e5e7eb",
    transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
  },
  buttonCapture: {
    flex: 1,
    padding: "12px 16px",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: "#0d9488",
    color: "#fff",
    transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
  },
}

export default Popup

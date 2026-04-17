/**
 * TV Capture — Popup
 *
 * Shows extension name, version, configuration status,
 * and two buttons: Settings and Capture.
 */

import { useEffect, useState } from "react"
import { MESSAGE_TYPES } from "./lib-messages"

function Popup() {
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)

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

  const handleOpenCapture = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })
    if (!tab?.windowId) return
    // Wait for response before closing popup (preserves user gesture)
    chrome.runtime.sendMessage(
      {
        type: MESSAGE_TYPES.OPEN_CAPTURE,
        windowId: tab.windowId,
      },
      () => {
        window.close()
      },
    )
  }

  const statusLabel = loading
    ? "Checking..."
    : configured
      ? "Configured"
      : "Not Configured"

  return (
    <main style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>TV Capture</h1>
        <span style={styles.version}>v0.1.0</span>
      </div>

      <div style={styles.statusRow}>
        <div
          style={{
            ...styles.dot,
            backgroundColor: configured ? "#22c55e" : "#ef4444",
          }}
        />
        <span style={styles.statusText}>{statusLabel}</span>
      </div>

      <div style={styles.buttonRow}>
        <button style={{ ...styles.button, ...styles.buttonSettings }} onClick={handleOpenSettings}>
          ⚙ Settings
        </button>
        <button style={{ ...styles.button, ...styles.buttonCapture }} onClick={handleOpenCapture}>
          📸 Capture
        </button>
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 16,
    minWidth: 280,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    color: "#1a1a1a",
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
  },
  version: {
    fontSize: 12,
    color: "#888",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    padding: "8px 12px",
    borderRadius: 6,
    backgroundColor: "#f5f5f5",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  statusText: {
    fontSize: 13,
  },
  buttonRow: {
    display: "flex",
    gap: 8,
  },
  button: {
    flex: 1,
    padding: "10px 16px",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.15s",
  },
  buttonSettings: {
    backgroundColor: "#f0f0f0",
    color: "#333",
  },
  buttonCapture: {
    backgroundColor: "#2563eb",
    color: "#fff",
  },
}

export default Popup

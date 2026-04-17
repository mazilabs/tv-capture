/**
 * TV Capture — Popup
 *
 * Shows extension name, version, configuration status,
 * and two buttons: Settings and Capture.
 *
 * Also displays update banner when new version is available.
 */

import { useEffect, useState } from "react"
import { MESSAGE_TYPES } from "./lib-messages"
import type { PendingUpdate } from "./lib-update"

function Popup() {
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null)

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

  // Check for pending updates
  useEffect(() => {
    chrome.storage.local.get("tv-capture-pending-update", (result) => {
      if (result["tv-capture-pending-update"]) {
        setPendingUpdate(result["tv-capture-pending-update"])
      }
    })
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

  const handleUpdate = () => {
    if (pendingUpdate?.releaseUrl) {
      chrome.tabs.create({ url: pendingUpdate.releaseUrl })
    }
  }

  const handleDismissUpdate = async () => {
    await chrome.storage.local.remove("tv-capture-pending-update")
    setPendingUpdate(null)
  }

  // Get current version from manifest
  const currentVersion = chrome.runtime.getManifest().version

  return (
    <main style={styles.container}>
      {/* Update Banner - show at top if update available */}
      {pendingUpdate && (
        <div style={styles.updateBanner}>
          <div style={styles.updateBannerContent}>
            <span style={styles.updateIcon}>⬆️</span>
            <div>
              <div style={styles.updateTitle}>Update Available</div>
              <div style={styles.updateVersion}>v{pendingUpdate.version}</div>
            </div>
          </div>
          <div style={styles.updateActions}>
            <button style={styles.updateButton} onClick={handleUpdate}>
              Update Now
            </button>
            <button style={styles.dismissButton} onClick={handleDismissUpdate}>
              ✕
            </button>
          </div>
        </div>
      )}

      <div style={styles.header}>
        <h1 style={styles.title}>TV Capture</h1>
        <span style={styles.version}>v{currentVersion}</span>
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
  // Update banner styles
  updateBanner: {
    marginBottom: 12,
    padding: "10px 12px",
    backgroundColor: "#fef3c7",
    border: "1px solid #f59e0b",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  updateBannerContent: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  updateIcon: {
    fontSize: 16,
  },
  updateTitle: {
    fontWeight: 600,
    fontSize: 13,
    color: "#92400e",
  },
  updateVersion: {
    fontSize: 12,
    color: "#b45309",
  },
  updateActions: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  updateButton: {
    padding: "4px 8px",
    backgroundColor: "#f59e0b",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  dismissButton: {
    padding: "4px 6px",
    backgroundColor: "transparent",
    color: "#92400e",
    border: "none",
    fontSize: 14,
    cursor: "pointer",
  },
}

export default Popup

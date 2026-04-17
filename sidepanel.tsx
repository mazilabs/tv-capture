/**
 * TV Capture — Side Panel
 *
 * Single side panel with two internal views:
 *  - "capture": screenshot preview + compose placeholder (Phase 4)
 *  - "settings": Telegram, Capture delay, AI placeholder settings
 *
 * View switching is triggered by messages from the background service worker
 * (which receives OPEN_SETTINGS / OPEN_CAPTURE from the popup).
 *
 * Also displays update banner when new version is available.
 */

import { useEffect, useState, useCallback } from "react"
import { MESSAGE_TYPES, type TestMessageResponse } from "./lib-messages"
import {
  loadSettings,
  saveSettings,
  validateSettings,
  type Settings,
  type ValidationError,
} from "./lib-storage"
import type { PendingUpdate } from "./lib-update"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type View = "capture" | "settings"

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SidePanel() {
  const [view, setView] = useState<View>("capture")
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null)

  // Listen for view-switch messages from background
  useEffect(() => {
    const listener = (message: { type: string; view?: string }) => {
      if (message.type === MESSAGE_TYPES.SETTINGS_UPDATED && message.view) {
        setView(message.view as View)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  // Check for pending updates
  useEffect(() => {
    chrome.storage.local.get("tv-capture-pending-update", (result) => {
      if (result["tv-capture-pending-update"]) {
        setPendingUpdate(result["tv-capture-pending-update"])
      }
    })
  }, [])

  const handleUpdate = () => {
    if (pendingUpdate?.releaseUrl) {
      chrome.tabs.create({ url: pendingUpdate.releaseUrl })
    }
  }

  const handleDismissUpdate = async () => {
    await chrome.storage.local.remove("tv-capture-pending-update")
    setPendingUpdate(null)
  }

  // Update banner component (shared between views)
  const updateBanner = pendingUpdate && (
    <div style={s.updateBanner}>
      <div style={s.updateBannerContent}>
        <span style={s.updateIcon}>⬆️</span>
        <div>
          <span style={s.updateTitle}>Update Available: </span>
          <span style={s.updateVersion}>v{pendingUpdate.version}</span>
        </div>
      </div>
      <div style={s.updateActions}>
        <button style={s.updateButton} onClick={handleUpdate}>
          Update Now
        </button>
        <button style={s.dismissButton} onClick={handleDismissUpdate}>
          ✕
        </button>
      </div>
    </div>
  )

  return view === "settings" ? (
    <SettingsView onBack={() => setView("capture")} updateBanner={updateBanner} />
  ) : (
    <CaptureView onSettings={() => setView("settings")} updateBanner={updateBanner} />
  )
}

// ---------------------------------------------------------------------------
// Capture View (placeholder)
// ---------------------------------------------------------------------------

function CaptureView({
  onSettings,
  updateBanner,
}: {
  onSettings: () => void
  updateBanner: React.ReactNode
}) {
  return (
    <main style={s.container}>
      {updateBanner}

      <div style={s.header}>
        <h1 style={s.title}>📸 TV Capture</h1>
        <button style={s.navButton} onClick={onSettings}>
          ⚙
        </button>
      </div>

      <div style={s.placeholderBox}>
        <p style={s.placeholderTitle}>Screenshot Preview</p>
        <p style={s.placeholderSub}>Captured screenshots will appear here</p>
      </div>

      <div style={s.placeholderBox}>
        <p style={s.placeholderTitle}>Message Compose</p>
        <p style={s.placeholderSub}>Edit and review your trade message here</p>
      </div>

      <div style={s.buttonRow}>
        <button style={{ ...s.button, ...s.buttonDisabled }} disabled>
          Send
        </button>
        <button style={{ ...s.button, ...s.buttonDisabled }} disabled>
          Cancel
        </button>
      </div>

      <p style={s.comingSoon}>
        Capture &amp; Send will be available in a future update.
      </p>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Settings View
// ---------------------------------------------------------------------------

function SettingsView({
  onBack,
  updateBanner,
}: {
  onBack: () => void
  updateBanner: React.ReactNode
}) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [feedback, setFeedback] = useState<"success" | null>(null)
  const [saving, setSaving] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  useEffect(() => {
    loadSettings().then(setSettings)
  }, [])

  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 2000)
    return () => clearTimeout(timer)
  }, [feedback])

  useEffect(() => {
    if (!testResult) return
    const timer = setTimeout(() => setTestResult(null), 5000)
    return () => clearTimeout(timer)
  }, [testResult])

  const updateField = useCallback(
    (path: string, value: string | number) => {
      if (!settings) return
      const [group, field] = path.split(".")
      setSettings({
        ...settings,
        [group]: { ...settings[group as keyof Settings], [field]: value },
      })
      setErrors((prev) => prev.filter((e) => e.field !== path))
      setFeedback(null)
    },
    [settings],
  )

  const handleSave = useCallback(async () => {
    if (!settings) return
    const validationErrors = validateSettings(settings)
    setErrors(validationErrors)
    if (validationErrors.length > 0) return

    setSaving(true)
    try {
      await saveSettings(settings)
      setFeedback("success")
    } catch {
      setErrors([
        {
          field: "_general",
          message: "Failed to save settings. Please try again.",
        },
      ])
    } finally {
      setSaving(false)
    }
  }, [settings])

  const handleTestMessage = useCallback(async () => {
    if (!settings) return

    setTestLoading(true)
    setTestResult(null)

    try {
      const response = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SEND_TEST_MESSAGE,
      })) as TestMessageResponse

      setTestResult(response)
    } catch {
      setTestResult({ success: false, error: "Failed to send test message" })
    } finally {
      setTestLoading(false)
    }
  }, [settings])

  if (!settings) {
    return (
      <main style={s.container}>
        <p>Loading settings...</p>
      </main>
    )
  }

  const fieldError = (field: string) => errors.find((e) => e.field === field)

  return (
    <main style={s.container}>
      {updateBanner}

      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>⚙ Settings</h1>
        <button style={s.navButton} onClick={onBack}>
          ← Back
        </button>
      </div>

      {/* Telegram */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Telegram</div>

        <div style={s.field}>
          <label style={s.label}>Bot Token</label>
          <input
            type="password"
            style={fieldError("telegram.botToken") ? s.inputError : s.input}
            placeholder="e.g. 123456:ABC-DEF..."
            value={settings.telegram.botToken}
            onChange={(e) => updateField("telegram.botToken", e.target.value)}
          />
          {fieldError("telegram.botToken") && (
            <p style={s.errorText}>{fieldError("telegram.botToken").message}</p>
          )}
        </div>

        <div style={s.field}>
          <label style={s.label}>Chat ID</label>
          <input
            type="text"
            style={fieldError("telegram.chatId") ? s.inputError : s.input}
            placeholder="e.g. 987654321"
            value={settings.telegram.chatId}
            onChange={(e) => updateField("telegram.chatId", e.target.value)}
          />
          {fieldError("telegram.chatId") && (
            <p style={s.errorText}>{fieldError("telegram.chatId").message}</p>
          )}
        </div>

        {/* Test Connection Button */}
        <div style={s.testButtonRow}>
          <button
            style={testLoading ? s.testButtonDisabled : s.testButton}
            onClick={handleTestMessage}
            disabled={testLoading}
          >
            {testLoading ? "Sending..." : "Test Connection"}
          </button>
        </div>

        {/* Test Result Feedback */}
        {testResult && (
          <div style={testResult.success ? s.testSuccess : s.testError}>
            {testResult.success ? "✓ Test message sent!" : `✕ ${testResult.error}`}
          </div>
        )}
      </div>

      {/* Capture */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Capture</div>

        <div style={s.field}>
          <label style={s.label}>Delay (ms)</label>
          <input
            type="number"
            style={fieldError("capture.delay") ? s.inputError : s.input}
            value={settings.capture.delay}
            min={50}
            max={2000}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10)
              updateField("capture.delay", isNaN(val) ? 0 : val)
            }}
          />
          {fieldError("capture.delay") && (
            <p style={s.errorText}>{fieldError("capture.delay").message}</p>
          )}
        </div>
      </div>

      {/* AI (placeholder) */}
      <div style={s.section}>
        <div style={s.sectionTitle}>
          AI<span style={s.badge}>coming soon</span>
        </div>

        <div style={s.field}>
          <label style={s.labelDisabled}>API Key</label>
          <input
            type="password"
            style={s.inputDisabled}
            disabled
            placeholder="Not available yet"
            value=""
          />
        </div>

        <div style={s.field}>
          <label style={s.labelDisabled}>Model</label>
          <input
            type="text"
            style={s.inputDisabled}
            disabled
            placeholder="Not available yet"
            value=""
          />
        </div>
      </div>

      {/* General error */}
      {fieldError("_general") && (
        <p style={s.errorText}>{fieldError("_general").message}</p>
      )}

      {/* Save */}
      <button
        style={saving ? s.saveButtonDisabled : s.saveButton}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>

      {/* Feedback */}
      {feedback === "success" && (
        <div style={s.feedbackSuccess}>✓ Settings saved</div>
      )}
    </main>
  )
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const s: Record<string, React.CSSProperties> = {
  container: {
    padding: 16,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    color: "#1a1a1a",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
  },
  navButton: {
    background: "none",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 13,
    cursor: "pointer",
    color: "#555",
  },
  // Section styles
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    color: "#6b7280",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 6,
    marginBottom: 12,
  },
  // Field styles
  field: { marginBottom: 12 },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 4,
    color: "#374151",
  },
  labelDisabled: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 4,
    color: "#9ca3af",
  },
  input: {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
  },
  inputError: {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "8px 10px",
    border: "1px solid #ef4444",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
  },
  inputDisabled: {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "8px 10px",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    fontSize: 14,
    backgroundColor: "#f9fafb",
    color: "#9ca3af",
    cursor: "not-allowed",
  },
  errorText: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
  },
  badge: {
    fontSize: 11,
    color: "#9ca3af",
    fontStyle: "italic" as const,
    marginLeft: 6,
  },
  // Save button
  saveButton: {
    width: "100%",
    padding: "10px 16px",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: "#2563eb",
    color: "#fff",
    marginTop: 8,
  },
  saveButtonDisabled: {
    width: "100%",
    padding: "10px 16px",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: "not-allowed",
    backgroundColor: "#93c5fd",
    color: "#fff",
    marginTop: 8,
  },
  feedbackSuccess: {
    textAlign: "center" as const,
    fontSize: 13,
    fontWeight: 600,
    marginTop: 8,
    padding: "6px 0",
    borderRadius: 6,
    color: "#16a34a",
    backgroundColor: "#f0fdf4",
  },
  // Capture view
  placeholderBox: {
    border: "2px dashed #d1d5db",
    borderRadius: 8,
    padding: 32,
    textAlign: "center" as const,
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#6b7280",
    margin: 0,
  },
  placeholderSub: {
    fontSize: 12,
    color: "#9ca3af",
    margin: "4px 0 0",
  },
  buttonRow: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    padding: "10px 16px",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  buttonDisabled: {
    backgroundColor: "#e5e7eb",
    color: "#9ca3af",
    cursor: "not-allowed",
  },
  comingSoon: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center" as const,
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
    fontSize: 13,
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
  // Test message styles
  testButtonRow: {
    marginTop: 8,
    marginBottom: 12,
  },
  testButton: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #2563eb",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: "#fff",
    color: "#2563eb",
  },
  testButtonDisabled: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #93c5fd",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: "not-allowed",
    backgroundColor: "#f0f9ff",
    color: "#93c5fd",
  },
  testSuccess: {
    marginTop: 8,
    padding: "8px 12px",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    textAlign: "center" as const,
    backgroundColor: "#f0fdf4",
    color: "#16a34a",
    border: "1px solid #22c55e",
  },
  testError: {
    marginTop: 8,
    padding: "8px 12px",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    textAlign: "center" as const,
    backgroundColor: "#fef2f2",
    color: "#dc2626",
    border: "1px solid #ef4444",
  },
}

export default SidePanel

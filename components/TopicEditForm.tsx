/**
 * TV Capture — Topic Edit Form Component
 *
 * Inline form for editing an existing Telegram topic.
 * Pre-filled with current values. Uses Share Link (not Topic ID) for UX consistency.
 * Topic ID is extracted automatically from the Share Link on save.
 */

import { useState } from "react"
import { parseTelegramShareLink } from "../lib-telegram-share"

type TopicEditFormProps = {
  channelId: number
  topicConfigId: number
  currentName: string
  initialShareLink: string
  onSave: (
    channelId: number,
    topicConfigId: number,
    name: string,
    topicId: string
  ) => Promise<void>
  onCancel: () => void
  onTopicId1Blocked: () => void
}

export function TopicEditForm({
  channelId,
  topicConfigId,
  currentName,
  initialShareLink,
  onSave,
  onCancel,
  onTopicId1Blocked,
}: TopicEditFormProps) {
  const [name, setName] = useState(currentName)
  const [shareLink, setShareLink] = useState(initialShareLink)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const styles: Record<string, React.CSSProperties> = {
    form: {
      marginTop: 6,
      padding: "8px 10px",
      backgroundColor: "rgba(37, 40, 48, 0.6)",
      borderRadius: 8,
      border: "1px solid #3a3f4a",
    },
    field: {
      marginBottom: 8,
    },
    label: {
      display: "block",
      fontSize: 12,
      fontWeight: 600,
      marginBottom: 4,
      color: "#9ca3af",
    },
    input: {
      width: "100%",
      boxSizing: "border-box" as const,
      padding: "8px 10px",
      border: "1px solid #3a3f4a",
      borderRadius: 6,
      fontSize: 13,
      outline: "none",
      backgroundColor: "#1e2028",
      color: "#e5e7eb",
      transition: "border-color 150ms",
    },
    buttonRow: {
      display: "flex",
      gap: 6,
      marginTop: 8,
    },
    saveButton: {
      flex: 1,
      padding: "8px 12px",
      border: "none",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      backgroundColor: "#0d9488",
      color: "#fff",
      transition: "background-color 150ms",
    },
    saveButtonDisabled: {
      flex: 1,
      padding: "8px 12px",
      border: "none",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
      cursor: "not-allowed",
      backgroundColor: "#134e4a",
      color: "#6b7280",
    },
    cancelButton: {
      padding: "8px 12px",
      border: "1px solid #3a3f4a",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      backgroundColor: "transparent",
      color: "#9ca3af",
      transition: "all 150ms",
    },
    error: {
      fontSize: 12,
      color: "#ef4444",
      marginTop: 4,
    },
  }

  const handleSubmit = async () => {
    if (!name.trim() || !shareLink.trim()) return

    setError(null)

    // Parse the share link to extract topicId
    const parsed = parseTelegramShareLink(shareLink.trim())
    if (!parsed) {
      setError("Invalid Share Link format. Expected: https://t.me/c/.../...")
      return
    }

    // Check Topic ID 1 blocking
    if (parsed.topicId === "1") {
      onTopicId1Blocked()
      return
    }

    setLoading(true)
    try {
      await onSave(channelId, topicConfigId, name.trim(), parsed.topicId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update topic")
      setLoading(false)
    }
  }

  const isValid = name.trim().length > 0 && shareLink.trim().length > 0

  return (
    <div style={styles.form}>
      <div style={styles.field}>
        <label style={styles.label}>Topic Name</label>
        <input
          style={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => {
            ;(e.target as HTMLInputElement).style.borderColor = "#0d9488"
          }}
          onBlur={(e) => {
            ;(e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
          }}
          disabled={loading}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Share Link</label>
        <input
          style={styles.input}
          value={shareLink}
          onChange={(e) => setShareLink(e.target.value)}
          onFocus={(e) => {
            ;(e.target as HTMLInputElement).style.borderColor = "#0d9488"
          }}
          onBlur={(e) => {
            ;(e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
          }}
          disabled={loading}
        />
      </div>

      <div style={styles.buttonRow}>
        <button
          style={isValid && !loading ? styles.saveButton : styles.saveButtonDisabled}
          disabled={!isValid || loading}
          onClick={handleSubmit}
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
        <button
          style={styles.cancelButton}
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}
    </div>
  )
}

/**
 * TV Capture — Thread Edit Form Component
 *
 * Inline form for editing an existing Discord thread.
 * Pre-filled with current values.
 */

import { useState } from "react"

type ThreadEditFormProps = {
  channelId: number
  threadConfigId: number
  currentName: string
  currentThreadId: string
  onSave: (
    channelId: number,
    threadConfigId: number,
    name: string,
    threadId: string
  ) => Promise<void>
  onCancel: () => void
}

export function ThreadEditForm({
  channelId,
  threadConfigId,
  currentName,
  currentThreadId,
  onSave,
  onCancel,
}: ThreadEditFormProps) {
  const [name, setName] = useState(currentName)
  const [threadId, setThreadId] = useState(currentThreadId)
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
    if (!name.trim() || !threadId.trim()) return

    setError(null)
    setLoading(true)
    try {
      await onSave(channelId, threadConfigId, name.trim(), threadId.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update thread")
      setLoading(false)
    }
  }

  const isValid = name.trim().length > 0 && threadId.trim().length > 0

  return (
    <div style={styles.form}>
      <div style={styles.field}>
        <label style={styles.label}>Thread Name</label>
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
        <label style={styles.label}>Thread ID</label>
        <input
          style={styles.input}
          value={threadId}
          onChange={(e) => setThreadId(e.target.value)}
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

/**
 * TV Capture — Thread Add Form Component
 *
 * Inline form for adding a thread to a Discord channel.
 * Simple form with Name + Thread ID fields.
 * Thread ID is a Discord Snowflake obtained via Developer Mode.
 */

import { useState } from "react"

type ThreadAddFormProps = {
  channelId: number
  onAdd: (channelId: number, name: string, threadId: string) => Promise<void>
  onCancel: () => void
}

export function ThreadAddForm({
  channelId,
  onAdd,
  onCancel,
}: ThreadAddFormProps) {
  const [threadName, setThreadName] = useState("")
  const [threadId, setThreadId] = useState("")
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
    infoBox: {
      backgroundColor: "rgba(59, 130, 246, 0.08)",
      border: "1px solid rgba(59, 130, 246, 0.2)",
      borderRadius: 6,
      padding: "6px 8px",
      marginBottom: 8,
      fontSize: 11,
      color: "#9ca3af",
      lineHeight: 1.4,
    },
    buttonRow: {
      display: "flex",
      gap: 6,
      marginTop: 8,
    },
    addButton: {
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
    addButtonDisabled: {
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
    if (!threadName.trim() || !threadId.trim()) return

    setError(null)
    setLoading(true)
    try {
      await onAdd(channelId, threadName.trim(), threadId.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add thread")
      setLoading(false)
    }
  }

  return (
    <div style={styles.form}>
      <div style={styles.field}>
        <label style={styles.label}>Thread Name</label>
        <input
          style={styles.input}
          placeholder="e.g. AAPL Earnings"
          value={threadName}
          onChange={(e) => setThreadName(e.target.value)}
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.borderColor = "#0d9488"
          }}
          disabled={loading}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Thread ID</label>
        <input
          style={styles.input}
          placeholder="e.g. 1504005327639543898"
          value={threadId}
          onChange={(e) => setThreadId(e.target.value)}
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.borderColor = "#0d9488"
          }}
          disabled={loading}
        />
      </div>

      {/* Info box */}
      <div style={styles.infoBox}>
        Copy a Thread ID via Discord Developer Mode:
        <ol style={{ margin: "4px 0 0", paddingLeft: 16 }}>
          <li>Enable Developer Mode in Discord (Settings → Advanced)</li>
          <li>Right-click a thread name</li>
          <li>Click "Copy ID"</li>
        </ol>
      </div>

      <div style={styles.buttonRow}>
        <button
          style={
            threadName.trim() && threadId.trim() && !loading
              ? styles.addButton
              : styles.addButtonDisabled
          }
          disabled={!threadName.trim() || !threadId.trim() || loading}
          onClick={handleSubmit}
        >
          {loading ? "Adding..." : "Add Thread"}
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

/**
 * TV Capture — Topic Add Form Component
 *
 * Inline form for adding a topic to a Telegram channel.
 * Simplified UX: Topic Name + Telegram Share Link only.
 * Topic ID is extracted automatically from the Share Link.
 */

import { useState } from "react"
import { parseTelegramShareLink } from "../lib-telegram-share"
import { resolveAndCorrectChatId } from "../lib-channels"

type TopicAddFormProps = {
  channelId: number
  onAdd: (channelId: number, name: string, topicId: string) => Promise<void>
  onCancel: () => void
  onToast: (message: string) => void
  onTopicId1Blocked: () => void
  isActive?: boolean
}

export function TopicAddForm({
  channelId,
  onAdd,
  onCancel,
  onToast,
  onTopicId1Blocked,
  isActive,
}: TopicAddFormProps) {
  const [topicName, setTopicName] = useState("")
  const [link, setLink] = useState("")
  const [parsedTopicId, setParsedTopicId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const styles: Record<string, React.CSSProperties> = {
    form: {
      marginTop: 6,
      padding: "8px 10px",
      backgroundColor: isActive ? "rgba(55, 60, 70, 0.5)" : "rgba(37, 40, 48, 0.6)",
      borderRadius: 8,
      border: isActive ? "1px solid #4b5563" : "1px solid #3a3f4a",
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
    parsedResult: {
      backgroundColor: "rgba(13, 148, 136, 0.08)",
      border: "1px solid rgba(13, 148, 136, 0.2)",
      borderRadius: 6,
      padding: "6px 10px",
      marginBottom: 8,
      fontSize: 12,
      color: "#9ca3af",
    },
    parsedValue: {
      color: "#e5e7eb",
      fontFamily: "monospace",
      fontSize: 12,
    },
    error: {
      fontSize: 12,
      color: "#ef4444",
      marginTop: 4,
      wordWrap: "break-word",
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
  }

  const handleParseLink = async () => {
    if (!link.trim()) {
      setParsedTopicId(null)
      return
    }
    setError(null)

    const parsed = parseTelegramShareLink(link.trim())
    if (!parsed) {
      setError("Invalid Share Link format. Expected: https://t.me/c/.../...")
      setParsedTopicId(null)
      return
    }

    // Check Topic ID 1 blocking
    if (parsed.topicId === "1") {
      onTopicId1Blocked()
      setParsedTopicId(null)
      return
    }

    // Chat ID auto-correction
    try {
      const correction = await resolveAndCorrectChatId(channelId, parsed.chatId)
      if (correction.updated) {
        onToast(`Chat ID auto-corrected from ${correction.oldChatId} to ${correction.newChatId}`)
      }
    } catch {
      // Non-critical — continue even if correction fails
    }

    setParsedTopicId(parsed.topicId)
  }

  const handleSubmit = async () => {
    if (!topicName.trim() || !parsedTopicId) return

    setError(null)
    setLoading(true)
    try {
      await onAdd(channelId, topicName.trim(), parsedTopicId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add topic")
      setLoading(false)
    }
  }

  const isValid = topicName.trim().length > 0 && parsedTopicId !== null

  return (
    <div style={styles.form}>
      {/* Topic Name field */}
      <div style={styles.field}>
        <label style={styles.label}>Topic Name</label>
        <input
          style={styles.input}
          placeholder="e.g. Gold Analysis"
          value={topicName}
          onChange={(e) => setTopicName(e.target.value)}
          onFocus={(e) => {
            ;(e.target as HTMLInputElement).style.borderColor = "#0d9488"
          }}
          onBlur={(e) => {
            ;(e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
          }}
          disabled={loading}
        />
      </div>

      {/* Share Link field */}
      <div style={styles.field}>
        <label style={styles.label}>Share Link</label>
        <input
          style={styles.input}
          placeholder="https://t.me/c/3719682271/2"
          value={link}
          onChange={(e) => {
            setLink(e.target.value)
            // Clear parsed result when user types
            if (!e.target.value.trim()) {
              setParsedTopicId(null)
            }
          }}
          onBlur={(e) => {
            ;(e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
            handleParseLink()
          }}
          onFocus={(e) => {
            ;(e.target as HTMLInputElement).style.borderColor = "#0d9488"
          }}
          disabled={loading}
        />
      </div>

      {/* Parsed result display */}
      {parsedTopicId && (
        <div style={styles.parsedResult}>
          <div>
            Parsed Topic ID: <span style={styles.parsedValue}>{parsedTopicId}</span>
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
            ✅ Topic IDs are permanent — they don't change as long as the topic exists.
          </div>
        </div>
      )}

      {/* Blue info box at the bottom */}
      <div style={styles.infoBox}>
        <strong>How to get a Topic Share Link:</strong>
        <ol style={{ margin: "4px 0 0", paddingLeft: 16 }}>
          <li>Open the desired topic in Telegram</li>
          <li>Tap the topic name at the top of the chat</li>
          <li>Tap "Copy Message Link" / "Link teilen"</li>
        </ol>
        <p style={{ margin: "4px 0 0" }}>
          The link looks like: <code>https://t.me/c/3719682271/2</code>
        </p>
      </div>

      <div style={styles.buttonRow}>
        <button
          style={isValid && !loading ? styles.addButton : styles.addButtonDisabled}
          disabled={!isValid || loading}
          onClick={handleSubmit}
        >
          {loading ? "Adding..." : "Add Topic"}
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

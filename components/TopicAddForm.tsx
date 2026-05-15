/**
 * TV Capture — Topic Add Form Component
 *
 * Inline form for adding a topic to a Telegram channel via Share Link paste.
 * Three states: shareLink (initial), parsed (after successful parse), manual (fallback).
 * Handles Chat ID auto-correction and Topic ID 1 blocking via parent callbacks.
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
}

type FormMode = "shareLink" | "parsed" | "manual" | "loading"

export function TopicAddForm({
  channelId,
  onAdd,
  onCancel,
  onToast,
  onTopicId1Blocked,
}: TopicAddFormProps) {
  const [mode, setMode] = useState<FormMode>("shareLink")
  const [link, setLink] = useState("")
  const [topicName, setTopicName] = useState("")
  const [manualTopicId, setManualTopicId] = useState("")
  const [parsedChatId, setParsedChatId] = useState("")
  const [parsedTopicId, setParsedTopicId] = useState("")
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
    infoLink: {
      fontSize: 11,
      color: "#6b7280",
      cursor: "pointer",
      textDecoration: "underline",
      textDecorationColor: "#4b5563",
      marginLeft: 4,
      transition: "color 150ms",
    },
    error: {
      fontSize: 12,
      color: "#ef4444",
      marginTop: 4,
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
    setError(null)
    const parsed = parseTelegramShareLink(link)
    if (!parsed) {
      setError("Invalid Share Link format. Expected: https://t.me/c/.../...")
      return
    }

    // Check Topic ID 1 blocking
    if (parsed.topicId === "1") {
      onTopicId1Blocked()
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

    setParsedChatId(parsed.chatId)
    setParsedTopicId(parsed.topicId)
    setMode("parsed")
  }

  const handleManualSubmit = async () => {
    if (!topicName.trim() || !manualTopicId.trim()) return

    if (manualTopicId.trim() === "1") {
      onTopicId1Blocked()
      return
    }

    setError(null)
    setMode("loading")
    try {
      await onAdd(channelId, topicName.trim(), manualTopicId.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add topic")
      setMode("manual")
    }
  }

  const handleParsedSubmit = async () => {
    if (!topicName.trim()) return

    setError(null)
    setMode("loading")
    try {
      await onAdd(channelId, topicName.trim(), parsedTopicId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add topic")
      setMode("parsed")
    }
  }

  return (
    <div style={styles.form}>
      {/* Initial / Share Link state */}
      {(mode === "shareLink" || mode === "parsed") && (
        <div style={styles.field}>
          <label style={styles.label}>Telegram Link</label>
            <input
              style={styles.input}
              placeholder="https://t.me/c/3719682271/2"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onBlur={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
                handleParseLink()
              }}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "#0d9488"
              }}
              disabled={mode === "parsed"}
            />
          {/* Info box for Share Link */}
          {mode === "shareLink" && (
            <div style={styles.infoBox}>
              <strong>How to get a Topic Link:</strong>
              <ol style={{ margin: "4px 0 0", paddingLeft: 16 }}>
                <li>Open the desired topic in Telegram</li>
                <li>Tap the topic name at the top of the chat</li>
                <li>Tap "Copy Message Link" / "Link teilen"</li>
              </ol>
              <p style={{ margin: "4px 0 0" }}>
                The link looks like: <code>https://t.me/c/3719682271/2</code>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Parsed result display */}
      {mode === "parsed" && (
        <>
          <div style={styles.parsedResult}>
            <div>Chat ID: <span style={styles.parsedValue}>{parsedChatId}</span></div>
            <div>Topic ID: <span style={styles.parsedValue}>{parsedTopicId}</span></div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
              ✅ Topic IDs are permanent — they don't change as long as the topic exists.
            </div>
          </div>

          {/* Name input for parsed mode */}
          <div style={styles.field}>
            <label style={styles.label}>Topic Name</label>
            <input
              style={styles.input}
              placeholder="e.g. Gold Analysis"
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "#0d9488"
              }}
              onBlur={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
              }}
            />
          </div>

          <div style={styles.buttonRow}>
            <button
              style={topicName.trim() ? styles.addButton : styles.addButtonDisabled}
              disabled={!topicName.trim()}
              onClick={handleParsedSubmit}
            >
              Add Topic
            </button>
            <button
              style={styles.cancelButton}
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Share Link mode: manual fallback link */}
      {mode === "shareLink" && (
        <span
          style={styles.infoLink}
          onClick={() => {
            setMode("manual")
            setError(null)
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.color = "#9ca3af"
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.color = "#6b7280"
          }}
        >
          Enter manually
        </span>
      )}

      {/* Manual mode */}
      {mode === "manual" && (
        <>
          <div style={styles.field}>
            <label style={styles.label}>Topic ID</label>
            <input
              style={styles.input}
              placeholder="e.g. 17"
              value={manualTopicId}
              onChange={(e) => setManualTopicId(e.target.value)}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "#0d9488"
              }}
              onBlur={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
              }}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Topic Name</label>
            <input
              style={styles.input}
              placeholder="e.g. Gold Analysis"
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "#0d9488"
              }}
              onBlur={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
              }}
            />
          </div>

          <div style={styles.buttonRow}>
            <button
              style={
                topicName.trim() && manualTopicId.trim()
                  ? styles.addButton
                  : styles.addButtonDisabled
              }
              disabled={!topicName.trim() || !manualTopicId.trim()}
              onClick={handleManualSubmit}
            >
              Add Topic
            </button>
            <button
              style={styles.cancelButton}
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Loading state */}
      {mode === "loading" && (
        <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center", padding: "8px 0" }}>
          Adding...
        </div>
      )}

      {/* Error display */}
      {error && <p style={styles.error}>{error}</p>}
    </div>
  )
}

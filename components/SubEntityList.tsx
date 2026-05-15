/**
 * TV Capture — Sub-Entity List Component
 *
 * Generic sub-entity list that renders either topics (Telegram) or threads (Discord).
 * Items are displayed in creation order with individual test and remove buttons.
 * The add button opens an inline form managed by the parent.
 */

type SubEntityItem = {
  id: number // TopicConfig.id or ThreadConfig.id
  name: string // Display name
  externalId: string // topicId or threadId (for test button tooltip)
}

type SubEntityListProps = {
  platform: "telegram" | "discord"
  items: SubEntityItem[]
  channelId: number
  addButtonText: string // "[+ Add Topic]" or "[+ Add Thread]"
  onAdd: (channelId: number) => void
  onRemove: (channelId: number, itemId: number) => void
  onTest: (channelId: number, itemId: number) => void
  isFormActive: boolean // Is the add form for this channel currently open?
  testStates: Record<string, "idle" | "loading" | "success" | "error">
  testErrors?: Record<string, string | null>
  onShowError?: (channelId: number, itemId: number) => void
}

export function SubEntityList({
  platform,
  items,
  channelId,
  addButtonText,
  onAdd,
  onRemove,
  onTest,
  isFormActive,
  testStates,
  testErrors,
  onShowError,
}: SubEntityListProps) {
  const label = platform === "telegram" ? "TOPICS" : "THREADS"

  const styles: Record<string, React.CSSProperties> = {
    container: {
      marginTop: 8,
      marginBottom: 4,
    },
    separator: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    separatorLine: {
      flex: 1,
      height: 0,
      borderTop: "1px solid #3a3f4a",
    },
    separatorLabel: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.05em",
      color: "#6b7280",
      whiteSpace: "nowrap" as const,
    },
    itemRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "6px 0",
      borderBottom: "1px solid #2c3038",
    },
    itemName: {
      fontSize: 13,
      color: "#e5e7eb",
      flex: 1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    itemButtons: {
      display: "flex",
      gap: 6,
      flexShrink: 0,
    },
    smallButton: {
      padding: "4px 10px",
      border: "1px solid #0d9488",
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer",
      backgroundColor: "transparent",
      color: "#14b8a6",
      transition: "all 150ms",
      whiteSpace: "nowrap" as const,
    },
    removeButton: {
      padding: "4px 10px",
      border: "none",
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer",
      backgroundColor: "transparent",
      color: "#9ca3af",
      transition: "all 150ms",
    },
    testButtonLoading: {
      padding: "4px 10px",
      border: "1px solid #134e4a",
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      cursor: "not-allowed",
      backgroundColor: "rgba(13, 148, 136, 0.08)",
      color: "#6b7280",
      whiteSpace: "nowrap" as const,
    },
    testButtonSuccess: {
      padding: "4px 10px",
      border: "none",
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      cursor: "default",
      backgroundColor: "#10b981",
      color: "#fff",
      whiteSpace: "nowrap" as const,
    },
    testButtonError: {
      padding: "4px 10px",
      border: "none",
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      cursor: "default",
      backgroundColor: "#ef4444",
      color: "#fff",
      whiteSpace: "nowrap" as const,
    },
    addButton: {
      width: "100%",
      padding: "8px 12px",
      border: "1px dashed #0d9488",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      backgroundColor: "transparent",
      color: "#14b8a6",
      marginTop: 6,
      transition: "all 150ms",
    },
    emptyText: {
      fontSize: 12,
      color: "#6b7280",
      textAlign: "center" as const,
      padding: "8px 0",
      fontStyle: "italic" as const,
    },
  }

  return (
    <div style={styles.container}>
      {/* Separator */}
      <div style={styles.separator}>
        <div style={styles.separatorLine} />
        <span style={styles.separatorLabel}>{label}</span>
        <div style={styles.separatorLine} />
      </div>

      {/* Items */}
      {items.length === 0 && !isFormActive && (
        <p style={styles.emptyText}>No {label.toLowerCase()} configured</p>
      )}
      {items.map((item) => {
        const testKey =
          platform === "telegram"
            ? `topic-${channelId}-${item.id}`
            : `thread-${channelId}-${item.id}`
        const testState = testStates[testKey] || "idle"

        return (
          <div key={item.id} style={styles.itemRow}>
            <span style={styles.itemName} title={`ID: ${item.externalId}`}>
              {item.name}
            </span>
            <div style={styles.itemButtons}>
              <button
                style={
                  testState === "loading"
                    ? styles.testButtonLoading
                    : testState === "success"
                      ? styles.testButtonSuccess
                      : testState === "error"
                        ? styles.testButtonError
                        : styles.smallButton
                }
                onClick={() => {
                  if (testState === "error") {
                    onShowError?.(channelId, item.id)
                  } else {
                    onTest(channelId, item.id)
                  }
                }}
                disabled={testState === "loading" || testState === "success"}
                title={
                  testState === "error"
                    ? "Click to see error details"
                    : `${platform === "telegram" ? "Topic" : "Thread"} ID: ${item.externalId}`
                }
              >
                {testState === "loading"
                  ? "Testing..."
                  : testState === "success"
                    ? "✓"
                    : testState === "error"
                      ? "✗"
                      : "Test"}
              </button>
              <button
                style={styles.removeButton}
                onClick={() => onRemove(channelId, item.id)}
                onMouseEnter={(e) => {
                  ;(e.target as HTMLButtonElement).style.color = "#ef4444"
                }}
                onMouseLeave={(e) => {
                  ;(e.target as HTMLButtonElement).style.color = "#9ca3af"
                }}
              >
                Remove
              </button>
            </div>
          </div>
        )
      })}

      {/* Add button (visible only when form is NOT active) */}
      {!isFormActive && (
        <button
          style={styles.addButton}
          onClick={() => onAdd(channelId)}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = "rgba(13, 148, 136, 0.1)"
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = "transparent"
          }}
        >
          {addButtonText}
        </button>
      )}
    </div>
  )
}

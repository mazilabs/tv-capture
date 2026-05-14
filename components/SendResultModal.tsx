/**
 * SendResultModal — displays per-target send results after multi-channel send.
 *
 * Only shown when at least one target failed.
 * Shows ✅ for successful targets and ❌ with error details for failed targets.
 */

import React from "react"
import type { SendTargetResult } from "../lib-messages"
import type { Channel, TelegramCredentials, DiscordCredentials } from "../lib-channels"

export type SendResultModalProps = {
  results: SendTargetResult[]
  channels: Channel[]
  onClose: () => void
}

/**
 * Resolve a SendTarget to a human-readable display name.
 * Main channel: "TG: Main Group"
 * Topic: "TG: Main Group › TestTopic"
 * Thread: "DC: Trading Alerts › AAPL Earnings"
 */
function resolveTargetName(target: SendTargetResult["target"], channels: Channel[]): string {
  const channel = channels.find((ch) => ch.id === target.channelId)
  if (!channel) {
    return `Unknown Channel (${target.channelId})`
  }

  // Main channel (no sub-target)
  if (!target.subTargetType || !target.subTargetId) {
    return channel.displayName
  }

  const subId = target.subTargetId

  if (target.subTargetType === "topic") {
    const creds = channel.credentials as TelegramCredentials
    const topic = creds.topics.find((t) => t.id.toString() === subId)
    return topic ? `${channel.displayName} › ${topic.name}` : channel.displayName
  }

  if (target.subTargetType === "thread") {
    const creds = channel.credentials as DiscordCredentials
    const thread = creds.threads.find((t) => t.id.toString() === subId)
    return thread ? `${channel.displayName} › ${thread.name}` : channel.displayName
  }

  return channel.displayName
}

export function SendResultModal({ results, channels, onClose }: SendResultModalProps) {
  const successCount = results.filter((r) => r.success).length
  const failCount = results.filter((r) => !r.success).length
  const allFailed = failCount === results.length

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <h2 style={styles.title}>
          {allFailed ? "Send Failed" : "Partial Failure"}
        </h2>
        <p style={styles.subtitle}>
          {allFailed
            ? `All ${failCount} target${failCount > 1 ? "s" : ""} failed.`
            : `${successCount} sent successfully, ${failCount} failed.`}
        </p>

        {/* Divider */}
        <div style={styles.divider} />

        {/* Results List */}
        <div style={styles.list}>
          {results.map((result, index) => {
            const name = resolveTargetName(result.target, channels)
            return (
              <div key={index} style={styles.row}>
                {/* Status Icon */}
                <span style={result.success ? styles.iconSuccess : styles.iconFail}>
                  {result.success ? "✅" : "❌"}
                </span>

                {/* Name */}
                <span
                  style={{
                    ...styles.name,
                    opacity: result.success ? 0.6 : 1,
                  }}
                >
                  {name}
                </span>

                {/* Error */}
                {!result.success && result.error && (
                  <span style={styles.error}>{result.error}</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Action Button */}
        <button
          style={styles.closeButton}
          onClick={onClose}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = "#2c3038"
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = "transparent"
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles — Dark Glassmorphism Theme
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "#252830",
    borderRadius: 12,
    padding: 20,
    maxWidth: "90%",
    width: 340,
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
    border: "1px solid #3a3f4a",
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    margin: "0 0 4px",
    color: "#e5e7eb",
  },
  subtitle: {
    fontSize: 13,
    color: "#9ca3af",
    margin: "0 0 16px",
  },
  divider: {
    height: 0,
    borderTop: "1px solid #3a3f4a",
    marginBottom: 12,
  },
  list: {
    maxHeight: 240,
    overflowY: "auto",
    marginBottom: 16,
    scrollbarWidth: "thin",
  },
  row: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    padding: "6px 0",
    flexWrap: "wrap" as const,
  },
  iconSuccess: {
    flexShrink: 0,
    fontSize: 14,
  },
  iconFail: {
    flexShrink: 0,
    fontSize: 14,
  },
  name: {
    fontSize: 13,
    color: "#e5e7eb",
    flexShrink: 0,
    lineHeight: 1.4,
  },
  error: {
    fontSize: 12,
    color: "#ef4444",
    width: "100%",
    paddingLeft: 22,
    lineHeight: 1.4,
  },
  closeButton: {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #3a3f4a",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: "transparent",
    color: "#9ca3af",
    transition: "all 150ms",
  },
}

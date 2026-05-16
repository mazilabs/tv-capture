/**
 * TV Capture — Channel Card Component
 *
 * Unified channel card for Settings that renders consistently
 * for both Telegram and Discord channels.
 *
 * Features:
 * - Editable name field (auto-saves on blur)
 * - Platform-specific credential fields (auto-save on blur)
 * - Sub-entity section (Topics for Telegram, Threads for Discord)
 * - Inline add forms for topics/threads
 * - [Test Connectivity] and [Remove Channel] buttons
 * - Credential preservation: always spreads existing credentials
 *   when updating to preserve sub-entities.
 */

import { useState, useRef, useEffect } from "react"
import type { Channel, ChannelUpdate, TelegramCredentials, DiscordCredentials, TopicConfig, ThreadConfig } from "../lib-channels"
import { CHANNEL_PREFIX } from "../lib-channels"
import { SubEntityList } from "./SubEntityList"
import { TopicAddForm } from "./TopicAddForm"
import { ThreadAddForm } from "./ThreadAddForm"
import { TopicEditForm } from "./TopicEditForm"
import { ThreadEditForm } from "./ThreadEditForm"

type ChannelCardProps = {
  channel: Channel
  testStates: Record<string, "idle" | "loading" | "success" | "error">
  testErrors?: Record<string, string | null>
  onTestConnectivity: (channelId: number) => void
  onRemoveChannel: (channelId: number, hasSubEntities: boolean) => void
  onAddTopic: (channelId: number) => void
  onEditTopic: (channelId: number, topicConfigId: number) => void
  onDeleteTopic: (channelId: number, topicConfigId: number, topicName: string) => void
  onTestTopic: (channelId: number, topicConfigId: number) => void
  onAddThread: (channelId: number) => void
  onEditThread: (channelId: number, threadConfigId: number) => void
  onDeleteThread: (channelId: number, threadConfigId: number, threadName: string) => void
  onTestThread: (channelId: number, threadConfigId: number) => void
  onUpdateChannel: (channelId: number, updates: ChannelUpdate) => void
  onTopicAdd: (channelId: number, name: string, topicId: string) => Promise<void>
  onThreadAdd: (channelId: number, name: string, threadId: string) => Promise<void>
  onTopicSave: (channelId: number, topicConfigId: number, name: string, topicId: string) => Promise<void>
  onThreadSave: (channelId: number, threadConfigId: number, name: string, threadId: string) => Promise<void>
  onEditTopicCancel: () => void
  onEditThreadCancel: () => void
  onToast: (message: string) => void
  onTopicId1Blocked: () => void
  onRefresh: () => Promise<void>
  activeFormId: string | null
  setActiveFormId: (id: string | null) => void
  editingTopicId: number | null
  editingThreadId: number | null
  onShowTestError?: (channelId: number) => void
  onShowSubEntityError?: (channelId: number, itemId: number) => void
  isActive?: boolean
  onCardFocus?: () => void
  onCardBlur?: () => void
}

export function ChannelCard({
  channel,
  testStates,
  testErrors,
  onTestConnectivity,
  onRemoveChannel,
  onAddTopic,
  onEditTopic,
  onDeleteTopic,
  onTestTopic,
  onAddThread,
  onEditThread,
  onDeleteThread,
  onTestThread,
  onUpdateChannel,
  onTopicAdd,
  onThreadAdd,
  onTopicSave,
  onThreadSave,
  onEditTopicCancel,
  onEditThreadCancel,
  onToast,
  onTopicId1Blocked,
  onRefresh,
  activeFormId,
  setActiveFormId,
  editingTopicId,
  editingThreadId,
  onShowTestError,
  onShowSubEntityError,
  isActive,
  onCardFocus,
  onCardBlur,
}: ChannelCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  // Deterministic card focus tracking using native focusin/focusout
  useEffect(() => {
    const card = cardRef.current
    if (!card || !onCardFocus || !onCardBlur) return

    const handleFocusIn = () => {
      onCardFocus()
    }

    const handleFocusOut = (e: FocusEvent) => {
      const relatedTarget = e.relatedTarget as HTMLElement | null
      if (!relatedTarget || !card.contains(relatedTarget)) {
        onCardBlur()
      }
    }

    card.addEventListener("focusin", handleFocusIn)
    card.addEventListener("focusout", handleFocusOut)

    return () => {
      card.removeEventListener("focusin", handleFocusIn)
      card.removeEventListener("focusout", handleFocusOut)
    }
  }, [onCardFocus, onCardBlur])

  const isTelegram = channel.type === "telegram"
  const prefix = CHANNEL_PREFIX[channel.type]

  // Determine sub-entity info
  const subEntities: { items: { id: number; name: string; externalId: string }[] } =
    isTelegram
      ? {
          items: (channel.credentials as TelegramCredentials).topics.map((t: TopicConfig) => ({
            id: t.id,
            name: t.name,
            externalId: t.topicId,
          })),
        }
      : {
          items: (channel.credentials as DiscordCredentials).threads.map((t: ThreadConfig) => ({
            id: t.id,
            name: t.name,
            externalId: t.threadId,
          })),
        }

  const hasSubEntities = subEntities.items.length > 0
  const topicsList = isTelegram ? (channel.credentials as TelegramCredentials).topics : []
  const threadsList = !isTelegram ? (channel.credentials as DiscordCredentials).threads : []

  // Test state for main connectivity
  const testKey = `ch-${channel.id}`
  const testState = testStates[testKey] || "idle"

  // Topic-add form ID for this channel
  const topicFormId = `topic-${channel.id}`
  const threadFormId = `thread-${channel.id}`
  const isTopicFormActive = activeFormId === topicFormId
  const isThreadFormActive = activeFormId === threadFormId

  const styles: Record<string, React.CSSProperties> = {
    card: {
      border: "1px solid #3a3f4a",
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
      backgroundColor: "rgba(37, 40, 48, 0.5)",
    },
    cardHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
      letterSpacing: "0.02em",
    },
    cardHeaderLeft: {
      fontSize: 14,
      fontWeight: 600,
      color: "#e5e7eb",
    },
    cardHeaderRight: {
      fontSize: 13,
      fontWeight: 400,
      color: "#6b7280",
      textAlign: "right",
      flex: 1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      marginLeft: 8,
    },
    field: {
      marginBottom: 10,
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
      backgroundColor: "#252830",
      color: "#e5e7eb",
      transition: "border-color 150ms",
    },
    buttonRow: {
      display: "flex",
      gap: 8,
      marginTop: 10,
    },
    testButton: {
      flex: 1,
      padding: "8px 12px",
      border: "1px solid #0d9488",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      backgroundColor: "transparent",
      color: "#14b8a6",
      transition: "all 200ms",
    },
    testButtonLoading: {
      flex: 1,
      padding: "8px 12px",
      border: "1px solid #134e4a",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
      cursor: "not-allowed",
      backgroundColor: "rgba(13, 148, 136, 0.08)",
      color: "#6b7280",
    },
    testButtonSuccess: {
      flex: 1,
      padding: "8px 12px",
      border: "none",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
      cursor: "default",
      backgroundColor: "#10b981",
      color: "#fff",
    },
    testButtonError: {
      flex: 1,
      padding: "8px 12px",
      border: "none",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
      cursor: "default",
      backgroundColor: "#ef4444",
      color: "#fff",
    },
    removeButton: {
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
  }

  return (
    <div
      ref={cardRef}
      data-card-id={channel.id}
      style={{
        ...styles.card,
        border: isActive ? "1px solid #4b5563" : "1px solid #3a3f4a",
        backgroundColor: isActive ? "rgba(55, 60, 70, 0.5)" : "rgba(37, 40, 48, 0.5)",
      }}
    >
      {/* Card Header: "TG: Name" / "DC: Name" + account/server name on right */}
      <div style={styles.cardHeader}>
        <span style={styles.cardHeaderLeft}>{prefix}: {channel.name}</span>
        {isTelegram ? (
          (channel.credentials as TelegramCredentials).accountName ? (
            <span style={styles.cardHeaderRight}>
              {(channel.credentials as TelegramCredentials).accountName}
            </span>
          ) : null
        ) : (
          (channel.credentials as DiscordCredentials).serverName ? (
            <span style={styles.cardHeaderRight}>
              {(channel.credentials as DiscordCredentials).serverName}
            </span>
          ) : null
        )}
      </div>

      {/* Account Name / Server Name Field */}
      <div style={styles.field}>
        <label style={styles.label}>{isTelegram ? "Account Name" : "Server Name"}</label>
        <input
          style={styles.input}
          defaultValue={
            isTelegram
              ? (channel.credentials as TelegramCredentials).accountName || ""
              : (channel.credentials as DiscordCredentials).serverName || ""
          }
          placeholder={isTelegram ? "e.g. My Trading Account" : "e.g. Trading Server"}
          onBlur={(e) => {
            const newValue = e.target.value.trim()
            if (isTelegram) {
              const creds = channel.credentials as TelegramCredentials
              if (newValue !== (creds.accountName || "")) {
                onUpdateChannel(channel.id, {
                  credentials: { ...creds, accountName: newValue || undefined },
                })
              }
            } else {
              const creds = channel.credentials as DiscordCredentials
              if (newValue !== (creds.serverName || "")) {
                onUpdateChannel(channel.id, {
                  credentials: { ...creds, serverName: newValue || undefined },
                })
              }
            }
            (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
          }}
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.borderColor = "#0d9488"
          }}
        />
      </div>

      {/* Editable Name Field */}
      <div style={styles.field}>
        <label style={styles.label}>Channel Name</label>
        <input
          style={styles.input}
          defaultValue={channel.name}
          placeholder="Channel name"
          onBlur={(e) => {
            const newName = e.target.value.trim()
            if (newName && newName !== channel.name) {
              onUpdateChannel(channel.id, { name: newName })
            }
            (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
          }}
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.borderColor = "#0d9488"
          }}
        />
      </div>

      {/* Platform-specific Credential Fields */}
      {isTelegram ? (
        <>
          <div style={styles.field}>
            <label style={styles.label}>Bot Token</label>
            <input
              style={styles.input}
              defaultValue={(channel.credentials as TelegramCredentials).botToken}
              placeholder="e.g. 123456:ABC-DEF..."
              onBlur={(e) => {
                const creds = channel.credentials as TelegramCredentials
                const newToken = e.target.value
                if (newToken !== creds.botToken) {
                  onUpdateChannel(channel.id, {
                    credentials: { ...creds, botToken: newToken },
                  })
                }
                (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
              }}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "#0d9488"
              }}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Chat ID</label>
            <input
              style={styles.input}
              defaultValue={(channel.credentials as TelegramCredentials).chatId}
              placeholder="e.g. -1001234567890"
              onBlur={(e) => {
                const creds = channel.credentials as TelegramCredentials
                const newChatId = e.target.value
                if (newChatId !== creds.chatId) {
                  onUpdateChannel(channel.id, {
                    credentials: { ...creds, chatId: newChatId },
                  })
                }
                (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
              }}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "#0d9488"
              }}
            />
          </div>
        </>
      ) : (
        <div style={styles.field}>
          <label style={styles.label}>Webhook URL</label>
          <input
            style={styles.input}
            defaultValue={(channel.credentials as DiscordCredentials).webhookUrl}
            placeholder="e.g. https://discord.com/api/webhooks/..."
            onBlur={(e) => {
              const creds = channel.credentials as DiscordCredentials
              const newUrl = e.target.value
              if (newUrl !== creds.webhookUrl) {
                onUpdateChannel(channel.id, {
                  credentials: { ...creds, webhookUrl: newUrl },
                })
              }
              (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
            }}
            onFocus={(e) => {
              (e.target as HTMLInputElement).style.borderColor = "#0d9488"
            }}
          />
        </div>
      )}

      {/* Sub-Entity Section */}
      {isTelegram ? (
        <>
          <SubEntityList
            platform="telegram"
            items={subEntities.items}
            channelId={channel.id}
            addButtonText="+ Add Topic"
            onAdd={onAddTopic}
            onEdit={onEditTopic}
            onDelete={onDeleteTopic}
            onTest={onTestTopic}
            isFormActive={isTopicFormActive}
            testStates={testStates}
            testErrors={testErrors}
            onShowError={onShowSubEntityError}
            editingItemId={editingTopicId}
            renderEditForm={(itemId) => {
              const topic = topicsList.find((t) => t.id === itemId)
              if (!topic) return null
              const chatId = (channel.credentials as TelegramCredentials).chatId
              const initialShareLink = chatId
                ? `https://t.me/c/${chatId}/${topic.topicId}`
                : ""
              return (
                <TopicEditForm
                  channelId={channel.id}
                  topicConfigId={itemId}
                  currentName={topic.name}
                  initialShareLink={initialShareLink}
                  onSave={onTopicSave}
                  onCancel={onEditTopicCancel}
                  onTopicId1Blocked={onTopicId1Blocked}
                />
              )
            }}
          />
          {/* TopicAddForm inline */}
          {isTopicFormActive && (
            <TopicAddForm
              channelId={channel.id}
              onAdd={onTopicAdd}
              onCancel={() => setActiveFormId(null)}
              onToast={onToast}
              onTopicId1Blocked={onTopicId1Blocked}
            />
          )}
        </>
      ) : (
        <>
          <SubEntityList
            platform="discord"
            items={subEntities.items}
            channelId={channel.id}
            addButtonText="+ Add Thread"
            onAdd={onAddThread}
            onEdit={onEditThread}
            onDelete={onDeleteThread}
            onTest={onTestThread}
            isFormActive={isThreadFormActive}
            testStates={testStates}
            testErrors={testErrors}
            onShowError={onShowSubEntityError}
            editingItemId={editingThreadId}
            renderEditForm={(itemId) => {
              const thread = threadsList.find((t) => t.id === itemId)
              if (!thread) return null
              return (
                <ThreadEditForm
                  channelId={channel.id}
                  threadConfigId={itemId}
                  currentName={thread.name}
                  currentThreadId={thread.threadId}
                  onSave={onThreadSave}
                  onCancel={onEditThreadCancel}
                />
              )
            }}
          />
          {/* ThreadAddForm inline */}
          {isThreadFormActive && (
            <ThreadAddForm
              channelId={channel.id}
              onAdd={onThreadAdd}
              onCancel={() => setActiveFormId(null)}
            />
          )}
        </>
      )}

      {/* Button Row: [Test Connectivity] + [Remove Channel] */}
      <div style={styles.buttonRow}>
        <button
          style={
            testState === "loading"
              ? styles.testButtonLoading
              : testState === "success"
                ? styles.testButtonSuccess
                : testState === "error"
                  ? styles.testButtonError
                  : styles.testButton
          }
          onClick={() => {
            if (testState === "error") {
              onShowTestError?.(channel.id)
            } else {
              onTestConnectivity(channel.id)
            }
          }}
          disabled={testState === "loading" || testState === "success"}
          onMouseEnter={(e) => {
            if (testState === "idle") {
              (e.target as HTMLButtonElement).style.backgroundColor = "rgba(13, 148, 136, 0.15)"
            }
          }}
          onMouseLeave={(e) => {
            if (testState === "idle") {
              (e.target as HTMLButtonElement).style.backgroundColor = "transparent"
            }
          }}
        >
          {testState === "loading"
            ? "Testing..."
            : testState === "success"
              ? "✓ Connected"
              : testState === "error"
                ? "✗ Failed"
                : "Test Connectivity"}
        </button>
        <button
          style={styles.removeButton}
          onClick={() => onRemoveChannel(channel.id, hasSubEntities)}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.color = "#ef4444"
            ;(e.target as HTMLButtonElement).style.borderColor = "#ef4444"
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.color = "#9ca3af"
            ;(e.target as HTMLButtonElement).style.borderColor = "#3a3f4a"
          }}
        >
          Remove Channel
        </button>
      </div>
    </div>
  )
}

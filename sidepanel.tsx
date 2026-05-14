/**
 * TV Capture — Side Panel
 *
 * Single side panel with two internal views:
 *  - "capture": screenshot preview + compose placeholder (Phase 4)
 *  - "settings": Telegram, Keyboard Shortcuts, Templates (Phase 6.2)
 *
 * View switching is triggered by messages from the background service worker
 * (which receives OPEN_SETTINGS / OPEN_CAPTURE from the popup).
 * 
 * Updated: Dark Glassmorphism theme (2026-04-20)
 */

import { useEffect, useState, useCallback } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  MESSAGE_TYPES,
  type CaptureResponse,
  type SendScreenshotResponse,
  type SendMultiChannelResponse,
  type SendTarget,
  type SendTargetResult,
} from "./lib-messages"
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  updateTemplateOrder,
  type Template,
} from "./lib-templates"
import { CollapsibleSection } from "./components/CollapsibleSection"
import { TemplateForm } from "./components/TemplateForm"
import { SortableTemplateItem } from "./components/SortableTemplateItem"
import { TemplateTile } from "./components/TemplateTile"
import {
  getChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  addTopicToChannel,
  removeTopicFromChannel,
  addThreadToChannel,
  removeThreadFromChannel,
  getChannelsSortedBySendOrder,
  updateChannelSendOrder,
  updateSubEntityOrder,
  type Channel,
  type ChannelUpdate,
  type ChannelCredentials,
  type TelegramCredentials,
  type DiscordCredentials,
} from "./lib-channels"
import { ConfirmDialog } from "./components/ConfirmDialog"
import { ChannelCard } from "./components/ChannelCard"
import { SendChannelCard } from "./components/SendChannelCard"
import { SendResultModal } from "./components/SendResultModal"
import { sendMessage, testTelegramTopicConnection } from "./lib-telegram"
import { testDiscordConnection, testDiscordThread } from "./lib-discord"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type View = "capture" | "settings" | "help"

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SidePanel() {
  const [view, setView] = useState<View>("capture")

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

  return view === "settings" ? (
    <SettingsView onBack={() => setView("capture")} onHelp={() => setView("help")} />
  ) : view === "help" ? (
    <HelpView onBack={() => setView("settings")} />
  ) : (
    <CaptureView onSettings={() => setView("settings")} />
  )
}

// ---------------------------------------------------------------------------
// Capture View
// ---------------------------------------------------------------------------

type CaptureState = "idle" | "capturing" | "captured" | "sending"
type CaptureViewMode = "grid" | "textarea" | "form"

function CaptureView({
  onSettings,
}: {
  onSettings: () => void
}) {
  // Core state
  const [captureState, setCaptureState] = useState<CaptureState>("idle")
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<{ success: boolean; error?: string } | null>(null)

  // Template state
  const [mode, setMode] = useState<CaptureViewMode>("grid")
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [isCustom, setIsCustom] = useState(false)
  const [caption, setCaption] = useState("")

  // Channel state (Send UI)
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelsLoading, setChannelsLoading] = useState(true)

  // Selection state (AD-7.2)
  const [selectedChannels, setSelectedChannels] = useState<Set<number>>(new Set())
  const [selectedSubEntities, setSelectedSubEntities] = useState<Set<string>>(new Set())

  // Multi-channel send result state (Phase 8)
  const [sendResults, setSendResults] = useState<SendTargetResult[] | null>(null)
  const [showSendResultModal, setShowSendResultModal] = useState(false)

  // Channel D&D state
  const [channelDragActiveId, setChannelDragActiveId] = useState<number | null>(null)

  // Load templates on mount
  useEffect(() => {
    getTemplates().then(setTemplates)
  }, [])

  // Load channels on mount (sorted by sendOrder)
  useEffect(() => {
    getChannelsSortedBySendOrder().then((ch) => {
      setChannels(ch)
      setChannelsLoading(false)
    })
  }, [])

  // Auto-dismiss send result after 5 seconds
  useEffect(() => {
    if (!sendResult) return
    const timer = setTimeout(() => setSendResult(null), 5000)
    return () => clearTimeout(timer)
  }, [sendResult])

  // Auto-dismiss error message after 5 seconds
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 5000)
    return () => clearTimeout(timer)
  }, [error])

  // -----------------------------------------------------------------------
  // Selection Helpers (AD-7.2)
  // -----------------------------------------------------------------------

  const handleToggleChannel = useCallback((channelId: number) => {
    setSelectedChannels((prev) => {
      const next = new Set(prev)
      if (next.has(channelId)) {
        next.delete(channelId)
      } else {
        next.add(channelId)
      }
      return next
    })
  }, [])

  const handleToggleSubEntity = useCallback((channelId: number, subEntityId: number) => {
    const key = `${channelId}:${subEntityId}`
    setSelectedSubEntities((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const clearSelections = useCallback(() => {
    setSelectedChannels(new Set())
    setSelectedSubEntities(new Set())
  }, [])

  const totalSelectedCount = selectedChannels.size + selectedSubEntities.size

  // -----------------------------------------------------------------------
  // Shortcut Capture Listener (Opt+S)
  // -----------------------------------------------------------------------

  useEffect(() => {
    const listener = (message: { type: string; dataUrl?: string; cropped?: boolean }) => {
      if (message.type === MESSAGE_TYPES.SHORTCUT_CAPTURE && message.dataUrl) {
        getTemplates().then(setTemplates)

        setScreenshotUrl(message.dataUrl)
        setCaptureState("captured")
        setError(null)
        setSendResult(null)
        setMode("grid")
        setSelectedTemplateId(null)
        setIsCustom(false)
        setCaption("")
        clearSelections()
        // Reload channels in case they changed in Settings
        getChannelsSortedBySendOrder().then(setChannels)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [clearSelections])

  const handleCapture = useCallback(async () => {
    setCaptureState("capturing")
    setError(null)
    setSendResult(null)
    clearSelections()

    try {
      const response = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CAPTURE_SCREENSHOT,
      })) as CaptureResponse

      if (response.success) {
        setScreenshotUrl(response.dataUrl)
        setCaptureState("captured")
        setMode("grid")
      } else {
        setError(response.error)
        setCaptureState("idle")
      }
    } catch {
      setError("Failed to capture screenshot")
      setCaptureState("idle")
    }
  }, [clearSelections])

  // -----------------------------------------------------------------------
  // Handle Send (Phase 8: multi-channel send to all selected targets)
  // -----------------------------------------------------------------------

  const handleSend = useCallback(async () => {
    if (!screenshotUrl || totalSelectedCount === 0) return

    setCaptureState("sending")
    setSendResult(null)
    setShowSendResultModal(false)

    // Build SendTarget[] from selection state
    const targets: SendTarget[] = []

    // Main channel selections (selectedChannels contains channel IDs)
    for (const channelId of selectedChannels) {
      targets.push({ channelId })
    }

    // Sub-entity selections (selectedSubEntities contains "channelId:subEntityConfigId" keys)
    for (const key of selectedSubEntities) {
      const [chIdStr, subIdStr] = key.split(":")
      const channelId = parseInt(chIdStr, 10)
      const channel = channels.find((ch) => ch.id === channelId)
      if (!channel) continue

      targets.push({
        channelId,
        subTargetType: channel.type === "telegram" ? ("topic" as const) : ("thread" as const),
        subTargetId: subIdStr,
      })
    }

    try {
      const response = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SEND_MULTI_CHANNEL,
        dataUrl: screenshotUrl,
        caption: caption || undefined,
        targets,
      })) as SendMultiChannelResponse

      const allSuccess = response.results.every((r) => r.success)

      if (allSuccess) {
        // All targets succeeded — reset capture state + show toast
        setSendResult({ success: true })
        setScreenshotUrl(null)
        setCaptureState("idle")
        setMode("grid")
        setSelectedTemplateId(null)
        setIsCustom(false)
        setCaption("")
        clearSelections()
      } else {
        // At least one target failed — show result modal
        setSendResults(response.results)
        setShowSendResultModal(true)
        setCaptureState("captured")
      }
    } catch {
      setSendResult({ success: false, error: "Failed to send" })
      setCaptureState("captured")
    }
  }, [
    screenshotUrl,
    caption,
    totalSelectedCount,
    selectedChannels,
    selectedSubEntities,
    channels,
    clearSelections,
  ])

  const handleCancel = useCallback(() => {
    setScreenshotUrl(null)
    setError(null)
    setSendResult(null)
    setCaptureState("idle")
    setMode("grid")
    setSelectedTemplateId(null)
    setIsCustom(false)
    setCaption("")
    clearSelections()
  }, [clearSelections])

  // Create new template from form
  const handleCreateTemplate = useCallback(async (name: string, body: string) => {
    await createTemplate(name, body)
    const updated = await getTemplates()
    setTemplates(updated)
    setMode("grid")
  }, [])

  // -----------------------------------------------------------------------
  // Sub-entity helper
  // -----------------------------------------------------------------------

  const getSubEntitiesForSend = useCallback(
    (channel: Channel): Array<{ id: number; name: string }> => {
      if (channel.type === "telegram") {
        const creds = channel.credentials as TelegramCredentials
        return creds.topics
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((t) => ({ id: t.id, name: t.name }))
      } else {
        const creds = channel.credentials as DiscordCredentials
        return creds.threads
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((t) => ({ id: t.id, name: t.name }))
      }
    },
    []
  )

  // -----------------------------------------------------------------------
  // Channel-Level D&D (Step 9)
  // -----------------------------------------------------------------------

  const channelSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const handleChannelDragStart = useCallback((event: { active: { id: number } }) => {
    setChannelDragActiveId(event.active.id)
  }, [])

  const handleChannelDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setChannelDragActiveId(null)

      if (!over || active.id === over.id) return

      const oldIndex = channels.findIndex((ch) => ch.id === active.id)
      const newIndex = channels.findIndex((ch) => ch.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(channels, oldIndex, newIndex)
      setChannels(reordered)

      // Persist new sendOrder
      const sortedIds = reordered.map((ch) => ch.id)
      await updateChannelSendOrder(sortedIds)
    },
    [channels]
  )

  // -----------------------------------------------------------------------
  // Sub-Entity-Level D&D (Step 10)
  // -----------------------------------------------------------------------

  const handleSubEntityDragEnd = useCallback(
    async (channelId: number, event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const channel = channels.find((ch) => ch.id === channelId)
      if (!channel) return

      const type: "topic" | "thread" = channel.type === "telegram" ? "topic" : "thread"
      const creds = channel.credentials as TelegramCredentials | DiscordCredentials
      const subEntities =
        type === "topic"
          ? (creds as TelegramCredentials).topics
          : (creds as DiscordCredentials).threads

      const oldIndex = subEntities.findIndex((s) => s.id === active.id)
      const newIndex = subEntities.findIndex((s) => s.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(subEntities, oldIndex, newIndex)
      const sortedIds = reordered.map((s) => s.id)

      // Persist new order
      await updateSubEntityOrder(channelId, sortedIds, type)

      // Refresh channels to get updated order
      const updated = await getChannelsSortedBySendOrder()
      setChannels(updated)
    },
    [channels]
  )

  return (
    <main style={{ ...s.container, position: "relative" }}>
      {/* Fixed: Header */}
      <div style={s.header}>
        <h1 style={s.title}>TV Capture</h1>
        <button
          style={s.navButton}
          onClick={onSettings}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = "#2c3038"
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = "transparent"
          }}
        >
          Settings
        </button>
      </div>

      {/* Fixed: Screenshot Preview */}
      <div style={{
        ...s.previewContainer,
        backgroundColor: screenshotUrl ? "transparent" : "rgba(40, 48, 56, 0.5)",
        minHeight: screenshotUrl ? "auto" : 200,
      }}>
        {screenshotUrl ? (
          <img
            src={screenshotUrl}
            style={s.previewImage}
            alt="Captured screenshot"
          />
        ) : (
          <div style={{
            ...s.placeholderBox,
            minHeight: 200,
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "center",
            justifyContent: "center",
          }}>
            <p style={s.placeholderTitle}>Screenshot Preview</p>
            <p style={s.placeholderSub}>
              {captureState === "idle"
                ? "Press Opt+S on TradingView or click Capture"
                : captureState === "capturing"
                  ? "Capturing..."
                  : "No screenshot captured"}
            </p>
          </div>
        )}
      </div>

      {/* Scrollable: Message + Channels */}
      <div style={s.scrollableContent}>
        {/* Message Section — always visible (OQ-1) */}
        <CollapsibleSection title="MESSAGE" defaultOpen={true}>
          {screenshotUrl ? (
            <>
              {/* Template Grid */}
              {mode === "grid" && (
                <div style={s.templateSection}>
                  <div style={s.tileRow}>
                    <TemplateTile
                      name="Custom"
                      isSelected={isCustom && mode !== "grid"}
                      onClick={() => {
                        setIsCustom(true)
                        setSelectedTemplateId(null)
                        setCaption("")
                        setMode("textarea")
                      }}
                    />
                    <TemplateTile
                      name="New Template"
                      onClick={() => {
                        setMode("form")
                      }}
                    />
                  </div>

                  {templates.length > 0 && (
                    <div style={s.templateGrid}>
                      {templates.map((template) => (
                        <TemplateTile
                          key={template.id}
                          name={template.name}
                          isSelected={selectedTemplateId === template.id}
                          onClick={() => {
                            setIsCustom(false)
                            setSelectedTemplateId(template.id)
                            setCaption(template.body)
                            setMode("textarea")
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Textarea */}
              {mode === "textarea" && (
                <div style={s.textareaSection}>
                  <div style={s.tileRow}>
                    <TemplateTile
                      name={isCustom ? "Custom" : templates.find((t) => t.id === selectedTemplateId)?.name || ""}
                      isSelected={true}
                      onClick={() => {}}
                    />
                    <TemplateTile
                      name="View All"
                      onClick={() => {
                        setMode("grid")
                        setSelectedTemplateId(null)
                        setIsCustom(false)
                      }}
                    />
                  </div>

                  <div style={s.textareaContainer}>
                    <textarea
                      style={caption.length > 1024 ? s.textareaError : s.textarea}
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Type your caption..."
                      maxLength={1024}
                      rows={6}
                      onFocus={(e) => {
                        if (caption.length <= 1024) {
                          (e.target as HTMLTextAreaElement).style.borderColor = "#0d9488"
                        }
                      }}
                      onBlur={(e) => {
                        if (caption.length <= 1024) {
                          (e.target as HTMLTextAreaElement).style.borderColor = "#3a3f4a"
                        }
                      }}
                    />
                    <div style={caption.length <= 1024 ? s.counter : s.counterError}>
                      {caption.length}/1024 characters
                    </div>
                  </div>
                </div>
              )}

              {/* Form View */}
              {mode === "form" && (
                <div style={s.formSection}>
                  <TemplateForm
                    mode="create"
                    onSave={handleCreateTemplate}
                    onCancel={() => {
                      setMode("grid")
                    }}
                  />
                </div>
              )}
            </>
          ) : (
            <div style={s.messagePlaceholder}>
              <p style={s.messagePlaceholderIcon}>📸</p>
              <p style={s.messagePlaceholderText}>Please take a screenshot first</p>
            </div>
          )}
        </CollapsibleSection>

        {/* CHANNELS Section */}
        <CollapsibleSection title="CHANNELS" defaultOpen={true}>
          {channelsLoading ? (
            <p style={s.loadingText}>Loading channels...</p>
          ) : channels.length === 0 ? (
            <>
              <p style={s.emptyText}>No channels configured</p>
              <p style={s.emptySubText}>
                Add channels in{" "}
                <span
                  style={{ color: "#14b8a6", cursor: "pointer", textDecoration: "underline" }}
                  onClick={() => onSettings()}
                >
                  Settings
                </span>
              </p>
            </>
          ) : (
            <>
              <DndContext
                sensors={channelSensors}
                collisionDetection={closestCenter}
                onDragStart={handleChannelDragStart}
                onDragEnd={handleChannelDragEnd}
              >
                <SortableContext
                  items={channels.map((ch) => ch.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {channels.map((channel) => {
                    const subEntities = getSubEntitiesForSend(channel)
                    const subEntityIds = subEntities.map((s) => s.id)
                    return (
                      <SortableSendChannelCard
                        key={channel.id}
                        channel={channel}
                        selected={selectedChannels.has(channel.id)}
                        onToggleMain={() => handleToggleChannel(channel.id)}
                        selectedSubEntities={selectedSubEntities}
                        onToggleSubEntity={handleToggleSubEntity}
                        subEntities={subEntities}
                        subEntityIds={subEntityIds}
                        onSubEntityDragEnd={handleSubEntityDragEnd}
                        dragActiveId={channelDragActiveId}
                      />
                    )
                  })}
                </SortableContext>
              </DndContext>
            </>
          )}

          {/* + Add Channel shortcut */}
          <button
            style={s.addChannelShortcut}
            onClick={() => onSettings()}
          >
            + Add Channel
          </button>
        </CollapsibleSection>
      </div>

      {/* Fixed: Bottom Button Bar */}
      <div style={s.bottomBar}>
        {captureState === "idle" && !screenshotUrl && (
          <button
            style={s.captureButton}
            onClick={handleCapture}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = "#14b8a6"
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = "#0d9488"
            }}
          >
            Capture
          </button>
        )}

        {captureState === "capturing" && (
          <button style={s.buttonLoading} disabled>Capturing...</button>
        )}

        {captureState === "captured" && screenshotUrl && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={totalSelectedCount > 0 ? s.sendButton : s.sendButtonDisabled}
              disabled={totalSelectedCount === 0 || captureState === "sending"}
              onClick={handleSend}
              onMouseEnter={(e) => {
                if (totalSelectedCount > 0) {
                  (e.target as HTMLButtonElement).style.backgroundColor = "#059669"
                }
              }}
              onMouseLeave={(e) => {
                if (totalSelectedCount > 0) {
                  (e.target as HTMLButtonElement).style.backgroundColor = "#10b981"
                }
              }}
            >
              {captureState === "sending"
                ? "Sending..."
                : `SEND TO SELECTED (${totalSelectedCount})`}
            </button>
            <button
              style={s.cancelButton}
              onClick={handleCancel}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = "#2c3038"
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = "transparent"
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Toast-like messages — absolute positioned */}
      {(error || sendResult) && (
        <div style={{
          position: "absolute",
          bottom: 60,
          left: 16,
          right: 16,
          zIndex: 1000,
        }}>
          {error && <div style={s.errorMessage}>{error}</div>}
          {sendResult && (
            <div style={sendResult.success ? s.sendSuccess : s.sendError}>
              {sendResult.success
                ? `Sent to ${totalSelectedCount} target${totalSelectedCount !== 1 ? "s" : ""}`
                : sendResult.error}
            </div>
          )}
        </div>
      )}

      {/* Send Result Modal (Phase 8 — shown on partial/complete failure) */}
      {showSendResultModal && sendResults && (
        <SendResultModal
          results={sendResults}
          channels={channels}
          onClose={() => {
            setShowSendResultModal(false)
            setSendResults(null)
          }}
        />
      )}
    </main>
  )
}

// ---------------------------------------------------------------------------
// SortableSendChannelCard — sortable wrapper for channel-level D&D
// ---------------------------------------------------------------------------

function SortableSendChannelCard({
  channel,
  selected,
  onToggleMain,
  selectedSubEntities,
  onToggleSubEntity,
  subEntities,
  subEntityIds,
  onSubEntityDragEnd,
  dragActiveId,
}: {
  channel: Channel
  selected: boolean
  onToggleMain: () => void
  selectedSubEntities: Set<string>
  onToggleSubEntity: (channelId: number, subEntityId: number) => void
  subEntities: Array<{ id: number; name: string }>
  subEntityIds: number[]
  onSubEntityDragEnd: (channelId: number, event: DragEndEvent) => void
  dragActiveId: number | null
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: channel.id })

  const isOtherDragging = dragActiveId !== null && dragActiveId !== channel.id && !isDragging

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isOtherDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <SendChannelCard
        channel={channel}
        selected={selected}
        onToggleMain={onToggleMain}
        selectedSubEntities={selectedSubEntities}
        onToggleSubEntity={onToggleSubEntity}
        subEntities={subEntities}
        subEntityIds={subEntityIds}
        dragHandleProps={{ attributes, listeners }}
        onSubEntityDragEnd={onSubEntityDragEnd}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings View
// ---------------------------------------------------------------------------

function SettingsView({
  onBack,
  onHelp,
}: {
  onBack: () => void
  onHelp: () => void
}) {
  // Channel state
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)

  // Add form state — one form at a time (AD-6.6)
  const [activeFormId, setActiveFormId] = useState<string | null>(null)

  // Inline add channel form fields
  const [addFormName, setAddFormName] = useState("")
  const [addFormToken, setAddFormToken] = useState("")
  const [addFormChatId, setAddFormChatId] = useState("")
  const [addFormWebhookUrl, setAddFormWebhookUrl] = useState("")

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    channelId: number
    subEntityCount: number
  } | null>(null)

  // Toast state
  const [toast, setToast] = useState<string | null>(null)

  // Topic ID 1 blocking modal state
  const [topicId1Modal, setTopicId1Modal] = useState(false)

  // Test button states — per entity
  const [testStates, setTestStates] = useState<
    Record<string, "idle" | "loading" | "success" | "error">
  >({})

  // Template state (unchanged)
  const [templates, setTemplates] = useState<Template[]>([])
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  // Drag & Drop state
  const [dragActiveId, setDragActiveId] = useState<number | null>(null)

  // Drag & Drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  // Load channels on mount
  useEffect(() => {
    getChannels().then((ch) => {
      setChannels(ch)
      setLoading(false)
    })
  }, [])

  // Load templates
  useEffect(() => {
    getTemplates().then(setTemplates)
  }, [])

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  // Refresh channels after mutation
  const refreshChannels = useCallback(async () => {
    const updated = await getChannels()
    setChannels(updated)
  }, [])

  // Split channels by platform
  const telegramChannels = channels.filter((ch) => ch.type === "telegram")
  const discordChannels = channels.filter((ch) => ch.type === "discord")

  // -----------------------------------------------------------------------
  // Drag & Drop handlers (templates — unchanged)
  // -----------------------------------------------------------------------

  const handleDragStart = useCallback((event: { active: { id: number } }) => {
    setDragActiveId(event.active.id)
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event

      setDragActiveId(null)

      if (!over || active.id === over.id) {
        return
      }

      const oldIndex = templates.findIndex((t) => t.id === active.id)
      const newIndex = templates.findIndex((t) => t.id === over.id)

      if (oldIndex === -1 || newIndex === -1) {
        return
      }

      const newTemplates = arrayMove(templates, oldIndex, newIndex)
      setTemplates(newTemplates)

      const sortedIds = newTemplates.map((t) => t.id)
      await updateTemplateOrder(sortedIds)
    },
    [templates]
  )

  // -----------------------------------------------------------------------
  // Channel Handlers
  // -----------------------------------------------------------------------

  // Add channel — toggle inline add form
  const handleToggleAddForm = (type: "telegram" | "discord") => {
    const formId = `add-${type}`
    if (activeFormId === formId) {
      setActiveFormId(null)
    } else {
      // Close any other open form (sub-entity forms, etc.)
      setActiveFormId(formId)
      // Reset form fields
      setAddFormName("")
      setAddFormToken("")
      setAddFormChatId("")
      setAddFormWebhookUrl("")
    }
  }

  // Create channel — submit
  const handleCreateChannel = async (
    type: "telegram" | "discord"
  ) => {
    if (!addFormName.trim()) return

    let credentials: ChannelCredentials

    if (type === "telegram") {
      credentials = {
        type: "telegram",
        botToken: addFormToken.trim(),
        chatId: addFormChatId.trim(),
        topics: [],
      }
    } else {
      credentials = {
        type: "discord",
        webhookUrl: addFormWebhookUrl.trim(),
        threads: [],
      }
    }

    await createChannel(addFormName.trim(), type, credentials)
    await refreshChannels()
    setActiveFormId(null)
  }

  // Remove channel — check sub-entities first
  const handleRemoveChannel = (channelId: number, hasSubEntities: boolean) => {
    if (hasSubEntities) {
      const channel = channels.find((ch) => ch.id === channelId)
      if (!channel) return
      const creds = channel.credentials
      const count =
        creds.type === "telegram"
          ? (creds as TelegramCredentials).topics.length
          : (creds as DiscordCredentials).threads.length
      setDeleteConfirm({ channelId, subEntityCount: count })
    } else {
      handleDeleteChannel(channelId)
    }
  }

  // Delete channel — confirmed
  const handleDeleteChannel = async (channelId: number) => {
    await deleteChannel(channelId)
    await refreshChannels()
    setDeleteConfirm(null)
  }

  // Test connectivity — main channel
  const handleTestConnectivity = async (channelId: number) => {
    const key = `ch-${channelId}`
    setTestStates((prev) => ({ ...prev, [key]: "loading" }))
    try {
      const channel = channels.find((ch) => ch.id === channelId)
      if (!channel) {
        setTestStates((prev) => ({ ...prev, [key]: "error" }))
        return
      }

      let result
      if (channel.type === "telegram") {
        const creds = channel.credentials as TelegramCredentials
        result = await sendMessage(creds.botToken, creds.chatId, "✅ TV Capture test message — " + channel.name)
      } else {
        const creds = channel.credentials as DiscordCredentials
        result = await testDiscordConnection(creds.webhookUrl, channel.name)
      }

      setTestStates((prev) => ({
        ...prev,
        [key]: result.success ? "success" : "error",
      }))
    } catch {
      setTestStates((prev) => ({ ...prev, [key]: "error" }))
    }
    setTimeout(() => {
      setTestStates((prev) => ({ ...prev, [key]: "idle" }))
    }, 3000)
  }

  // Update channel — name or credentials
  const handleUpdateChannel = async (
    channelId: number,
    updates: ChannelUpdate
  ) => {
    await updateChannel(channelId, updates)
    await refreshChannels()
  }

  // Add topic
  const handleAddTopic = (channelId: number) => {
    setActiveFormId(`topic-${channelId}`)
  }

  // Add topic — submit (called from TopicAddForm)
  const handleTopicAdd = async (
    channelId: number,
    name: string,
    topicId: string
  ) => {
    await addTopicToChannel(channelId, name, topicId)
    await refreshChannels()
    setActiveFormId(null)
  }

  // Remove topic — immediate, no confirmation
  const handleRemoveTopic = async (
    channelId: number,
    topicConfigId: number
  ) => {
    await removeTopicFromChannel(channelId, topicConfigId)
    await refreshChannels()
  }

  // Test topic — sends test message to specific Telegram topic
  const handleTestTopic = async (
    channelId: number,
    topicConfigId: number
  ) => {
    const key = `topic-${channelId}-${topicConfigId}`
    setTestStates((prev) => ({ ...prev, [key]: "loading" }))
    try {
      const channel = channels.find((ch) => ch.id === channelId)
      if (!channel || channel.type !== "telegram") {
        setTestStates((prev) => ({ ...prev, [key]: "error" }))
        return
      }

      const creds = channel.credentials as TelegramCredentials
      const topic = creds.topics.find((t) => t.id === topicConfigId)
      if (!topic) {
        setTestStates((prev) => ({ ...prev, [key]: "error" }))
        return
      }

      const result = await testTelegramTopicConnection(
        creds.botToken,
        creds.chatId,
        parseInt(topic.topicId, 10),
        topic.name
      )

      setTestStates((prev) => ({
        ...prev,
        [key]: result.success ? "success" : "error",
      }))
    } catch {
      setTestStates((prev) => ({ ...prev, [key]: "error" }))
    }
    setTimeout(() => {
      setTestStates((prev) => ({ ...prev, [key]: "idle" }))
    }, 3000)
  }

  // Add thread
  const handleAddThread = (channelId: number) => {
    setActiveFormId(`thread-${channelId}`)
  }

  // Add thread — submit (called from ThreadAddForm)
  const handleThreadAdd = async (
    channelId: number,
    name: string,
    threadId: string
  ) => {
    await addThreadToChannel(channelId, name, threadId)
    await refreshChannels()
    setActiveFormId(null)
  }

  // Remove thread — immediate, no confirmation
  const handleRemoveThread = async (
    channelId: number,
    threadConfigId: number
  ) => {
    await removeThreadFromChannel(channelId, threadConfigId)
    await refreshChannels()
  }

  // Test thread — sends test message to specific Discord thread
  const handleTestThread = async (
    channelId: number,
    threadConfigId: number
  ) => {
    const key = `thread-${channelId}-${threadConfigId}`
    setTestStates((prev) => ({ ...prev, [key]: "loading" }))
    try {
      const channel = channels.find((ch) => ch.id === channelId)
      if (!channel || channel.type !== "discord") {
        setTestStates((prev) => ({ ...prev, [key]: "error" }))
        return
      }

      const creds = channel.credentials as DiscordCredentials
      const thread = creds.threads.find((t) => t.id === threadConfigId)
      if (!thread) {
        setTestStates((prev) => ({ ...prev, [key]: "error" }))
        return
      }

      const result = await testDiscordThread(
        creds.webhookUrl,
        thread.threadId,
        thread.name
      )

      setTestStates((prev) => ({
        ...prev,
        [key]: result.success ? "success" : "error",
      }))
    } catch {
      setTestStates((prev) => ({ ...prev, [key]: "error" }))
    }
    setTimeout(() => {
      setTestStates((prev) => ({ ...prev, [key]: "idle" }))
    }, 3000)
  }

  // -----------------------------------------------------------------------
  // Template handlers (unchanged)
  // -----------------------------------------------------------------------

  const handleCreateTemplate = async (name: string, body: string) => {
    await createTemplate(name, body)
    const updated = await getTemplates()
    setTemplates(updated)
    setShowTemplateForm(false)
  }

  const handleUpdateTemplate = async (name: string, body: string) => {
    if (!editingTemplate) return
    await updateTemplate(editingTemplate.id, name, body)
    const updated = await getTemplates()
    setTemplates(updated)
    setEditingTemplate(null)
    setShowTemplateForm(false)
  }

  const handleDeleteTemplate = async (id: number) => {
    await deleteTemplate(id)
    const updated = await getTemplates()
    setTemplates(updated)
    setDeleteConfirmId(null)
  }

  const handleEditTemplate = (id: number) => {
    const template = templates.find((t) => t.id === id)
    if (template) {
      setEditingTemplate(template)
      setShowTemplateForm(true)
    }
  }

  // Loading state
  if (loading) {
    return (
      <main style={s.settingsContainer}>
        <p style={{ color: "#9ca3af" }}>Loading settings...</p>
      </main>
    )
  }

  return (
    <main style={s.settingsContainer}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>Settings</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={s.navButton}
            onClick={onHelp}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = "#2c3038"
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = "transparent"
            }}
          >
            Help
          </button>
          <button
            style={s.navButton}
            onClick={onBack}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = "#2c3038"
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = "transparent"
            }}
          >
            Back
          </button>
        </div>
      </div>

      {/* Telegram Channels Section */}
      <CollapsibleSection title="TELEGRAM CHANNELS" defaultOpen={true}>
        {telegramChannels.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            testStates={testStates}
            onTestConnectivity={handleTestConnectivity}
            onRemoveChannel={handleRemoveChannel}
            onAddTopic={handleAddTopic}
            onRemoveTopic={handleRemoveTopic}
            onTestTopic={handleTestTopic}
            onAddThread={() => {}}
            onRemoveThread={() => {}}
            onTestThread={() => {}}
            onUpdateChannel={handleUpdateChannel}
            onTopicAdd={handleTopicAdd}
            onThreadAdd={handleThreadAdd}
            onToast={setToast}
            onTopicId1Blocked={() => {
              setTopicId1Modal(true)
              setActiveFormId(null)
            }}
            onRefresh={refreshChannels}
            activeFormId={activeFormId}
            setActiveFormId={setActiveFormId}
          />
        ))}

        {/* Inline add Telegram channel form */}
        {activeFormId === "add-telegram" ? (
          <div style={s.inlineForm}>
            <div style={s.field}>
              <label style={s.label}>Channel Name</label>
              <input
                style={s.input}
                placeholder="e.g. Main Trading Group"
                value={addFormName}
                onChange={(e) => setAddFormName(e.target.value)}
                onFocus={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#0d9488"
                }}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Bot Token</label>
              <input
                type="password"
                style={s.input}
                placeholder="e.g. 123456:ABC-DEF..."
                value={addFormToken}
                onChange={(e) => setAddFormToken(e.target.value)}
                onFocus={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#0d9488"
                }}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Chat ID</label>
              <input
                style={s.input}
                placeholder="e.g. -1001234567890"
                value={addFormChatId}
                onChange={(e) => setAddFormChatId(e.target.value)}
                onFocus={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#0d9488"
                }}
              />
            </div>
            <div style={s.inlineFormButtons}>
              <button
                style={
                  addFormName.trim() && addFormToken.trim() && addFormChatId.trim()
                    ? s.addChannelButton
                    : s.addChannelButtonDisabled
                }
                disabled={
                  !addFormName.trim() || !addFormToken.trim() || !addFormChatId.trim()
                }
                onClick={() => handleCreateChannel("telegram")}
              >
                Add
              </button>
              <button
                style={s.inlineCancelButton}
                onClick={() => setActiveFormId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            style={s.addButton}
            onClick={() => handleToggleAddForm("telegram")}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = "rgba(13, 148, 136, 0.15)"
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = "transparent"
            }}
          >
            + Add Telegram Channel
          </button>
        )}
      </CollapsibleSection>

      {/* Discord Channels Section */}
      <CollapsibleSection title="DISCORD CHANNELS" defaultOpen={true}>
        {discordChannels.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            testStates={testStates}
            onTestConnectivity={handleTestConnectivity}
            onRemoveChannel={handleRemoveChannel}
            onAddTopic={() => {}}
            onRemoveTopic={() => {}}
            onTestTopic={() => {}}
            onAddThread={handleAddThread}
            onRemoveThread={handleRemoveThread}
            onTestThread={handleTestThread}
            onUpdateChannel={handleUpdateChannel}
            onTopicAdd={handleTopicAdd}
            onThreadAdd={handleThreadAdd}
            onToast={setToast}
            onTopicId1Blocked={() => {
              setTopicId1Modal(true)
              setActiveFormId(null)
            }}
            onRefresh={refreshChannels}
            activeFormId={activeFormId}
            setActiveFormId={setActiveFormId}
          />
        ))}

        {/* Inline add Discord channel form */}
        {activeFormId === "add-discord" ? (
          <div style={s.inlineForm}>
            <div style={s.field}>
              <label style={s.label}>Channel Name</label>
              <input
                style={s.input}
                placeholder="e.g. Trading Signals"
                value={addFormName}
                onChange={(e) => setAddFormName(e.target.value)}
                onFocus={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#0d9488"
                }}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Webhook URL</label>
              <input
                type="password"
                style={s.input}
                placeholder="https://discord.com/api/webhooks/..."
                value={addFormWebhookUrl}
                onChange={(e) => setAddFormWebhookUrl(e.target.value)}
                onFocus={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#0d9488"
                }}
              />
            </div>
            <div style={s.inlineFormButtons}>
              <button
                style={
                  addFormName.trim() && addFormWebhookUrl.trim()
                    ? s.addChannelButton
                    : s.addChannelButtonDisabled
                }
                disabled={!addFormName.trim() || !addFormWebhookUrl.trim()}
                onClick={() => handleCreateChannel("discord")}
              >
                Add
              </button>
              <button
                style={s.inlineCancelButton}
                onClick={() => setActiveFormId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            style={s.addButton}
            onClick={() => handleToggleAddForm("discord")}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = "rgba(13, 148, 136, 0.15)"
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = "transparent"
            }}
          >
            + Add Discord Channel
          </button>
        )}
      </CollapsibleSection>

      {/* Keyboard Shortcuts Section */}
      <CollapsibleSection title="Keyboard Shortcuts">
        <div style={s.shortcutRow}>
          <kbd style={s.kbd}>Opt</kbd>
          <span style={s.shortcutPlus}>+</span>
          <kbd style={s.kbd}>S</kbd>
          <span style={s.shortcutLabel}>Capture chart</span>
        </div>

        <p style={s.shortcutHint}>
          Works on TradingView charts. The chart area is auto-detected and cropped.
        </p>

        <button
          style={s.shortcutLink}
          onClick={() => chrome.tabs.create({ url: "chrome://extensions/shortcuts" })}
        >
          Change shortcut in Chrome settings
        </button>
      </CollapsibleSection>

      {/* Templates Section */}
      <CollapsibleSection title="Templates" defaultOpen={false}>
        {showTemplateForm ? (
          <TemplateForm
            mode={editingTemplate ? "edit" : "create"}
            initialName={editingTemplate?.name}
            initialBody={editingTemplate?.body}
            onSave={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
            onCancel={() => {
              setShowTemplateForm(false)
              setEditingTemplate(null)
            }}
          />
        ) : (
          <>
            {templates.length > 1 && (
              <p style={s.hintText}>
                Drag and hold template to reorder
              </p>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={templates.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {templates.map((template) => (
                  <SortableTemplateItem
                    key={template.id}
                    template={template}
                    onEdit={handleEditTemplate}
                    onDelete={(id) => setDeleteConfirmId(id)}
                    activeId={dragActiveId}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <button
              style={s.addButton}
              onClick={() => setShowTemplateForm(true)}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = "rgba(13, 148, 136, 0.15)"
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = "transparent"
              }}
            >
              Add Template
            </button>
          </>
        )}
      </CollapsibleSection>

      {/* Delete Confirmation for Templates (unchanged) */}
      {deleteConfirmId && (
        <div style={s.overlay}>
          <div style={s.popup}>
            <p style={s.popupTitle}>Delete template?</p>
            <p style={s.popupText}>This cannot be undone.</p>
            <div style={s.popupButtons}>
              <button
                style={s.popupCancelButton}
                onClick={() => setDeleteConfirmId(null)}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = "#2c3038"
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = "transparent"
                }}
              >
                Cancel
              </button>
              <button
                style={s.popupDeleteButton}
                onClick={() => handleDeleteTemplate(deleteConfirmId)}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = "#dc2626"
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = "#ef4444"
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog for Channels */}
      {deleteConfirm && (
        <ConfirmDialog
          title="Delete channel?"
          message={`This channel contains ${deleteConfirm.subEntityCount} ${deleteConfirm.subEntityCount === 1 ? "topic/thread" : "topics/threads"}. Delete anyway?`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={() => handleDeleteChannel(deleteConfirm.channelId)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* Topic ID 1 Blocking Modal */}
      {topicId1Modal && (
        <ConfirmDialog
          title="Topic ID 1 is not allowed"
          message="This Share Link points to the General topic of your Telegram channel. The main channel is already part of your configuration — messages sent without selecting a specific topic arrive there automatically. Please use a Share Link from a custom topic (ID 2+)."
          confirmLabel="OK"
          destructive={false}
          onConfirm={() => setTopicId1Modal(false)}
          onCancel={() => setTopicId1Modal(false)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={s.toast}>
          {toast}
        </div>
      )}

      {/* Branding */}
      <div style={s.branding}>
        By Mazi Labs
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Help View — Setup Guide (Telegram, Discord, Telegram Topics)
// ---------------------------------------------------------------------------

function HelpView({
  onBack,
}: {
  onBack: () => void
}) {
  const [helpTab, setHelpTab] = useState<"telegram" | "discord" | "topics">("telegram")

  const styles: Record<string, React.CSSProperties> = {
    tabBar: {
      display: "flex",
      gap: 4,
      marginBottom: 16,
      borderBottom: "1px solid #3a3f4a",
      paddingBottom: 0,
    },
    tab: {
      padding: "8px 12px",
      border: "none",
      borderRadius: "6px 6px 0 0",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      backgroundColor: "transparent",
      color: "#6b7280",
      transition: "all 150ms",
    },
    tabActive: {
      padding: "8px 12px",
      border: "none",
      borderRadius: "6px 6px 0 0",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      backgroundColor: "#252830",
      color: "#14b8a6",
      borderBottom: "2px solid #0d9488",
    },
  }

  return (
    <main style={s.settingsContainer}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>Setup Guide</h1>
        <button
          style={s.closeButton}
          onClick={onBack}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = "#2c3038"
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = "transparent"
          }}
        >
          ✕
        </button>
      </div>

      {/* Navigation Tabs */}
      <div style={styles.tabBar}>
        <button
          style={helpTab === "telegram" ? styles.tabActive : styles.tab}
          onClick={() => setHelpTab("telegram")}
        >
          Telegram
        </button>
        <button
          style={helpTab === "discord" ? styles.tabActive : styles.tab}
          onClick={() => setHelpTab("discord")}
        >
          Discord
        </button>
        <button
          style={helpTab === "topics" ? styles.tabActive : styles.tab}
          onClick={() => setHelpTab("topics")}
        >
          Topics
        </button>
      </div>

      {/* Help Content */}
      <div style={s.helpContent}>
        {/* ================================================================ */}
        {/* TELEGRAM SETUP */}
        {/* ================================================================ */}
        {helpTab === "telegram" && (
          <>
            {/* Step 1 */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>STEP 1: Create Your Bot</h2>
              <ol style={s.helpList}>
                <li>Open Telegram (app or web)</li>
                <li>Search for <strong>@BotFather</strong> (official Telegram bot)</li>
                <li>Send: <code style={s.code}>/start</code></li>
                <li>Send: <code style={s.code}>/newbot</code></li>
                <li>Enter a name for your bot (e.g. "TV Capture")</li>
                <li>Enter a username ending with "bot"<br/>
                  <span style={s.helpHint}>(e.g. "my_trading_bot" or "tvcapture_max_bot")</span>
                </li>
                <li><span style={s.helpSuccess}>✅ DONE!</span> BotFather returns your Bot Token</li>
              </ol>
              <div style={s.helpTip}>
                <p><strong>Your token looks like:</strong></p>
                <code style={s.codeBlock}>123456789:ABCdefGHIjklMNOpqrsTUVwxyz</code>
              </div>
              <p style={s.helpWarning}>
                ⚠️ Keep this token secret! If leaked, use <code style={s.code}>/revoke</code> in @BotFather
              </p>
            </div>

            {/* Step 2 */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>STEP 2: Get Your Chat ID</h2>
              <p style={s.helpText}>Choose ONE method below:</p>

              <div style={s.helpSubsection}>
                <h3 style={s.helpSubsectionTitle}>OPTION A: Personal Chat (Simplest)</h3>
                <ol style={s.helpList}>
                  <li>In Telegram, search for your new bot</li>
                  <li>Open the chat and send: <code style={s.code}>/start</code></li>
                  <li>Open this URL in your browser:<br/>
                    <code style={s.codeBlock}>api.telegram.org/bot{'<TOKEN>'}/getUpdates</code><br/>
                    <span style={s.helpHint}>(Replace {'<TOKEN>'} with your Bot Token)</span>
                  </li>
                  <li>You'll see JSON like this:</li>
                </ol>
                <pre style={s.jsonBlock}>{`{
  "ok": true,
  "result": [{
    "message": {
      "chat": {
        "id": 123456789
      }
    }
  }]
}`}</pre>
                <p style={s.helpText}>
                  <strong>5. Copy the "id" number</strong> (positive, e.g. 123456789)
                </p>
              </div>

              <div style={s.helpSubsection}>
                <h3 style={s.helpSubsectionTitle}>OPTION B: Group Chat</h3>
                <ol style={s.helpList}>
                  <li>Create a group in Telegram (or use existing)</li>
                  <li>Add your bot to the group<br/>
                    <span style={s.helpHint}>(Search for your bot's username, click "Add to Group")</span>
                  </li>
                </ol>
                <div style={s.helpWarning}>
                  <p><strong>⚠️ IMPORTANT: Disable Privacy Mode FIRST!</strong></p>
                </div>
                <ol style={s.helpList} start={3}>
                  <li>Open @BotFather</li>
                  <li>Send: <code style={s.code}>/mybots</code></li>
                  <li>Select your bot</li>
                  <li>Tap: Bot Settings → Group Privacy → <strong>DISABLE</strong></li>
                  <li>Confirmation: "Group privacy is disabled"</li>
                </ol>
                <ol style={s.helpList} start={8}>
                  <li>Go to your group and send any message (e.g. "test")</li>
                  <li>Open this URL in your browser:<br/>
                    <code style={s.codeBlock}>api.telegram.org/bot{'<TOKEN>'}/getUpdates</code>
                  </li>
                  <li>Find the group chat ID in the JSON:</li>
                </ol>
                <pre style={s.jsonBlock}>{`"chat": {
  "id": -1001234567890
}`}</pre>
                <p style={s.helpText}>
                  <strong>11. Copy the ID</strong> (NEGATIVE number, starts with -100)
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>STEP 3: Configure TV Capture</h2>
              <ol style={s.helpList}>
                <li>Copy your Bot Token into the <strong>"Bot Token"</strong> field</li>
                <li>Copy your Chat ID into the <strong>"Chat ID"</strong> field</li>
                <li>Click <strong>"Test Connectivity"</strong> to verify</li>
              </ol>
            </div>

            {/* Troubleshooting */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>Troubleshooting</h2>
              <div style={s.helpTroubleshoot}>
                <p><strong>"Unauthorized" or "Invalid token"</strong></p>
                <p style={s.helpHint}>→ Token is wrong. Copy again from @BotFather</p>
              </div>
              <div style={s.helpTroubleshoot}>
                <p><strong>"Chat not found"</strong></p>
                <p style={s.helpHint}>→ You never sent /start to your bot, or Chat ID is wrong</p>
              </div>
              <div style={s.helpTroubleshoot}>
                <p><strong>getUpdates shows empty result: []</strong></p>
                <p style={s.helpHint}>→ For groups: Privacy Mode is still enabled</p>
                <p style={s.helpHint}>→ Disable it in @BotFather (see Step 2, Option B)</p>
                <p style={s.helpHint}>→ Then send another message in the group</p>
              </div>
              <div style={s.helpTroubleshoot}>
                <p><strong>Messages not arriving</strong></p>
                <p style={s.helpHint}>→ Check token and chat ID are correct</p>
                <p style={s.helpHint}>→ Make sure you sent /start to the bot at least once</p>
              </div>
            </div>
          </>
        )}

        {/* ================================================================ */}
        {/* DISCORD SETUP */}
        {/* ================================================================ */}
        {helpTab === "discord" && (
          <>
            {/* Step 1 */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>STEP 1: Create a Webhook</h2>
              <ol style={s.helpList}>
                <li>Open Discord (app or web)</li>
                <li>Go to your server's settings:<br/>
                  <span style={s.helpHint}>Right-click server name → Server Settings</span>
                </li>
                <li>Navigate to <strong>Integrations</strong> → <strong>Webhooks</strong></li>
                <li>Click <strong>"Create Webhook"</strong> or <strong>"New Webhook"</strong></li>
                <li>Give it a name (e.g. "TV Capture")</li>
                <li>Select the channel where screenshots should appear</li>
                <li>Click <strong>"Copy Webhook URL"</strong></li>
                <li><span style={s.helpSuccess}>✅ DONE!</span> You have your webhook URL</li>
              </ol>
              <div style={s.helpTip}>
                <p><strong>Your webhook URL looks like:</strong></p>
                <code style={s.codeBlock}>https://discord.com/api/webhooks/123456789/ABCdef...</code>
              </div>
            </div>

            {/* Step 2 */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>STEP 2: Get Thread IDs (Optional)</h2>
              <p style={s.helpText}>
                If you want to send screenshots to specific forum threads, you'll need the Thread ID.
              </p>
              <ol style={s.helpList}>
                <li>Enable Developer Mode in Discord:<br/>
                  <span style={s.helpHint}>Settings → Advanced → Developer Mode → ON</span>
                </li>
                <li>Right-click on a thread name in your channel</li>
                <li>Click <strong>"Copy ID"</strong></li>
                <li>The copied ID is the Thread ID (a long number)</li>
              </ol>
              <div style={s.helpTip}>
                <p><strong>A Thread ID looks like:</strong></p>
                <code style={s.codeBlock}>1504005327639543898</code>
              </div>
            </div>

            {/* Step 3 */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>STEP 3: Configure TV Capture</h2>
              <ol style={s.helpList}>
                <li>Click <strong>"+ Add Discord Channel"</strong> in Settings</li>
                <li>Enter a name for the channel (e.g. "Signals Channel")</li>
                <li>Paste the Webhook URL into the <strong>"Webhook URL"</strong> field</li>
                <li>Click <strong>Add</strong></li>
                <li>Click <strong>"Test Connectivity"</strong> to verify</li>
              </ol>
            </div>

            {/* Troubleshooting */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>Troubleshooting</h2>
              <div style={s.helpTroubleshoot}>
                <p><strong>"Invalid Webhook" or "Unknown Webhook"</strong></p>
                <p style={s.helpHint}>→ Webhook URL is wrong or the webhook was deleted</p>
                <p style={s.helpHint}>→ Create a new webhook and update the URL</p>
              </div>
              <div style={s.helpTroubleshoot}>
                <p><strong>"Missing Permissions"</strong></p>
                <p style={s.helpHint}>→ The webhook doesn't have permission to post in the target channel</p>
                <p style={s.helpHint}>→ Check channel permissions and webhook integration settings</p>
              </div>
              <div style={s.helpTroubleshoot}>
                <p><strong>Thread ID not working</strong></p>
                <p style={s.helpHint}>→ Make sure the thread exists in the channel</p>
                <p style={s.helpHint}>→ Verify Developer Mode is enabled when copying the ID</p>
                <p style={s.helpHint}>→ The webhook must have permission to send to the thread</p>
              </div>
            </div>
          </>
        )}

        {/* ================================================================ */}
        {/* TELEGRAM TOPICS SETUP */}
        {/* ================================================================ */}
        {helpTab === "topics" && (
          <>
            {/* What are Topics */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>What Are Telegram Topics?</h2>
              <p style={s.helpText}>
                Topics (Forum Mode) allow you to organize messages into separate
                discussions within a single Telegram group. Each topic has its own
                message feed, and messages sent to a topic appear only in that topic.
              </p>
              <p style={s.helpText}>
                Once a Telegram group has Forum Mode enabled, the original "main chat"
                becomes the <strong>General topic</strong>. Messages sent without selecting
                a specific topic land here automatically.
              </p>
              <div style={s.helpWarning}>
                <p>
                  <strong>Note:</strong> In the Telegram app, Forum Mode changes the view
                  to topic-only. You can toggle "View as Messages" in Telegram to see all
                  messages chronologically (like a normal group).
                </p>
              </div>
            </div>

            {/* Enable Topics */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>How to Enable Topics</h2>
              <ol style={s.helpList}>
                <li>Open your Telegram group</li>
                <li>Tap the group name at the top</li>
                <li>Tap <strong>Edit</strong> (pencil icon)</li>
                <li>Scroll down to <strong>Topics</strong></li>
                <li>Toggle <strong>"Topics"</strong> ON</li>
                <li>Confirmation: "Forum Mode enabled"</li>
              </ol>
              <div style={s.helpTip}>
                <p><strong>⚠️ Important:</strong> Enabling Topics is permanent for supergroups.
                Once enabled, you cannot disable Forum Mode.</p>
              </div>
            </div>

            {/* Get Topic Link */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>How to Get a Topic Share Link</h2>
              <ol style={s.helpList}>
                <li>Open the desired topic in Telegram</li>
                <li>Tap the topic name at the top of the chat</li>
                <li>Tap <strong>"Copy Message Link"</strong> / <strong>"Link teilen"</strong></li>
              </ol>
              <p style={s.helpText}>
                The link looks like:
              </p>
              <code style={s.codeBlock}>https://t.me/c/3719682271/2</code>
              <p style={s.helpText}>
                The <strong>last number</strong> (e.g. <code>2</code>) is the Topic ID.
              </p>
              <div style={s.helpWarning}>
                <p>
                  <strong>⚠️ Important:</strong> Use the link from the <strong>topic header</strong>,
                  NOT from a long-press on an individual message. A message link also starts with
                  <code> t.me/c/...</code> but the last number is a message ID, not a topic ID.
                </p>
              </div>
            </div>

            {/* How Topics Work in TV Capture */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>How Topics Work in TV Capture</h2>
              <ul style={s.helpList}>
                <li><strong>General topic:</strong> Messages sent without a topic selection go to General. The main channel configuration already covers this — no separate setup needed.</li>
                <li><strong>Custom topics:</strong> Add them via Settings → Telegram Channel → "[+ Add Topic — Paste Share Link]". Paste the Share Link and TV Capture will parse it automatically.</li>
                <li><strong>Manual entry:</strong> If the Share Link doesn't work, use "Enter manually" to type the Topic ID and name.</li>
                <li><strong>Topic ID 1:</strong> This is reserved for General. TV Capture blocks it — use the main channel instead.</li>
              </ul>
              <div style={s.helpTip}>
                <p><strong>Topic IDs are permanent</strong> — they don't change as long as the topic exists.
                Even if the topic is archived and reopened, the same ID works.</p>
                <p style={{ margin: "4px 0 0" }}>
                  ⚠️ If you delete the topic in Telegram and recreate it, the ID will be different.
                  You'll need to update it in TV Capture.
                </p>
              </div>
            </div>

            {/* Bot Permissions */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>Bot Permissions for Topics</h2>
              <p style={s.helpText}>
                Sending to Topics requires <strong>no additional bot permissions</strong> beyond
                normal messaging. The bot uses the same <code>sendMessage</code> and
                <code>sendPhoto</code> methods — just with an added topic ID.
              </p>
              <p style={s.helpText}>
                The only requirement is that the Telegram group has <strong>Forum Mode enabled</strong>.
              </p>
            </div>

            {/* Chat ID Auto-Correction */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>Chat ID Auto-Correction</h2>
              <p style={s.helpText}>
                When a normal Telegram group is upgraded to a Supergroup (by enabling Topics
                or other features), the Chat ID changes. TV Capture detects this automatically
                when you paste a Share Link and updates the Chat ID for you.
              </p>
              <p style={s.helpText}>
                You'll see a toast notification: <em>"Chat ID updated automatically from the Share Link."</em>
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Shared styles — Dark Glassmorphism Theme
// ---------------------------------------------------------------------------

const s: Record<string, React.CSSProperties> = {
  // Main container with flex layout for sticky footer
  container: {
    padding: 16,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    color: "#e5e7eb",
    backgroundColor: "#1e2028",
    // Flex layout for capture view
    display: "flex",
    flexDirection: "column" as const,
    height: "100vh",
    boxSizing: "border-box" as const,
    // Hide scrollbar completely
    overflow: "hidden" as const, // Change from auto to hidden — scrollableContent handles scrolling
    scrollbarWidth: "none" as const,
    position: "relative" as const, // For absolute-positioned toast messages
  },
  // Container for settings view (no flex, normal flow)
  settingsContainer: {
    padding: 16,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    color: "#e5e7eb",
    backgroundColor: "#1e2028",
    minHeight: "100vh",
    boxSizing: "border-box" as const,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    flexShrink: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
    color: "#e5e7eb",
  },
  navButton: {
    background: "transparent",
    border: "1px solid #3a3f4a",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 13,
    cursor: "pointer",
    color: "#9ca3af",
    transition: "all 150ms",
  },
  // Field styles
  field: { marginBottom: 12 },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    color: "#9ca3af",
  },
  input: {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "10px 12px",
    border: "1px solid #3a3f4a",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
    backgroundColor: "#252830",
    color: "#e5e7eb",
    transition: "border-color 150ms",
  },
  inputError: {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "10px 12px",
    border: "1px solid #ef4444",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
    backgroundColor: "#252830",
    color: "#e5e7eb",
  },
  errorText: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
  },
  // Capture view
  placeholderBox: {
    border: "2px dashed #3a3f4a",
    borderRadius: 12,
    padding: 32,
    textAlign: "center" as const,
    backgroundColor: "rgba(40, 48, 56, 0.5)",
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#9ca3af",
    margin: 0,
  },
  placeholderSub: {
    fontSize: 12,
    color: "#6b7280",
    margin: "4px 0 0",
  },
  buttonRow: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
    flexShrink: 0,
    marginTop: "auto" as const,
  },
  // Send UI — new layout styles
  scrollableContent: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "0 0 0 0", // Container already provides 16px padding
    minHeight: 0, // Allow shrinking
    // Hide scrollbar
    scrollbarWidth: "none" as const,
  },
  bottomBar: {
    padding: "12px 16px",
    borderTop: "1px solid #2c3038",
    flexShrink: 0,
  },
  loadingText: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center" as const,
    padding: "16px 0",
  },
  emptyText: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center" as const,
    padding: "16px 0 4px",
  },
  emptySubText: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center" as const,
    marginBottom: 8,
  },
  addChannelShortcut: {
    width: "100%",
    padding: "8px 12px",
    border: "1px dashed #3a3f4a",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: "transparent",
    color: "#6b7280",
    marginTop: 8,
    transition: "all 150ms",
  },
  // Test message styles - Button with inline feedback
  testButtonRow: {
    marginTop: 0,
    marginBottom: 12,
  },
  testButton: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #0d9488",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: "transparent",
    color: "#14b8a6",
    transition: "all 200ms",
  },
  testButtonLoading: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #134e4a",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "not-allowed",
    backgroundColor: "rgba(13, 148, 136, 0.08)",
    color: "#6b7280",
  },
  testButtonSuccess: {
    width: "100%",
    padding: "10px 12px",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "default",
    backgroundColor: "#10b981",
    color: "#fff",
    transition: "all 200ms",
  },
  testButtonError: {
    width: "100%",
    padding: "10px 12px",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "default",
    backgroundColor: "#ef4444",
    color: "#fff",
    transition: "all 200ms",
  },
  // Capture view - Preview styles
  previewContainer: {
    width: "100%",
    minHeight: 200,
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden" as const,
    flexShrink: 0,
  },
  previewImage: {
    width: "100%",
    height: "auto",
    display: "block",
    borderRadius: 12,
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
  },
  // Shortcut documentation styles
  shortcutRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  kbd: {
    display: "inline-block",
    padding: "4px 10px",
    fontSize: 13,
    fontFamily: "monospace",
    backgroundColor: "#252830",
    border: "1px solid #3a3f4a",
    borderRadius: 6,
    color: "#e5e7eb",
  },
  shortcutPlus: {
    color: "#6b7280",
    fontSize: 13,
  },
  shortcutLabel: {
    marginLeft: 8,
    fontSize: 13,
    color: "#9ca3af",
  },
  shortcutHint: {
    fontSize: 12,
    color: "#6b7280",
    margin: "0 0 8px",
  },
  shortcutLink: {
    background: "none",
    border: "none",
    padding: 0,
    fontSize: 12,
    color: "#14b8a6",
    cursor: "pointer",
    textDecoration: "underline",
  },
  // Template grid styles
  templateSection: {
    marginBottom: 12,
    flexShrink: 0,
  },
  tileRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginBottom: 8,
  },
  templateGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  // Textarea view styles - fills remaining space
  textareaSection: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    marginBottom: 12,
    minHeight: 0, // Allow shrinking
  },
  textareaContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    minHeight: 0,
  },
  textarea: {
    flex: 1,
    width: "100%",
    padding: "12px",
    border: "1px solid #3a3f4a",
    borderRadius: 8,
    fontSize: 14,
    resize: "none" as const, // Auto-resize via flex
    minHeight: 80,
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
    backgroundColor: "#252830",
    color: "#e5e7eb",
    transition: "border-color 150ms",
  },
  textareaError: {
    flex: 1,
    width: "100%",
    padding: "12px",
    border: "1px solid #ef4444",
    borderRadius: 8,
    fontSize: 14,
    resize: "none" as const,
    minHeight: 80,
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
    backgroundColor: "#252830",
    color: "#e5e7eb",
  },
  counter: {
    fontSize: 11,
    color: "#6b7280",
    textAlign: "right" as const,
    marginTop: 4,
  },
  counterError: {
    fontSize: 11,
    color: "#ef4444",
    textAlign: "right" as const,
    marginTop: 4,
  },
  // Form view styles - fills remaining space
  formSection: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    marginBottom: 12,
    minHeight: 0,
  },
  // MESSAGE section placeholder (OQ-1)
  messagePlaceholder: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 16px",
    textAlign: "center" as const,
  },
  messagePlaceholderIcon: {
    fontSize: 28,
    margin: "0 0 8px",
  },
  messagePlaceholderText: {
    fontSize: 13,
    color: "#6b7280",
    margin: 0,
  },
  // Action buttons
  captureButton: {
    flex: 1,
    padding: "12px 16px",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: "#0d9488",
    color: "#fff",
    transition: "background-color 150ms",
  },
  sendButton: {
    flex: 1,
    padding: "12px 16px",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: "#10b981",
    color: "#fff",
    transition: "background-color 150ms",
  },
  sendButtonDisabled: {
    flex: 1,
    padding: "12px 16px",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "not-allowed",
    backgroundColor: "#059669",
    color: "#6b7280",
  },
  cancelButton: {
    padding: "12px 16px",
    border: "1px solid #3a3f4a",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: "transparent",
    color: "#9ca3af",
    transition: "all 150ms",
  },
  buttonLoading: {
    flex: 1,
    padding: "12px 16px",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "not-allowed",
    backgroundColor: "#134e4a",
    color: "#6b7280",
  },
  // Messages
  errorMessage: {
    marginTop: 8,
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    textAlign: "center" as const,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    color: "#ef4444",
    border: "1px solid rgba(239, 68, 68, 0.3)",
  },
  sendSuccess: {
    marginTop: 8,
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    textAlign: "center" as const,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    color: "#10b981",
    border: "1px solid rgba(16, 185, 129, 0.3)",
  },
  sendError: {
    marginTop: 8,
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    textAlign: "center" as const,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    color: "#ef4444",
    border: "1px solid rgba(239, 68, 68, 0.3)",
  },
  // Template styles
  addButton: {
    width: "100%",
    padding: "12px 16px",
    border: "1px dashed #0d9488",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: "transparent",
    color: "#14b8a6",
    marginTop: 8,
    transition: "all 150ms",
  },
  hintText: {
    fontSize: 12,
    color: "#6b7280",
    margin: "0 0 12px 0",
    fontStyle: "italic" as const,
  },
  // Delete confirmation popup
  overlay: {
    position: "fixed" as const,
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
  popup: {
    backgroundColor: "#252830",
    borderRadius: 12,
    padding: 20,
    maxWidth: "90%",
    width: 280,
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
    border: "1px solid #3a3f4a",
  },
  popupTitle: {
    fontSize: 16,
    fontWeight: 600,
    margin: "0 0 8px",
    color: "#e5e7eb",
  },
  popupText: {
    fontSize: 14,
    color: "#9ca3af",
    margin: "0 0 16px",
  },
  popupButtons: {
    display: "flex",
    gap: 8,
  },
  popupCancelButton: {
    flex: 1,
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
  popupDeleteButton: {
    flex: 1,
    padding: "10px 14px",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: "#ef4444",
    color: "#fff",
    transition: "background-color 150ms",
  },
  // Branding
  branding: {
    textAlign: "center" as const,
    padding: "16px 0 8px",
    fontSize: 12,
    color: "#6b7280",
    textDecoration: "underline" as const,
    textDecorationColor: "#4b5563",
    letterSpacing: "0.02em",
  },
  // Help link (under inputs) - simple text link
  helpLink: {
    display: "block",
    fontSize: 12,
    color: "#6b7280",
    cursor: "pointer",
    textDecoration: "underline" as const,
    textDecorationColor: "#4b5563",
    marginTop: 8,
    marginBottom: 16,
    transition: "color 150ms, text-decoration-color 150ms",
  },
  // Close button (X) for help view
  closeButton: {
    background: "transparent",
    border: "1px solid #3a3f4a",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 14,
    cursor: "pointer",
    color: "#9ca3af",
    transition: "all 150ms",
    fontWeight: 600,
  },
  // Help view styles
  helpContent: {
    marginTop: 8,
  },
  helpBox: {
    backgroundColor: "rgba(13, 148, 136, 0.08)",
    border: "1px solid rgba(13, 148, 136, 0.2)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  helpBoxTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#14b8a6",
    margin: "0 0 8px",
  },
  helpBoxText: {
    fontSize: 13,
    color: "#9ca3af",
    margin: "4px 0",
  },
  helpSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: "1px solid #2c3038",
  },
  helpSectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#e5e7eb",
    margin: "0 0 12px",
    letterSpacing: "0.02em",
  },
  helpSubsection: {
    marginTop: 12,
    paddingLeft: 8,
    borderLeft: "2px solid #3a3f4a",
  },
  helpSubsectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#9ca3af",
    margin: "0 0 8px",
  },
  helpText: {
    fontSize: 13,
    color: "#d1d5db",
    margin: "8px 0",
    lineHeight: 1.5,
  },
  helpList: {
    fontSize: 13,
    color: "#d1d5db",
    margin: "8px 0",
    paddingLeft: 20,
    lineHeight: 1.7,
  },
  helpHint: {
    fontSize: 12,
    color: "#6b7280",
    display: "block",
    marginTop: 2,
    marginLeft: 4,
  },
  helpSuccess: {
    color: "#10b981",
    fontWeight: 600,
  },
  helpWarning: {
    fontSize: 12,
    color: "#f59e0b",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    border: "1px solid rgba(245, 158, 11, 0.2)",
    borderRadius: 6,
    padding: "8px 10px",
    margin: "8px 0",
  },
  helpTip: {
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    border: "1px solid rgba(59, 130, 246, 0.2)",
    borderRadius: 6,
    padding: "8px 10px",
    margin: "8px 0",
  },
  helpTroubleshoot: {
    marginBottom: 12,
  },
  code: {
    fontFamily: "monospace",
    backgroundColor: "#2c3038",
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: 12,
    color: "#a5b4fc",
  },
  codeBlock: {
    display: "block",
    fontFamily: "monospace",
    backgroundColor: "#2c3038",
    padding: "6px 10px",
    borderRadius: 6,
    fontSize: 12,
    color: "#a5b4fc",
    margin: "6px 0",
    wordBreak: "break-all" as const,
  },
  jsonBlock: {
    fontFamily: "monospace",
    fontSize: 11,
    backgroundColor: "#1e2028",
    border: "1px solid #3a3f4a",
    borderRadius: 6,
    padding: 10,
    margin: "8px 0",
    color: "#9ca3af",
    overflow: "auto" as const,
    whiteSpace: "pre" as const,
  },
  // Phase 6 — Platform Cards styles
  inlineForm: {
    border: "1px solid #3a3f4a",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "rgba(37, 40, 48, 0.5)",
  },
  inlineFormButtons: {
    display: "flex",
    gap: 8,
    marginTop: 8,
  },
  addChannelButton: {
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
  addChannelButtonDisabled: {
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
  inlineCancelButton: {
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
  toast: {
    position: "fixed" as const,
    bottom: 16,
    left: 16,
    right: 16,
    padding: "10px 14px",
    backgroundColor: "#10b981",
    color: "#fff",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    textAlign: "center" as const,
    zIndex: 2000,
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
    animation: "none" as const,
  },
}

export default SidePanel

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

import { useEffect, useState, useCallback, Fragment } from "react"
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
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers"
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
import { TemplateListItem } from "./components/TemplateListItem"
import { TemplateTile } from "./components/TemplateTile"
import {
  getChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  addTopicToChannel,
  removeTopicFromChannel,
  updateTopicInChannel,
  addThreadToChannel,
  removeThreadFromChannel,
  updateThreadInChannel,
  getChannelsSortedBySendOrder,
  updateChannelSendOrder,
  updateSubEntityOrder,
  loadSettingsUIState,
  saveSettingsUIState,
  type Channel,
  type ChannelUpdate,
  type ChannelCredentials,
  type TelegramCredentials,
  type DiscordCredentials,
  type SettingsUIState,
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
// Keyboard Shortcut Utilities
// ---------------------------------------------------------------------------

/**
 * Parse a keyboard shortcut string from chrome.commands.getAll() into
 * normalized modifier key names. Handles all known Chrome API formats:
 * - Manifest format: "Alt+S", "Ctrl+Shift+Y"
 * - Mac display format: "⌥S", "⌘⇧S" (Unicode symbols without separator)
 * - Mac name format: "Option+S", "Command+Shift+Y"
 */
function parseShortcut(shortcut: string): string[] {
  if (!shortcut) return []

  // Format with '+' separator: "Alt+S", "Command+Shift+Y", "Option+S"
  if (shortcut.includes("+")) {
    return shortcut.split("+").map(key => {
      if (key === "Option") return "Alt"      // Normalize Mac "Option" → "Alt"
      if (key === "MacCtrl") return "Ctrl"    // Normalize Mac "MacCtrl" → "Ctrl"
      return key
    })
  }

  // Mac display format: Unicode modifier symbols concatenated with key
  // e.g., "⌥S" → ["Alt", "S"], "⌘⇧S" → ["Command", "Shift", "S"]
  const macSymbols: Record<string, string> = {
    "\u2318": "Command",  // ⌘
    "\u2325": "Alt",      // ⌥
    "\u21E7": "Shift",    // ⇧
    "\u2303": "Ctrl",     // ⌃
  }

  const keys: string[] = []
  let remaining = shortcut

  while (remaining.length > 0) {
    const firstChar = remaining[0]
    if (macSymbols[firstChar]) {
      keys.push(macSymbols[firstChar])
      remaining = remaining.slice(1)
    } else {
      // Rest is the actual key (letter, number, etc.)
      keys.push(remaining)
      break
    }
  }

  return keys
}

/** Get display info for a modifier key. Returns null for non-modifier keys. */
function getKeyDisplay(key: string, isMac: boolean): { symbol: string; label: string } | null {
  if (key === "Alt") {
    return isMac
      ? { symbol: "⌥", label: "Option" }
      : { symbol: "", label: "Alt" }
  }
  if (key === "Ctrl") {
    return isMac
      ? { symbol: "⌃", label: "Control" }
      : { symbol: "", label: "Ctrl" }
  }
  if (key === "Shift") {
    return { symbol: "⇧", label: "Shift" }
  }
  if (key === "Command") {
    return { symbol: "⌘", label: "Command" }
  }
  return null // Not a modifier key — render as-is
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SidePanel() {
  const [view, setView] = useState<View>("capture")

  // ── Send UI accordion state ──
  const [sendUiAccordions, setSendUiAccordions] = useState({
    screenshot: false,
    message: true,
    channels: true,
  })

  const handleAccordionToggle = useCallback(
    (key: "screenshot" | "message" | "channels") => {
      setSendUiAccordions((prev) => ({ ...prev, [key]: !prev[key] }))
    },
    []
  )

  const handleSetAccordions = useCallback(
    (values: Partial<typeof sendUiAccordions>) => {
      setSendUiAccordions((prev) => ({ ...prev, ...values }))
    },
    []
  )

  // ── Capture view state (lifted to survive Settings ↔ Capture switching) ──
  const [captureState, setCaptureState] = useState<CaptureState>("idle")
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<{ success: boolean; targetCount?: number; error?: string } | null>(null)
  const [errorButtonActive, setErrorButtonActive] = useState(false)

  const [mode, setMode] = useState<CaptureViewMode>("grid")
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [isCustom, setIsCustom] = useState(false)
  const [caption, setCaption] = useState("")

  const [channels, setChannels] = useState<Channel[]>([])
  const [channelsLoading, setChannelsLoading] = useState(true)

  const [selectedChannels, setSelectedChannels] = useState<Set<number>>(new Set())
  const [selectedSubEntities, setSelectedSubEntities] = useState<Set<string>>(new Set())

  const [sendResults, setSendResults] = useState<SendTargetResult[] | null>(null)
  const [showSendResultModal, setShowSendResultModal] = useState(false)

  const [channelDragActiveId, setChannelDragActiveId] = useState<number | null>(null)

  // Load templates + channels on mount
  useEffect(() => {
    getTemplates().then(setTemplates)
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

  // ── Selection helpers ──
  const handleToggleChannel = useCallback((channelId: number) => {
    setSelectedChannels((prev) => {
      const next = new Set(prev)
      if (next.has(channelId)) next.delete(channelId)
      else next.add(channelId)
      return next
    })
  }, [])

  const handleToggleSubEntity = useCallback((channelId: number, subEntityId: number) => {
    const key = `${channelId}:${subEntityId}`
    setSelectedSubEntities((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const clearSelections = useCallback(() => {
    setSelectedChannels(new Set())
    setSelectedSubEntities(new Set())
  }, [])

  const totalSelectedCount = selectedChannels.size + selectedSubEntities.size

  // ── Shortcut Capture Listener (Opt+S + Popup Capture) ──
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
        setView("capture")
        handleSetAccordions({ screenshot: true, message: true, channels: true })
        getChannelsSortedBySendOrder().then(setChannels)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [handleSetAccordions])

  // ── Handle Capture ──
  const handleCapture = useCallback(async () => {
    setCaptureState("capturing")
    setError(null)
    setSendResult(null)

    try {
      const response = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CAPTURE_SCREENSHOT,
      })) as CaptureResponse

      if (response.success) {
        setScreenshotUrl(response.dataUrl)
        setCaptureState("captured")
        setMode("grid")
        handleSetAccordions({ screenshot: true, message: true, channels: true })
      } else {
        setError(response.error)
        setCaptureState("idle")
        setErrorButtonActive(true)
        setTimeout(() => setErrorButtonActive(false), 3000)
      }
    } catch {
      setError("Failed to capture screenshot")
      setCaptureState("idle")
      setErrorButtonActive(true)
      setTimeout(() => setErrorButtonActive(false), 3000)
    }
  }, [handleSetAccordions])

  // ── Handle Send ──
  const handleSend = useCallback(async () => {
    if (!screenshotUrl || totalSelectedCount === 0) return

    setCaptureState("sending")
    setSendResult(null)
    setShowSendResultModal(false)

    const targets: SendTarget[] = []
    for (const channelId of selectedChannels) {
      targets.push({ channelId })
    }
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
      const someSuccess = response.results.some((r) => r.success)

      if (allSuccess) {
        setSendResult({ success: true, targetCount: totalSelectedCount })
        setScreenshotUrl(null)
        setCaptureState("idle")
        setMode("grid")
        setSelectedTemplateId(null)
        setIsCustom(false)
        setCaption("")
        clearSelections()
        handleSetAccordions({ screenshot: false })
      } else if (someSuccess) {
        // Partial failure: keep screenshot + message, deselect channels, show info
        setSendResults(response.results)
        setShowSendResultModal(true)
        setCaptureState("captured")
        clearSelections()
        setSendResult({
          success: true,
          targetCount: response.results.filter((r) => r.success).length,
        })
      } else {
        // Complete failure: keep screenshot + message, deselect channels
        setSendResults(response.results)
        setShowSendResultModal(true)
        setCaptureState("captured")
        clearSelections()
      }
    } catch {
      setSendResult({ success: false, error: "Failed to send" })
      setCaptureState("captured")
    }
  }, [screenshotUrl, caption, totalSelectedCount, selectedChannels, selectedSubEntities, channels, clearSelections, handleSetAccordions])

  // ── Handle Cancel ──
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
    handleSetAccordions({ screenshot: false })
  }, [clearSelections, handleSetAccordions])

  // ── Template creation ──
  const handleCreateTemplate = useCallback(async (name: string, body: string) => {
    await createTemplate(name, body)
    const updated = await getTemplates()
    setTemplates(updated)
    setMode("grid")
  }, [])

  // ── Sub-entity helper ──
  const getSubEntitiesForSend = useCallback(
    (channel: Channel): Array<{ id: number; name: string }> => {
      if (channel.type === "telegram") {
        const creds = channel.credentials as TelegramCredentials
        return creds.topics.slice().sort((a, b) => a.order - b.order).map((t) => ({ id: t.id, name: t.name }))
      } else {
        const creds = channel.credentials as DiscordCredentials
        return creds.threads.slice().sort((a, b) => a.order - b.order).map((t) => ({ id: t.id, name: t.name }))
      }
    },
    []
  )

  // ── Channel D&D ──
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
      const sortedIds = reordered.map((ch) => ch.id)
      await updateChannelSendOrder(sortedIds)
    },
    [channels]
  )

  // ── Sub-Entity D&D ──
  const handleSubEntityDragEnd = useCallback(
    async (channelId: number, event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const channel = channels.find((ch) => ch.id === channelId)
      if (!channel) return
      const type: "topic" | "thread" = channel.type === "telegram" ? "topic" : "thread"
      const creds = channel.credentials as TelegramCredentials | DiscordCredentials
      const rawSubEntities = type === "topic" ? (creds as TelegramCredentials).topics : (creds as DiscordCredentials).threads
      const subEntities = rawSubEntities.slice().sort((a, b) => a.order - b.order)
      const oldIndex = subEntities.findIndex((s) => s.id === active.id)
      const newIndex = subEntities.findIndex((s) => s.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      const reordered = arrayMove(subEntities, oldIndex, newIndex)
      const sortedIds = reordered.map((s) => s.id)
      await updateSubEntityOrder(channelId, sortedIds, type)
      const updated = await getChannelsSortedBySendOrder()
      setChannels(updated)
    },
    [channels]
  )

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

  // Refresh channels when returning to capture view (e.g., after editing in Settings)
  useEffect(() => {
    if (view === "capture") {
      getChannelsSortedBySendOrder().then((ch) => {
        setChannels(ch)
        setChannelsLoading(false)
      })
    }
  }, [view])

  return view === "settings" ? (
    <SettingsView onBack={() => setView("capture")} onHelp={() => setView("help")} />
  ) : view === "help" ? (
    <HelpView onBack={() => setView("settings")} />
  ) : (
    <CaptureView
      onSettings={() => setView("settings")}
      accordionState={sendUiAccordions}
      onAccordionToggle={handleAccordionToggle}
      onSetAccordions={handleSetAccordions}
      // Capture state
      captureState={captureState}
      screenshotUrl={screenshotUrl}
      error={error}
      sendResult={sendResult}
      errorButtonActive={errorButtonActive}
      mode={mode}
      templates={templates}
      selectedTemplateId={selectedTemplateId}
      isCustom={isCustom}
      caption={caption}
      channels={channels}
      channelsLoading={channelsLoading}
      selectedChannels={selectedChannels}
      selectedSubEntities={selectedSubEntities}
      sendResults={sendResults}
      showSendResultModal={showSendResultModal}
      channelDragActiveId={channelDragActiveId}
      // Setters
      setMode={setMode}
      setSelectedTemplateId={setSelectedTemplateId}
      setIsCustom={setIsCustom}
      setCaption={setCaption}
      setChannels={setChannels}
      setChannelsLoading={setChannelsLoading}
      setSendResults={setSendResults}
      setShowSendResultModal={setShowSendResultModal}
      setChannelDragActiveId={setChannelDragActiveId}
      // Handlers
      onCapture={handleCapture}
      onSend={handleSend}
      onCancel={handleCancel}
      onToggleChannel={handleToggleChannel}
      onToggleSubEntity={handleToggleSubEntity}
      onCreateTemplate={handleCreateTemplate}
      getSubEntitiesForSend={getSubEntitiesForSend}
      channelSensors={channelSensors}
      onChannelDragStart={handleChannelDragStart}
      onChannelDragEnd={handleChannelDragEnd}
      onSubEntityDragEnd={handleSubEntityDragEnd}
    />
  )
}

// ---------------------------------------------------------------------------
// Capture View
// ---------------------------------------------------------------------------

type CaptureState = "idle" | "capturing" | "captured" | "sending"
type CaptureViewMode = "grid" | "textarea" | "form"

function CaptureView({
  onSettings,
  accordionState,
  onAccordionToggle,
  onSetAccordions,
  captureState,
  screenshotUrl,
  error,
  sendResult,
  errorButtonActive,
  mode,
  templates,
  selectedTemplateId,
  isCustom,
  caption,
  channels,
  channelsLoading,
  selectedChannels,
  selectedSubEntities,
  sendResults,
  showSendResultModal,
  channelDragActiveId,
  setMode,
  setSelectedTemplateId,
  setIsCustom,
  setCaption,
  setChannels,
  setChannelsLoading,
  setSendResults,
  setShowSendResultModal,
  setChannelDragActiveId,
  onCapture,
  onSend,
  onCancel,
  onToggleChannel,
  onToggleSubEntity,
  onCreateTemplate,
  getSubEntitiesForSend,
  channelSensors,
  onChannelDragStart,
  onChannelDragEnd,
  onSubEntityDragEnd,
}: {
  onSettings: () => void
  accordionState: { screenshot: boolean; message: boolean; channels: boolean }
  onAccordionToggle: (key: "screenshot" | "message" | "channels") => void
  onSetAccordions: (values: Partial<{ screenshot: boolean; message: boolean; channels: boolean }>) => void
  captureState: CaptureState
  screenshotUrl: string | null
  error: string | null
  sendResult: { success: boolean; targetCount?: number; error?: string } | null
  errorButtonActive: boolean
  mode: CaptureViewMode
  templates: Template[]
  selectedTemplateId: number | null
  isCustom: boolean
  caption: string
  channels: Channel[]
  channelsLoading: boolean
  selectedChannels: Set<number>
  selectedSubEntities: Set<string>
  sendResults: SendTargetResult[] | null
  showSendResultModal: boolean
  channelDragActiveId: number | null
  setMode: (m: CaptureViewMode) => void
  setSelectedTemplateId: (id: number | null) => void
  setIsCustom: (v: boolean) => void
  setCaption: (v: string) => void
  setChannels: (ch: Channel[]) => void
  setChannelsLoading: (v: boolean) => void
  setSendResults: (r: SendTargetResult[] | null) => void
  setShowSendResultModal: (v: boolean) => void
  setChannelDragActiveId: (id: number | null) => void
  onCapture: () => void
  onSend: () => void
  onCancel: () => void
  onToggleChannel: (channelId: number) => void
  onToggleSubEntity: (channelId: number, subEntityId: number) => void
  onCreateTemplate: (name: string, body: string) => Promise<void>
  getSubEntitiesForSend: (channel: Channel) => Array<{ id: number; name: string }>
  channelSensors: ReturnType<typeof useSensors>
  onChannelDragStart: (event: { active: { id: number } }) => void
  onChannelDragEnd: (event: DragEndEvent) => void
  onSubEntityDragEnd: (channelId: number, event: DragEndEvent) => void
}) {
  const totalSelectedCount = selectedChannels.size + selectedSubEntities.size

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

      {/* Scrollable: Screenshot + Message + Channels */}
      <div style={s.scrollableContent}>
        {/* Collapsible Screenshot Preview */}
        <CollapsibleSection
          title="SCREENSHOT"
          isOpen={accordionState.screenshot}
          onToggle={() => onAccordionToggle("screenshot")}
        >
          {screenshotUrl ? (
            <img
              src={screenshotUrl}
              style={s.previewImage}
              alt="Captured screenshot"
            />
          ) : (
            <div style={{
              ...s.placeholderBox,
              minHeight: 100,
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
        </CollapsibleSection>

        {/* Message Section — always visible (OQ-1) */}
        <CollapsibleSection
          title="MESSAGE"
          isOpen={accordionState.message}
          onToggle={() => onAccordionToggle("message")}
        >
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
                      rows={12}
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
                    onSave={onCreateTemplate}
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
        <CollapsibleSection
          title="CHANNELS"
          isOpen={accordionState.channels}
          onToggle={() => onAccordionToggle("channels")}
        >
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
                onDragStart={onChannelDragStart}
                onDragEnd={onChannelDragEnd}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
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
                        onToggleMain={() => onToggleChannel(channel.id)}
                        selectedSubEntities={selectedSubEntities}
                        onToggleSubEntity={onToggleSubEntity}
                        subEntities={subEntities}
                        subEntityIds={subEntityIds}
                        onSubEntityDragEnd={onSubEntityDragEnd}
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
        {/* Footer separator — same width as buttons (determined by bottomBar padding) */}
        <div style={{ marginBottom: 12, borderTop: "1px solid #2c3038" }} />

        {sendResult ? (
          /* Send Result replaces buttons for 5s — same field, same width */
          <div style={sendResult.success ? s.sendSuccessButton : s.sendErrorButton}>
            {sendResult.success
              ? `Sent to ${sendResult.targetCount ?? 0} target${(sendResult.targetCount ?? 0) !== 1 ? "s" : ""}`
              : sendResult.error}
          </div>
        ) : captureState === "idle" && !screenshotUrl ? (
          <button
            style={{
              ...s.captureButton,
              width: "100%",
              backgroundColor: errorButtonActive ? "#991b1b" : "#0d9488",
            }}
            onClick={onCapture}
            disabled={captureState === "capturing"}
            onMouseEnter={(e) => {
              if (!errorButtonActive) {
                (e.target as HTMLButtonElement).style.backgroundColor = "#14b8a6"
              }
            }}
            onMouseLeave={(e) => {
              if (!errorButtonActive) {
                (e.target as HTMLButtonElement).style.backgroundColor = "#0d9488"
              }
            }}
          >
            {errorButtonActive ? "Not a TradingView page" : "Capture"}
          </button>
        ) : captureState === "capturing" ? (
          <button style={{ ...s.buttonLoading, width: "100%" }} disabled>Capturing...</button>
        ) : captureState === "captured" && screenshotUrl ? (
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <button
              style={totalSelectedCount > 0 ? s.sendButton : s.sendButtonDisabled}
              disabled={totalSelectedCount === 0}
              onClick={onSend}
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
              {`SEND TO SELECTED (${totalSelectedCount})`}
            </button>
            <button
              style={s.cancelButton}
              onClick={onCancel}
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
        ) : captureState === "sending" ? (
          <button style={{ ...s.sendingButton, width: "100%" }} disabled>
            Sending...
          </button>
        ) : null}
      </div>

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
    // CRITICAL: Use CSS.Translate.toString() instead of CSS.Transform.toString()
    // CSS.Transform includes scaleX/scaleY which causes variable-height items to
    // stretch/compress during drag. CSS.Translate only applies translation (x, y),
    // preserving exact dimensions. See dnd-kit issues #44, #117, #817, #1138.
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isOtherDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
    width: "100%",
    boxSizing: "border-box",
    // Border always present (1px) — only color changes. No size change.
    border: "1px solid",
    borderColor: isDragging ? "#14b8a6" : "transparent",
    // Background highlight when dragging
    backgroundColor: isDragging ? "rgba(13, 148, 136, 0.08)" : "transparent",
    // Elevation shadow — no layout impact
    boxShadow: isDragging ? "0 8px 24px rgba(0, 0, 0, 0.4)" : undefined,
    cursor: isDragging ? "grabbing" : undefined,
    borderRadius: 10,
    // Margin moved from inner element to wrapper for consistent drag spacing
    marginBottom: 8,
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
  const [addFormAccountName, setAddFormAccountName] = useState("")
  const [addFormServerName, setAddFormServerName] = useState("")
  const [addFormToken, setAddFormToken] = useState("")
  const [addFormChatId, setAddFormChatId] = useState("")
  const [addFormWebhookUrl, setAddFormWebhookUrl] = useState("")

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    channelId: number
    subEntityCount: number
  } | null>(null)

  // Sub-entity delete confirmation state
  const [subEntityDeleteConfirm, setSubEntityDeleteConfirm] = useState<{
    channelId: number
    subEntityId: number
    subEntityName: string
    type: "topic" | "thread"
  } | null>(null)

  // Edit state for sub-entities
  const [editingTopicId, setEditingTopicId] = useState<number | null>(null)
  const [editingThreadId, setEditingThreadId] = useState<number | null>(null)

  // Toast state
  const [toast, setToast] = useState<string | null>(null)

  // Topic ID 1 blocking modal state
  const [topicId1Modal, setTopicId1Modal] = useState(false)

  // Test button states — per entity
  const [testStates, setTestStates] = useState<
    Record<string, "idle" | "loading" | "success" | "error">
  >({})

  // Test error messages — keyed by same keys as testStates
  const [testErrors, setTestErrors] = useState<Record<string, string | null>>({})

  // Error modal for test failures
  const [testErrorModal, setTestErrorModal] = useState<string | null>(null)

  // Template state (unchanged)
  const [templates, setTemplates] = useState<Template[]>([])
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  // Card focus/active state (Step 10)
  const [activeCardId, setActiveCardId] = useState<number | null>(null)

  // Settings UI collapse state (Phase 33) + section states
  const [settingsUIState, setSettingsUIState] = useState<SettingsUIState>({ collapsedCards: {}, sections: {} })

  // Drag & Drop state (templates) — dnd-kit uses string IDs internally
  const [dragActiveId, setDragActiveId] = useState<string | null>(null)

  // Keyboard shortcut info (Phase 10.3)
  const [shortcutInfo, setShortcutInfo] = useState<{
    shortcut: string
    isSet: boolean
  } | null>(null)

  // Feedback form state (Phase 39)
  const [feedbackName, setFeedbackName] = useState("")
  const [feedbackTopic, setFeedbackTopic] = useState("General")
  const [feedbackMessage, setFeedbackMessage] = useState("")
  const [feedbackState, setFeedbackState] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

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
    loadSettingsUIState().then(setSettingsUIState)
  }, [])

  // Load templates
  useEffect(() => {
    getTemplates().then(setTemplates)
  }, [])

  // Load actual keyboard shortcut assignment (Phase 10.3)
  useEffect(() => {
    chrome.commands.getAll().then((commands) => {
      const captureCommand = commands.find(
        (cmd) => cmd.name === "capture-tradingview"
      )
      if (captureCommand) {
        setShortcutInfo({
          shortcut: captureCommand.shortcut,
          isSet: captureCommand.shortcut !== "",
        })
      }
    })
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

  // Toggle card collapse (Phase 33)
  const handleToggleCollapse = useCallback((channelId: number) => {
    const key = channelId.toString()
    setSettingsUIState((prev) => {
      const newState = {
        ...prev,
        collapsedCards: {
          ...prev.collapsedCards,
          [key]: !prev.collapsedCards[key],
        },
      }
      saveSettingsUIState(newState)
      return newState
    })
  }, [])

  // Toggle section open/close (controlled mode)
  const handleToggleSection = useCallback((sectionKey: string) => {
    setSettingsUIState((prev) => {
      const newState = {
        ...prev,
        sections: {
          ...prev.sections,
          [sectionKey]: !prev.sections?.[sectionKey],
        },
      }
      saveSettingsUIState(newState)
      return newState
    })
  }, [])

  // -----------------------------------------------------------------------
  // Feedback delivery (Phase 39)
  // -----------------------------------------------------------------------

  const FEEDBACK_BOT_TOKEN = "8699641806:AAFC7_eWU8IUSAVG8gwjbDLv3D25Pno6WPQ"
  const FEEDBACK_CHAT_ID = "-5255253732"

  const sendFeedback = async (
    name: string,
    topic: string,
    message: string
  ): Promise<{ success: true } | { success: false; error: string }> => {
    const version = chrome.runtime.getManifest().version
    const platform = navigator.platform
    const userAgent = navigator.userAgent
    const timestamp = new Date().toISOString()

    const displayName = name.trim() || "Anonymous"

    const formattedText = [
      "📬 TV Capture Feedback",
      "",
      `Name: ${displayName}`,
      `Topic: ${topic}`,
      `Message:`,
      message,
      "",
      "---",
      `Extension Version: ${version}`,
      `Platform: ${platform}`,
      `User Agent: ${userAgent}`,
      `Timestamp: ${timestamp}`,
    ].join("\n")

    return await sendMessage(FEEDBACK_BOT_TOKEN, FEEDBACK_CHAT_ID, formattedText)
  }

  const handleSendFeedback = async () => {
    const trimmedMessage = feedbackMessage.trim()
    if (!trimmedMessage) {
      setFeedbackState("error")
      setFeedbackError("Please enter a message.")
      setTimeout(() => {
        setFeedbackState("idle")
        setFeedbackError(null)
      }, 2000)
      return
    }

    setFeedbackState("loading")
    setFeedbackError(null)

    const result = await sendFeedback(feedbackName, feedbackTopic, trimmedMessage)

    if (result.success) {
      setFeedbackState("success")
      setTimeout(() => {
        setFeedbackName("")
        setFeedbackTopic("General")
        setFeedbackMessage("")
        setFeedbackState("idle")
        setFeedbackError(null)
      }, 2000)
    } else {
      setFeedbackState("error")
      setFeedbackError(result.error || "Failed to send feedback. Please try again.")
      setTimeout(() => {
        setFeedbackState("idle")
        setFeedbackError(null)
      }, 3000)
    }
  }

  // -----------------------------------------------------------------------
  // Drag & Drop handlers (templates — unchanged)
  // -----------------------------------------------------------------------

  const handleDragStart = useCallback((event: { active: { id: string } }) => {
    setDragActiveId(event.active.id)
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event

      setDragActiveId(null)

      if (!over || active.id === over.id) {
        return
      }

      const oldIndex = templates.findIndex((t) => t.id.toString() === active.id)
      const newIndex = templates.findIndex((t) => t.id.toString() === over.id)

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
      setAddFormAccountName("")
      setAddFormServerName("")
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
        accountName: addFormAccountName.trim() || undefined,
        topics: [],
      }
    } else {
      credentials = {
        type: "discord",
        webhookUrl: addFormWebhookUrl.trim(),
        serverName: addFormServerName.trim() || undefined,
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
      if (!result.success) {
        setTestErrors((prev) => ({ ...prev, [key]: result.error || "Unknown error" }))
        setTestErrorModal(result.error || "Test failed. Please check your configuration.")
      } else {
        setTestErrors((prev) => ({ ...prev, [key]: null }))
      }
    } catch {
      setTestStates((prev) => ({ ...prev, [key]: "error" }))
      setTestErrors((prev) => ({ ...prev, [key]: "Unexpected error occurred." }))
      setTestErrorModal("Unexpected error occurred.")
    }
    setTimeout(() => {
      setTestStates((prev) => ({ ...prev, [key]: "idle" }))
    }, 3000)
  }

  // Add topic
  const handleAddTopic = (channelId: number) => {
    setActiveFormId(`topic-${channelId}`)
    // Close any open edit forms
    setEditingTopicId(null)
    setEditingThreadId(null)
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

  // Edit topic
  const handleEditTopic = (channelId: number, topicConfigId: number) => {
    setEditingTopicId(topicConfigId)
    setEditingThreadId(null)
  }

  // Cancel topic edit
  const handleEditTopicCancel = () => {
    setEditingTopicId(null)
  }

  // Delete topic — show confirmation
  const handleDeleteTopic = (
    channelId: number,
    topicConfigId: number,
    topicName: string
  ) => {
    setSubEntityDeleteConfirm({
      channelId,
      subEntityId: topicConfigId,
      subEntityName: topicName,
      type: "topic",
    })
  }

  // Save topic edit
  const handleTopicSave = async (
    channelId: number,
    topicConfigId: number,
    name: string,
    topicId: string
  ) => {
    await updateTopicInChannel(channelId, topicConfigId, { name, topicId })
    await refreshChannels()
    setEditingTopicId(null)
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
      if (!result.success) {
        setTestErrors((prev) => ({ ...prev, [key]: result.error || "Unknown error" }))
        setTestErrorModal(result.error || "Test failed. Please check your configuration.")
      } else {
        setTestErrors((prev) => ({ ...prev, [key]: null }))
      }
    } catch {
      setTestStates((prev) => ({ ...prev, [key]: "error" }))
      setTestErrors((prev) => ({ ...prev, [key]: "Unexpected error occurred." }))
      setTestErrorModal("Unexpected error occurred.")
    }
    setTimeout(() => {
      setTestStates((prev) => ({ ...prev, [key]: "idle" }))
    }, 3000)
  }

  // Add thread
  const handleAddThread = (channelId: number) => {
    setActiveFormId(`thread-${channelId}`)
    // Close any open edit forms
    setEditingTopicId(null)
    setEditingThreadId(null)
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

  // Edit thread
  const handleEditThread = (channelId: number, threadConfigId: number) => {
    setEditingThreadId(threadConfigId)
    setEditingTopicId(null)
  }

  // Cancel thread edit
  const handleEditThreadCancel = () => {
    setEditingThreadId(null)
  }

  // Delete thread — show confirmation
  const handleDeleteThread = (
    channelId: number,
    threadConfigId: number,
    threadName: string
  ) => {
    setSubEntityDeleteConfirm({
      channelId,
      subEntityId: threadConfigId,
      subEntityName: threadName,
      type: "thread",
    })
  }

  // Save thread edit
  const handleThreadSave = async (
    channelId: number,
    threadConfigId: number,
    name: string,
    threadId: string
  ) => {
    await updateThreadInChannel(channelId, threadConfigId, { name, threadId })
    await refreshChannels()
    setEditingThreadId(null)
  }

  // Confirm sub-entity delete
  const handleConfirmSubEntityDelete = async () => {
    if (!subEntityDeleteConfirm) return
    const { channelId, subEntityId, type } = subEntityDeleteConfirm
    if (type === "topic") {
      await removeTopicFromChannel(channelId, subEntityId)
    } else {
      await removeThreadFromChannel(channelId, subEntityId)
    }
    await refreshChannels()
    setSubEntityDeleteConfirm(null)
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
      if (!result.success) {
        setTestErrors((prev) => ({ ...prev, [key]: result.error || "Unknown error" }))
        setTestErrorModal(result.error || "Test failed. Please check your configuration.")
      } else {
        setTestErrors((prev) => ({ ...prev, [key]: null }))
      }
    } catch {
      setTestStates((prev) => ({ ...prev, [key]: "error" }))
      setTestErrors((prev) => ({ ...prev, [key]: "Unexpected error occurred." }))
      setTestErrorModal("Unexpected error occurred.")
    }
    setTimeout(() => {
      setTestStates((prev) => ({ ...prev, [key]: "idle" }))
    }, 3000)
  }

  // -----------------------------------------------------------------------
  // Error Modal handlers (Step 9)
  // -----------------------------------------------------------------------
  // Error Modal handlers (Step 9)
  // -----------------------------------------------------------------------

  const handleShowTestError = (channelId: number) => {
    const key = `ch-${channelId}`
    const errorMsg = testErrors[key]
    setTestErrorModal(errorMsg || "Test failed. Please check your configuration.")
  }

  const handleShowSubEntityError = (channelId: number, itemId: number, platform: "telegram" | "discord") => {
    const key = platform === "telegram" ? `topic-${channelId}-${itemId}` : `thread-${channelId}-${itemId}`
    const errorMsg = testErrors[key]
    setTestErrorModal(errorMsg || "Test failed. Please check your configuration.")
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

  const handleUpdateChannel = async (channelId: number, updates: ChannelUpdate) => {
    await updateChannel(channelId, updates)
    await refreshChannels()
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

      {/* Scrollable: all accordion sections */}
      <div style={s.scrollableContent}>
      {/* Telegram Channels Section */}
      <CollapsibleSection
        title="TELEGRAM CHANNELS"
        isOpen={settingsUIState.sections?.telegram !== false}
        onToggle={() => handleToggleSection("telegram")}
      >
        {telegramChannels.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            testStates={testStates}
            testErrors={testErrors}
            onTestConnectivity={handleTestConnectivity}
            onRemoveChannel={handleRemoveChannel}
            onAddTopic={handleAddTopic}
            onEditTopic={handleEditTopic}
            onDeleteTopic={handleDeleteTopic}
            onTestTopic={handleTestTopic}
            onAddThread={() => {}}
            onEditThread={() => {}}
            onDeleteThread={() => {}}
            onTestThread={() => {}}
            onUpdateChannel={handleUpdateChannel}
            onTopicAdd={handleTopicAdd}
            onThreadAdd={handleThreadAdd}
            onTopicSave={handleTopicSave}
            onThreadSave={handleThreadSave}
            onEditTopicCancel={handleEditTopicCancel}
            onEditThreadCancel={handleEditThreadCancel}
            onToast={setToast}
            onTopicId1Blocked={() => {
              setTopicId1Modal(true)
              setActiveFormId(null)
            }}
            onRefresh={refreshChannels}
            activeFormId={activeFormId}
            setActiveFormId={setActiveFormId}
            editingTopicId={editingTopicId}
            editingThreadId={editingThreadId}
            onShowTestError={handleShowTestError}
            onShowSubEntityError={(chId, itemId) => handleShowSubEntityError(chId, itemId, "telegram")}
            isActive={activeCardId === channel.id}
            onCardFocus={() => setActiveCardId(channel.id)}
            onCardBlur={() => setActiveCardId(null)}
            isCollapsed={settingsUIState.collapsedCards[channel.id.toString()] || false}
            onToggleCollapse={() => handleToggleCollapse(channel.id)}
          />
        ))}

        {/* Inline add Telegram channel form */}
        {activeFormId === "add-telegram" ? (
          <div style={s.inlineForm}>
            <div style={s.field}>
              <label style={s.label}>Account Name (optional)</label>
              <input
                style={s.input}
                placeholder="e.g. My Trading Account"
                value={addFormAccountName}
                onChange={(e) => setAddFormAccountName(e.target.value)}
                onFocus={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#0d9488"
                }}
                onBlur={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
                }}
              />
            </div>
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
                onBlur={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
                }}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Bot Token</label>
              <input
                style={s.input}
                placeholder="e.g. 123456:ABC-DEF..."
                value={addFormToken}
                onChange={(e) => setAddFormToken(e.target.value)}
                onFocus={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#0d9488"
                }}
                onBlur={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
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
                onBlur={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
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
      <CollapsibleSection
        title="DISCORD CHANNELS"
        isOpen={settingsUIState.sections?.discord !== false}
        onToggle={() => handleToggleSection("discord")}
      >
        {discordChannels.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            testStates={testStates}
            testErrors={testErrors}
            onTestConnectivity={handleTestConnectivity}
            onRemoveChannel={handleRemoveChannel}
            onAddTopic={() => {}}
            onEditTopic={() => {}}
            onDeleteTopic={() => {}}
            onTestTopic={() => {}}
            onAddThread={handleAddThread}
            onEditThread={handleEditThread}
            onDeleteThread={handleDeleteThread}
            onTestThread={handleTestThread}
            onUpdateChannel={handleUpdateChannel}
            onTopicAdd={handleTopicAdd}
            onThreadAdd={handleThreadAdd}
            onTopicSave={handleTopicSave}
            onThreadSave={handleThreadSave}
            onEditTopicCancel={handleEditTopicCancel}
            onEditThreadCancel={handleEditThreadCancel}
            onToast={setToast}
            onTopicId1Blocked={() => {
              setTopicId1Modal(true)
              setActiveFormId(null)
            }}
            onRefresh={refreshChannels}
            activeFormId={activeFormId}
            setActiveFormId={setActiveFormId}
            editingTopicId={editingTopicId}
            editingThreadId={editingThreadId}
            onShowTestError={handleShowTestError}
            onShowSubEntityError={(chId, itemId) => handleShowSubEntityError(chId, itemId, "discord")}
            isActive={activeCardId === channel.id}
            onCardFocus={() => setActiveCardId(channel.id)}
            onCardBlur={() => setActiveCardId(null)}
            isCollapsed={settingsUIState.collapsedCards[channel.id.toString()] || false}
            onToggleCollapse={() => handleToggleCollapse(channel.id)}
          />
        ))}

        {/* Inline add Discord channel form */}
        {activeFormId === "add-discord" ? (
          <div style={s.inlineForm}>
            <div style={s.field}>
              <label style={s.label}>Server Name (optional)</label>
              <input
                style={s.input}
                placeholder="e.g. Trading Server"
                value={addFormServerName}
                onChange={(e) => setAddFormServerName(e.target.value)}
                onFocus={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#0d9488"
                }}
                onBlur={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
                }}
              />
            </div>
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
                onBlur={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
                }}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Webhook URL</label>
              <input
                style={s.input}
                placeholder="https://discord.com/api/webhooks/..."
                value={addFormWebhookUrl}
                onChange={(e) => setAddFormWebhookUrl(e.target.value)}
                onFocus={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#0d9488"
                }}
                onBlur={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
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

      {/* Message Templates Section */}
      <CollapsibleSection
        title="Message Templates"
        isOpen={settingsUIState.sections?.["message-templates"] === true}
        onToggle={() => handleToggleSection("message-templates")}
      >
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
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            >
              <SortableContext
                items={templates.map((t) => t.id.toString())}
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

      {/* Keyboard Shortcuts Section */}
      <CollapsibleSection
        title="Keyboard Shortcuts"
        isOpen={settingsUIState.sections?.shortcuts === true}
        onToggle={() => handleToggleSection("shortcuts")}
      >
        {shortcutInfo === null ? (
          <p style={s.shortcutLoading}>Checking shortcut assignment...</p>
        ) : !shortcutInfo.isSet ? (
          <>
            <div style={s.shortcutWarning}>
              <span style={s.warningIcon}>⚠️</span>
              <span style={s.warningText}>No keyboard shortcut assigned</span>
            </div>
            <p style={s.shortcutHint}>
              Please set a shortcut in Chrome Settings for &quot;Capture Screenshot from TradingView Chart&quot;.
            </p>
            <p style={s.shortcutSectionLabel}>Recommended Shortcut:</p>
            <div style={s.shortcutRow}>
              <kbd style={s.kbd}>
                <><span>⌥</span><span style={{ marginLeft: 4 }}>Option</span></>
              </kbd>
              <span style={s.shortcutPlus}>+</span>
              <kbd style={s.kbd}><span>S</span></kbd>
              <span style={s.shortcutLabel}>for Mac</span>
            </div>
            <div style={s.shortcutRow}>
              <kbd style={s.kbd}><span>Alt</span></kbd>
              <span style={s.shortcutPlus}>+</span>
              <kbd style={s.kbd}><span>S</span></kbd>
              <span style={s.shortcutLabel}>for Windows</span>
            </div>
            <button
              style={s.shortcutLink}
              onClick={() => chrome.tabs.create({ url: "chrome://extensions/shortcuts" })}
            >
              Set shortcut in Chrome settings
            </button>
          </>
        ) : (
          (() => {
            const parsedKeys = parseShortcut(shortcutInfo.shortcut)
            const isMac = navigator.platform.includes("Mac")
            return (
              <>
                <p style={s.shortcutSectionLabel}>Currently Selected Shortcut:</p>
                <div style={s.shortcutRow}>
                  {parsedKeys.map((key, i) => {
                    const display = getKeyDisplay(key, isMac)
                    return (
                      <Fragment key={i}>
                        {i > 0 && <span style={s.shortcutPlus}>+</span>}
                        <kbd style={s.kbd}>
                          {display ? (
                            isMac ? (
                              <><span>{display.symbol}</span><span style={{ marginLeft: 4 }}>{display.label}</span></>
                            ) : (
                              <span>{display.label}</span>
                            )
                          ) : (
                            <span>{key}</span>
                          )}
                        </kbd>
                      </Fragment>
                    )
                  })}
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
              </>
            )
          })()
        )}
      </CollapsibleSection>

      {/* Feedback Section (Phase 39) */}
      <CollapsibleSection
        title="FEEDBACK"
        isOpen={settingsUIState.sections?.feedback === true}
        onToggle={() => handleToggleSection("feedback")}
      >
        <p style={s.feedbackHint}>
          Send feedback directly to the developer. Your extension version and platform info will be included automatically.
        </p>

        {/* Name field (optional) */}
        <div style={s.feedbackField}>
          <label style={s.feedbackLabel}>Name (optional)</label>
          <input
            style={s.feedbackInput}
            placeholder="Your Name"
            value={feedbackName}
            onChange={(e) => setFeedbackName(e.target.value)}
            disabled={feedbackState === "loading"}
            onFocus={(e) => {
              (e.target as HTMLInputElement).style.borderColor = "#0d9488"
            }}
            onBlur={(e) => {
              (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
            }}
          />
        </div>

        {/* Topic dropdown */}
        <div style={s.feedbackField}>
          <label style={s.feedbackLabel}>Topic</label>
          <select
            style={s.feedbackSelect}
            value={feedbackTopic}
            onChange={(e) => setFeedbackTopic(e.target.value)}
            disabled={feedbackState === "loading"}
          >
            <option value="General">General</option>
            <option value="Bug Report">Bug Report</option>
            <option value="User Interface">User Interface</option>
            <option value="Settings">Settings</option>
            <option value="Telegram">Telegram</option>
            <option value="Discord">Discord</option>
            <option value="Feature Request">Feature Request</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Message textarea */}
        <div style={s.feedbackField}>
          <label style={s.feedbackLabel}>Message</label>
          <textarea
            style={s.feedbackTextarea}
            placeholder="Describe your feedback, bug, or suggestion..."
            value={feedbackMessage}
            onChange={(e) => setFeedbackMessage(e.target.value)}
            disabled={feedbackState === "loading"}
            rows={6}
            onFocus={(e) => {
              (e.target as HTMLTextAreaElement).style.borderColor = "#0d9488"
            }}
            onBlur={(e) => {
              (e.target as HTMLTextAreaElement).style.borderColor = "#3a3f4a"
            }}
          />
        </div>

        {/* Send button with state feedback */}
        <div style={s.feedbackButtonRow}>
          {feedbackState === "idle" && (
            <button
              style={
                feedbackMessage.trim()
                  ? s.feedbackButton
                  : s.feedbackButtonDisabled
              }
              disabled={!feedbackMessage.trim()}
              onClick={handleSendFeedback}
            >
              Send Feedback
            </button>
          )}
          {feedbackState === "loading" && (
            <button style={s.feedbackButtonLoading} disabled>
              Sending...
            </button>
          )}
          {feedbackState === "success" && (
            <button style={s.feedbackButtonSuccess} disabled>
              Feedback Sent!
            </button>
          )}
          {feedbackState === "error" && (
            <button style={s.feedbackButtonError} disabled>
              {feedbackError || "Send Failed"}
            </button>
          )}
        </div>
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

      {/* Delete Confirmation Dialog for Sub-Entities */}
      {subEntityDeleteConfirm && (
        <ConfirmDialog
          title={`Delete ${subEntityDeleteConfirm.type === "topic" ? "Topic" : "Thread"}?`}
          message={`Are you sure you want to delete "${subEntityDeleteConfirm.subEntityName}"? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={handleConfirmSubEntityDelete}
          onCancel={() => setSubEntityDeleteConfirm(null)}
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

      {/* Error Modal for Test Failures */}
      {testErrorModal && (
        <div style={s.overlay}>
          <div style={s.popup}>
            <p style={s.popupTitle}>Connection Test Failed</p>
            <p style={{ ...s.popupText, whiteSpace: "pre-wrap" as const }}>{testErrorModal}</p>
            <div style={s.popupButtons}>
              <button
                style={{ ...s.popupCancelButton, flex: 1 }}
                onClick={() => setTestErrorModal(null)}
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
        </div>
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
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Help View — Setup Guide (Telegram, Discord, Topics, Threads)
// ---------------------------------------------------------------------------

function HelpView({
  onBack,
}: {
  onBack: () => void
}) {
  const [activeTab, setActiveTab] = useState<
    "telegram-groups" | "telegram-topics" | "discord-channels" | "discord-threads"
  >("telegram-groups")

  const styles: Record<string, React.CSSProperties> = {
    platformBar: {
      display: "flex",
      gap: 12,
      marginBottom: 16,
      flexShrink: 0,
    },
    platformBox: {
      flex: 1,
      border: "1px solid #2c3038",
      borderRadius: 12,
      backgroundColor: "rgba(37, 40, 48, 0.4)",
      overflow: "hidden",
    },
    platformLabel: {
      padding: "10px 0 6px",
      textAlign: "center",
      fontSize: 12,
      fontWeight: 700,
      color: "#14b8a6",
      letterSpacing: "0.5px",
      textTransform: "uppercase" as const,
    },
    tabBar: {
      display: "flex",
      gap: 4,
      padding: "0 8px",
      borderBottom: "1px solid #3a3f4a",
    },
    tab: {
      flex: 1,
      padding: "8px 12px",
      border: "none",
      borderRadius: "6px 6px 0 0",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      backgroundColor: "transparent",
      color: "#6b7280",
      transition: "all 150ms",
      textAlign: "center" as const,
    },
    tabActive: {
      flex: 1,
      padding: "8px 12px",
      border: "none",
      borderRadius: "6px 6px 0 0",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      backgroundColor: "#252830",
      color: "#14b8a6",
      borderBottom: "2px solid #0d9488",
      textAlign: "center" as const,
    },
    contentArea: {
      flex: 1,
      overflow: "auto",
      padding: "0 4px",
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

      {/* Platform Selection Bar */}
      <div style={styles.platformBar}>
        {/* Telegram Box */}
        <div style={styles.platformBox}>
          <div style={styles.platformLabel}>Telegram</div>
          <div style={styles.tabBar}>
            <button
              style={activeTab === "telegram-groups" ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab("telegram-groups")}
            >
              Groups
            </button>
            <button
              style={activeTab === "telegram-topics" ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab("telegram-topics")}
            >
              Topics
            </button>
          </div>
        </div>

        {/* Discord Box */}
        <div style={styles.platformBox}>
          <div style={styles.platformLabel}>Discord</div>
          <div style={styles.tabBar}>
            <button
              style={activeTab === "discord-channels" ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab("discord-channels")}
            >
              Channels
            </button>
            <button
              style={activeTab === "discord-threads" ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab("discord-threads")}
            >
              Threads
            </button>
          </div>
        </div>
      </div>

      {/* Full-width Content */}
      <div style={styles.contentArea}>
        {activeTab === "telegram-groups" && (
          <>
            {/* Preface */}
            <div style={s.helpSection}>
              <p style={{ ...s.helpText, marginTop: 0 }}>
                TV Capture uses a Telegram bot to send your trading screenshots to your
                Telegram groups. A Telegram bot uses a <strong>Bot Token</strong> to identify
                itself to the Telegram API.
              </p>
              <p style={s.helpText}>
                One bot can send to multiple groups and topics.
              </p>
            </div>

            {/* STEP 1 */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>STEP 1: Get Your Bot Token</h2>
              <div style={s.helpTip}>
                <p style={{ margin: 0 }}>
                  <strong>Already have a bot set up?</strong> If you already have a bot token and only want to add a new Telegram group or channel, you can skip directly to <strong>Step 2</strong> to find the Chat ID.
                </p>
              </div>

              {/* Option A: New Bot */}
              <div style={s.helpSubsection}>
                <h3 style={s.helpSubsectionTitle}>A. Create a new bot</h3>
                <p style={s.helpText}>Use this if you don't have a Telegram bot yet.</p>
                <ol style={s.helpList}>
                  <li>Open Telegram and search for <strong>@BotFather</strong></li>
                  <li>Send: <code style={s.code}>/newbot</code></li>
                  <li>Enter a display name (e.g. "TV Capture")</li>
                  <li>Enter a username ending in <strong>"bot"</strong><br/>
                    <span style={s.helpHint}>(e.g. "my_trading_bot" or "tvcapture_bot")</span>
                  </li>
                  <li><span style={s.helpSuccess}>✅ Done!</span> BotFather responds with your Bot Token</li>
                  <li><strong>Copy the Bot Token</strong></li>
                </ol>
                <div style={s.helpTip}>
                  <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                    This is what a Bot Token looks like:
                  </p>
                  <code style={s.codeBlock}>123456789:ABCdefGHIjklMNOpqrsTUVwxyz</code>
                </div>
                <div style={s.helpWarning}>
                  <p style={{ margin: 0 }}>
                    ⚠️ After creating your bot, you must <strong>disable Privacy Mode</strong>{" "}
                    for it to work in groups → <strong>see section (C) below</strong>
                  </p>
                </div>
              </div>

              {/* Option B: Existing Bot */}
              <div style={s.helpSubsection}>
                <h3 style={s.helpSubsectionTitle}>B. Read token from an existing bot</h3>
                <p style={s.helpText}>
                  Already have a bot? Ask @BotFather to show you the Bot Token again.
                </p>
                <ol style={s.helpList}>
                  <li>Open <strong>@BotFather</strong> in Telegram</li>
                  <li>Send: <code style={s.code}>/mybots</code></li>
                  <li>Tap your bot's username in the list</li>
                  <li>Tap <strong>"API Token"</strong> — your Bot Token is displayed</li>
                  <li><strong>Copy the Bot Token</strong></li>
                </ol>
              </div>

              {/* Option C: Privacy Mode */}
              <div style={s.helpSubsection}>
                <h3 style={s.helpSubsectionTitle}>C. Disable Privacy Mode (Required for Groups)</h3>
                <p style={s.helpText}>
                  <strong>What is Privacy Mode?</strong> Telegram bots have Privacy Mode enabled
                  by default. This means the bot cannot send messages in groups.
                </p>
                <p style={s.helpText}>
                  <strong>Fix:</strong> Disable Privacy Mode in @BotFather. Do this once, right
                  after creating your bot.
                </p>
                <ol style={s.helpList}>
                  <li>Open <strong>@BotFather</strong></li>
                  <li>Send: <code style={s.code}>/mybots</code></li>
                  <li>Select your bot</li>
                  <li>Tap <strong>Bot Settings</strong> → <strong>Group Privacy</strong></li>
                  <li>Tap <strong>"Disable"</strong></li>
                </ol>
                <div style={s.helpTip}>
                  <p style={{ margin: 0 }}><strong>Confirmation message:</strong></p>
                  <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0" }}>
                    "Group privacy is disabled. Bot will receive all messages in groups."
                  </p>
                </div>
                <p style={{ ...s.helpText, marginBottom: 0 }}>
                  <strong>Done.</strong> Your bot can now send messages to groups.
                </p>
              </div>
            </div>

            {/* STEP 2 */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>STEP 2: Get Your Group Chat ID</h2>
              <p style={s.helpText}>
                The <strong>Bot Token</strong> identifies your bot (who sends).
                The <strong>Chat ID</strong> identifies your group (where to send).
                Every group has its own unique Chat ID.
              </p>

              <ol style={{ ...s.helpList, marginBottom: 12 }}>
                <li>
                  <strong>Add your bot to the group</strong><br/>
                  Open your group in Telegram → tap the group name at the top →
                  "Add Members" → search for your bot's username →
                  tap <strong>Add</strong><br/>
                  <span style={s.helpHint}>
                    Search for your bot's username (e.g. "@my_trading_bot" or "@tv_capture_bot").
                  </span>
                </li>
                <li>
                  <strong>Send any message in the group</strong><br/>
                  Type something like "test" and send it.<br/>
                  <span style={s.helpHint}>
                    The bot needs to "see" a message so it appears in getUpdates. Allow 5–10 seconds for the bot to receive the message.
                  </span>
                </li>
                <li>
                  <strong>Open this URL in your browser</strong><br/>
                  Have your Bot Token from Step 1 ready. Open this URL in your browser:<br/>
                  <code style={s.codeBlock}>
                    https://api.telegram.org/bot{'<YOUR_BOT_TOKEN>'}/getUpdates
                  </code>
                  <span style={s.helpHint}>
                    Replace {'<YOUR_BOT_TOKEN>'} with your actual Bot Token.
                  </span>
                </li>
                <li>
                  <strong>Find your Chat ID in the JSON response</strong><br/>
                  The JSON may contain multiple entries if your bot is in several groups.
                  Look for the entry where <strong>"title"</strong> matches your group name,
                  then copy the <strong>"id"</strong> from the <strong>"chat"</strong> object.
                  <span style={s.helpHint}>
                    Your test message is typically the last entry. Scroll to the bottom of the JSON output and verify the "title" matches your group.
                  </span>
                </li>
              </ol>
              <pre style={s.jsonBlock}>{`{
  "ok": true,
  "result": [
    {
      "message": {
        "chat": {
          "id": -1234567890,       ← YOUR CHAT ID
          "title": "Your Group",
          "type": "group"
        },
        "text": "test"
      }
    }
  ]
}`}</pre>
              <ol style={s.helpList} start={5}>
                <li>
                  <strong>Copy the Chat ID</strong> (including the minus sign!)<br/>
                  <span style={s.helpHint}>
                    For a standard group, the Chat ID is a negative number starting with "-".
                    Example: <code style={s.code}>-1234567890</code>
                  </span>
                </li>
              </ol>

              <div style={s.helpWarning}>
                <p style={{ margin: 0 }}><strong>Empty result? {"{"}"ok": true, "result": []{"}"}</strong></p>
                <p style={{ margin: "4px 0 0", fontSize: 12 }}>
                  → Make sure Privacy Mode is disabled (see <strong>Step 1 → section (C)</strong>).<br/>
                  → If it is already disabled, send another test message in the group<br/>
                  &nbsp;&nbsp;and refresh the URL in your browser.
                </p>
              </div>
            </div>

            {/* STEP 3 */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>STEP 3: Setup Your Telegram Channel</h2>
              <ol style={s.helpList}>
                <li>
                  Go to the <strong>Settings</strong> page in TV Capture
                </li>
                <li>
                  In the <strong>Telegram Channel</strong> section, click{" "}
                  <strong>"+ Add Telegram Channel"</strong>
                </li>
                <li>
                  Copy your <strong>Bot Token</strong> into the "Bot Token" field
                </li>
                <li>
                  Copy your <strong>Chat ID</strong> into the "Chat ID" field
                </li>
                <li>
                  Click <strong>"Test Connectivity"</strong> to verify everything works
                </li>
              </ol>
              <div style={s.helpTip}>
                <p style={{ margin: 0 }}>
                  ✅ If the test succeeds, you're all set! TV Capture can now send
                  screenshots to your Telegram group.
                </p>
              </div>
            </div>
          </>
        )}

        {activeTab === "telegram-topics" && (
          <>
            {/* Preface */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>What Are Telegram Topics?</h2>
              <p style={{ ...s.helpText, marginTop: 0 }}>
                By default, Telegram only lets you create <strong>normal groups</strong>.
                These are simple chats where all messages appear in one single feed.
              </p>
              <p style={s.helpText}>
                You can manually enable <strong>Topics</strong> for any group.
                This upgrades the group from a normal group to a <strong>Supergroup</strong>.
                See <strong>Step 1</strong> below for how to do this.
              </p>
              <p style={s.helpText}>
                Once Topics are enabled, you can create <strong>custom topics</strong> inside
                the Supergroup. Each topic acts like its own sub-channel with a dedicated
                message feed. Messages sent to a specific topic only appear in that topic.
              </p>
              <p style={s.helpText}>
                The original "main chat" becomes the <strong>General topic</strong>.
                Messages sent without selecting a specific topic land here automatically.
              </p>
              <p style={s.helpText}>
                Additionally, there is an <strong>"All"</strong> view that consolidates
                messages from every topic into a single chronological feed, so you can
                see all activity across the entire group at once.
              </p>
            </div>

            {/* STEP 1 */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>STEP 1: Enable Topics in Your Group</h2>
              <p style={s.helpText}>
                <strong>Prerequisite:</strong> You have already created a normal Telegram group.
                If you haven't set up a group yet, follow the <strong>Groups</strong> tab first.
              </p>
              <ol style={s.helpList}>
                <li>
                  Open your Telegram group
                </li>
                <li>
                  Tap the <strong>group name</strong> at the top of the chat
                </li>
                <li>
                  Tap <strong>Edit</strong> in the top-right corner
                </li>
                <li>
                  Scroll down to the <strong>Topics</strong> section
                  <span style={s.helpHint}>
                    This section is disabled by default for normal groups.
                  </span>
                </li>
                <li>
                  Toggle <strong>"Enable Topics"</strong> ON
                  <span style={s.helpHint}>
                    After toggling ON, wait 5–10 seconds before going back. Telegram needs time to save the setting. If it doesn't work on the first try, repeat this step until your group transitions into a supergroup.
                  </span>
                </li>
              </ol>
              <div style={s.helpTip}>
                <p style={{ margin: 0 }}>
                  <strong>Display options:</strong> Once Topics are enabled, you can choose how to view them:
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>
                  <strong>View as Tabs</strong> — Topics are shown as tabs at the top of the chat
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>
                  <strong>View as List</strong> — Topics are shown in a list format (like a folder structure)
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>
                  You can switch between these views anytime in the group settings.
                </p>
              </div>
              <div style={s.helpWarning}>
                <p style={{ margin: 0 }}>
                  <strong>Important:</strong> Enabling Topics is <strong>permanent</strong>. Once enabled, you cannot disable Topics or revert the group back to a normal chat.
                </p>
              </div>
            </div>

            {/* STEP 2 */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>STEP 2: Create a New Topic</h2>
              <ol style={s.helpList}>
                <li>
                  Open your <strong>Supergroup</strong> in Telegram
                </li>
                <li>
                  Tap the <strong>three dots</strong> (⋯) in the top-right corner
                </li>
                <li>
                  Select <strong>"New Topic"</strong>
                </li>
                <li>
                  Enter a <strong>name</strong> for your topic
                </li>
                <li>
                  Choose an <strong>emoji</strong> to represent the topic
                </li>
                <li>
                  Tap <strong>Create</strong>
                </li>
              </ol>
              <div style={s.helpTip}>
                <p style={{ margin: 0 }}>
                  <strong>Tip:</strong> You can create as many topics as you need.
                  Each topic gets its own message feed and can be selected individually
                  in TV Capture when sending screenshots.
                </p>
              </div>
            </div>

            {/* STEP 3 */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>STEP 3: Get Your Topic Share Link</h2>
              <p style={s.helpText}>
                The Share Link contains the <strong>Topic ID</strong> that TV Capture needs
                to send messages to this specific topic.
              </p>
              <ol style={s.helpList}>
                <li>
                  Open your <strong>Supergroup</strong> in Telegram
                </li>
                <li>
                  Select the <strong>topic</strong> you want to use
                </li>
                <li>
                  Tap the <strong>topic name</strong> at the top of the chat
                </li>
                <li>
                  <strong>Copy topic share link</strong>
                </li>
              </ol>
              <p style={s.helpText}>
                The link looks like:
              </p>
              <code style={s.codeBlock}>https://t.me/c/3719682271/2</code>
            </div>

            {/* STEP 4 */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>STEP 4: Setup Your Telegram Topic in TV Capture</h2>
              <ol style={s.helpList}>
                <li>
                  Go to the <strong>Settings</strong> page in TV Capture
                </li>
                <li>
                  Find your <strong>Telegram Channel</strong> (the Supergroup you set up earlier)
                </li>
                <li>
                  Click <strong>"[+ Add Topic]"</strong>
                </li>
                <li>
                  Enter a <strong>name</strong> for the topic (e.g. "Trading Signals")
                </li>
                <li>
                  Paste the <strong>Share Link</strong> from Step 3 into the link field
                  <span style={s.helpHint}>
                    TV Capture automatically extracts the Topic ID from the link.
                  </span>
                </li>
                <li>
                  Click <strong>"Add"</strong>
                </li>
                <li>
                  Click <strong>"Test Connectivity"</strong> to verify the topic works
                </li>
              </ol>
              <div style={s.helpTip}>
                <p style={{ margin: 0 }}>
                  ✅ If the test succeeds, you're all set! TV Capture can now send
                  screenshots to this specific topic.
                </p>
              </div>
              <div style={s.helpWarning}>
                <p style={{ margin: 0 }}>
                  <strong>Note:</strong> The <strong>General topic</strong> (Topic ID 1) is already
                  covered by your main channel configuration. You don't need to add it separately —
                  messages sent without selecting a topic land there automatically.
                </p>
              </div>
            </div>

            {/* INFO: Send Messages to Closed Topics */}
            <div style={s.helpSection}>
              <h2 style={s.helpSectionTitle}>Info: Send Messages to Closed Topics</h2>
              <p style={{ ...s.helpText, marginTop: 0 }}>
                In Telegram, topics (including the General topic) can be closed. When a topic is closed, the bot cannot send messages to that channel or topic — unless it has admin rights.
              </p>
              <div style={s.helpWarning}>
                <p style={{ margin: 0 }}>
                  <strong>What you see:</strong> If you try to send a message and the topic is closed, the send fails with the error <strong>"TOPIC_CLOSED"</strong>.
                </p>
              </div>
              <p style={s.helpText}>
                <strong>If you still want to send messages to closed topics via your bot,</strong> follow these steps to give the bot admin rights:
              </p>
              <ol style={s.helpList}>
                <li>
                  Open your Telegram Supergroup
                </li>
                <li>
                  Tap the <strong>group name</strong> at the top of the chat
                </li>
                <li>
                  Tap <strong>Edit</strong> in the top-right corner
                </li>
                <li>
                  Scroll down and tap <strong>Administrators</strong>
                </li>
                <li>
                  Tap <strong>Add Admin</strong>
                </li>
                <li>
                  Search for your <strong>bot's username</strong> (e.g. @my_trading_bot) and select it
                </li>
                <li>
                  <strong>Deselect all permissions</strong> except <strong>"Manage Topics"</strong>
                  <span style={s.helpHint}>
                    The bot only needs "Manage Topics" to post in closed topics. All other permissions can be disabled for security.
                  </span>
                </li>
                <li>
                  Tap <strong>Done</strong> or <strong>Add Admin</strong>
                </li>
              </ol>
              <div style={s.helpTip}>
                <p style={{ margin: 0 }}>
                  <strong>Result:</strong> The bot is now an admin with "Manage Topics" permission. It can send messages to <strong>any</strong> closed topic, including the General topic.
                </p>
              </div>
              <div style={s.helpWarning}>
                <p style={{ margin: 0 }}>
                  <strong>Note:</strong> Closing or reopening topics sometimes does not work reliably in the <strong>Telegram mobile app</strong>. For best results, use the <strong>Telegram Desktop app</strong> or <strong>Telegram Web</strong>.
                </p>
              </div>
            </div>
          </>
        )}

        {activeTab === "discord-channels" && (
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
                <p style={{ margin: 0 }}><strong>Your webhook URL looks like:</strong></p>
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
                <p style={{ margin: 0 }}><strong>A Thread ID looks like:</strong></p>
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
                <p style={{ margin: 0 }}><strong>"Invalid Webhook" or "Unknown Webhook"</strong></p>
                <p style={{ ...s.helpHint, margin: "4px 0 0" }}>→ Webhook URL is wrong or the webhook was deleted</p>
                <p style={s.helpHint}>→ Create a new webhook and update the URL</p>
              </div>
              <div style={s.helpTroubleshoot}>
                <p style={{ margin: 0 }}><strong>"Missing Permissions"</strong></p>
                <p style={{ ...s.helpHint, margin: "4px 0 0" }}>→ The webhook doesn't have permission to post in the target channel</p>
                <p style={s.helpHint}>→ Check channel permissions and webhook integration settings</p>
              </div>
              <div style={s.helpTroubleshoot}>
                <p style={{ margin: 0 }}><strong>Thread ID not working</strong></p>
                <p style={{ ...s.helpHint, margin: "4px 0 0" }}>→ Make sure the thread exists in the channel</p>
                <p style={s.helpHint}>→ Verify Developer Mode is enabled when copying the ID</p>
                <p style={s.helpHint}>→ The webhook must have permission to send to the thread</p>
              </div>
            </div>
          </>
        )}

        {activeTab === "discord-threads" && (
          <div style={s.helpSection}>
            <p style={{ ...s.helpText, marginTop: 0, color: "#6b7280", fontStyle: "italic" }}>
              Discord threads setup guide coming soon.
            </p>
          </div>
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
  // Container for settings view (flex column layout for sticky header)
  settingsContainer: {
    padding: 16,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    color: "#e5e7eb",
    backgroundColor: "#1e2028",
    height: "100vh",
    boxSizing: "border-box" as const,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden" as const,
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
    padding: "12px 0",
    flexShrink: 0,
    marginLeft: -16,
    marginRight: -16,
    paddingLeft: 16,
    paddingRight: 16,
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
  // Feedback section styles (Phase 39)
  feedbackHint: {
    fontSize: 12,
    color: "#6b7280",
    margin: "0 0 12px",
    lineHeight: 1.5,
  },
  feedbackField: {
    marginBottom: 12,
  },
  feedbackLabel: {
    display: "block",
    fontSize: 12,
    fontWeight: 500,
    color: "#9ca3af",
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: "0.03em",
  },
  feedbackInput: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #3a3f4a",
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
    backgroundColor: "#252830",
    color: "#e5e7eb",
    transition: "border-color 150ms",
    outline: "none",
  },
  feedbackSelect: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #3a3f4a",
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
    backgroundColor: "#252830",
    color: "#e5e7eb",
    transition: "border-color 150ms",
    outline: "none",
    cursor: "pointer",
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: 36,
  },
  feedbackTextarea: {
    width: "100%",
    padding: "12px",
    border: "1px solid #3a3f4a",
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
    backgroundColor: "#252830",
    color: "#e5e7eb",
    transition: "border-color 150ms",
    outline: "none",
    resize: "none" as const,
    minHeight: 160,
    lineHeight: 1.5,
  },
  feedbackButtonRow: {
    marginTop: 4,
  },
  feedbackButton: {
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
  feedbackButtonDisabled: {
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
  feedbackButtonLoading: {
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
  feedbackButtonSuccess: {
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
  feedbackButtonError: {
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
    display: "inline-flex",
    alignItems: "center",
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
  shortcutSectionLabel: {
    fontSize: 13,
    color: "#9ca3af",
    margin: "0 0 6px",
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
  shortcutLoading: {
    fontSize: 13,
    color: "#6b7280",
    margin: "0 0 8px",
  },
  shortcutWarning: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    padding: "8px 12px",
    backgroundColor: "rgba(234, 179, 8, 0.1)",
    border: "1px solid rgba(234, 179, 8, 0.3)",
    borderRadius: 6,
  },
  warningIcon: {
    fontSize: 14,
  },
  warningText: {
    fontSize: 13,
    color: "#eab308",
    fontWeight: 500,
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
    resize: "none" as const,
    minHeight: 160,
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
    backgroundColor: "#252830",
    color: "#e5e7eb",
    transition: "border-color 150ms",
    outline: "none",
  },
  textareaError: {
    flex: 1,
    width: "100%",
    padding: "12px",
    border: "1px solid #ef4444",
    borderRadius: 8,
    fontSize: 14,
    resize: "none" as const,
    minHeight: 160,
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
    backgroundColor: "#252830",
    color: "#e5e7eb",
    outline: "none",
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
  sendingButton: {
    padding: "12px 16px",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "not-allowed",
    backgroundColor: "rgba(13, 148, 136, 0.15)",
    color: "#14b8a6",
    transition: "all 150ms",
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
  // Send result as button replacement — same field, same dimensions
  sendSuccessButton: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    textAlign: "center" as const,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    color: "#10b981",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    boxSizing: "border-box" as const,
    cursor: "default",
  },
  sendErrorButton: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    textAlign: "center" as const,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    color: "#ef4444",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    boxSizing: "border-box" as const,
    cursor: "default",
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
    backgroundColor: "rgba(37, 40, 48, 0.5)",
    color: "#14b8a6",
    marginTop: 0,
    transition: "all 150ms",
  },
  hintText: {
    fontSize: 12,
    color: "#6b7280",
    margin: "0 0 8px 0",
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
    flex: 1,
    overflowY: "auto" as const,
    minHeight: 0,
    // Hide scrollbar
    scrollbarWidth: "none" as const,
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
    padding: "6px 10px",
    margin: "6px 0",
  },
  helpTip: {
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    border: "1px solid rgba(59, 130, 246, 0.2)",
    borderRadius: 6,
    padding: "6px 10px",
    margin: "6px 0",
  },
  helpTroubleshoot: {
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    border: "1px solid rgba(239, 68, 68, 0.15)",
    borderRadius: 6,
    padding: "6px 10px",
    margin: "6px 0",
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
    top: 16,
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

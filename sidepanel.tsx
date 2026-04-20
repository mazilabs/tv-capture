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
} from "@dnd-kit/sortable"
import { MESSAGE_TYPES, type TestMessageResponse, type CaptureResponse, type SendScreenshotResponse } from "./lib-messages"
import {
  loadSettings,
  saveSettings,
  validateSettings,
  type Settings,
  type ValidationError,
} from "./lib-storage"
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type View = "capture" | "settings"

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
    <SettingsView onBack={() => setView("capture")} />
  ) : (
    <CaptureView onSettings={() => setView("settings")} />
  )
}

// ---------------------------------------------------------------------------
// Capture View
// ---------------------------------------------------------------------------

type CaptureState = "idle" | "capturing" | "captured" | "sending" | "error"
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

  // Load templates on mount
  useEffect(() => {
    getTemplates().then(setTemplates)
  }, [])

  // Auto-dismiss send result after 5 seconds
  useEffect(() => {
    if (!sendResult) return
    const timer = setTimeout(() => setSendResult(null), 5000)
    return () => clearTimeout(timer)
  }, [sendResult])

  // Listen for shortcut captures from background (Alt+S)
  useEffect(() => {
    const listener = (message: { type: string; dataUrl?: string; cropped?: boolean }) => {
      if (message.type === MESSAGE_TYPES.SHORTCUT_CAPTURE && message.dataUrl) {
        // Reload templates in case they changed in Settings
        getTemplates().then(setTemplates)

        setScreenshotUrl(message.dataUrl)
        setCaptureState("captured")
        setError(null)
        setSendResult(null)
        setMode("grid")
        setSelectedTemplateId(null)
        setIsCustom(false)
        setCaption("")
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

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
      } else {
        setError(response.error)
        setCaptureState("error")
      }
    } catch {
      setError("Failed to capture screenshot")
      setCaptureState("error")
    }
  }, [])

  // Send screenshot only (no caption)
  const handleSendScreenshotOnly = useCallback(async () => {
    if (!screenshotUrl) return

    setCaptureState("sending")
    setSendResult(null)

    try {
      const response = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SEND_PHOTO_WITH_CAPTION,
        dataUrl: screenshotUrl,
        // No caption
      })) as SendScreenshotResponse

      setSendResult(response)

      if (response.success) {
        // Clear and return to idle
        setScreenshotUrl(null)
        setCaptureState("idle")
        setMode("grid")
        setSelectedTemplateId(null)
        setIsCustom(false)
        setCaption("")
      } else {
        setCaptureState("captured")
      }
    } catch {
      setSendResult({ success: false, error: "Failed to send screenshot" })
      setCaptureState("captured")
    }
  }, [screenshotUrl])

  // Send with caption
  const handleSendWithCaption = useCallback(async () => {
    if (!screenshotUrl) return
    if (caption.length > 1024) return

    setCaptureState("sending")
    setSendResult(null)

    try {
      const response = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SEND_PHOTO_WITH_CAPTION,
        dataUrl: screenshotUrl,
        caption: caption,
      })) as SendScreenshotResponse

      setSendResult(response)

      if (response.success) {
        // Clear and return to idle
        setScreenshotUrl(null)
        setCaptureState("idle")
        setMode("grid")
        setSelectedTemplateId(null)
        setIsCustom(false)
        setCaption("")
      } else {
        // Stay in textarea mode for retry
        setCaptureState("captured")
      }
    } catch {
      setSendResult({ success: false, error: "Failed to send" })
      setCaptureState("captured")
    }
  }, [screenshotUrl, caption])

  const handleCancel = useCallback(() => {
    setScreenshotUrl(null)
    setError(null)
    setSendResult(null)
    setCaptureState("idle")
    setMode("grid")
    setSelectedTemplateId(null)
    setIsCustom(false)
    setCaption("")
  }, [])

  const handleRetry = useCallback(() => {
    setError(null)
    setCaptureState("idle")
  }, [])

  // Create new template from form
  const handleCreateTemplate = useCallback(async (name: string, body: string) => {
    await createTemplate(name, body)
    const updated = await getTemplates()
    setTemplates(updated)
    setMode("grid")
  }, [])

  return (
    <main style={s.container}>
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

      {/* Screenshot Preview */}
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
                ? "Press Alt+S on TradingView or click Capture"
                : captureState === "capturing"
                  ? "Capturing..."
                  : "No screenshot captured"}
            </p>
          </div>
        )}
      </div>

      {/* Template Views (only when screenshot captured) */}
      {screenshotUrl && mode === "grid" && (
        <div style={s.templateSection}>
          {/* Special Tiles Row */}
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

          {/* User Templates */}
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

      {/* Textarea View */}
      {screenshotUrl && mode === "textarea" && (
        <div style={s.textareaSection}>
          {/* Selected Template Info */}
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

          {/* Caption Textarea */}
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

      {/* Form View (New Template) */}
      {screenshotUrl && mode === "form" && (
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

      {/* Action Buttons */}
      <div style={s.buttonRow}>
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
          <button
            style={s.buttonLoading}
            disabled
          >
            Capturing...
          </button>
        )}

        {captureState === "captured" && mode === "grid" && screenshotUrl && (
          <>
            <button
              style={s.sendButton}
              onClick={handleSendScreenshotOnly}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = "#059669"
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = "#10b981"
              }}
            >
              Send Screenshot Only
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
          </>
        )}

        {captureState === "captured" && mode === "textarea" && screenshotUrl && (
          <>
            <button
              style={caption.length <= 1024 ? s.sendButton : s.sendButtonDisabled}
              disabled={caption.length > 1024 || captureState === "sending"}
              onClick={handleSendWithCaption}
              onMouseEnter={(e) => {
                if (caption.length <= 1024) {
                  (e.target as HTMLButtonElement).style.backgroundColor = "#059669"
                }
              }}
              onMouseLeave={(e) => {
                if (caption.length <= 1024) {
                  (e.target as HTMLButtonElement).style.backgroundColor = "#10b981"
                }
              }}
            >
              {captureState === "sending" ? "Sending..." : "Send"}
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
          </>
        )}

        {captureState === "sending" && mode !== "textarea" && (
          <button
            style={s.buttonLoading}
            disabled
          >
            Sending...
          </button>
        )}

        {captureState === "error" && (
          <>
            <button
              style={s.retryButton}
              onClick={handleRetry}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = "#d97706"
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = "#f59e0b"
              }}
            >
              Retry
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
          </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div style={s.errorMessage}>
          {error}
        </div>
      )}

      {/* Send Result */}
      {sendResult && (
        <div style={sendResult.success ? s.sendSuccess : s.sendError}>
          {sendResult.success
            ? "Screenshot sent to Telegram!"
            : sendResult.error}
        </div>
      )}
    </main>
  )
}

// ---------------------------------------------------------------------------
// Settings View
// ---------------------------------------------------------------------------

function SettingsView({
  onBack,
}: {
  onBack: () => void
}) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [feedback, setFeedback] = useState<"success" | null>(null)
  const [saving, setSaving] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  // Template state
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
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor)
  )

  // Load settings
  useEffect(() => {
    loadSettings().then(setSettings)
  }, [])

  // Load templates
  useEffect(() => {
    getTemplates().then(setTemplates)
  }, [])

  // Drag & Drop handlers
  const handleDragStart = useCallback((event: { active: { id: number } }) => {
    setDragActiveId(event.active.id)
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event

      // Clear active state
      setDragActiveId(null)

      if (!over || active.id === over.id) {
        return // No change
      }

      const oldIndex = templates.findIndex((t) => t.id === active.id)
      const newIndex = templates.findIndex((t) => t.id === over.id)

      if (oldIndex === -1 || newIndex === -1) {
        return
      }

      // Optimistic update
      const newTemplates = arrayMove(templates, oldIndex, newIndex)
      setTemplates(newTemplates)

      // Persist to storage
      const sortedIds = newTemplates.map((t) => t.id)
      await updateTemplateOrder(sortedIds)
    },
    [templates]
  )

  // Auto-dismiss feedback
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 2000)
    return () => clearTimeout(timer)
  }, [feedback])

  // Auto-dismiss test result
  useEffect(() => {
    if (!testResult) return
    const timer = setTimeout(() => setTestResult(null), 5000)
    return () => clearTimeout(timer)
  }, [testResult])

  const updateField = useCallback(
    (path: string, value: string) => {
      if (!settings) return
      const [group, field] = path.split(".")
      setSettings({
        ...settings,
        [group]: { ...settings[group as keyof Settings], [field]: value },
      })
      setErrors((prev) => prev.filter((e) => e.field !== path))
      setFeedback(null)
    },
    [settings],
  )

  const handleSave = useCallback(async () => {
    if (!settings) return
    const validationErrors = validateSettings(settings)
    setErrors(validationErrors)
    if (validationErrors.length > 0) return

    setSaving(true)
    try {
      await saveSettings(settings)
      setFeedback("success")
    } catch {
      setErrors([
        {
          field: "_general",
          message: "Failed to save settings. Please try again.",
        },
      ])
    } finally {
      setSaving(false)
    }
  }, [settings])

  const handleTestMessage = useCallback(async () => {
    if (!settings) return

    setTestLoading(true)
    setTestResult(null)

    try {
      const response = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SEND_TEST_MESSAGE,
      })) as TestMessageResponse

      setTestResult(response)
    } catch {
      setTestResult({ success: false, error: "Failed to send test message" })
    } finally {
      setTestLoading(false)
    }
  }, [settings])

  // Template handlers
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

  if (!settings) {
    return (
      <main style={s.settingsContainer}>
        <p style={{ color: "#9ca3af" }}>Loading settings...</p>
      </main>
    )
  }

  const fieldError = (field: string) => errors.find((e) => e.field === field)

  return (
    <main style={s.settingsContainer}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>Settings</h1>
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

      {/* Telegram Section */}
      <CollapsibleSection title="Telegram" defaultOpen={true}>
        <div style={s.field}>
          <label style={s.label}>Bot Token</label>
          <input
            type="password"
            style={fieldError("telegram.botToken") ? s.inputError : s.input}
            placeholder="e.g. 123456:ABC-DEF..."
            value={settings.telegram.botToken}
            onChange={(e) => updateField("telegram.botToken", e.target.value)}
            onFocus={(e) => {
              if (!fieldError("telegram.botToken")) {
                (e.target as HTMLInputElement).style.borderColor = "#0d9488"
              }
            }}
            onBlur={(e) => {
              if (!fieldError("telegram.botToken")) {
                (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
              }
            }}
          />
          {fieldError("telegram.botToken") && (
            <p style={s.errorText}>{fieldError("telegram.botToken").message}</p>
          )}
        </div>

        <div style={s.field}>
          <label style={s.label}>Chat ID</label>
          <input
            type="text"
            style={fieldError("telegram.chatId") ? s.inputError : s.input}
            placeholder="e.g. 987654321"
            value={settings.telegram.chatId}
            onChange={(e) => updateField("telegram.chatId", e.target.value)}
            onFocus={(e) => {
              if (!fieldError("telegram.chatId")) {
                (e.target as HTMLInputElement).style.borderColor = "#0d9488"
              }
            }}
            onBlur={(e) => {
              if (!fieldError("telegram.chatId")) {
                (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
              }
            }}
          />
          {fieldError("telegram.chatId") && (
            <p style={s.errorText}>{fieldError("telegram.chatId").message}</p>
          )}
        </div>

        {/* Test Connection Button */}
        <div style={s.testButtonRow}>
          <button
            style={testLoading ? s.testButtonDisabled : s.testButton}
            onClick={handleTestMessage}
            disabled={testLoading}
            onMouseEnter={(e) => {
              if (!testLoading) {
                (e.target as HTMLButtonElement).style.backgroundColor = "rgba(13, 148, 136, 0.15)"
              }
            }}
            onMouseLeave={(e) => {
              if (!testLoading) {
                (e.target as HTMLButtonElement).style.backgroundColor = "transparent"
              }
            }}
          >
            {testLoading ? "Sending..." : "Test Connection"}
          </button>
        </div>

        {/* Test Result Feedback */}
        {testResult && (
          <div style={testResult.success ? s.testSuccess : s.testError}>
            {testResult.success ? "Test message sent!" : testResult.error}
          </div>
        )}
      </CollapsibleSection>

      {/* Keyboard Shortcuts Section */}
      <CollapsibleSection title="Keyboard Shortcuts">
        <div style={s.shortcutRow}>
          <kbd style={s.kbd}>Alt</kbd>
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
            {/* Hint text */}
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

      {/* General error */}
      {fieldError("_general") && (
        <p style={s.errorText}>{fieldError("_general").message}</p>
      )}

      {/* Save */}
      <button
        style={saving ? s.saveButtonDisabled : s.saveButton}
        onClick={handleSave}
        disabled={saving}
        onMouseEnter={(e) => {
          if (!saving) {
            (e.target as HTMLButtonElement).style.backgroundColor = "#14b8a6"
          }
        }}
        onMouseLeave={(e) => {
          if (!saving) {
            (e.target as HTMLButtonElement).style.backgroundColor = "#0d9488"
          }
        }}
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>

      {/* Feedback */}
      {feedback === "success" && (
        <div style={s.feedbackSuccess}>Settings saved</div>
      )}

      {/* Delete Confirmation Popup */}
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
    overflowY: "auto" as const,
    scrollbarWidth: "none" as const, // Firefox
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
  // Save button
  saveButton: {
    width: "100%",
    padding: "12px 16px",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: "#0d9488",
    color: "#fff",
    marginTop: 8,
    transition: "background-color 150ms",
  },
  saveButtonDisabled: {
    width: "100%",
    padding: "12px 16px",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "not-allowed",
    backgroundColor: "#134e4a",
    color: "#6b7280",
    marginTop: 8,
  },
  feedbackSuccess: {
    textAlign: "center" as const,
    fontSize: 13,
    fontWeight: 600,
    marginTop: 8,
    padding: "8px 0",
    borderRadius: 8,
    color: "#10b981",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    border: "1px solid rgba(16, 185, 129, 0.3)",
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
  // Test message styles
  testButtonRow: {
    marginTop: 8,
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
    transition: "all 150ms",
  },
  testButtonDisabled: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #134e4a",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "not-allowed",
    backgroundColor: "transparent",
    color: "#6b7280",
  },
  testSuccess: {
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
  testError: {
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
  retryButton: {
    flex: 1,
    padding: "12px 16px",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: "#f59e0b",
    color: "#fff",
    transition: "background-color 150ms",
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
}

export default SidePanel

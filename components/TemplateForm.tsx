/**
 * TV Capture — Template Form Component
 *
 * Shared form for creating and editing templates.
 */

import { useState } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TemplateFormProps = {
  mode: "create" | "edit"
  initialName?: string
  initialBody?: string
  onSave: (name: string, body: string) => void
  onCancel: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_NAME_LENGTH = 50
const MAX_BODY_LENGTH = 1024

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateForm({
  mode,
  initialName = "",
  initialBody = "",
  onSave,
  onCancel,
}: TemplateFormProps) {
  const [name, setName] = useState(initialName)
  const [body, setBody] = useState(initialBody)

  const nameLength = name.length
  const bodyLength = body.length
  const nameValid = name.trim().length > 0 && nameLength <= MAX_NAME_LENGTH
  const bodyValid = bodyLength <= MAX_BODY_LENGTH
  const canSave = nameValid && bodyValid

  const styles: Record<string, React.CSSProperties> = {
    container: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 16,
      flex: 1,
      minHeight: 0,
    },
    title: {
      fontSize: 16,
      fontWeight: 600,
      margin: 0,
      flexShrink: 0,
    },
    field: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 4,
      flexShrink: 0,
    },
    // Body field fills remaining space
    bodyField: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 4,
      flex: 1,
      minHeight: 0,
    },
    label: {
      fontSize: 13,
      fontWeight: 500,
      color: "#374151",
    },
    input: {
      padding: "8px 12px",
      border: "1px solid #d1d5db",
      borderRadius: 6,
      fontSize: 14,
      outline: "none",
      width: "100%",
      boxSizing: "border-box" as const,
    },
    inputError: {
      padding: "8px 12px",
      border: "1px solid #ef4444",
      borderRadius: 6,
      fontSize: 14,
      outline: "none",
      width: "100%",
      boxSizing: "border-box" as const,
    },
    textarea: {
      flex: 1,
      padding: "8px 12px",
      border: "1px solid #d1d5db",
      borderRadius: 6,
      fontSize: 14,
      outline: "none",
      resize: "none" as const,
      minHeight: 80,
      width: "100%",
      boxSizing: "border-box" as const,
      fontFamily: "inherit",
    },
    textareaError: {
      flex: 1,
      padding: "8px 12px",
      border: "1px solid #ef4444",
      borderRadius: 6,
      fontSize: 14,
      outline: "none",
      resize: "none" as const,
      minHeight: 80,
      width: "100%",
      boxSizing: "border-box" as const,
      fontFamily: "inherit",
    },
    counter: {
      fontSize: 12,
      color: "#6b7280",
      textAlign: "right" as const,
    },
    counterError: {
      fontSize: 12,
      color: "#ef4444",
      textAlign: "right" as const,
    },
    errorText: {
      fontSize: 12,
      color: "#ef4444",
    },
    buttonRow: {
      display: "flex",
      gap: 8,
      marginTop: 8,
      flexShrink: 0,
    },
    cancelButton: {
      flex: 1,
      padding: "10px 16px",
      border: "1px solid #d1d5db",
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      backgroundColor: "#fff",
      color: "#6b7280",
    },
    saveButton: {
      flex: 1,
      padding: "10px 16px",
      border: "none",
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      backgroundColor: "#2563eb",
      color: "#fff",
    },
    saveButtonDisabled: {
      flex: 1,
      padding: "10px 16px",
      border: "none",
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 600,
      cursor: "not-allowed",
      backgroundColor: "#93c5fd",
      color: "#fff",
    },
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>
        {mode === "create" ? "New Template" : "Edit Template"}
      </h2>

      {/* Name Field */}
      <div style={styles.field}>
        <label style={styles.label}>Template Name</label>
        <input
          type="text"
          style={!nameValid && nameLength > 0 ? styles.inputError : styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., 📝 Default"
        />
        {nameLength > 0 && !nameValid && (
          <span style={styles.errorText}>
            {nameLength > MAX_NAME_LENGTH
              ? "Name too long"
              : "Name required"}
          </span>
        )}
      </div>

      {/* Body Field - fills remaining space */}
      <div style={styles.bodyField}>
        <label style={styles.label}>Template Message</label>
        <textarea
          style={!bodyValid ? styles.textareaError : styles.textarea}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Your caption text..."
        />
        <div style={!bodyValid ? styles.counterError : styles.counter}>
          {bodyLength}/{MAX_BODY_LENGTH} characters
        </div>
      </div>

      {/* Buttons */}
      <div style={styles.buttonRow}>
        <button style={styles.cancelButton} onClick={onCancel}>
          Cancel
        </button>
        <button
          style={canSave ? styles.saveButton : styles.saveButtonDisabled}
          disabled={!canSave}
          onClick={() => onSave(name.trim(), body)}
        >
          Save
        </button>
      </div>
    </div>
  )
}

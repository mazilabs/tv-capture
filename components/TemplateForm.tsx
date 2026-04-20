/**
 * TV Capture — Template Form Component
 *
 * Shared form for creating and editing templates.
 * 
 * Updated: Dark Glassmorphism theme (2026-04-20)
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
      color: "#e5e7eb",
    },
    field: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 6,
      flexShrink: 0,
    },
    // Body field fills remaining space
    bodyField: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 6,
      flex: 1,
      minHeight: 0,
    },
    label: {
      fontSize: 13,
      fontWeight: 600,
      color: "#9ca3af",
    },
    input: {
      padding: "10px 12px",
      border: "1px solid #3a3f4a",
      borderRadius: 8,
      fontSize: 14,
      outline: "none",
      width: "100%",
      boxSizing: "border-box" as const,
      backgroundColor: "#252830",
      color: "#e5e7eb",
      transition: "border-color 150ms",
    },
    inputError: {
      padding: "10px 12px",
      border: "1px solid #ef4444",
      borderRadius: 8,
      fontSize: 14,
      outline: "none",
      width: "100%",
      boxSizing: "border-box" as const,
      backgroundColor: "#252830",
      color: "#e5e7eb",
    },
    textarea: {
      flex: 1,
      padding: "10px 12px",
      border: "1px solid #3a3f4a",
      borderRadius: 8,
      fontSize: 14,
      outline: "none",
      resize: "none" as const,
      minHeight: 80,
      width: "100%",
      boxSizing: "border-box" as const,
      fontFamily: "inherit",
      backgroundColor: "#252830",
      color: "#e5e7eb",
      transition: "border-color 150ms",
    },
    textareaError: {
      flex: 1,
      padding: "10px 12px",
      border: "1px solid #ef4444",
      borderRadius: 8,
      fontSize: 14,
      outline: "none",
      resize: "none" as const,
      minHeight: 80,
      width: "100%",
      boxSizing: "border-box" as const,
      fontFamily: "inherit",
      backgroundColor: "#252830",
      color: "#e5e7eb",
    },
    counter: {
      fontSize: 11,
      color: "#6b7280",
      textAlign: "right" as const,
    },
    counterError: {
      fontSize: 11,
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
    saveButton: {
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
    saveButtonDisabled: {
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
          placeholder="e.g., Default"
          onFocus={(e) => {
            if (nameValid || nameLength === 0) {
              (e.target as HTMLInputElement).style.borderColor = "#0d9488"
            }
          }}
          onBlur={(e) => {
            if (nameValid || nameLength === 0) {
              (e.target as HTMLInputElement).style.borderColor = "#3a3f4a"
            }
          }}
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
          onFocus={(e) => {
            if (bodyValid) {
              (e.target as HTMLTextAreaElement).style.borderColor = "#0d9488"
            }
          }}
          onBlur={(e) => {
            if (bodyValid) {
              (e.target as HTMLTextAreaElement).style.borderColor = "#3a3f4a"
            }
          }}
        />
        <div style={!bodyValid ? styles.counterError : styles.counter}>
          {bodyLength}/{MAX_BODY_LENGTH} characters
        </div>
      </div>

      {/* Buttons */}
      <div style={styles.buttonRow}>
        <button 
          style={styles.cancelButton} 
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
        <button
          style={canSave ? styles.saveButton : styles.saveButtonDisabled}
          disabled={!canSave}
          onClick={() => onSave(name.trim(), body)}
          onMouseEnter={(e) => {
            if (canSave) {
              (e.target as HTMLButtonElement).style.backgroundColor = "#14b8a6"
            }
          }}
          onMouseLeave={(e) => {
            if (canSave) {
              (e.target as HTMLButtonElement).style.backgroundColor = "#0d9488"
            }
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}

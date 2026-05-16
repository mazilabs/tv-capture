/**
 * TV Capture — Template List Item Component
 *
 * Single template row with name + 3-dot menu.
 * 
 * Updated: Dark Glassmorphism theme (2026-04-20)
 */

import type { Template } from "../lib-templates"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TemplateListItemProps = {
  template: Template
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  dragHandleProps?: {
    attributes: Record<string, unknown>
    listeners: Record<string, unknown> | undefined
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateListItem({
  template,
  onEdit,
  onDelete,
  dragHandleProps,
}: TemplateListItemProps) {

  const styles: Record<string, React.CSSProperties> = {
    container: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "12px 16px",
      border: "1px solid #3a3f4a",
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: "rgba(37, 40, 48, 0.5)",
    },
    dragHandle: {
      cursor: "grab",
      fontSize: 14,
      color: "#6b7280",
      flexShrink: 0,
      userSelect: "none",
      touchAction: "none",
    },
    name: {
      fontSize: 14,
      fontWeight: 500,
      color: "#e5e7eb",
      flex: 1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    editButton: {
      padding: "4px 12px",
      border: "1px solid #3a3f4a",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      backgroundColor: "transparent",
      color: "#9ca3af",
      transition: "all 150ms",
    },
    deleteButton: {
      padding: "4px 8px",
      border: "none",
      background: "none",
      fontSize: 16,
      color: "#6b7280",
      cursor: "pointer",
      lineHeight: 1,
      transition: "color 150ms",
    },
  }

  return (
    <div style={styles.container} data-id={template.id}>
      {/* Drag Handle */}
      <span
        data-drag-handle
        style={styles.dragHandle}
        {...(dragHandleProps?.listeners || {})}
        {...(dragHandleProps?.attributes || {})}
      >
        ≡
      </span>
      <span style={styles.name}>{template.name}</span>
      <div style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
        <button
          style={styles.editButton}
          onClick={() => onEdit(template.id)}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.borderColor = "#4b5563"
            ;(e.target as HTMLButtonElement).style.color = "#e5e7eb"
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.borderColor = "#3a3f4a"
            ;(e.target as HTMLButtonElement).style.color = "#9ca3af"
          }}
        >
          Edit
        </button>
        <button
          style={styles.deleteButton}
          onClick={() => onDelete(template.id)}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.color = "#ef4444"
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.color = "#6b7280"
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}

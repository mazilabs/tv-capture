/**
 * SendSubEntityRow — a single topic/thread row inside a Send UI channel card.
 *
 * Renders:
 *   ≡ ☐ ● Topic/Thread Name
 *
 * - ≡ drag handle (receives listeners from SortableSendSubEntityRow wrapper)
 * - ☐ checkbox (teal when selected)
 * - ● bullet indicator (always visible)
 * - Name (ellipsis overflow)
 * - Click anywhere on row (except drag handle) toggles selection
 */

import React from "react"

export type SendSubEntityRowProps = {
  id: number
  name: string
  selected: boolean
  onToggle: () => void
  dragHandleProps?: {
    attributes: Record<string, unknown>
    listeners: Record<string, unknown> | undefined
  }
}

export function SendSubEntityRow({
  name,
  selected,
  onToggle,
  dragHandleProps,
}: SendSubEntityRowProps) {
  const handleRowClick = (e: React.MouseEvent) => {
    // Ignore clicks on the drag handle
    if (dragHandleProps?.listeners) {
      const target = e.target as HTMLElement
      if (target.closest("[data-drag-handle]")) return
    }
    onToggle()
  }

  return (
    <div
      style={{
        ...styles.row,
        backgroundColor: selected ? "rgba(13, 148, 136, 0.08)" : "transparent",
        borderLeft: selected ? "2px solid #0d9488" : "2px solid transparent",
      }}
      onClick={handleRowClick}
    >
      {/* Drag Handle */}
      <span
        data-drag-handle
        style={styles.dragHandle}
        {...(dragHandleProps?.listeners || {})}
        {...(dragHandleProps?.attributes || {})}
      >
        ≡
      </span>

      {/* Checkbox */}
      <div style={selected ? styles.checkboxSelected : styles.checkbox}>
        {selected && <span style={styles.checkmark}>✓</span>}
      </div>

      {/* Bullet */}
      <span style={styles.bullet}>●</span>

      {/* Name */}
      <span style={styles.name}>{name}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 4,
    cursor: "pointer",
    transition: "background-color 150ms",
    marginBottom: 2,
  },
  dragHandle: {
    cursor: "grab",
    fontSize: 14,
    color: "#6b7280",
    flexShrink: 0,
    userSelect: "none",
    touchAction: "none",
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    border: "2px solid #4b5563",
    backgroundColor: "transparent",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    width: 16,
    height: 16,
    borderRadius: 3,
    border: "2px solid #0d9488",
    backgroundColor: "#0d9488",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: {
    color: "#fff",
    fontSize: 10,
    lineHeight: 1,
  },
  bullet: {
    color: "#0d9488",
    fontSize: 8,
    flexShrink: 0,
  },
  name: {
    fontSize: 13,
    color: "#e5e7eb",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
  },
}

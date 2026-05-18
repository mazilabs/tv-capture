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
        borderLeft: selected ? "3px solid #14b8a6" : "3px solid transparent",
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

      {/* Name */}
      <span style={{ ...styles.name, color: selected ? "#14b8a6" : "#e5e7eb" }}>{name}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    borderRadius: 4,
    cursor: "pointer",
    transition: "background-color 150ms",
    // marginBottom removed — handled by SortableSendSubEntityRow wrapper for consistent drag spacing
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
    fontSize: 13,
    color: "#e5e7eb",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
  },
}

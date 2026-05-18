/**
 * TV Capture — Sortable Template Item Component
 *
 * Wraps TemplateListItem with drag & drop functionality using dnd-kit.
 * When dragging: the dragged item stays opaque, all OTHER items become semi-transparent.
 */

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { TemplateListItem } from "./TemplateListItem"
import type { Template } from "../lib-templates"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortableTemplateItemProps = {
  template: Template
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  activeId: string | null // ID of currently dragged item (null = no drag) — dnd-kit uses strings
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SortableTemplateItem({
  template,
  onEdit,
  onDelete,
  activeId,
}: SortableTemplateItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: template.id.toString() })

  // Visual feedback logic — CRITICAL: Box size must NEVER change during drag.
  // Only properties that don't affect layout:
  // - Border color (border always exists, only color changes)
  // - Background color
  // - Box shadow (no layout impact)
  // - Cursor, z-index, opacity of OTHER items
  const isOtherDragging = activeId !== null && activeId !== template.id.toString() && !isDragging

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
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
    borderRadius: 8,
    // Margin moved from inner element to wrapper for consistent spacing
    marginBottom: 8,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <TemplateListItem
        template={template}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  )
}

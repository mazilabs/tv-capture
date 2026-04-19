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
  activeId: number | null // ID of currently dragged item (null = no drag)
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
  } = useSortable({ id: template.id })

  // Visual feedback logic:
  // - This item is being dragged → stay opaque (opacity: 1), raise z-index
  // - Another item is being dragged → this item becomes semi-transparent (opacity: 0.5)
  // - No item being dragged → normal state (opacity: 1)
  const isOtherDragging = activeId !== null && activeId !== template.id && !isDragging

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isOtherDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TemplateListItem
        template={template}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  )
}

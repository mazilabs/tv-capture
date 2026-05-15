/**
 * SendChannelCard — selectable + D&D channel card for the Send UI.
 *
 * Compact card (no sub-entities):
 *   ┌─ ≡ ☐ TG: Main Group ─────────────────┐
 *   └──────────────────────────────────────┘
 *
 * Extended card (with sub-entities):
 *   ┌─ ≡ ☐ DC: Trading Alerts ─────────────┐
 *   │  ──────────────────────────────────── │
 *   │  ≡ ☐ ● AAPL Earnings               │
 *   │  ≡ ☐ ● BTC Long                    │
 *   └──────────────────────────────────────┘
 *
 * Channel-level drag handle on header (≡).
 * Sub-entity-level drag handles on each row (≡).
 * Inner DndContext handles sub-entity reordering within this card.
 */

import React, { useState } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { SendSubEntityRow } from "./SendSubEntityRow"
import type { Channel } from "../lib-channels"

export type SendChannelCardProps = {
  channel: Channel
  selected: boolean
  onToggleMain: () => void
  selectedSubEntities: Set<string>
  onToggleSubEntity: (channelId: number, subEntityId: number) => void
  subEntities: Array<{ id: number; name: string }>
  subEntityIds: number[]
  // D&D props for channel-level drag (passed from SortableSendChannelCard wrapper)
  dragHandleProps?: {
    attributes: Record<string, unknown>
    listeners: Record<string, unknown> | undefined
  }
  // Sub-entity D&D: these come from the parent if we should lift state up
  // but since the DndContext is local, we use local sensors
  onSubEntityDragEnd: (channelId: number, event: DragEndEvent) => void
}

export function SendChannelCard({
  channel,
  selected,
  onToggleMain,
  selectedSubEntities,
  onToggleSubEntity,
  subEntities,
  subEntityIds,
  dragHandleProps,
  onSubEntityDragEnd,
}: SendChannelCardProps) {
  // Local sensors for sub-entity D&D within this card
  const subEntitySensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const handleHeaderClick = (e: React.MouseEvent) => {
    // Ignore clicks on the drag handle
    if (dragHandleProps?.listeners) {
      const target = e.target as HTMLElement
      if (target.closest("[data-drag-handle]")) return
    }
    onToggleMain()
  }

  return (
    <div
      style={{
        ...styles.card,
        border: "1px solid #3a3f4a",
        backgroundColor: selected
          ? "rgba(13, 148, 136, 0.08)"
          : "rgba(37, 40, 48, 0.5)",
      }}
    >
      {/* Header Row */}
      <div style={styles.header} onClick={handleHeaderClick}>
        {/* Drag Handle */}
        <span
          data-drag-handle
          style={styles.dragHandle}
          {...(dragHandleProps?.listeners || {})}
          {...(dragHandleProps?.attributes || {})}
        >
          ≡
        </span>

          {/* Channel Name */}
        <span style={{ ...styles.channelName, color: selected ? "#14b8a6" : "#e5e7eb" }}>
          {channel.displayName}
        </span>
      </div>

      {/* Sub-entities (extended card) */}
      {subEntities.length > 0 && (
        <>
          <div style={styles.separator} />
          <div style={styles.subEntitiesContainer}>
            <DndContext
              sensors={subEntitySensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => onSubEntityDragEnd(channel.id, event)}
            >
              <SortableContext
                items={subEntityIds}
                strategy={verticalListSortingStrategy}
              >
                {subEntities.map((sub) => {
                  const subKey = `${channel.id}:${sub.id}`
                  const isSelected = selectedSubEntities.has(subKey)
                  return (
                    <SortableSendSubEntityRow
                      key={sub.id}
                      id={sub.id}
                      name={sub.name}
                      selected={isSelected}
                      onToggle={() => onToggleSubEntity(channel.id, sub.id)}
                    />
                  )
                })}
              </SortableContext>
            </DndContext>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SortableSendSubEntityRow — thin sortable wrapper around SendSubEntityRow
// ---------------------------------------------------------------------------

function SortableSendSubEntityRow({
  id,
  name,
  selected,
  onToggle,
}: {
  id: number
  name: string
  selected: boolean
  onToggle: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <SendSubEntityRow
        id={id}
        name={name}
        selected={selected}
        onToggle={onToggle}
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  card: {
    borderRadius: 10,
    marginBottom: 8,
    overflow: "hidden",
    transition: "border-color 150ms, background-color 150ms",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    cursor: "pointer",
  },
  dragHandle: {
    cursor: "grab",
    fontSize: 14,
    color: "#6b7280",
    flexShrink: 0,
    userSelect: "none",
    touchAction: "none",
  },
  channelName: {
    fontSize: 13,
    fontWeight: 500,
    color: "#e5e7eb",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  separator: {
    height: 0,
    borderTop: "1px solid #3a3f4a",
    margin: "0 12px",
  },
  subEntitiesContainer: {
    padding: "4px 4px 8px",
  },
}

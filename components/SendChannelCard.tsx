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
import type { Channel, TelegramCredentials, DiscordCredentials } from "../lib-channels"

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
        backgroundColor: "rgba(37, 40, 48, 0.5)",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Header Row */}
      <div
        style={{
          ...styles.header,
          backgroundColor: selected ? "rgba(13, 148, 136, 0.08)" : "transparent",
          borderLeft: selected ? "3px solid #14b8a6" : "3px solid transparent",
          borderRadius: selected ? "2px" : "0px",
        }}
        onClick={handleHeaderClick}
      >
        {/* Drag Handle */}
        {dragHandleProps && (
          <span
            data-drag-handle
            style={styles.dragHandle}
            {...(dragHandleProps?.listeners || {})}
            {...(dragHandleProps?.attributes || {})}
          >
            ≡
          </span>
        )}

        {/* Channel Name + Account/Server Name */}
        <span style={{ ...styles.channelName, color: selected ? "#14b8a6" : "#e5e7eb" }}>
          {channel.displayName}
        </span>
        {channel.type === "telegram" ? (
          (channel.credentials as TelegramCredentials).accountName ? (
            <span style={styles.metaName}>
              {(channel.credentials as TelegramCredentials).accountName}
            </span>
          ) : null
        ) : (
          (channel.credentials as DiscordCredentials).serverName ? (
            <span style={styles.metaName}>
              {(channel.credentials as DiscordCredentials).serverName}
            </span>
          ) : null
        )}
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
    // CRITICAL: Use CSS.Translate.toString() instead of CSS.Transform.toString()
    // CSS.Transform includes scaleX/scaleY which causes variable-height items to
    // stretch/compress during drag. CSS.Translate only applies translation (x, y),
    // preserving exact dimensions. See dnd-kit issues #44, #117, #817, #1138.
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    width: "100%",
    boxSizing: "border-box",
    // Margin moved from inner element to wrapper for consistent drag spacing
    marginBottom: 2,
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
    // marginBottom removed — handled by SortableSendChannelCard wrapper for consistent drag spacing
    // overflow removed — was causing subpixel rendering issues during drag & drop
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
  metaName: {
    fontSize: 12,
    fontWeight: 400,
    color: "#6b7280",
    textAlign: "right",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginLeft: 8,
    maxWidth: "50%",
  },
  separator: {
    height: 0,
    borderTop: "1px solid #3a3f4a",
    margin: "0 12px",
  },
  subEntitiesContainer: {
    padding: "4px 4px 8px",
    width: "100%",
    boxSizing: "border-box",
  },
}

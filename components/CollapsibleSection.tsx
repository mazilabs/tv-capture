/**
 * TV Capture — Collapsible Section Component
 *
 * Reusable collapsible container for Settings sections.
 * Uses CSS Grid animation for smooth, native-height-aware expand/collapse.
 * 
 * Updated: Dark Glassmorphism theme (2026-04-20)
 */

import { useState } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CollapsibleSectionProps = {
  title: string
  defaultOpen?: boolean
  /** Controlled open state (optional — when provided, component is controlled) */
  isOpen?: boolean
  /** Controlled toggle callback (optional — required when isOpen is provided) */
  onToggle?: () => void
  children: React.ReactNode
  /** Optional info icon with tooltip and click handler */
  infoTooltip?: string
  infoOnClick?: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CollapsibleSection({
  title,
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onToggle,
  children,
  infoTooltip,
  infoOnClick,
}: CollapsibleSectionProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen)

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen

  const handleToggle = () => {
    if (onToggle) {
      onToggle()
    } else {
      setInternalIsOpen(!internalIsOpen)
    }
  }

  const styles: Record<string, React.CSSProperties> = {
    container: {
      marginBottom: 16,
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 0",
      cursor: "pointer",
      userSelect: "none" as const,
      borderBottom: "1px solid #3a3f4a",
    },
    titleRow: {
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    title: {
      fontSize: 14,
      fontWeight: 600,
      textTransform: "uppercase" as const,
      letterSpacing: "0.05em",
      color: "#9ca3af",
    },
    infoIcon: {
      fontSize: 14,
      color: "#6b7280",
      cursor: "pointer",
      transition: "color 150ms",
    },
    arrow: {
      fontSize: 12,
      color: "#6b7280",
      transition: "transform 250ms cubic-bezier(0.4, 0, 0.2, 1)",
      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
    },
    // Grid container for smooth animation
    // grid-template-rows: 0fr = collapsed, 1fr = expanded
    gridContainer: {
      display: "grid",
      gridTemplateRows: isOpen ? "1fr" : "0fr",
      transition: "grid-template-rows 300ms cubic-bezier(0.4, 0, 0.2, 1)",
    },
    // Inner wrapper handles overflow and provides content area
    innerWrapper: {
      overflow: "hidden",
    },
    // Content padding - always present for consistent spacing
    content: {
      paddingTop: 12,
      paddingBottom: 4,
    },
  }

  return (
    <div style={styles.container}>
      <div
        style={styles.header}
        onClick={handleToggle}
      >
        <div style={styles.titleRow}>
          <span style={styles.title}>{title}</span>
          {infoTooltip && (
            <span
              style={styles.infoIcon}
              title={infoTooltip}
              onClick={(e) => {
                e.stopPropagation()
                infoOnClick?.()
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.color = "#14b8a6"
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.color = "#6b7280"
              }}
            >
              ℹ️
            </span>
          )}
        </div>
        <span style={styles.arrow}>▼</span>
      </div>
      {/* Grid container enables smooth height animation */}
      <div style={styles.gridContainer}>
        <div style={styles.innerWrapper}>
          <div style={styles.content}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

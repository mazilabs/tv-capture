/**
 * TV Capture — Collapsible Section Component
 *
 * Reusable collapsible container for Settings sections.
 */

import { useState } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CollapsibleSectionProps = {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

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
      borderBottom: "1px solid #e5e7eb",
    },
    title: {
      fontSize: 14,
      fontWeight: 600,
      textTransform: "uppercase" as const,
      letterSpacing: "0.05em",
      color: "#374151",
    },
    arrow: {
      fontSize: 12,
      color: "#6b7280",
      transition: "transform 200ms ease-out",
      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
    },
    content: {
      maxHeight: isOpen ? "1000px" : "0",
      overflow: "hidden" as const,
      transition: "max-height 300ms ease-out",
      paddingTop: isOpen ? 12 : 0,
    },
  }

  return (
    <div style={styles.container}>
      <div
        style={styles.header}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={styles.title}>{title}</span>
        <span style={styles.arrow}>▼</span>
      </div>
      <div style={styles.content}>
        {children}
      </div>
    </div>
  )
}

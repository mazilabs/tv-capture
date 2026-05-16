/**
 * TV Capture — Template List Item Component
 *
 * Single template row with name + 3-dot menu.
 * 
 * Updated: Dark Glassmorphism theme (2026-04-20)
 */

import { useState, useRef, useEffect } from "react"
import type { Template } from "../lib-templates"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TemplateListItemProps = {
  template: Template
  onEdit: (id: number) => void
  onDelete: (id: number) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateListItem({
  template,
  onEdit,
  onDelete,
}: TemplateListItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showMenu])

  const styles: Record<string, React.CSSProperties> = {
    container: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 14px",
      border: "1px solid #3a3f4a",
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: "rgba(40, 48, 56, 0.7)",
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
    menuButton: {
      background: "none",
      border: "none",
      padding: "4px 8px",
      cursor: "pointer",
      fontSize: 16,
      color: "#6b7280",
    },
    menuWrapper: {
      position: "relative" as const,
    },
    menu: {
      position: "absolute" as const,
      right: 0,
      top: "100%",
      backgroundColor: "#252830",
      border: "1px solid #3a3f4a",
      borderRadius: 8,
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
      zIndex: 100,
      minWidth: 100,
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    },
    menuItem: {
      display: "block",
      width: "100%",
      padding: "10px 14px",
      border: "none",
      background: "none",
      textAlign: "left" as const,
      fontSize: 13,
      cursor: "pointer",
      color: "#9ca3af",
      transition: "background-color 100ms",
    },
    menuItemDelete: {
      display: "block",
      width: "100%",
      padding: "10px 14px",
      border: "none",
      background: "none",
      borderTop: "1px solid #3a3f4a",
      textAlign: "left" as const,
      fontSize: 13,
      cursor: "pointer",
      color: "#ef4444",
      transition: "background-color 100ms",
    },
  }

  return (
    <div style={styles.container} data-id={template.id}>
      <span style={styles.name}>{template.name}</span>
      <div style={styles.menuWrapper} ref={menuRef}>
        <button
          style={styles.menuButton}
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
        >
          ⋮
        </button>
        {showMenu && (
          <div style={styles.menu}>
            <button
              style={styles.menuItem}
              onClick={() => {
                setShowMenu(false)
                onEdit(template.id)
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = "#2c3038"
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = "transparent"
              }}
            >
              Edit
            </button>
            <button
              style={styles.menuItemDelete}
              onClick={() => {
                setShowMenu(false)
                onDelete(template.id)
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = "rgba(239, 68, 68, 0.1)"
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = "transparent"
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

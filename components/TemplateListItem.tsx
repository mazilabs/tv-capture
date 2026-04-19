/**
 * TV Capture — Template List Item Component
 *
 * Single template row with name + 3-dot menu.
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
      padding: "10px 12px",
      border: "1px solid #e5e7eb",
      borderRadius: 6,
      marginBottom: 8,
      backgroundColor: "#fff",
      // cursor handled by SortableTemplateItem wrapper
    },
    name: {
      fontSize: 14,
      fontWeight: 500,
      color: "#1a1a1a",
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
      backgroundColor: "#fff",
      border: "1px solid #d1d5db",
      borderRadius: 6,
      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      zIndex: 100,
      minWidth: 100,
    },
    menuItem: {
      display: "block",
      width: "100%",
      padding: "8px 12px",
      border: "none",
      background: "none",
      textAlign: "left" as const,
      fontSize: 13,
      cursor: "pointer",
      color: "#374151",
    },
    menuItemDelete: {
      display: "block",
      width: "100%",
      padding: "8px 12px",
      border: "none",
      background: "none",
      borderTop: "1px solid #e5e7eb",
      textAlign: "left" as const,
      fontSize: 13,
      cursor: "pointer",
      color: "#ef4444",
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
            >
              Edit
            </button>
            <button
              style={styles.menuItemDelete}
              onClick={() => {
                setShowMenu(false)
                onDelete(template.id)
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

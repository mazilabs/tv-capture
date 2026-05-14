/**
 * TV Capture — Confirm Dialog Component
 *
 * Reusable confirmation/destructive-action dialog.
 * Renders a fixed overlay with centered dialog.
 * Reuses existing overlay/popup styles from sidepanel.tsx.
 */

type ConfirmDialogProps = {
  title: string
  message: string
  confirmLabel?: string // defaults to "Delete"
  cancelLabel?: string // defaults to "Cancel"
  onConfirm: () => void
  onCancel: () => void
  destructive?: boolean // defaults to true — red confirm button
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  destructive = true,
}: ConfirmDialogProps) {
  const styles: Record<string, React.CSSProperties> = {
    overlay: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      backdropFilter: "blur(4px)",
      WebkitBackdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    },
    popup: {
      backgroundColor: "#252830",
      borderRadius: 12,
      padding: 20,
      maxWidth: "90%",
      width: 280,
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
      border: "1px solid #3a3f4a",
    },
    popupTitle: {
      fontSize: 16,
      fontWeight: 600,
      margin: "0 0 8px",
      color: "#e5e7eb",
    },
    popupText: {
      fontSize: 14,
      color: "#9ca3af",
      margin: "0 0 16px",
    },
    popupButtons: {
      display: "flex",
      gap: 8,
    },
    cancelButton: {
      flex: 1,
      padding: "10px 14px",
      border: "1px solid #3a3f4a",
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      backgroundColor: "transparent",
      color: "#9ca3af",
      transition: "all 150ms",
    },
    confirmButtonDestructive: {
      flex: 1,
      padding: "10px 14px",
      border: "none",
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      backgroundColor: "#ef4444",
      color: "#fff",
      transition: "background-color 150ms",
    },
    confirmButtonSafe: {
      flex: 1,
      padding: "10px 14px",
      border: "none",
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      backgroundColor: "#0d9488",
      color: "#fff",
      transition: "background-color 150ms",
    },
  }

  return (
    <div
      style={styles.overlay}
      onClick={(e) => {
        // Close on overlay click (not on popup click)
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div style={styles.popup}>
        <p style={styles.popupTitle}>{title}</p>
        <p style={styles.popupText}>{message}</p>
        <div style={styles.popupButtons}>
          <button
            style={styles.cancelButton}
            onClick={onCancel}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = "#2c3038"
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = "transparent"
            }}
          >
            {cancelLabel}
          </button>
          <button
            style={destructive ? styles.confirmButtonDestructive : styles.confirmButtonSafe}
            onClick={onConfirm}
            onMouseEnter={(e) => {
              if (destructive) {
                (e.target as HTMLButtonElement).style.backgroundColor = "#dc2626"
              } else {
                (e.target as HTMLButtonElement).style.backgroundColor = "#14b8a6"
              }
            }}
            onMouseLeave={(e) => {
              if (destructive) {
                (e.target as HTMLButtonElement).style.backgroundColor = "#ef4444"
              } else {
                (e.target as HTMLButtonElement).style.backgroundColor = "#0d9488"
              }
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

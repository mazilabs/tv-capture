/**
 * TV Capture — Template Tile Component
 *
 * Reusable clickable tile for templates in the CaptureView grid.
 * 
 * Updated: Dark Glassmorphism theme (2026-04-20)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TemplateTileProps = {
  name: string
  isSelected?: boolean
  onClick: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateTile({
  name,
  isSelected = false,
  onClick,
}: TemplateTileProps) {
  const styles: Record<string, React.CSSProperties> = {
    tile: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "12px 8px",
      border: isSelected ? "2px solid #0d9488" : "1px solid #3a3f4a",
      borderRadius: 8,
      backgroundColor: isSelected ? "rgba(13, 148, 136, 0.15)" : "rgba(40, 48, 56, 0.7)",
      cursor: "pointer",
      textAlign: "center" as const,
      transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
      minHeight: 60,
      width: "100%",
      boxSizing: "border-box" as const,
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    },
    name: {
      fontSize: 13,
      fontWeight: 500,
      color: isSelected ? "#14b8a6" : "#e5e7eb",
      wordBreak: "break-word" as const,
    },
  }

  return (
    <button style={styles.tile} onClick={onClick}>
      <span style={styles.name}>{name}</span>
    </button>
  )
}

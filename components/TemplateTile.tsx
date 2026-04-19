/**
 * TV Capture — Template Tile Component
 *
 * Reusable clickable tile for templates in the CaptureView grid.
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
      border: isSelected ? "2px solid #2563eb" : "1px solid #d1d5db",
      borderRadius: 6,
      backgroundColor: isSelected ? "#eff6ff" : "#f9fafb",
      cursor: "pointer",
      textAlign: "center" as const,
      transition: "all 150ms",
      minHeight: 60,
      width: "100%",
      boxSizing: "border-box" as const,
    },
    name: {
      fontSize: 13,
      fontWeight: 500,
      color: isSelected ? "#2563eb" : "#374151",
      wordBreak: "break-word" as const,
    },
  }

  return (
    <button style={styles.tile} onClick={onClick}>
      <span style={styles.name}>{name}</span>
    </button>
  )
}

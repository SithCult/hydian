// The Hydian mark from the shared sprite. `orbit` colours the orbit line separately (the sprite reads --orbit).
export function Mark({ size = 24, orbit, className }: { size?: number; orbit?: string; className?: string }) {
  return (
    <svg
      className={`mark ${className ?? ""}`}
      width={size}
      height={size}
      style={orbit ? ({ "--orbit": orbit } as React.CSSProperties) : undefined}
      aria-hidden
    >
      <use href="/mark.svg#mark" />
    </svg>
  );
}

export function DifficultyBadge({
  min,
  max,
}: {
  min: number | null
  max: number | null
}) {
  const label =
    min === null || max === null
      ? 'Sin nivel'
      : min === max
        ? `Nivel ${min}`
        : `Nivel ${min}–${max}`
  return <span className="difficulty-badge">{label}</span>
}

/** Contador de poses em visor, como o da câmera física. */
export function ShotCounter({ value, label = "poses restantes", className }: { value: number | string; label?: string; className?: string }) {
  return (
    <div className={`rv-counter ${className ?? ""}`} role="status" aria-label={`${value} ${label}`}>
      <b aria-hidden="true">{String(value).padStart(2, "0")}</b>
      <span aria-hidden="true">{label}</span>
    </div>
  );
}

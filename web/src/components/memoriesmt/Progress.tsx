import { cx } from "./cx";

/** Barra de 8px. Envio (`role=progressbar`) ou ranking do evento. */
/** Sem `value` a barra é indeterminada (envio em andamento, sem porcentagem real para mostrar). */
export function Progress({ label, status, value, variant = "envio" }: { label: string; status: string; value?: number; variant?: "envio" | "evento" }) {
  const indeterminate = value === undefined;
  const v = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  return (
    <div className={cx("mm-progress", variant === "evento" && "mm-progress--evento")}>
      <div className="mm-progress-head">
        <span>{label}</span>
        <strong className={status === "Na fila" ? "mm-progress-fila" : undefined}>{status}</strong>
      </div>
      <div className="mm-progress-track" role={variant === "envio" ? "progressbar" : undefined} aria-label={variant === "envio" ? label : undefined} aria-valuenow={variant === "envio" && !indeterminate ? v : undefined} aria-valuemin={variant === "envio" && !indeterminate ? 0 : undefined} aria-valuemax={variant === "envio" && !indeterminate ? 100 : undefined} aria-busy={indeterminate || undefined}>
        <div className={cx("mm-progress-fill", indeterminate && "mm-progress-fill--indeterminada")} style={indeterminate ? undefined : { width: `${v}%` }} />
      </div>
    </div>
  );
}

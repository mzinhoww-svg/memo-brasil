import { cx } from "./cx";

/** Barra de 8px. Envio (`role=progressbar`) ou ranking do evento. */
export function Progress({ label, status, value, variant = "envio" }: { label: string; status: string; value: number; variant?: "envio" | "evento" }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cx("mm-progress", variant === "evento" && "mm-progress--evento")}>
      <div className="mm-progress-head">
        <span>{label}</span>
        <strong className={status === "Na fila" ? "mm-progress-fila" : undefined}>{status}</strong>
      </div>
      <div className="mm-progress-track" role={variant === "envio" ? "progressbar" : undefined} aria-label={variant === "envio" ? label : undefined} aria-valuenow={variant === "envio" ? v : undefined} aria-valuemin={variant === "envio" ? 0 : undefined} aria-valuemax={variant === "envio" ? 100 : undefined}>
        <div className="mm-progress-fill" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

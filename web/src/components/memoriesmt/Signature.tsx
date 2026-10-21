import { SELO_PATH } from "./icon-data";

/** Assinatura discreta: "por" + selo + MemoriesMT. Nunca maior que 13px. */
export function Signature({ className }: { className?: string }) {
  return (
    <span className={`mm-assinatura ${className ?? ""}`}>
      <span>por</span>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path fillRule="evenodd" d={SELO_PATH} />
      </svg>
      <strong>MemoriesMT</strong>
    </span>
  );
}

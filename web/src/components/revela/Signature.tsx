/** Assinatura discreta: símbolo do Revela (círculo meio revelado) + nome. Nunca maior que 13px. */
export function Signature({ className }: { className?: string }) {
  return (
    <span className={`rv-assinatura ${className ?? ""}`}>
      <span>feito com</span>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M14 34.5a18 18 0 0 0 36 0z" />
        <path d="M15 29.5a17 17 0 0 1 34 0z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <strong>Revela</strong>
    </span>
  );
}

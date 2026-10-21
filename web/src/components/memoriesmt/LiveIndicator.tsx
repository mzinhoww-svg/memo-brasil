/** Ponto REC sempre com a palavra. Um por tela. */
export function LiveIndicator({ label = "Ao vivo" }: { label?: string }) {
  return (
    <span className="mm-live">
      <span className="mm-live-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

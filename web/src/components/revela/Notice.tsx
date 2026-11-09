/** Aviso do anfitrião fixado no topo do feed. Um por vez, curto. Sem rótulo em caixa alta (regra do Revela). */
export function Notice({ text, eyebrow = "Aviso do anfitrião" }: { text: string; eyebrow?: string }) {
  return (
    <div className="rv-notice" role="status">
      <span className="rv-notice-eyebrow">{eyebrow}</span>
      <span className="rv-notice-texto">{text}</span>
    </div>
  );
}

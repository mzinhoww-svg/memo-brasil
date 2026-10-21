/** Aviso fixado no topo do feed, na cor do evento. Um por vez, curto. */
export function Notice({ text, eyebrow = "Aviso · organização" }: { text: string; eyebrow?: string }) {
  return (
    <div className="mm-notice" role="status">
      <span className="mm-notice-eyebrow">{eyebrow}</span>
      <span className="mm-notice-texto">{text}</span>
    </div>
  );
}

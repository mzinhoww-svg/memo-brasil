/** Faixa de abertura: data e local em eyebrow, nome na fonte do evento. Nada além disso. */
export function EventHeader({ meta, name }: { meta: string; name: string }) {
  return (
    <header className="mm-event-header">
      <span className="mm-event-meta">{meta}</span>
      <h1 className="mm-event-nome" style={{ margin: 0, fontWeight: 400 }}>{name}</h1>
    </header>
  );
}

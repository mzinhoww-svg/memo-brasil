/** Faixa de abertura: data e local em eyebrow, nome na fonte do evento; capa e logo opcionais (identidade do evento, só dentro do wrapper do tema). */
export function EventHeader({ meta, name, logoUrl, coverUrl }: { meta: string; name: string; logoUrl?: string; coverUrl?: string }) {
  return (
    <header className="rv-event-header">
      {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage, sem otimizador */}
      {coverUrl && <img className="rv-event-capa" src={coverUrl} alt="" />}
      {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage, sem otimizador */}
      {logoUrl && <img className="rv-event-logo" src={logoUrl} alt={`Logotipo de ${name}`} />}
      <span className="rv-event-meta">{meta}</span>
      <h1 className="rv-event-nome" style={{ margin: 0, fontWeight: 400 }}>{name}</h1>
    </header>
  );
}

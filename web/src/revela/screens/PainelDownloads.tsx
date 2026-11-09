/* Gerado de design-system/revela/html/Painel-downloads.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export function PainelDownloads() {
  return (
    <>
    <div className="scr">
      <div className="safe">
        <div className="row between">
          <button className="rv-icon-btn" aria-label="Voltar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="rv-title" style={{ "fontSize": "18px" }}>
            Downloads
          </span>
          <span style={{ "width": "44px" }} />
        </div>
        <div className="dl">
          <div className="dl-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="9" cy="10" r="2" />
              <path d="M21 16l-5-5-9 9" />
            </svg>
          </div>
          <div style={{ "flex": "1" }}>
            <b>
              Todas as fotos (ZIP)
            </b>
            <span className="rv-caption">
              418 fotos · 1,2 GB · originais com filme
            </span>
            <div className="prog">
              <s style={{ "width": "64%" }} />
            </div>
            <span className="rv-caption">
              Preparando… 64%
            </span>
          </div>
        </div>
        <div className="dl">
          <div className="dl-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
              <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.6c2.4.6 4 2.4 4 5.4" />
            </svg>
          </div>
          <div style={{ "flex": "1" }}>
            <b>
              Lista de convidados (CSV)
            </b>
            <span className="rv-caption">
              32 pessoas · nome, mesa, fotos tiradas
            </span>
          </div>
          <button className="rv-btn rv-btn--sm">
            Baixar
          </button>
        </div>
        <div className="dl">
          <div className="dl-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
            </svg>
          </div>
          <div style={{ "flex": "1" }}>
            <b>
              Retrospectiva
            </b>
            <span className="rv-caption">
              Disponível depois da revelação
            </span>
          </div>
          <button className="rv-btn rv-btn--sm" aria-disabled="true" style={{ "opacity": ".4" }}>
            Baixar
          </button>
        </div>
        <div className="grow" />
        <p className="rv-caption center">
          As fotos ficam guardadas por 12 meses depois da revelação.
        </p>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}

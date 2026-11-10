"use client";
/* Revelados-album.html (19b): mesmo markup da referência; dados reais por props (padrão = desenho). */
import Link from "next/link";

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export interface ReveladosAlbumProps {
  /** capa do livro */
  title?: string;
  /** "14 · 03 · 2027" */
  date?: string;
  /** duas fotos que saem de trás do livro */
  covers?: [string, string];
  /** "60 fotos escolhidas por você, capa dura de linho, entregue em casa." */
  lead?: string;
  closeHref?: string;
  chooseHref?: string;
}

export function ReveladosAlbum({ title = "Ana & Leo", date = "14 · 03 · 2027", covers = ["/revela/ref/sc-aliancas.jpg", "/revela/ref/sc-bolo.jpg"], lead = "60 fotos escolhidas por você, capa dura de linho, entregue em casa.", closeHref, chooseHref }: ReveladosAlbumProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe">
        <div className="row between">
          <Link href={closeHref ?? "#"} className="rv-icon-btn" aria-label="Fechar">
            <svg {...svg}>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Link>
          <span />
        </div>
        <div className="albumviz">
          <div className="rv-print" style={{ position: "absolute", left: "20px", top: "30px", width: "150px", height: "188px", transform: "rotate(-10deg)", zIndex: "1" }}>
            <img src={covers[0]} alt="Foto de convidado" />
          </div>
          <div className="rv-print" style={{ position: "absolute", left: "150px", top: "10px", width: "150px", height: "188px", transform: "rotate(7deg)", zIndex: "2" }}>
            <img src={covers[1]} alt="Foto de convidado" />
          </div>
          <div className="book">
            <span>{title}</span>
            <small>{date}</small>
          </div>
        </div>
        <h1 className="rv-title-lg" style={{ marginTop: "8px" }}>
          O álbum da festa,
          <br />
          em papel
        </h1>
        <p className="rv-body muted" style={{ margin: "10px 0 16px" }}>{lead}</p>
        <div className="rv-group">
          <div className="rv-row">
            <svg {...svg}>
              <path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z" />
              <path d="M4 16a4 4 0 0 1 4-4h10" />
            </svg>
            <div className="rv-row__text">
              Capa de linho marfim
              <span className="rv-row__meta">21 × 21 cm · 60 fotos</span>
            </div>
            <span className="rv-row__end">R$ 189</span>
          </div>
          <div className="rv-row">
            <svg {...svg}>
              <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z" />
            </svg>
            <div className="rv-row__text">
              Caixa com 30 fotos soltas
              <span className="rv-row__meta">10 × 15 cm, borda branca</span>
            </div>
            <span className="rv-row__end">R$ 79</span>
          </div>
        </div>
        <p className="rv-caption center" style={{ marginTop: "10px" }}>Preços de exemplo, a definir.</p>
        <div className="grow" />
        <Link href={chooseHref ?? "#"} className="rv-btn rv-btn--block rv-btn--primary">Escolher as fotos</Link>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}

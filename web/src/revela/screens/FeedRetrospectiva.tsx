"use client";
/* Feed-retrospectiva.html (24h): mesmo markup da referência; dados reais por props (padrão = desenho). */
import Link from "next/link";

export interface RetroTile { label: string; value: string; note?: string; /** valor em faixa (ex.: "19:40–19:50"), em corpo menor */ range?: boolean }
export interface RetroBar {
  /** rótulo curto da hora ("19h"); em blocos, a hora de início */
  label: string;
  /** fotos na hora (ou no bloco) */
  n: number;
  /** altura relativa, 0 a 100 (0 só quando n = 0) */
  pct: number;
  on?: boolean;
  /** "18h às 21h", quando a barra junta várias horas */
  range?: string;
  /** dia da semana abreviado, na virada do dia ("dom") */
  day?: string;
}
export interface RetroShooter { avatar: string; name: string; n: number; total?: number | null }

export interface FeedRetrospectivaProps {
  /** "SÁB 14 MAR 2027" */
  stamp?: string;
  /** primeira e segunda linha do título */
  headline?: [string, string];
  tiles?: RetroTile[];
  bars?: RetroBar[];
  shooters?: RetroShooter[];
  backHref?: string;
  /** voltar pelo histórico; `backHref` segue como destino real do link (abrir em outra aba, sem JavaScript) */
  onBack?: () => void;
}

export const RETRO_REF = {
  tiles: [{ label: "Fotógrafos", value: "32" }, { label: "Reações", value: "1.204" }, { label: "Pico (10 min)", value: "22:40–22:50", range: true, note: "Primeira dança" }] as RetroTile[],
  bars: [{ label: "16h", n: 12, pct: 12 }, { label: "17h", n: 31, pct: 31 }, { label: "18h", n: 48, pct: 48 }, { label: "19h", n: 60, pct: 60 }, { label: "21h", n: 100, pct: 100, on: true }, { label: "22h", n: 92, pct: 92 }, { label: "23h", n: 56, pct: 56 }, { label: "0h", n: 35, pct: 35 }] as RetroBar[],
  shooters: [{ avatar: "B", name: "Bia Moraes", n: 36, total: 36 }, { avatar: "R", name: "Rafa Lima", n: 34, total: 36 }, { avatar: "L", name: "Lu Prado", n: 31, total: 36 }] as RetroShooter[],
};

/** abaixo disso o gráfico ganha um aviso de poucos dados */
const FEW = 5;

export function FeedRetrospectiva({ stamp = "SÁB 14 MAR 2027", headline = ["O casamento", "em 418 fotos"], tiles = RETRO_REF.tiles, bars = RETRO_REF.bars, shooters = RETRO_REF.shooters, backHref, onBack }: FeedRetrospectivaProps = {}) {
  const total = bars.reduce((a, b) => a + b.n, 0);
  return (
    <>
    <div className="scr">
      <div className="safe" style={backHref ? { overflowY: "auto" } : undefined}>
        <div className="row between">
          <Link href={backHref ?? "#"} className="rv-icon-btn" aria-label="Voltar" onClick={onBack && ((e) => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); onBack(); } })}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <span className="rv-title" style={{ fontSize: "18px" }}>Retrospectiva</span>
          <span style={{ width: "44px" }} />
        </div>
        <p className="rv-stamp" style={{ marginTop: "18px" }}>{stamp}</p>
        <h1 className="rv-display" style={{ fontSize: "40px", lineHeight: "44px", marginTop: "6px" }}>
          {headline[0]}
          <br />
          {headline[1]}
        </h1>
        <div className="tiles">
          {tiles.map((t) => (
            <div key={t.label} className={t.range ? "tile tile--range" : "tile"}>
              <span>{t.label}</span>
              <b>{t.value}</b>
              {t.note && <small>{t.note}</small>}
            </div>
          ))}
        </div>
        <h2 className="rv-group-h">Fotos por hora</h2>
        {bars.length === 0 ? (
          <p className="rv-body muted retro-empty">Ainda não há fotos para contar.</p>
        ) : (
          <>
            <div className="bars bars--retro" role="list" aria-label="Fotos por hora">
              {bars.map((b, i) => (
                <div key={`${i}-${b.label}`} role="listitem" aria-label={`${b.range ?? b.label}: ${b.n === 1 ? "1 foto" : `${b.n.toLocaleString("pt-BR")} fotos`}`}>
                  {b.n > 0 && <b aria-hidden="true">{b.n.toLocaleString("pt-BR")}</b>}
                  <i aria-hidden="true" style={{ height: `${b.pct * 0.9}px` }} className={b.on ? "on" : undefined} />
                  <span aria-hidden="true">{b.label}</span>
                  <small aria-hidden="true">{b.day ?? " "}</small>
                </div>
              ))}
            </div>
            {total < FEW && <p className="rv-caption muted retro-few">Ainda são poucas fotos. O gráfico ganha forma conforme o evento avança.</p>}
          </>
        )}
        <h2 className="rv-group-h">Quem mais fotografou</h2>
        <div className="rv-group">
          {shooters.map((s) => (
            <div key={s.name} className="rv-row">
              <span className="avatar avatar--sm">{s.avatar}</span>
              <div className="rv-row__text">{s.name}</div>
              <span className="gpose">
                <b>{s.n}</b>
                {s.total ? `/${s.total}` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}

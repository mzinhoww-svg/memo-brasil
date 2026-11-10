"use client";
/* Feed-retrospectiva.html (24h): mesmo markup da referência; dados reais por props (padrão = desenho). */
import Link from "next/link";

export interface RetroTile { label: string; value: string; note?: string }
export interface RetroBar { label: string; pct: number; on?: boolean }
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
}

export const RETRO_REF = {
  tiles: [{ label: "Fotógrafos", value: "32" }, { label: "Reações", value: "1.204" }, { label: "Pico", value: "22:40", note: "Primeira dança" }] as RetroTile[],
  bars: [{ label: "16h", pct: 12 }, { label: "17h", pct: 31 }, { label: "18h", pct: 48 }, { label: "19h", pct: 60 }, { label: "21h", pct: 100, on: true }, { label: "22h", pct: 92 }, { label: "23h", pct: 56 }, { label: "0h", pct: 35 }] as RetroBar[],
  shooters: [{ avatar: "B", name: "Bia Moraes", n: 36, total: 36 }, { avatar: "R", name: "Rafa Lima", n: 34, total: 36 }, { avatar: "L", name: "Lu Prado", n: 31, total: 36 }] as RetroShooter[],
};

export function FeedRetrospectiva({ stamp = "SÁB 14 MAR 2027", headline = ["O casamento", "em 418 fotos"], tiles = RETRO_REF.tiles, bars = RETRO_REF.bars, shooters = RETRO_REF.shooters, backHref }: FeedRetrospectivaProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe" style={backHref ? { overflowY: "auto" } : undefined}>
        <div className="row between">
          <Link href={backHref ?? "#"} className="rv-icon-btn" aria-label="Voltar">
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
            <div key={t.label} className="tile">
              <span>{t.label}</span>
              <b>{t.value}</b>
              {t.note && <small>{t.note}</small>}
            </div>
          ))}
        </div>
        <h2 className="rv-group-h">Fotos por hora</h2>
        <div className="bars">
          {bars.map((b) => (
            <div key={b.label}>
              <i style={{ height: `${b.pct}%` }} className={b.on ? "on" : undefined} />
              <span>{b.label}</span>
            </div>
          ))}
        </div>
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

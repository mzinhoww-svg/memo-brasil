import type { ReactNode } from "react";
import type { Load } from "./data";

export function PageHead({ titulo, texto, acao }: { titulo: string; texto?: string; acao?: ReactNode }) {
  return <header className="adm-head"><div><h1>{titulo}</h1>{texto && <p>{texto}</p>}</div>{acao}</header>;
}
export function Metric({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return <section className="adm-card"><h2>{rotulo}</h2><div className="adm-num">{valor}</div>{nota && <p style={{ margin: "6px 0 0", fontSize: 13 }} className="adm-nota">{nota}</p>}</section>;
}
export function Badge({ s, children }: { s: "ok" | "aviso" | "erro" | "info"; children: ReactNode }) {
  return <span className="adm-badge" data-s={s}>{children}</span>;
}
export function StateBox({ load, vazio }: { load: Load<unknown>; vazio?: string }) {
  if (load.state === "denied") return <div className="adm-state" role="alert">Sem permissão para ver estes dados.</div>;
  if (load.state === "error") return <div className="adm-state" role="alert">Não foi possível carregar: {load.message}</div>;
  return <div className="adm-state">{vazio ?? "Nada por aqui ainda."}</div>;
}
export function Table({ cols, rows, vazio }: { cols: { k: string; h: string; num?: boolean }[]; rows: Record<string, ReactNode>[]; vazio: string }) {
  if (!rows.length) return <div className="adm-state">{vazio}</div>;
  return (
    <div className="adm-table-wrap" role="region" tabIndex={0} aria-label="Tabela rolável">
      <table className="adm-table">
        <thead><tr>{cols.map((c) => <th key={c.k} scope="col" className={c.num ? "num" : undefined}>{c.h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c.k} className={c.num ? "num" : undefined}>{r[c.k]}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

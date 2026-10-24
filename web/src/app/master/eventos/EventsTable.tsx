"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button, Sheet } from "@/components/memoriesmt";
import { num } from "@/features/master/format";
import type { SearchParams } from "@/features/master/params";
import { Meter } from "../kit/Meter";
import { Pill } from "../kit/Pill";
import { hrefWith, type SortDir } from "../kit/url";
import { ReasonField } from "../billing-actions";
import { reasonError } from "../billing";
import { setTestFlag, softDeleteTestEvents } from "./actions";
import { deletableIds, REVEAL_TONE, STATUS_TONE, when, type EventRow } from "./lib";
import css from "./page.module.css";

export type TableRow = EventRow & { plan: string };
type Bulk = "excluir" | "marcar" | "desmarcar";
const TITLES: Record<Bulk, string> = { excluir: "Excluir testes selecionados", marcar: "Marcar como teste", desmarcar: "Desmarcar teste" };

const COLS: { key: string; label: string; sort?: string; num?: boolean }[] = [
  { key: "title", label: "Evento", sort: "title" },
  { key: "hostName", label: "Anfitrião", sort: "hostName" },
  { key: "status", label: "Situação", sort: "status" },
  { key: "plan", label: "Plano" },
  { key: "ocupacao", label: "Ocupação", sort: "participants" },
  { key: "photos", label: "Fotos", sort: "photos", num: true },
  { key: "revealAt", label: "Revelação", sort: "revealAt" },
  { key: "startAt", label: "Início", sort: "startAt" },
];

/**
 * Tabela de eventos com ordenação por link (`?ord=&dir=`, aplicada no servidor), clique na linha abre o drawer (`?ev=`)
 * e seleção em lote. `bulk=false` (RPCs novas ausentes) esconde seleção e ações.
 */
export function EventsTable({ rows, path, params, ord, dir, bulk }: { rows: TableRow[]; path: string; params: SearchParams; ord: string; dir: SortDir; bulk: boolean }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Bulk | null>(null);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const p = Array.isArray(params.p) ? params.p[0] : params.p;
  const evHref = (id: string) => hrefWith(path, params, { ev: id, p });

  const chosen = useMemo(() => rows.filter((r) => sel.has(r.id)), [rows, sel]);
  const tests = deletableIds(chosen);
  const target = open === "excluir" ? chosen.filter((r) => tests.includes(r.id)) : open === "marcar" ? chosen.filter((r) => r.isTest !== true) : chosen.filter((r) => r.isTest === true);
  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.id));

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const close = () => { setOpen(null); setReason(""); setConfirm(false); setTried(false); setError(null); };
  const rErr = tried ? reasonError(reason) : null;
  const submit = () => {
    setTried(true);
    if (!open || reasonError(reason) || !target.length || (open === "excluir" && !confirm)) return;
    const ids = target.map((r) => r.id).join(",");
    const kind = open;
    start(async () => {
      const r = kind === "excluir" ? await softDeleteTestEvents(ids, reason) : await setTestFlag(ids, kind === "marcar", reason);
      if (!r.ok) { setError(r.error); return; }
      setDone(kind === "excluir" ? `${num(r.count)} evento(s) de teste excluído(s).` : kind === "marcar" ? `${num(r.count)} evento(s) marcado(s) como teste.` : `${num(r.count)} evento(s) desmarcado(s).`);
      setSel(new Set()); close(); router.refresh();
    });
  };

  return (
    <>
      {bulk && (
        <div className={css.bulk} role="region" aria-label="Ações em lote">
          <span className={css.bulkCount}>{chosen.length ? `${num(chosen.length)} selecionado(s), ${num(tests.length)} de teste` : "Selecione eventos na tabela"}</span>
          <button type="button" className="adm-btn" disabled={!tests.length} onClick={() => setOpen("excluir")}>Excluir testes selecionados</button>
          <button type="button" className="adm-btn" disabled={!chosen.some((r) => r.isTest !== true)} onClick={() => setOpen("marcar")}>Marcar como teste</button>
          <button type="button" className="adm-btn" disabled={!chosen.some((r) => r.isTest === true)} onClick={() => setOpen("desmarcar")}>Desmarcar</button>
          <span aria-live="polite" className={css.done}>{done}</span>
        </div>
      )}
      <div className="adm-table-wrap adm-sortable" role="region" tabIndex={0} aria-label="Eventos">
        <table className="adm-table">
          <caption className="adm-sr">Eventos; clique na linha para ver detalhes</caption>
          <thead>
            <tr>
              {bulk && (
                <th scope="col" className={css.check}>
                  <input type="checkbox" aria-label="Selecionar todos desta página" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(rows.map((r) => r.id)))} />
                </th>
              )}
              {COLS.map((c) => {
                const active = !!c.sort && ord === c.sort;
                const next: SortDir = active && dir === "asc" ? "desc" : "asc";
                return (
                  <th key={c.key} scope="col" className={`adm-th${c.num ? " num" : ""}`} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}>
                    {c.sort ? <Link href={hrefWith(path, params, { ord: c.sort, dir: next })}>{c.label}{active && <span aria-hidden="true">{dir === "asc" ? " ↑" : " ↓"}</span>}</Link> : c.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={css.row} data-selected={sel.has(r.id) || undefined} onClick={() => router.push(evHref(r.id))}>
                {bulk && (
                  <td className={css.check} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Selecionar ${r.title}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} />
                  </td>
                )}
                <td>
                  <Link href={evHref(r.id)} className={css.title} onClick={(e) => e.stopPropagation()}>{r.title || "Sem título"}</Link>
                  {r.isTest && <> <Pill tone="info">TESTE</Pill></>}
                </td>
                <td>{r.hostName || <Pill tone="crit">sem anfitrião</Pill>}</td>
                <td><Pill tone={STATUS_TONE[r.status] ?? "dim"}>{r.status}</Pill></td>
                <td>{r.plan}</td>
                <td className={css.meter}>{r.capacity ? <Meter label="Convidados" value={r.participants} max={r.capacity} valueText={`${num(r.participants)} / ${num(r.capacity)}`} /> : `${num(r.participants)} / sem limite`}</td>
                <td className="num">{num(r.photos)}{r.failedUploads > 0 && <span className={css.fail}> ({num(r.failedUploads)} falhas)</span>}</td>
                <td><Pill tone={REVEAL_TONE[r.revealState] ?? "dim"}>{r.revealState}</Pill>{r.revealAt && <span className={css.sub}>{when(r.revealAt)}</span>}</td>
                <td className={css.nowrap}>{when(r.startAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Sheet title={TITLES[open]} onClose={close}>
          <p className="adm-nota adm-sheet-nota">
            {open === "excluir"
              ? `${num(target.length)} evento(s) de teste vão para a lixeira (exclusão lógica, auditada). Eventos que não são de teste ficam de fora.`
              : open === "marcar" ? `${num(target.length)} evento(s) passam a contar como teste e somem dos números com "Ocultar testes".` : `${num(target.length)} evento(s) voltam a contar como reais.`}
          </p>
          <ul className={css.targets}>{target.slice(0, 10).map((r) => <li key={r.id}>{r.title || "Sem título"}</li>)}{target.length > 10 && <li>e mais {num(target.length - 10)}</li>}</ul>
          <ReasonField label="Justificativa (obrigatória, 10 a 500 caracteres)" value={reason} onChange={setReason} error={rErr} />
          {open === "excluir" && (
            <label className={css.confirm}>
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
              Confirmo a exclusão de {num(target.length)} evento(s) de teste
            </label>
          )}
          {tried && open === "excluir" && !confirm && <p className="mm-field-erro">Marque a confirmação para continuar.</p>}
          {error && <p className="mm-field-erro" role="alert">{error}</p>}
          <Button variant={open === "excluir" ? "destrutivo" : "primario"} block onClick={submit} disabled={pending || !target.length}>{pending ? "Enviando…" : TITLES[open]}</Button>
          <Button variant="texto" block onClick={close}>Cancelar</Button>
        </Sheet>
      )}
    </>
  );
}

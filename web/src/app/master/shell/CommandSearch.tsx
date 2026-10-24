"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { pushModal } from "@/components/memoriesmt/modal-stack";
import { withShellParams } from "./params";
import { SEARCH_MIN, eventHref, orderHref, userHref, type SearchResults } from "./search";

const FOCUSAVEL = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
export const DEBOUNCE_MS = 200;

const noop = () => () => {};
const isMac = () => /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

/** Abre a busca global com ⌘K / Ctrl+K ou pelo botão visível. */
export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const before = useRef<HTMLElement | null>(null);
  const abrir = () => { before.current = document.activeElement as HTMLElement | null; setOpen(true); };
  const mac = useSyncExternalStore(noop, isMac, () => true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); abrir(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button ref={trigger} type="button" className="adm-btn adm-search-trigger" aria-haspopup="dialog" aria-keyshortcuts="Meta+K Control+K" onClick={abrir}>
        <span>Buscar evento, e-mail, ID</span>
        <kbd className="adm-kbd" aria-hidden="true">{mac ? "⌘K" : "Ctrl K"}</kbd>
      </button>
      {open && <SearchDialog onClose={() => {
        setOpen(false);
        // volta para onde estava (ex.: a justificativa de uma folha aberta), senão para o botão
        const b = before.current;
        (b && b !== document.body && b.isConnected ? b : trigger.current)?.focus();
      }} />}
    </>
  );
}

interface Item { key: string; group: string; label: string; sub: string; href: string }
type Status = { kind: "idle" } | { kind: "loading" } | { kind: "ok"; data: SearchResults; q: string } | { kind: "error"; message: string };

function toItems(r: SearchResults): Item[] {
  return [
    ...r.events.map((e) => ({ key: `e-${e.id}`, group: "Eventos", label: e.title, sub: `ID ${e.id.slice(0, 8)}`, href: eventHref(e.id) })),
    ...r.users.map((u) => ({ key: `u-${u.userId}`, group: "Usuários", label: u.email || "Sem e-mail", sub: `ID ${u.userId.slice(0, 8)}`, href: userHref(u.userId) })),
    ...r.orders.map((o) => ({ key: `o-${o.id}`, group: "Pedidos", label: `Pedido ${o.id.slice(0, 8)}`, sub: o.status, href: orderHref(o.id) })),
  ];
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const termo = q.trim();
  const curto = termo.length < SEARCH_MIN;

  useEffect(() => {
    input.current?.focus();
    const modal = pushModal(box.current); // topo da pilha: drawer/folha embaixo ignoram Tab/Esc enquanto a busca está aberta
    return () => modal.release();
  }, []);

  useEffect(() => {
    if (curto) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus({ kind: "loading" });
      try {
        const res = await fetch(`/master/busca?q=${encodeURIComponent(termo)}`, { signal: ctrl.signal, headers: { accept: "application/json" } });
        if (res.status === 403) { setStatus({ kind: "error", message: "Sessão sem permissão. Recarregue a página." }); return; }
        if (!res.ok) { setStatus({ kind: "error", message: "Não foi possível buscar agora. Tente de novo." }); return; }
        const data = (await res.json()) as SearchResults;
        setActive(0);
        setStatus({ kind: "ok", data, q: termo });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStatus({ kind: "error", message: "Não foi possível buscar agora. Tente de novo." });
      }
    }, DEBOUNCE_MS);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [termo, curto]);

  const items = !curto && status.kind === "ok" ? toItems(status.data) : [];
  const sel = items.length ? Math.min(active, items.length - 1) : -1;
  const optId = (i: number) => `${id}-opt-${i}`;

  const go = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    router.push(withShellParams(item.href, sp));
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!items.length) return;
      e.preventDefault();
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive((sel + d + items.length) % items.length);
      return;
    }
    if (e.key === "Enter" && e.target === input.current) { e.preventDefault(); go(items[sel]); return; }
    if (e.key === "Tab" && box.current) {
      const f = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSAVEL));
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      const fora = !box.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === a || fora)) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && (document.activeElement === z || fora)) { e.preventDefault(); a.focus(); }
    }
  };

  let mensagem = "";
  if (curto) mensagem = termo ? `Digite ao menos ${SEARCH_MIN} caracteres.` : "Busque por título do evento, e-mail ou ID.";
  else if (status.kind === "loading") mensagem = "Buscando.";
  else if (status.kind === "error") mensagem = status.message;
  else if (status.kind === "ok") mensagem = items.length ? `${items.length} ${items.length === 1 ? "resultado" : "resultados"}.` : `Nada encontrado para "${status.q}".`;

  const grupos = Array.from(new Set(items.map((i) => i.group)));

  return (
    <>
      <div className="adm-cmd-backdrop" aria-hidden="true" onMouseDown={onClose} />
      <div ref={box} className="adm-cmd" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} onKeyDown={onKeyDown}>
        <h2 id={`${id}-t`} className="adm-sr">Busca no console</h2>
        <div className="adm-cmd-head">
          <label htmlFor={`${id}-q`} className="adm-sr">Buscar evento, e-mail ou ID</label>
          <input ref={input} id={`${id}-q`} className="adm-cmd-input" type="search" role="combobox" autoComplete="off" spellCheck={false}
            placeholder="Buscar evento, e-mail, ID" value={q} onChange={(e) => setQ(e.target.value)}
            aria-expanded={items.length > 0} aria-controls={`${id}-list`} aria-autocomplete="list"
            aria-activedescendant={sel >= 0 ? optId(sel) : undefined} />
          <button type="button" className="adm-btn" onClick={onClose}>Fechar</button>
        </div>
        <p className="adm-cmd-status" role="status" aria-live="polite">{mensagem}</p>
        {status.kind === "ok" && status.data.degraded && !curto && (
          <p className="adm-aviso-degradado">Busca parcial: só eventos até a atualização do banco.</p>
        )}
        <ul className="adm-cmd-list" id={`${id}-list`} role="listbox" aria-label="Resultados">
          {grupos.map((g) => (
            <li key={g} role="presentation">
              <span className="adm-cmd-group" id={`${id}-g-${g}`}>{g}</span>
              <ul role="group" aria-labelledby={`${id}-g-${g}`}>
                {items.map((it, i) => it.group !== g ? null : (
                  <li key={it.key} id={optId(i)} role="option" aria-selected={i === sel} className="adm-cmd-opt"
                    onMouseMove={() => { if (i !== sel) setActive(i); }} onClick={() => go(it)}>
                    <span className="adm-cmd-label">{it.label}</span>
                    <span className="adm-cmd-sub">{it.sub}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

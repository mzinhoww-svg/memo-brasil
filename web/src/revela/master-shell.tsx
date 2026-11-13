"use client";
/* Casca interativa do Master: menu lateral recolhível (trilho de ícones no desktop) e gaveta (off-canvas) no celular e no tablet.
   Um único `<aside>` no DOM: o CSS (`styles/master-responsivo.css`) decide se ele é coluna, trilho ou gaveta, então os seletores de desktop
   (`aside.mside a.mnav`) continuam valendo. A escolha do trilho fica no localStorage (com try/catch) e, antes da hidratação, num atributo do <html>. */
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { MASTER_HREF, MASTER_LOGO, MASTER_NAV, type MasterNavId } from "./master-icons";
import { DESKTOP_QUERY, RAIL_KEY } from "./master-menu";

export interface MasterUser { name: string; role: string }

type RailPref = "1" | "0" | null;
let railMemory: RailPref = null; // vale quando o localStorage não existe ou falha (janela privada, dados bloqueados)
const railListeners = new Set<() => void>();
function readRail(): RailPref {
  try {
    const v = window.localStorage.getItem(RAIL_KEY);
    return v === "1" || v === "0" ? v : null;
  } catch { return railMemory; } // sem armazenamento: vale a memória da página
}
function writeRail(v: "1" | "0") {
  railMemory = v;
  try { window.localStorage.setItem(RAIL_KEY, v); } catch { /* segue só com a memória */ }
  railListeners.forEach((l) => l());
}
function subscribeRail(cb: () => void) {
  railListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { railListeners.delete(cb); window.removeEventListener("storage", cb); };
}
const serverRail = (): RailPref => null;

function subscribeDesktop(cb: () => void) {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getDesktop = () => (typeof window.matchMedia === "function" ? window.matchMedia(DESKTOP_QUERY).matches : true);
const serverDesktop = () => true;

interface MenuCtx {
  desktop: boolean;
  rail: boolean;
  drawerOpen: boolean;
  asideId: string;
  /** Ref de callback do botão da barra de cima (a gaveta devolve o foco a ele). */
  setButton: (el: HTMLButtonElement | null) => void;
  toggle: () => void;
  close: () => void;
  /** Clique num link do menu: fecha a gaveta (no desktop não muda nada). */
  onNavigate: () => void;
}
const Ctx = createContext<MenuCtx>({ desktop: true, rail: false, drawerOpen: false, asideId: "master-menu", setButton: () => undefined, toggle: () => undefined, close: () => undefined, onNavigate: () => undefined });
export const useMasterMenu = () => useContext(Ctx);

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Moldura `.dsk` com o estado do menu. `data-rail` (1/0) só existe depois que a escolha é lida; antes disso vale o atributo do <html>. */
export function MasterChrome({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const desktop = useSyncExternalStore(subscribeDesktop, getDesktop, serverDesktop);
  const pref = useSyncExternalStore(subscribeRail, readRail, serverRail);
  const asideId = useId();
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const drawerOpen = open && !desktop;
  const rail = pref === "1";

  const close = useCallback(() => { setOpen(false); button?.focus(); }, [button]);
  const toggle = useCallback(() => {
    if (desktop) writeRail(readRail() === "1" ? "0" : "1");
    else if (open) close();
    else setOpen(true);
  }, [desktop, open, close]);
  const onNavigate = useCallback(() => { if (open) close(); }, [open, close]);

  // Gaveta aberta: Esc fecha, Tab fica dentro dela, a rolagem do fundo trava e o foco entra no primeiro item.
  useEffect(() => {
    if (!drawerOpen) return;
    const aside = document.getElementById(asideId);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    aside?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab" || !aside) return;
      const items = [...aside.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      const active = document.activeElement;
      if (!aside.contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.documentElement.style.overflow = prev; };
  }, [drawerOpen, asideId, close]);

  // Cruzou para o desktop com a gaveta aberta: ela some e a próxima volta ao celular começa fechada.
  const [wasDesktop, setWasDesktop] = useState(desktop);
  if (desktop !== wasDesktop) { setWasDesktop(desktop); if (desktop) setOpen(false); }

  const value = useMemo<MenuCtx>(() => ({ desktop, rail, drawerOpen, asideId, setButton, toggle, close, onNavigate }), [desktop, rail, drawerOpen, asideId, toggle, close, onNavigate]);
  return (
    <Ctx.Provider value={value}>
      <div className="dsk" data-rail={pref ?? undefined} data-menu={drawerOpen ? "open" : "closed"}>
        {children}
        <div className="mscrim" data-rsp="" aria-hidden="true" onClick={close} />
      </div>
    </Ctx.Provider>
  );
}

const SV = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

/** Botão da barra de cima: no desktop alterna menu completo e trilho; no celular abre e fecha a gaveta. */
export function MenuToggle() {
  const { desktop, rail, drawerOpen, asideId, setButton, toggle } = useMasterMenu();
  const expanded = desktop ? !rail : drawerOpen;
  return (
    <button ref={setButton} type="button" className="mmenu-btn" data-rsp="" aria-label={expanded ? "Recolher menu" : "Abrir menu"} aria-expanded={expanded} aria-controls={asideId} onClick={toggle}>
      <svg {...SV}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
    </button>
  );
}

/** Menu lateral do Master. `visible` (só no app) restringe os itens: o layout tira o que o papel não abre e "Impressões" quando a chave `printed_album` está desligada. */
export function MasterAside({ current, links = false, user = { name: "Marcos", role: "Administrador · master" }, visible }: { current?: MasterNavId; links?: boolean; user?: MasterUser; visible?: readonly MasterNavId[] }) {
  const m = useMasterMenu();
  const items = visible ? MASTER_NAV.filter((n) => visible.includes(n.id)) : [...MASTER_NAV];
  const hidden = !m.desktop && !m.drawerOpen;
  return (
    <aside id={m.asideId} className="mside" aria-label="Menu do console" inert={hidden} aria-hidden={hidden || undefined} data-open={m.drawerOpen || undefined}
      onClick={(e) => { if ((e.target as Element).closest("a")) m.onNavigate(); }}>
      <button type="button" className="mside-close" data-rsp="" aria-label="Fechar menu" onClick={m.close}>
        <svg {...SV}><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      {MASTER_LOGO}
      {items.map((n) => (
        <a key={n.id} className={n.id === current ? "mnav on" : "mnav"} href={links ? MASTER_HREF[n.id] : undefined} aria-current={n.id === current ? "page" : undefined} aria-label={n.label} title={n.label}>
          {n.icon}
          <span>{n.label}</span>
        </a>
      ))}
      <div className="grow" />
      <div className="muser" title={`${user.name} · ${user.role}`}>
        <span className="avatar avatar--sm">{user.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <b>{user.name}</b>
          <span>{user.role}</span>
        </div>
      </div>
    </aside>
  );
}

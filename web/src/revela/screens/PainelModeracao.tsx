"use client";
/* Painel-moderacao.html (17i): mesmo markup da referência; dados reais por props (padrão = desenho). */
import { ScreenHeader, RowAction, ScreenFoot } from "../painel-ui";

export type ModTab = "fotos" | "comentarios" | "bloqueados";
export interface ModcItem {
  id: string;
  img?: string;
  name: string;
  /** Texto vermelho à direita ("3 denúncias"). */
  flag?: string;
  text: string;
  actions: { label: string; danger?: boolean; onClick?: () => void }[];
}
export interface PainelModeracaoProps {
  tab?: ModTab;
  counts?: Partial<Record<ModTab, number>>;
  items?: ModcItem[];
  empty?: string;
  /** Interruptores do bloco "Comentários": `on` desenha ligado; sem `onClick` não mudam (regra do servidor). */
  toggles?: { label: string; on: boolean; onClick?: () => void }[];
  onTab?: (tab: ModTab) => void;
  onBack?: () => void;
}

export const MODERACAO_REF: Required<Omit<PainelModeracaoProps, "onTab" | "onBack">> = {
  tab: "comentarios",
  counts: { comentarios: 2 },
  items: [
    { id: "1", img: "/revela/ref/sc-pista.jpg", name: "Primo Jorge", flag: "3 denúncias", text: "Essa aí da gravata já tava passando mal kkkk", actions: [{ label: "Manter" }, { label: "Esconder", danger: true }] },
    { id: "2", img: "/revela/ref/sc-brinde.jpg", name: "Convidado sem nome", flag: "1 denúncias", text: "Quem trouxe esse cara?", actions: [{ label: "Manter" }, { label: "Esconder", danger: true }] },
  ],
  empty: "",
  toggles: [{ label: "Comentários ligados", on: true }, { label: "Esconder ao receber 3 denúncias", on: true }],
};

const TABS: { id: ModTab; label: string }[] = [{ id: "fotos", label: "Fotos" }, { id: "comentarios", label: "Comentários" }, { id: "bloqueados", label: "Bloqueados" }];

export function PainelModeracao({ tab = MODERACAO_REF.tab, counts = MODERACAO_REF.counts, items = MODERACAO_REF.items, empty = MODERACAO_REF.empty, toggles = MODERACAO_REF.toggles, onTab, onBack }: PainelModeracaoProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe">
        <ScreenHeader onBack={onBack} title="Moderação" />
        <div style={{ "marginTop": "14px" }}>
          <div className="seg">
            {TABS.map((t) => (
              <span key={t.id} className={tab === t.id ? "on" : ""} role={onTab ? "button" : undefined} tabIndex={onTab ? 0 : undefined} aria-pressed={onTab ? tab === t.id : undefined}
                onClick={onTab ? () => onTab(t.id) : undefined} onKeyDown={onTab ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTab(t.id); } } : undefined} style={onTab ? { "cursor": "pointer" } : undefined}>
                {t.label}{counts[t.id] ? ` ${counts[t.id]}` : ""}
              </span>
            ))}
          </div>
        </div>
        <div className="stack" style={{ "marginTop": "16px" }}>
          {items.length === 0 && empty ? <p className="rv-caption">{empty}</p> : null}
          {items.map((it) => (
            <div key={it.id} className="modc">
              {it.img ? (
                <img src={it.img} alt="" />
              ) : null}
              <div style={{ "flex": "1" }}>
                <div className="row between">
                  <b>
                    {it.name}
                  </b>
                  {it.flag && (
                    <span className="rv-caption" style={{ "color": "var(--danger)" }}>
                      {it.flag}
                    </span>
                  )}
                </div>
                <p>
                  {it.text}
                </p>
                <div className="row" style={{ "gap": "8px" }}>
                  {it.actions.map((a) => (
                    <button key={a.label} type="button" className="rv-btn rv-btn--sm" style={a.danger ? { "color": "var(--danger)" } : undefined} onClick={a.onClick}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <h2 className="rv-group-h">
          Comentários
        </h2>
        <div className="rv-group rv-rise">
          {toggles.map((t) => (
            <RowAction key={t.label} onClick={t.onClick} role="switch" checked={t.on}>
              <div className="rv-row__text">
                {t.label}
              </div>
              <span className={t.on ? "rv-toggle rv-toggle--on" : "rv-toggle"} />
            </RowAction>
          ))}
        </div>
      </div>
      <ScreenFoot />
    </div>
    </>
  );
}

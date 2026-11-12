"use client";
/* Os quatro estados das telas do Master (vazio, erro, sem permissão, carregando) com o markup de
   design-system/revela/master/html/Master-*--vazio|--erro|--sem-permissao|--carregando.html (`.mstate`, `.msk`).
   Um componente só para todas as telas: cada tela passa o título e o texto do estado vazio e o nome da ÁREA (título da página no "sem permissão"). */
import type { CSSProperties, ReactNode } from "react";
import { Ico, MHead } from "../master-kit";

export type StateVariant = "empty" | "error" | "denied" | "loading";

export const DENIED_TITLE = "Sem permissão para ver estes dados.";
export const DENIED_TEXT = "Seu papel não dá acesso a esta área. Fale com um master se precisar.";
export const ERROR_TITLE = "Não foi possível carregar";
export const ERROR_TEXT = "Os dados não chegaram. Nada foi alterado.";

/** Largura de cada barra do esqueleto, igual à do desenho: linha r, coluna c → 40% a 89%. */
export const skeletonWidth = (r: number, c: number): number => 40 + ((37 * r + 23 * c) % 50);

export interface MasterStateProps {
  variant: StateVariant;
  /** Vazio: título e texto da tela (ex.: "Nenhuma conta neste filtro" / "Troque o filtro ou limpe a busca."). */
  title?: string;
  text?: string;
  /** Erro: o que fazer no "Tentar de novo" (padrão: recarregar a página). */
  onRetry?: () => void;
  /** Carregando: colunas e linhas do esqueleto (as da tabela da tela) e o rótulo para leitor de tela. */
  cols?: number;
  rows?: number;
  label?: string;
  style?: CSSProperties;
}

export function MasterState({ variant, title, text, onRetry, cols = 6, rows = 8, label = "Carregando", style }: MasterStateProps) {
  if (variant === "loading") {
    const g = { gridTemplateColumns: Array.from({ length: cols }, () => "1fr").join(" ") };
    return (
      <div className="mtable" aria-busy="true" aria-label={label} style={style}>
        {Array.from({ length: rows }, (_, r) => (
          <div className="mtr" style={g} key={r}>
            {Array.from({ length: cols }, (_, c) => <span key={c}><i className="msk" style={{ width: `${skeletonWidth(r, c)}%` }} /></span>)}
          </div>
        ))}
      </div>
    );
  }
  const icon = variant === "denied" ? "lock" : variant === "error" ? "warn" : "search";
  const t = variant === "denied" ? DENIED_TITLE : variant === "error" ? ERROR_TITLE : (title ?? "Nada por aqui ainda");
  const d = variant === "denied" ? DENIED_TEXT : variant === "error" ? ERROR_TEXT : (text ?? "Troque o filtro ou limpe a busca.");
  return (
    <div className="mstate" role={variant === "empty" ? undefined : "alert"} style={style}>
      <Ico n={icon} />
      <h2 className="rv-title" style={{ fontSize: "20px" }}>{t}</h2>
      <p className="rv-caption">{d}</p>
      {variant === "error" && (
        <button type="button" className="rv-btn rv-btn--sm" onClick={onRetry ?? (() => window.location.reload())}><Ico n="refresh" />Tentar de novo</button>
      )}
    </div>
  );
}

export interface MasterStatePageProps extends MasterStateProps {
  /** Nome da ÁREA ("Eventos", "Pessoas"…): é o título da página nos estados sem permissão, erro e carregando; nunca o nome do evento ou da pessoa. */
  area: string;
  /** Legenda do cabeçalho; nos estados de erro, sem permissão e carregando o desenho usa "—". */
  caption?: string;
  /** Botões do cabeçalho (ex.: Exportar): o desenho os mostra no vazio e no carregando, não no erro nem no sem permissão. */
  actions?: ReactNode;
  /** Abas ou filtros que o desenho mantém acima do estado (ex.: as abas de Pessoas). */
  tabs?: ReactNode;
}

/** Cabeçalho + abas + estado: a página inteira de um estado, dentro do miolo do Master. */
export function MasterStatePage({ area, caption, actions, tabs, ...state }: MasterStatePageProps) {
  const shown = state.variant === "empty" || state.variant === "loading" ? actions : undefined;
  return (
    <>
      <MHead title={area} caption={caption ?? "—"}>{shown}</MHead>
      {tabs}
      <MasterState {...state} />
    </>
  );
}

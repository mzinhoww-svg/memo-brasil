"use client";
/* Anfitriao-moderar.html (17c), refeita para o celular no PainelFrame: contagem, filtros, grade de 2 colunas com autor e hora,
   esqueleto por foto, "não carregou" com tentar de novo e "Revelar agora" no rodapé fixo. Dados reais por props (padrão = desenho). */
import { useEffect, useRef, useState } from "react";
import { Chip, Chips } from "@/components/revela/Chip";
import { Select } from "@/components/revela/Select";
import { PainelFoot, ScreenFoot, ScreenHeader, svgProps, useEmbedded } from "../painel-ui";

export interface ModItem {
  id: string;
  /** URL da miniatura; sem ela a foto mostra o esqueleto (a URL assinada ainda não chegou). */
  src?: string;
  /** Autor (primeiro nome). */
  name: string;
  /** Hora da foto ("21:42"). */
  when?: string;
  /** Tirada do álbum pelo anfitrião. */
  off?: boolean;
  /** Tem denúncias. */
  reported?: boolean;
  alt?: string;
}
export interface ModFilter { id: string; label: string; count: number }
export interface ModPerson { value: string; label: string }
export interface AnfitriaoModerarProps {
  /** Situação da revelação em texto claro ("Revelada", "Revela às 12:00"). */
  status?: string;
  /** "3 fotos · 1 removida". */
  count?: string;
  intro?: string;
  hint?: string;
  items?: ModItem[];
  filters?: ModFilter[];
  filter?: string;
  onFilter?: (id: string) => void;
  /** Filtro por pessoa; só aparece com mais de uma. */
  people?: ModPerson[];
  person?: string;
  onPerson?: (value: string) => void;
  /** Mostra "Revelar agora" (só enquanto a revelação está pendente). */
  canReveal?: boolean;
  /** Texto de quando não há fotos nenhuma. */
  empty?: string;
  onEmptyAction?: () => void;
  emptyActionLabel?: string;
  /** Texto de quando o filtro não acha nada. */
  noMatch?: string;
  onBack?: () => void;
  onItem?: (id: string) => void;
  onReveal?: () => void;
  /** Há mais fotos além das mostradas (carrega ao chegar ao fim ou pelo botão). */
  onMore?: () => void;
}

export const MODERAR_REF = {
  status: "Revela às 12:00", count: "6 fotos · 1 removida",
  intro: "O resto revela para todos no domingo, às 12:00.", hint: "Toque numa foto para ver e tirar do álbum.",
  items: [
    { id: "1", src: "/revela/ref/sc-pista.jpg", name: "Bia", when: "21:42" },
    { id: "2", src: "/revela/ref/sc-bolo.jpg", name: "Rafa", when: "21:40" },
    { id: "3", src: "/revela/ref/sc-camera.jpg", name: "Leo", when: "21:31", off: true },
    { id: "4", src: "/revela/ref/sc-aliancas.jpg", name: "Leo", when: "21:20" },
    { id: "5", src: "/revela/ref/sc-baloes.jpg", name: "Tia Lu", when: "21:12" },
    { id: "6", src: "/revela/ref/sc-bolo-natural.jpg", name: "Ana", when: "21:05" },
  ] satisfies ModItem[],
};

/** Uma foto da grade: esqueleto até a URL chegar, "não carregou" com tentar de novo se a imagem falhar. */
function Tile({ it, onItem }: { it: ModItem; onItem?: (id: string) => void }) {
  const [failed, setFailed] = useState<string | undefined>();
  const [attempt, setAttempt] = useState(0);
  const broken = failed !== undefined && failed === it.src; // URL nova (renovada) tenta de novo sozinha
  const label = `Foto de ${it.name}${it.when ? `, ${it.when}` : ""}${it.off ? ", removida do álbum" : ""}${it.reported ? ", denunciada" : ""}`;
  return (
    <li className={`cont-tile${it.off ? " off" : ""}`}>
      {broken ? (
        <div className="cont-media cont-fail">
          <span>Não carregou</span>
          <button type="button" className="rv-btn rv-btn--sm" onClick={() => { setFailed(undefined); setAttempt((n) => n + 1); }}>Tentar de novo</button>
        </div>
      ) : (
        <button type="button" className="cont-media cont-open" aria-label={label} onClick={onItem ? () => onItem(it.id) : undefined} disabled={!onItem}>
          {it.src
            ? <img key={attempt} src={it.src} alt={it.alt ?? ""} loading="lazy" onError={() => setFailed(it.src)} />
            : <span className="rv-skeleton cont-skel" aria-hidden="true" />}
          {(it.off || it.reported) && (
            <span className="cont-flags">
              {it.off && <span className="cont-flag cont-flag--off">Removida</span>}
              {it.reported && <span className="cont-flag cont-flag--rep">Denunciada</span>}
            </span>
          )}
        </button>
      )}
      <p className="cont-cap"><b>{it.name}</b>{it.when ? ` · ${it.when}` : ""}</p>
    </li>
  );
}

/** Foto grande na folha do Conteúdo: esqueleto até a URL chegar, aviso se a imagem não carregar. */
export function ModFotoGrande({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState<string | undefined>();
  const broken = failed !== undefined && failed === src;
  return (
    <div className="cont-viewer-media">
      {src && !broken ? <img src={src} alt={alt} onError={() => setFailed(src)} /> : broken ? <p className="cont-fail rv-caption">Não carregou a foto grande.</p> : <span className="rv-skeleton cont-skel" aria-hidden="true" />}
    </div>
  );
}

export function AnfitriaoModerar({
  status = MODERAR_REF.status, count = MODERAR_REF.count, intro = MODERAR_REF.intro, hint = MODERAR_REF.hint, items = MODERAR_REF.items,
  filters, filter, onFilter, people, person, onPerson, canReveal = true, empty = "", onEmptyAction, emptyActionLabel, noMatch = "Nenhuma foto neste filtro.",
  onBack, onItem, onReveal, onMore,
}: AnfitriaoModerarProps = {}) {
  const embedded = useEmbedded();
  const more = useRef(onMore);
  useEffect(() => { more.current = onMore; });
  const end = useRef<HTMLDivElement>(null);
  const hasMore = Boolean(onMore);
  // carrega mais ao chegar ao fim da lista; o botão "Ver mais fotos" continua no fluxo para quem prefere tocar
  useEffect(() => {
    const el = end.current;
    if (!el || !hasMore || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) more.current?.(); }, { rootMargin: "240px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, items.length]);

  const none = items.length === 0;
  const nothingAtAll = none && Boolean(empty) && (filter === undefined || filter === "todas") && (person === undefined || person === "");
  const reveal = canReveal && (
    <button type="button" className="rv-btn rv-btn--block rv-btn--line" onClick={onReveal}>
      <svg {...svgProps}>
        <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      </svg>
      Revelar agora
    </button>
  );
  return (
    <>
    <div className="scr cont">
      <div className="safe">
        <ScreenHeader onBack={onBack} title="Conteúdo" />
        <div className="cont-head">
          <p className="cont-count" data-testid="conteudo-contagem">{count}</p>
          <p className="cont-status">{status}</p>
        </div>
        <p className="rv-caption cont-intro">{intro}</p>
        {!nothingAtAll && <p className="rv-caption cont-intro">{hint}</p>}
        {filters && onFilter && !nothingAtAll && (
          <div className="cont-filters">
            <Chips label="Filtrar fotos">
              {filters.map((f) => <Chip key={f.id} variant="filtro" pressed={filter === f.id} count={f.count} onClick={() => onFilter(f.id)}>{f.label}</Chip>)}
            </Chips>
            {people && people.length > 1 && onPerson && (
              <Select label="Por pessoa" value={person ?? ""} onChange={(e) => onPerson(e.target.value)} options={[{ value: "", label: "Todas as pessoas" }, ...people]} />
            )}
          </div>
        )}
        {nothingAtAll && (
          <div className="cont-empty">
            <span className="cont-empty-ico" aria-hidden="true">
              <svg {...svgProps}>
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="9" cy="10" r="2" />
                <path d="M21 16l-5-5-9 9" />
              </svg>
            </span>
            <p className="rv-body">{empty}</p>
            {onEmptyAction && <button type="button" className="rv-btn rv-btn--primary" onClick={onEmptyAction}>{emptyActionLabel ?? "Compartilhar o QR"}</button>}
          </div>
        )}
        {none && !nothingAtAll && <p className="rv-caption cont-nomatch" role="status">{noMatch}</p>}
        {!none && (
          <ul className="cont-grid">
            {items.map((it) => <Tile key={it.id} it={it} onItem={onItem} />)}
          </ul>
        )}
        <div ref={end} aria-hidden="true" />
        {onMore && <button type="button" className="rv-btn rv-btn--text cont-more" onClick={onMore}>Ver mais fotos</button>}
        {embedded ? <PainelFoot>{reveal}</PainelFoot> : (<><div className="grow" />{reveal}</>)}
      </div>
      <ScreenFoot />
    </div>
    </>
  );
}

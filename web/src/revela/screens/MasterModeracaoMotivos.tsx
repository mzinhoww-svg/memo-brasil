/* Master-moderacao-motivos.html (M26) e variantes: markup e classes da referência via master-kit; dados por props (padrão = desenho).
   A fila nunca traz foto nem quem denunciou: cada foto é só "foto 3f1a…", o evento, o total e os motivos agregados. */
import { Fragment, type ReactNode } from "react";
import { MasterState, MasterStatePage } from "../master/MasterState";
import { Ico, MHead, MNote, MTable, MasterFrame, Seg, St } from "../master-kit";

export interface ModFotoRow { key: string; id: string; event: string; reports: number; chips: string[]; hidden: boolean; actions?: ReactNode }
export interface ModComentarioRow { key: string; text: string; event: string; reports: number; chips: string[]; hidden: boolean; actions?: ReactNode }
export interface ModBloqueadoRow { key: string; event: string; name: string; when: string }
export type ModTabId = "fotos" | "comentarios" | "bloqueados";
export interface ModTabCounts { fotos?: number; comentarios?: number; bloqueados?: number }

export const MOD_CAPTION = "Denúncias de todos os eventos que os anfitriões ainda não resolveram";
export const MOD_NOTE_FOTOS = "A foto não aparece aqui, só a identificação. Quem denunciou nunca é mostrado. Para ver uma foto, o anfitrião precisa abrir um chamado.";
export const MOD_NOTE_COMENTARIOS = "Quem denunciou nunca é mostrado. Com 3 denúncias, o comentário some sozinho até alguém decidir.";
export const MOD_EMPTY: Record<ModTabId, { title: string; text: string }> = {
  fotos: { title: "Nenhuma denúncia aberta", text: "Quando um convidado denunciar uma foto, ela aparece aqui." },
  comentarios: { title: "Nenhum comentário denunciado", text: "Quando um convidado denunciar um comentário, ele aparece aqui." },
  bloqueados: { title: "Nenhum participante bloqueado", text: "Quando um anfitrião bloquear alguém, a pessoa aparece aqui." },
};

const btns = (a: string[]) => <>{a.map((l, i) => <Fragment key={l}>{i > 0 && " "}<button className="rv-btn rv-btn--sm">{l}</button></Fragment>)}</>;
const KEEP_HIDE = btns(["Manter", "Esconder"]);
const KEEP_DEL = btns(["Manter", "Excluir"]);
export const REF_FOTOS: ModFotoRow[] = [
  { key: "1", id: "foto 3f1a…", event: "Chá da Maria", reports: 3, chips: ["2 Conteúdo impróprio", "1 Outro motivo"], hidden: false, actions: KEEP_HIDE },
  { key: "2", id: "foto 9c04…", event: "Chá da Maria", reports: 2, chips: ["2 Não quero aparecer"], hidden: false, actions: KEEP_HIDE },
  { key: "3", id: "foto b77e…", event: "Formatura Medicina UFMT", reports: 4, chips: ["3 Foto constrangedora", "1 Conteúdo impróprio"], hidden: true, actions: KEEP_DEL },
  { key: "4", id: "foto 51d2…", event: "30 anos do Rafa", reports: 1, chips: ["1 Outro motivo"], hidden: false, actions: KEEP_HIDE },
];
export const REF_COMENTARIOS: ModComentarioRow[] = [
  { key: "1", text: "“Essa aí da gravata já tava passando mal kkkk”", event: "Chá da Maria", reports: 3, chips: ["2 Ofensivo", "1 Outro motivo"], hidden: false, actions: KEEP_HIDE },
  { key: "2", text: "“Quem trouxe esse cara?”", event: "Chá da Maria", reports: 1, chips: ["1 Ofensivo"], hidden: false, actions: KEEP_HIDE },
  { key: "3", text: "“Ganhe seguidores em…”", event: "Formatura Medicina UFMT", reports: 5, chips: ["5 Spam"], hidden: true, actions: KEEP_DEL },
];
export const REF_COUNTS: ModTabCounts = { fotos: 4, comentarios: 7, bloqueados: 6 };
export const REF_EXPORT = <button className="rv-btn rv-btn--sm"><Ico n="download" />Exportar</button>;

const TAB_LABEL: Record<ModTabId, string> = { fotos: "Fotos", comentarios: "Comentários", bloqueados: "Participantes bloqueados" };
const TAB_ORDER: ModTabId[] = ["fotos", "comentarios", "bloqueados"];

/** As três abas (largura do desenho: 660 px); sem contagem mostra só o nome. Com `href` as abas são links. */
export function ModTabs({ tab, counts = REF_COUNTS, hrefs }: { tab: ModTabId; counts?: ModTabCounts; hrefs?: Record<ModTabId, string> }) {
  return (
    <div style={{ width: "660px", marginBottom: "14px" }}>
      <Seg items={TAB_ORDER.map((t) => ({ label: counts[t] == null ? TAB_LABEL[t] : `${TAB_LABEL[t]} ${counts[t]}`, on: t === tab, href: hrefs?.[t] }))} />
    </div>
  );
}

export const Chips = ({ items }: { items: string[] }) => <>{items.map((c, i) => <Fragment key={c}>{i > 0 && " "}<span className="chip chip--sm">{c}</span></Fragment>)}</>;
export const COLS_FOTO = ".7fr 1.2fr .6fr 1.9fr .7fr 1.5fr";
const COLS_COM = "1.9fr 1.1fr .6fr 1.4fr .7fr 1.5fr";

export interface ModeracaoViewProps {
  tab?: ModTabId;
  counts?: ModTabCounts;
  hrefs?: Record<ModTabId, string>;
  caption?: string;
  /** Botão "Exportar" do cabeçalho (some para quem não exporta). */
  exportAction?: ReactNode;
  fotos?: ModFotoRow[];
  comentarios?: ModComentarioRow[];
  bloqueados?: ModBloqueadoRow[];
}

export function MasterModeracaoMotivosView({
  tab = "fotos", counts = REF_COUNTS, hrefs, caption = MOD_CAPTION, exportAction = REF_EXPORT, fotos = REF_FOTOS, comentarios = REF_COMENTARIOS, bloqueados = [],
}: ModeracaoViewProps = {}) {
  const rows = tab === "fotos" ? fotos.length : tab === "comentarios" ? comentarios.length : bloqueados.length;
  return (
    <>
      <MHead title="Moderação" caption={caption}>{exportAction}</MHead>
      <ModTabs tab={tab} counts={counts} hrefs={hrefs} />
      {rows === 0 ? <MasterState variant="empty" {...MOD_EMPTY[tab]} /> : (
        <>
          {tab === "fotos" && <MTable cols={COLS_FOTO} head={["Foto", "Evento", "Denúncias", "Motivos", "Situação", ""]} rows={fotos.map((p) => ({
            key: p.key, cells: [<code key="c">{p.id}</code>, p.event, String(p.reports), <Chips key="m" items={p.chips} />, <St key="s" tone={p.hidden ? "bad" : "wait"}>{p.hidden ? "escondida" : "visível"}</St>, p.actions],
          }))} />}
          {tab === "comentarios" && <MTable cols={COLS_COM} head={["Comentário", "Evento", "Denúncias", "Motivos", "Situação", ""]} rows={comentarios.map((c) => ({
            key: c.key, cells: [c.text, c.event, String(c.reports), <Chips key="m" items={c.chips} />, <St key="s" tone={c.hidden ? "bad" : "wait"}>{c.hidden ? "escondido" : "visível"}</St>, c.actions],
          }))} />}
          {tab === "bloqueados" && <MTable cols="1.4fr 1.4fr 1fr" head={["Evento", "Participante", "Bloqueado em"]} rows={bloqueados.map((b) => ({ key: b.key, cells: [b.event, b.name, b.when] }))} />}
          {tab === "fotos" && <MNote icon="lock">{MOD_NOTE_FOTOS}</MNote>}
          {tab === "comentarios" && <MNote icon="lock">{MOD_NOTE_COMENTARIOS}</MNote>}
        </>
      )}
    </>
  );
}

/** M26: fotos (padrão) e M26.b: comentários. */
export function MasterModeracaoMotivos(props: ModeracaoViewProps = {}) {
  return <MasterFrame current="moderacao"><MasterModeracaoMotivosView {...props} /></MasterFrame>;
}

/** Estado de página inteira da M26 (vazio, erro, sem permissão, carregando) com as abas do desenho. */
export function MasterModeracaoMotivosEstado({ variant, tab = "fotos", counts = REF_COUNTS, hrefs, exportAction = REF_EXPORT }: { variant: "empty" | "error" | "denied" | "loading"; tab?: ModTabId; counts?: ModTabCounts; hrefs?: Record<ModTabId, string>; exportAction?: ReactNode }) {
  return (
    <MasterStatePage area="Moderação" variant={variant} caption={variant === "empty" ? MOD_CAPTION : undefined} actions={exportAction} tabs={<ModTabs tab={tab} counts={counts} hrefs={hrefs} />}
      {...(variant === "empty" ? MOD_EMPTY[tab] : {})} cols={6} rows={8} />
  );
}

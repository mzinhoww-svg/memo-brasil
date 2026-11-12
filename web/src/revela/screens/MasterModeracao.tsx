/* Master-moderacao.html (M09): markup e classes da referência via master-kit; dados por props (padrão = desenho). */
import type { ReactNode } from "react";
import { Ico, MHead, MNote, MTable, MasterFrame, St } from "../master-kit";

export interface ModFoto { key: string; event: string; reports: string; reason: string; image?: string; actions?: ReactNode }
export interface ModComentario { key: string; event: string; reports: string; author: string; body: string; status?: string; actions?: ReactNode }
export interface ModBloqueado { key: string; event: string; name: string; when: string }
export interface ModeracaoProps {
  tab?: "fotos" | "comentarios" | "bloqueados";
  tabs?: { label: string; href?: string; on?: boolean }[];
  caption?: string;
  photos?: ModFoto[];
  comments?: ModComentario[];
  blocked?: ModBloqueado[];
  note?: ReactNode;
  pager?: ReactNode;
}

const act = (
  <>
    <button className="rv-btn rv-btn--sm">Manter</button>
    <button className="rv-btn rv-btn--sm">Esconder</button>
    <button className="rv-btn rv-btn--sm" style={{ color: "var(--danger)" }} aria-label="Remover"><Ico n="trash" /></button>
  </>
);
const REF_PHOTOS: ModFoto[] = [
  { key: "1", event: "Chá da Maria", reports: "3 denúncias", reason: "Não quero aparecer nesta foto", image: "/revela/ref/sc-pista.jpg", actions: act },
  { key: "2", event: "Chá da Maria", reports: "2 denúncias", reason: "Foto constrangedora", image: "/revela/ref/sc-brinde.jpg", actions: act },
  { key: "3", event: "30 anos do Rafa", reports: "1 denúncias", reason: "Outro motivo", image: "/revela/ref/sc-bolo-natural.jpg", actions: act },
  { key: "4", event: "Formatura Medicina", reports: "4 denúncias", reason: "Conteúdo impróprio", image: "/revela/ref/sc-baloes.jpg", actions: act },
];
const REF_TABS = [{ label: "Fotos 4", on: true }, { label: "Comentários 7" }, { label: "Participantes bloqueados" }];

export function MasterModeracaoView({
  tab = "fotos", tabs = REF_TABS, caption = "Denúncias de todos os eventos que os anfitriões ainda não resolveram", photos = REF_PHOTOS, comments = [], blocked = [], note, pager,
}: ModeracaoProps = {}) {
  return (
    <>
      <MHead title="Moderação" caption={caption} />
      <div className="row" style={{ gap: "8px", marginBottom: "14px" }}>
        {tabs.map((t) => (t.href ? <a key={t.label} className={t.on ? "chip on" : "chip"} href={t.href}>{t.label}</a> : <span key={t.label} className={t.on ? "chip on" : "chip"}>{t.label}</span>))}
      </div>
      {note}
      {tab === "fotos" && (
        <div className="mmods">
          {photos.map((p) => (
            <div className="mmod" key={p.key}>
              {/* eslint-disable-next-line @next/next/no-img-element -- cena do kit na tela do desenho; o app não exibe fotos privadas */}
              {p.image ? <img src={p.image} alt="" /> : <div role="img" aria-label="Foto privada: o console não exibe imagens" style={{ height: "250px", display: "grid", placeItems: "center", background: "var(--surface-2)", color: "var(--ink-faint)" }}><Ico n="lock" size={20}/></div>}
              <div className="mmod-b">
                <div className="row between"><b>{p.event}</b><span className="rv-caption" style={{ color: "var(--danger)" }}>{p.reports}</span></div>
                <span className="rv-caption">{p.reason}</span>
                {p.actions && <div className="row" style={{ gap: "6px", marginTop: "10px" }}>{p.actions}</div>}
              </div>
            </div>
          ))}
          {!photos.length && <MNote icon="shield">Nenhuma foto denunciada.</MNote>}
        </div>
      )}
      {tab === "comentarios" && (
        <div className="mmods">
          {comments.map((c) => (
            <div className="mmod" key={c.key}>
              <div className="mmod-b">
                <div className="row between"><b>{c.event}</b><span className="rv-caption" style={{ color: "var(--danger)" }}>{c.reports}</span></div>
                <span className="rv-caption">{c.author}</span>
                <p style={{ margin: "8px 0 0", font: "400 14px/20px var(--font-sans)", overflowWrap: "anywhere" }}>{c.body}</p>
                {c.status && <div style={{ marginTop: "8px" }}><St tone="info">{c.status}</St></div>}
                {c.actions && <div className="row" style={{ gap: "6px", marginTop: "10px" }}>{c.actions}</div>}
              </div>
            </div>
          ))}
          {!comments.length && <MNote icon="shield">Nenhum comentário denunciado ou escondido.</MNote>}
        </div>
      )}
      {tab === "bloqueados" && (
        <MTable cols="1.4fr 1.4fr 1fr" head={["Evento", "Participante", "Bloqueado em"]} rows={blocked.map((b) => ({ key: b.key, cells: [b.event, b.name, b.when] }))} empty="Nenhum participante bloqueado." />
      )}
      {pager}
    </>
  );
}

export function MasterModeracao(props: ModeracaoProps = {}) {
  return <MasterFrame current="moderacao"><MasterModeracaoView {...props} /></MasterFrame>;
}

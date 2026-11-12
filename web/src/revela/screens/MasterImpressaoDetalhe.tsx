/* Master-impressao-detalhe.html (M30): detalhe do pedido de impressão. Uma só `MasterImpressaoDetalheView` para o desenho (fixture) e para o app.
   Fotos só como números; a nota interna é só do master (a página só abre para o master, e o banco confere de novo). */
import type { ReactNode } from "react";
import { STATUS_LABEL, STATUS_TONE, photosText, type PrintStatus, type TimelineStep } from "@/lib/master/print-orders";
import { Ico, MasterFrame, MHead } from "../master-kit";

export interface ImpressaoDetalheData {
  code: string;
  /** "Álbum · 1 unidade · Ana & Leo · criado hoje 08:12" */
  caption: string;
  status: PrintStatus;
  contact: { name: string; phone: string; email: string; address: string; note: string };
  photos: { count: number; nums: number[] };
  timeline: TimelineStep[];
  noteInternal: string;
}

export const DETALHE_FIXTURE: ImpressaoDetalheData = {
  code: "IMP-7K2Q",
  caption: "Álbum · 1 unidade · Ana & Leo · criado hoje 08:12",
  status: "solicitado",
  contact: { name: "Ana Ribeiro · anfitriã", phone: "(65) 99812-4077", email: "ana.ribeiro@email.com", address: "Rua das Mangueiras, 480, apto 62 · Jardim Itália · Cuiabá, MT · 78060-000", note: "Entregar na portaria, por favor." },
  photos: { count: 48, nums: [3, 7, 12, 15, 19, 22, 27, 31, 33, 40, 41, 46, 52, 58, 60, 64, 71, 77] },
  timeline: [
    { tone: "ok", label: "Solicitado", caption: "hoje 08:12 · Ana Ribeiro" },
    { tone: "todo", label: "Em produção" }, { tone: "todo", label: "Enviado" }, { tone: "todo", label: "Entregue" },
  ],
  noteInternal: "Conferir com a gráfica o prazo do papel fosco.",
};

export interface MasterImpressaoDetalheViewProps {
  data?: ImpressaoDetalheData;
  /** Botões do cabeçalho (Voltar, Cancelar pedido, avançar). O padrão é o desenho, sem ação. */
  actions?: ReactNode;
  note?: { value?: string; onChange?: (v: string) => void; onBlur?: () => void; error?: string | null; disabled?: boolean };
  /** Esmaece o corpo atrás de uma folha (`.mdim`); o cabeçalho fica de fora, como no desenho. */
  dim?: boolean;
}

/** Botões do cabeçalho do desenho: Voltar, Cancelar pedido (vermelho) e o passo seguinte (cheio). */
export function DetalheActions({ back, onCancel, advance }: { back?: { href: string } | { onClick: () => void }; onCancel?: (() => void) | null; advance?: { label: string; onClick?: () => void } | null }) {
  return (
    <>
      {back && "href" in back
        ? <a className="rv-btn rv-btn--sm" href={back.href}><Ico n="back" />Voltar</a>
        : <button type="button" className="rv-btn rv-btn--sm" onClick={back?.onClick}><Ico n="back" />Voltar</button>}
      {onCancel !== null && <button type="button" className="rv-btn rv-btn--sm" style={{ color: "var(--danger)" }} onClick={onCancel}>Cancelar pedido</button>}
      {advance !== null && <button type="button" className="rv-btn rv-btn--sm rv-btn--primary" onClick={advance?.onClick}><Ico n="arrow" />{advance?.label ?? "Marcar em produção"}</button>}
    </>
  );
}

export function MasterImpressaoDetalheView({ data = DETALHE_FIXTURE, actions = <DetalheActions />, note = {}, dim }: MasterImpressaoDetalheViewProps) {
  const extra = Math.max(0, data.photos.count - data.photos.nums.length);
  const body = (
      <div className="mgrid2" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
        <div className="stack" style={{ gap: "14px" }}>
          <section className="mcard">
            <h2 className="rv-title" style={{ fontSize: "18px" }}>Contato e entrega</h2>
            <div className="kv">
              <div><span>Nome</span><b>{data.contact.name}</b></div>
              <div><span>Telefone</span><b>{data.contact.phone}</b></div>
              <div><span>E-mail</span><b>{data.contact.email}</b></div>
              <div><span>Endereço</span><b>{data.contact.address}</b></div>
              <div><span>Observação</span><b>{data.contact.note}</b></div>
            </div>
          </section>
          <section className="mcard">
            <h2 className="rv-title" style={{ fontSize: "18px" }}>Fotos escolhidas</h2>
            <p className="rv-caption" style={{ marginTop: "8px" }}>{photosText(data.photos.count)} Só os números aparecem aqui; as imagens ficam no evento.</p>
            <div className="nums">
              {data.photos.nums.map((n) => <span key={n}>{n}</span>)}
              {extra > 0 && <span>+{extra}</span>}
            </div>
          </section>
        </div>
        <div className="stack" style={{ gap: "14px" }}>
          <section className="mcard">
            <h2 className="rv-title" style={{ fontSize: "18px" }}>Status <em className={`st st--${STATUS_TONE[data.status]}`}>{STATUS_LABEL[data.status]}</em></h2>
            <div className="tls">
              {data.timeline.map((s) => (
                <div className={`tl tl--${s.tone}`} key={s.label}>
                  <i />
                  <div>
                    <b>{s.label}</b>
                    {s.caption && <span className="rv-caption">{s.caption}</span>}
                    {s.reason && <span className="rv-caption">{s.reason}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="mcard">
            <h2 className="rv-title" style={{ fontSize: "18px" }}>Nota interna</h2>
            <p className="rv-caption" style={{ margin: "6px 0 10px" }}>Só o master vê. Até 500 caracteres.</p>
            <label className="rv-field area" style={{ height: "84px" }}>
              <textarea aria-label="Nota interna" maxLength={500} disabled={note.disabled}
                {...(note.onChange ? { value: note.value ?? "", onChange: (e) => note.onChange?.(e.target.value) } : { defaultValue: data.noteInternal })} onBlur={note.onBlur} />
            </label>
            {note.error && <p className="errline" role="alert"><Ico n="warn" />{note.error}</p>}
          </section>
        </div>
      </div>
  );
  return (
    <>
      <MHead title={`Pedido ${data.code}`} caption={data.caption}>{actions}</MHead>
      {dim ? <div className="mdim">{body}</div> : body}
    </>
  );
}

/** A tela do desenho (fixture), com a moldura do Master. */
export function MasterImpressaoDetalhe() {
  return <MasterFrame current="impressoes"><MasterImpressaoDetalheView /></MasterFrame>;
}

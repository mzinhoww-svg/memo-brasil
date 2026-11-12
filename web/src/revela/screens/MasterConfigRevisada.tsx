/* Master-config-revisada.html (M31): Configurações revisada. Uma só `MasterConfigRevisadaView` para o desenho (fixture) e para o app.
   Ambiente do pagamento é SOMENTE LEITURA; chaves e valores abrem a folha com motivo (M31.f1 / M31.f2). Os valores do desenho são fictícios;
   no app vêm de platform_settings, feature_flags e do webhook. */
import { Ico, MasterFrame, MHead } from "../master-kit";

const SV = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const LINK = <svg {...SV}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>;
const PHONE = <svg {...SV}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>;
const BOOK = <svg {...SV}><path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z" /><path d="M4 16a4 4 0 0 1 4-4h10" /></svg>;
const PEOPLE = <svg {...SV}><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.6c2.4.6 4 2.4 4 5.4" /></svg>;

/** Chaves e valores que a tela edita (a mesma chave vai para a RPC). */
export type ConfigEditKey = "pix" | "support_email" | "support_phone" | "company_legal_name" | "company_cnpj" | "capacity_grace_pct";
export type ConfigFlagKey = "validapay_checkout" | "validapay_card" | "printed_album";

export interface MasterConfigRevisadaViewProps {
  /** "Produção" / "Sandbox" / "Desligado" e o tom do selo. */
  env?: { label: string; tone: "ok" | "wait" | "info" };
  flags?: { validapay_checkout: boolean; validapay_card: boolean; printed_album?: boolean };
  values?: { pix: string; support_email: string; support_phone: string; company_legal_name: string; company_cnpj: string; capacity_grace_pct: string };
  webhook?: { meta: string; label: string; tone: "ok" | "wait" | "info" | "bad" };
  /** Sem estes, os botões e as chaves são só desenho. */
  onToggle?: (key: ConfigFlagKey) => void;
  onEdit?: (key: ConfigEditKey) => void;
  /** Mostra o cartão "Recursos" com a chave `printed_album` (só no app; o desenho não a tem). */
  showPrinted?: boolean;
  dim?: boolean;
}

const REF = {
  env: { label: "Produção", tone: "ok" as const },
  flags: { validapay_checkout: true, validapay_card: false },
  values: { pix: "15 min", support_email: "suporte@revela.app", support_phone: "(65) 3000-0000", company_legal_name: "Revela Tecnologia Ltda.", company_cnpj: "00.000.000/0001-00", capacity_grace_pct: "10%" },
  webhook: { meta: "https://revela.app/api/webhooks/validapay · último evento hoje 08:42", label: "Ativo", tone: "ok" as const },
};
export const CONFIG_FIXTURE = REF;
export const CONFIG_CAPTION = "Cada alteração pede motivo e entra na auditoria";

function Switch({ on, label, onClick }: { on: boolean; label: string; onClick?: () => void }) {
  const cls = on ? "rv-toggle rv-toggle--on" : "rv-toggle";
  return onClick
    ? <button type="button" role="switch" aria-checked={on} aria-label={label} className={cls} style={{ border: 0, padding: 0, cursor: "pointer" }} onClick={onClick} />
    : <span className={cls} />;
}

export function MasterConfigRevisadaView({ env = REF.env, flags = REF.flags, values = REF.values, webhook = REF.webhook, onToggle, onEdit, showPrinted, dim }: MasterConfigRevisadaViewProps) {
  const edit = (key: ConfigEditKey, label: string) => <button type="button" className="rv-btn rv-btn--sm" aria-label={`Alterar ${label}`} onClick={onEdit ? () => onEdit(key) : undefined}>Alterar</button>;
  const body = (
    <div className="mgrid2" style={{ gridTemplateColumns: "1.15fr 1fr" }}>
      <section className="mcard">
        <h2 className="rv-title" style={{ fontSize: "18px" }}>Pagamento</h2>
        <div className="rv-group" style={{ marginTop: "14px" }}>
          <div className="rv-row">
            <Ico n="lock" />
            <div className="rv-row__text">Ambiente do pagamento<span className="rv-row__meta">Definido na instalação. Somente leitura.</span></div>
            <em className={`st st--${env.tone}`}>{env.label}</em>
          </div>
          <div className="rv-row">
            <Ico n="coin" />
            <div className="rv-row__text">Checkout ligado<span className="rv-row__meta">Anfitriões conseguem pagar planos</span></div>
            <Switch on={flags.validapay_checkout} label="Checkout ligado" onClick={onToggle ? () => onToggle("validapay_checkout") : undefined} />
          </div>
          <div className="rv-row">
            <Ico n="clock" />
            <div className="rv-row__text">Validade do Pix<span className="rv-row__meta">De 5 a 1.440 minutos</span></div>
            <b>{values.pix}</b>{" "}
            {edit("pix", "validade do Pix")}
          </div>
          <div className="rv-row">
            <Ico n="card" />
            <div className="rv-row__text">Cartão ligado<span className="rv-row__meta">Chave validapay_card. Exige confirmação do banco (3DS).</span></div>
            <Switch on={flags.validapay_card} label="Cartão ligado" onClick={onToggle ? () => onToggle("validapay_card") : undefined} />
          </div>
          <div className="rv-row">
            {LINK}
            <div className="rv-row__text">Webhook<span className="rv-row__meta">{webhook.meta}</span></div>
            <em className={`st st--${webhook.tone}`}>{webhook.label}</em>
          </div>
        </div>
      </section>
      <div className="stack" style={{ gap: "14px" }}>
        <section className="mcard">
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Suporte e empresa</h2>
          <div className="rv-group" style={{ marginTop: "14px" }}>
            <div className="rv-row">
              <Ico n="mail" />
              <div className="rv-row__text">E-mail do suporte<span className="rv-row__meta">{values.support_email}</span></div>
              {edit("support_email", "e-mail do suporte")}
            </div>
            <div className="rv-row">
              {PHONE}
              <div className="rv-row__text">Telefone do suporte<span className="rv-row__meta">{values.support_phone}</span></div>
              {edit("support_phone", "telefone do suporte")}
            </div>
            <div className="rv-row">
              {BOOK}
              <div className="rv-row__text">Razão social<span className="rv-row__meta">{values.company_legal_name}</span></div>
              {edit("company_legal_name", "razão social")}
            </div>
            <div className="rv-row">
              <Ico n="shield" />
              <div className="rv-row__text">CNPJ<span className="rv-row__meta">{values.company_cnpj}</span></div>
              {edit("company_cnpj", "CNPJ")}
            </div>
          </div>
        </section>
        <section className="mcard">
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Capacidade</h2>
          <div className="rv-group" style={{ marginTop: "14px" }}>
            <div className="rv-row">
              {PEOPLE}
              <div className="rv-row__text">Folga de capacidade<span className="rv-row__meta">Convidados aceitos acima do limite do plano</span></div>
              <b>{values.capacity_grace_pct}</b>{" "}
              {edit("capacity_grace_pct", "folga de capacidade")}
            </div>
          </div>
        </section>
        {showPrinted && (
          <section className="mcard">
            <h2 className="rv-title" style={{ fontSize: "18px" }}>Recursos</h2>
            <div className="rv-group" style={{ marginTop: "14px" }}>
              <div className="rv-row">
                <Ico n="photo" />
                <div className="rv-row__text">Álbum impresso<span className="rv-row__meta">Chave printed_album. Mostra Impressões no menu e o pedido de impressão ao anfitrião.</span></div>
                <Switch on={flags.printed_album === true} label="Álbum impresso" onClick={onToggle ? () => onToggle("printed_album") : undefined} />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
  return (
    <>
      <MHead title="Configurações" caption={CONFIG_CAPTION} />
      {dim ? <div className="mdim">{body}</div> : body}
    </>
  );
}

/** A tela do desenho (fixture), com a moldura do Master. */
export function MasterConfigRevisada() {
  return <MasterFrame current="configuracoes"><MasterConfigRevisadaView /></MasterFrame>;
}

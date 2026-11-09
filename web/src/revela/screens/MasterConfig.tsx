"use client";
/* Master-config.html (M14): markup e classes da referência via master-kit. Sem handlers = tela do desenho; com handlers = configuração real
   (app/master/configuracoes/ConfigForm.tsx guarda o rascunho e grava com motivo e auditoria). */
import type { ReactNode } from "react";
import { Ico, MCard, MHead, MasterFrame, St, type IconName, type Tone } from "../master-kit";

export interface ConfigToggle { on: boolean; onToggle?: () => void; label: string }
export interface ConfigField { icon?: IconName; label: string; value: string; placeholder?: string; onChange?: (v: string) => void; readOnly?: boolean; hint?: string }
export interface ConfigProps {
  caption?: string;
  /** Ambiente do ValidaPay (só leitura: vem do servidor). */
  env?: "sandbox" | "production" | "desligado";
  pix?: { minutes: string; onChange?: (v: string) => void; error?: string | null };
  card?: ConfigToggle & { meta?: string };
  webhook?: { meta: string; tone: Tone; label: string };
  checkout?: ConfigToggle;
  platform?: ConfigField[];
  /** Interruptores do cartão "Plataforma" (o desenho traz comentários e aviso por e-mail; o app só mostra o que tem chave). */
  platformToggles?: (ConfigToggle & { icon: IconName })[];
  /** Botão Salvar do cabeçalho. */
  save?: { dirty: boolean; onSave?: () => void; busy?: boolean };
  modal?: ReactNode;
}

const REF_PLATFORM: ConfigField[] = [
  { icon: "photo", label: "Teto de fotos por evento", value: "3.000" }, { icon: "photo", label: "Tamanho máximo da foto", value: "8 MB" }, { icon: "mail", label: "Remetente dos avisos", value: "avisos@revela.app" },
];
const REF_TOGGLES: (ConfigToggle & { icon: IconName })[] = [
  { icon: "chat", label: "Comentários nas fotos", on: true }, { icon: "bell", label: "Aviso de revelação por e-mail", on: true },
];

function Toggle({ t }: { t: ConfigToggle }) {
  const cls = `rv-toggle${t.on ? " rv-toggle--on" : ""}`;
  if (!t.onToggle) return <span className={cls} />;
  return <button type="button" role="switch" aria-checked={t.on} aria-label={t.label} className={cls} onClick={t.onToggle} style={{ border: 0, padding: 0, cursor: "pointer" }} />;
}

export function MasterConfigView({
  caption = "Pagamento, avisos e recursos da plataforma", env = "production", pix = { minutes: "15" }, card = { on: false, label: "Cartão de crédito", meta: "Só com confirmação do banco (3DS). Sua conta ainda não liberou." },
  webhook = { meta: "assinatura HMAC válida · último às 08:42", tone: "ok", label: "Ativo" }, checkout = { on: true, label: "Checkout ligado para anfitriões" }, platform = REF_PLATFORM, platformToggles = REF_TOGGLES, save, modal,
}: ConfigProps = {}) {
  const live = Boolean(pix.onChange);
  return (
    <>
      <MHead title="Configurações" caption={caption}>
        <button type="button" className="rv-btn rv-btn--sm rv-btn--primary" disabled={save ? !save.dirty || save.busy : undefined} onClick={save?.onSave}><Ico n="check" />Salvar</button>
      </MHead>
      <div className="mgrid2">
        <MCard>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>ValidaPay</h2>
          <p className="rv-caption" style={{ margin: "14px 0 8px" }}>Ambiente</p>
          <div style={{ width: "300px" }}>
            <div className="seg" aria-label={live ? "Ambiente definido no servidor (somente leitura)" : undefined}>
              <span className={env === "sandbox" ? "on" : ""}>Sandbox</span>
              <span className={env === "production" ? "on" : ""}>Produção</span>
            </div>
          </div>
          <div className="rv-group" style={{ marginTop: "16px" }}>
            <div className="rv-row">
              <Ico n="pix" />
              <div className="rv-row__text">
                Pix
                <span className="rv-row__meta">{live ? "QR e copia e cola · validade em minutos" : `QR e copia e cola · expira em ${pix.minutes} min`}</span>
                {pix.error && <span className="rv-row__meta" role="alert" style={{ color: "var(--danger)" }}>{pix.error}</span>}
              </div>
              {live ? (
                <label className="mfield" style={{ maxWidth: "96px" }}><input inputMode="numeric" aria-label="Validade do Pix em minutos" value={pix.minutes} onChange={(e) => pix.onChange?.(e.target.value.replace(/\D/g, "").slice(0, 4))} /><i>min</i></label>
              ) : <span className="rv-toggle rv-toggle--on" />}
            </div>
            <div className="rv-row">
              <Ico n="card" />
              <div className="rv-row__text">
                Cartão de crédito
                <span className="rv-row__meta">{card.meta}</span>
              </div>
              <Toggle t={card} />
            </div>
            <div className="rv-row">
              <Ico n="check" />
              <div className="rv-row__text">
                Webhook
                <span className="rv-row__meta" style={{ overflowWrap: "anywhere" }}>{webhook.meta}</span>
              </div>
              <St tone={webhook.tone}>{webhook.label}</St>
            </div>
            <div className="rv-row">
              <Ico n="lock" />
              <div className="rv-row__text">Checkout ligado para anfitriões</div>
              <Toggle t={checkout} />
            </div>
          </div>
        </MCard>
        <MCard>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Plataforma</h2>
          <div className="rv-group" style={{ marginTop: "14px" }}>
            {platform.map((f) => (
              <div className="rv-row" key={f.label}>
                <Ico n={f.icon ?? "photo"} />
                <div className="rv-row__text">
                  <span className="rv-row__meta">{f.label}</span>
                  {f.onChange && !f.readOnly ? (
                    <label className="mfield" style={{ maxWidth: "none", marginTop: "4px" }}><input aria-label={f.label} value={f.value} placeholder={f.placeholder} onChange={(e) => f.onChange?.(e.target.value)} /></label>
                  ) : f.value}
                  {f.hint && <span className="rv-row__meta">{f.hint}</span>}
                </div>
                {!live && <span className="rv-row__end"><Ico n="chevron" /></span>}
              </div>
            ))}
            {platformToggles.map((t) => (
              <div className="rv-row" key={t.label}>
                <Ico n={t.icon} />
                <div className="rv-row__text">{t.label}</div>
                <Toggle t={t} />
              </div>
            ))}
          </div>
        </MCard>
      </div>
      {modal}
    </>
  );
}

export function MasterConfig(props: ConfigProps = {}) {
  return <MasterFrame current="configuracoes"><MasterConfigView {...props} /></MasterFrame>;
}

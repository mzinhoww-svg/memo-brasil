/* Master-saude.html (M11): markup e classes da referência via master-kit; dados por props (padrão = desenho). */
import { Fragment, type ReactNode } from "react";
import { Gauge, GroupRow, MCard, MHead, MasterFrame, St, type IconName, type Tone } from "../master-kit";

export interface ServicoRow { key: string; icon: IconName; title: string; meta: string; tone: Tone; label: string }
export interface SaudeProps {
  caption?: string;
  services?: ServicoRow[];
  gauges?: { label: string; value: string; pct: number; caption: string }[];
  alerts?: ReactNode;
}

const REF_SERVICES: ServicoRow[] = [
  { key: "db", icon: "server", title: "Banco de dados", meta: "latência 38 ms", tone: "ok", label: "Normal" },
  { key: "storage", icon: "photo", title: "Storage de fotos", meta: "upload médio 1,8 s", tone: "ok", label: "Normal" },
  { key: "webhook", icon: "coin", title: "Webhook ValidaPay", meta: "último evento há 4 min", tone: "ok", label: "Normal" },
  { key: "reveal", icon: "spark", title: "Fila de revelação", meta: "próxima às 12:00", tone: "ok", label: "Normal" },
  { key: "email", icon: "mail", title: "E-mail (Brevo)", meta: "4 falhas na última hora", tone: "wait", label: "Atenção" },
];
const REF_GAUGES = [
  { label: "Fotos", value: "412 de 1000", pct: 41, caption: "412 GB de 1 TB · 97 mil fotos" },
  { label: "Fila de exclusão", value: "3 de 100", pct: 3, caption: "3 eventos aguardando limpeza do storage" },
];

export function MasterSaudeView({ caption = "Situação dos serviços agora", services = REF_SERVICES, gauges = REF_GAUGES, alerts }: SaudeProps = {}) {
  return (
    <>
      <MHead title="Storage e saúde" caption={caption} />
      {alerts}
      <div className="mgrid2">
        <MCard>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Serviços</h2>
          <div className="rv-group" style={{ marginTop: "14px" }}>
            {services.map((s) => <GroupRow key={s.key} icon={s.icon} title={s.title} meta={s.meta} end={<St tone={s.tone}>{s.label}</St>} />)}
          </div>
        </MCard>
        <MCard>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Armazenamento</h2>
          <div className="stack" style={{ marginTop: "16px" }}>
            {gauges.map((g) => (
              <Fragment key={g.label}>
                <Gauge label={g.label} value={g.value} pct={g.pct} />
                <p className="rv-caption">{g.caption}</p>
              </Fragment>
            ))}
          </div>
        </MCard>
      </div>
    </>
  );
}

export function MasterSaude(props: SaudeProps = {}) {
  return <MasterFrame current="saude"><MasterSaudeView {...props} /></MasterFrame>;
}


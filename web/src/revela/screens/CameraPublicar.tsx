"use client";
/* Camera-publicar.html (passo 8): mesmo markup e classes da referência; planos do catálogo por props (padrão = desenho). */
import Link from "next/link";
import { Cam3D } from "@/components/revela/Cam3D";
import { PackSwitch, type PackSwitchProps } from "../PackSwitch";
import { PlanCards } from "../PlanCards";
import { WizardSheet } from "../WizardSheet";

export interface PlanView { code: string; tier: string; price: string; lines: [string, string]; gold?: boolean }
export const PLANS_REF: PlanView[] = [
  { code: "gratis", tier: "Grátis", price: "Grátis", lines: ["10 convidados", "10 poses cada"] },
  { code: "festa", tier: "Festa", price: "R$ 29", lines: ["30 convidados", "24 poses cada"] },
  { code: "celebracao", tier: "Celebração", price: "R$ 89", lines: ["100 convidados", "24 poses cada"] },
  { code: "casamento", tier: "Casamento", price: "R$ 189", lines: ["250 convidados", "36 poses cada"] },
  { code: "grande", tier: "Grande", price: "R$ 349", lines: ["500 convidados", "poses livres"], gold: true },
];

export interface CameraPublicarProps {
  image?: string; wrapLabel?: string; posesLabel?: string; revealLabel?: string;
  plans?: PlanView[]; selected?: string; payNote?: string; next?: string; busy?: boolean; error?: string;
  /** Interruptor "Mais poses" sob os cartões (só nos planos que têm pacote). */
  pack?: PackSwitchProps;
  /** Aviso de aceite junto ao botão: tocar em continuar vale como aceite dos Termos e da Política. */
  legal?: { termsHref: string; privacyHref: string };
  onSelect?: (code: string) => void; onBack?: () => void; onNext?: () => void;
}

export function CameraPublicar({
  image = "/revela/ref/cam-casamento.webp", wrapLabel = "Casamento", posesLabel = "27 por pessoa", revealLabel = "dom, 12:00",
  plans = PLANS_REF, selected = "casamento", payNote = "Pix ou cartão, sem sair do app", next = "Continuar · R$ 189", busy, error, pack, legal, onSelect, onBack, onNext,
}: CameraPublicarProps = {}) {
  return (
    <WizardSheet step={8} title="Escolha o plano" caption="Pague uma vez por evento. Sem assinatura." onBack={onBack} onNext={onNext} next={next} busy={busy}
      foot={legal && (
      <p className="rv-caption center" data-testid="aviso-aceite" style={{ margin: "0" }}>
        {"Ao continuar, você aceita os "}
        <Link href={legal.termsHref} className="link" target="_blank">Termos de Uso</Link>
        {" e a "}
        <Link href={legal.privacyHref} className="link" target="_blank">Política de Privacidade</Link>
        .
      </p>
    )}>
      <div className="rv-stagebox" style={{ marginTop: "-6px" }}>
        <Cam3D src={image} alt="Câmera do evento" width={260} />
      </div>
      <div className="summary">
        <div><span className="rv-caption">Embalagem</span><b>{wrapLabel}</b></div>
        <div><span className="rv-caption">Poses</span><b>{posesLabel}</b></div>
        <div><span className="rv-caption">Revela</span><b>{revealLabel}</b></div>
      </div>
      <PlanCards plans={plans} selected={selected} onSelect={onSelect} />
      {pack && <PackSwitch {...pack} />}
      {error && <p className="rv-caption center" role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="paynote">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.5l3.6 3.6-3.6 3.6-3.6-3.6zM12 14.3l3.6 3.6-3.6 3.6-3.6-3.6zM2.5 12l3.6-3.6 3.6 3.6-3.6 3.6zM14.3 12l3.6-3.6 3.6 3.6-3.6 3.6z" />
        </svg>
        <span>{payNote}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <span>ValidaPay</span>
      </div>
    </WizardSheet>
  );
}

"use client";

/**
 * Página da oferta do funil (`/oferta?l=<lead>`): devolve o resultado do quiz, mostra a câmera travada e a oferta com o tempo que
 * resta de verdade (o prazo e o relógio vêm do servidor). Quem chega sem lead (link direto, por exemplo de uma mensagem do
 * Instagram) ganha um lead na hora e os mesmos 30 minutos. Vencida, a página leva ao catálogo normal.
 */
import { useEffect, useState } from "react";
import { FunilButton } from "./FunilButton";
import { ScreenSkeleton } from "@/components/revela/ScreenSkeleton";
import { validapayCheckoutEnabled } from "@/features/billing/checkout-provider";
import { brl, createLead, formatRemaining, isLeadId, readLead, rememberLead, viewLead, type LeadView } from "./api";
import { PHOTOS_PER_GUEST, PROFILES, type ProfileId } from "./quizzes";
import { useCountdown } from "./useCountdown";

export const DIRECT_QUIZ = "direto";
const LOCKED = ["Câmera do casamento com o nome de vocês", "QR Code pronto para imprimir e pôr nas mesas", "Revelação de todas as fotos na hora marcada"];

type State = { kind: "carregando" } | { kind: "erro" } | { kind: "pronto"; lead: LeadView };

export type OfertaProps = { leadParam: string | null; view?: typeof viewLead; create?: typeof createLead };

export function Oferta({ leadParam, view = viewLead, create = createLead }: OfertaProps) {
  const [state, setState] = useState<State>({ kind: "carregando" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    async function load() {
      try {
        let id = isLeadId(leadParam) ? leadParam : readLead();
        let lead = id ? await view(id) : null;
        if (!lead) { // sem lead conhecido: entrada direta pelo link
          id = (await create({ quiz: DIRECT_QUIZ, profile: null, guests: null, whatsapp: false })).leadId;
          lead = await view(id);
        }
        if (!live) return;
        if (!lead || !id) return setState({ kind: "erro" });
        rememberLead(id);
        setState({ kind: "pronto", lead });
      } catch {
        if (live) setState({ kind: "erro" });
      }
    }
    void load();
    return () => { live = false; };
  }, [leadParam, view, create, attempt]);

  const lead = state.kind === "pronto" ? state.lead : null;
  const left = useCountdown(lead ? lead.expiresAtMs : null, lead?.clockOffsetMs ?? 0);

  if (state.kind === "carregando") return <ScreenSkeleton variant="camera" label="Abrindo o seu resultado…" />;
  if (state.kind === "erro" || !lead) {
    return (
      <div className="app-screen funil">
        <div className="app-stack">
          <h1 className="titulo-tela app-h1">Não deu para abrir a oferta agora.</h1>
          <p className="app-p app-muted">Confira sua conexão e tente de novo. Se preferir, você pode montar a câmera pelo caminho normal.</p>
        </div>
        <FunilButton onClick={() => { setState({ kind: "carregando" }); setAttempt((n) => n + 1); }}>Tentar de novo</FunilButton>
        <FunilButton kind="line" href="/criar">Montar a câmera</FunilButton>
      </div>
    );
  }

  const profile = lead.profile && lead.profile in PROFILES ? PROFILES[lead.profile as ProfileId] : null;
  const lost = lead.guests ? lead.guests * PHOTOS_PER_GUEST : null;
  const price = brl(lead.priceCents);
  const open = lead.active && left > 0 && !lead.paid;
  const bigger = lead.guests !== null && lead.guests > lead.maxGuests;
  const checkoutHref = lead.eventId
    ? (validapayCheckoutEnabled() ? `/painel/${lead.eventId}/checkout-validapay?plano=${encodeURIComponent(lead.planCode)}` : `/painel/${lead.eventId}`)
    : null;

  return (
    <div className="app-screen funil" data-testid="funil-oferta">
      <div className="app-stack">
        <p className="funil-etapa">Seu resultado</p>
        <h1 className="titulo-tela app-h1">{profile ? `Seu perfil: ${profile.name}` : "As melhores fotos do seu casamento estão no celular dos convidados."}</h1>
        {lost !== null && (
          <p className="app-p">
            Numa festa de {lead.guests} convidados, cerca de <strong>{lost.toLocaleString("pt-BR")} fotos</strong> ficam espalhadas em {lead.guests} celulares.
            <span className="corpo-sm app-muted"> Estimativa: {PHOTOS_PER_GUEST} fotos por convidado.</span>
          </p>
        )}
        <p className="app-p app-muted">{profile ? profile.diagnosis : "Depois da festa quase ninguém manda, e o que chega pelo grupo vem em baixa qualidade."}</p>
        <p className="app-p">Com o Revela, cada convidado aponta o celular para o QR da mesa e fotografa, sem baixar aplicativo. As fotos ficam guardadas e se revelam juntas na hora que você escolher.</p>
      </div>

      <section className="app-card app-card--borda funil-plano" aria-labelledby="funil-plano-titulo">
        <h2 id="funil-plano-titulo" className="titulo-card app-h1">O seu plano{open ? ", travado" : ""}</h2>
        <ul className="funil-travas">
          {LOCKED.map((t) => <li key={t} className="funil-trava"><span aria-hidden="true">{lead.paid ? "✓" : "🔒"}</span> {t}</li>)}
          <li className="funil-trava"><span aria-hidden="true">{lead.paid ? "✓" : "🔒"}</span> Até {lead.maxGuests} convidados{lead.maxShots ? `, ${lead.maxShots} poses cada` : ""}</li>
        </ul>
      </section>

      {lead.paid ? (
        <div className="app-stack">
          <p className="app-p"><strong>Tudo certo.</strong> A sua câmera para até {lead.maxGuests} convidados está liberada.</p>
          {lead.eventId && <FunilButton href={`/painel/${lead.eventId}/qr`}>Ver o QR do evento</FunilButton>}
        </div>
      ) : open ? (
        <div className="app-stack">
          <p className="app-p">
            Destrave tudo por <strong>{price}</strong> no Pix, pagamento único.
            {bigger && ` Sua festa passa de ${lead.maxGuests}? Comece com ${lead.maxGuests} e aumente depois pagando só a diferença.`}
          </p>
          <p className="funil-relogio" role="timer" aria-label="Tempo que resta da oferta" data-testid="funil-relogio">
            A oferta acaba em <strong>{formatRemaining(left)}</strong>
          </p>
          <FunilButton href={checkoutHref ?? `/criar?plano=${encodeURIComponent(lead.planCode)}`}>
            {checkoutHref ? `Pagar ${price} no Pix` : `Destravar por ${price} no Pix`}
          </FunilButton>
          <p className="corpo-sm app-muted">{checkoutHref ? "O seu evento já está criado. Falta só o Pix." : "Você monta a câmera em 1 minuto e paga no Pix em seguida. Sem assinatura."}</p>
        </div>
      ) : (
        <div className="app-stack" data-testid="funil-vencida">
          <p className="app-p"><strong>A oferta de {price} acabou.</strong> Você ainda pode montar a câmera: é grátis até 10 convidados, e os planos maiores ficam na página de preços.</p>
          <FunilButton href="/criar">Montar a câmera grátis</FunilButton>
          <FunilButton kind="line" href="/precos">Ver os preços</FunilButton>
        </div>
      )}
    </div>
  );
}

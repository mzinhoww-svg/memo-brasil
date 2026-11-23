"use client";

/**
 * Motor único dos quizzes do funil. Uma pergunta por tela, as respostas ficam só neste navegador; ao fim nasce o lead (sem dado
 * pessoal) e a pessoa escolhe receber o resultado pelo WhatsApp (o bot responde com o texto da oferta) ou ver na hora.
 */
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FunilButton } from "./FunilButton";
import { createLead, FunnelError, type LeadCreated } from "./api";
import { scoreQuiz, type Answers, type Quiz as QuizData } from "./quizzes";

const ERROR_TEXT: Record<FunnelError["kind"], string> = {
  muitas: "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.",
  rede: "Não deu para calcular o resultado. Confira sua conexão e tente de novo.",
};

export type QuizProps = { quiz: QuizData; create?: typeof createLead };

export function Quiz({ quiz, create = createLead }: QuizProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [lead, setLead] = useState<LeadCreated | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const finishing = useRef(false);
  const total = quiz.questions.length;
  const q = quiz.questions[Math.min(step, total - 1)];
  const picked = answers[q.id] ?? [];
  const offerHref = (id: string) => `/oferta?l=${encodeURIComponent(id)}`;

  async function finish(final: Answers) {
    if (finishing.current) return;
    finishing.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const r = scoreQuiz(quiz, final);
      const created = await create({ quiz: quiz.slug, profile: r.profile, guests: r.guests, whatsapp: true });
      if (!created.waLink) return router.push(offerHref(created.leadId)); // WhatsApp indisponível: o resultado abre direto
      setLead(created);
    } catch (e) {
      setError(ERROR_TEXT[e instanceof FunnelError ? e.kind : "rede"]);
    } finally {
      finishing.current = false;
      setBusy(false);
    }
  }

  function advance(next: Answers) {
    if (step + 1 < total) setStep(step + 1);
    else { setStep(total); void finish(next); }
  }

  function pick(optionId: string) {
    if (busy) return;
    if (q.multi) {
      setAnswers((a) => ({ ...a, [q.id]: picked.includes(optionId) ? picked.filter((x) => x !== optionId) : [...picked, optionId] }));
      return;
    }
    const next = { ...answers, [q.id]: [optionId] };
    setAnswers(next);
    advance(next);
  }

  // ---- contato: "Pra onde eu mando o seu resultado?"
  if (lead?.waLink) {
    return (
      <div className="app-screen funil" data-testid="funil-contato">
        <div className="app-stack">
          <p className="funil-etapa">Resultado pronto</p>
          <h1 className="titulo-tela app-h1">Para onde eu mando o seu resultado?</h1>
          <p className="app-p app-muted">Toque no botão e envie a mensagem que já vem escrita. O resultado chega na hora, com uma oferta que vale por 30 minutos.</p>
        </div>
        <div className="app-stack">
          <a className="rv-btn rv-btn--block rv-btn--primary" href={lead.waLink} target="_blank" rel="noopener noreferrer" onClick={() => setSent(true)} data-testid="funil-whatsapp">
            <span>Receber no WhatsApp</span>
          </a>
          {sent && <FunilButton kind="line" href={offerHref(lead.leadId)}>Já enviei, ver meu resultado</FunilButton>}
          <FunilButton kind="text" href={offerHref(lead.leadId)}>Ver o resultado aqui mesmo</FunilButton>
        </div>
        <p className="corpo-sm app-muted">Você recebe só o resultado. Para parar, responda SAIR a qualquer hora.</p>
      </div>
    );
  }

  // ---- calculando (ou erro ao criar o lead)
  if (step >= total) {
    return (
      <div className="app-screen funil" data-testid="funil-calculando">
        <div className="app-stack">
          <h1 className="titulo-tela app-h1">{error ? "Quase lá." : "Calculando o seu resultado…"}</h1>
          {error && <p className="rv-field-erro" role="alert">{error}</p>}
        </div>
        {error && <FunilButton disabled={busy} onClick={() => void finish(answers)}>Tentar de novo</FunilButton>}
      </div>
    );
  }

  return (
    <div className="app-screen funil" data-testid="funil-pergunta">
      <div className="app-stack">
        <div className="funil-barra" role="progressbar" aria-label="Andamento do teste" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step}>
          <div className="funil-barra-fill" style={{ width: `${Math.round((step / total) * 100)}%` }} />
        </div>
        <p className="funil-etapa">Pergunta {step + 1} de {total}</p>
        {step === 0 && <p className="app-p funil-chamada">{quiz.headline}</p>}
        <h1 className="titulo-tela app-h1">{q.text}</h1>
        {step === 0 ? <p className="app-p app-muted">{quiz.lead}</p> : q.hint && <p className="app-p app-muted">{q.hint}</p>}
      </div>
      <div className="rv-opts rv-opts--lista" role="group" aria-label={q.text}>
        {q.options.map((o) => (
          <button key={o.id} type="button" className="rv-opt funil-opt" aria-pressed={picked.includes(o.id)} onClick={() => pick(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
      {q.multi && <FunilButton onClick={() => advance(answers)}>{picked.length ? `Continuar com ${picked.length} ${picked.length === 1 ? "sinal" : "sinais"}` : "Nenhum vale para mim"}</FunilButton>}
      {step > 0 && <FunilButton kind="text" onClick={() => setStep(step - 1)}>Voltar</FunilButton>}
    </div>
  );
}

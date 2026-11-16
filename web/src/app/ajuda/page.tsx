"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getPublicSettings } from "@/features/billing/api";
import { publicPaymentMethod } from "@/features/marketing/payment-copy";
import { CONTACT_EMAIL } from "@/lib/contact";
import { ApoioAjuda, type FaqView } from "@/revela/screens/ApoioAjuda";

const faqs = (): FaqView[] => [
  { id: "app", q: "Os convidados precisam baixar app?", a: "Não. Eles apontam a câmera do celular para o QR e a câmera do evento abre no navegador." },
  { id: "fotos", q: "Quando as fotos aparecem?", a: "Na revelação que o organizador programou: na hora, ao terminar o evento ou em data e horário escolhidos. Até lá as fotos, inclusive as próprias, ficam guardadas. Depois, a visibilidade depende das regras do evento. A revelação controla a exibição pelo serviço, mas não impede quem já recebeu acesso de fazer capturas ou compartilhar uma cópia." },
  { id: "plano", q: "Posso trocar de plano depois?", a: "Pode. No painel do evento, em Plano, você escolhe um plano maior e paga só a diferença do plano atual. O evento nasce grátis, até 10 convidados, e o pagamento é único por evento, sem assinatura." },
  { id: "apagar", q: "Como apago uma foto?", a: "O organizador pode ocultar qualquer foto do evento na revisão do painel. Para apagar os seus dados e as suas fotos, abra Você no evento e escolha Apagar meus dados. As fotos ficam disponíveis por 90 dias após o encerramento; depois o acesso é encerrado e a exclusão ocorre em até 30 dias." },
  { id: "pagamento", q: "O pagamento é seguro?", a: `O pagamento é feito ${publicPaymentMethod()}, e os dados do cartão não passam pelo Revela. O plano libera assim que o pagamento for confirmado. Não usamos as fotos em publicidade nem para treinar modelos de inteligência artificial sem autorização específica e separada.` },
];

/** 32 · Ajuda: busca e perguntas abrem no lugar; o suporte é o e-mail público de `get_public_settings()`. */
export default function Ajuda() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>("app");
  const [mail, setMail] = useState(CONTACT_EMAIL);
  useEffect(() => {
    let alive = true;
    void getPublicSettings().then((s) => { if (alive && s.supportEmail) setMail(s.supportEmail); }, () => undefined);
    return () => { alive = false; };
  }, []);
  const all = useMemo(() => faqs(), []);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(q)) : all;
  }, [all, query]);
  return (
    <main>
      <ApoioAjuda faqs={shown} openId={openId} query={query} supportHref={`mailto:${mail}`}
        onBack={() => router.back()} onQuery={setQuery} onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))} />
    </main>
  );
}

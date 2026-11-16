"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { leaveByToken, resubscribeByToken, type OptOutOutcome } from "@/features/participants/email-opt-out";
import { FeedEmailSair } from "@/revela/screens/FeedEmailSair";

type View = OptOutOutcome | { state: "loading" } | { state: "back"; title: string; code: string; email: string };

/** 24j · Sair dos avisos por e-mail: página pública do link do e-mail (`/email/sair?t=<token>`). Sair é imediato; dá para voltar. */
function Sair() {
  const token = useSearchParams().get("t");
  const [view, setView] = useState<View>({ state: "loading" });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = useCallback(async () => {
    setView({ state: "loading" });
    setView(await leaveByToken(token));
  }, [token]);
  useEffect(() => {
    const t = setTimeout(() => void run(), 0);
    return () => clearTimeout(t);
  }, [run]);

  if (view.state === "loading") return <div className="scr" role="status" aria-label="Saindo da lista"><div className="safe" /></div>;
  if (view.state === "invalid") {
    return <FeedEmailSair heading={["Esse link não", "está valendo"]} message="Ele está incompleto ou não é mais válido. Para sair dos avisos, use o link do e-mail mais recente." feedHref="/" feedLabel="Ir para o início" />;
  }
  if (view.state === "unavailable") {
    return <FeedEmailSair heading={["Não deu para", "sair agora"]} message="Confira a conexão e tente de novo. O link do e-mail continua valendo." feedHref="/" feedLabel="Ir para o início" onResubscribe={() => void run()} resubscribeLabel="Tentar de novo" />;
  }
  if (view.state === "back") {
    return <FeedEmailSair heading={["Combinado,", "avisamos você"]} message={`${view.email} volta a receber o aviso de revelação de ${view.title}.`} feedHref={`/e/${view.code}`} />;
  }
  const { email, title, code } = view;
  return (
    <FeedEmailSair
      message={`${email ?? "Este e-mail"} não recebe mais avisos de ${title}. As fotos continuam no feed.${failed ? " Não deu para reativar agora. Tente de novo." : ""}`}
      feedHref={`/e/${code}`}
      onResubscribe={email && isToken(token) ? async () => {
        if (busy || !token) return;
        setBusy(true);
        setFailed(false);
        const ok = await resubscribeByToken(token, email);
        setBusy(false);
        if (ok) setView({ state: "back", title, code, email });
        else setFailed(true);
      } : undefined}
      busy={busy}
    />
  );
}
const isToken = (t: string | null): t is string => Boolean(t);

export default function EmailSair() {
  return <Suspense fallback={<div className="scr" role="status" aria-label="Saindo da lista"><div className="safe" /></div>}><Sair /></Suspense>;
}

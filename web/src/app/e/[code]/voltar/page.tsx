"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/revela";
import { normalizeShareCode } from "@/domain/share-code";
import { exchangeReturnToken, type ReturnExchange } from "@/features/whatsapp/api";
import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";
import { ConvidadoCarregando } from "@/revela/screens/ConvidadoCarregando";

type View = { kind: "loading" } | { kind: "problem"; status: Exclude<ReturnExchange["status"], "ok"> | "rede"; code: string; title?: string };

const TEXT: Record<Exclude<View, { kind: "loading" }>["status"], { h: string; p: string }> = {
  used: { h: "Este link de volta já foi usado.", p: "Por segurança, o link que o WhatsApp manda vale uma vez só. Seus avisos continuam ativados." },
  expired: { h: "Este link de volta expirou.", p: "Por segurança, ele vale por 2 horas. Seus avisos continuam ativados." },
  blocked: { h: "Não foi possível abrir o evento por este link.", p: "Seu acesso a este evento não está disponível agora." },
  invalid: { h: "Não reconhecemos este link.", p: "Ele pode ter sido copiado pela metade. Entre no evento pelo código." },
  rede: { h: "Sem conexão agora.", p: "Confira a internet e tente de novo. O link continua valendo se ainda não foi usado." },
};

/**
 * Volta do WhatsApp (/e/<código>/voltar?r=<token>): troca o token de uso único por uma sessão do mesmo convidado e abre "Você".
 * Funciona no navegador do WhatsApp e em qualquer navegador sem sessão. O token sai da barra de endereço na hora e nunca é registrado.
 * Token usado, vencido ou inválido: explica e oferece "Entrar no evento" pelo código, sem beco sem saída.
 */
export default function VoltarDoWhatsapp() {
  const params = useParams<{ code: string }>();
  const code = normalizeShareCode(params.code ?? "") ?? "";
  const [view, setView] = useState<View>({ kind: "loading" });
  const started = useRef(false);
  const token = useRef("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      token.current = new URLSearchParams(window.location.search).get("r") ?? "";
      window.history.replaceState(null, "", `/e/${code}/voltar`); // o token não fica no histórico nem é compartilhado por engano
    }
    const go = (dest: string) => window.location.replace(dest); // recarrega: o app inteiro passa a usar a sessão recebida
    if (!token.current || backendMode() !== "supabase") { go(`/e/${code}`); return; }
    void (async () => {
      try {
        const r = await exchangeReturnToken(token.current);
        const target = `/e/${r.code ?? code}/voce?wa=1`;
        if (r.status === "ok") {
          if (r.same) return go(target);
          if (!r.tokenHash) throw new Error("sem link");
          const { error } = await browserSupabase().auth.verifyOtp({ token_hash: r.tokenHash, type: "magiclink" });
          if (error) throw error;
          return go(target);
        }
        setView({ kind: "problem", status: r.status, code: r.code ?? code, title: r.title });
      } catch {
        setView({ kind: "problem", status: "rede", code });
      }
    })();
  }, [code, attempt]);

  if (view.kind === "loading") return <main role="status" aria-label="Voltando ao evento"><ConvidadoCarregando name={null} /></main>;
  const t = TEXT[view.status];
  return (
    <main className="app-col app-fluid">
      <div className="app-screen" data-testid="wa-voltar-problema">
        <h1 className="titulo-tela app-h1">{t.h}</h1>
        {view.title && <p className="app-p">{view.title}</p>}
        <p className="app-p app-muted">{t.p}</p>
        <Button block href={`/e/${view.code}`}>Entrar no evento</Button>
        {view.status === "rede" && <Button variant="texto" onClick={() => { setView({ kind: "loading" }); setAttempt((n) => n + 1); }}>Tentar de novo</Button>}
      </div>
    </main>
  );
}

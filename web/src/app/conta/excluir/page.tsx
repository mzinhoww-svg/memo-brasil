"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/features/app/provider";
import { loadMyEvents } from "@/features/app/my-events";
import { browserSupabase } from "@/lib/supabase/client";
import { ApoioExcluirConta } from "@/revela/screens/ApoioExcluirConta";

/**
 * 29 · Excluir conta. O pedido vai para `request_account_deletion` (LGPD): o servidor processa e anonimiza com retenção.
 * Não há exportação de dados no produto: "Baixar meus dados antes" leva às câmeras, de onde se baixa cada evento.
 */
export default function ExcluirConta() {
  const { repos, user, ready, now, backend, signOut } = useApp();
  const router = useRouter();
  const [count, setCount] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!ready || !user) return;
    let live = true;
    void loadMyEvents(repos, user.id, now()).then((m) => { if (live) setCount(m.active.length + m.ended.length); }, () => undefined);
    return () => { live = false; };
  }, [ready, repos, user, now]);

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      if (backend === "supabase") {
        const { error: e } = await browserSupabase().rpc("request_account_deletion");
        if (e) throw e;
      }
      await signOut();
      router.push("/");
    } catch {
      setError("Não deu para enviar o pedido agora. Tente de novo.");
      setBusy(false);
    }
  }

  const label = count === undefined ? "Seus eventos serão excluídos" : count === 0 ? "Nenhum evento seu será excluído" : `${count} ${count === 1 ? "evento será excluído" : "eventos serão excluídos"}`;
  return (
    <main>
      <ApoioExcluirConta eventsLabel={label} busy={busy} error={error}
        onBack={() => router.back()} onCancel={() => router.back()} onDownload={() => router.push("/eventos")} onDelete={() => void remove()} />
    </main>
  );
}

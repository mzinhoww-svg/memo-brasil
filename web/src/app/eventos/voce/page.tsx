"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Sheet } from "@/components/revela";
import { Voce } from "@/revela/screens/Voce";
import { useApp } from "@/features/app/provider";
import { usePrintedAlbumEnabled } from "@/features/print-orders/flag";

/** 27 · Você (anfitrião): conta, extras, ajuda e sair. Só aparecem as linhas que fazem algo. */
export default function VocePage() {
  const { user, signOut, signIn, backend } = useApp();
  const router = useRouter();
  const printed = usePrintedAlbumEnabled();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const name = user?.name?.trim() || "Você";
  const open = () => { setDraft(user?.name ?? ""); setError(undefined); setEditing(true); };
  async function save() {
    const clean = draft.trim();
    if (clean.length < 2 || clean.length > 80) return setError("Escreva um nome com 2 a 80 letras.");
    setBusy(true);
    setError(undefined);
    try { await signIn(clean); setEditing(false); } catch { setError("Não foi possível salvar. Tente de novo."); } finally { setBusy(false); }
  }
  return (
    <>
      <Voce
        hide={printed ? [] : ["Álbuns impressos"]}
        name={name} initial={name.slice(0, 1).toUpperCase()} email={user?.email} avatarUrl={user?.avatarUrl}
        caption={`Sua conta de anfitrião · versão ${(process.env.NEXT_PUBLIC_BUILD_ID ?? "dev").slice(0, 7)}`}
        actions={{
          "Nome e foto": open,
          "Álbuns impressos": () => router.push("/eventos/pedidos"),
          "Avisos de revelação": () => router.push("/eventos"),
          "Como funciona a revelação": () => router.push("/ajuda"),
          "Falar com a gente": () => router.push("/ajuda"),
          Privacidade: () => router.push("/privacidade"),
          Sair: () => { void signOut().then(() => router.push("/")); },
        }}
      />
      {editing && (
        <Sheet title="Nome e foto" onClose={() => !busy && setEditing(false)}>
          <form className="app-stack-sm" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
            <Field label="Seu nome" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={80} autoComplete="name" error={error} />
            {user?.email && <p className="rv-caption" style={{ overflowWrap: "anywhere" }}>Conta: {user.email}</p>}
            <p className="rv-caption">{backend === "supabase" ? "A foto vem da sua conta Google: para trocar, mude no perfil do Google." : "A foto mostra a inicial do seu nome."}</p>
            <Button type="submit" block disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
          </form>
        </Sheet>
      )}
    </>
  );
}

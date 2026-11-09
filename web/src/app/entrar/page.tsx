"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { SHARE_CODE_ALPHABET, extractShareCode } from "@/domain/share-code";
import { useApp } from "@/features/app/provider";
import { ConvidadoCodigo } from "@/revela/screens/ConvidadoCodigo";

/** Só letras e números do alfabeto do código (sem 0, O, 1, I, L), em maiúsculas, até 8; um link ou caminho colado vira o código. */
function clean(raw: string): string {
  const fromLink = extractShareCode(raw);
  if (fromLink) return fromLink;
  return [...raw.toUpperCase()].filter((c) => SHARE_CODE_ALPHABET.includes(c)).join("").slice(0, 8);
}

/** 20c · Código do convite e 20h · Código não confere. O endereço /entrar é o impresso no convite A5. */
function Codigo() {
  const router = useRouter();
  const search = useSearchParams();
  const { repos, now, ensureSession, backend, ready } = useApp();
  const [code, setCode] = useState(() => clean(search.get("erro") ?? ""));
  const [error, setError] = useState(() => Boolean(search.get("erro")));
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!ready || busy) return;
    const c = extractShareCode(code);
    if (!c) return setError(true);
    setBusy(true);
    try {
      if (backend === "supabase") await ensureSession();
      const preview = await repos.events.preview(c, now());
      if (!preview) { setError(true); return; }
      router.push(`/e/${c}`);
    } catch {
      // sem rede ou limite de tentativas: a tela do convite sabe explicar e tentar de novo
      router.push(`/e/${c}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <ConvidadoCodigo code={code} error={error} busy={busy} onChange={(raw) => { setError(false); setCode(clean(raw)); }} onSubmit={() => void submit()} onBack={() => router.back()} />
    </main>
  );
}

export default function Entrar() {
  return <Suspense fallback={null}><Codigo /></Suspense>;
}

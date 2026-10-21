"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Breadcrumbs, Button, Field, Signature } from "@/components/memoriesmt";
import { extractShareCode } from "@/domain/share-code";

export default function Entrar() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();

  function submit() {
    const code = extractShareCode(value);
    if (!code) return setError("Código não confere. Confira no card da mesa.");
    router.push(`/e/${code}`);
  }

  return (
    <main className="app-col app-col--card app-fluid">
      <div className="app-screen">
        <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Entrar na festa" }]} />
        <form className="app-stack" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
          <h1 className="titulo-tela app-h1">Entrar na festa</h1>
          <p className="corpo app-p app-muted">Digite o código do card da mesa ou cole o link do convite.</p>
          <Field label="Código da festa" code value={value} onChange={(e) => { setValue(e.target.value); setError(undefined); }} placeholder="Ex.: NFVARBQX" autoCapitalize="characters" autoComplete="off" spellCheck={false} error={error} help="São 8 letras e números." />
          <Button type="submit" block>Entrar na festa</Button>
        </form>
        <div style={{ marginTop: "auto" }}><Signature /></div>
      </div>
    </main>
  );
}

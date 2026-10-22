"use client";

import { Button, Icon } from "@/components/memoriesmt";
import { copyFor } from "@/features/app/copy";
import { backendMode } from "@/lib/supabase/env";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="app-col app-col--card app-fluid">
      <div className="app-screen">
        <Icon name="sem-sinal" label="Algo deu errado" size={28} />
        <h1 className="titulo-tela app-h1">Algo deu errado.</h1>
        <p className="corpo app-p app-muted">{copyFor(backendMode()).errorBody}</p>
        <Button block onClick={reset}>Tentar de novo</Button>
        <Button variant="texto" href="/">Voltar ao início</Button>
      </div>
    </main>
  );
}

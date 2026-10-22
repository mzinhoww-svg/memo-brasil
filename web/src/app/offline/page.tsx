import type { Metadata } from "next";
import { Button, Icon, Signature } from "@/components/memoriesmt";
import { copyFor } from "@/features/app/copy";
import { backendMode } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Sem sinal" };

export default function Offline() {
  return (
    <main className="app-col app-col--card app-fluid">
      <div className="app-screen">
        <Icon name="sem-sinal" label="Sem sinal" size={28} />
        <h1 className="titulo-tela app-h1">Sem sinal agora.</h1>
        <p className="corpo app-p">{copyFor(backendMode()).offlineBody}</p>
        <Button href="/" block>Tentar de novo</Button>
        <div style={{ marginTop: "auto" }}><Signature /></div>
      </div>
    </main>
  );
}

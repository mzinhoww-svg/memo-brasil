import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { devToolsEnabled } from "@/lib/dev-tools";
import { RAIL_BOOT_SCRIPT } from "@/revela/master-menu";
import { BtnLink, MCard, MHead, MTable, MasterFrame, St, Tiles } from "@/revela/master-kit";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Moldura do Master com links reais (o console de verdade exige Supabase): usada pelos e2e do menu recolhível e da gaveta. Só no build de desenvolvimento. */
export default function DevMasterMenu() {
  if (!devToolsEnabled() || process.env.VERCEL_ENV === "production") notFound();
  const rows = Array.from({ length: 6 }, (_, i) => ({
    key: String(i),
    cells: [`Evento de exemplo número ${i + 1}`, "Organizador Exemplo", "Casamento", "Festa", "28 / 30", "210", "seg 10:00", <St key="s" tone="ok">Rolando</St>],
  }));
  return (
    <>
    <script dangerouslySetInnerHTML={{ __html: RAIL_BOOT_SCRIPT }} />
    <MasterFrame links current="eventos" env="sandbox" user={{ name: "Marcos", role: "Administrador · master" }}>
      <MHead title="Eventos" caption="Moldura de teste do menu responsivo"><BtnLink href="#" icon="download">Exportar CSV</BtnLink></MHead>
      <Tiles items={[{ label: "Eventos", value: "263" }, { label: "Fotos", value: "12.480" }, { label: "Receita", value: "R$ 18.420,00" }, { label: "Pix abertos", value: "7" }]} />
      <MCard>
        <MTable cols="1.6fr 1.1fr 0.9fr 0.9fr 0.8fr 0.6fr 0.9fr 1fr" head={["Evento", "Organizador", "Categoria", "Plano", "Convidados", "Fotos", "Revela", "Situação"]} rows={rows} />
      </MCard>
    </MasterFrame>
    </>
  );
}

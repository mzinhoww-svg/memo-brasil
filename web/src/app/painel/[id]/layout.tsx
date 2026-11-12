import type { ReactNode } from "react";
import { PainelShell } from "./PainelShell";

// O painel é todo cliente (dados no navegador): a casca é igual para qualquer evento. Gerar sob demanda e guardar
// deixa o prefetch do <Link> trazer a página inteira, sem esperar a função a cada troca de seção.
export function generateStaticParams(): { id: string }[] {
  return [];
}
export const dynamicParams = true;

/** Painel do anfitrião: camada de servidor (estática) sobre a casca cliente. */
export default function PainelLayout({ children }: { children: ReactNode }) {
  return <PainelShell>{children}</PainelShell>;
}

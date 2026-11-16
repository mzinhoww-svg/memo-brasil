import type { ReactNode } from "react";

// Convite e área do convidado são todos cliente (dados no navegador): a casca é igual para qualquer código.
// Gerar sob demanda e guardar deixa o prefetch do <Link> trazer a página inteira, sem esperar a função a cada aba.
export function generateStaticParams(): { code: string }[] {
  return [];
}
export const dynamicParams = true;

export default function EventoLayout({ children }: { children: ReactNode }) {
  return children;
}

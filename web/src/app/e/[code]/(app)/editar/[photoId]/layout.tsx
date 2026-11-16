import type { ReactNode } from "react";

// Página toda cliente (dados no navegador): gera a casca sob demanda e guarda, para o prefetch trazer a página inteira.
export function generateStaticParams(): { photoId: string }[] {
  return [];
}
export const dynamicParams = true;

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

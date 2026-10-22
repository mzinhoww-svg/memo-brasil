/** Ferramentas de homologação (festa de exemplo, guia de componentes, troca de identidade). Só existem em build com NEXT_PUBLIC_MM_DEV_TOOLS=1 (E2E/desenvolvimento); o build público não as inclui. */
export const devToolsEnabled = (): boolean => process.env.NEXT_PUBLIC_MM_DEV_TOOLS === "1";

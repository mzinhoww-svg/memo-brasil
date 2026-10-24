/** Os 15 módulos do console em 4 grupos. `rota` vazia = Visão geral (dashboard). */
export const GROUPS = [
  { id: "operacao", rotulo: "Operação", modules: [
    { rota: "", rotulo: "Visão geral" },
    { rota: "eventos", rotulo: "Eventos" },
    { rota: "revelacoes", rotulo: "Revelações" },
    { rota: "saude", rotulo: "Saúde operacional" },
  ] },
  { id: "pessoas", rotulo: "Pessoas", modules: [
    { rota: "usuarios", rotulo: "Usuários" },
    { rota: "organizadores", rotulo: "Organizadores" },
    { rota: "participantes", rotulo: "Participantes e convites" },
    { rota: "lgpd", rotulo: "Solicitações LGPD" },
  ] },
  { id: "receita", rotulo: "Receita", modules: [
    { rota: "pagamentos", rotulo: "Pagamentos" },
    { rota: "planos", rotulo: "Planos e preços" },
    { rota: "codigos", rotulo: "Códigos de cortesia" },
  ] },
  { id: "plataforma", rotulo: "Plataforma", modules: [
    { rota: "analytics", rotulo: "Analytics" },
    { rota: "storage", rotulo: "Storage e fotos" },
    { rota: "auditoria", rotulo: "Auditoria" },
    { rota: "configuracoes", rotulo: "Configurações" },
  ] },
] as const;

export type ModuleGroup = (typeof GROUPS)[number];
export type ModuleItem = ModuleGroup["modules"][number];
export type ModuleRoute = ModuleItem["rota"];

/** Lista plana (mesma forma `{rota, rotulo}` de antes) para quem não precisa dos grupos. */
export const MODULES: readonly ModuleItem[] = GROUPS.flatMap((g) => g.modules as readonly ModuleItem[]);

export const moduleHref = (rota: ModuleRoute | string) => (rota ? `/master/${rota}` : "/master");

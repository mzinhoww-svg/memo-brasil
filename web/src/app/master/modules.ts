/** Os 14 módulos do console. `rota` vazia = dashboard. */
export const MODULES = [
  { rota: "", rotulo: "Visão geral" },
  { rota: "eventos", rotulo: "Eventos" },
  { rota: "usuarios", rotulo: "Usuários" },
  { rota: "organizadores", rotulo: "Organizadores" },
  { rota: "participantes", rotulo: "Convites e participantes" },
  { rota: "storage", rotulo: "Storage e fotos" },
  { rota: "revelacoes", rotulo: "Revelações" },
  { rota: "auditoria", rotulo: "Auditoria e segurança" },
  { rota: "pagamentos", rotulo: "Pagamentos" },
  { rota: "planos", rotulo: "Planos e preços" },
  { rota: "configuracoes", rotulo: "Configurações" },
  { rota: "analytics", rotulo: "Analytics" },
  { rota: "lgpd", rotulo: "Solicitações LGPD" },
  { rota: "saude", rotulo: "Saúde operacional" },
] as const;
export type ModuleRoute = (typeof MODULES)[number]["rota"];

/**
 * Catálogo das ferramentas do MCP somente leitura. Os nomes são exatamente a lista fechada de `mcp_read` no banco
 * (migration 20261121000100_mcp_leitura.sql); o teste garante que as duas listas não se separam.
 */
type Prop = { type: "string" | "integer" | "boolean"; description: string; format?: string; minimum?: number; maximum?: number };
export type McpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, Prop>; required?: string[]; additionalProperties: false };
  annotations: { readOnlyHint: true; destructiveHint: false; idempotentHint: true; openWorldHint: false };
};

const P = {
  limite: { type: "integer", minimum: 1, maximum: 200, description: "Quantos itens devolver (padrão 25, máximo 200)." },
  deslocamento: { type: "integer", minimum: 0, description: "Quantos itens pular, para paginar (padrão 0)." },
  texto: { type: "string", description: "Texto de busca (nome, e-mail, código do evento...)." },
  dias: { type: "integer", minimum: 1, maximum: 365, description: "Janela em dias (padrão 30)." },
  incluir_testes: { type: "boolean", description: "Incluir eventos de teste (padrão: não)." },
  evento_id: { type: "string", format: "uuid", description: "ID (uuid) do evento." },
} satisfies Record<string, Prop>;

const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const tool = (name: string, title: string, description: string, properties: Record<string, Prop> = {}, required?: string[]): McpTool =>
  ({ name, title, description, inputSchema: { type: "object", properties, ...(required ? { required } : {}), additionalProperties: false }, annotations: RO });
const page = { limite: P.limite, deslocamento: P.deslocamento };

export const MCP_TOOLS: McpTool[] = [
  tool("visao_geral", "Visão geral", "Painel principal do Master: eventos, convidados, fotos, receita e tendências no período.", { dias: P.dias, incluir_testes: P.incluir_testes }),
  tool("metricas", "Métricas do período", "Métricas detalhadas entre duas datas (padrão: últimos 30 dias, fuso America/Cuiaba).", {
    de: { type: "string", format: "date-time", description: "Início (ISO 8601)." }, ate: { type: "string", format: "date-time", description: "Fim (ISO 8601)." },
    fuso: { type: "string", description: "Fuso IANA (padrão America/Cuiaba)." }, incluir_testes: P.incluir_testes,
  }),
  tool("acessos", "Acessos ao site", "Estatísticas de acesso sem cookies: visitas, pessoas distintas por dia, origem, páginas, aparelhos e países.", { dias: P.dias }),
  tool("eventos", "Quadro de eventos", "Eventos com status, plano, convidados e fotos; filtra e busca.", { filtro: { type: "string", description: "Filtro do quadro (ex.: ativos, encerrados, pagos)." }, texto: P.texto, ...page }),
  tool("evento_detalhe", "Detalhe do evento", "Tudo sobre um evento: anfitrião, plano, pagamentos, convidados, fotos e linha do tempo.", { evento_id: P.evento_id }, ["evento_id"]),
  tool("eventos_lista", "Lista de eventos", "Lista simples de eventos, com busca e status.", { texto: P.texto, status: { type: "string", description: "Status do evento." }, incluir_apagados: { type: "boolean", description: "Incluir eventos apagados." }, ...page }),
  tool("pessoas_contagens", "Pessoas: totais", "Totais de organizadores, convidados, convites e equipe."),
  tool("organizadores", "Organizadores", "Organizadores (anfitriões) com eventos, fotos, último evento e gasto.", { texto: P.texto, ...page }),
  tool("usuarios", "Usuários", "Contas cadastradas.", page),
  tool("buscar_usuarios", "Buscar usuários", "Busca contas por nome ou e-mail.", { texto: P.texto, ...page }),
  tool("participantes", "Participantes", "Convidados que entraram em eventos (de um evento, se informado).", { evento_id: P.evento_id, ...page }),
  tool("buscar_participantes", "Buscar participantes", "Busca convidados por nome, com filtro de situação.", { texto: P.texto, situacao: { type: "string", description: "Situação do convidado." }, ...page }),
  tool("convites", "Convites", "Convites emitidos (de um evento, se informado).", { evento_id: P.evento_id, ...page }),
  tool("equipe", "Equipe", "Pessoas com papel de plataforma (master, suporte, auditor)."),
  tool("pagamentos", "Pagamentos", "Pedidos de pagamento, com filtro de status.", { status: { type: "string", description: "Status do pedido (pago, pendente, expirado...)." }, limite: P.limite }),
  tool("pagamentos_resumo", "Pagamentos: resumo", "Totais de pagamentos por status e receita."),
  tool("pagamentos_divergencias", "Pagamentos: divergências", "Pedidos com divergência entre o app e o provedor de pagamento."),
  tool("moderacao_fila", "Moderação", "Fila de fotos denunciadas aguardando decisão."),
  tool("revelacoes", "Revelações: quadro", "Próximas revelações e as recentes.", { limite: P.limite }),
  tool("revelacoes_lista", "Revelações: lista", "Lista de revelações com busca.", { texto: P.texto, ...page }),
  tool("saude", "Saúde", "Saúde da plataforma: filas, jobs, e-mails e erros recentes."),
  tool("saude_historico", "Saúde: histórico", "Histórico das verificações de saúde.", { limite: P.limite }),
  tool("armazenamento", "Armazenamento", "Uso de armazenamento por tipo de arquivo."),
  tool("auditoria", "Auditoria", "Trilha de auditoria (ações sensíveis), com filtro por ação.", { acao: { type: "string", description: "Ação (ex.: platform_role.granted)." }, ...page }),
  tool("auditoria_eventos", "Auditoria: eventos", "Eventos recentes da auditoria.", { limite: P.limite }),
  tool("lgpd", "LGPD", "Pedidos de exclusão e exportação de dados (LGPD).", page),
  tool("impressoes", "Impressões", "Pedidos de álbum impresso.", { filtro: { type: "string", description: "Filtro (status)." }, texto: P.texto, ...page }),
  tool("impressao_detalhe", "Detalhe da impressão", "Detalhe de um pedido de impressão.", { pedido_id: { type: "string", format: "uuid", description: "ID (uuid) do pedido." } }, ["pedido_id"]),
  tool("planos", "Planos", "Catálogo de planos com preços, limites e se estão à venda."),
  tool("configuracoes", "Configurações", "Configurações da plataforma e flags."),
  tool("buscar", "Busca geral", "Busca em eventos, pessoas e pedidos.", { texto: { ...P.texto, description: "O que buscar." } }, ["texto"]),
  tool("conversao_semanal", "Conversão semanal", "Por semana de criação do evento: anfitriões com avisos no WhatsApp, ativação (evento com convidado), eventos no limite do grátis, ofertas de desconto (criadas, abertas, pagas), eventos pagos e pedidos expirados. Sem equipe e sem testes.", { semanas: { type: "integer", minimum: 1, maximum: 52, description: "Quantas semanas (padrão 8)." } }),
  tool("conversao_origem", "Conversão por origem", "Eventos criados no período por origem de quem criou (primeira e última visita): quantos receberam convidado, quantos pagaram e a receita.", { dias: P.dias }),
];
export const MCP_TOOL_NAMES = new Set(MCP_TOOLS.map((t) => t.name));

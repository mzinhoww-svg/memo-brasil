/** O que cada papel de plataforma abre no console Master (M32). Fonte única da UI; o servidor é quem garante (pgTAP `32_master_roles`).
 *  A matriz mostrada na M32 vem daqui, não do desenho: as diferenças estão em docs/evidence/revela-fiel/master/DIVERGENCIAS.md. */
import type { PlatformRole } from "./access";
import type { AppNavId } from "@/revela/master-kit";

const ALL: readonly PlatformRole[] = ["master", "support", "auditor"];
const MASTER: readonly PlatformRole[] = ["master"];

/** Áreas do menu → papéis que abrem a área (as RPCs de cada área negam o resto com MM004). */
export const AREA_ROLES: Record<AppNavId, readonly PlatformRole[]> = {
  visao: ALL, eventos: ALL, pessoas: ALL,
  planos: MASTER, pagamentos: MASTER, cortesias: MASTER,
  revelacoes: ALL, moderacao: ALL,
  impressoes: MASTER,
  saude: ALL, lgpd: ALL,
  auditoria: ["master", "auditor"],
  configuracoes: MASTER,
};

export const canOpen = (role: PlatformRole | null, area: AppNavId): boolean => !!role && AREA_ROLES[area].includes(role);

/** Itens do menu que o papel enxerga; "Impressões" só com a chave `printed_album` ligada. */
export function visibleNav(role: PlatformRole | null, opts: { printedAlbum: boolean }): AppNavId[] {
  return (Object.keys(AREA_ROLES) as AppNavId[]).filter((a) => canOpen(role, a) && (a !== "impressoes" || opts.printedAlbum));
}

/** Rótulo curto do papel para o rodapé do menu (mesmo formato do desenho: "Administrador · master"). */
export const ROLE_LABEL: Record<PlatformRole, string> = { master: "Administrador · master", support: "Atendimento · support", auditor: "Auditoria · auditor" };

/** Quem pode abrir a área, em palavras (legenda da M32). */
export function whoCanOpen(area: AppNavId): string {
  const r = AREA_ROLES[area];
  return r.length === 1 ? "Esta área é só para master" : r.length === 2 ? "Esta área é só para master e auditor" : "Esta área é da equipe";
}

/** `read` só existe na matriz do desenho (Pagamentos em leitura); nenhum papel de equipe lê Pagamentos no banco. */
export type Cell = "yes" | "no" | "masked" | "read";
export interface MatrixRow { label: string; master: Cell; support: Cell; auditor: Cell }
/** Matriz REAL dos papéis (RPCs e policies). Difere do desenho em Pagamentos (support e auditor não leem) e Auditoria/Exportar (já alinhados no banco). */
export const ROLE_MATRIX: readonly MatrixRow[] = [
  { label: "Eventos, pessoas e convites", master: "yes", support: "yes", auditor: "yes" },
  { label: "E-mail e contato completos", master: "yes", support: "masked", auditor: "masked" },
  { label: "Pagamentos", master: "yes", support: "no", auditor: "no" },
  { label: "Auditoria", master: "yes", support: "no", auditor: "yes" },
  { label: "Exportar", master: "yes", support: "no", auditor: "yes" },
  { label: "Revelar agora, estornar, excluir", master: "yes", support: "no", auditor: "no" },
  { label: "Preços, cortesias e configurações", master: "yes", support: "no", auditor: "no" },
  { label: "Equipe e papéis", master: "yes", support: "no", auditor: "no" },
  { label: "Nota interna de impressão", master: "yes", support: "no", auditor: "no" },
];

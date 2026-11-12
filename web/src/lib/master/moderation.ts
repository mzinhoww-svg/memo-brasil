/** Moderação do Master (M26): rótulos, ações e formatos. A fila (RPC `admin_moderation_queue`) nunca traz URL de foto nem quem denunciou;
 *  aqui só se transforma o que o servidor devolveu (id da foto vira "foto 3f1a…", motivos agregados viram "2 Conteúdo impróprio"). */
import { REASON_LABEL, type ReasonCounts } from "@/features/moderation/report-reasons";

export interface QueuePhoto { photoId: string; eventId: string; eventTitle: string; reports: number; hidden: boolean; reasons?: ReasonCounts }
export interface QueueComment { id: string; eventId?: string; eventTitle: string; authorName: string | null; body: string | null; reports: number; hidden: boolean; hiddenBy: string | null; reasons?: ReasonCounts }
export interface QueueBlocked { eventId: string; eventTitle: string; name: string | null; blockedAt: string }
export interface ModerationQueue { photos: QueuePhoto[]; comments: QueueComment[]; blocked: QueueBlocked[] }

export type ModTab = "fotos" | "comentarios" | "bloqueados";
export const modTab = (aba: string | undefined): ModTab => (aba === "comentarios" || aba === "bloqueados" ? aba : "fotos");
export const MOD_HREF: Record<ModTab, string> = { fotos: "/master/moderacao?aba=fotos", comentarios: "/master/moderacao?aba=comentarios", bloqueados: "/master/moderacao?aba=bloqueados" };

/** "foto 3f1a…": só o começo do id (4 caracteres), como no desenho. */
export const shortPhotoId = (id: string): string => `foto ${id.replace(/-/g, "").slice(0, 4)}…`;

/** Uma etiqueta por motivo, a maior contagem primeiro: ["2 Conteúdo impróprio", "1 Outro motivo"]. Os rótulos das listas de denúncia usam o texto da tela
 *  de denúncia; na fila entram na forma curta do desenho. */
const SHORT: Record<string, string> = { nao_quero_aparecer: "Não quero aparecer", constrangedora: "Foto constrangedora", improprio: "Conteúdo impróprio", outro: "Outro motivo", ofensivo: "Ofensivo", spam: "Spam", sem_motivo: "Sem motivo informado" };
export function reasonChips(counts: ReasonCounts | undefined | null): string[] {
  return Object.entries(counts ?? {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, n]) => `${n} ${SHORT[k] ?? REASON_LABEL[k] ?? "Outro motivo"}`);
}

export type ModAction = "manter" | "esconder" | "excluir";
export type ModKind = "photo" | "comment";

/** Botões da linha: visível → Manter e Esconder; escondida → Manter e Excluir (como no desenho). */
export const rowActions = (hidden: boolean): ModAction[] => (hidden ? ["manter", "excluir"] : ["manter", "esconder"]);
export const ACTION_LABEL: Record<ModAction, string> = { manter: "Manter", esconder: "Esconder", excluir: "Excluir" };

/** Texto da folha de cada ação (a de esconder foto é a do desenho M26.f1; as demais seguem o mesmo molde). */
export function sheetText(kind: ModKind, action: ModAction, subject: string): { title: string; body: string; confirm: string; busy: string } {
  const foto = kind === "photo";
  const que = foto ? "esta foto" : "este comentário";
  if (action === "esconder") return { title: `Esconder ${que}?`, body: `${subject}. ${foto ? "Ela sai do feed para todos os convidados." : "Ele some do feed para todos os convidados."}`, confirm: foto ? "Esconder foto" : "Esconder comentário", busy: "Escondendo…" };
  if (action === "manter") return { title: `Manter ${que}?`, body: `${subject}. ${foto ? "As denúncias são arquivadas e ela volta a valer no feed." : "As denúncias são arquivadas e ele volta a valer no feed."}`, confirm: foto ? "Manter foto" : "Manter comentário", busy: "Mantendo…" };
  return { title: `Excluir ${que}?`, body: `${subject}. ${foto ? "O arquivo sai do feed e vai para a limpeza do storage. Não dá para desfazer." : "Ele some do feed e não volta. Não dá para desfazer."}`, confirm: foto ? "Excluir foto" : "Excluir comentário", busy: "Excluindo…" };
}

export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Chamada do servidor para a ação: foto → `admin_moderate_photo`; comentário → `moderate_comment` (mostrar, esconder, remover). */
export function moderationCall(kind: ModKind, id: string, action: ModAction, reason: string): { fn: string; args: Record<string, unknown> } {
  if (kind === "photo") return { fn: "admin_moderate_photo", args: { p_photo: id, p_action: action, p_reason: reason } };
  return { fn: "moderate_comment", args: { p_comment: id, p_action: action === "manter" ? "mostrar" : action === "esconder" ? "esconder" : "remover", p_reason: reason } };
}

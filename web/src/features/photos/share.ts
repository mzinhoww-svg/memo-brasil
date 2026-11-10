import type { MemoEvent } from "@/domain/event";
import { REACTION_LABEL, type Photo, type Reaction } from "@/domain/photo";
import type { Participant, Repositories, User } from "@/repositories";

/** Lista "Quem reagiu" com nomes dos participantes (anfitrião e usuário atual incluídos). */
export function reactorsOf(photo: Photo, reactions: Reaction[], participants: Participant[], me: User, host: { id: string; name: string }) {
  const nameOf = (id: string) => (id === me.id ? "Você" : id === host.id ? host.name : participants.find((p) => p.userId === id)?.name ?? "Convidado");
  return reactions.filter((r) => r.photoId === photo.id).map((r) => ({ name: nameOf(r.authorId), label: REACTION_LABEL[r.kind] }));
}

/** O anfitrião e o autor sempre baixam; os demais convidados só quando o anfitrião permitiu (events.guest_download_high). */
export function canDownloadOriginal(event: Pick<MemoEvent, "guestDownloadHigh">, viewer: { host: boolean; userId: string }, photo: Pick<Photo, "authorId">): boolean {
  return viewer.host || photo.authorId === viewer.userId || event.guestDownloadHigh !== false;
}

export const DOWNLOAD_DENIED_TEXT = "O anfitrião não permitiu baixar fotos de outras pessoas.";
export class DownloadNotAllowedError extends Error {
  constructor() { super("download-not-allowed"); this.name = "DownloadNotAllowedError"; }
}

/** Baixa o arquivo original guardado ("em alta"). Na nuvem o servidor decide antes (photo_download_allowed); recusado lança DownloadNotAllowedError. */
export async function downloadPhoto(repos: Repositories, photo: Photo): Promise<boolean> {
  if (repos.photos.downloadAllowed && !(await repos.photos.downloadAllowed(photo.id))) throw new DownloadNotAllowedError();
  const d = await repos.photos.getData(photo.id);
  if (!d) return false;
  const ext = d.type === "image/png" ? "png" : d.type === "image/svg+xml" ? "svg" : "jpg";
  const url = URL.createObjectURL(new Blob([d.bytes], { type: d.type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `revela-${photo.id.slice(0, 8)}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

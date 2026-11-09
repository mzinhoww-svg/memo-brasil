import { REACTION_LABEL, type Photo, type Reaction } from "@/domain/photo";
import type { Participant, Repositories, User } from "@/repositories";

/** Lista "Quem reagiu" com nomes dos participantes (anfitrião e usuário atual incluídos). */
export function reactorsOf(photo: Photo, reactions: Reaction[], participants: Participant[], me: User, host: { id: string; name: string }) {
  const nameOf = (id: string) => (id === me.id ? "Você" : id === host.id ? host.name : participants.find((p) => p.userId === id)?.name ?? "Convidado");
  return reactions.filter((r) => r.photoId === photo.id).map((r) => ({ name: nameOf(r.authorId), label: REACTION_LABEL[r.kind] }));
}

/** Baixa a foto original guardada neste aparelho. */
export async function downloadPhoto(repos: Repositories, photo: Photo): Promise<boolean> {
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

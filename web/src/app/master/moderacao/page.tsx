import { MState } from "@/revela/master-kit";
import { MasterModeracaoView } from "@/revela/screens/MasterModeracao";
import { requireMaster, rpc } from "../data";
import { relWhen } from "../format";
import { ModerateComment } from "./ModerateComment";

interface Queue {
  photos: { photoId: string; eventId: string; eventTitle: string; reports: number; hidden: boolean }[];
  comments: { id: string; eventTitle: string; authorName: string | null; body: string | null; reports: number; hidden: boolean; hiddenBy: string | null }[];
  blocked: { eventId: string; eventTitle: string; name: string | null; blockedAt: string }[];
}
const plural = (n: number) => `${n} ${n === 1 ? "denúncia" : "denúncias"}`;

/** M09 · Moderação: denúncias de todos os eventos. Fotos aparecem só como metadados (o console não exibe fotografias privadas). */
export default async function Moderacao({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const sb = await requireMaster();
  const aba = (await searchParams).aba;
  const tab = aba === "comentarios" || aba === "bloqueados" ? aba : "fotos";
  const r = await rpc<Queue>(sb, "admin_moderation_queue");
  if (r.state !== "ok") return <MState kind={r.state === "denied" ? "denied" : "error"} text={r.state === "error" ? `Não foi possível carregar: ${r.message}` : undefined} />;
  const q = r.data;
  return (
    <MasterModeracaoView
      tab={tab}
      tabs={[
        { label: `Fotos ${q.photos.length}`, href: "/master/moderacao", on: tab === "fotos" },
        { label: `Comentários ${q.comments.length}`, href: "/master/moderacao?aba=comentarios", on: tab === "comentarios" },
        { label: `Participantes bloqueados ${q.blocked.length}`, href: "/master/moderacao?aba=bloqueados", on: tab === "bloqueados" },
      ]}
      note={tab === "fotos" && q.photos.length ? <p className="rv-caption" style={{ margin: "0 0 14px" }}>As fotos denunciadas são resolvidas pelo anfitrião de cada evento. O console mostra só o evento e o número de denúncias; o acesso excepcional a uma foto exige justificativa e fica na auditoria.</p> : undefined}
      photos={q.photos.map((p) => ({ key: p.photoId, event: p.eventTitle, reports: plural(p.reports), reason: p.hidden ? "Já escondida" : `foto ${p.photoId.slice(0, 8)}` }))}
      comments={q.comments.map((c) => ({
        key: c.id, event: c.eventTitle, reports: plural(c.reports), author: c.authorName ?? "—", body: c.body ?? "",
        status: c.hidden ? `escondido${c.hiddenBy ? ` por ${c.hiddenBy}` : ""}` : undefined, actions: <ModerateComment id={c.id} hidden={c.hidden} />,
      }))}
      blocked={q.blocked.map((b) => ({ key: `${b.eventId}-${b.blockedAt}`, event: b.eventTitle, name: b.name ?? "—", when: relWhen(b.blockedAt) }))}
    />
  );
}

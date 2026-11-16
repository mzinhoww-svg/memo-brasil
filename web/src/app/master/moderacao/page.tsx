import { ExportSheetCustomButton } from "../ExportSheetCustomButton";
import { MasterModeracaoMotivosEstado, MasterModeracaoMotivosView, type ModTabCounts } from "@/revela/screens/MasterModeracaoMotivos";
import { MOD_HREF, modTab, plural, reasonChips, shortPhotoId, type ModerationQueue } from "@/lib/master/moderation";
import { relWhen } from "../format";
import { requireRole, rpc } from "../data";
import { ModerationActions } from "./ModerationActions";

/** M26 · Moderação com motivos: fotos (`?aba=fotos`), comentários (`?aba=comentarios`) e participantes bloqueados.
 *  O console não exibe fotografias: cada foto é só "foto 3f1a…", o evento, o total e os motivos agregados. Quem denunciou nunca aparece (o servidor não devolve).
 *  Master vê e age; support e auditor veem a fila (comentário e nome só para o master, no servidor); só master e auditor exportam. */
const TAB_NAME = { fotos: "Fotos", comentarios: "Comentários", bloqueados: "Participantes bloqueados" } as const;

export default async function Moderacao({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const gate = await requireRole("moderacao");
  if ("denied" in gate) return gate.denied;
  const { sb, role } = gate;
  const tab = modTab((await searchParams).aba);
  const canAct = role === "master";
  const r = await rpc<ModerationQueue>(sb, "admin_moderation_queue");
  const rowsOf = (t: typeof tab) => (r.state === "ok" ? (t === "fotos" ? r.data.photos : t === "comentarios" ? r.data.comments : r.data.blocked).length : null);
  const exportAction = role === "master" || role === "auditor"
    ? <ExportSheetCustomButton custom="moderacao" screen="moderacao" screenLabel="Moderação" period="Fila atual" rowsEstimate={rowsOf(tab)} filters={{ aba: tab }} filtersText={`Aba: ${TAB_NAME[tab]}`} />
    : null;
  if (r.state !== "ok") return <MasterModeracaoMotivosEstado variant={r.state === "denied" ? "denied" : "error"} tab={tab} counts={{}} hrefs={MOD_HREF} exportAction={null} />;
  const q = r.data;
  const counts: ModTabCounts = { fotos: q.photos.length, comentarios: q.comments.length, bloqueados: q.blocked.length };
  return (
    <MasterModeracaoMotivosView
      tab={tab} counts={counts} hrefs={MOD_HREF} exportAction={exportAction}
      fotos={q.photos.map((p) => {
        const id = shortPhotoId(p.photoId);
        return { key: p.photoId, id, event: p.eventTitle, reports: p.reports, chips: reasonChips(p.reasons), hidden: p.hidden,
          actions: canAct ? <ModerationActions kind="photo" id={p.photoId} hidden={p.hidden} subject={`${id} · ${p.eventTitle} · ${plural(p.reports, "denúncia", "denúncias")}`} /> : undefined };
      })}
      comentarios={q.comments.map((c) => ({
        key: c.id, text: c.body ? `“${c.body}”` : "—", event: c.eventTitle, reports: c.reports, chips: reasonChips(c.reasons), hidden: c.hidden,
        actions: canAct ? <ModerationActions kind="comment" id={c.id} hidden={c.hidden} subject={`${c.eventTitle} · ${plural(c.reports, "denúncia", "denúncias")}`} /> : undefined,
      }))}
      bloqueados={q.blocked.map((b) => ({ key: `${b.eventId}-${b.blockedAt}`, event: b.eventTitle, name: b.name ?? "—", when: relWhen(b.blockedAt) }))}
    />
  );
}

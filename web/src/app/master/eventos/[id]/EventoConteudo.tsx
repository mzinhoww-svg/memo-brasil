import { MasterState, MasterStatePage } from "@/revela/master";
import { MasterEventoDetalheView } from "@/revela/screens/MasterEventoDetalhe";
import { BtnLink, MHead } from "@/revela/master-kit";
import { printedAlbumOn } from "@/lib/master/server";
import { requireRole, rpc } from "../../data";
import { nf } from "../../format";
import { toDetalheProps, type EventDetail } from "./detail";
import { EventoAcoes } from "./EventoAcoes";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** M21 · detalhe do evento. Qualquer papel de equipe lê; as ações são do master. Evento que não existe (ou id inválido) mostra o vazio "Evento não encontrado". */
export async function EventoConteudo({ params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("eventos");
  if ("denied" in gate) return gate.denied;
  const { sb, role } = gate;
  const { id } = await params;
  const notFound = (
    <>
      <MHead title="Eventos" caption="—"><BtnLink href="/master/eventos" icon="back">Voltar</BtnLink></MHead>
      <MasterState variant="empty" title="Evento não encontrado" text="Ele pode ter sido excluído. Volte para a lista de eventos." />
    </>
  );
  if (!UUID.test(id)) return notFound;
  const r = await rpc<EventDetail>(sb, "admin_event_detail", { p_event: id });
  if (r.state === "denied") return <MasterStatePage area="Eventos" variant="denied" />;
  if (r.state === "error") return /invalid/.test(r.message) ? notFound : <MasterStatePage area="Eventos" variant="error" />;
  const d = r.data;
  const master = role === "master";
  const showPrints = master && (await printedAlbumOn(sb));
  const props = toDetalheProps(d, d.event.hostName, showPrints);
  const canReveal = d.event.revealEnabled && !d.event.revealedAt && !d.event.deletedAt;
  if (d.event.deletedAt) {
    return (
      <>
        <MHead title={d.event.title} caption={props.caption}><BtnLink href="/master/eventos" icon="back">Voltar</BtnLink></MHead>
        <MasterState variant="empty" title="Evento não encontrado" text="Ele pode ter sido excluído. Volte para a lista de eventos." />
      </>
    );
  }
  return (
    <MasterEventoDetalheView
      {...props}
      actions={<EventoAcoes eventId={d.event.id} title={d.event.title} isTest={d.event.isTest} photos={d.event.photos} master={master} canReveal={canReveal} plannedAt={props.reveal?.[0]?.value ?? ""} notices={`${nf(d.notices.subscribers)} ${d.notices.subscribers === 1 ? "e-mail" : "e-mails"}, de uma vez`} />}
    />
  );
}

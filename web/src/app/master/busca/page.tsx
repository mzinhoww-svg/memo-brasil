import { MCard, MHead, MState } from "@/revela/master-kit";
import { requireMaster, rpc } from "../data";

interface Found { events: { id: string; title: string }[]; users: { userId: string; email: string | null }[]; orders: { id: string; eventId: string | null; status: string }[] }

/** Busca da barra de cima: eventos, pessoas e pagamentos (admin_search; e-mail e pedidos só para o master). */
export default async function Busca({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sb = await requireMaster();
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const r = q.length >= 2 ? await rpc<Found>(sb, "admin_search", { p_q: q }) : null;
  return (
    <>
      <MHead title="Busca" caption={q ? `Resultados para "${q}"` : "Digite ao menos 2 caracteres na barra de cima."} />
      {r && r.state !== "ok" && <MState kind={r.state === "denied" ? "denied" : "error"} />}
      {r?.state === "ok" && (
        <div className="stack" style={{ gap: "16px" }}>
          <MCard>
            <h2 className="rv-title" style={{ fontSize: "18px" }}>Eventos</h2>
            <div className="stack" style={{ marginTop: "12px" }}>
              {r.data.events.length ? r.data.events.map((e) => <a key={e.id} className="link" href={`/master/eventos?q=${encodeURIComponent(e.title)}`}>{e.title}</a>) : <span className="rv-caption">Nenhum evento.</span>}
            </div>
          </MCard>
          <MCard>
            <h2 className="rv-title" style={{ fontSize: "18px" }}>Pessoas</h2>
            <div className="stack" style={{ marginTop: "12px" }}>
              {r.data.users.length ? r.data.users.map((u) => <span key={u.userId}>{u.email ?? `${u.userId.slice(0, 8)}…`}</span>) : <span className="rv-caption">Ninguém.</span>}
            </div>
          </MCard>
          <MCard>
            <h2 className="rv-title" style={{ fontSize: "18px" }}>Pagamentos</h2>
            <div className="stack" style={{ marginTop: "12px" }}>
              {r.data.orders.length ? r.data.orders.map((o) => <a key={o.id} className="link" href={`/master/pagamentos/${o.id}`}>#{o.id.slice(0, 8)} · {o.status}</a>) : <span className="rv-caption">Nenhum pedido.</span>}
            </div>
          </MCard>
        </div>
      )}
    </>
  );
}

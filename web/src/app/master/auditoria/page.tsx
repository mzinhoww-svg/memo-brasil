import { MState } from "@/revela/master-kit";
import { ExportButton } from "../ExportButton";
import { MasterAuditoriaView, type AuditoriaRow } from "@/revela/screens/MasterAuditoria";
import { requireRole, rpc } from "../data";
import { nf, relWhen } from "../format";

interface A { id: number; at: string; actorId: string | null; actorRole: string | null; action: string; targetType: string | null; targetId: string | null; reason: string | null }
const POR = 50;
const WHO: Record<string, string> = { master: "master", support: "suporte", organizador: "organizador", convidado: "convidado", system: "sistema", sistema: "sistema" };

/** M13 · Auditoria: registro só de inserção. Filtro por prefixo da ação (`?a=plan.`), 50 por página. */
export default async function Auditoria({ searchParams }: { searchParams: Promise<{ a?: string; p?: string }> }) {
  const gate = await requireRole("auditoria");
  if ("denied" in gate) return gate.denied;
  const { sb } = gate;
  const sp = await searchParams;
  const p = Math.max(1, Number(sp.p) || 1);
  const a = sp.a?.slice(0, 60) || "";
  const r = await rpc<{ total: number; items: A[] }>(sb, "admin_list_audit", { p_limit: POR, p_offset: (p - 1) * POR, p_action: a || null });
  if (r.state !== "ok") return <MState kind={r.state === "denied" ? "denied" : "error"} text={r.state === "error" ? `Não foi possível carregar: ${r.message}` : undefined} />;
  const href = (n: number) => `/master/auditoria?${new URLSearchParams({ ...(a ? { a } : {}), p: String(n) })}`;
  const rows: AuditoriaRow[] = r.data.items.map((x) => ({
    key: String(x.id), when: relWhen(x.at), who: x.actorRole ? WHO[x.actorRole] ?? x.actorRole : x.actorId ? `conta ${x.actorId.slice(0, 8)}…` : "sistema",
    action: x.action, target: x.targetType ? `${x.targetType}:${(x.targetId ?? "").slice(0, 8)}` : "—", detail: x.reason ?? "—",
  }));
  const last = Math.max(1, Math.ceil(r.data.total / POR));
  return (
    <MasterAuditoriaView
      caption={`Toda ação sensível, só inserção${a ? ` · ações que começam com "${a}"` : ""}`} rows={rows} exportAction={<ExportButton kind="auditoria" screen="auditoria" filters={{ a }} />}
      filter={(
        <form method="get" role="search" className="row" style={{ gap: "8px", marginBottom: "14px" }}>
          <label className="rv-field" style={{ maxWidth: "340px" }}>
            <input name="a" defaultValue={a} placeholder="Ação começa com… (ex.: plan.)" aria-label="Prefixo da ação" maxLength={60} />
          </label>
          <button className="rv-btn rv-btn--sm" type="submit">Filtrar</button>
          {a && <a className="rv-btn rv-btn--sm" href="/master/auditoria">Limpar</a>}
        </form>
      )}
      pager={last > 1 ? (
        <nav aria-label="Paginação" className="row" style={{ gap: "12px", marginTop: "16px", alignItems: "center" }}>
          {p > 1 && <a className="link" href={href(p - 1)}>← Anterior</a>}
          <span className="rv-caption">Página {p} de {last} · {nf(r.data.total)} registros</span>
          {p < last && <a className="link" href={href(p + 1)}>Próxima →</a>}
        </nav>
      ) : undefined}
    />
  );
}

import Link from "next/link";
import { num, requireMaster, rpc, when } from "../data";
import { PageHead, StateBox, Table } from "../ui";

interface A { id: number; at: string; actorId: string | null; actorRole: string | null; action: string; targetType: string | null; targetId: string | null; reason: string | null }
const POR = 50;
export default async function Auditoria({ searchParams }: { searchParams: Promise<{ a?: string; p?: string }> }) {
  const sb = await requireMaster();
  const sp = await searchParams; const p = Math.max(1, Number(sp.p) || 1);
  const r = await rpc<{ total: number; items: A[] }>(sb, "admin_list_audit", { p_limit: POR, p_offset: (p - 1) * POR, p_action: sp.a?.slice(0, 60) || null });
  const href = (n: number) => `/master/auditoria?${new URLSearchParams({ ...(sp.a ? { a: sp.a } : {}), p: String(n) })}`;
  return (
    <>
      <PageHead titulo="Auditoria e segurança" texto="Registro imutável de ações administrativas e de segurança. Ações sensíveis exigem justificativa." />
      <form method="get" role="search" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <label htmlFor="a" style={{ position: "absolute", left: -9999 }}>Prefixo da ação</label>
        <input id="a" name="a" className="mm-field-input" placeholder="Ação começa com… (ex.: photo.)" defaultValue={sp.a} style={{ maxWidth: 320 }} />
        <button className="mm-btn mm-btn--secundario" type="submit">Filtrar</button>
      </form>
      {r.state !== "ok" ? <StateBox load={r} /> : (
        <>
          <Table vazio="Nenhum registro." cols={[{ k: "t", h: "Quando" }, { k: "a", h: "Ação" }, { k: "p", h: "Papel" }, { k: "g", h: "Alvo" }, { k: "m", h: "Justificativa" }]}
            rows={r.data.items.map((x) => ({ t: when(x.at), a: <code>{x.action}</code>, p: x.actorRole ?? "—", g: x.targetType ? `${x.targetType}:${(x.targetId ?? "").slice(0, 8)}` : "—", m: x.reason ?? "—" }))} />
          <nav aria-label="Paginação" style={{ display: "flex", gap: 12, marginTop: 16 }}>
            {p > 1 && <Link href={href(p - 1)}>← Anterior</Link>}
            <span>Página {p} de {Math.max(1, Math.ceil(r.data.total / POR))} · {num(r.data.total)} registros</span>
            {p * POR < r.data.total && <Link href={href(p + 1)}>Próxima →</Link>}
          </nav>
        </>
      )}
    </>
  );
}

import { requireMaster, rpc } from "../data";
import { Badge, StateBox, Table } from "../ui";
import { codeStatus, hintText, usesText } from "../codes";
import { GenerateCodeButton, RevokeCodeButton } from "../codes-actions";

interface Code {
  id: string; hint: string; planCode: string; planName: string | null; maxUses: number; uses: number; expiresAt: string;
  note: string; createdAt: string; revokedAt: string | null; status: string;
}
interface Plan { code: string; name: string; isFree: boolean; sort: number }

const day = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Cuiaba" });

export default async function Codigos() {
  const sb = await requireMaster();
  const [codes, plans] = await Promise.all([rpc<Code[]>(sb, "admin_list_codes"), rpc<Plan[]>(sb, "admin_list_plans")]);
  const paidPlans = plans.state === "ok"
    ? plans.data.filter((p) => !p.isFree).sort((a, b) => a.sort - b.sort).map((p) => ({ code: p.code, name: p.name }))
    : [];
  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Códigos de cortesia</h1>
          <p>Libera um plano sem pagamento, para teste ou presente. Cada resgate vira um direito de cortesia auditado no evento.</p>
        </div>
        <GenerateCodeButton plans={paidPlans} />
      </header>
      {codes.state === "ok" ? (
        <Table
          vazio="Nenhum código gerado ainda."
          cols={[{ k: "c", h: "Código" }, { k: "p", h: "Plano" }, { k: "u", h: "Usos" }, { k: "v", h: "Validade" },
                 { k: "n", h: "Para quem / nota" }, { k: "s", h: "Status" }, { k: "a", h: "Ações" }]}
          rows={codes.data.map((c) => {
            const st = codeStatus(c.status);
            return {
              c: <strong className="adm-code-hint">{hintText(c.hint)}</strong>,
              p: c.planName ?? c.planCode,
              u: usesText(c.uses, c.maxUses),
              v: day(c.expiresAt),
              n: c.note,
              s: <Badge s={st.tone}>{st.label}</Badge>,
              a: c.status === "ativo" ? <RevokeCodeButton code={c} /> : null,
            };
          })}
        />
      ) : <StateBox load={codes} />}
    </>
  );
}

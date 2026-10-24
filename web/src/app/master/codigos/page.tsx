import { requireMaster, rpc, type SearchParams } from "../data";
import { Badge, StateBox } from "../ui";
import { codeStatus, hintText, usesText } from "../codes";
import { GenerateCodeButton, RevokeCodeButton } from "../codes-actions";
import { CsvButton } from "../kit/CsvButton";
import { Pill } from "../kit/Pill";
import { SortableTable } from "../kit/SortableTable";
import { parseSort, sortRows } from "../kit/url";
import { CodeTemplates } from "./CodeTemplates";
import { codeTemplates, usageRatio, validityText } from "./lib";
import css from "./page.module.css";

interface Code {
  id: string; hint: string; planCode: string; planName: string | null; maxUses: number; uses: number; expiresAt: string;
  note: string; createdAt: string; revokedAt: string | null; status: string;
}
interface Plan { code: string; name: string; isFree: boolean; sort: number }

const PATH = "/master/codigos";
const nowMs = () => Date.now();
const day = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Cuiaba" });

export default async function Codigos({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sb = await requireMaster();
  const sp = await searchParams;
  const [codes, plans] = await Promise.all([rpc<Code[]>(sb, "admin_list_codes"), rpc<Plan[]>(sb, "admin_list_plans")]);
  const paidPlans = plans.state === "ok"
    ? plans.data.filter((p) => !p.isFree).sort((a, b) => a.sort - b.sort).map((p) => ({ code: p.code, name: p.name }))
    : [];
  const now = nowMs();
  const { ord, dir } = parseSort(sp, ["createdAt", "planName", "uses", "expiresAt", "status"], { ord: "createdAt", dir: "desc" });
  const rows = codes.state === "ok" ? sortRows(codes.data.map((c) => ({ ...c, planName: c.planName ?? c.planCode })), ord, dir) : [];
  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Códigos de cortesia</h1>
          <p>Libera um plano sem pagamento, para teste ou presente. Cada resgate vira um direito de cortesia auditado no evento.</p>
        </div>
        <GenerateCodeButton plans={paidPlans} />
      </header>

      <section aria-labelledby="cd-modelos">
        <h2 id="cd-modelos" className="adm-sr">Modelos rápidos</h2>
        <p className={css.lead}>Modelos rápidos: abrem o formulário já preenchido, você ajusta e gera.</p>
        <CodeTemplates templates={codeTemplates(paidPlans)} plans={paidPlans} />
      </section>

      {codes.state === "ok" ? (
        <>
          <div className={css.toolbar}>
            <h2>Códigos gerados</h2>
            <CsvButton filename="codigos-cortesia" rows={rows.map((c) => ({
              codigo: hintText(c.hint), plano: c.planName ?? c.planCode, usos: c.uses, limite: c.maxUses, validade: c.expiresAt,
              nota: c.note, status: c.status, criadoEm: c.createdAt,
            }))} cols={[
              { key: "codigo", label: "Código" }, { key: "plano", label: "Plano" }, { key: "usos", label: "Usos" }, { key: "limite", label: "Limite de usos" },
              { key: "validade", label: "Validade" }, { key: "nota", label: "Para quem / nota" }, { key: "status", label: "Status" }, { key: "criadoEm", label: "Criado em" },
            ]} />
          </div>
          <SortableTable
            caption="Códigos de cortesia"
            path={PATH}
            params={sp}
            ord={ord}
            dir={dir}
            rowKey={(c) => c.id}
            rows={rows}
            empty={{ title: "Nenhum código gerado ainda", text: "Use um modelo rápido acima ou o botão Gerar código para liberar um plano sem pagamento." }}
            cols={[
              { key: "hint", label: "Código", sortable: false, render: (c) => <strong className="adm-code-hint">{hintText(c.hint)}</strong> },
              { key: "planName", label: "Plano" },
              { key: "uses", label: "Usos", render: (c) => (
                <span className={css.use}>
                  <span>{usesText(c.uses, c.maxUses)}</span>
                  <span className={css.bar} role="img" aria-label={`${c.uses} de ${c.maxUses} usos`}><span style={{ width: `${usageRatio(c.uses, c.maxUses) * 100}%` }} /></span>
                </span>
              ) },
              { key: "expiresAt", label: "Validade", render: (c) => (
                <>
                  {day(c.expiresAt)}
                  <span className={css.vday}>{c.status === "ativo" ? validityText(c.expiresAt, now) : ""}</span>
                </>
              ) },
              { key: "note", label: "Para quem / nota", sortable: false },
              { key: "status", label: "Status", render: (c) => {
                const st = codeStatus(c.status);
                const soon = c.status === "ativo" && Date.parse(c.expiresAt) - now < 3 * 86_400_000;
                return <><Badge s={st.tone}>{st.label}</Badge>{soon && <> <Pill tone="warn">vence em breve</Pill></>}</>;
              } },
              { key: "actions", label: "Ações", sortable: false, render: (c) => (c.status === "ativo" ? <RevokeCodeButton code={c} /> : null) },
            ]}
          />
        </>
      ) : <StateBox load={codes} />}
    </>
  );
}

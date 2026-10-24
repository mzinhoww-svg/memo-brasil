import Link from "next/link";
import { requireMaster, when, type SearchParams } from "../data";
import { envLabel } from "../billing";
import { CsvButton } from "../kit/CsvButton";
import { EmptyState } from "../kit/EmptyState";
import { Pill } from "../kit/Pill";
import { withShellParams } from "../shell/params";
import { PageHead, StateBox } from "../ui";
import { CompanyField } from "./CompanyField";
import { COMPANY_FIELDS, EDITABLE_KEYS, flagDescription, settingNote, settingText } from "./validate";
import styles from "./page.module.css";

interface S { key: string; value: unknown; updated_at: string }
interface F { key: string; enabled: boolean; rollout: unknown; updated_at: string }

export default async function Configuracoes({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sb = await requireMaster();
  const sp = await searchParams;
  const [s, f] = await Promise.all([sb.from("platform_settings").select("key,value,updated_at").order("key"), sb.from("feature_flags").select("key,enabled,rollout,updated_at").order("key")]);
  const fail = (e: { message: string } | null) => (e ? ({ state: "error", message: e.message } as const) : null);
  const settings = (s.data ?? []) as S[];
  const flags = (f.data ?? []) as F[];
  const byKey = new Map(settings.map((x) => [x.key, x]));
  const filled = COMPANY_FIELDS.filter((c) => settingText(byKey.get(c.key)?.value)).length;
  const env = settingText(byKey.get("payments_env")?.value) ?? "desligado";
  const others = settings.filter((x) => x.key !== "payments_env" && !(EDITABLE_KEYS as readonly string[]).includes(x.key));

  return (
    <>
      <PageHead titulo="Configurações" texto="Cadastro da empresa, parâmetros e feature flags. Toda alteração passa por RPC de master, com motivo, e fica na auditoria." />
      {fail(s.error) ? <StateBox load={fail(s.error)!} /> : (
        <>
          <section className={styles.card} aria-labelledby="cadastro">
            <div className={styles.cardHead}>
              <div>
                <h2 id="cadastro">Cadastro da empresa</h2>
                <p>Aparece para clientes em recibos, no rodapé e no suporte.</p>
              </div>
              <Pill tone={filled === COMPANY_FIELDS.length ? "ok" : "warn"}>{filled} de {COMPANY_FIELDS.length} preenchidos</Pill>
            </div>
            <ul className={styles.fields}>
              {COMPANY_FIELDS.map((c) => <CompanyField key={c.key} k={c.key} label={c.label} help={c.help} inputMode={c.inputMode} current={settingText(byKey.get(c.key)?.value)} canEdit />)}
            </ul>
          </section>

          <section className={styles.card} aria-labelledby="pagamentos">
            <div className={styles.cardHead}>
              <div>
                <h2 id="pagamentos">Ambiente de pagamentos</h2>
                <p>Somente leitura. Alterado só pelo procedimento de pagamentos.</p>
              </div>
              <Pill tone={env === "production" ? "ok" : env === "sandbox" ? "warn" : "info"}>{envLabel(env)}</Pill>
            </div>
            <p className={styles.small}><code>payments_env</code> · atualizado {when(byKey.get("payments_env")?.updated_at)} · <Link href={withShellParams("/master/pagamentos", sp)}>Ver pagamentos</Link></p>
          </section>

          <div className={styles.head}>
            <h2>Outros parâmetros</h2>
            {others.length > 0 && <CsvButton filename="parametros" rows={others.map((x) => ({ chave: x.key, valor: JSON.stringify(x.value), descricao: settingNote(x.key), atualizado: x.updated_at }))}
              cols={[{ key: "chave", label: "Chave" }, { key: "valor", label: "Valor" }, { key: "descricao", label: "Descrição" }, { key: "atualizado", label: "Atualizado" }]} />}
          </div>
          {others.length === 0 ? <EmptyState title="Nenhum outro parâmetro" text="Só o cadastro e o ambiente de pagamentos estão definidos." /> : (
            <div className="adm-table-wrap" role="region" tabIndex={0} aria-label="Outros parâmetros">
              <table className="adm-table">
                <thead><tr><th scope="col">Chave</th><th scope="col">Valor</th><th scope="col">O que faz</th><th scope="col">Atualizado</th></tr></thead>
                <tbody>{others.map((x) => <tr key={x.key}><th scope="row"><code>{x.key}</code></th><td><code>{JSON.stringify(x.value)}</code></td><td>{settingNote(x.key)}</td><td>{when(x.updated_at)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <p className={styles.small}>Parâmetros fora do cadastro são lidos aqui e alterados pelas RPCs <code>admin_set_*</code>.</p>
        </>
      )}

      <div className={styles.head}>
        <h2>Feature flags</h2>
        {flags.length > 0 && <CsvButton filename="feature-flags" rows={flags.map((x) => ({ flag: x.key, estado: x.enabled ? "ligada" : "desligada", descricao: flagDescription(x.key, x.rollout), atualizada: x.updated_at }))}
          cols={[{ key: "flag", label: "Flag" }, { key: "estado", label: "Estado" }, { key: "descricao", label: "Descrição" }, { key: "atualizada", label: "Atualizada" }]} />}
      </div>
      {fail(f.error) ? <StateBox load={fail(f.error)!} /> : flags.length === 0 ? (
        <EmptyState title="Nenhuma flag definida" text="Flags são criadas pela RPC admin_set_feature_flag, com motivo e auditoria." />
      ) : (
        <div className="adm-table-wrap" role="region" tabIndex={0} aria-label="Feature flags">
          <table className="adm-table">
            <thead><tr><th scope="col">Flag</th><th scope="col">Estado</th><th scope="col">Descrição</th><th scope="col">Atualizada</th></tr></thead>
            <tbody>{flags.map((x) => (
              <tr key={x.key}>
                <th scope="row"><code>{x.key}</code></th>
                <td><Pill tone={x.enabled ? "ok" : "dim"}>{x.enabled ? "ligada" : "desligada"}</Pill></td>
                <td>{flagDescription(x.key, x.rollout)}</td>
                <td>{when(x.updated_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

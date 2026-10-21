import { requireMaster, when } from "../data";
import { Badge, PageHead, StateBox, Table } from "../ui";

interface S { key: string; value: unknown; updated_at: string }
interface F { key: string; enabled: boolean; rollout: unknown; updated_at: string }
export default async function Configuracoes() {
  const sb = await requireMaster();
  const [s, f] = await Promise.all([sb.from("platform_settings").select("key,value,updated_at").order("key"), sb.from("feature_flags").select("key,enabled,rollout,updated_at").order("key")]);
  const fail = (e: { message: string } | null) => e ? ({ state: "error", message: e.message } as const) : null;
  return (
    <>
      <PageHead titulo="Configurações" texto="Parâmetros e feature flags da plataforma. Leitura aqui; alterações passam pelas RPCs admin_set_* (somente master, com justificativa e auditoria)." />
      <h2 style={{ fontSize: 18 }}>Parâmetros</h2>
      {fail(s.error) ? <StateBox load={fail(s.error)!} /> : <Table vazio="Nenhum parâmetro definido." cols={[{ k: "k", h: "Chave" }, { k: "v", h: "Valor" }, { k: "u", h: "Atualizado" }]} rows={((s.data ?? []) as S[]).map((x) => ({ k: <code>{x.key}</code>, v: <code>{JSON.stringify(x.value)}</code>, u: when(x.updated_at) }))} />}
      <h2 style={{ fontSize: 18, marginTop: 32 }}>Feature flags</h2>
      {fail(f.error) ? <StateBox load={fail(f.error)!} /> : <Table vazio="Nenhuma flag definida." cols={[{ k: "k", h: "Flag" }, { k: "e", h: "Estado" }, { k: "r", h: "Rollout" }, { k: "u", h: "Atualizada" }]} rows={((f.data ?? []) as F[]).map((x) => ({ k: <code>{x.key}</code>, e: <Badge s={x.enabled ? "ok" : "info"}>{x.enabled ? "ligada" : "desligada"}</Badge>, r: <code>{JSON.stringify(x.rollout)}</code>, u: when(x.updated_at) }))} />}
    </>
  );
}

import { MState } from "@/revela/master-kit";
import { requireMaster, rpc } from "../data";
import { relWhen } from "../format";
import { ConfigForm, type ConfigInitial } from "./ConfigForm";
import { CARD_FLAG, CHECKOUT_FLAG, PIX_KEY } from "./config";
import type { PlatformConfig } from "./platform-config";

interface Setting { key: string; value: unknown }
interface Flag { key: string; enabled: boolean }
interface Overview { readiness?: { paymentsEnv?: string; lastWebhookAt?: string | null } }

const txt = (v: unknown): string => (v == null ? "" : typeof v === "string" ? v : String(v));

/** M14 · Configurações. Ambiente e webhook só leitura (vêm do servidor); validade do Pix, cartão, checkout e parâmetros gravam via RPC com auditoria. */
export default async function Configuracoes() {
  const sb = await requireMaster();
  const [s, f, ov, pub, platform] = await Promise.all([
    sb.from("platform_settings").select("key,value"),
    sb.from("feature_flags").select("key,enabled"),
    rpc<Overview>(sb, "admin_overview", { p_days: 7 }),
    rpc<{ payments_env: string }>(sb, "get_public_settings"),
    rpc<PlatformConfig>(sb,"admin_master_config"),
  ]);
  if (s.error || f.error) return <MState kind="error" text={`Não foi possível carregar: ${(s.error ?? f.error)!.message}`} />;
  if(platform.state!=="ok")return <MState kind={platform.state==="denied"?"denied":"error"}/>;
  const settings = new Map(((s.data ?? []) as Setting[]).map((x) => [x.key, x.value]));
  const flags = new Map(((f.data ?? []) as Flag[]).map((x) => [x.key, x.enabled]));
  const env = pub.state === "ok" && (pub.data.payments_env === "sandbox" || pub.data.payments_env === "production") ? pub.data.payments_env : "desligado";
  const last = ov.state === "ok" ? ov.data.readiness?.lastWebhookAt ?? null : null;
  const initial: ConfigInitial = {
    env,
    pixMinutes: txt(settings.get(PIX_KEY) ?? "15"),
    card: flags.get(CARD_FLAG) === true,
    checkout: flags.get(CHECKOUT_FLAG) === true,
    settings: {},
    platform:platform.data,
    webhook: {
      meta: last ? `último evento ${relWhen(last)}` : "nenhum evento recebido ainda",
      tone: last ? "ok" : "info", label: last ? "Ativo" : "Sem eventos",
    },
  };
  return <ConfigForm initial={initial} />;
}

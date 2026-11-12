import { MState } from "@/revela/master-kit";
import { requireRole, rpc } from "../data";
import { relWhen } from "../format";
import { ConfigForm, type ConfigInitial } from "./ConfigForm";
import { CARD_FLAG, CHECKOUT_FLAG, PIX_KEY, SETTING_FIELDS } from "./config";

interface Setting { key: string; value: unknown }
interface Flag { key: string; enabled: boolean }
interface Overview { readiness?: { paymentsEnv?: string; lastWebhookAt?: string | null } }

const txt = (v: unknown): string => (v == null ? "" : typeof v === "string" ? v : String(v));

/** M14 · Configurações. Ambiente e webhook só leitura (vêm do servidor); validade do Pix, cartão, checkout e parâmetros gravam via RPC com auditoria. */
export default async function Configuracoes() {
  const gate = await requireRole("configuracoes");
  if ("denied" in gate) return gate.denied;
  const { sb } = gate;
  const [s, f, ov, pub] = await Promise.all([
    sb.from("platform_settings").select("key,value"),
    sb.from("feature_flags").select("key,enabled"),
    rpc<Overview>(sb, "admin_overview", { p_days: 7 }),
    rpc<{ payments_env: string }>(sb, "get_public_settings"),
  ]);
  if (s.error || f.error) return <MState kind="error" text={`Não foi possível carregar: ${(s.error ?? f.error)!.message}`} />;
  const settings = new Map(((s.data ?? []) as Setting[]).map((x) => [x.key, x.value]));
  const flags = new Map(((f.data ?? []) as Flag[]).map((x) => [x.key, x.enabled]));
  const env = pub.state === "ok" && (pub.data.payments_env === "sandbox" || pub.data.payments_env === "production") ? pub.data.payments_env : "desligado";
  const last = ov.state === "ok" ? ov.data.readiness?.lastWebhookAt ?? null : null;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const initial: ConfigInitial = {
    env,
    pixMinutes: txt(settings.get(PIX_KEY) ?? "15"),
    card: flags.get(CARD_FLAG) === true,
    checkout: flags.get(CHECKOUT_FLAG) === true,
    settings: Object.fromEntries(SETTING_FIELDS.map((x) => [x.key, txt(settings.get(x.key))])),
    webhook: {
      meta: `${base ? `${base}/functions/v1/payments-validapay-webhook` : "payments-validapay-webhook"} · ${last ? `último evento ${relWhen(last)}` : "nenhum evento recebido ainda"}`,
      tone: last ? "ok" : "info", label: last ? "Ativo" : "Sem eventos",
    },
  };
  return <ConfigForm initial={initial} />;
}

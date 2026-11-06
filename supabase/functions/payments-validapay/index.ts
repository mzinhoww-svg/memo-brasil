import { caller, preflight, responder, serviceClient, UUID_RE, log } from "../_shared/payments-runtime.ts";
import { confirmSandboxCharge, validapayEnabled, validapaySandbox } from "../_shared/validapay-runtime.ts";
import { assertChargeOrder, ValidaPayError, type ChargeInput } from "../_shared/validapay.ts";

const FN = "payments-validapay";
Deno.serve(async (req) => {
  const json = responder(req, true);
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const who = await caller(req);
  if (!who.ok) return json({ error: "unauthorized" }, who.status);
  const master = await who.client.rpc("is_master");
  if (master.error || master.data !== true) return json({ error: "sandbox_restrito" }, 403);
  const admin = serviceClient();
  let orderId: string | null = null;
  try {
    const raw = await req.text();
    if (raw.length > 16_384) return json({ error: "invalid" }, 400);
    const b = JSON.parse(raw) as Record<string, unknown>;
    if (!b || typeof b !== "object" || Array.isArray(b)) return json({ error: "invalid" }, 400);
    const enabled = await validapayEnabled(admin);
    if (b.action === "config") return json({ enabled, environment: "sandbox", publicId: enabled ? Deno.env.get("VALIDAPAY_SANDBOX_PUBLIC_ID") ?? null : null });
    if (!enabled) return json({ error: "pagamento_indisponivel" }, 503);

    const view = async (id: string) => {
      const read = await who.client.rpc("payments_order_status", { p_order: id });
      if (read.error || read.data?.provider !== "validapay") return null;
      const row = await admin.from("payment_orders").select("id,status,provider_env,provider_charge_id,payment_method,brcode,amount_cents,expires_at,plan_code")
        .eq("id", id).eq("provider", "validapay").eq("provider_env", "sandbox").maybeSingle();
      return !row.error && row.data ? { view: read.data, row: row.data } : null;
    };

    if (b.action === "submit" || b.action === "reserve") {
      if (typeof b.eventId !== "string" || !UUID_RE.test(b.eventId) || typeof b.idempotencyKey !== "string" || !UUID_RE.test(b.idempotencyKey) ||
        typeof b.planCode !== "string" || !/^[a-z0-9_-]{1,40}$/.test(b.planCode) || !["pix", "card"].includes(String(b.method))) return json({ error: "invalid" }, 400);
      // Reject raw card fields at the boundary. Never log request bodies.
      if (Object.keys(b).some((k) => !["action", "eventId", "idempotencyKey", "planCode", "method", "customer", "cardToken", "deviceId", "authentication"].includes(k))) return json({ error: "invalid" }, 400);
      const opened = await who.client.rpc("payments_validapay_open", { p_event: b.eventId, p_plan: b.planCode, p_idempotency_key: b.idempotencyKey, p_method: b.method });
      if (opened.error) return json({ error: opened.error.code === "MM013" ? "pedido_aberto" : "invalid" }, opened.error.code === "MM013" ? 409 : 422);
      orderId = opened.data.orderId;
      const current = await view(orderId!);
      if (!current) return json({ error: "nao_encontrado" }, 404);
      if (b.action === "reserve") return json(current.view);
      if (!current.row.provider_charge_id && current.row.status === "criado") {
        const user = await who.client.auth.getUser();
        const buyer = b.customer as Record<string, unknown> | null;
        if (!buyer || Object.keys(buyer).some((k) => !["name", "documentNumber"].includes(k))) return json({ error: "invalid", orderId }, 400);
        const receipt = await validapaySandbox().createCharge({
          orderId: orderId!, amountCents: current.row.amount_cents, method: b.method as "pix" | "card",
          customer: { name: buyer.name as string, documentNumber: buyer.documentNumber as string, email: user.data.user?.email ?? "" },
          cardToken: b.cardToken as string | undefined, deviceId: b.deviceId as string | undefined,
          authentication: b.authentication as ChargeInput["authentication"],
        });
        // Live sandbox can return 409 for distinct externalIds. Never bind another order's money.
        const verifiedIdentity = await validapaySandbox().getCharge(receipt.chargeId);
        assertChargeOrder(verifiedIdentity, orderId!);
        const attach = await admin.rpc("payments_validapay_attach", { p_order: orderId, p_charge: receipt.chargeId, p_method: b.method });
        if (attach.error) throw new Error("attach_failed");
        if (receipt.emv) {
          const save = await admin.from("payment_orders").update({ brcode: receipt.emv }).eq("id", orderId).eq("provider_charge_id", receipt.chargeId);
          if (save.error) throw new Error("pix_save_failed");
        }
      }
    } else if (b.action === "recover") {
      if (typeof b.eventId !== "string" || !UUID_RE.test(b.eventId)) return json({ error: "invalid" }, 400);
      const last = await who.client.from("payment_orders").select("id").eq("event_id", b.eventId).eq("host_id", who.userId).eq("provider", "validapay")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (last.error) return json({ error: "indisponivel" }, 500);
      if (!last.data) return json({ order: null });
      orderId = last.data.id;
    } else if (b.action === "status" || b.action === "cancel") {
      if (typeof b.orderId !== "string" || !UUID_RE.test(b.orderId)) return json({ error: "invalid" }, 400);
      orderId = b.orderId;
    } else return json({ error: "invalid" }, 400);

    let current = await view(orderId!);
    if (!current) return json({ error: "nao_encontrado" }, 404);
    if (current.row.provider_charge_id) {
      if (b.action === "cancel") {
        try { await validapaySandbox().cancelCharge(current.row.provider_charge_id, orderId!); }
        catch (e) { if (!(e instanceof ValidaPayError) || e.status !== 400) throw e; }
        await confirmSandboxCharge(admin, orderId!, current.row.provider_charge_id, "status");
      }
      // Poll route first; a financial change is always confirmed using full detail.
      const status = await validapaySandbox().getStatus(current.row.provider_charge_id);
      if (status.status !== "PENDING" || current.row.status === "criado" || !current.row.expires_at || (current.row.payment_method === "pix" && !current.row.brcode)) {
        await confirmSandboxCharge(admin, orderId!, current.row.provider_charge_id, "status");
      }
      current = await view(orderId!);
    }
    if (!current) return json({ error: "indisponivel" }, 500);
    return json({ ...current.view, emv: current.row.brcode });
  } catch {
    log(FN, orderId, null, "sandbox_request_failed");
    return json({ error: "provedor_indisponivel", orderId }, 502);
  }
});

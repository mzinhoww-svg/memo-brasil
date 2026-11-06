import { centsToReais, reaisToCents } from "./payment-money.ts";

export type ProviderEnvironment = "sandbox" | "production";
export type ChargeInput = {
  orderId: string;
  amountCents: number;
  method: "pix" | "card";
  customer: { name: string; email: string; documentNumber: string };
  cardToken?: string;
  deviceId?: string;
  authentication?: { authenticationId: string; cardId: string };
};
export type ChargeReceipt = { chargeId: string; declined: boolean; emv?: string; qrCode?: string };
export type ConfirmedCharge = {
  chargeId: string; status: string; amountCents: number; paidAmountCents?: number;
  currency: "BRL"; environment: ProviderEnvironment; method: "pix" | "card";
  paidAt?: string; expiresAt?: string; emv?: string; qrCode?: string;
  merchantReference?: string;
  endToEndId?: string;
};
export class ValidaPayError extends Error {
  constructor(readonly kind: "http" | "timeout" | "network" | "invalid" | "config", readonly status?: number) {
    super(`validapay_${kind}`);
    this.name = "ValidaPayError";
  }
}
type Config = {
  environment: ProviderEnvironment; clientId: string; clientSecret: string;
  fetchImpl?: typeof fetch; now?: () => number; timeoutMs?: number; oauthTimeoutMs?: number;
  mode?: "checkout" | "refund";
};
type Json = Record<string, unknown>;
const object = (x: unknown): Json => x !== null && typeof x === "object" && !Array.isArray(x) ? x as Json : {};
const chargeId = (x: unknown, environment: ProviderEnvironment): string => {
  const pattern = environment === "sandbox" ? /^(SANDBOX_)?cha_[A-Za-z0-9_-]{1,150}$/ : /^cha_[A-Za-z0-9_-]{1,150}$/;
  if (typeof x !== "string" || !pattern.test(x)) throw new ValidaPayError("invalid");
  return x;
};
export function assertChargeOrder(charge: { merchantReference?: string }, orderId: string): void {
  if (charge.merchantReference !== orderId) throw new ValidaPayError("invalid");
}
const STATES = ["PENDING", "PROCESSING", "AWAITING_PAYMENT", "PAID", "FAILED", "CHARGE_FAILED", "CANCELED", "CANCELLED", "EXPIRED", "REFUNDED"];

/** No automatic POST retries: callers must reuse the order's externalId after uncertainty. */
export class ValidaPayClient {
  private readonly base: string;
  private readonly oauth: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private token: { value: string; until: number } | null = null;
  private pendingToken: Promise<string> | null = null;

  constructor(private readonly config: Config) {
    if (!["sandbox", "production"].includes(config.environment) || !config.clientId || !config.clientSecret) throw new ValidaPayError("config");
    this.base = config.environment === "sandbox" ? "https://sandbox.validapay.com.br" : "https://api.validapay.com.br";
    this.oauth = config.environment === "sandbox" ? "https://oauth2-sandbox.validapay.com.br/auth/token" : "https://oauth2.validapay.com.br/auth/token";
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.now = config.now ?? Date.now;
  }

  private async request(url: string, init: RequestInit, timeoutMs = this.config.timeoutMs ?? 8_000): Promise<{ status: number; body: Json }> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const r = await this.fetchImpl(url, { ...init, signal: abort.signal, redirect: "error" });
      let body: Json;
      try { body = object(await r.json()); } catch { throw new ValidaPayError("invalid", r.status); }
      return { status: r.status, body };
    } catch (e) {
      if (e instanceof ValidaPayError) throw e;
      throw new ValidaPayError(abort.signal.aborted ? "timeout" : "network");
    } finally { clearTimeout(timer); }
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.until > this.now()) return this.token.value;
    if (this.pendingToken) return this.pendingToken;
    this.pendingToken = (async () => {
      const r = await this.request(this.oauth, {
        method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: this.config.clientId,
          client_secret: this.config.clientSecret, scope: this.config.mode === "refund" ? "charges/read wallet/read wallet/write" : "checkouts/write charges/read charges/write" }).toString(),
      }, this.config.oauthTimeoutMs ?? 20_000);
      if (r.status !== 200) throw new ValidaPayError("http", r.status);
      const value = r.body.access_token;
      if (typeof value !== "string" || !value || typeof r.body.expires_in !== "number" || r.body.expires_in <= 0) throw new ValidaPayError("invalid");
      let until = this.now() + r.body.expires_in * 1000;
      // JWT expiry is only a conservative cache bound, never used as authentication evidence.
      if (value.split(".").length === 3) {
        try {
          const payload = JSON.parse(atob(value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
          if (typeof payload.exp === "number") until = Math.min(until, payload.exp * 1000);
        } catch { throw new ValidaPayError("invalid"); }
      }
      if (!Number.isFinite(until) || until <= this.now()) throw new ValidaPayError("invalid");
      this.token = { value, until: until - 30_000 };
      return value;
    })();
    try { return await this.pendingToken; } finally { this.pendingToken = null; }
  }

  private async authorized(path: string, method = "GET", body?: Json) {
    const token = await this.accessToken();
    const result = await this.request(`${this.base}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    // No OAuth loop: server may return the same expired/revoked token.
    if (result.status === 401) this.token = null;
    return result;
  }

  async createCharge(input: ChargeInput): Promise<ChargeReceipt> {
    if (!/^[0-9a-f-]{36}$/i.test(input.orderId) || !["pix", "card"].includes(input.method)) throw new ValidaPayError("invalid");
    const buyer = input.customer;
    if (!buyer || typeof buyer.name !== "string" || buyer.name.length < 2 || buyer.name.length > 200 ||
      typeof buyer.email !== "string" || buyer.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email) ||
      typeof buyer.documentNumber !== "string" || !/^(\d{11}|\d{14})$/.test(buyer.documentNumber)) throw new ValidaPayError("invalid");
    const body: Json = {
      paymentMethod: input.method === "card" ? "creditcard" : "pix",
      externalId: input.orderId, externalTxid: input.orderId, amount: Number(centsToReais(input.amountCents)),
      customer: { name: buyer.name, email: buyer.email, documentNumber: buyer.documentNumber },
    };
    if (input.method === "card") {
      if (!input.cardToken || !/^ctk_[A-Za-z0-9_-]{1,250}$/.test(input.cardToken) || !input.deviceId || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.deviceId)) throw new ValidaPayError("invalid");
      body.cardToken = input.cardToken; body.deviceId = input.deviceId; body.installments = 1;
      if (!input.authentication || typeof input.authentication.authenticationId !== "string" || !/^[A-Za-z0-9_-]{1,250}$/.test(input.authentication.authenticationId) ||
        typeof input.authentication.cardId !== "string" || !/^[A-Za-z0-9_-]{1,250}$/.test(input.authentication.cardId)) throw new ValidaPayError("invalid");
      body.authentication = { authenticationId: input.authentication.authenticationId, cardId: input.authentication.cardId };
    }
    const r = await this.authorized("/v1/charges", "POST", body);
    const error = object(r.body.error);
    if (r.status === 409 && error.code === "DUPLICATE_CHARGE") return { chargeId: chargeId(object(error.details).chargeId, this.config.environment), declined: false };
    if (r.status === 402) return { chargeId: chargeId(r.body.chargeId, this.config.environment), declined: true };
    if (r.status !== 200 || r.body.success !== true) throw new ValidaPayError("http", r.status);
    const pix = object(r.body.pix);
    return { chargeId: chargeId(r.body.chargeId, this.config.environment), declined: false,
      ...(typeof pix.emv === "string" ? { emv: pix.emv } : {}),
      ...(typeof pix.qrCode === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(pix.qrCode) ? { qrCode: pix.qrCode } : {}),
    };
  }

  /** Detail is for financial confirmation; polling uses the dedicated status endpoint. */
  async getStatus(id: string): Promise<{ chargeId: string; status: string }> {
    const r = await this.authorized(`/v1/charges/${chargeId(id, this.config.environment)}/status`);
    if (r.status !== 200) throw new ValidaPayError("http", r.status);
    if (chargeId(r.body.chargeId, this.config.environment) !== id || !STATES.includes(String(r.body.status))) throw new ValidaPayError("invalid");
    return { chargeId: id, status: String(r.body.status) };
  }

  async cancelCharge(id: string, orderId: string): Promise<void> {
    assertChargeOrder(await this.getCharge(id), orderId);
    const result = await this.authorized(`/v1/charges/${chargeId(id, this.config.environment)}`, "DELETE");
    if (result.status !== 200 || chargeId(result.body.chargeId, this.config.environment) !== id) throw new ValidaPayError("http", result.status);
  }

  /** Explicit full sandbox refund only; no automatic retries after an uncertain POST. */
  async requestRefund(id: string, orderId: string, expectedAmountCents: number) {
    if (this.config.environment !== "sandbox" || this.config.mode !== "refund") throw new ValidaPayError("config");
    const charge = await this.getCharge(id); assertChargeOrder(charge, orderId);
    if (charge.status !== "PAID" || charge.paidAmountCents !== charge.amountCents || charge.amountCents !== expectedAmountCents) throw new ValidaPayError("invalid");
    const result = await this.authorized("/v1/wallet/refunds", "POST", { chargeId: id, amount: Number(centsToReais(charge.amountCents)), reason: "CUSTOMER_REQUEST" });
    const b = result.body;
    if (result.status !== 201 || b.chargeId !== id || typeof b.refundId !== "string" || !/^ref_[A-Za-z0-9_-]{1,150}$/.test(b.refundId) ||
      !["PROCESSING", "CONFIRMED"].includes(String(b.status))) throw new ValidaPayError("http", result.status);
    return { refundId: b.refundId, status: String(b.status) };
  }

  async getRefundEvidence(id: string, orderId: string) {
    if (this.config.environment !== "sandbox" || this.config.mode !== "refund") throw new ValidaPayError("config");
    const charge = await this.getCharge(id); assertChargeOrder(charge, orderId);
    if (charge.method === "pix" && !charge.endToEndId) throw new ValidaPayError("invalid");
    const query = new URLSearchParams(charge.method === "pix" ? { endToEndId: charge.endToEndId! } : { chargeId: id });
    const response = await this.authorized(`/v1/wallet/refunds?${query}`);
    if (response.status !== 200 || !Array.isArray(response.body.items)) throw new ValidaPayError("invalid");
    let refundedCents = 0;
    const ids = new Set<string>();
    for (const entry of response.body.items) {
      const r = object(entry);
      if (r.chargeId !== id || typeof r.refundId !== "string" || !/^ref_[A-Za-z0-9_-]{1,150}$/.test(r.refundId) || ids.has(r.refundId)) throw new ValidaPayError("invalid");
      ids.add(r.refundId);
      if (r.status === "CONFIRMED" && r.success === true) refundedCents += reaisToCents(r.amount as number);
    }
    if (refundedCents > charge.amountCents) throw new ValidaPayError("invalid");
    return { chargeId: id, merchantReference: orderId, environment: "sandbox", currency: "BRL", amountCents: charge.amountCents,
      refundedCents, refundIds: [...ids] };
  }

  async getCharge(id: string): Promise<ConfirmedCharge> {
    const r = await this.authorized(`/v1/charges/${chargeId(id, this.config.environment)}`);
    if (r.status !== 200) throw new ValidaPayError("http", r.status);
    const b = r.body;
    if (chargeId(b.chargeId, this.config.environment) !== id || b.currency !== "BRL" || typeof b.amount !== "number" ||
      !STATES.includes(String(b.status)) || !["PIX", "CREDIT_CARD"].includes(String(b.paymentType))) throw new ValidaPayError("invalid");
    return {
      chargeId: id, status: String(b.status), amountCents: reaisToCents(b.amount), currency: "BRL",
      environment: this.config.environment, method: b.paymentType === "PIX" ? "pix" : "card",
      ...(typeof b.paidAmount === "number" ? { paidAmountCents: reaisToCents(b.paidAmount) } : {}),
      ...(typeof b.paidAt === "string" ? { paidAt: b.paidAt } : {}),
      ...(typeof b.expiresAt === "string" ? { expiresAt: b.expiresAt } : {}),
      ...(typeof object(b.pix).emv === "string" ? { emv: object(b.pix).emv as string } : {}),
      ...(typeof b.externalTxid === "string" ? { merchantReference: b.externalTxid } : {}),
      ...(typeof b.endToEndId === "string" ? { endToEndId: b.endToEndId } : {}),
    };
  }
}

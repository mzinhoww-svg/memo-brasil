import { describe, expect, it, vi } from "vitest";
import { buildRevealEmail, processBatch, sendRevealEmail, type RevealEmailRow } from "./reveal-email";

const row: RevealEmailRow = { id: "r1", email: "ana@exemplo.com", optout_token: "tok-123", event_title: "Ana & Leo <3", event_code: "ABCD2345" };
const cfg = { mode: "console" as const, senderEmail: "oi@revela.app", senderName: "Revela", appUrl: "https://app.exemplo.com/" };

describe("reveal-email", () => {
  it("monta assunto, links e descadastro, escapando o nome da festa", () => {
    const m = buildRevealEmail(row, cfg.appUrl);
    expect(m.subject).toBe("Revelou. As fotos de Ana & Leo <3 já estão no ar");
    expect(m.feedUrl).toBe("https://app.exemplo.com/e/ABCD2345");
    expect(m.optOutUrl).toBe("https://app.exemplo.com/email/sair?t=tok-123");
    expect(m.html).toContain("Ana &amp; Leo &lt;3");
    expect(m.html).not.toContain("Ana & Leo <3");
    expect(m.text).toContain("Não quer mais receber?");
  });
  it("modo console só registra, sem rede", async () => {
    const log = vi.fn(); const fetchFn = vi.fn();
    expect(await sendRevealEmail(row, { ...cfg, log, fetchFn: fetchFn as never })).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(log.mock.calls[0][0]).toContain("para=ana@exemplo.com");
  });
  it("brevo: manda a chave no cabeçalho e o List-Unsubscribe; falha vira motivo", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 201 }));
    expect(await sendRevealEmail(row, { ...cfg, mode: "brevo", apiKey: "k", fetchFn: fetchFn as never })).toBeNull();
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("k");
    expect(JSON.parse(String(init.body)).headers["List-Unsubscribe"]).toContain("/email/sair?t=tok-123");
    expect(await sendRevealEmail(row, { ...cfg, mode: "brevo", apiKey: "k", fetchFn: (async () => new Response("", { status: 429 })) as never })).toBe("brevo_429");
    expect(await sendRevealEmail(row, { ...cfg, mode: "brevo" })).toBe("brevo_sem_chave");
  });
  it("lote: marca enviado uma vez, ignora o já enviado e registra falhas sem parar o resto", async () => {
    const rows = [row, { ...row, id: "r2" }, { ...row, id: "r3" }];
    const markSent = vi.fn(async (id: string) => id !== "r2");
    const markFailed = vi.fn(async () => undefined);
    let n = 0;
    const log = () => { if (++n === 3) throw new Error("rede caiu"); };
    const r = await processBatch(rows, { ...cfg, log }, { markSent, markFailed });
    expect(r).toEqual({ sent: 1, failed: 1, skipped: 1 });
    expect(markFailed).toHaveBeenCalledWith("r3", "rede caiu");
  });
});

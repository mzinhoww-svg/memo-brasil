import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const revalidatePath = vi.fn();
const access = { value: "ok" as string };
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/master/server", () => ({ masterAccess: async () => ({ access: access.value, sb: access.value === "ok" ? { rpc } : null }) }));

import { saveCompanySetting } from "./actions";

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const REASON = "Cadastro inicial da empresa";

beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: null, error: null }); revalidatePath.mockReset(); access.value = "ok"; });

describe("saveCompanySetting", () => {
  it("grava CNPJ normalizado com motivo e revalida o layout do console", async () => {
    const r = await saveCompanySetting({ status: "idle" }, fd({ key: "company_cnpj", value: "11222333000181", reason: ` ${REASON} ` }));
    expect(r.status).toBe("ok");
    expect(rpc).toHaveBeenCalledWith("admin_set_setting", { p_key: "company_cnpj", p_value: "11.222.333/0001-81", p_reason: REASON });
    expect(revalidatePath).toHaveBeenCalledWith("/master", "layout");
  });
  it("nunca grava payments_env", async () => {
    const r = await saveCompanySetting({ status: "idle" }, fd({ key: "payments_env", value: "production", reason: REASON }));
    expect(r).toEqual({ status: "error", message: "Este campo não pode ser alterado aqui." });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("recusa chave fora da lista", async () => {
    expect((await saveCompanySetting({ status: "idle" }, fd({ key: "capacity_grace_pct", value: "50", reason: REASON }))).status).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("valida CNPJ e e-mail no servidor", async () => {
    expect(await saveCompanySetting({ status: "idle" }, fd({ key: "company_cnpj", value: "11222333000182", reason: REASON }))).toMatchObject({ status: "error", field: "value" });
    expect(await saveCompanySetting({ status: "idle" }, fd({ key: "support_email", value: "x@y", reason: REASON }))).toMatchObject({ status: "error", field: "value" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("exige motivo de 10 caracteres", async () => {
    expect(await saveCompanySetting({ status: "idle" }, fd({ key: "support_email", value: "a@b.com", reason: "curto" }))).toMatchObject({ status: "error", field: "reason" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("sem acesso de master não chama o banco", async () => {
    access.value = "denied";
    expect((await saveCompanySetting({ status: "idle" }, fd({ key: "support_email", value: "a@b.com", reason: REASON }))).status).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("traduz erro do banco e não revalida", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "MM004", message: "forbidden" } });
    expect(await saveCompanySetting({ status: "idle" }, fd({ key: "support_email", value: "a@b.com", reason: REASON }))).toEqual({ status: "error", message: "Sem permissão para esta ação." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { BOM, cleanFilters, csvBlob, exportCsv, exportErrorText, exportFilename, ExportError, requestExport, saveBlob } from "./export-csv";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ browserSupabase: () => ({ rpc }) }));

/** Leitor mínimo de CSV (RFC 4180) só para conferir o que o servidor devolve. */
function parse(csv: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (q) { if (ch === '"') { if (csv[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\r" && csv[i + 1] === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; }
    else cell += ch;
  }
  return rows;
}
afterEach(() => { rpc.mockReset(); vi.restoreAllMocks(); });

describe("nome do arquivo", () => {
  it("revela-<tela>-<AAAAMMDD-HHMM>.csv na hora de Cuiabá", () => {
    expect(exportFilename("eventos", new Date("2026-11-10T17:05:00Z"))).toBe("revela-eventos-20261110-1305.csv");
    expect(exportFilename("pessoas-convidados", new Date("2026-01-02T03:04:00Z"))).toBe("revela-pessoas-convidados-20260101-2304.csv");
  });
  it("não deixa caracteres estranhos na tela", () => {
    expect(exportFilename("../x y", new Date("2026-11-10T17:05:00Z"))).toBe("revela-xy-20261110-1305.csv");
  });
});

describe("arquivo", () => {
  it("UTF-8 com BOM e acentos intactos", async () => {
    const b = csvBlob('"ação","Çá"\r\n');
    expect(b.type).toBe("text/csv;charset=utf-8");
    const bytes = new Uint8Array(await new Promise<ArrayBuffer>((ok) => { const r = new FileReader(); r.onload = () => ok(r.result as ArrayBuffer); r.readAsArrayBuffer(b); }));
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes)).toBe(`${BOM}"ação","Çá"\r\n`);
  });
  it("o que o servidor devolve se lê de volta: aspas duplicadas, vírgula, quebra de linha e acentos", () => {
    const csv = '"id","titulo"\r\n"1","Casório ""Ção"", 32\nlinha 2"\r\n"2","=HYPERLINK"\r\n'.replace('"=HYPERLINK"', `"'=HYPERLINK"`);
    expect(parse(csv)).toEqual([["id", "titulo"], ["1", 'Casório "Ção", 32\nlinha 2'], ["2", "'=HYPERLINK"]]);
  });
  it("salva pelo Blob com o nome pedido", () => {
    const click = vi.fn();
    const create = vi.fn(() => "blob:x");
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(click);
    saveBlob(csvBlob("a"), "revela-x.csv");
    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});

describe("pedido ao servidor", () => {
  it("só envia filtros com valor", () => {
    expect(cleanFilters({ f: "pix", q: "", dias: 7, a: undefined, x: null })).toEqual({ f: "pix", dias: 7 });
  });
  it("chama admin_export_csv com tipo e filtros e devolve o resumo", async () => {
    rpc.mockResolvedValue({ data: { csv: '"a"\r\n', rows: 0, truncated: false }, error: null });
    expect(await requestExport("eventos", { f: "rolando", q: "" })).toEqual({ csv: '"a"\r\n', rows: 0, truncated: false });
    expect(rpc).toHaveBeenCalledWith("admin_export_csv", { p_kind: "eventos", p_filters: { f: "rolando" } });
  });
  it("equipe usa a versão que preserva busca e uma linha por conta sem alterar as outras exportações", async () => {
    rpc.mockResolvedValue({ data: { csv: '"email","papel","desde"\r\n', rows: 0, truncated: false }, error: null });
    await requestExport("pessoas", { aba: "equipe", q: "Ana" });
    expect(rpc).toHaveBeenLastCalledWith("admin_export_csv", { p_kind: "pessoas", p_filters: { aba: "equipe", q: "Ana" }, p_design_version: 2 });
    await requestExport("pessoas", { aba: "organizadores", q: "Ana" });
    expect(rpc).toHaveBeenLastCalledWith("admin_export_csv", { p_kind: "pessoas", p_filters: { aba: "organizadores", q: "Ana" } });
  });
  it("traduz erros do banco", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "MM004" } });
    await expect(requestExport("pagamentos", {})).rejects.toMatchObject({ code: "forbidden" });
    rpc.mockResolvedValue({ data: null, error: { code: "MM006" } });
    await expect(requestExport("pagamentos", {})).rejects.toMatchObject({ code: "ratelimited" });
    rpc.mockResolvedValue({ data: { nada: 1 }, error: null });
    await expect(requestExport("pagamentos", {})).rejects.toBeInstanceOf(ExportError);
    expect(exportErrorText(new ExportError("forbidden"))).toMatch(/permissão/);
    expect(exportErrorText(new Error("x"))).toMatch(/Tente de novo/);
  });
  it("exporta e baixa o arquivo com o nome certo", async () => {
    rpc.mockResolvedValue({ data: { csv: '"a"\r\n', rows: 3, truncated: true }, error: null });
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: vi.fn() });
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
    const r = await exportCsv("auditoria", { a: "plan." }, "auditoria", new Date("2026-11-10T17:05:00Z"));
    expect(r).toMatchObject({ rows: 3, truncated: true, filename: "revela-auditoria-20261110-1305.csv" });
    expect(names).toEqual(["revela-auditoria-20261110-1305.csv"]);
    vi.unstubAllGlobals();
  });
});

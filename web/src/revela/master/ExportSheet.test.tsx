// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportError } from "@/lib/master/export-csv";
import { ExportSheet } from "./ExportSheet";

afterEach(cleanup);
const props = { kind: "pagamentos" as const, filters: { f: "pix" }, screen: "pagamentos", screenLabel: "Pagamentos", period: "01 nov 2026 a 11 nov 2026", filtersText: "Método: Pix · Situação: todas", inline: true };
const ok = (rows: number, truncated = false) => vi.fn(async () => ({ csv: "x", rows, truncated, filename: "revela-pagamentos-20261111-0851.csv" }));

describe("ExportSheet (M24)", () => {
  it("mostra tela, período, filtros, formato, linhas estimadas e o aviso de auditoria", () => {
    render(<ExportSheet {...props} rowsEstimate={74} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Exportar" })).toBeTruthy();
    for (const t of ["Pagamentos", "01 nov 2026 a 11 nov 2026", "Método: Pix · Situação: todas", "CSV (UTF-8, separador ,)", "74"]) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getByText("A exportação fica registrada na auditoria: quem, quando, tela e filtros.")).toBeTruthy();
    expect(screen.queryByText(/truncado/)).toBeNull();
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeTruthy();
  });
  it("exportar chama o cliente com tipo, filtros e nome da tela e fecha ao terminar", async () => {
    const run = ok(74);
    const onClose = vi.fn();
    const onDone = vi.fn();
    render(<ExportSheet {...props} rowsEstimate={74} run={run} onDone={onDone} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(run).toHaveBeenCalledWith("pagamentos", { f: "pix" }, "pagamentos");
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ rows: 74, truncated: false }));
  });
  it("acima de 50 mil linhas avisa que vem truncado e o botão diz 50.000 linhas (M24-t)", () => {
    render(<ExportSheet {...props} rowsEstimate={63900} onClose={vi.fn()} />);
    expect(screen.getByText("63.900")).toBeTruthy();
    expect(screen.getByText(/Passa de 50 mil linhas\. O arquivo virá truncado nas primeiras 50\.000\. Reduza o período para exportar tudo\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exportar 50.000 linhas" })).toBeTruthy();
  });
  it("exatamente 50.000 linhas não avisa", () => {
    render(<ExportSheet {...props} rowsEstimate={50000} onClose={vi.fn()} />);
    expect(screen.queryByText(/truncado/)).toBeNull();
  });
  it("traduz o erro do servidor e continua aberta", async () => {
    const run = vi.fn(async () => { throw new ExportError("forbidden"); });
    const onClose = vi.fn();
    render(<ExportSheet {...props} rowsEstimate={74} run={run} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Sem permissão para exportar esta tela.");
    expect(onClose).not.toHaveBeenCalled();
  });
  it("muitas exportações seguidas (limite do servidor)", async () => {
    render(<ExportSheet {...props} rowsEstimate={74} run={vi.fn(async () => { throw new ExportError("ratelimited"); })} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Muitas exportações seguidas. Espere alguns minutos.");
  });
  it("sem estimativa mostra '—'", () => {
    render(<ExportSheet {...props} rowsEstimate={null} onClose={vi.fn()} />);
    expect(screen.getByText("—")).toBeTruthy();
  });
});

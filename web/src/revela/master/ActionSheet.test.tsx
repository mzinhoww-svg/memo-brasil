// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionSheet } from "./ActionSheet";

afterEach(cleanup);
const motivo = () => screen.getByLabelText("Motivo") as HTMLTextAreaElement;
const type = (v: string) => fireEvent.change(motivo(), { target: { value: v } });
const confirm = () => screen.getByRole("button", { name: "Revogar papel" }) as HTMLButtonElement;
const base = { title: "Revogar o papel de support?", body: "suporte@revela.app perde o acesso ao console na hora.", confirmLabel: "Revogar papel", tone: "danger" as const, inline: true };

describe("ActionSheet: motivo de 10 a 500 caracteres", () => {
  it("mostra título, corpo, aviso de auditoria e o contador 0/500 · mínimo 10", () => {
    render(<ActionSheet {...base} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Revogar o papel de support?" })).toBeTruthy();
    expect(screen.getByText("suporte@revela.app perde o acesso ao console na hora.")).toBeTruthy();
    expect(screen.getByText("Fica registrado na auditoria com o seu nome.")).toBeTruthy();
    expect(screen.getByText("0/500 · mínimo 10")).toBeTruthy();
  });
  it("o botão principal fica desligado até o motivo ter 10 caracteres", () => {
    render(<ActionSheet {...base} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(confirm().disabled).toBe(true);
    type("curto");
    expect(confirm().disabled).toBe(true);
    expect(screen.getByText("5/500 · mínimo 10")).toBeTruthy();
    type("123456789");
    expect(confirm().disabled).toBe(true);
    type("1234567890");
    expect(confirm().disabled).toBe(false);
    expect(screen.getByText("10/500 · mínimo 10")).toBeTruthy();
  });
  it("espaços nas pontas não contam: nove letras com espaços continua desligado", () => {
    render(<ActionSheet {...base} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    type("   123456789   ");
    expect(confirm().disabled).toBe(true);
  });
  it("500 caracteres ainda vale; 501 desliga o botão e o contador fica em vermelho", () => {
    render(<ActionSheet {...base} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    type("a".repeat(500));
    expect(confirm().disabled).toBe(false);
    type("a".repeat(501));
    expect(confirm().disabled).toBe(true);
    const n = screen.getByText("501/500 · mínimo 10");
    expect(n.style.color).toContain("danger");
    expect(motivo().getAttribute("aria-invalid")).toBe("true");
  });
  it("confirmar entrega o motivo aparado e fica ocupado até terminar", async () => {
    let done!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((r) => { done = r; }));
    render(<ActionSheet {...base} busyLabel="Revogando…" onConfirm={onConfirm} onCancel={vi.fn()} />);
    type("  Saiu da equipe de atendimento.  ");
    fireEvent.click(confirm());
    expect(onConfirm).toHaveBeenCalledWith("Saiu da equipe de atendimento.");
    expect((await screen.findByRole("button", { name: "Revogando…" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
    done();
    await waitFor(() => expect((screen.getByRole("button", { name: "Revogar papel" }) as HTMLButtonElement).disabled).toBe(false));
  });
  it("com o botão desligado, clicar não chama onConfirm", () => {
    const onConfirm = vi.fn();
    render(<ActionSheet {...base} onConfirm={onConfirm} onCancel={vi.fn()} />);
    type("curto");
    fireEvent.click(confirm());
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("mostra o erro do servidor acima dos botões", () => {
    render(<ActionSheet {...base} error="Sem permissão para esta ação." onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toBe("Sem permissão para esta ação.");
  });
  it("valor antigo e novo (.diff)", () => {
    const { container } = render(<ActionSheet title="Alterar a validade do Pix" confirmLabel="Salvar" inline onConfirm={vi.fn()} onCancel={vi.fn()}
      diff={{ from: { label: "Hoje", value: "15 min" }, to: { label: "Novo valor (5 a 1.440)", value: <b>30 min</b> } }} />);
    expect(container.querySelector(".diff")).not.toBeNull();
    expect(container.querySelector(".diff .was")?.textContent).toBe("15 min");
    expect(screen.getByText("Novo valor (5 a 1.440)")).toBeTruthy();
    expect(screen.getByText("30 min")).toBeTruthy();
  });
  it("Cancelar e Esc fecham", () => {
    const onCancel = vi.fn();
    render(<ActionSheet {...base} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});

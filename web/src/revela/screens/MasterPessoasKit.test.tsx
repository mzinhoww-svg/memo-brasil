// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MasterPessoasConvidadosView } from "./MasterPessoasConvidados";
import { MasterPessoasEquipeView } from "./MasterPessoasEquipe";
import { Pager, pageWindow, PessoasTabs, REF_COUNTS } from "./MasterPessoasKit";
import { GrantRoleSheet, RevokeRoleSheet } from "./PessoasEquipeSheets";

afterEach(cleanup);
const reason = (n: number) => "a".repeat(n);
const typeReason = (v: string) => fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: v } });

describe("Pessoas: peças", () => {
  it("janela da paginação", () => {
    expect(pageWindow(1, 305)).toEqual([1, 2, 3, "…", 305]);
    expect(pageWindow(10, 20)).toEqual([1, "…", 9, 10, 11, "…", 20]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });
  it("abas e paginação viram links só na rota real", () => {
    const { container, rerender } = render(<><PessoasTabs aba="contas" counts={REF_COUNTS} /><Pager aba="contas" page={2} total={100} /></>);
    expect(container.querySelectorAll("a").length).toBe(0);
    rerender(<><PessoasTabs aba="contas" counts={REF_COUNTS} live /><Pager aba="contas" page={2} total={100} query={{ q: "ana" }} live /></>);
    expect(screen.getByText("Equipe 3").getAttribute("href")).toBe("/master/pessoas?aba=equipe");
    expect(screen.getByLabelText("Próxima página").getAttribute("href")).toBe("/master/pessoas?aba=contas&q=ana&p=3");
    expect(screen.getByText("26–50 de 100 · 25 por página")).toBeTruthy();
  });
  it("convidados: chips viram links com o filtro", () => {
    render(<MasterPessoasConvidadosView live chips={[{ label: "Bloqueados", n: 6, href: "/master/pessoas?aba=convidados&f=bloqueados" }]} />);
    expect(screen.getByText("Bloqueados 6").getAttribute("href")).toContain("f=bloqueados");
  });
  it("equipe: o último master mostra o texto no lugar do botão Revogar", () => {
    render(<MasterPessoasEquipeView />);
    expect(screen.getAllByRole("button", { name: "Revogar" })).toHaveLength(2);
    expect(screen.getByText("último master")).toBeTruthy();
  });
  it("equipe: Revogar chama o handler com a linha", () => {
    const onRevoke = vi.fn();
    render(<MasterPessoasEquipeView onRevoke={onRevoke} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Revogar" })[0]);
    expect(onRevoke).toHaveBeenCalledWith(expect.objectContaining({ role: "support" }));
  });
});

describe("Pessoas: folhas da equipe", () => {
  it("conceder: botão desligado até 10 caracteres e de novo acima de 500", () => {
    render(<GrantRoleSheet inline initialEmail="a@b.co" />);
    const b = screen.getByRole("button", { name: "Conceder" }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    typeReason(reason(9)); expect(b.disabled).toBe(true);
    typeReason(reason(10)); expect(b.disabled).toBe(false);
    typeReason(reason(500)); expect(b.disabled).toBe(false);
    typeReason(reason(501)); expect(b.disabled).toBe(true);
  });
  it("conceder: envia e-mail, papel escolhido e motivo; erro do servidor aparece", async () => {
    const onSubmit = vi.fn(async () => "Essa conta já tem este papel.");
    render(<GrantRoleSheet inline initialEmail=" novo@b.co " onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("radio", { name: "auditor" }));
    typeReason("motivo válido aqui");
    fireEvent.click(screen.getByRole("button", { name: "Conceder" }));
    await screen.findByText("Essa conta já tem este papel.");
    expect(onSubmit).toHaveBeenCalledWith("novo@b.co", "auditor", "motivo válido aqui");
  });
  it("conceder: e-mail inválido não chega ao servidor", async () => {
    const onSubmit = vi.fn(async () => null);
    render(<GrantRoleSheet inline initialEmail="sem-arroba" onSubmit={onSubmit} />);
    typeReason("motivo válido aqui");
    fireEvent.click(screen.getByRole("button", { name: "Conceder" }));
    await screen.findByText("Informe o e-mail de uma conta do Revela.");
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it("revogar: título com o papel, motivo mínimo e fecha ao dar certo", async () => {
    const onSubmit = vi.fn(async () => null); const onClose = vi.fn();
    render(<RevokeRoleSheet inline role="support" email="s@r.app" onSubmit={onSubmit} onClose={onClose} />);
    expect(screen.getByText("Revogar o papel de support?")).toBeTruthy();
    const b = screen.getByRole("button", { name: "Revogar papel" }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    typeReason("saiu da equipe agora");
    fireEvent.click(b);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith("saiu da equipe agora");
  });
});

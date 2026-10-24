import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const save = vi.fn(async () => ({ status: "ok" as const, message: "Salvo e registrado na auditoria." }));
vi.mock("./actions", () => ({ saveCompanySetting: (...a: unknown[]) => save(...(a as [])) }));

import { CompanyField } from "./CompanyField";

describe("CompanyField", () => {
  it("destaca campo faltando e oferece preencher", () => {
    render(<ul><CompanyField k="company_cnpj" label="CNPJ" help="" inputMode="text" current={null} canEdit /></ul>);
    expect(screen.getByText("Não preenchido")).toBeTruthy();
    expect(screen.getByText("falta")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Preencher CNPJ" })).toBeTruthy();
  });

  it("valida CNPJ e motivo no navegador antes de enviar", async () => {
    const u = userEvent.setup();
    render(<ul><CompanyField k="company_cnpj" label="CNPJ" help="" inputMode="text" current={null} canEdit /></ul>);
    await u.click(screen.getByRole("button", { name: "Preencher CNPJ" }));
    await u.type(screen.getByLabelText("CNPJ"), "11222333000182");
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByText(/CNPJ inválido/)).toBeTruthy();
    expect(screen.getByText(/pelo menos 10 caracteres/)).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
  });

  it("envia quando válido e fecha o formulário", async () => {
    const u = userEvent.setup();
    render(<ul><CompanyField k="support_email" label="E-mail de suporte" help="" inputMode="email" current="velho@x.com" canEdit /></ul>);
    await u.click(screen.getByRole("button", { name: "Editar E-mail de suporte" }));
    const input = screen.getByLabelText("E-mail de suporte");
    await u.clear(input);
    await u.type(input, "novo@memoriesmt.com.br");
    await u.type(screen.getByLabelText(/Motivo da alteração/), "Troca do contato de suporte");
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });
});

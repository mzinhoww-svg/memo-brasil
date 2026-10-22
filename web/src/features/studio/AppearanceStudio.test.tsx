// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemoEvent } from "@/domain/event";
import { AppearanceStudio } from "./AppearanceStudio";

const qrSpy = vi.hoisted(() => vi.fn(async (_url: string, ..._r: unknown[]) => "data:image/png;base64,AAAA"));
vi.mock("@/features/invitations/qr", () => ({ qrDataUrl: qrSpy }));

afterEach(cleanup);
const ev = { id: "e1", title: "Emy e Igor", palette: "salvia", eventFont: "birthstone" } as MemoEvent;

describe("AppearanceStudio", () => {
  it("a prévia do QR usa a origem atual, não um domínio fixo (UX-18)", async () => {
    render(<AppearanceStudio event={{ ...ev, code: "ABCD1234" } as MemoEvent} locked={false} onSave={vi.fn()} onRestore={vi.fn()} />);
    await waitFor(() => expect(qrSpy).toHaveBeenCalled());
    const url = String(qrSpy.mock.calls[0][0]);
    expect(url).toBe(`${window.location.origin}/e/ABCD1234`);
    expect(url).not.toContain("memoriesmt.app");
  });
  it("cor sem contraste mostra o erro e bloqueia o salvamento; a prévia não aplica o tema inválido", () => {
    const onSave = vi.fn();
    render(<AppearanceStudio event={ev} locked={false} onSave={onSave} onRestore={vi.fn()} />);
    const campo = screen.getByLabelText(/^Texto/);
    fireEvent.change(campo, { target: { value: "#e8ece4" } });
    expect(screen.getByTestId("studio-erros").textContent).toMatch(/contraste/i);
    expect(campo.getAttribute("aria-invalid")).toBe("true"); // o erro é ligado ao campo certo
    expect(campo.getAttribute("aria-describedby")).toMatch(/ap-cor-erro-texto/);
    expect(screen.getByText(/mostrando o último tema válido/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Salvar aparência" }) as HTMLButtonElement).disabled).toBe(true);
    const cartao = document.querySelector(".studio-cartao") as HTMLElement;
    expect(cartao.style.getPropertyValue("--evento-texto").toUpperCase()).toBe("#5B6752"); // a prévia mostra o ÚLTIMO tema válido, não a cor inválida
  });
  it("aviso de salvo fica numa região live sempre montada e some ao editar", async () => {
    render(<AppearanceStudio event={ev} locked={false} onSave={vi.fn().mockResolvedValue(undefined)} onRestore={vi.fn()} />);
    const msg = screen.getByTestId("studio-msg");
    expect(msg.getAttribute("aria-live")).toBe("polite"); expect(msg.textContent).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Salvar aparência" }));
    await waitFor(() => expect(msg.textContent).toBe("Aparência salva."));
    fireEvent.change(screen.getByLabelText("Mensagem de boas-vindas"), { target: { value: "novo" } });
    expect(msg.textContent).toBe(""); // não fica "salvo" depois de editar
    expect(screen.getByTestId("studio-msg")).toBe(msg); // mesmo elemento: a região live não foi remontada
  });
  it("tema válido salva o rascunho e mostra a mensagem na prévia", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AppearanceStudio event={ev} locked={false} onSave={onSave} onRestore={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Mensagem de boas-vindas"), { target: { value: "Que bom ter você!" } });
    expect(screen.getAllByText("Que bom ter você!").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Salvar aparência" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ welcomeMessage: "Que bom ter você!", preset: "salvia" })));
  });
  it("depois da revelação tudo fica travado", () => {
    render(<AppearanceStudio event={ev} locked onSave={vi.fn()} onRestore={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Salvar aparência" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText("Mensagem de boas-vindas").matches(":disabled")).toBe(true); // desabilitado pelo fieldset
  });
  it("a prévia fica isolada no wrapper do evento e mantém a assinatura da plataforma", () => {
    render(<AppearanceStudio event={ev} locked={false} onSave={vi.fn()} onRestore={vi.fn()} />);
    expect(document.documentElement.style.getPropertyValue("--evento-superficie")).toBe("");
    expect(screen.getByText("Powered by MemoriesMT")).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemoEvent } from "@/domain/event";
import { AppearanceStudio } from "./AppearanceStudio";

afterEach(cleanup);
const ev = { id: "e1", title: "Emy e Igor", palette: "salvia", eventFont: "birthstone" } as MemoEvent;

describe("AppearanceStudio", () => {
  it("cor sem contraste mostra o erro e bloqueia o salvamento; a prévia não aplica o tema inválido", () => {
    const onSave = vi.fn();
    render(<AppearanceStudio event={ev} locked={false} onSave={onSave} onRestore={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Texto"), { target: { value: "#e8ece4" } });
    expect(screen.getByRole("alert").textContent).toMatch(/contraste/i);
    expect((screen.getByRole("button", { name: "Salvar aparência" }) as HTMLButtonElement).disabled).toBe(true);
    const cartao = document.querySelector(".studio-cartao") as HTMLElement;
    expect(cartao.getAttribute("data-event-theme")).toBe("palette");
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

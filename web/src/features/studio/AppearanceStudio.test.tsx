// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemoEvent } from "@/domain/event";
import { AppearanceStudio } from "./AppearanceStudio";

afterEach(cleanup);
const ev = { id: "e1", title: "Ana e Leo", code: "ABCD1234", palette: "salvia", eventFont: "birthstone", cameraStyle: "festa" } as MemoEvent;
const props = () => ({ event: ev, locked: false, onSave: vi.fn(async () => undefined), onSaveLook: vi.fn(async () => undefined) });

describe("AppearanceStudio (Revela)", () => {
  it("lista as 4 embalagens e marca a atual", () => {
    render(<AppearanceStudio {...props()} />);
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["Festa", "Casamento", "Aniversário", "Noite"]);
    expect(screen.getByRole("radio", { name: "Festa" }).getAttribute("aria-checked")).toBe("true");
  });
  it("salvar grava embalagem e filme escolhidos e depois a mensagem", async () => {
    const p = props();
    render(<AppearanceStudio {...p} />);
    fireEvent.click(screen.getByRole("radio", { name: "Casamento" }));
    fireEvent.click(screen.getByRole("button", { name: "Natural" }));
    fireEvent.change(screen.getByLabelText(/Mensagem de boas-vindas/), { target: { value: "Vem dançar" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar aparência" }));
    await waitFor(() => expect(p.onSave).toHaveBeenCalled());
    expect(p.onSaveLook).toHaveBeenCalledWith({ cameraStyle: "casamento", filmLook: "natural" });
    expect((p.onSave.mock.calls[0] as unknown[])[0]).toMatchObject({ welcomeMessage: "Vem dançar" });
    expect(await screen.findByText("Aparência salva.")).toBeTruthy();
  });
  it("falha ao gravar a embalagem não grava o resto e mostra o motivo", async () => {
    const p = { ...props(), onSaveLook: vi.fn(async () => "A revelação já aconteceu; não dá para mudar.") };
    render(<AppearanceStudio {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar aparência" }));
    expect(await screen.findByText(/revelação já aconteceu/)).toBeTruthy();
    expect(p.onSave).not.toHaveBeenCalled();
  });
  it("depois da revelação tudo fica travado, com aviso", () => {
    render(<AppearanceStudio {...props()} locked />);
    expect(screen.getByText(/não pode mais mudar/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Salvar aparência" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("radio", { name: "Noite" }).matches(":disabled")).toBe(true);
  });
});

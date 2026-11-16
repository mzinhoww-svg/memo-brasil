import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ peek: vi.fn(), push: vi.fn(), save: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), useParams: () => ({ code: "MMT-7KQ4-AB12" }) }));
vi.mock("@/features/billing/api", () => ({ peekCode: (c: string) => mocks.peek(c) }));
vi.mock("@/features/events/plan-catalog", () => ({ savePendingCode: (c: string) => mocks.save(c) }));
import CodigoLink from "./page";

describe("/c/<código> · link de presente", () => {
  beforeEach(() => { mocks.peek.mockReset(); mocks.save.mockReset(); mocks.push.mockReset(); });
  it("presente ativo: mostra o plano, guarda o código e leva ao assistente", async () => {
    mocks.peek.mockResolvedValue({ status: "ativo", planCode: "casamento", planName: "Casamento", maxGuests: 250, maxShots: 36 });
    render(<CodigoLink />);
    expect(await screen.findByTestId("presente")).toHaveTextContent("Plano Casamento");
    expect(screen.getByTestId("presente-linhas")).toHaveTextContent("até 250 convidados · 36 poses por pessoa");
    expect(mocks.save).toHaveBeenCalledWith("MMT-7KQ4-AB12");
    screen.getByRole("button", { name: "Criar meu evento" }).click();
    expect(mocks.push).toHaveBeenCalledWith("/criar");
  });
  it.each([["usado", "já foi aberto"], ["expirado", "validade"], ["revogado", "cancelado"], ["invalido", "Não encontramos"]])("%s: avisa e não guarda o código", async (status, text) => {
    mocks.peek.mockResolvedValue({ status, planCode: null, planName: null, maxGuests: null, maxShots: null });
    render(<CodigoLink />);
    expect(await screen.findByTestId("presente-indisponivel")).toHaveTextContent(text);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("sem resposta do servidor: segue com o presente genérico e guarda o código para o servidor decidir", async () => {
    mocks.peek.mockResolvedValue(null);
    render(<CodigoLink />);
    await waitFor(() => expect(screen.getByTestId("presente")).toBeInTheDocument());
    expect(mocks.save).toHaveBeenCalledWith("MMT-7KQ4-AB12");
  });
});

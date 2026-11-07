import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ data: { event: undefined, loading: false, error: undefined as string | undefined, refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "event-1" }) }));
vi.mock("@/features/app/hooks", () => ({ useEventData: () => m.data }));
vi.mock("@/features/studio/useBrandImages", () => ({ useBrandImages: () => ({}) }));
import Pronto from "./page";
beforeEach(() => { m.data.error = undefined; m.data.refresh.mockReset().mockResolvedValue(undefined); });
describe("convite recém criado", () => {
 it("rede não é ausência e pode repetir sem perder a rota", async () => { m.data.error = "unavailable"; render(<Pronto />); expect(screen.queryByText("Não achamos esse evento.")).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" })); await waitFor(() => expect(m.data.refresh).toHaveBeenCalledOnce()); expect(screen.getByRole("link", { name: "Meus eventos" })).toHaveAttribute("href", "/eventos"); });
 it("acesso recusado é distinto de rede", () => { m.data.error = "forbidden"; render(<Pronto />); expect(screen.getByRole("alert")).toHaveTextContent(/acesso/); });
 it("ausência confirmada mantém mensagem de evento inexistente", () => { render(<Pronto />); expect(screen.getByText("Não achamos esse evento.")).toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull(); });
});

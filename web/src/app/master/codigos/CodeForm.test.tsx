import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CodeForm } from "./CodeForm";

const m = vi.hoisted(() => ({ rpc: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/lib/supabase/client", () => ({ browserSupabase: () => ({ rpc: m.rpc }) }));
beforeEach(() => { m.rpc.mockReset(); m.refresh.mockClear(); });

it("cria o código escolhido só depois do motivo e confirmação", async () => {
  m.rpc.mockResolvedValue({ data: "FESTA-JULIA", error: null });
  render(<CodeForm plans={[{ code: "festa", name: "Festa" }]} />);
  fireEvent.click(screen.getByRole("button", { name: "Criar código" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(m.rpc).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Código"), { target: { value: "festa-julia" } });
  fireEvent.click(screen.getByRole("button", { name: "Criar código" }));
  const sheet = screen.getByRole("dialog");
  fireEvent.click(within(sheet).getByRole("button", { name: "Criar código" }));
  expect(m.rpc).not.toHaveBeenCalled();
  fireEvent.change(within(sheet).getByLabelText(/Motivo/), { target: { value: "Cortesia aprovada para este evento" } });
  fireEvent.click(within(sheet).getByRole("button", { name: "Criar código" }));
  await waitFor(() => expect(m.rpc).toHaveBeenCalledExactlyOnceWith("admin_master_create_code", {
    p_code: "FESTA-JULIA", p_plan: "festa", p_max_uses: 20,
    p_expires_at: expect.any(String), p_reason: "Cortesia aprovada para este evento",
  }));
  await waitFor(() => expect(screen.getByLabelText("Código gerado")).toHaveTextContent("FESTA-JULIA"));
  expect(m.refresh).toHaveBeenCalledOnce();
});

it("cancelar não cria; erro MM004 mantém a confirmação com mensagem de permissão", async () => {
  m.rpc.mockResolvedValue({ data: null, error: { code: "MM004", message: "forbidden" } });
  render(<CodeForm plans={[{ code: "festa", name: "Festa" }]} />);
  fireEvent.change(screen.getByLabelText("Código"), { target: { value: "FESTA-JULIA" } });
  fireEvent.click(screen.getByRole("button", { name: "Criar código" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
  expect(m.rpc).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Criar código" }));
  const sheet = screen.getByRole("dialog");
  fireEvent.change(within(sheet).getByLabelText(/Motivo/), { target: { value: "Cortesia aprovada para este evento" } });
  fireEvent.click(within(sheet).getByRole("button", { name: "Criar código" }));
  await waitFor(() => expect(within(sheet).getByRole("alert")).toHaveTextContent("Sem permissão"));
  expect(m.refresh).not.toHaveBeenCalled();
});

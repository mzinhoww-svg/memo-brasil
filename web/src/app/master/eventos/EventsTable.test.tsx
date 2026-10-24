import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn(), refresh = vi.fn();
const softDelete = vi.fn<(ids: string, reason: string) => Promise<{ ok: true; count: number }>>(async (ids) => ({ ok: true, count: ids.split(",").length }));
const setFlag = vi.fn(async () => ({ ok: true as const, count: 1 }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }), usePathname: () => "/master/eventos", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
vi.mock("./actions", () => ({ softDeleteTestEvents: (ids: string, r: string) => softDelete(ids, r), setTestFlag: (...a: unknown[]) => setFlag(...(a as [])) }));

import { EventsTable, type TableRow } from "./EventsTable";
import { toEventRow } from "./lib";

const row = (id: string, isTest: boolean, title: string): TableRow => ({ ...toEventRow({ id, title, hostName: "Ana", status: "ativo", revealState: "pendente", participants: 2, capacity: 10, isTest }), plan: "Festa" });
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";

beforeEach(() => { push.mockClear(); refresh.mockClear(); softDelete.mockClear(); });

describe("EventsTable", () => {
  it("mostra TESTE, plano e abre o drawer ao clicar na linha", async () => {
    render(<EventsTable rows={[row(A, true, "TESTE festa"), row(B, false, "Casamento")]} path="/master/eventos" params={{ testes: "1" }} ord="createdAt" dir="desc" bulk />);
    expect(screen.getAllByText("TESTE")).toHaveLength(1);
    await userEvent.click(screen.getByText("Casamento").closest("tr")!.querySelectorAll("td")[3]);
    expect(push).toHaveBeenCalledWith(`/master/eventos?testes=1&ev=${B}`);
  });
  it("cabeçalho ordena via link no servidor", () => {
    render(<EventsTable rows={[row(A, true, "x")]} path="/master/eventos" params={{}} ord="title" dir="asc" bulk />);
    expect(screen.getByRole("link", { name: /Evento/ })).toHaveAttribute("href", "/master/eventos?ord=title&dir=desc");
  });
  it("excluir em lote envia só os de teste, com justificativa e confirmação", async () => {
    render(<EventsTable rows={[row(A, true, "TESTE festa"), row(B, false, "Casamento")]} path="/master/eventos" params={{}} ord="createdAt" dir="desc" bulk />);
    await userEvent.click(screen.getByLabelText("Selecionar todos desta página"));
    await userEvent.click(screen.getByRole("button", { name: "Excluir testes selecionados" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("TESTE festa")).toBeInTheDocument();
    expect(within(dialog).queryByText("Casamento")).toBeNull();
    const submit = within(dialog).getAllByRole("button", { name: "Excluir testes selecionados" }).at(-1)!;
    await userEvent.click(submit);
    expect(softDelete).not.toHaveBeenCalled();
    await userEvent.type(within(dialog).getByRole("textbox"), "limpeza dos testes de homologação");
    await userEvent.click(submit);
    expect(softDelete).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("checkbox"));
    await userEvent.click(submit);
    expect(softDelete).toHaveBeenCalledWith(A, "limpeza dos testes de homologação");
  });
  it("sem RPC nova não há seleção nem ações", () => {
    render(<EventsTable rows={[row(A, true, "x")]} path="/master/eventos" params={{}} ord="createdAt" dir="desc" bulk={false} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Excluir testes selecionados" })).toBeNull();
  });
});

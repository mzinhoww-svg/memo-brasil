import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { useCallback, useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoEvent } from "@/domain/event";
import { PainelFrame } from "@/components/revela/PainelFrame";
import { AdminProvider } from "@/features/admin/context";
import { createMemoryRepositories } from "@/repositories";
import type { Repositories } from "@/repositories/types";

// SEM mockar updateSettings: o salvamento passa pelos repositórios em memória de verdade.
const m = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
vi.mock("@/features/admin/PlanInfo", () => ({ usePlanInfo: () => ({ loaded: false, plans: [], settings: undefined }) }));
vi.mock("@/features/events/RevealSettings", () => ({ RevealSettings: () => <p>revelação</p> }));
const NOW = Date.UTC(2026, 2, 14, 22, 0);
const app = { repos: createMemoryRepositories() as Repositories, now: () => NOW, scheduler: { cancel: vi.fn() } };
vi.mock("@/features/app/provider", () => ({ useApp: () => app }));

const { default: Configuracoes } = await import("./page");

const HOUR = 3_600_000;
const base: MemoEvent = {
  id: "e1", code: "ABC", title: "Nosso casamento", category: "casamento", hostId: "h", hostName: "Ana", startAt: NOW - 4 * HOUR, durationHours: 6,
  cameraStyle: "festa", revealEnabled: true, revealAt: NOW + HOUR, revealAnchor: "fim", revealOffsetDays: 0, revealedAt: null, version: 1, timezone: "UTC", revealStatus: "pendente",
  capacity: 50, shotsPerPerson: 24, everyoneSeesAll: true, reactionsEnabled: true, palette: "salvia", eventFont: "birthstone", moments: ["O sim"], tables: 0, createdAt: NOW - 5 * HOUR,
};

/** Painel mínimo como o shell: o evento vem do repositório e `refresh` o lê de novo; o quadro mostra o nome vigente. */
function Harness() {
  const [event, setEvent] = useState<MemoEvent>(base);
  const refresh = useCallback(async () => { const e = await app.repos.events.get("e1"); if (e) setEvent(e); }, []);
  useEffect(() => { let on = true; void app.repos.events.get("e1").then((e) => { if (on && e) setEvent(e); }); return () => { on = false; }; }, []);
  return (
    <AdminProvider value={{ event, now: NOW, photos: [], reactions: [], participants: [], refresh }}>
      <PainelFrame title="Ajustes" eventName={event.title} backHref="/painel/e1"><Configuracoes /></PainelFrame>
    </AdminProvider>
  );
}
const stored = async () => (await app.repos.events.get("e1"))!;

beforeEach(async () => {
  app.repos = createMemoryRepositories();
  await app.repos.events.save(base);
  m.push.mockClear();
  await new Promise((r) => setTimeout(r, 90)); // deixa a folha do teste anterior terminar de devolver a entrada do histórico
});

describe("Ajustes (painel) com repositório em memória", () => {
  it("Editar nome: digitar e salvar grava no repositório, a tela de trás mostra o novo nome e o aviso aparece", async () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Editar nome" }));
    const dlg = screen.getByRole("dialog", { name: "Editar nome" });
    fireEvent.change(within(dlg).getByLabelText("Nome do evento"), { target: { value: "Casamento da Ana" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar nome" }));
    await waitFor(async () => expect((await stored()).title).toBe("Casamento da Ana"));
    await waitFor(() => expect(container.querySelector(".pf-sub")?.textContent).toBe("Casamento da Ana"));
    expect(screen.queryByRole("dialog")).toBeNull();
    // o aviso fica visível (acima das folhas), anunciado como status
    const aviso = screen.getByText("Salvo.");
    expect(aviso.closest('[role="status"]')).not.toBeNull();
    const toast = aviso.closest("div[style]") as HTMLElement;
    const css = readFileSync(`${process.cwd()}/src/styles/app.css`, "utf8");
    const dialogZ = Number(/\.app-dialog \{[^}]*z-index: (\d+)/.exec(css)?.[1]);
    expect(Number((toast.parentElement as HTMLElement).style.zIndex)).toBeGreaterThan(dialogZ);
  });

  it("'Mais': salvar o nome do anfitrião confirma dentro da folha (role=status)", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /^Mais$/ }));
    const dlg = screen.getByRole("dialog", { name: "Mais ajustes" });
    fireEvent.change(within(dlg).getByLabelText("Seu nome (aparece no convite)"), { target: { value: "Ana Paula" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar seu nome" }));
    await waitFor(async () => expect((await stored()).hostName).toBe("Ana Paula"));
    const dentro = await within(dlg).findByText("Salvo.");
    expect(dentro.getAttribute("role")).toBe("status");
    expect(dlg.contains(dentro)).toBe(true);
  });

  it("Poses: escolher grava e confirma dentro da folha", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /^Poses/ }));
    const dlg = screen.getByRole("dialog", { name: "Poses por pessoa" });
    fireEvent.click(within(dlg).getByRole("group", { name: "Fotos por pessoa" }).querySelector("button:not([aria-pressed='true'])") as HTMLElement);
    await waitFor(async () => expect((await stored()).shotsPerPerson).not.toBe(24));
    expect(await within(dlg).findByText(/Salvo\.|permite/)).toBeTruthy();
  });

  it("ressincroniza o que foi digitado e não salvo a cada abertura da folha", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Editar nome" }));
    fireEvent.change(screen.getByLabelText("Nome do evento"), { target: { value: "rascunho" } });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Editar nome" }));
    expect(screen.getByLabelText("Nome do evento")).toHaveValue("Nosso casamento");
  });

  it("interruptor do feed: role=switch com nome, estado exposto e visível, e grava", async () => {
    render(<Harness />);
    const sw = screen.getByRole("switch", { name: "Feed com curtidas e comentários" });
    expect(sw.getAttribute("aria-checked")).toBe("true");
    expect(within(sw).getByText("Ligado")).toBeInTheDocument();
    fireEvent.click(sw);
    await waitFor(async () => expect((await stored()).reactionsEnabled).toBe(false));
    await waitFor(() => expect(screen.getByRole("switch", { name: "Feed com curtidas e comentários" }).getAttribute("aria-checked")).toBe("false"));
    expect(within(screen.getByRole("switch", { name: /Feed com curtidas/ })).getByText("Desligado")).toBeInTheDocument();
  });

  it("o botão voltar do navegador fecha a folha em vez de sair da tela", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Editar nome" }));
    expect((window.history.state as { mmSheet?: boolean } | null)?.mmSheet).toBe(true);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => { window.history.back(); await new Promise((r) => setTimeout(r, 30)); });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(m.push).not.toHaveBeenCalled();
  });

  it("Esc fecha só a folha de cima e devolve o foco ao gatilho", async () => {
    render(<Harness />);
    const gatilho = screen.getByRole("button", { name: "Editar nome" });
    gatilho.focus();
    fireEvent.click(gatilho);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(gatilho).toHaveFocus();
  });

  it("Embalagem, Filme e Plano continuam levando às telas próprias", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Trocar embalagem" }));
    fireEvent.click(screen.getByRole("button", { name: /^Filme/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Plano/ }));
    expect(m.push.mock.calls.map((c) => c[0])).toEqual(["/painel/e1/aparencia", "/painel/e1/aparencia", "/painel/e1/plano"]);
  });

  it("a folha rola por dentro, trava o fundo e tem alvos de 44 px (CSS)", () => {
    const css = readFileSync(`${process.cwd()}/src/styles/sheet-revela.css`, "utf8");
    expect(css).toMatch(/\.app-dialog-panel \{[^}]*overscroll-behavior: contain/);
    expect(css).toMatch(/min-height: 44px/);
    expect(css).toMatch(/\.app-dialog-foot \{[^}]*position: sticky/);
    expect(css).toContain("var(--sheet-vh");
    expect(readFileSync(`${process.cwd()}/src/styles/app.css`, "utf8")).toMatch(/\.app-dialog-panel \{[^}]*overflow-y: auto/);
  });

  it("travar a rolagem do fundo enquanto a folha está aberta", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Editar nome" }));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(document.body.style.overflow).not.toBe("hidden"));
  });
});

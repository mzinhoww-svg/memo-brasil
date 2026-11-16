import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoEvent } from "@/domain/event";
import { createMemoryRepositories } from "@/repositories";
import type { Repositories } from "@/repositories/types";

const HOUR = 3_600_000;
const NOW = 100 * HOUR;
const ev = (id: string, hostId: string, startAt: number, title: string): MemoEvent => ({
  id, code: `C${id}`, title, category: "casamento", hostId, hostName: "x", startAt, durationHours: 6,
  cameraStyle: "original", revealEnabled: false, revealAt: null, revealAnchor: "fim", revealOffsetDays: 0, revealedAt: null, version: 1, timezone: "UTC", revealStatus: "desativada", capacity: 50, shotsPerPerson: 24,
  everyoneSeesAll: true, reactionsEnabled: true, palette: "salvia", eventFont: "birthstone", moments: [], tables: 0, createdAt: startAt,
});

const signInWithGoogle = vi.fn();
const app = {
  ready: true, user: undefined as { id: string; name: string; createdAt: number } | undefined, backend: "supabase" as "local" | "supabase",
  canCreate: false, repos: createMemoryRepositories() as Repositories, now: () => NOW, signInWithGoogle,
};
vi.mock("@/features/app/provider", () => ({ useApp: () => app }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));

const { default: MeusEventos } = await import("./page");

beforeEach(() => {
  app.user = undefined; app.canCreate = false; app.repos = createMemoryRepositories(); signInWithGoogle.mockReset();
});

describe("Meus eventos (/eventos)", () => {
  it("sem sessão pede o login Google e não lista nada", async () => {
    render(<MeusEventos />);
    await userEvent.click(screen.getByRole("button", { name: /Google/ }));
    expect(signInWithGoogle).toHaveBeenCalledWith("/eventos");
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByRole("link", { name: "Entrar com código" })).toHaveAttribute("href", "/entrar");
  });

  it("organizador vê ativos antes de encerrados, só os próprios", async () => {
    app.user = { id: "u1", name: "Ana", createdAt: 1 }; app.canCreate = true;
    await app.repos.events.save(ev("e1", "u1", NOW - 50 * HOUR, "Festa antiga"));
    await app.repos.events.save(ev("e2", "u1", NOW - HOUR, "Festa de hoje"));
    await app.repos.events.save(ev("e3", "u2", NOW - HOUR, "Festa de outra pessoa"));
    render(<MeusEventos />);
    expect(await screen.findByRole("heading", { name: "Festa de hoje" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir câmera" })).toHaveAttribute("href", "/e/Ce2/agora");
    expect(screen.getByRole("link", { name: "QR code" })).toHaveAttribute("href", "/painel/e2/qr");
    const prateleira = screen.getByRole("link", { name: /Festa antiga/ });
    expect(prateleira).toHaveAttribute("href", "/painel/e1");
    expect(screen.queryByText("Festa de outra pessoa")).toBeNull();
  });

  it("organizador sem eventos vê o convite para criar", async () => {
    app.user = { id: "u1", name: "Ana", createdAt: 1 }; app.canCreate = true;
    render(<MeusEventos />);
    expect(await screen.findByText("Você ainda não criou nenhum evento.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar meu evento grátis" })).toHaveAttribute("href", "/criar");
  });

  it("falha ao carregar mostra erro com nova tentativa", async () => {
    app.user = { id: "u1", name: "Ana", createdAt: 1 }; app.canCreate = true;
    app.repos.events.list = async () => { throw new Error("rede"); };
    render(<MeusEventos />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não conseguimos carregar seus eventos");
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});

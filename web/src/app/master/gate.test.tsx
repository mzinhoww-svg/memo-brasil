// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformRole } from "@/lib/master/access";

const m = vi.hoisted(() => ({ session: vi.fn(), printed: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("@/lib/master/server", () => ({ masterAccess: m.session, printedAlbumOn: m.printed }));
import { requirePrintedAlbum, requireRole } from "./gate";

const as = (role: PlatformRole | null, access: "ok" | "forbidden" | "anonymous" | "local" = role ? "ok" : "forbidden") =>
  m.session.mockResolvedValue({ access, role, sb: access === "ok" ? { tag: "sb" } : null, user: { name: "x" } });
beforeEach(() => { m.session.mockReset(); m.printed.mockReset(); });

describe("requireRole: permissão por papel nas áreas do /master", () => {
  it("master abre qualquer área", async () => {
    as("master");
    for (const area of ["pagamentos", "planos", "configuracoes", "auditoria", "cortesias"] as const) expect(await requireRole(area)).toMatchObject({ role: "master" });
  });
  it("support e auditor: áreas só do master mostram a M32 (acesso limitado) e não entregam o cliente", async () => {
    for (const role of ["support", "auditor"] as const) {
      as(role);
      const g = await requireRole("pagamentos");
      expect("denied" in g).toBe(true);
      expect("sb" in g).toBe(false);
      const { unmount } = render(<>{"denied" in g ? g.denied : null}</>);
      expect(screen.getByRole("heading", { name: "Acesso limitado" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: `Seu papel é ${role}` })).toBeTruthy();
      expect(screen.getByText("Esta área é só para master")).toBeTruthy();
      unmount();
    }
  });
  it("auditoria: auditor entra, support vê a M32 com a legenda 'master e auditor'", async () => {
    as("auditor");
    expect(await requireRole("auditoria")).toMatchObject({ role: "auditor" });
    as("support");
    const g = await requireRole("auditoria");
    render(<>{"denied" in g ? g.denied : null}</>);
    expect(screen.getByText("Esta área é só para master e auditor")).toBeTruthy();
  });
  it("áreas de leitura (eventos, pessoas) abrem para os três papéis", async () => {
    for (const role of ["master", "support", "auditor"] as const) {
      as(role);
      expect(await requireRole("eventos")).toMatchObject({ role });
      expect(await requireRole("pessoas")).toMatchObject({ role });
    }
  });
  it("sem papel, anônimo ou modo local: 404", async () => {
    for (const [role, access] of [[null, "forbidden"], [null, "anonymous"], [null, "local"]] as const) {
      as(role, access);
      await expect(requireRole("eventos")).rejects.toThrow("NEXT_NOT_FOUND");
    }
  });
});

describe("requirePrintedAlbum: /master/impressoes* só com a chave printed_album", () => {
  it("chave desligada: 404, mesmo para master", async () => {
    as("master");
    m.printed.mockResolvedValue(false);
    await expect(requirePrintedAlbum()).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("chave ligada: master entra", async () => {
    as("master");
    m.printed.mockResolvedValue(true);
    expect(await requirePrintedAlbum()).toMatchObject({ role: "master" });
  });
  it("chave ligada: support vê a M32, nunca a lista", async () => {
    as("support");
    m.printed.mockResolvedValue(true);
    expect("denied" in (await requirePrintedAlbum())).toBe(true);
  });
});

import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRepositories, RepositoryError } from "@/repositories";
import type { GuestCtx } from "@/features/events/guest-context";
import type { Repositories } from "@/repositories";
import type { MemoEvent } from "@/domain/event";
import { createEvent, type EventInput } from "@/features/events/service";
import Postar from "@/app/e/[code]/(app)/postar/page";
import { loadPhotoDraft, savePhotoDraft } from "./draft";
const ctx = vi.hoisted(() => ({
  guest: undefined as unknown as Pick<GuestCtx, "event" | "user" | "participant" | "now" | "counts" | "refresh">,
  app: undefined as unknown as { repos: Repositories; now: () => number },
}));
vi.mock("@/features/app/provider", () => ({ useApp: () => ctx.app }));
vi.mock("@/features/events/guest-context", () => ({ useGuest: () => ctx.guest }));
vi.mock("./capture", async (original) => ({ ...await original<typeof import("./capture")>(), fileToImage: async () => ({ naturalWidth: 5, naturalHeight: 5 }), renderPhoto: async () => ({ bytes: new Uint8Array([1, 2]).buffer, type: "image/jpeg" }) }));
const now = 1_800_000_000_000;
let fixture: { event: MemoEvent; user: { id: string; name: string; createdAt: number } };
let repos: ReturnType<typeof createMemoryRepositories>;
const data = { bytes: new Uint8Array([1, 2]).buffer, type: "image/jpeg" };
beforeEach(async () => {
  const user = { id: crypto.randomUUID(), name: "Ana", createdAt: 1 };
  repos = createMemoryRepositories();
  const r = await createEvent(repos, user, { title: "Festa", category: "festa", durationHours: 3, reveal: { enabled: false }, cameraStyle: "original", capacity: 10, shotsPerPerson: 5, everyoneSeesAll: false, palette: "salvia", eventFont: "birthstone" } as EventInput, now);
  if (!r.ok) throw new Error("fixture");
  fixture = { event: r.event, user };
  ctx.app = { repos, now: () => now };
  ctx.guest = { ...fixture, participant: undefined, now, counts: { mine: 0, total: 0 }, refresh: async () => {} };
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function choose() {
  await screen.findByText("Sem câmera por aqui");
  fireEvent.change(screen.getByLabelText("Escolher foto do aparelho"), { target: { files: [new File(["x"], "f.jpg", { type: "image/jpeg" })] } });
  await screen.findByAltText("Prévia da sua foto");
}
describe("envio resiliente na tela", () => {
  it("retoma explicitamente após remount com bytes, legenda e mesma reserva; limpa ao enviar", async () => {
    const photoId = crypto.randomUUID();
    await savePhotoDraft({ eventId: fixture.event.id, userId: fixture.user.id, createdAt: now, photoId, data, caption: "Continuar aqui", moment: "Agora", attempted: true, failures: 1 });
    const view = render(<Postar />);
    await screen.findByText("Você tem uma pose sem confirmação");
    expect(screen.queryByAltText("Prévia da sua foto")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retomar foto" }));
    await screen.findByDisplayValue("Continuar aqui");
    view.unmount();
    render(<Postar />);
    fireEvent.click(await screen.findByRole("button", { name: "Retomar foto" }));
    fireEvent.click(await screen.findByRole("button", { name: "Tentar agora" }));
    await screen.findByText("Foi para o laboratório");
    expect((await repos.photos.listByEvent(fixture.event.id))[0].id).toBe(photoId);
    expect((await loadPhotoDraft(fixture.event.id, fixture.user.id, now)).draft).toBeUndefined();
  });
  it("trocar usuário não expõe bytes nem legenda de outra identidade", async () => {
    const ana = ctx.guest;
    const view = render(<Postar />); await choose();
    fireEvent.change(screen.getByLabelText("Legenda (opcional)"), { target: { value: "Só Ana" } });
    await waitFor(async () => expect((await loadPhotoDraft(fixture.event.id, fixture.user.id, now)).draft?.caption).toBe("Só Ana"));
    ctx.guest = { ...ana, user: { id: "beto", name: "Beto", createdAt: 1 } };
    view.rerender(<Postar />);
    await screen.findByText("Sem câmera por aqui");
    expect(screen.queryByDisplayValue("Só Ana")).toBeNull();
    expect(screen.queryByAltText("Prévia da sua foto")).toBeNull();
    ctx.guest = ana;
    view.rerender(<Postar />);
    await screen.findByRole("button", { name: "Retomar foto" });
  });
  it("salva seleção/legenda e oferece descarte que apaga o rascunho", async () => {
    const view = render(<Postar />);
    await choose();
    fireEvent.change(screen.getByLabelText("Legenda (opcional)"), { target: { value: "Não perder" } });
    await waitFor(async () => expect((await loadPhotoDraft(fixture.event.id, fixture.user.id, now)).draft?.caption).toBe("Não perder"));
    view.unmount(); render(<Postar />);
    fireEvent.click(await screen.findByRole("button", { name: "Descartar foto" }));
    await waitFor(async () => expect((await loadPhotoDraft(fixture.event.id, fixture.user.id, now)).draft).toBeUndefined());
  });
  it("rejeição inesperada volta a estado recuperável e refresh falho não desfaz sucesso", async () => {
    vi.spyOn(repos.events, "counts").mockRejectedValueOnce(new Error("unexpected"));
    render(<Postar />); await choose();
    fireEvent.click(screen.getByRole("button", { name: "Mandar para o laboratório" }));
    await screen.findByText("Não deu para enviar a foto. Tente de novo.");
    ctx.guest.refresh = async () => { throw new RepositoryError("unavailable", "offline"); };
    fireEvent.click(screen.getByRole("button", { name: "Mandar para o laboratório" }));
    await screen.findByText("Foi para o laboratório");
  });
  it("bloqueio do organizador encerra o envio sem agendar retry", async () => {
    const denial = new RepositoryError("forbidden", "blocked");
    Object.defineProperty(denial, "code", { value: "blocked" });
    vi.spyOn(repos.photos, "begin").mockRejectedValue(denial);
    render(<Postar />); await choose();
    fireEvent.click(screen.getByRole("button", { name: "Mandar para o laboratório" }));
    await screen.findByText("Seu acesso para postar foi bloqueado pelo organizador.");
    expect(screen.queryByRole("button", { name: "Mandar para o laboratório" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tentar agora" })).toBeNull();
    await waitFor(async () => expect((await loadPhotoDraft(fixture.event.id, fixture.user.id, now)).draft?.denial).toMatch(/bloqueado/));
  });
  it.each(["Voltar", "Avançar"])("cancela %s antes da travessia sem alterar histórico ou URL", async (direction) => {
    const navigation = new EventTarget();
    vi.stubGlobal("navigation", navigation);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const go = vi.spyOn(window.history, "go");
    const url = window.location.href;
    render(<Postar />); await choose();
    fireEvent.click(screen.getByRole("link", { name: "Fechar" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    const event = new Event("navigate", { cancelable: true });
    Object.assign(event, { navigationType: "traverse", destination: { index: direction === "Voltar" ? 0 : 2 } });
    navigation.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(go).not.toHaveBeenCalled();
    expect(window.location.href).toBe(url);
    confirm.mockReturnValue(true);
    const accepted = new Event("navigate", { cancelable: true });
    Object.assign(accepted, { navigationType: "traverse" });
    navigation.dispatchEvent(accepted);
    expect(accepted.defaultPrevented).toBe(false);
  });
  it("sem Navigation API mantém popstate e router alinhados e preserva rascunho", async () => {
    vi.stubGlobal("navigation", undefined);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
    render(<Postar />); await choose();
    await waitFor(async () => expect((await loadPhotoDraft(fixture.event.id, fixture.user.id, now)).draft).toBeDefined());
    const router = vi.fn();
    window.addEventListener("popstate", router);
    try {
      window.dispatchEvent(new PopStateEvent("popstate"));
      expect(router).toHaveBeenCalledTimes(1);
      expect(go).not.toHaveBeenCalled();
    } finally { window.removeEventListener("popstate", router); }
  });
  it.each(["salvo", "retomado", "tirar outra", "bloqueado"])("descarte %s preserva foto publicada quando a resposta de finalize se perde", async (path) => {
    const finalize = repos.photos.finalize;
    const begin = vi.spyOn(repos.photos, "begin");
    vi.spyOn(repos.photos, "finalize").mockImplementation(async (id) => {
      await finalize(id);
      throw new RepositoryError("unavailable", "resposta perdida");
    });
    const view = render(<Postar />); await choose();
    fireEvent.click(screen.getByRole("button", { name: "Mandar para o laboratório" }));
    await screen.findByText("Sem sinal");
    const photoId = (await repos.photos.listByEvent(fixture.event.id))[0].id;
    if (path !== "tirar outra") {
      view.unmount(); render(<Postar />);
      await screen.findByRole("button", { name: "Retomar foto" });
      expect(begin).toHaveBeenCalledTimes(1);
      if (path !== "salvo") {
        fireEvent.click(screen.getByRole("button", { name: "Retomar foto" }));
        await screen.findByRole("button", { name: "Tentar agora" });
        if (path === "bloqueado") {
          begin.mockRejectedValue(new RepositoryError("forbidden", "denied"));
          fireEvent.click(screen.getByRole("button", { name: "Tentar agora" }));
          await screen.findByText("Você não tem acesso para postar neste evento.");
        }
      }
    }
    expect(screen.getByText(/Descartar apaga apenas o rascunho neste aparelho/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: path === "salvo" || path === "bloqueado" ? "Descartar foto" : "Descartar e tirar outra" }));
    await screen.findByText("Sem câmera por aqui");
    expect((await repos.photos.get(photoId))?.uploadStatus).toBe("pronta");
    expect((await loadPhotoDraft(fixture.event.id, fixture.user.id, now)).draft).toBeUndefined();
  });
  it("erro inesperado após finalize mantém identidade no retry manual", async () => {
    const finalize = repos.photos.finalize;
    let fail = true;
    vi.spyOn(repos.photos, "finalize").mockImplementation(async (id) => {
      const result = await finalize(id);
      if (fail) { fail = false; throw new Error("resposta perdida"); }
      return result;
    });
    const begin = vi.spyOn(repos.photos, "begin");
    render(<Postar />); await choose();
    fireEvent.click(screen.getByRole("button", { name: "Mandar para o laboratório" }));
    await screen.findByText("Não deu para enviar a foto. Tente de novo.");
    const originalId = begin.mock.calls[0][0].id;
    fireEvent.click(screen.getByRole("button", { name: "Mandar para o laboratório" }));
    await screen.findByText("Foi para o laboratório");
    expect(begin.mock.calls[1][0].id).toBe(originalId);
    expect(await repos.photos.listByEvent(fixture.event.id)).toHaveLength(1);
  });
  it("revoga a prévia depois de publicar", async () => {
    render(<Postar />); await choose();
    fireEvent.click(screen.getByRole("button", { name: "Mandar para o laboratório" }));
    await screen.findByText("Foi para o laboratório");
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview"));
  });
  it("falha de armazenamento é honesta e guarda recarga de foto não enviada", async () => {
    vi.stubGlobal("indexedDB", undefined);
    render(<Postar />); await choose();
    await screen.findByText(/Não foi possível salvar o rascunho neste aparelho/);
    const event = new Event("beforeunload", { cancelable: true });
    act(() => window.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Tirar outra" }));
    await screen.findByText("Sem câmera por aqui");
    expect(screen.queryByAltText("Prévia da sua foto")).toBeNull();
  });
});

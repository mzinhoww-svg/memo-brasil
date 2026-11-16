import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guest: {} as Record<string, unknown>,
  urls: {} as Record<string, string>,
  usePhotoUrls: vi.fn(),
}));
vi.mock("@/features/events/guest-context", () => ({ useGuest: () => mocks.guest }));
vi.mock("@/features/app/hooks", () => ({ usePhotoUrls: (...a: unknown[]) => { mocks.usePhotoUrls(...a); return mocks.urls; } }));
vi.mock("@/features/photos/pose-times", () => ({ myPoseTimes: async (_e: unknown, id: string, photos: { authorId: string; createdAt: number }[]) => photos.filter((p) => p.authorId === id).map((p) => p.createdAt) }));
vi.mock("@/features/photos/roll-picker", () => ({ useRollPicker: () => ({ open: () => undefined }) }));
vi.mock("@/revela/GuestTabs", () => ({ GuestTabs: () => null }));
import Minhas from "./page";

const photo = (id: string, authorId: string, createdAt: number, extra: Record<string, unknown> = {}) => ({ id, eventId: "e1", authorId, authorName: "x", createdAt, moment: "", status: "visivel", reports: 0, highlighted: false, version: 1, uploadStatus: "pronta", ...extra });
const base = (revealStatus: string, photos: ReturnType<typeof photo>[]) => ({
  event: { id: "e1", code: "ABCD2345", shotsPerPerson: 10, timezone: "America/Cuiaba" },
  user: { id: "me" }, photos, counts: { mine: photos.filter((p) => p.authorId === "me").length, total: photos.length }, revealStatus,
});

describe("Minhas poses", () => {
  beforeEach(() => { mocks.urls = {}; mocks.usePhotoUrls.mockClear(); });

  it("revelada: cada foto da própria pessoa vira miniatura, na ordem das poses, e as dos outros ficam de fora", async () => {
    mocks.urls = { b: "https://x/b.thumb", a: "https://x/a.thumb" };
    mocks.guest = base("revelada", [photo("b", "me", 2000), photo("o", "other", 1500), photo("a", "me", 1000), photo("rem", "me", 3000, { status: "removida" })]);
    render(<Minhas />);
    const fotos = await screen.findAllByTestId("minha-foto");
    expect(fotos).toHaveLength(2);
    expect(fotos.map((f) => f.querySelector("img")?.getAttribute("src"))).toEqual(["https://x/a.thumb", "https://x/b.thumb"]);
    expect(screen.getByText(/Aqui estão as suas fotos reveladas\./)).toBeInTheDocument();
    const asked = mocks.usePhotoUrls.mock.calls.at(-1)!;
    expect((asked[0] as { id: string }[]).map((p) => p.id)).toEqual(["a", "b"]);
    expect(asked[1]).toBe("thumb");
  });

  it("revelada, miniatura ainda carregando: a pose fica com o papel de espera, sem imagem quebrada", async () => {
    mocks.urls = { a: "https://x/a.thumb" };
    mocks.guest = base("revelada", [photo("a", "me", 1000), photo("b", "me", 2000)]);
    const { container } = render(<Minhas />);
    await screen.findAllByTestId("minha-foto");
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelectorAll(".rv-print--back")).toHaveLength(1);
  });

  it("antes da revelação: só o papel de espera, nenhuma URL é pedida", async () => {
    mocks.guest = base("pendente", [photo("a", "me", 1000)]);
    const { container } = render(<Minhas />);
    expect(await screen.findByText(/Elas viram foto na revelação\./)).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect((mocks.usePhotoUrls.mock.calls.at(-1)![0] as unknown[]).length).toBe(0);
  });
});

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useCallback, useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoEvent } from "@/domain/event";
import type { Photo } from "@/domain/photo";
import { PainelFrame } from "@/components/revela/PainelFrame";
import { AdminProvider } from "@/features/admin/context";
import { createMemoryRepositories } from "@/repositories";
import type { Repositories } from "@/repositories/types";

const m = vi.hoisted(() => ({ push: vi.fn(), noUrl: new Set<string>() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("@/features/moderation/use-report-reasons", () => ({ useReportReasons: () => ({ photos: { p2: { improprio: 2 } }, comments: {} }) }));
const app = { repos: createMemoryRepositories() as Repositories, now: () => NOW };
vi.mock("@/features/app/provider", () => ({ useApp: () => app }));
vi.mock("@/features/app/hooks", async (orig) => ({
  ...(await orig<typeof import("@/features/app/hooks")>()),
  usePhotoUrls: (photos: Photo[], size = "full") => Object.fromEntries(photos.filter((p) => !m.noUrl.has(p.id)).map((p) => [p.id, `data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==#${size}-${p.id}`])),
}));

const { default: Conteudo } = await import("./page");

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 2, 14, 22, 0);
const event = (over: Partial<MemoEvent> = {}): MemoEvent => ({
  id: "e1", code: "ABC", title: "Nosso casamento", category: "casamento", hostId: "h", hostName: "Ana", startAt: NOW - 4 * HOUR, durationHours: 6,
  cameraStyle: "festa", revealEnabled: true, revealAt: NOW + HOUR, revealAnchor: "fim", revealOffsetDays: 0, revealedAt: null, version: 1, timezone: "UTC", revealStatus: "pendente",
  capacity: 50, shotsPerPerson: 24, everyoneSeesAll: true, reactionsEnabled: true, palette: "salvia", eventFont: "birthstone", moments: ["O sim"], tables: 0, createdAt: NOW - 5 * HOUR, ...over,
});
const photo = (id: string, author: string, min: number, over: Partial<Photo> = {}): Photo => ({
  id, eventId: "e1", authorId: author.toLowerCase(), authorName: `${author} Souza`, createdAt: Date.UTC(2026, 2, 14, 21, min), moment: "O sim", status: "visivel", reports: 0, highlighted: false, version: 1, uploadStatus: "pronta", ...over,
});
const seed = async (list: Photo[]) => { for (const p of list) await app.repos.photos.add(p, { bytes: new Uint8Array([1, 2]).buffer, type: "image/jpeg" }); };

/** Painel mínimo: o quadro real, o contexto do admin e `refresh` lendo o repositório em memória. */
function Harness({ ev }: { ev: MemoEvent }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const refresh = useCallback(async () => { setPhotos(await app.repos.photos.listByEvent("e1")); }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return (
    <AdminProvider value={{ event: ev, now: NOW, photos, reactions: [], participants: [], refresh }}>
      <PainelFrame title="Conteúdo" eventName={ev.title} backHref="/painel/e1"><Conteudo /></PainelFrame>
    </AdminProvider>
  );
}
const tiles = () => screen.getAllByRole("listitem");

beforeEach(() => { app.repos = createMemoryRepositories(); m.push.mockClear(); m.noUrl.clear(); });

describe("Conteúdo (painel)", () => {
  it("3 fotos: título único, contagem, autor e hora, dica e situação da revelação em texto", async () => {
    await seed([photo("p1", "Ana", 42), photo("p2", "Bia", 40), photo("p3", "Leo", 31, { status: "oculta" })]);
    render(<Harness ev={event()} />);
    await screen.findByText("3 fotos · 1 removida");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Conteúdo");
    expect(screen.getByText("Toque numa foto para ver e tirar do álbum.")).toBeInTheDocument();
    expect(screen.getByText("Revela às 23:00")).toBeInTheDocument();
    expect(screen.queryByText("REVELADA")).toBeNull();
    const caps = tiles().map((li) => li.querySelector(".cont-cap")?.textContent);
    expect(caps).toEqual(["Ana · 21:42", "Bia · 21:40", "Leo · 21:31"]);
    expect(screen.getByText("Removida")).toBeInTheDocument(); // marca visual em texto
    expect(screen.getByText("Denunciada")).toBeInTheDocument();
  });

  it("revelação em outro dia diz o dia", async () => {
    await seed([photo("p1", "Ana", 42)]);
    render(<Harness ev={event({ revealAt: NOW + 3 * HOUR })} />);
    expect(await screen.findByText(/^Revela dom.*15.*01:00$/)).toBeInTheDocument();
  });

  it("revelação desligada aparece como texto claro", async () => {
    await seed([photo("p1", "Ana", 42)]);
    render(<Harness ev={event({ revealEnabled: false, revealStatus: "desativada" })} />);
    expect(await screen.findByText("Fotos na hora")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revelar agora" })).toBeNull();
  });

  it("filtros por chip com contagem e por pessoa", async () => {
    await seed([photo("p1", "Ana", 42), photo("p2", "Bia", 40), photo("p3", "Leo", 31, { status: "oculta" }), photo("p4", "Ana", 20)]);
    render(<Harness ev={event()} />);
    await screen.findByText("4 fotos · 1 removida");
    const chips = within(screen.getByRole("group", { name: "Filtrar fotos" }));
    expect(chips.getByRole("button", { name: /Todas\s+4/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(chips.getByRole("button", { name: /Removidas/ }));
    expect(tiles()).toHaveLength(1);
    fireEvent.click(chips.getByRole("button", { name: /Denunciadas/ }));
    expect(tiles().map((li) => li.querySelector(".cont-cap")?.textContent)).toEqual(["Bia · 21:40"]);
    fireEvent.click(chips.getByRole("button", { name: /Todas/ }));
    fireEvent.change(screen.getByLabelText("Por pessoa"), { target: { value: "ana" } });
    expect(tiles()).toHaveLength(2);
  });

  it("tocar numa foto abre a visualização grande com as ações; tirar e devolver do álbum atualizam a contagem", async () => {
    await seed([photo("p1", "Ana", 42), photo("p2", "Bia", 40)]);
    render(<Harness ev={event()} />);
    await screen.findByText("2 fotos · 0 removidas");
    fireEvent.click(screen.getByRole("button", { name: /Foto de Ana.*21:42/ }));
    const dlg = screen.getByRole("dialog", { name: "Foto de Ana Souza" });
    expect(within(dlg).getByRole("img", { name: "Foto de Ana Souza" }).getAttribute("src")).toContain("#full-p1");
    fireEvent.click(within(dlg).getByRole("button", { name: "Tirar do álbum" }));
    await screen.findByText("2 fotos · 1 removida");
    expect((await app.repos.photos.get("p1"))?.status).toBe("oculta");
    fireEvent.click(screen.getByRole("button", { name: /Foto de Ana.*removida do álbum/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Devolver ao álbum" }));
    await screen.findByText("2 fotos · 0 removidas");
    expect((await app.repos.photos.get("p1"))?.status).toBe("visivel");
  });

  it("destacar e excluir (com confirmação)", async () => {
    await seed([photo("p1", "Ana", 42), photo("p2", "Bia", 40)]);
    render(<Harness ev={event()} />);
    await screen.findByText("2 fotos · 0 removidas");
    fireEvent.click(screen.getByRole("button", { name: /Foto de Ana/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Destacar" }));
    await waitFor(async () => expect((await app.repos.photos.get("p1"))?.highlighted).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /Foto de Ana/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Excluir a foto" }));
    const confirm = screen.getByRole("dialog", { name: "Excluir esta foto?" });
    expect((await app.repos.photos.get("p1"))?.status).toBe("visivel"); // nada some antes de confirmar
    fireEvent.click(within(confirm).getByRole("button", { name: "Excluir foto" }));
    await screen.findByText("1 foto · 0 removidas");
    expect(tiles()).toHaveLength(1);
  });

  it("sem fotos: estado vazio com ícone e ação para compartilhar o QR", async () => {
    render(<Harness ev={event()} />);
    expect(await screen.findByText(/Ainda sem fotos/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filtrar fotos" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Compartilhar o QR" }));
    expect(m.push).toHaveBeenCalledWith("/painel/e1/compartilhar");
  });

  it("esqueleto enquanto a URL não chega e 'não carregou' com tentar de novo se a imagem falhar", async () => {
    await seed([photo("p1", "Ana", 42), photo("p2", "Bia", 40)]);
    m.noUrl.add("p1");
    const { container } = render(<Harness ev={event()} />);
    await screen.findByText("2 fotos · 0 removidas");
    expect(container.querySelectorAll(".cont-skel")).toHaveLength(1);
    expect(container.querySelector('img[src^="data:image/gif;base64,R0lGODlhAQAB"][src*="#thumb-p1"]')).toBeNull(); // nada de GIF transparente no lugar
    const img = within(tiles()[1]).getByRole("img");
    fireEvent.error(img);
    expect(within(tiles()[1]).getByText("Não carregou")).toBeInTheDocument();
    fireEvent.click(within(tiles()[1]).getByRole("button", { name: "Tentar de novo" }));
    expect(within(tiles()[1]).getByRole("img")).toBeInTheDocument();
  });

  it("'Revelar agora' fica no rodapé fixo do quadro enquanto a revelação está pendente", async () => {
    await seed([photo("p1", "Ana", 42)]);
    const { container } = render(<Harness ev={event()} />);
    const btn = await screen.findByRole("button", { name: "Revelar agora" });
    expect(container.querySelector(".pf-foot")?.contains(btn)).toBe(true);
    await act(async () => { fireEvent.click(btn); });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("grade de 2 colunas no celular e 3 a partir de 480 px (regra de CSS)", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(`${process.cwd()}/src/styles/painel-frame.css`, "utf8");
    expect(css).toMatch(/\.cont-grid \{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/@media \(min-width: 480px\) \{ \.cont-grid \{[^}]*repeat\(3,/);
  });
});

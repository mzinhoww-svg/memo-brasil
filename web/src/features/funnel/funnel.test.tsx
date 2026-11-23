import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLead, formatRemaining, isLeadId, LEAD_KEY, readLead, viewLead, type LeadView } from "./api";
import { Oferta } from "./Oferta";
import { Quiz } from "./Quiz";
import { PROFILES, QUIZZES, quizBySlug, scoreQuiz } from "./quizzes";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const LEAD = "11111111-2222-4333-8444-555555555555";
const view = (over: Partial<LeadView> = {}): LeadView => ({
  quiz: "sinais", profile: "pista", guests: 130, expiresAtMs: Date.now() + 20 * 60_000, clockOffsetMs: 0, active: true,
  planCode: "ate50", priceCents: 1990, maxGuests: 50, maxShots: 36, claimed: false, eventId: null, paid: false, ...over,
});

beforeEach(() => { localStorage.clear(); push.mockReset(); });

describe("quizzes", () => {
  it("são 5 portas, uma por nível de consciência, com slugs que cabem no lead", () => {
    expect(QUIZZES.map((q) => q.level).sort()).toEqual([1, 2, 3, 4, 5]);
    for (const q of QUIZZES) {
      expect(q.slug).toMatch(/^[a-z0-9-]{1,40}$/);
      expect(q.questions.some((x) => x.options.some((o) => o.guests))).toBe(true); // todo quiz pergunta o tamanho da festa
      expect(new Set(q.questions.map((x) => x.id)).size).toBe(q.questions.length);
      for (const x of q.questions) expect(new Set(x.options.map((o) => o.id)).size).toBe(x.options.length);
    }
    expect(Object.keys(PROFILES).every((p) => /^[a-z0-9-]{1,40}$/.test(p))).toBe(true);
  });

  it("perfil é o mais votado, convidados vêm da faixa e o checklist vira pontuação", () => {
    const sinais = quizBySlug("sinais")!;
    const r = scoreQuiz(sinais, { sinais: ["pista", "ninguem", "longe"], convidados: ["ate150"] });
    expect(r).toEqual({ profile: "pista", guests: 130, score: 3, lostPhotos: 1560 });
    expect(scoreQuiz(sinais, {}).profile).toBe(sinais.fallbackProfile);
  });
});

describe("api (modo local)", () => {
  it("cria o lead com 30 minutos, guarda o id e a oferta vence no prazo", async () => {
    const t0 = 1_800_000_000_000;
    const lead = await createLead({ quiz: "rapido", profile: "espalhadas", guests: 40, whatsapp: true }, t0);
    expect(isLeadId(lead.leadId)).toBe(true);
    expect(localStorage.getItem(LEAD_KEY)).toBe(lead.leadId);
    expect(readLead()).toBe(lead.leadId);
    expect((await viewLead(lead.leadId, t0 + 29 * 60_000))?.active).toBe(true);
    expect((await viewLead(lead.leadId, t0 + 30 * 60_000))?.active).toBe(false);
    expect(await viewLead(LEAD, t0)).toBeNull();
  });

  it("formata o tempo que resta sem ficar negativo", () => {
    expect(formatRemaining(30 * 60_000)).toBe("30:00");
    expect(formatRemaining(61_500)).toBe("01:02");
    expect(formatRemaining(-5)).toBe("00:00");
  });
});

describe("Quiz", () => {
  it("responde, cria o lead com o perfil e oferece o WhatsApp antes do resultado", async () => {
    const create = vi.fn().mockResolvedValue({ leadId: LEAD, expiresAt: new Date().toISOString(), waLink: "https://wa.me/5565000000000?text=oi" });
    const user = userEvent.setup();
    render(<Quiz quiz={quizBySlug("rapido")!} create={create} />);
    await user.click(screen.getByRole("button", { name: "De 101 a 150" }));
    await user.click(screen.getByRole("button", { name: "Em até 3 meses" }));
    await waitFor(() => expect(screen.getByTestId("funil-contato")).toBeInTheDocument());
    expect(create).toHaveBeenCalledWith({ quiz: "rapido", profile: "espalhadas", guests: 130, whatsapp: true });
    expect(screen.getByTestId("funil-whatsapp")).toHaveAttribute("href", "https://wa.me/5565000000000?text=oi");
    expect(screen.getByRole("link", { name: "Ver o resultado aqui mesmo" })).toHaveAttribute("href", `/oferta?l=${LEAD}`);
  });

  it("sem WhatsApp disponível, abre o resultado direto", async () => {
    const create = vi.fn().mockResolvedValue({ leadId: LEAD, expiresAt: new Date().toISOString(), waLink: null });
    const user = userEvent.setup();
    render(<Quiz quiz={quizBySlug("rapido")!} create={create} />);
    await user.click(screen.getByRole("button", { name: "Até 50" }));
    await user.click(screen.getByRole("button", { name: "Neste mês" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/oferta?l=${LEAD}`));
  });

  it("falha ao criar o lead mostra o erro e deixa tentar de novo", async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValue({ leadId: LEAD, expiresAt: new Date().toISOString(), waLink: null });
    const user = userEvent.setup();
    render(<Quiz quiz={quizBySlug("rapido")!} create={create} />);
    await user.click(screen.getByRole("button", { name: "Até 50" }));
    await user.click(screen.getByRole("button", { name: "Neste mês" }));
    await user.click(await screen.findByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/oferta?l=${LEAD}`));
  });
});

describe("Oferta", () => {
  it("dentro do prazo: devolve o resultado, mostra o relógio e leva a criar com o plano da oferta", async () => {
    render(<Oferta leadParam={LEAD} view={vi.fn().mockResolvedValue(view())} create={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Seu perfil: Pista sem Registro" })).toBeInTheDocument();
    expect(screen.getByText(/1\.560 fotos/)).toBeInTheDocument();
    expect(screen.getByTestId("funil-relogio")).toHaveTextContent(/A oferta acaba em (19:5\d|20:00)/);
    expect(screen.getByRole("link", { name: "Destravar por R$ 19,90 no Pix" })).toHaveAttribute("href", "/criar?plano=ate50");
    expect(screen.getByText(/Sua festa passa de 50\?/)).toBeInTheDocument();
    expect(localStorage.getItem(LEAD_KEY)).toBe(LEAD);
  });

  it("vencida: some o preço de oferta e fica o caminho normal", async () => {
    render(<Oferta leadParam={LEAD} view={vi.fn().mockResolvedValue(view({ active: false, expiresAtMs: Date.now() - 1000 }))} create={vi.fn()} />);
    expect(await screen.findByTestId("funil-vencida")).toBeInTheDocument();
    expect(screen.queryByTestId("funil-relogio")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Montar a câmera grátis" })).toHaveAttribute("href", "/criar");
  });

  it("sem lead (link direto): cria um lead na hora, sem pedir WhatsApp", async () => {
    const create = vi.fn().mockResolvedValue({ leadId: LEAD, expiresAt: new Date().toISOString(), waLink: null });
    const viewFn = vi.fn().mockResolvedValue(view({ quiz: "direto", profile: null, guests: null }));
    render(<Oferta leadParam={null} view={viewFn} create={create} />);
    expect(await screen.findByTestId("funil-oferta")).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith({ quiz: "direto", profile: null, guests: null, whatsapp: false });
    expect(viewFn).toHaveBeenCalledWith(LEAD);
  });

  it("já paga: confirma e não oferece pagar de novo", async () => {
    render(<Oferta leadParam={LEAD} view={vi.fn().mockResolvedValue(view({ paid: true, claimed: true, eventId: "e1" }))} create={vi.fn()} />);
    expect(await screen.findByText(/Tudo certo/)).toBeInTheDocument();
    expect(screen.queryByText(/Destravar/)).not.toBeInTheDocument();
  });
});

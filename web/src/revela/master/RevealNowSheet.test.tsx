// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RevealNowSheet, revealFailureOf, REVEAL_MESSAGES, type RevealOutcome } from "./RevealNowSheet";

afterEach(cleanup);
const props = { eventId: "e1", eventTitle: "Ana & Leo", plannedAt: "dom, 15 mar 2027 12:00", notices: "21 e-mails, de uma vez", inline: true };
const motivo = () => screen.getByLabelText("Motivo") as HTMLTextAreaElement;
const type = (v: string) => fireEvent.change(motivo(), { target: { value: v } });
const reveal = () => screen.getByRole("button", { name: "Revelar mesmo assim" }) as HTMLButtonElement;
const send = (r: RevealOutcome) => vi.fn(async () => r);

describe("RevealNowSheet (M25)", () => {
  it("mostra evento, hora prevista, avisos, o alerta e 'Manter a hora' como botão de saída", () => {
    render(<RevealNowSheet {...props} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Revelar agora" })).toBeTruthy();
    for (const t of ["Ana & Leo", "dom, 15 mar 2027 12:00", "21 e-mails, de uma vez"]) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getByText("Revelar antes tira a graça: os convidados estão esperando a hora combinada. Não dá para desfazer.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manter a hora" })).toBeTruthy();
  });
  it("sem avisos conhecidos (painel do anfitrião) a linha some", () => {
    render(<RevealNowSheet {...props} notices={undefined} onClose={vi.fn()} />);
    expect(screen.queryByText("Avisos que serão enviados")).toBeNull();
  });
  it("'Revelar mesmo assim' fica desligado com motivo menor que 10 e maior que 500", () => {
    render(<RevealNowSheet {...props} onClose={vi.fn()} />);
    expect(reveal().disabled).toBe(true);
    type("123456789");
    expect(reveal().disabled).toBe(true);
    type("1234567890");
    expect(reveal().disabled).toBe(false);
    type("x".repeat(501));
    expect(reveal().disabled).toBe(true);
  });
  it("revelar envia o evento e o motivo aparado, fecha e avisa", async () => {
    const s = send({ ok: true });
    const onClose = vi.fn();
    const onDone = vi.fn();
    render(<RevealNowSheet {...props} send={s} onDone={onDone} onClose={onClose} />);
    type("  Anfitriã pediu por chamado #482.  ");
    fireEvent.click(reveal());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(s).toHaveBeenCalledWith("e1", "Anfitriã pediu por chamado #482.");
    expect(onDone).toHaveBeenCalled();
  });
  it.each([
    ["revealed", "Este evento já foi revelado."],
    ["invalid", "Evento sem revelação ligada."],
    ["forbidden", "Sem permissão"],
  ] as const)("recusa do servidor (%s): mostra '%s' como está e não fecha", async (failure, text) => {
    const onClose = vi.fn();
    render(<RevealNowSheet {...props} send={send({ ok: false, failure })} onClose={onClose} />);
    type("Motivo bem escrito para teste");
    fireEvent.click(reveal());
    expect((await screen.findByRole("alert")).textContent).toBe(text);
    expect(onClose).not.toHaveBeenCalled();
  });
  it("falha de rede mostra a mensagem genérica", async () => {
    render(<RevealNowSheet {...props} send={vi.fn(async () => { throw new Error("rede"); })} onClose={vi.fn()} />);
    type("Motivo bem escrito para teste");
    fireEvent.click(reveal());
    expect((await screen.findByRole("alert")).textContent).toBe(REVEAL_MESSAGES.unknown);
  });
  it("'Manter a hora' fecha sem chamar o servidor", () => {
    const s = send({ ok: true });
    const onClose = vi.fn();
    render(<RevealNowSheet {...props} send={s} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Manter a hora" }));
    expect(onClose).toHaveBeenCalled();
    expect(s).not.toHaveBeenCalled();
  });
  it("traduz os códigos da RPC", () => {
    expect(revealFailureOf("MM008")).toBe("revealed");
    expect(revealFailureOf("MM005")).toBe("invalid");
    expect(revealFailureOf("MM004")).toBe("forbidden");
    expect(revealFailureOf("MM011")).toBe("reason");
    expect(revealFailureOf(undefined, "forbidden")).toBe("forbidden");
    expect(revealFailureOf("XX000", "boom")).toBe("unknown");
  });
  it("as mensagens são as do servidor, como estão", () => {
    expect(REVEAL_MESSAGES.revealed).toBe("Este evento já foi revelado.");
    expect(REVEAL_MESSAGES.invalid).toBe("Evento sem revelação ligada.");
    expect(REVEAL_MESSAGES.forbidden).toBe("Sem permissão");
  });
});

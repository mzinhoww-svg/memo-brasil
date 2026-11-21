import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UpgradeBanner, limitState } from "./UpgradeBanner";

const EV = "11111111-1111-4111-8111-111111111111";
const future = () => new Date(Date.now() + 47 * 3_600_000).toISOString();
const base = { eventId: EV, isFree: true, guests: 8, capacity: 10, posesFull: false, ended: false };

describe("limitState", () => {
  it("80% é quase; 100% ou alguém sem poses é cheio; abaixo disso nada", () => {
    expect(limitState(7, 10, false)).toBeNull();
    expect(limitState(8, 10, false)).toBe("quase");
    expect(limitState(10, 10, false)).toBe("cheio");
    expect(limitState(2, 10, true)).toBe("cheio");
    expect(limitState(500, null, false)).toBeNull();
  });
});

describe("UpgradeBanner (aviso de limite do grátis no painel)", () => {
  it("quase no limite: texto da seção 4 com a contagem e o desconto real do servidor", async () => {
    const loadOffer = vi.fn(async () => ({ percent: 20, expiresAt: future() }));
    render(<UpgradeBanner {...base} loadOffer={loadOffer} />);
    expect(screen.getByRole("heading", { name: "Sua festa está bombando! 🎉" })).toBeInTheDocument();
    expect(screen.getByText(/quase no limite: 8 de 10 convidados/)).toBeInTheDocument();
    expect(await screen.findByTestId("upgrade-oferta")).toHaveTextContent(/20% de desconto até \d{2}\/\d{2} às \d{2}:\d{2}/);
    expect(screen.getByRole("link", { name: "Liberar mais convidados" })).toHaveAttribute(
      "href", `/painel/${EV}/plano?utm_source=app&utm_medium=aviso_limite&utm_campaign=quase`);
    expect(loadOffer).toHaveBeenCalledWith(EV);
  });
  it("cheio: 'chegou ao limite'", () => {
    render(<UpgradeBanner {...base} guests={10} loadOffer={async () => null} />);
    expect(screen.getByText(/O plano grátis chegou ao limite\./)).toBeInTheDocument();
  });
  it("sem oferta (ou vencida): aviso sem desconto", async () => {
    const loadOffer = vi.fn(async () => ({ percent: 20, expiresAt: new Date(Date.now() - 1000).toISOString() }));
    render(<UpgradeBanner {...base} loadOffer={loadOffer} />);
    await waitFor(() => expect(loadOffer).toHaveBeenCalled());
    expect(screen.queryByTestId("upgrade-oferta")).toBeNull();
  });
  it("não aparece no plano pago, longe do limite ou com o evento encerrado", () => {
    const loadOffer = vi.fn(async () => null);
    const { container, rerender } = render(<UpgradeBanner {...base} isFree={false} loadOffer={loadOffer} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<UpgradeBanner {...base} guests={3} loadOffer={loadOffer} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<UpgradeBanner {...base} ended loadOffer={loadOffer} />);
    expect(container).toBeEmptyDOMElement();
    expect(loadOffer).not.toHaveBeenCalled();
  });
});

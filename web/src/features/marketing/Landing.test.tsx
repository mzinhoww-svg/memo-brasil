import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { salesContactHref } from "@/lib/contact";
import { FAQ } from "./faq";
import { Landing } from "./Landing";
import { PRICING_FALLBACK } from "./pricing";

describe("Landing (seções de texto da home para o Google)", () => {
  it("como funciona, preços e dúvidas em h2; nenhum h1 (o h1 é o do topo)", () => {
    render(<Landing tiers={PRICING_FALLBACK} />);
    for (const h of ["As fotos do casamento, tiradas por quem estava lá.", "Como funciona", "Quantos convidados vão à festa?", "Dúvidas frequentes"])
      expect(screen.getByRole("heading", { level: 2, name: h })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
  it("três faixas com preço, destaque na de 150 e o WhatsApp acima de 300", () => {
    render(<Landing tiers={PRICING_FALLBACK} />);
    const precos = screen.getByRole("region", { name: "Quantos convidados vão à festa?" });
    for (const p of ["Grátis", "R$ 147", "R$ 297"]) expect(within(precos).getByText(p)).toBeInTheDocument();
    expect(within(precos).getByText("Até 150 convidados").closest("[data-highlighted]")).not.toBeNull();
    expect(screen.getByText(/Mais de 300 convidados\?/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Falar no WhatsApp/ })).toHaveAttribute("href", salesContactHref());
    expect(screen.getAllByRole("link", { name: "Criar evento grátis" })[0]).toHaveAttribute("href", "/criar");
  });
  it("dúvidas visíveis e JSON-LD com FAQPage e as ofertas em reais", () => {
    const { container } = render(<Landing tiers={PRICING_FALLBACK} />);
    for (const f of FAQ) expect(screen.getByText(f.q)).toBeInTheDocument();
    const ld = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!);
    const faq = ld["@graph"].find((n: { "@type": string }) => n["@type"] === "FAQPage");
    expect(faq.mainEntity).toHaveLength(FAQ.length);
    expect(FAQ).toHaveLength(5);
    const product = ld["@graph"].find((n: { "@type": string }) => n["@type"] === "Product");
    expect(product.offers.map((o: { price: string; priceCurrency: string }) => [o.price, o.priceCurrency])).toEqual([["147.00", "BRL"], ["297.00", "BRL"]]);
  });
});

import Link from "next/link";
import { salesContactHref } from "@/lib/contact";
import { siteOrigin } from "@/lib/site";
import { FAQ } from "./faq";
import type { Tier } from "./pricing";

const STEPS = [
  { n: "01", t: "Monte a câmera do evento", d: "Escolha o nome, a embalagem e a hora da revelação. Leva dois minutos." },
  { n: "02", t: "Espalhe o QR Code nas mesas", d: "Cada convidado entra pelo celular, sem app, e tem 36 poses para a festa." },
  { n: "03", t: "A festa revela junta", d: "Na hora marcada, todas as fotos aparecem para todos. Você baixa tudo de uma vez." },
];
const GARANTIAS = ["Sem app para os convidados", "Revelação na hora que você escolher", "Download de todas as fotos", "Pix ou cartão"];
const PRECOS_H = "Quantos convidados vão à festa?";

/** Dados estruturados (Google): organização, produto com as faixas pagas em reais e as dúvidas frequentes. */
function jsonLd(tiers: Tier[]) {
  const origin = siteOrigin();
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "Revela", url: origin, logo: `${origin}/revela/logos/revela-mark.svg` },
      {
        "@type": "Product",
        name: "Revela: câmera descartável coletiva para casamentos",
        description: "Os convidados fotografam pelo celular, sem app, e as fotos se revelam juntas na hora marcada.",
        brand: { "@type": "Brand", name: "Revela" },
        offers: tiers.filter((t) => t.priceCents > 0).map((t) => ({
          "@type": "Offer", name: t.label, price: (t.priceCents / 100).toFixed(2), priceCurrency: "BRL", url: `${origin}/precos`, availability: "https://schema.org/InStock",
        })),
      },
      { "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };
}

/** Seções de texto da home, renderizadas no servidor (o que o Google lê): como funciona, preços, dúvidas e chamada final. */
export function Landing({ tiers }: { tiers: Tier[] }) {
  return (
    <div className="lp">
      <section className="lp-sec lp-intro" aria-labelledby="lp-intro">
        <div className="lp-wrap">
          <h2 id="lp-intro" className="lp-h2 lp-h2--lead">As fotos do casamento, tiradas por quem estava lá.</h2>
          <p className="lp-lead">Os convidados escaneiam um QR Code e fotografam pelo celular, sem baixar app. Ninguém vê nada até a hora da revelação: aí todas as fotos aparecem juntas.</p>
        </div>
      </section>

      <section id="como" className="lp-sec lp-sec--alt" aria-labelledby="lp-como">
        <div className="lp-wrap">
          <h2 id="lp-como" className="lp-h2">Como funciona</h2>
          <ol className="lp-steps">
            {STEPS.map((s) => (
              <li key={s.n} className="lp-step">
                <span className="lp-num" aria-hidden="true">{s.n}</span>
                <h3 className="lp-h3">{s.t}</h3>
                <p className="lp-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="precos" className="lp-sec" aria-labelledby="lp-precos">
        <div className="lp-wrap">
          <h2 id="lp-precos" className="lp-h2">{PRECOS_H}</h2>
          <p className="lp-lead">Pagamento único por evento. Sem assinatura. Cada convidado tem 36 poses.</p>
          <div className="lp-tiers">
            {tiers.map((t) => (
              <div key={t.code} className="lp-tier" data-highlighted={t.highlighted || undefined}>
                <span className="lp-tier-label">{t.label}</span>
                <span className="lp-tier-price">{t.price}</span>
                <span className="lp-muted lp-tier-note">{t.note}</span>
                <Link href={t.priceCents > 0 ? `/criar?plano=${encodeURIComponent(t.code)}` : "/criar"} className={`rv-btn rv-btn--block ${t.highlighted ? "rv-btn--primary" : "rv-btn--line"}`}>
                  {t.priceCents > 0 ? `Escolher ${t.label.toLowerCase()}` : "Criar evento grátis"}
                </Link>
              </div>
            ))}
          </div>
          <div className="lp-sales">
            <p><strong>Mais de 300 convidados?</strong> <span className="lp-muted">A gente monta um preço para a sua festa.</span></p>
            <a className="rv-btn rv-btn--line" href={salesContactHref()} target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>
          </div>
          <ul className="lp-garantias lp-muted">{GARANTIAS.map((g) => <li key={g}>{g}</li>)}</ul>
        </div>
      </section>

      <section id="duvidas" className="lp-sec lp-sec--alt" aria-labelledby="lp-duvidas">
        <div className="lp-wrap lp-wrap--narrow">
          <h2 id="lp-duvidas" className="lp-h2">Dúvidas frequentes</h2>
          {FAQ.map((f) => (
            <details key={f.q} className="lp-faq">
              <summary>{f.q}</summary>
              <p className="lp-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lp-sec lp-final" aria-labelledby="lp-final">
        <div className="lp-wrap lp-wrap--narrow">
          <h2 id="lp-final" className="lp-h2">Monte a câmera do seu casamento hoje.</h2>
          <Link href="/criar" className="rv-btn rv-btn--primary">Criar a câmera do meu evento</Link>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(tiers)).replace(/</g, "\\u003c") }} />
    </div>
  );
}

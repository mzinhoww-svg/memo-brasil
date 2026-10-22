import type { Metadata } from "next";
import Link from "next/link";
import { Button, Logo, Signature } from "@/components/memoriesmt";
import { ContactEmail } from "@/features/marketing/ContactEmail";

export const metadata: Metadata = { title: "Ajuda" };

const FAQ: { id: string; q: string; a: string }[] = [
  { id: "como", q: "Como funciona?", a: "O organizador cria o evento e divulga o QR Code. Cada convidado aponta a câmera, entra com seu nome e tira as fotos do seu rolo, sem baixar app. As fotos ficam guardadas e aparecem para todos juntas, na hora que o organizador escolher." },
  { id: "camera", q: "Câmera ou galeria?", a: "O melhor caminho é a câmera do aparelho, direto no navegador. Se a câmera não abrir ou você preferir, dá para escolher uma foto do aparelho. O número de fotos por pessoa é definido pelo organizador e aparece no rolo." },
  { id: "revelacao", q: "Quando as fotos aparecem?", a: "Depende da revelação programada pelo organizador: na hora, ao terminar o evento ou em data e horário escolhidos. Até lá, cada convidado vê só as próprias fotos. A revelação controla a exibição pelo serviço, mas não impede quem já recebeu acesso de fazer capturas ou compartilhar uma cópia." },
  { id: "privacidade", q: "Privacidade e guarda das fotos", a: "As fotos ficam disponíveis por 90 dias após o encerramento do evento; baixe o que quiser antes disso. Depois, o acesso é encerrado e a exclusão do armazenamento ativo ocorre em até 30 dias. Não usamos as fotos em publicidade nem para treinar modelos de inteligência artificial sem autorização específica e separada." },
  { id: "preco", q: "Como funciona o pagamento?", a: "O evento nasce grátis, até 10 convidados. Se a festa for maior, você escolhe um plano e paga no Pix, uma vez por evento, sem assinatura. Os planos pagos só aparecem quando estiverem ativos. Veja a página de preços." },
];

export default function Ajuda() {
  return (
    <main className="app-col app-col--card app-fluid">
      <div className="app-topbar"><Logo variant="wordmark" size={128} /></div>
      <div className="app-screen">
        <div className="app-stack-sm">
          <h1 className="titulo-tela app-h1">Ajuda</h1>
          <p className="app-p app-muted">Respostas rápidas sobre o MemoriesMT.</p>
        </div>
        {FAQ.map((f) => (
          <section key={f.id} className="app-stack-sm" aria-labelledby={`faq-${f.id}`}>
            <h2 id={`faq-${f.id}`} className="titulo-card app-h1">{f.q}</h2>
            <p className="app-p">{f.a}</p>
          </section>
        ))}
        <section className="app-stack-sm" aria-labelledby="faq-contato">
          <h2 id="faq-contato" className="titulo-card app-h1">Fale com a gente</h2>
          <p className="app-p">Dúvidas, suporte e pedidos de remoção: <ContactEmail />.</p>
          <p className="app-p"><Link href="/precos" style={{ textDecoration: "underline" }}>Preços</Link> · <Link href="/termos" style={{ textDecoration: "underline" }}>Termos de uso</Link> · <Link href="/privacidade" style={{ textDecoration: "underline" }}>Política de Privacidade</Link></p>
        </section>
        <Button href="/" variant="texto">Voltar ao início</Button>
        <div style={{ marginTop: "auto" }}><Signature /></div>
      </div>
    </main>
  );
}

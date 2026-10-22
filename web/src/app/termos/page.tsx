import type { Metadata } from "next";
import { LegalPage } from "@/features/consent/LegalPage";

export const metadata: Metadata = { title: "Termos de uso" };

export default function Termos() {
  return (
    <LegalPage title="Termos de uso" kind="terms">
      <p className="corpo app-p">O MemoriesMT reúne, em um álbum privado, as fotos que os convidados tiram durante um evento. Estes termos explicam como usar o serviço.</p>
      <h2 className="titulo-card">Quem usa</h2>
      <p className="corpo app-p">O organizador cria o evento com uma conta Google e define as regras: quem entra, quantas fotos cada pessoa envia e quando as fotos são reveladas. O convidado entra com o código ou o QR do evento, sem criar conta.</p>
      <h2 className="titulo-card">Fotos</h2>
      <p className="corpo app-p">Ao postar, você autoriza o organizador a guardar e compartilhar a foto com os participantes do evento. Envie apenas fotos que você pode compartilhar. Fotos ofensivas ou de quem não quer aparecer podem ser ocultadas ou removidas pelo organizador.</p>
      <h2 className="titulo-card">Revelação</h2>
      <p className="corpo app-p">As fotos dos outros só aparecem para os participantes depois do horário de revelação definido pelo organizador. O horário vale pelo relógio do servidor.</p>
      <h2 className="titulo-card">Disponibilidade</h2>
      <p className="corpo app-p">O serviço está em uso acompanhado, em evolução. Não há garantia de disponibilidade contínua. Baixe as fotos que quiser guardar.</p>
      <h2 className="titulo-card">Dúvidas</h2>
      <p className="corpo app-p">Para dúvidas sobre estes termos, fale com quem organizou o evento ou escreva para mazinhoww@gmail.com.</p>
    </LegalPage>
  );
}

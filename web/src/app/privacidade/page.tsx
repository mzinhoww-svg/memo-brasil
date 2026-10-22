import type { Metadata } from "next";
import { LegalPage } from "@/features/consent/LegalPage";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function Privacidade() {
  return (
    <LegalPage title="Política de privacidade" kind="privacy">
      <p className="corpo app-p">Esta política descreve os dados que o MemoriesMT usa hoje e para quê.</p>
      <h2 className="titulo-card">O que guardamos</h2>
      <p className="corpo app-p">Organizador: o e-mail da conta Google e o nome que você informa. Convidado: o nome que você escolhe na festa e um identificador de sessão anônimo, sem e-mail. Todos: as fotos enviadas, legendas, reações e a data do seu aceite destes textos.</p>
      <h2 className="titulo-card">Onde ficam</h2>
      <p className="corpo app-p">As fotos ficam em armazenamento privado. Só participantes do evento acessam, e só depois da revelação. O organizador acessa as fotos do próprio evento.</p>
      <h2 className="titulo-card">Para que usamos</h2>
      <p className="corpo app-p">Somente para operar o álbum do evento: entrada, envio, revelação, galeria e download. Não vendemos dados e não os usamos para publicidade.</p>
      <h2 className="titulo-card">Por quanto tempo</h2>
      <p className="corpo app-p">O prazo de guarda das fotos e as regras de exclusão serão definidos na revisão jurídica. Quando um evento é excluído, as fotos entram na fila de remoção do armazenamento.</p>
      <h2 className="titulo-card">Seus direitos</h2>
      <p className="corpo app-p">Você pode pedir acesso, correção ou exclusão dos seus dados escrevendo para mazinhoww@gmail.com.</p>
    </LegalPage>
  );
}

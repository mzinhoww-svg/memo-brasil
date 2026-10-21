import type { Metadata } from "next";
import { Button, Icon, Signature } from "@/components/memoriesmt";

export const metadata: Metadata = { title: "Administração da plataforma" };

/**
 * Área do administrador master: ponto de integração, sem login nesta fase.
 * O papel master só existe como claim emitida pelo servidor de autenticação; não há senha, URL secreta nem
 * estado do navegador que o conceda (docs/architecture/ROLES.md).
 */
export default function Master() {
  return (
    <main className="app-col app-col--card app-fluid">
      <div className="app-screen">
        <Icon name="moderar" label="Administração" size={28} />
        <div className="app-stack-sm">
          <p className="eyebrow app-eyebrow">Administração da plataforma</p>
          <h1 className="titulo-tela app-h1">Disponível com o login real.</h1>
        </div>
        <p className="corpo app-p">Aqui o administrador master vai supervisionar eventos, revelações e operações de toda a plataforma. Ele precisa entrar com uma conta autorizada pelo servidor, o que ainda não existe nesta versão.</p>
        <p className="app-p app-muted">Quem organiza uma festa continua administrando só os próprios eventos, no painel de cada evento.</p>
        <Button href="/" block>Voltar ao início</Button>
        <div style={{ marginTop: "auto" }}><Signature /></div>
      </div>
    </main>
  );
}

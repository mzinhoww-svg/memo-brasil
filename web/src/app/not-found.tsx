import { Button, Icon, Signature } from "@/components/revela";

export default function NotFound() {
  return (
    <main className="app-col app-col--card app-fluid">
      <div className="app-screen">
        <Icon name="explorar" label="Página não encontrada" size={28} />
        <h1 className="titulo-tela app-h1">Essa página não existe.</h1>
        <p className="corpo app-p app-muted">Confira o endereço ou volte ao início.</p>
        <Button href="/" block>Voltar ao início</Button>
        <div style={{ marginTop: "auto" }}><Signature /></div>
      </div>
    </main>
  );
}

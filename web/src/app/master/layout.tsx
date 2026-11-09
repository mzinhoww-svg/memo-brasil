import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/revela";
import { masterAccess } from "@/lib/master/server";
import "@/styles/admin.css";
import { MasterLogin } from "./MasterLogin";
import { MasterCrumbs } from "./MasterCrumbs";
import { MasterNav } from "./MasterNav";

export const metadata: Metadata = { title: "Administração da plataforma", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic"; // a autorização é resolvida no servidor a cada requisição

function Gate({ titulo, texto, acao }: { titulo: string; texto: string; acao?: React.ReactNode }) {
  return (
    <main className="adm-gate">
      <Logo variant="wordmark" size={140} />
      <h1 style={{ margin: 0 }}>{titulo}</h1>
      <p style={{ margin: 0 }}>{texto}</p>
      {acao}
      <Link className="app-link" href="/">Voltar ao início</Link>
    </main>
  );
}

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const { access } = await masterAccess();
  if (access === "local") return <Gate titulo="Console indisponível neste modo." texto="O console master só funciona com o servidor (Supabase) configurado; no modo local não há operadores nem dados de plataforma." />;
  if (access === "anonymous") return <Gate titulo="Entre com sua conta de operador." texto="O acesso é concedido pelo servidor a contas autorizadas. Convidados e organizadores comuns não têm acesso." acao={<MasterLogin />} />;
  if (access === "forbidden") return <Gate titulo="Sem permissão." texto="Esta conta não tem papel de operador da plataforma. O acesso não pode ser concedido por esta tela." />;
  return (
    <div className="adm-shell">
      <aside className="adm-side">
        <Logo variant="wordmark" size={140} />
        <MasterNav />
      </aside>
      <main className="adm-main" id="conteudo-admin"><MasterCrumbs />{children}</main>
    </div>
  );
}

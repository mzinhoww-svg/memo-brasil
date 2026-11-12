import type { Metadata } from "next";
import { masterAccess } from "@/lib/master/server";
import { MasterLogin } from "@/revela/screens/MasterLogin";
import { MasterLoginAction } from "./MasterLogin";
import { MasterShell } from "./MasterNav";

export const metadata: Metadata = { title: "Administração da plataforma", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic"; // a autorização é resolvida no servidor a cada requisição

/** M00: o cartão de entrada do desenho serve também para os estados sem acesso (modo local, sem permissão). */
function Gate({ titulo, texto, acao }: { titulo: string; texto: string; acao?: React.ReactNode }) {
  return (
    <main id="conteudo-admin">
      <MasterLogin title={titulo} caption={texto} action={acao} />
    </main>
  );
}

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const { access, sb } = await masterAccess();
  if (access === "local") return <Gate titulo="Console indisponível neste modo." texto="O console master só funciona com o servidor (Supabase) configurado; no modo local não há operadores nem dados de plataforma." />;
  if (access === "anonymous") return <Gate titulo="Entrar no painel" texto="Acesso restrito. Toda ação fica registrada na auditoria." acao={<MasterLoginAction />} />;
  if (access === "forbidden") return <Gate titulo="Sem permissão." texto="Esta conta não tem papel de operador da plataforma. O acesso não pode ser concedido por esta tela." />;
  const [{ data: auth }, settings] = await Promise.all([sb!.auth.getUser(), sb!.rpc("get_public_settings")]);
  const meta = (auth.user?.user_metadata ?? {}) as { full_name?: string; name?: string };
  const name = meta.full_name || meta.name || auth.user?.email?.split("@")[0] || "Operador";
  const env = String((settings.data as { payments_env?: string } | null)?.payments_env ?? "desligado");
  return (
    <MasterShell user={{ name, role: "Administrador" }} env={env}>
      <div id="conteudo-admin">{children}</div>
    </MasterShell>
  );
}

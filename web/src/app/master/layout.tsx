import type { Metadata } from "next";
import Link from "next/link";
import { ROLE_LABEL, visibleNav } from "@/lib/master/roles";
import { masterAccess, printedAlbumOn } from "@/lib/master/server";
import { MasterFrame } from "@/revela/master-kit";
import { RAIL_BOOT_SCRIPT } from "@/revela/master-menu";
import { MasterAcessoLimitado } from "@/revela/screens/MasterSemAcesso";
import "@/styles/admin.css";
import { MasterLogin } from "@/revela/screens/MasterLogin";
import { MasterLoginAction } from "./MasterLogin";
import { MasterShell } from "./MasterNav";

export const metadata: Metadata = { title: "Administração da plataforma", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic"; // a autorização é resolvida no servidor a cada requisição

/** M00: o cartão de entrada do desenho serve também para os estados sem acesso (modo local, sem permissão). */
function Gate({ titulo, texto, acao }: { titulo: string; texto: string; acao?: React.ReactNode }) {
  return (
    <main id="conteudo-admin">
      <MasterLogin title={titulo} caption={texto} action={<>{acao}<p className="rv-caption" style={{ textAlign: "center", marginTop: "18px" }}><Link className="app-link" href="/">Voltar ao início</Link></p></>} />
    </main>
  );
}

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const { access, role, sb, user } = await masterAccess();
  if (access === "local") return <Gate titulo="Console indisponível neste modo." texto="O console master só funciona com o servidor (Supabase) configurado; no modo local não há operadores nem dados de plataforma." />;
  if (access === "anonymous") return <Gate titulo="Entrar no painel" texto="Acesso restrito a contas de operador. Toda ação fica registrada na auditoria." acao={<MasterLoginAction />} />;
  const name = user?.name ?? "Operador";
  if (access === "forbidden" || !role || !sb) {
    // M32: conta logada sem papel de plataforma. Moldura do desenho, sem links; nenhuma RPC do console é chamada.
    return (
      <div id="conteudo-admin">
        <script dangerouslySetInnerHTML={{ __html: RAIL_BOOT_SCRIPT }} />
        <MasterFrame user={{ name, role: "Sem papel no console" }}><MasterAcessoLimitado role={null} /></MasterFrame>
      </div>
    );
  }
  const [settings, printed] = await Promise.all([sb.rpc("get_public_settings"), printedAlbumOn(sb)]);
  const env = String((settings.data as { payments_env?: string } | null)?.payments_env ?? "desligado");
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: RAIL_BOOT_SCRIPT }} />
      <MasterShell user={{ name, role: ROLE_LABEL[role] }} env={env} visible={visibleNav(role, { printedAlbum: printed })}>
        <div id="conteudo-admin">{children}</div>
      </MasterShell>
    </>
  );
}

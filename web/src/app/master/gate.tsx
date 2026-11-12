import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { PlatformRole } from "@/lib/master/access";
import { canOpen, whoCanOpen } from "@/lib/master/roles";
import { masterAccess, printedAlbumOn } from "@/lib/master/server";
import type { AppNavId } from "@/revela/master-kit";
import { MasterAcessoLimitado } from "@/revela/screens/MasterSemAcesso";

type Sb = NonNullable<Awaited<ReturnType<typeof masterAccess>>["sb"]>;

/** Acesso a uma ÁREA: devolve `{ sb, role }` se o papel abre a área, ou `{ denied }` com a M32 (acesso limitado) para a página devolver.
 *  Uso: `const g = await requireRole("pagamentos"); if ("denied" in g) return g.denied; const { sb } = g;` */
export async function requireRole(area: AppNavId): Promise<{ sb: Sb; role: PlatformRole } | { denied: ReactNode }> {
  const { access, sb, role } = await masterAccess();
  if (access !== "ok" || !sb || !role) notFound();
  if (!canOpen(role, area)) return { denied: <MasterAcessoLimitado role={role} caption={whoCanOpen(area)} /> };
  return { sb, role };
}

/** Rotas de Impressões: sem a chave `printed_album` respondem 404. */
export async function requirePrintedAlbum(): Promise<{ sb: Sb; role: PlatformRole } | { denied: ReactNode }> {
  const g = await requireRole("impressoes");
  if ("denied" in g) return g;
  if (!(await printedAlbumOn(g.sb))) notFound();
  return g;
}


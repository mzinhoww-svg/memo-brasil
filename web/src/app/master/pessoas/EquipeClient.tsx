"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { teamErrorText, type PlatformRoleName, type TeamRow } from "@/lib/master/people";
import { MasterPessoasEquipeView } from "@/revela/screens/MasterPessoasEquipe";
import { GrantButton, PessoasStatePage, type TabCounts } from "@/revela/screens/MasterPessoasKit";
import { GrantRoleSheet, RevokeRoleSheet } from "@/revela/screens/PessoasEquipeSheets";

/** Aba Equipe (só master): lista, "Conceder papel" e "Revogar". As duas ações pedem motivo (10 a 500) e o servidor confere de novo; o último master não tem botão. */
export function EquipeClient({ rows, counts }: { rows: TeamRow[]; counts?: TabCounts }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<{ kind: "grant" } | { kind: "revoke"; row: TeamRow } | null>(null);
  const close = () => setSheet(null);

  async function grant(email: string, role: PlatformRoleName, reason: string): Promise<string | null> {
    const { error } = await browserSupabase().rpc("admin_grant_platform_role_by_email", { p_email: email, p_role: role, p_reason: reason });
    if (error) return teamErrorText(error.code, error.message);
    router.refresh();
    return null;
  }
  async function revoke(row: TeamRow, reason: string): Promise<string | null> {
    const { error } = await browserSupabase().rpc("admin_revoke_platform_role", { p_user: row.userId, p_role: row.role, p_reason: reason });
    if (error) return teamErrorText(error.code, error.message);
    router.refresh();
    return null;
  }

  return (
    <>
      {rows.length <= 1
        ? <PessoasStatePage aba="equipe" variant="empty" live counts={counts} exportAction={<GrantButton onClick={() => setSheet({ kind: "grant" })} />} />
        : <MasterPessoasEquipeView live counts={counts} rows={rows} onGrant={() => setSheet({ kind: "grant" })} onRevoke={(row) => setSheet({ kind: "revoke", row })} />}
      {sheet?.kind === "grant" && <GrantRoleSheet onSubmit={grant} onClose={close} />}
      {sheet?.kind === "revoke" && <RevokeRoleSheet role={sheet.row.role} email={sheet.row.email} onSubmit={(reason) => revoke(sheet.row, reason)} onClose={close} />}
    </>
  );
}

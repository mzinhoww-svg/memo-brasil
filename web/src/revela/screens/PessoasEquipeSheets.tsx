"use client";
/* Folhas da aba Equipe: "Conceder papel" (Master-pessoas-equipe--folha-conceder.html, M19.f1) e "Revogar o papel de <papel>?" (…--folha-revogar.html, M19.f2).
   As duas usam a folha única de ação com motivo de 10 a 500 caracteres (`ActionSheet`); o servidor confere de novo (MM011). */
import { useState } from "react";
import { ActionSheet } from "../master";
import { Ico } from "../master-kit";
import type { PlatformRoleName } from "@/lib/master/people";

export const ROLES: readonly PlatformRoleName[] = ["master", "support", "auditor"];
export const ROLE_HELP: Record<PlatformRoleName, string> = {
  master: "master: acesso total, inclusive equipe, preços, pagamentos e configurações.",
  support: "support: atende e consulta, com e-mails mascarados e sem ações sensíveis.",
  auditor: "auditor: consulta, exporta e lê a auditoria, com e-mails mascarados e sem ações sensíveis.",
};
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface GrantRoleSheetProps {
  initialEmail?: string;
  initialRole?: PlatformRoleName;
  initialReason?: string;
  /** Devolve o texto do erro do servidor (ou null quando deu certo e a folha pode fechar). */
  onSubmit?: (email: string, role: PlatformRoleName, reason: string) => Promise<string | null>;
  onClose?: () => void;
  inline?: boolean;
}

export function GrantRoleSheet({ initialEmail = "", initialRole = "support", initialReason = "", onSubmit, onClose, inline }: GrantRoleSheetProps) {
  const [email, setEmail] = useState(initialEmail);
  const [role, setRole] = useState<PlatformRoleName>(initialRole);
  const [error, setError] = useState<string | null>(null);
  return (
    <ActionSheet title="Conceder papel" body="A pessoa precisa já ter conta no Revela." confirmLabel="Conceder" busyLabel="Concedendo…" error={error} initialReason={initialReason} inline={inline}
      onCancel={() => onClose?.()}
      onConfirm={async (reason) => {
        setError(null);
        if (!EMAIL_OK.test(email.trim())) { setError("Informe o e-mail de uma conta do Revela."); return; }
        const err = onSubmit ? await onSubmit(email.trim(), role, reason) : null;
        if (err) setError(err); else onClose?.();
      }}>
      <label className="rv-field" style={{ marginTop: "16px" }}>
        <Ico n="mail" />
        <input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mail da conta" />
      </label>
      <p className="rv-caption" style={{ margin: "16px 0 8px" }}>Papel</p>
      <div className="seg" role="radiogroup" aria-label="Papel">
        {ROLES.map((r) => (
          <span key={r} className={r === role ? "on" : ""} role="radio" aria-checked={r === role} tabIndex={0} style={{ cursor: "pointer" }}
            onClick={() => setRole(r)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRole(r); } }}>{r}</span>
        ))}
      </div>
      <p className="rv-caption" style={{ marginTop: "8px" }}>{ROLE_HELP[role]}</p>
    </ActionSheet>
  );
}

export interface RevokeRoleSheetProps {
  role: PlatformRoleName;
  email: string;
  initialReason?: string;
  onSubmit?: (reason: string) => Promise<string | null>;
  onClose?: () => void;
  inline?: boolean;
}

export function RevokeRoleSheet({ role, email, initialReason = "", onSubmit, onClose, inline }: RevokeRoleSheetProps) {
  const [error, setError] = useState<string | null>(null);
  return (
    <ActionSheet title={`Revogar o papel de ${role}?`} body={`${email} perde o acesso ao console na hora.`} confirmLabel="Revogar papel" busyLabel="Revogando…" tone="danger"
      error={error} initialReason={initialReason} inline={inline} onCancel={() => onClose?.()}
      onConfirm={async (reason) => {
        setError(null);
        const err = onSubmit ? await onSubmit(reason) : null;
        if (err) setError(err); else onClose?.();
      }} />
  );
}

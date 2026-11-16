"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sheet } from "@/components/revela";
import { useApp } from "@/features/app/provider";
import { browserSupabase } from "@/lib/supabase/client";

const ROW_BTN = { width: "100%", background: "none", border: 0, textAlign: "left" as const, cursor: "pointer", font: "inherit" };
const chevron = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>;

/** Conta de quem monta câmeras, no canto da abertura: ver quem está logado, trocar de conta e sair. */
export function AccountMenu() {
  const { user, signOut, signInWithGoogle, backend } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open || backend !== "supabase") return;
    let live = true;
    void browserSupabase().auth.getUser().then(({ data }) => { if (live) setEmail(data.user?.email ?? undefined); }, () => undefined);
    return () => { live = false; };
  }, [open, backend]);
  if (!user) return null;
  const name = user.name?.trim() || "Sua conta";

  async function leave() {
    if (busy) return;
    setBusy(true);
    try { await signOut(); setOpen(false); router.replace("/"); } finally { setBusy(false); }
  }
  async function switchAccount() {
    if (busy) return;
    setBusy(true);
    try { await signOut(); await signInWithGoogle("/", { chooseAccount: true }); } finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" className="rv-icon-btn" aria-label={`Conta de ${name}`} aria-haspopup="dialog" onClick={() => setOpen(true)} data-testid="conta-abrir">
        <span className="avatar avatar--sm" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      </button>
      {open && (
        <Sheet title="Sua conta" onClose={() => setOpen(false)}>
          <div className="row" style={{ gap: "14px", marginBottom: "8px" }}>
            <span className="avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
            <div>
              <b style={{ font: "400 20px/24px var(--font-display)" }}>{name}</b>
              {email && <div className="rv-caption" data-testid="conta-email">{email}</div>}
            </div>
          </div>
          <div className="rv-group">
            <Link href="/eventos" className="rv-row" onClick={() => setOpen(false)}>
              <div className="rv-row__text">Minhas câmeras</div>
              <span className="rv-row__end">{chevron}</span>
            </Link>
            <button type="button" className="rv-row" style={ROW_BTN} onClick={() => void switchAccount()} disabled={busy} data-testid="conta-trocar">
              <div className="rv-row__text">Trocar de conta</div>
              <span className="rv-row__end">{chevron}</span>
            </button>
            <button type="button" className="rv-row rv-row--danger" style={ROW_BTN} onClick={() => void leave()} disabled={busy} data-testid="conta-sair">
              <div className="rv-row__text">Sair da conta</div>
              <span className="rv-row__end">{chevron}</span>
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Breadcrumbs, Button, Field, GoogleButton, Logo } from "@/components/revela";
import { extractShareCode } from "@/domain/share-code";
import { useApp } from "@/features/app/provider";
import { emailLoginEnabled } from "@/features/auth/email-login";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Entrada: anfitrião com Google ou link por e-mail; convidado com o código do card da mesa (o mesmo endereço impresso no convite). */
export default function Entrar() {
  const router = useRouter();
  const { backend, signInWithGoogle, signInWithEmail } = useApp();
  const cloud = backend === "supabase";
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  function submitCode() {
    const c = extractShareCode(code);
    if (!c) return setCodeError("Código não confere. Confira no card da mesa.");
    router.push(`/e/${c}`);
  }
  async function submitEmail() {
    if (!EMAIL_RE.test(email.trim())) return setEmailError("Digite um e-mail válido.");
    setBusy(true); setEmailError(undefined);
    const err = await signInWithEmail(email, "/criar");
    setBusy(false);
    if (err) setEmailError(err); else setSent(true);
  }

  return (
    <main className="app-col app-col--card app-fluid">
      <div className="app-screen">
        <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Entrar" }]} />
        <Logo variant="lockup" size={132} />
        {cloud && (
          <section className="app-stack" aria-labelledby="anfitriao">
            <h1 id="anfitriao" className="titulo-tela app-h1">Entre para montar a câmera.</h1>
            <p className="corpo app-muted" style={{ margin: 0 }}>Quem organiza usa uma conta. Convidados entram só pelo QR, sem conta.</p>
            <GoogleButton block label="Continuar com Google" onClick={() => void signInWithGoogle("/criar")} />
            {!emailLoginEnabled() ? null : sent ? (
              <p className="app-banner" role="status">Link enviado para {email.trim()}. Abra o e-mail neste aparelho e toque no botão para entrar.</p>
            ) : (
              <form className="app-stack-sm" noValidate onSubmit={(e) => { e.preventDefault(); void submitEmail(); }}>
                <Field label="Receber link por e-mail" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(undefined); }} placeholder="voce@exemplo.com" error={emailError} />
                <Button type="submit" variant="secundario" block disabled={busy} aria-busy={busy} icon="email">{busy ? "Enviando…" : "Receber link por e-mail"}</Button>
              </form>
            )}
          </section>
        )}
        <form id="codigo" className="app-stack" onSubmit={(e) => { e.preventDefault(); submitCode(); }} noValidate>
          <h2 className="titulo-card app-h1">{cloud ? "Tenho o código de um convite" : "Entrar na festa"}</h2>
          <p className="corpo app-muted" style={{ margin: 0 }}>Digite o código do card da mesa ou cole o link do convite.</p>
          <Field label="Código da festa" code value={code} onChange={(e) => { setCode(e.target.value); setCodeError(undefined); }} placeholder="Ex.: NFVARBQX" autoCapitalize="characters" autoComplete="off" error={codeError} />
          <Button type="submit" block>Entrar na festa</Button>
        </form>
      </div>
    </main>
  );
}

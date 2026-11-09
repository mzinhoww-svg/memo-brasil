"use client";

import { useRouter } from "next/navigation";
import { Voce } from "@/revela/screens/Voce";
import { useApp } from "@/features/app/provider";

/** 27 · Você (anfitrião): conta, extras, ajuda e sair. Linhas sem função no produto ficam só informativas. */
export default function VocePage() {
  const { user, signOut } = useApp();
  const router = useRouter();
  const name = user?.name?.trim() || "Você";
  return (
    <Voce
      name={name} initial={name.slice(0, 1).toUpperCase()} caption="Sua conta de anfitrião"
      actions={{
        "Álbuns impressos": () => router.push("/eventos/revelados"),
        "Avisos de revelação": () => router.push("/eventos"),
        "Como funciona a revelação": () => router.push("/ajuda"),
        "Falar com a gente": () => router.push("/ajuda"),
        Privacidade: () => router.push("/privacidade"),
        Sair: () => { void signOut().then(() => router.push("/")); },
      }}
    />
  );
}

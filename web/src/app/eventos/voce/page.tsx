"use client";

import { useRouter } from "next/navigation";
import { Voce } from "@/revela/screens/Voce";
import { useApp } from "@/features/app/provider";
import { usePrintedAlbumEnabled } from "@/features/print-orders/flag";

/** 27 · Você (anfitrião): conta, extras, ajuda e sair. Linhas sem função no produto ficam só informativas. */
export default function VocePage() {
  const { user, signOut } = useApp();
  const router = useRouter();
  const printed = usePrintedAlbumEnabled();
  const name = user?.name?.trim() || "Você";
  return (
    <Voce
      hide={printed ? [] : ["Álbuns impressos"]}
      name={name} initial={name.slice(0, 1).toUpperCase()} caption={`Sua conta de anfitrião · versão ${(process.env.NEXT_PUBLIC_BUILD_ID ?? "dev").slice(0, 7)}`}
      actions={{
        "Álbuns impressos": () => router.push("/eventos/pedidos"),
        "Avisos de revelação": () => router.push("/eventos"),
        "Como funciona a revelação": () => router.push("/ajuda"),
        "Falar com a gente": () => router.push("/ajuda"),
        Privacidade: () => router.push("/privacidade"),
        Sair: () => { void signOut().then(() => router.push("/")); },
      }}
    />
  );
}

"use client";
/** Chave `printed_album` (álbum impresso), do ponto de vista do anfitrião: sem a chave ligada, o pedido de impressão (19b e Você · Álbuns impressos) não aparece.
 *  Na nuvem a resposta é a RPC `printed_album_enabled()` (legível por qualquer conta logada); no modo local (demonstração, sem servidor) o recurso fica disponível. */
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";

export async function fetchPrintedAlbumEnabled(): Promise<boolean> {
  if (backendMode() !== "supabase") return true;
  const { data, error } = await browserSupabase().rpc("printed_album_enabled");
  return !error && data === true;
}

/** `undefined` enquanto consulta; depois `true` ou `false`. Falha de rede = `false` (na dúvida, esconde). */
export function usePrintedAlbumEnabled(): boolean | undefined {
  const [on, setOn] = useState<boolean | undefined>(backendMode() === "supabase" ? undefined : true);
  useEffect(() => {
    if (backendMode() !== "supabase") return;
    let live = true;
    fetchPrintedAlbumEnabled().then((v) => { if (live) setOn(v); }, () => { if (live) setOn(false); });
    return () => { live = false; };
  }, []);
  return on;
}

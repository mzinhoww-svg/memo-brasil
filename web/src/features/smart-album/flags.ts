import { devToolsEnabled } from "@/lib/dev-tools";

/**
 * Chaves do Smart Album no MODO LOCAL (demonstração/testes, sem servidor). Na nuvem quem decide é o banco (`smart_album_state`), e o
 * modo local nunca roda em produção. Ligar localmente:
 *   - build com `NEXT_PUBLIC_MM_SMART_ALBUM=ui` (álbum pessoal) ou `=face` (álbum + simulação da busca facial, sem motor real);
 *   - ou, só em build de homologação (`NEXT_PUBLIC_MM_DEV_TOOLS=1`), `localStorage['mm-smart-album'] = 'ui' | 'face'`.
 */
export const LOCAL_FLAG_KEY = "mm-smart-album";
export interface LocalFlags { ui: boolean; face: boolean }

export function localFlags(env: string | undefined = process.env.NEXT_PUBLIC_MM_SMART_ALBUM, dev: boolean = devToolsEnabled(), storage: Pick<Storage, "getItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage): LocalFlags {
  let v = env ?? "";
  if (!v && dev) {
    try { v = storage?.getItem(LOCAL_FLAG_KEY) ?? ""; } catch { v = ""; }
  }
  return { ui: v === "ui" || v === "face", face: v === "face" };
}

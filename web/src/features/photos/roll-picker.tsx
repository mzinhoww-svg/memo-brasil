"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

interface Picker { files: File[]; open: () => void; clear: () => void }
const Ctx = createContext<Picker | null>(null);

/** "Enviar do rolo da câmera": o seletor do aparelho abre ao toque (exige gesto) e a folha 23d recebe as fotos escolhidas. */
export function RollPickerProvider({ code, children }: { code: string; children: ReactNode }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const open = useCallback(() => input.current?.click(), []);
  const clear = useCallback(() => setFiles([]), []);
  return (
    <Ctx.Provider value={{ files, open, clear }}>
      {children}
      <input ref={input} type="file" accept="image/*" multiple hidden aria-label="Escolher fotos do aparelho"
        onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; if (f.length) { setFiles(f); router.push(`/e/${code}/rolo`); } }} />
    </Ctx.Provider>
  );
}
/** `null` fora do layout do convidado (testes de unidade): quem chama cai no seletor simples. */
export function useRollPickerOptional(): Picker | null {
  return useContext(Ctx);
}
export function useRollPicker(): Picker {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRollPicker fora do layout do convidado");
  return v;
}

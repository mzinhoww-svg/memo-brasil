import { useEffect, useRef, type RefObject } from "react";

/** `true` enquanto o componente está montado. Religa no corpo do efeito: o StrictMode (dev) monta, desmonta e remonta, e só o cleanup deixaria `false` para sempre. */
export function useAlive(): RefObject<boolean> {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  return alive;
}

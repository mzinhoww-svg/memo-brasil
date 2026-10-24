import Link from "next/link";
import { includeTests, type SearchParams } from "@/features/master/params";
import { hrefWith } from "./url";

/**
 * Alterna `?testes=1`. Padrão (sem o parâmetro) = testes ocultos = chave ligada.
 * Preserva os demais parâmetros e volta à página 1.
 */
export function TestToggle({ path, params }: { path: string; params: SearchParams }) {
  const mostrando = includeTests(params);
  const href = hrefWith(path, params, { testes: mostrando ? null : "1" });
  return <Link href={href} role="switch" aria-checked={!mostrando} className="adm-btn">Ocultar testes</Link>;
}

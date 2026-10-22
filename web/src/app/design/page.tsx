import { notFound } from "next/navigation";
import { devToolsEnabled } from "@/lib/dev-tools";
import { DesignGuide } from "./guide";

/** Rota técnica: guia vivo dos componentes. Fora do build de desenvolvimento responde 404. */
export default function Design() {
  if (!devToolsEnabled()) notFound();
  return <DesignGuide />;
}

import { ScreenSkeleton } from "@/components/revela/ScreenSkeleton";
import { HostTabs } from "@/revela/HostTabs";

/** Esqueleto enquanto a rota chega (mesmo quadro da tela final). */
export default function Loading() {
  return <ScreenSkeleton variant="perfil" label="Carregando sua conta…" tabs={<HostTabs current="voce" />} />;
}

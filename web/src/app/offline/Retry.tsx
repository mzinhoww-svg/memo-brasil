'use client';
import { ApoioOffline } from '@/revela/screens/ApoioOffline';
import { offlineDestination } from '@/features/admin/offline-destination';

/** 28 · Sem internet. Navegação completa força a rede, inclusive quando o SW serviu o fallback em outra rota. */
export function OfflineRetry({ message }: { message: string }) {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- navegação completa de propósito
  const retry = () => window.location.assign(offlineDestination(window.location.href));
  return <ApoioOffline title="Revela" message={message} left="—" onRetry={retry} onClose={() => window.location.assign('/')} />;
}

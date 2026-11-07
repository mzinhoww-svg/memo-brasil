'use client';
import { Button } from '@/components/memoriesmt';
import { offlineDestination } from '@/features/admin/offline-destination';
export function OfflineRetry() {
  // Navegação completa força a rede, inclusive quando o SW serviu o fallback em outra rota.
  return <Button block onClick={() => window.location.assign(offlineDestination(window.location.href))}>Tentar de novo</Button>;
}

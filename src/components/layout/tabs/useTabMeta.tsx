import { useEffect } from 'react';
import { useRouter } from '@tanstack/react-router';
import { setTabMeta } from './tabStore';
import type { TabMeta } from './tabStore';

// Qualquer página de rota chama isso reportando seus próprios metadados.
// useRouter() resolve sozinho o router ambiente (global ou o da aba) — nenhum acoplamento
// entre a página e o sistema de abas além desse contrato { title, icon, breadcrumb, status }.
export function useTabMeta(meta: TabMeta) {
  const router = useRouter();
  useEffect(() => {
    setTabMeta(router, meta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, meta.title, meta.icon, meta.subtitle, meta.status, meta.breadcrumb?.join('/')]);
}

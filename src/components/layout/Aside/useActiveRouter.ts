import { useEffect, useState } from 'react';
import { router as globalRouter } from '@/router';
import type { AppRouter } from '@/router';
import { useTabs } from '../tabs/tabStore';

export function useActiveRouter(): AppRouter {
  const { tabs, activeTabId } = useTabs();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  return activeTab?.router ?? globalRouter;
}

export function useActivePathname(router: AppRouter): string {
  const [, setTick] = useState(0);
  useEffect(() => {
    return router.subscribe('onResolved', () => setTick((t) => t + 1));
  }, [router]);
  return router.state.location.pathname;
}

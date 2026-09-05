import { useEffect } from 'react';
import { Outlet } from '@tanstack/react-router';
import { Aside } from './Aside/Aside'
import GlobalChatWidget from '@/Chat/components/GlobalChatWidget'
import GlobalSearchWidget from '@/modules/search/components/GlobalSearchWidget';
import GlobalKanbanModalHost from '@/Kanban/GlobalKanbanModalHost';
import TabBar from './tabs/TabBar';
import TabRouterHost from './tabs/TabRouterHost';
import { useTabs, initTabsFromDisk } from './tabs/tabStore';
import TabBreadcrumbBar from './tabs/TabBreadcrumbBar';
import GlobalPomodoroWidget from '@/Projects/Project/modules/pomodoro/components/GlobalPomodoroWidget';
import GlobalMomentComposerHost from '@/Feed/components/GlobalMomentComposerHost';
import GlobalCardTimerWidget from '@/Kanban/Timer/components/GlobalCardTimerWidget';
import { initPageVisibilityFromDisk, usePageVisibility } from './Aside/pageVisibilityStore';
import { initAsideCollapsedFromDisk } from './Aside/useAsideCollapsed';

export function AppLayout() {
  const { activeTabId } = useTabs();
  const { disabledRoutes } = usePageVisibility();

  useEffect(() => {
    initTabsFromDisk();
    initPageVisibilityFromDisk();
    initAsideCollapsedFromDisk();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Aside />
      <main className="flex flex-1 flex-col overflow-hidden">
        <TabBar />
        <TabBreadcrumbBar />
        <div className="flex-1 overflow-y-auto" style={{ position: 'relative' }}>
          <div className="h-full p-6" style={{ display: activeTabId === null ? 'block' : 'none' }}>
            <Outlet />
          </div>
          <TabRouterHost />
        </div>
      </main>
      {!disabledRoutes.has('/chat') && <GlobalChatWidget />}
      <GlobalSearchWidget />
      <GlobalKanbanModalHost />
      <GlobalPomodoroWidget />
      <GlobalMomentComposerHost />
      <GlobalCardTimerWidget />
    </div>
  )
}

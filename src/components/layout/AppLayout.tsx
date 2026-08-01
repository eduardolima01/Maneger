import { Outlet } from '@tanstack/react-router'
import { Aside } from './Aside/Aside'
import GlobalChatWidget from '@/Chat/components/GlobalChatWidget'
import GlobalSearchWidget from '@/modules/search/components/GlobalSearchWidget';
import GlobalKanbanModalHost from '@/Kanban/GlobalKanbanModalHost';

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Aside />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </main>
      <GlobalChatWidget />
      <GlobalSearchWidget />
      <GlobalKanbanModalHost />
    </div>
  )
}

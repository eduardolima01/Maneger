import { useTabs } from './tabStore';
import KanbanBoard from '@/Projects/Project/modules/kanban/KanbanBoard';

export default function TabContentHost() {
  const { tabs, activeTabId } = useTabs();

  return (
    <>
      {tabs.map((tab) => (
        <div key={tab.id} style={{ display: tab.id === activeTabId ? 'block' : 'none', height: '100%' }}>
          {tab.kind === 'kanban' && tab.kanban && (
            <div style={{ padding: 16 }}>
              <KanbanBoard kanban={tab.kanban} />
            </div>
          )}
        </div>
      ))}
    </>
  );
}


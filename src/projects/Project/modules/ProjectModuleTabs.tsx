import { useEffect, useState } from 'react';
import TasksSection from './tasks/TasksSection';
import KanbanBoard from './kanban/KanbanBoard';
import NotesSection from './notes/NotesSection';
import AgendaSection from './agenda/AgendaSection';
import type { ModuleStatus } from '@/lib/api/modules';
import type { ModuleKey } from '../../../types/module.types';

interface ProjectModuleTabsProps {
  projectId: string;
  projectName: string;
  modules: ModuleStatus;
}

const MODULE_LABELS: Record<ModuleKey, string> = {
  tasks: 'Tarefas',
  kanban: 'Kanban',
  notes: 'Notas',
  agenda: 'Agenda',
};

const MODULE_ORDER: ModuleKey[] = ['tasks', 'kanban', 'notes', 'agenda'];

export default function ProjectModuleTabs({ projectId, projectName, modules }: ProjectModuleTabsProps) {
  const [activeTab, setActiveTab] = useState<ModuleKey | null>(null);
  const enabledTabs = MODULE_ORDER.filter((key) => modules[key]);

  useEffect(() => {
    if (enabledTabs.length > 0 && (!activeTab || !enabledTabs.includes(activeTab))) {
      setActiveTab(enabledTabs[0]);
    }
    if (enabledTabs.length === 0) {
      setActiveTab(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules]);

  if (enabledTabs.length === 0) {
    return <p style={{ color: '#666', fontSize: 14 }}>Nenhum módulo ativo neste projeto.</p>;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e0e0e0' }}>
        {enabledTabs.map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === key ? '2px solid #1a73e8' : '2px solid transparent',
              color: activeTab === key ? '#1a73e8' : '#666',
              cursor: 'pointer',
            }}
          >
            {MODULE_LABELS[key]}
          </button>
        ))}
      </div>

      <div style={{ paddingTop: 12 }}>
        {activeTab === 'tasks' && <TasksSection projectId={projectId} />}
        {activeTab === 'kanban' && <KanbanBoard projectId={projectId} />}
        {activeTab === 'notes' && <NotesSection projectId={projectId} />}
        {activeTab === 'agenda' && <AgendaSection projectId={projectId} projectName={projectName} />}
      </div>
    </div>
  );
}

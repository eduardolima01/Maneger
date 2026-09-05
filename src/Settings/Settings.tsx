import {
  MdFolder, MdTask, MdCalendarMonth, MdNotes,
  MdViewKanban, MdChat, MdGesture, MdHistoryEdu,
} from 'react-icons/md';
import { LuLogs } from 'react-icons/lu';
import { usePageVisibility, setPageDisabled } from '@/components/layout/Aside/pageVisibilityStore';

// espelha o menuItems real do Aside.tsx — Dashboard ('/') fica de fora de propósito
// (rota raiz, não pode ser desabilitada; ver pageVisibilityStore.ts)
const TOGGLEABLE_PAGES = [
  { label: 'Agenda', icon: MdCalendarMonth, to: '/agenda' },
  { label: 'Projetos', icon: MdFolder, to: '/projects' },
  { label: 'Feed', icon: MdHistoryEdu, to: '/feed' },
  { label: 'Kanban', icon: MdViewKanban, to: '/kanban' },
  { label: 'Canvas', icon: MdGesture, to: '/canvas' },
  { label: 'Chat', icon: MdChat, to: '/chat' },
  { label: 'Tarefas', icon: MdTask, to: '/tasks' },
  { label: 'Notas', icon: MdNotes, to: '/notes' },
  { label: 'Logs', icon: LuLogs, to: '/logs' },
];

export const Settings = () => {
  const { disabledRoutes } = usePageVisibility();

  return (
    <div style={{ padding: 24, maxWidth: 480 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Configurações</h2>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Desative páginas que você não usa — elas somem do menu lateral.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {TOGGLEABLE_PAGES.map(({ label, icon: Icon, to }) => {
          const disabled = disabledRoutes.has(to);
          return (
            <label
              key={to}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 6, cursor: 'pointer', border: '1px solid #eee',
              }}
            >
              <input
                type="checkbox"
                checked={!disabled}
                onChange={(e) => setPageDisabled(to, !e.target.checked)}
              />
              <Icon size={16} color={disabled ? '#bbb' : '#333'} />
              <span style={{ fontSize: 14, color: disabled ? '#bbb' : '#000' }}>{label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

import {
  MdDashboard,
  MdFolder,
  MdTask,
  MdCalendarMonth,
  MdNotes,
  MdSettings,
  MdChevronLeft,
  MdChevronRight,
} from 'react-icons/md'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { LuLogs } from 'react-icons/lu'
import Tooltip from '@/components/ui/Tooltip'
import AsideNavItem from './AsideNavItem'
import { useAsideCollapsed } from './useAsideCollapsed'

const menuItems = [
  { label: 'Dashboard', icon: MdDashboard, to: '/' },
  { label: 'Agenda', icon: MdCalendarMonth, to: '/agenda' },
  { label: 'Projetos', icon: MdFolder, to: '/projects' },
  { label: 'Tarefas', icon: MdTask, to: '/tasks' },
  { label: 'Notas', icon: MdNotes, to: '/notes' },
  { label: 'Logs', icon: LuLogs, to: '/logs' },
]

export function Aside() {
  const { collapsed, toggle } = useAsideCollapsed()

  return (
    <aside
      className={`flex h-screen flex-col border-r border-zinc-200 bg-white text-zinc-900 transition-all duration-200 ease-in-out dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 ${collapsed ? 'w-16' : 'w-64'}`}
    >
      <div
        className={`flex items-center border-b border-zinc-200 p-4 dark:border-zinc-800 ${collapsed ? 'justify-center' : 'justify-between'}`}
      >
        <h1
          className={`overflow-hidden whitespace-nowrap text-2xl font-bold transition-all duration-200 ${collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}
        >
          Maneger
        </h1>

        <Tooltip content={collapsed ? 'Expandir menu' : 'Recolher menu'} side="right" disabled={false}>
          <button
            onClick={toggle}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <MdChevronRight size={20} /> : <MdChevronLeft size={20} />}
          </button>
        </Tooltip>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.to}>
              <AsideNavItem to={item.to} label={item.label} icon={item.icon} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>

      <div className={`flex items-center border-t border-zinc-200 p-4 dark:border-zinc-800 ${collapsed ? 'flex-col gap-3' : 'justify-between'}`}>
        <AsideNavItem to="/settings" label="Configurações" icon={MdSettings} collapsed={collapsed} />
        <ThemeToggle />
      </div>
    </aside>
  )
}

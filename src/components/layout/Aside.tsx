import { Link } from '@tanstack/react-router'
import {
  MdDashboard,
  MdFolder,
  MdTask,
  MdCalendarMonth,
  MdNotes,
  MdSettings,
} from 'react-icons/md'

import { ThemeToggle } from '@/components/layout/ThemeToggle'

const menuItems = [
  {
    label: 'Dashboard',
    icon: MdDashboard,
    to: '/',
  },
  {
    label: 'Projetos',
    icon: MdFolder,
    to: '/projects',
  },
  {
    label: 'Tarefas',
    icon: MdTask,
    to: '/tasks',
  },
  {
    label: 'Agenda',
    icon: MdCalendarMonth,
    to: '/calendar',
  },
  {
    label: 'Notas',
    icon: MdNotes,
    to: '/notes',
  },
]

export function Aside() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
      <div className="border-b border-zinc-200 p-6 dark:border-zinc-800">
        <h1 className="text-2xl font-bold">Maneger</h1>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon

            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  activeProps={{
                    className:
                      'flex items-center gap-3 rounded-lg bg-zinc-100 px-3 py-2 font-semibold text-blue-600 dark:bg-zinc-800 dark:text-blue-400',
                  }}
                >
                  <Icon size={22} />
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="flex items-center justify-between border-t border-zinc-200 p-4 dark:border-zinc-800">
        <Link
          to="/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <MdSettings size={22} />
          <span>Configurações</span>
        </Link>

        <ThemeToggle />
      </div>
    </aside>
  )
}

import Tooltip from '@/components/ui/Tooltip';
import type { IconType } from 'react-icons';
import type { AppRouter } from '@/router';

interface AsideNavItemProps {
  to: string;
  label: string;
  icon: IconType;
  collapsed: boolean;
  router: AppRouter;
  activePathname: string;
}

export default function AsideNavItem({ to, label, icon: Icon, collapsed, router, activePathname }: AsideNavItemProps) {
  const isActive = activePathname === to;
  const baseClass = `flex items-center rounded-lg px-3 py-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${collapsed ? 'justify-center' : 'gap-3'}`;
  const activeClass = `flex items-center rounded-lg bg-zinc-100 px-3 py-2 font-semibold text-blue-600 dark:bg-zinc-800 dark:text-blue-400 ${collapsed ? 'justify-center' : 'gap-3'}`;

  return (
    <Tooltip content={label} side="right" disabled={!collapsed}>
      <a
        href={to}
        onClick={(e) => { e.preventDefault(); router.navigate({ to }); }}
        className={isActive ? activeClass : baseClass}
      >
        <Icon size={22} className="shrink-0" />
        <span className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${collapsed ? 'w-0 opacity-0' : 'ml-0 w-auto opacity-100'}`}>
          {label}
        </span>
      </a>
    </Tooltip>
  );
}

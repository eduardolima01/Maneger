import Tooltip from '@/components/ui/Tooltip';
import { Link } from '@tanstack/react-router';
import type { IconType } from 'react-icons';

interface AsideNavItemProps {
  to: string;
  label: string;
  icon: IconType;
  collapsed: boolean;
}

export default function AsideNavItem({ to, label, icon: Icon, collapsed }: AsideNavItemProps) {
  const baseClass = `flex items-center rounded-lg px-3 py-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${collapsed ? 'justify-center' : 'gap-3'}`;
  const activeClass = `flex items-center rounded-lg bg-zinc-100 px-3 py-2 font-semibold text-blue-600 dark:bg-zinc-800 dark:text-blue-400 ${collapsed ? 'justify-center' : 'gap-3'}`;

  return (
    <Tooltip content={label} side="right" disabled={!collapsed}>
      <Link
        to={to}
        className={baseClass}
        activeProps={{ className: activeClass }}
      >
        <Icon size={22} className="shrink-0" />
        <span
          className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${collapsed ? 'w-0 opacity-0' : 'ml-0 w-auto opacity-100'}`}
        >
          {label}
        </span>
      </Link>
    </Tooltip>
  );
}

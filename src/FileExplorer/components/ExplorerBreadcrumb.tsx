import { getBreadcrumbSegments } from '../utils/pathUtils';

interface ExplorerBreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
}

export default function ExplorerBreadcrumb({ path, onNavigate }: ExplorerBreadcrumbProps) {
  const segments = getBreadcrumbSegments(path);

  return (
    <div className="flex flex-wrap items-center gap-1 px-4 py-2.5 text-[13px]">
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={segment.path} className="flex items-center gap-1">
            <button
              onClick={() => onNavigate(segment.path)}
              // alvo de soltar: arrastar itens selecionados até um segmento move pra aquela pasta
              data-drop-path={segment.path}
              className={`cursor-pointer rounded border-none bg-transparent px-1 py-0.5 text-[13px] hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                isLast ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'font-normal text-blue-600 dark:text-blue-400'
              }`}
            >
              {segment.label}
            </button>
            {!isLast && <span className="text-zinc-400">/</span>}
          </span>
        );
      })}
    </div>
  );
}
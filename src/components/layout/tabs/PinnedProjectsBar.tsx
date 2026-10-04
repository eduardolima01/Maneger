import { openEntityTab, useFavoritePages, removeFavoritePage } from './tabStore';

const SIZE = 20; // tamanho da capa em px

export default function PinnedProjectsBar() {
  const favorites = useFavoritePages();

  if (favorites.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      {favorites.map((f) => (
        <div key={f.path} className="group relative shrink-0">
          <button
            type="button"
            title={`${f.title} (clique direito para remover)`}
            onClick={() => openEntityTab(f.path)}
            onContextMenu={(e) => {
              e.preventDefault();
              removeFavoritePage(f.path);
            }}
            className="cursor-pointer border-none bg-transparent p-0.5 rounded-full hover:ring-2 hover:ring-zinc-300 dark:hover:ring-zinc-600"
          >
            {f.iconUrl ? (
              <img
                src={f.iconUrl}
                alt={f.title}
                style={{ width: SIZE, height: SIZE }}
                className="rounded-full object-cover block"
              />
            ) : (
              <span
                style={{ width: SIZE, height: SIZE }}
                className="flex items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-[11px] leading-none"
              >
                {f.icon}
              </span>
            )}
          </button>

          <button
            type="button"
            aria-label={`Remover ${f.title} dos fixados`}
            title="Remover dos fixados"
            onClick={(e) => {
              e.stopPropagation();
              removeFavoritePage(f.path);
            }}
            className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-3.5 h-3.5 rounded-full border-none cursor-pointer bg-zinc-700 text-white text-[9px] leading-none dark:bg-zinc-300 dark:text-zinc-900"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

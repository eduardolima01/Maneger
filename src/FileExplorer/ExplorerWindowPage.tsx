import FileExplorerPage from './FileExplorerPage';

/**
 * Janela separada do Explorador: ocupa a janela inteira, sem o aside nem as abas do app.
 * Montada pelo main.tsx (dentro do ThemeProvider) quando a URL tem `?explorerWindow=1`.
 */
export default function ExplorerWindowPage() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      <FileExplorerPage />
    </div>
  );
}

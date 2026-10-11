import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { buildExplorerWindowUrl } from '../utils/explorerWindowUrl';

/**
 * Abre o Explorador numa janela separada, sem o aside e sem as abas do app (o main.tsx monta só o
 * `ExplorerWindowPage` quando a URL tem `?explorerWindow=1`). Se `path` vier, a janela já abre nessa
 * pasta. Cada chamada cria uma janela nova.
 */
export function openExplorerWindow(path?: string | null): Promise<void> {
  const label = `explorer-${Date.now()}`; // o capabilities libera `explorer-*`
  const win = new WebviewWindow(label, {
    url: buildExplorerWindowUrl(path),
    title: 'Explorador',
    width: 1100,
    height: 720,
    center: true,
  });
  return new Promise((resolve, reject) => {
    win.once('tauri://created', () => resolve());
    win.once('tauri://error', (e) => reject(e.payload));
  });
}

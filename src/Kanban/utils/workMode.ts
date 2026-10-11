import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

/** Evento que a janela do modo trabalho manda ao abrir/fechar, pra o quadro mostrar o botão certo. */
export const WORK_MODE_STATE = 'work-mode:state';
const POS_PREFIX = 'kanban-work-mode-window:';
const DEFAULT_W = 360;
const DEFAULT_H = 520;
const MARGIN = 12;

/** Cada kanban tem a PRÓPRIA janela de modo trabalho (label próprio) — uma janela nunca troca de kanban. */
export function workModeLabel(kanbanId: string): string {
  return `work-mode-${kanbanId.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

const TARGET_PREFIX = 'kanban-work-mode-target:';
const DARK_KEY = 'kanban-work-mode-dark';

/**
 * Chamado no main.tsx ANTES de renderizar o App: se esta janela é uma janela de modo trabalho, devolve o id do kanban dela
 * (e então só o kanban deve ser renderizado — sem sidebar nem abas do app). Fora dela devolve null.
 * Detecta pela LABEL da janela (não depende de query string, que o Tauri pode descartar).
 */
export function getWorkModeKanbanId(): string | null {
  try {
    const label = getCurrentWindow().label;
    if (!label.startsWith('work-mode-')) return null;
    const mapped = localStorage.getItem(TARGET_PREFIX + label);
    if (mapped) return mapped;
    const q = new URLSearchParams(window.location.search).get('work');
    return q || null;
  } catch { return null; }
}

/** Tema (escuro/claro) deixado pela janela principal ao abrir esta. */
export function getWorkModeDark(): boolean {
  try {
    const v = localStorage.getItem(DARK_KEY);
    if (v !== null) return v === '1';
  } catch { /* ignora */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

interface SavedBox { x: number; y: number; w: number; h: number }

function readSaved(kanbanId: string): SavedBox | null {
  try {
    const b = JSON.parse(localStorage.getItem(POS_PREFIX + kanbanId) ?? 'null') as SavedBox | null;
    if (!b || ![b.x, b.y, b.w, b.h].every((n) => Number.isFinite(n))) return null;
    return b;
  } catch { return null; }
}

/** Guarda tamanho/posição (px lógicos) da janela deste kanban — chamado pela própria janela. */
export function saveWorkModeBox(kanbanId: string, box: SavedBox): void {
  try { localStorage.setItem(POS_PREFIX + kanbanId, JSON.stringify(box)); } catch { /* sem espaço: só não lembra */ }
}

export async function isWorkModeOpen(kanbanId: string): Promise<boolean> {
  try { return (await WebviewWindow.getByLabel(workModeLabel(kanbanId))) !== null; } catch { return false; }
}

/** Fecha a janela do modo trabalho deste kanban (se estiver aberta). */
export async function closeWorkMode(kanbanId: string): Promise<void> {
  const win = await WebviewWindow.getByLabel(workModeLabel(kanbanId));
  if (!win) return;
  try { await win.close(); } catch { await win.destroy(); }
  await emit(WORK_MODE_STATE, { kanbanId, open: false });
}

/** Avisa (a janela do modo trabalho chama isto ao abrir/fechar). */
export function emitWorkModeState(kanbanId: string, open: boolean): void {
  void emit(WORK_MODE_STATE, { kanbanId, open }).catch(() => { });
}

/** Escuta aberturas/fechamentos das janelas de modo trabalho. Devolve a função de cancelar. */
export function listenWorkModeState(cb: (s: { kanbanId: string; open: boolean }) => void): () => void {
  let un: (() => void) | null = null;
  let off = false;
  listen<{ kanbanId: string; open: boolean }>(WORK_MODE_STATE, (e) => cb(e.payload)).then((fn) => { if (off) fn(); else un = fn; }).catch(() => { });
  return () => { off = true; un?.(); };
}

/**
 * Abre a janelinha do modo trabalho DESTE kanban (sem barra de título, sempre por cima, canto inferior direito).
 * Se ela já está aberta, só traz pra frente.
 */
export async function openWorkMode(kanbanId: string): Promise<void> {
  const label = workModeLabel(kanbanId);
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.show();
    await existing.setAlwaysOnTop(true);
    await existing.setFocus();
    return;
  }

  // área útil do monitor (exclui a barra de tarefas) em px lógicos — o WebView2 expõe availLeft/availTop
  const scr = window.screen as Screen & { availLeft?: number; availTop?: number };
  const left = scr.availLeft ?? 0;
  const top = scr.availTop ?? 0;
  const saved = readSaved(kanbanId);
  const w = Math.min(saved?.w ?? DEFAULT_W, scr.availWidth);
  const h = Math.min(saved?.h ?? DEFAULT_H, scr.availHeight);
  let x = left + scr.availWidth - w - MARGIN;
  let y = top + scr.availHeight - h - MARGIN;
  if (saved && saved.x >= left - w + 80 && saved.x <= left + scr.availWidth - 80 && saved.y >= top && saved.y <= top + scr.availHeight - 40) {
    x = saved.x; y = saved.y; // posição lembrada ainda está dentro da tela
  }

  const dark = document.documentElement.classList.contains('dark') ? '1' : '0';
  try {
    localStorage.setItem(TARGET_PREFIX + label, kanbanId);
    localStorage.setItem(DARK_KEY, dark);
  } catch { /* sem localStorage: cai na query string */ }
  const win = new WebviewWindow(label, {
    url: `index.html?work=${encodeURIComponent(kanbanId)}`,
    title: 'Modo trabalho',
    width: w, height: h, x: Math.round(x), y: Math.round(y),
    minWidth: 280, minHeight: 280,
    decorations: false,
    alwaysOnTop: true,
    resizable: true,
    focus: true,
    dragDropEnabled: false,
  });
  await new Promise<void>((resolve, reject) => {
    void win.once('tauri://created', () => resolve());
    void win.once('tauri://error', (e) => reject(new Error(String((e as { payload?: unknown }).payload ?? 'erro ao criar a janela'))));
  });
}
// Histórico de ações do Explorador (desfazer "r" / refazer "Alt+R").
// Módulo puro: recebe o "serviço de arquivos" por parâmetro (HistoryFs), então dá pra testar sem Tauri.

export type HistoryAction =
  /** estado "feito": o item está em `to`; estado "desfeito": está em `from` */
  | { kind: 'move'; items: { from: string; to: string }[] }
  /** estado "feito": a cópia existe em `copy` */
  | { kind: 'copy'; items: { source: string; copy: string }[] }
  /** estado "feito": o item está na lixeira (veio de `path`) */
  | { kind: 'trash'; items: { path: string; name: string }[] }
  | { kind: 'rename'; from: string; to: string }
  | { kind: 'create-folder'; path: string }
  /** só registrada no log: não dá pra reverter */
  | { kind: 'permanent-delete'; items: { path: string; name: string }[] };

export interface HistoryEntry {
  id: number;
  label: string;
  at: number;
  action: HistoryAction;
  undone: boolean;
}

export interface HistoryFs {
  movePath(source: string, destDir: string): Promise<{ path: string }>;
  copyPath(source: string, destDir: string): Promise<{ path: string }>;
  deleteToTrash(path: string): Promise<void>;
  renamePath(path: string, newName: string): Promise<{ path: string }>;
  createFolder(parent: string, name: string): Promise<{ path: string }>;
  listTrash(): Promise<{ id: string; name: string; originalParent: string; timeDeleted: number }[]>;
  restoreTrashItem(item: { id: string; name: string; originalParent: string; timeDeleted: number }): Promise<void>;
}

export const MAX_HISTORY = 100;

export function isReversible(action: HistoryAction): boolean {
  return action.kind !== 'permanent-delete';
}

export function dirname(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '');
  const idx = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));
  if (idx < 0) return '';
  if (idx === 0) return trimmed.slice(0, 1); // "/arquivo" -> "/"
  return trimmed.slice(0, idx);
}

export function basename(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '');
  const idx = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));
  return idx < 0 ? trimmed : trimmed.slice(idx + 1);
}

/** Comparação de caminhos tolerante a barra/maiúscula (pra casar com o que a lixeira devolve). */
export function samePath(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase();
  return norm(a) === norm(b);
}

export function describeAction(action: HistoryAction): string {
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  switch (action.kind) {
    case 'move': {
      const dest = basename(dirname(action.items[0].to)) || dirname(action.items[0].to);
      return action.items.length === 1
        ? `Moveu "${basename(action.items[0].to)}" para "${dest}"`
        : `Moveu ${n(action.items.length, 'item', 'itens')} para "${dest}"`;
    }
    case 'copy': {
      const dest = basename(dirname(action.items[0].copy)) || dirname(action.items[0].copy);
      return action.items.length === 1
        ? `Copiou "${basename(action.items[0].copy)}" para "${dest}"`
        : `Copiou ${n(action.items.length, 'item', 'itens')} para "${dest}"`;
    }
    case 'trash':
      return action.items.length === 1
        ? `Enviou "${action.items[0].name}" para a lixeira`
        : `Enviou ${n(action.items.length, 'item', 'itens')} para a lixeira`;
    case 'rename':
      return `Renomeou "${basename(action.from)}" para "${basename(action.to)}"`;
    case 'create-folder':
      return `Criou a pasta "${basename(action.path)}"`;
    case 'permanent-delete':
      return action.items.length === 1
        ? `Excluiu "${action.items[0].name}" permanentemente`
        : `Excluiu ${n(action.items.length, 'item', 'itens')} permanentemente`;
  }
}

/** Todos os caminhos que a ação toca — o Store usa pra recarregar as pastas afetadas. */
export function affectedPaths(action: HistoryAction): string[] {
  switch (action.kind) {
    case 'move': return action.items.flatMap((i) => [i.from, i.to]);
    case 'copy': return action.items.flatMap((i) => [i.source, i.copy]);
    case 'trash':
    case 'permanent-delete': return action.items.map((i) => i.path);
    case 'rename': return [action.from, action.to];
    case 'create-folder': return [action.path];
  }
}

/** Onde os itens "pousam" depois de desfazer/refazer (pra reselecionar o que estiver visível). */
export function landedPaths(action: HistoryAction, after: 'undo' | 'redo'): string[] {
  switch (action.kind) {
    case 'move': return action.items.map((i) => (after === 'undo' ? i.from : i.to));
    case 'copy': return after === 'redo' ? action.items.map((i) => i.copy) : [];
    case 'trash': return after === 'undo' ? action.items.map((i) => i.path) : [];
    case 'rename': return [after === 'undo' ? action.from : action.to];
    case 'create-folder': return after === 'redo' ? [action.path] : [];
    case 'permanent-delete': return [];
  }
}

export interface ReplayResult {
  /** ação que deve ficar guardada (itens que não deram certo, ou os novos caminhos); null se nada sobrou */
  action: HistoryAction | null;
  /** true se TODOS os itens deram certo */
  complete: boolean;
  errors: string[];
}

function errText(e: unknown, fallback: string): string {
  return typeof e === 'string' ? e : (e instanceof Error ? e.message : fallback);
}

async function batch<T>(
  items: T[],
  fn: (item: T) => Promise<T>,
  nameOf: (item: T) => string,
): Promise<{ ok: T[]; failed: T[]; errors: string[] }> {
  const ok: T[] = [];
  const failed: T[] = [];
  const errors: string[] = [];
  for (const item of items) {
    try {
      ok.push(await fn(item));
    } catch (e) {
      failed.push(item);
      errors.push(`${nameOf(item)}: ${errText(e, 'falhou')}`);
    }
  }
  return { ok, failed, errors };
}

async function findInTrash(fs: HistoryFs, path: string, name: string) {
  const parent = dirname(path);
  const matches = (await fs.listTrash())
    .filter((t) => t.name === name && samePath(t.originalParent, parent))
    .sort((a, b) => b.timeDeleted - a.timeDeleted); // o mais recente primeiro (LIFO)
  if (matches.length === 0) {
    throw new Error('não está mais na lixeira (já restaurado ou esvaziado)');
  }
  return matches[0];
}

/**
 * Executa o inverso da ação. Se só parte dos itens funcionou, devolve a ação reduzida aos que falharam
 * (continua "feita", dá pra tentar de novo); o que já foi desfeito não volta a ser refazível.
 */
export async function undoAction(action: HistoryAction, fs: HistoryFs): Promise<ReplayResult> {
  switch (action.kind) {
    case 'move': {
      const r = await batch(action.items, async (it) => {
        const res = await fs.movePath(it.to, dirname(it.from));
        return { from: res.path, to: it.to };
      }, (it) => basename(it.to));
      return finish(r, (items) => ({ kind: 'move', items }), (items) => ({ kind: 'move', items }));
    }
    case 'copy': {
      const r = await batch(action.items, async (it) => {
        await fs.deleteToTrash(it.copy);
        return it;
      }, (it) => basename(it.copy));
      return finish(r, (items) => ({ kind: 'copy', items }), (items) => ({ kind: 'copy', items }));
    }
    case 'trash': {
      const r = await batch(action.items, async (it) => {
        await fs.restoreTrashItem(await findInTrash(fs, it.path, it.name));
        return it;
      }, (it) => it.name);
      return finish(r, (items) => ({ kind: 'trash', items }), (items) => ({ kind: 'trash', items }));
    }
    case 'rename': {
      const res = await fs.renamePath(action.to, basename(action.from));
      return { action: { kind: 'rename', from: res.path, to: action.to }, complete: true, errors: [] };
    }
    case 'create-folder': {
      await fs.deleteToTrash(action.path);
      return { action, complete: true, errors: [] };
    }
    case 'permanent-delete':
      throw new Error('exclusão permanente não pode ser desfeita');
  }
}

export async function redoAction(action: HistoryAction, fs: HistoryFs): Promise<ReplayResult> {
  switch (action.kind) {
    case 'move': {
      const r = await batch(action.items, async (it) => {
        const res = await fs.movePath(it.from, dirname(it.to));
        return { from: it.from, to: res.path };
      }, (it) => basename(it.from));
      return finish(r, (items) => ({ kind: 'move', items }), (items) => ({ kind: 'move', items }));
    }
    case 'copy': {
      const r = await batch(action.items, async (it) => {
        const res = await fs.copyPath(it.source, dirname(it.copy));
        return { source: it.source, copy: res.path };
      }, (it) => basename(it.source));
      return finish(r, (items) => ({ kind: 'copy', items }), (items) => ({ kind: 'copy', items }));
    }
    case 'trash': {
      const r = await batch(action.items, async (it) => {
        await fs.deleteToTrash(it.path);
        return it;
      }, (it) => it.name);
      return finish(r, (items) => ({ kind: 'trash', items }), (items) => ({ kind: 'trash', items }));
    }
    case 'rename': {
      const res = await fs.renamePath(action.from, basename(action.to));
      return { action: { kind: 'rename', from: action.from, to: res.path }, complete: true, errors: [] };
    }
    case 'create-folder': {
      const res = await fs.createFolder(dirname(action.path), basename(action.path));
      return { action: { kind: 'create-folder', path: res.path }, complete: true, errors: [] };
    }
    case 'permanent-delete':
      throw new Error('exclusão permanente não pode ser refeita');
  }
}

function finish<T>(
  r: { ok: T[]; failed: T[]; errors: string[] },
  whenComplete: (okItems: T[]) => HistoryAction,
  whenPartial: (failedItems: T[]) => HistoryAction,
): ReplayResult {
  if (r.failed.length === 0) return { action: whenComplete(r.ok), complete: true, errors: [] };
  // parcial: guarda só o que falhou (continua no estado anterior, dá pra tentar de novo)
  // total: idem — nada mudou
  return { action: whenPartial(r.failed), complete: false, errors: r.errors };
}

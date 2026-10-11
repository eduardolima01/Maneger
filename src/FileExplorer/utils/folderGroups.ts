// Grupos de pastas da sidebar do Explorador (atalhos salvos pelo caminho absoluto).
// Módulo puro: sem React nem Tauri, pra poder ser testado em Node.

export interface FolderGroup {
  id: string;
  name: string;
  /** Caminhos absolutos das pastas do grupo, na ordem em que foram adicionadas. */
  paths: string[];
  collapsed: boolean;
}

export interface PathChange {
  from: string;
  to: string;
}

const trimEnd = (p: string) => p.replace(/[\\/]+$/, '');
const norm = (p: string) => trimEnd(p).replace(/\\/g, '/').toLowerCase();

export function samePathLoose(a: string, b: string): boolean {
  return norm(a) === norm(b);
}

export function newGroupId(): string {
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Tolerante: arquivo ausente ({}), vazio ou corrompido vira lista vazia; itens inválidos são descartados. */
export function parseGroups(raw: string): FolderGroup[] {
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.groups)) return [];
    const seen = new Set<string>();
    const result: FolderGroup[] = [];
    for (const g of data.groups) {
      if (!g || typeof g.id !== 'string' || typeof g.name !== 'string' || seen.has(g.id)) continue;
      seen.add(g.id);
      const paths: string[] = [];
      if (Array.isArray(g.paths)) {
        for (const p of g.paths) {
          if (typeof p === 'string' && p && !paths.some((q) => samePathLoose(q, p))) paths.push(p);
        }
      }
      result.push({ id: g.id, name: g.name, paths, collapsed: g.collapsed === true });
    }
    return result;
  } catch {
    return [];
  }
}

export function serializeGroups(groups: FolderGroup[]): string {
  return JSON.stringify({ groups }, null, 2);
}

/** Adiciona caminhos ao grupo sem duplicar (comparação ignora barra final, tipo de barra e maiúsculas). */
export function addPathsToGroup(group: FolderGroup, paths: string[]): FolderGroup {
  const next = [...group.paths];
  for (const p of paths) {
    if (!next.some((q) => samePathLoose(q, p))) next.push(p);
  }
  return next.length === group.paths.length ? group : { ...group, paths: next, collapsed: false };
}

/** Novo caminho de `p` se `from` foi renomeada/movida pra `to` (vale também pra subpastas); null se não afeta. */
export function remapPath(p: string, from: string, to: string): string | null {
  const f = norm(from);
  const n = norm(p);
  if (n === f) return to;
  if (n.startsWith(f + '/')) return trimEnd(to) + p.slice(trimEnd(from).length);
  return null;
}

/** Aplica renomeações/movimentos aos caminhos salvos, pra os atalhos continuarem apontando pra pasta certa. */
export function remapGroups(groups: FolderGroup[], changes: PathChange[]): FolderGroup[] {
  let anyChanged = false;
  const next = groups.map((g) => {
    let touched = false;
    const paths = g.paths.map((p) => {
      for (const c of changes) {
        const mapped = remapPath(p, c.from, c.to);
        if (mapped !== null) { touched = true; return mapped; }
      }
      return p;
    });
    if (!touched) return g;
    anyChanged = true;
    // dois caminhos podem ter virado o mesmo: tira a duplicata
    const unique: string[] = [];
    for (const p of paths) if (!unique.some((q) => samePathLoose(q, p))) unique.push(p);
    return { ...g, paths: unique };
  });
  return anyChanged ? next : groups;
}

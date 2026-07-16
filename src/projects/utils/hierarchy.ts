export function buildAncestorChain<T>(
  itemsById: Map<string, T>,
  targetId: string,
  getId: (item: T) => string,
  getParentId: (item: T) => string | null
): T[] {
  const chain: T[] = [];
  const visited = new Set<string>();
  let current = itemsById.get(targetId);

  while (current) {
    const id = getId(current);
    if (visited.has(id)) break; // guarda contra ciclo (não deveria acontecer, mas evita loop infinito se acontecer)
    visited.add(id);
    chain.unshift(current);

    const parentId = getParentId(current);
    current = parentId ? itemsById.get(parentId) : undefined;
  }

  return chain;
}

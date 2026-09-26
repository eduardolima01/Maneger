import { loadKanbanData, saveKanbanData } from '@/Kanban/api/kanbanDataStore';
import { generateId } from '@/lib/utils/uuid';
import type { KanbanChecklistItem, ChecklistProgress, ChecklistItemStatus } from '@/types/kanban.types';

/**
 * Item salvo antes do campo `status` existir tinha `checked: boolean` — sem essa migração na leitura,
 * `status` vem `undefined` pra todo item antigo (dropdown em branco, sync de pai comparando com 'done'/
 * 'not_started' sempre falso). TODA leitura de checklistItems neste arquivo passa por aqui (`loadNormalized`
 * em vez de `loadKanbanData` direto), pra nunca operar em cima do formato antigo sem querer.
 */
function normalizeItem(item: KanbanChecklistItem): KanbanChecklistItem {
  if (item.status) return item;
  const legacy = item as unknown as { checked?: boolean };
  return { ...item, status: legacy.checked ? 'done' : 'not_started' };
}

async function loadNormalized() {
  const data = await loadKanbanData();
  data.checklistItems = data.checklistItems.map(normalizeItem);
  return data;
}

/**
 * Mantém o pai coerente com os filhos: sobe a cadeia a partir de `fromParentId` e deriva o status de cada
 * ancestral a partir dos filhos DIRETOS dele — todos 'done' → 'done'; todos 'not_started' → 'not_started';
 * qualquer mistura (inclusive algum 'in_progress') → 'in_progress'. Ancestral sem filhos não é mexido (fica
 * com o que o usuário marcou nele). Opera em memória, sobre o `data` que o chamador vai salvar — não faz
 * load/save próprio.
 */
function syncAncestorsStatus(items: KanbanChecklistItem[], fromParentId: string | null): void {
  const visited = new Set<string>(); // defesa contra ciclo nos dados
  let parentId = fromParentId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const currentId: string = parentId;
    const parent = items.find((i) => i.id === currentId);
    if (!parent) return;
    const children = items.filter((i) => i.parentItemId === currentId);
    if (children.length === 0) return;
    if (children.every((c) => c.status === 'done')) parent.status = 'done';
    else if (children.every((c) => c.status === 'not_started')) parent.status = 'not_started';
    else parent.status = 'in_progress';
    parentId = parent.parentItemId ?? null;
  }
}

export async function getItemsByCard(cardId: string): Promise<KanbanChecklistItem[]> {
  const data = await loadNormalized();
  return data.checklistItems
    .filter((item) => item.cardId === cardId)
    .sort((a, b) => a.position - b.position);
}

export async function createItem(cardId: string, title: string): Promise<string> {
  return createItemInternal(cardId, null, title);
}

async function createItemInternal(cardId: string, parentItemId: string | null, title: string): Promise<string> {
  const data = await loadNormalized();
  const id = generateId();

  const siblings = parentItemId
    ? data.checklistItems.filter((item) => item.parentItemId === parentItemId)
    : data.checklistItems.filter((item) => item.cardId === cardId && !item.parentItemId);
  const nextPosition = siblings.length > 0 ? Math.max(...siblings.map((item) => item.position)) + 1 : 0;

  data.checklistItems.push({ id, cardId, parentItemId, title, status: 'not_started', position: nextPosition });
  syncAncestorsStatus(data.checklistItems, parentItemId); // sub-item novo nasce 'not_started': o pai (e os acima dele) deixa de estar 'done'
  await saveKanbanData(data);
  return id;
}

export async function createSubItem(cardId: string, parentItemId: string, title: string): Promise<string> {
  return createItemInternal(cardId, parentItemId, title);
}

export async function updateItem(id: string, input: Partial<{ title: string; status: ChecklistItemStatus }>): Promise<void> {
  const data = await loadNormalized();
  const item = data.checklistItems.find((i) => i.id === id);
  if (!item) return;

  let changed = false;
  if (input.title !== undefined) { item.title = input.title; changed = true; }
  if (input.status !== undefined) { item.status = input.status; changed = true; }
  if (!changed) return;

  if (input.status !== undefined) syncAncestorsStatus(data.checklistItems, item.parentItemId ?? null);
  await saveKanbanData(data);
}

/**
 * Cascade recursivo (loop de ponto fixo): o schema SQL original tinha `parent_item_id`
 * auto-referenciado com `ON DELETE CASCADE` — em JSON não existe cascade automático, então
 * sub-itens em qualquer profundidade precisam ser encontrados na mão. É o único ponto desta
 * migração em que a versão JSON precisa de MAIS cuidado que a SQL, não menos.
 */
export async function deleteItem(id: string): Promise<void> {
  const data = await loadNormalized();

  const removedParentId = data.checklistItems.find((i) => i.id === id)?.parentItemId ?? null;
  const idsToRemove = new Set([id]);
  let addedInLastPass = true;
  while (addedInLastPass) {
    addedInLastPass = false;
    for (const item of data.checklistItems) {
      if (item.parentItemId && idsToRemove.has(item.parentItemId) && !idsToRemove.has(item.id)) {
        idsToRemove.add(item.id);
        addedInLastPass = true;
      }
    }
  }

  data.checklistItems = data.checklistItems.filter((item) => !idsToRemove.has(item.id));
  syncAncestorsStatus(data.checklistItems, removedParentId); // apagou o último sub-item pendente? o pai passa a estar 'done'
  await saveKanbanData(data);
}

export async function reorderItems(orderedIds: string[]): Promise<void> {
  const data = await loadNormalized();
  orderedIds.forEach((id, index) => {
    const item = data.checklistItems.find((i) => i.id === id);
    if (item) item.position = index;
  });
  await saveKanbanData(data);
}

export async function getProgressByCardIds(cardIds: string[]): Promise<Record<string, ChecklistProgress>> {
  const result: Record<string, ChecklistProgress> = {};
  for (const id of cardIds) result[id] = { done: 0, total: 0 };
  if (cardIds.length === 0) return result;

  const data = await loadNormalized();
  const cardIdSet = new Set(cardIds);
  for (const item of data.checklistItems) {
    if (!cardIdSet.has(item.cardId)) continue;
    const progress = result[item.cardId];
    progress.total++;
    if (item.status === 'done') progress.done++;
  }
  return result;
}

/**
 * Copia a árvore inteira de itens (qualquer profundidade) de um card pra outro, refazendo os
 * `parentItemId` pros ids NOVOS — senão os filhos da cópia continuariam apontando pros itens do original.
 * Antes copiava só 2 níveis (raiz + filhos); netos e abaixo eram perdidos na duplicação.
 */
export async function duplicateChecklist(sourceCardId: string, targetCardId: string): Promise<void> {
  const items = await getItemsByCard(sourceCardId); // já vem ordenado por position

  const childrenByParent = new Map<string | null, KanbanChecklistItem[]>();
  for (const item of items) {
    const key = item.parentItemId ?? null;
    const list = childrenByParent.get(key) ?? [];
    list.push(item);
    childrenByParent.set(key, list);
  }

  async function copyLevel(sourceParentId: string | null, targetParentId: string | null): Promise<void> {
    for (const item of childrenByParent.get(sourceParentId) ?? []) {
      const newId = targetParentId
        ? await createSubItem(targetCardId, targetParentId, item.title)
        : await createItem(targetCardId, item.title);
      if (item.status !== 'not_started') await updateItem(newId, { status: item.status });
      await copyLevel(item.id, newId);
    }
  }

  await copyLevel(null, null);
}

/**
 * Muda o pai de um item (dentro do MESMO card): `newParentId = null` vira tarefa principal, um id vira
 * sub-item dele. O item leva os próprios filhos junto. Sem `afterItemId` vai pro fim dos irmãos do destino;
 * com ele, entra logo depois desse irmão (usado no "subir um nível", pra o item ficar ao lado do antigo pai).
 * Recusa mover pra dentro de si mesmo ou de um descendente: criaria um ciclo e a árvore sumiria da tela.
 */
export async function moveItem(id: string, newParentId: string | null, afterItemId?: string): Promise<void> {
  const data = await loadNormalized();
  const item = data.checklistItems.find((i) => i.id === id);
  if (!item) return;
  if ((item.parentItemId ?? null) === newParentId && !afterItemId) return;

  if (newParentId) {
    const newParent = data.checklistItems.find((i) => i.id === newParentId);
    if (!newParent || newParent.cardId !== item.cardId) throw new Error('Destino inválido: o novo pai precisa ser um item do mesmo card');

    // sobe a cadeia de pais do destino; se cruzar com o próprio item, o destino é um descendente dele
    const visited = new Set<string>();
    let cursor: KanbanChecklistItem | undefined = newParent;
    while (cursor) {
      if (cursor.id === id) throw new Error('Não dá pra mover um item pra dentro dele mesmo ou de um sub-item dele');
      if (visited.has(cursor.id)) break; // defesa: já existia um ciclo nos dados
      visited.add(cursor.id);
      const parentId: string | null = cursor.parentItemId;
      cursor = parentId ? data.checklistItems.find((i) => i.id === parentId) : undefined;
    }
  }

  const siblings = data.checklistItems
    .filter((i) => i.cardId === item.cardId && (i.parentItemId ?? null) === newParentId && i.id !== id)
    .sort((a, b) => a.position - b.position);

  let insertAt = siblings.length;
  if (afterItemId) {
    const afterIndex = siblings.findIndex((s) => s.id === afterItemId);
    if (afterIndex >= 0) insertAt = afterIndex + 1;
  }

  const oldParentId = item.parentItemId ?? null;
  item.parentItemId = newParentId;
  siblings.splice(insertAt, 0, item);
  siblings.forEach((s, index) => { s.position = index; });

  syncAncestorsStatus(data.checklistItems, oldParentId); // o pai de onde saiu pode ter ficado 'done'
  syncAncestorsStatus(data.checklistItems, newParentId); // e o de onde entrou pode ter deixado de estar

  await saveKanbanData(data);
}

export interface ParsedChecklistLine { title: string; status: ChecklistItemStatus; depth: number }

/**
 * Aceita `- [ ] Texto` (não iniciado) / `- [~] Texto` ou `- [-] Texto` (em andamento) / `- [x] Texto`
 * (`x` case-insensitive, feito), marcador `-`/`*` opcional, e até uma linha "pelada" (só o texto, vira item
 * não iniciado) — não obriga a sintaxe toda pra não travar quem só quer colar uma lista rápida. Indentação:
 * 2 espaços = 1 nível; um `\t` conta como 2 espaços pro cálculo. Linha em branco é ignorada (não vira item
 * vazio nem quebra a contagem de profundidade das linhas ao redor).
 */
export function parseChecklistText(text: string): ParsedChecklistLine[] {
  const result: ParsedChecklistLine[] = [];
  for (const rawLine of text.split('\n')) {
    if (!rawLine.trim()) continue;
    const leading = rawLine.match(/^[ \t]*/)?.[0] ?? '';
    const spaceUnits = leading.replace(/\t/g, '  ').length;
    const depth = Math.floor(spaceUnits / 2);
    const rest = rawLine.trim().replace(/^[-*]\s*/, '');
    const checkboxMatch = rest.match(/^\[( |x|X|~|-)\]\s*(.*)$/);
    if (checkboxMatch) {
      const mark = checkboxMatch[1].toLowerCase();
      const status: ChecklistItemStatus = mark === 'x' ? 'done' : (mark === '~' || mark === '-') ? 'in_progress' : 'not_started';
      result.push({ title: checkboxMatch[2].trim(), status, depth });
    } else {
      result.push({ title: rest, status: 'not_started', depth });
    }
  }
  return result;
}

/**
 * Substitui A CHECKLIST INTEIRA do card pelo que está em `text` (formato de parseChecklistText). Mais simples
 * e confiável do que tentar casar cada linha do texto editado com um item existente por id — o preço é que os
 * ids antigos se perdem (não tem nada de fora do card referenciando item de checklist por id, então tudo bem).
 * `status` de uma linha COM filhos é ignorado de propósito: igual ao resto do app, o estado do pai é sempre
 * DERIVADO dos filhos (syncAncestorsStatus), nunca lido diretamente do que o usuário marcou na linha do pai.
 */
export async function replaceAllFromText(cardId: string, text: string): Promise<void> {
  const parsed = parseChecklistText(text);

  const data = await loadNormalized();
  data.checklistItems = data.checklistItems.filter((i) => i.cardId !== cardId);
  await saveKanbanData(data);

  const hasChildAt = parsed.map((line, idx) => {
    const next = parsed[idx + 1];
    return !!next && next.depth > line.depth;
  });

  const stack: (string | null)[] = [null]; // índice = depth, valor = id do item pai naquele nível
  const leafStatuses: { id: string; status: ChecklistItemStatus }[] = []; // itens SEM filhos com status != not_started — setados por último, sync sobe sozinho

  for (let i = 0; i < parsed.length; i++) {
    const { title, status, depth } = parsed[i];
    const parentId = depth === 0 ? null : stack[depth - 1] ?? null;
    const id = parentId ? await createSubItem(cardId, parentId, title) : await createItem(cardId, title);
    stack[depth] = id;
    stack.length = depth + 1; // sair de um nível invalida qualquer ancestral mais fundo que já não é mais "o atual"
    if (status !== 'not_started' && !hasChildAt[i]) leafStatuses.push({ id, status });
  }

  for (const { id, status } of leafStatuses) await updateItem(id, { status });
}

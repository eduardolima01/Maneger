import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCorners,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { convertFileSrc } from '@tauri-apps/api/core';
import KanbanColumn from './KanbanColumn';
import KanbanBackgroundModal from '@/Kanban/components/Kanbanbackgroundmodal';
import KanbanCalendarView from '@/Kanban/components/Kanbancalendarview';
import KanbanToolbar from './KanbanToolbar';
import KanbanColumnSettingsModal from './KanbanColumnSettingsModal';
import KanbanCardModal from './KanbanCardModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useKanbanBoard } from '@/lib/hooks/useKanbanBoard';
import { updateKanban } from '@/lib/api/kanban/kanbans';
import type { Kanban, CardFieldConfig, CardVisualFieldConfig } from '@/types/kanban.types';
import { mergeCardFieldConfig, mergeCardVisualConfig } from '@/types/kanban.types';
import { clearGroupLabels, ParsedLabel, parseLabel, setSingleGroupLabel } from '@/Kanban/utils/kanbanLabels';
import LabelManagerModal from './LabelManagerModal';
import Button from '@/components/layout/Button';
import KanbanGenerateCardsModal from '@/Kanban/components/KanbanGenerateCardsModal';
import ColumnOutline from '@/Kanban/components/ColumnOutline';
import { CardMoveContext } from '@/lib/utils/CardMoveContext';
import { LabelIconContext } from '@/Kanban/hooks/Labeliconcontext';
import { GroupLayoutContext } from '@/Kanban/components/GroupLayoutContext';
import UpcomingCardsPanel from '@/Kanban/components/UpcomingCardsPanel';

interface KanbanBoardProps {
  kanban: Kanban;
}

const DEFAULT_COLUMN_WIDTH = 280;
const EMPTY_COLUMN_WIDTH = 160;

export default function KanbanBoard({ kanban }: KanbanBoardProps) {

  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [labelManagerOpen, setLabelManagerOpen] = useState(false);
  const [upcomingPanelOpen, setUpcomingPanelOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<string | null>(null);
  const [newCardColumnId, setNewCardColumnId] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [planMode, setPlanMode] = useState(false);
  const [planStartDate, setPlanStartDate] = useState('');
  const [planEndDate, setPlanEndDate] = useState('');
  const [planWeekdays, setPlanWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [planTimesPerDay, setPlanTimesPerDay] = useState(1);
  const [planTargetColumnId, setPlanTargetColumnId] = useState<string>('');
  const [planTargetGroupId, setPlanTargetGroupId] = useState<string>('');
  const [newGroupColumnId, setNewGroupColumnId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const newGroupInputRef = useRef<HTMLInputElement>(null);
  const newCardInputRef = useRef<HTMLTextAreaElement>(null);
  const board = useKanbanBoard(kanban);

  const deleteGroupCardCount = useMemo(() => {
    if (!deleteGroupTarget) return 0;
    const groupIds = new Set<string>();
    function collect(id: string) {
      groupIds.add(id);
      for (const g of board.groups) {
        if (g.parentGroupId === id) collect(g.id);
      }
    }
    collect(deleteGroupTarget);
    return board.cards.filter((c) => c.cardGroupId && groupIds.has(c.cardGroupId)).length;
  }, [deleteGroupTarget, board.groups, board.cards]);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectionBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [calendarCollapsed, setCalendarCollapsed] = useState(false);
  const [showArchivedColumns, setShowArchivedColumns] = useState(false);
  const [focusedColumnId, setFocusedColumnId] = useState<string | null>(null);
  const archivedColumns = board.columns.filter((c) => !c.visible).sort((a, b) => a.position - b.position);
  const [backgroundModalOpen, setBackgroundModalOpen] = useState(false);
  const [background, setBackground] = useState<{ backgroundColor: string | null; backgroundImagePath: string | null }>({
    backgroundColor: kanban.backgroundColor,
    backgroundImagePath: kanban.backgroundImagePath,
  });

  // Se o usuário trocar de kanban (ex: abrir um sub-kanban dentro de um card), o plano de
  // fundo local precisa acompanhar — sem isso ficaria mostrando o fundo do kanban anterior.
  useEffect(() => {
    setBackground({ backgroundColor: kanban.backgroundColor, backgroundImagePath: kanban.backgroundImagePath });
  }, [kanban.id, kanban.backgroundColor, kanban.backgroundImagePath]);

  function handleUpdateBackground(input: Partial<{ backgroundColor: string | null; backgroundImagePath: string | null }>) {
    setBackground((prev) => ({ ...prev, ...input }));
    updateKanban(kanban.id, input);
  }

  const [cardFieldConfig, setCardFieldConfig] = useState<CardFieldConfig[]>(mergeCardFieldConfig(kanban.cardFieldConfig));

  useEffect(() => {
    setCardFieldConfig(mergeCardFieldConfig(kanban.cardFieldConfig));
  }, [kanban.id, kanban.cardFieldConfig]);

  function handleUpdateCardFieldConfig(config: CardFieldConfig[]) {
    setCardFieldConfig(config);
    updateKanban(kanban.id, { cardFieldConfig: config });
  }

  const [cardVisualConfig, setCardVisualConfig] = useState<CardVisualFieldConfig[]>(mergeCardVisualConfig(kanban.cardVisualConfig));

  useEffect(() => {
    setCardVisualConfig(mergeCardVisualConfig(kanban.cardVisualConfig));
  }, [kanban.id, kanban.cardVisualConfig]);

  function handleUpdateCardVisualConfig(config: CardVisualFieldConfig[]) {
    setCardVisualConfig(config);
    updateKanban(kanban.id, { cardVisualConfig: config });
  }

  const [focusDescriptionToken, setFocusDescriptionToken] = useState<number | undefined>(undefined);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const visibleColumns = board.columns.filter((c) => c.visible);
  const displayedColumns = showArchivedColumns ? [...visibleColumns, ...archivedColumns] : visibleColumns;
  // Modo foco: só a coluna escolhida. Se ela deixar de aparecer (arquivada, excluída), volta ao quadro normal.
  const focusedColumn = focusedColumnId ? displayedColumns.find((c) => c.id === focusedColumnId) ?? null : null;
  const columnsToRender = focusedColumn ? [focusedColumn] : displayedColumns;

  const groupsByParent = useMemo(() => {
    const map = new Map<string, typeof board.groups>();
    for (const g of board.groups) {
      if (!g.parentGroupId) continue;
      const list = map.get(g.parentGroupId) ?? [];
      list.push(g);
      map.set(g.parentGroupId, list);
    }
    return map;
  }, [board.groups]);

  // Agora vai pelo hook de verdade (useKanbanBoard.ts já tem createSubgroup, que chama reload()
  // como todas as outras mutações) — a tela atualiza sozinha, sem precisar recarregar a página.
  const allLabels = Array.from(new Set(board.cards.flatMap((c) => c.labels)));

  const allParsedLabels: ParsedLabel[] = useMemo(() => {
    const map = new Map<string, { color: string; isGroup: boolean }>();
    // definedLabels primeiro: etiquetas sem uso nenhum ainda entram no catálogo; se a mesma etiqueta
    // também estiver em uso em algum card/grupo, as ocorrências abaixo sobrescrevem cor/isGroup normalmente.
    for (const raw of [...(board.viewPrefs.definedLabels ?? []), ...board.cards.flatMap((c) => c.labels), ...board.groups.flatMap((g) => g.labels ?? [])]) {
      const { name, color, isGroup } = parseLabel(raw);
      const existing = map.get(name);
      if (!existing) {
        map.set(name, { color, isGroup });
      } else if (isGroup && !existing.isGroup) {
        // se QUALQUER ocorrência do nome for "de grupo", trata a etiqueta como de grupo
        // (mesmo critério usado em fixInconsistentGroupLabels — evita mostrar desmarcado por causa de uma ocorrência antiga não corrigida)
        map.set(name, { color: existing.color, isGroup: true });
      }
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, color: v.color, isGroup: v.isGroup }));
  }, [board.cards, board.groups, board.viewPrefs.definedLabels]);

  const labelCardCounts: Record<string, number> = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const raw of board.cards.flatMap((c) => c.labels)) {
      const { name } = parseLabel(raw);
      counts[name] = (counts[name] ?? 0) + 1;
    }
    return counts;
  }, [board.cards]);

  const labelGroupCounts: Record<string, number> = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const raw of board.groups.flatMap((g) => g.labels ?? [])) {
      const { name } = parseLabel(raw);
      counts[name] = (counts[name] ?? 0) + 1;
    }
    return counts;
  }, [board.groups]);

  const labelIconValue = useMemo(
    () => ({ icons: board.viewPrefs.labelIcons ?? {}, setIcon: board.setLabelIcon }),
    [board.viewPrefs.labelIcons, board.setLabelIcon]
  );

  const groupLayoutValue = useMemo(() => {
    const ids = new Set(board.viewPrefs.horizontalGroupIds ?? []);
    return {
      horizontalIds: ids,
      toggleHorizontal: (groupId: string) => {
        const next = new Set(ids);
        if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
        board.saveViewPrefs({ horizontalGroupIds: Array.from(next) });
      },
    };
  }, [board.viewPrefs.horizontalGroupIds, board.saveViewPrefs]);
  const collapsedIds = new Set(board.viewPrefs.collapsedColumnIds);
  const collapsedGroupIds = new Set(board.viewPrefs.collapsedGroupIds);
  const selectedCard = selectedCardId ? board.cards.find((c) => c.id === selectedCardId) ?? null : null;

  function toggleCardSelection(cardId: string) {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId); else next.add(cardId);
      return next;
    });
  }

  const handleSelectionMouseMove = useCallback((e: MouseEvent) => {
    const start = selectionStartRef.current;
    if (!start) return;
    const box = {
      x: Math.min(start.x, e.clientX),
      y: Math.min(start.y, e.clientY),
      width: Math.abs(e.clientX - start.x),
      height: Math.abs(e.clientY - start.y),
    };
    selectionBoxRef.current = box;
    setSelectionBox(box);
  }, []);

  const handleSelectionMouseUp = useCallback(() => {
    window.removeEventListener('mousemove', handleSelectionMouseMove);
    window.removeEventListener('mouseup', handleSelectionMouseUp);
    const box = selectionBoxRef.current;
    selectionStartRef.current = null;
    selectionBoxRef.current = null;
    setSelectionBox(null);
    if (!box || (box.width < 4 && box.height < 4)) return; // arrasto mínimo — evita disparo em Ctrl+clique sem arrastar

    const cardEls = boardContainerRef.current?.querySelectorAll<HTMLElement>('[data-kanban-card]');
    if (!cardEls) return;
    const boxRight = box.x + box.width;
    const boxBottom = box.y + box.height;
    const hitIds: string[] = [];
    cardEls.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.left < boxRight && r.right > box.x && r.top < boxBottom && r.bottom > box.y) {
        const id = el.getAttribute('data-kanban-card');
        if (id) hitIds.push(id);
      }
    });
    if (hitIds.length === 0) return;
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      for (const id of hitIds) {
        if (next.has(id)) next.delete(id); else next.add(id);
      }
      return next;
    });
  }, [handleSelectionMouseMove]);

  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-kanban-card], button, input, textarea, select')) return; // clique em card/controle já tem seu próprio handler
    e.preventDefault();
    selectionStartRef.current = { x: e.clientX, y: e.clientY };
    setSelectionBox({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
    window.addEventListener('mousemove', handleSelectionMouseMove);
    window.addEventListener('mouseup', handleSelectionMouseUp);
  }, [handleSelectionMouseMove, handleSelectionMouseUp]);

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleSelectionMouseMove);
      window.removeEventListener('mouseup', handleSelectionMouseUp);
    };
  }, [handleSelectionMouseMove, handleSelectionMouseUp]);

  function handleCardClick(cardId: string, focusDescription?: boolean) {
    setSelectedCardIds(new Set()); // clique normal sai do modo seleção múltipla
    setSelectedCardId(cardId);
    if (focusDescription) setFocusDescriptionToken((t) => (t ?? 0) + 1);
  }

  /** Clique numa ocorrência virtual do calendário: materializa a ocorrência num card real e abre pra edição. */
  async function handleVirtualOccurrenceClick(planId: string, date: string, occurrenceIndex: number) {
    const id = await board.materializePlanOccurrence(planId, date, occurrenceIndex);
    handleCardClick(id);
  }

  async function handleCreateGroup() {
    if (!newGroupColumnId || !newGroupName.trim()) return;
    await board.createGroup(newGroupColumnId, newGroupName.trim());
    setNewGroupName('');
    newGroupInputRef.current?.focus(); // mesmo padrão do card: mantém aberto pra criar vários em sequência
  }

  function toggleColumnCollapsed(columnId: string) {
    const next = collapsedIds.has(columnId)
      ? board.viewPrefs.collapsedColumnIds.filter((id) => id !== columnId)
      : [...board.viewPrefs.collapsedColumnIds, columnId];
    board.saveViewPrefs({ collapsedColumnIds: next });
  }


  function toggleGroupCollapsed(groupId: string) {
    const next = collapsedGroupIds.has(groupId)
      ? board.viewPrefs.collapsedGroupIds.filter((id) => id !== groupId)
      : [...board.viewPrefs.collapsedGroupIds, groupId];
    board.saveViewPrefs({ collapsedGroupIds: next });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType === 'column') {
      if (active.id === over.id) return;
      const ids = visibleColumns.map((c) => c.id);
      const fromIndex = ids.indexOf(active.id as string);
      const toIndex = ids.indexOf(over.id as string);
      if (fromIndex === -1 || toIndex === -1) return;
      board.reorderColumns(arrayMove(ids, fromIndex, toIndex));
      return;
    }

    if (activeType === 'group') {
      const groupId = activeId.replace('group:', '');
      const targetColumnId =
        (over.data.current?.type === 'column' && (over.data.current?.columnId as string)) ||
        findColumnOfSortableItem(overId);
      if (!targetColumnId) return;

      const itemsInTarget = combinedItemIdsForColumn(targetColumnId).filter((id) => id !== activeId);
      const overIndex = itemsInTarget.indexOf(overId);
      if (overIndex !== -1) itemsInTarget.splice(overIndex, 0, activeId);
      else itemsInTarget.push(activeId);

      board.moveGroupToColumn(groupId, targetColumnId, itemsInTarget.map(stripPrefix));
      return;
    }

    if (activeType === 'card') {
      const cardId = activeId.replace('card:', '');
      const activeCard = board.cards.find((c) => c.id === cardId);

      // resolve pra onde estruturalmente o card vai (grupo manual ou coluna solta) e, se for o caso,
      // qual etiqueta de subgrupo o alvo representa (pra sincronizar a etiqueta do card com o destino)
      let targetKind: 'group' | 'column' | null = null;
      let targetScopeId: string | null = null;
      let targetLabel: { name: string; color: string } | null = null;

      if (overType === 'label-group') {
        const data = over.data.current as { scopeType: 'group' | 'column'; scopeId: string; labelName: string; labelColor: string };
        targetKind = data.scopeType;
        targetScopeId = data.scopeId;
        targetLabel = { name: data.labelName, color: data.labelColor };
      } else if (overType === 'group') {
        targetKind = 'group';
        targetScopeId = over.data.current?.groupId as string;
      } else if (overId.startsWith('card:')) {
        const overCardId = overId.replace('card:', '');
        const overCard = board.cards.find((c) => c.id === overCardId);
        if (overCard) {
          if (overCard.cardGroupId) {
            targetKind = 'group';
            targetScopeId = overCard.cardGroupId;
          } else if (overCard.columnId) {
            targetKind = 'column';
            targetScopeId = overCard.columnId;
          }
          const overGroupLabel = overCard.labels
            .map(parseLabel)
            .filter((l) => l.isGroup)
            .sort((a, b) => a.name.localeCompare(b.name))[0];
          if (overGroupLabel) targetLabel = { name: overGroupLabel.name, color: overGroupLabel.color };
        }
      } else {
        const columnId =
          (over.data.current?.type === 'column' && (over.data.current?.columnId as string)) ||
          findColumnOfSortableItem(overId);
        if (columnId) { targetKind = 'column'; targetScopeId = columnId; }
      }

      if (!targetKind || !targetScopeId) return;

      const isMultiMove = selectedCardIds.has(cardId) && selectedCardIds.size > 1;
      if (isMultiMove) {
        const movingIds = board.cards
          .filter((c) => selectedCardIds.has(c.id))
          .sort((a, b) => a.position - b.position)
          .map((c) => c.id);

        const existingScopeCards = targetKind === 'group'
          ? (board.cardsByGroup.get(targetScopeId) ?? [])
          : (board.ungroupedCardsByColumn.get(targetScopeId) ?? []);
        const existingIds = existingScopeCards.map((c) => c.id).filter((id) => !selectedCardIds.has(id));
        const overIndex = overId.startsWith('card:') ? existingIds.indexOf(overId.replace('card:', '')) : -1;
        const finalOrder = overIndex !== -1
          ? [...existingIds.slice(0, overIndex), ...movingIds, ...existingIds.slice(overIndex)]
          : [...existingIds, ...movingIds];

        await board.bulkMoveCards(
          movingIds,
          targetKind === 'group' ? { kind: 'group', groupId: targetScopeId } : { kind: 'column', columnId: targetScopeId },
          finalOrder
        );

        await Promise.all(movingIds.map((id) => {
          const c = board.cards.find((cc) => cc.id === id);
          if (!c) return Promise.resolve();
          const nextLabels = targetLabel ? setSingleGroupLabel(c.labels, targetLabel.name, targetLabel.color) : clearGroupLabels(c.labels);
          if (nextLabels.length === c.labels.length && nextLabels.every((l, i) => l === c.labels[i])) return Promise.resolve();
          return board.updateCard(id, { labels: nextLabels });
        }));
        return;
      }

      // Alt segurado = duplicar em vez de mover. O card original nunca é tocado;
      // criamos o duplicado e aplicamos nele toda a lógica de posicionamento abaixo.
      const isDuplicating = altPressedRef.current;
      const effectiveCardId = isDuplicating ? await board.duplicateCard(cardId) : cardId;

      if (targetKind === 'group') {
        const cardsInGroup = (board.cardsByGroup.get(targetScopeId) ?? [])
          .map((c) => c.id)
          .filter((id) => id !== effectiveCardId);
        const overIndex = overId.startsWith('card:') ? cardsInGroup.indexOf(overId.replace('card:', '')) : -1;
        if (overIndex !== -1) cardsInGroup.splice(overIndex, 0, effectiveCardId); else cardsInGroup.push(effectiveCardId);
        board.moveCardIntoGroup(effectiveCardId, targetScopeId, cardsInGroup);
      } else {
        const cardsInTarget = (board.ungroupedCardsByColumn.get(targetScopeId) ?? [])
          .map((c) => c.id)
          .filter((id) => id !== effectiveCardId);
        const overIndex = overId.startsWith('card:') ? cardsInTarget.indexOf(overId.replace('card:', '')) : -1;
        if (overIndex !== -1) cardsInTarget.splice(overIndex, 0, effectiveCardId); else cardsInTarget.push(effectiveCardId);

        if (!isDuplicating && activeCard?.cardGroupId) {
          board.moveCardOutOfGroup(cardId, targetScopeId, cardsInTarget);
        } else {
          board.moveCard(effectiveCardId, targetScopeId, cardsInTarget);
        }
      }

      // sincroniza a etiqueta de grupo: entrou num subgrupo → recebe a etiqueta; saiu de qualquer subgrupo → perde a etiqueta
      if (activeCard) {
        const nextLabels = targetLabel
          ? setSingleGroupLabel(activeCard.labels, targetLabel.name, targetLabel.color)
          : clearGroupLabels(activeCard.labels);
        const changed = nextLabels.length !== activeCard.labels.length || nextLabels.some((l, i) => l !== activeCard.labels[i]);
        if (changed) board.updateCard(effectiveCardId, { labels: nextLabels });
      }
    }
  }

  function findColumnOfSortableItem(id: string): string | undefined {
    if (id.startsWith('card:')) {
      const cardId = id.replace('card:', '');
      return board.cards.find((c) => c.id === cardId && c.columnId)?.columnId ?? undefined;
    }
    if (id.startsWith('group:')) {
      const groupId = id.replace('group:', '');
      return board.groups.find((g) => g.id === groupId)?.columnId;
    }
    return undefined;
  }


  function combinedItemIdsForColumn(columnId: string): string[] {
    const groupIds = (board.groupsByColumn.get(columnId) ?? []).map((g) => `group:${g.id}`);
    const cardIds = (board.ungroupedCardsByColumn.get(columnId) ?? []).map((c) => `card:${c.id}`);
    return [...groupIds, ...cardIds];
  }

  function stripPrefix(id: string): string {
    return id.replace('group:', '').replace('card:', '');
  }

  function resetPlanForm() {
    setPlanMode(false);
    setPlanStartDate('');
    setPlanEndDate('');
    setPlanWeekdays([0, 1, 2, 3, 4, 5, 6]);
    setPlanTimesPerDay(1);
    setPlanTargetColumnId('');
    setPlanTargetGroupId('');
  }

  function togglePlanWeekday(day: number) {
    setPlanWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  /** Grupos/subgrupos de uma coluna, em ordem hierárquica, com o nome recuado por profundidade. */
  function flattenGroupsForColumn(columnId: string): { id: string; label: string }[] {
    const result: { id: string; label: string }[] = [];
    function walk(parentId: string | null, depth: number) {
      const siblings = board.groups
        .filter((g) => g.columnId === columnId && g.parentGroupId === parentId)
        .sort((a, b) => a.position - b.position);
      for (const g of siblings) {
        result.push({ id: g.id, label: `${'— '.repeat(depth)}${g.name}` });
        walk(g.id, depth + 1);
      }
    }
    walk(null, 0);
    return result;
  }

  async function handleCreateCard() {
    if (!newCardColumnId) return;
    if (planMode) {
      if (!newCardTitle.trim() || !planStartDate || !planEndDate || planWeekdays.length === 0) return;
      await board.createPlanCard(
        newCardColumnId, planTargetColumnId || null, planTargetGroupId || null,
        newCardTitle.trim(), planStartDate, planEndDate, planWeekdays, planTimesPerDay
      );
      setNewCardTitle('');
      setNewCardColumnId(null);
      resetPlanForm();
      return;
    }
    const lines = newCardTitle.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    for (const line of lines) {
      await board.createCard(newCardColumnId, line);
    }
    setNewCardTitle('');
    newCardInputRef.current?.focus();
  }
  const altPressedRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Alt') altPressedRef.current = true; };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Alt') altPressedRef.current = false; };
    const onBlur = () => { altPressedRef.current = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    if (selectedCardIds.size === 0) return;
    function onEscape(e: KeyboardEvent) { if (e.key === 'Escape') setSelectedCardIds(new Set()); }
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [selectedCardIds.size]);

  const cardMoveValue = useMemo(() => ({
    columns: board.columns.filter((c) => c.visible),
    groups: board.groups,
    moveCards: board.moveCardsTo,
  }), [board.columns, board.groups, board.moveCardsTo]);

  return (
    <CardMoveContext.Provider value={cardMoveValue}>
      <LabelIconContext.Provider value={labelIconValue}>
        <GroupLayoutContext.Provider value={groupLayoutValue}>
          <div
            style={{
              borderRadius: 8,
              padding: background.backgroundImagePath || background.backgroundColor ? 12 : 0,
              ...(background.backgroundImagePath
                ? {
                  backgroundImage: `url(${convertFileSrc(background.backgroundImagePath)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }
                : background.backgroundColor
                  ? { backgroundColor: background.backgroundColor }
                  : {}),
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, backgroundColor: '#fff', padding: 8, borderRadius: 8 }}>
              <div style={{ flex: 1 }}>
                <KanbanToolbar
                  search={board.search}
                  onSearchChange={board.setSearch}
                  filters={board.filters}
                  onFiltersChange={board.setFilters}
                  filtersActive={board.filtersActive}
                  availableLabels={allLabels}
                  density={board.viewPrefs.density}
                  onDensityChange={(density) => board.saveViewPrefs({ density })}
                  onOpenColumnSettings={() => setColumnSettingsOpen(true)}
                  onOpenLabelManager={() => setLabelManagerOpen(true)}
                />
              </div>
              <Button variant="secondary" onClick={() => setUpcomingPanelOpen((v) => !v)}>
                {upcomingPanelOpen ? '🕐 Ocultar próximos' : '🕐 Mais próximos'}
              </Button>
              <Button variant="secondary" onClick={() => setCalendarCollapsed((v) => !v)}>
                {calendarCollapsed ? '📅 Mostrar calendário' : '📅 Recolher calendário'}
              </Button>
              <Button variant="secondary" onClick={() => setShowArchivedColumns((v) => !v)}>
                {showArchivedColumns ? '🗄 Ocultar arquivadas' : `🗄 Arquivadas${archivedColumns.length > 0 ? ` (${archivedColumns.length})` : ''}`}
              </Button>
              <Button variant="secondary" onClick={() => setBackgroundModalOpen(true)}>🎨 Fundo</Button>
              <Button variant="secondary" onClick={() => setGenerateModalOpen(true)}>+ Gerar cards</Button>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <>
                  <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                    <SortableContext items={columnsToRender.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
                      <div
                        ref={boardContainerRef}
                        onMouseDown={handleContainerMouseDown}
                        style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'stretch', minHeight: 400 }}
                      >
                        {focusedColumn && (
                          <ColumnOutline
                            column={focusedColumn}
                            groups={board.groups.filter((g) => g.columnId === focusedColumn.id)}
                            cardsByGroup={board.cardsByGroup}
                            looseCardCount={(board.ungroupedCardsByColumn.get(focusedColumn.id) ?? []).length}
                            collapsedGroupIds={collapsedGroupIds}
                            onChangeCollapsed={(ids) => board.saveViewPrefs({ collapsedGroupIds: ids })}
                            onExit={() => setFocusedColumnId(null)}
                          />
                        )}
                        {columnsToRender.map((col) => (
                          <div key={col.id} style={{ display: 'flex', flexDirection: 'column', ...(focusedColumn ? { flex: 1, minWidth: 0 } : {}) }}>
                            {(() => {
                              const columnCards = board.ungroupedCardsByColumn.get(col.id) ?? [];
                              // filtro defensivo: groupsByColumn (calculado no hook) ainda não sabe distinguir
                              // subgrupo de grupo top-level — sem isso, um subgrupo apareceria duplicado
                              // (uma vez solto na coluna, outra vez aninhado dentro do grupo-pai).
                              const columnGroups = (board.groupsByColumn.get(col.id) ?? []).filter((g) => !g.parentGroupId);
                              const isEmpty = columnCards.length === 0 && columnGroups.length === 0;
                              const customWidth = board.viewPrefs.columnWidths[col.id];
                              const resolvedWidth = customWidth ?? (isEmpty ? EMPTY_COLUMN_WIDTH : DEFAULT_COLUMN_WIDTH);
                              return (
                                <KanbanColumn
                                  column={col}
                                  cards={columnCards}
                                  groups={columnGroups}
                                  cardsByGroup={board.cardsByGroup}
                                  collapsedGroupIds={collapsedGroupIds}
                                  onToggleGroupCollapsed={toggleGroupCollapsed}
                                  density={board.viewPrefs.density}
                                  visualConfig={cardVisualConfig}
                                  width={resolvedWidth}
                                  collapsed={collapsedIds.has(col.id)}
                                  onToggleCollapsed={() => toggleColumnCollapsed(col.id)}
                                  onRename={(name) => board.updateColumn(col.id, { name })}
                                  onColumnMenu={() => setColumnSettingsOpen(true)}
                                  cardsWithSubKanban={board.cardsWithSubKanban}
                                  cardsWithFiles={board.cardsWithFiles}
                                  onCardDuplicate={board.duplicateCard}
                                  checklistProgress={board.checklistProgress}
                                  onCardRequestDelete={(id, title) => setDeleteTarget({ id, title })}
                                  onRenameGroup={board.renameGroup}
                                  onRequestDeleteGroup={(groupId) => setDeleteGroupTarget(groupId)}
                                  onAddCardToGroup={board.createCardInGroup}
                                  onCreateSubgroup={board.createSubgroup}
                                  onUpdateGroupAppearance={board.updateGroupAppearance}
                                  groupsByParent={groupsByParent}
                                  groupHeights={board.viewPrefs.groupHeights ?? {}}
                                  onResizeGroupHeight={(groupId, h) => board.saveViewPrefs({ groupHeights: { ...(board.viewPrefs.groupHeights ?? {}), [groupId]: h } })}
                                  onReorderGroupCards={board.reorderCardsInGroup}
                                  allLabels={allParsedLabels}
                                  onUpdateCardLabels={(id, labels) => board.updateCard(id, { labels })}
                                  onUpdateCardDueDate={(id, dueDate) => board.updateCard(id, { dueDate })}
                                  onUpdateCardStartDate={(id, startDate) => board.updateCard(id, { startDate })}
                                  onUpdateCardDescription={(id, description) => board.updateCard(id, { description })}
                                  onUpdateCardTitle={(id, title) => board.updateCard(id, { title })}
                                  onUpdateCardColor={(id, color) => board.updateCard(id, { color })}
                                  onUpdateCardStatus={(id, status) => board.updateCard(id, { status })}
                                  onDuplicateMultiple={board.duplicateCardMultiple}
                                  onUpdateCoverPath={(id, path) => board.updateCard(id, { coverPath: path })}
                                  onUpdateColumnCover={(path) => board.updateColumn(col.id, { coverPath: path })}
                                  onResizeColumnWidth={(newWidth) => board.saveViewPrefs({ columnWidths: { ...board.viewPrefs.columnWidths, [col.id]: newWidth } })}
                                  onArchive={() => board.updateColumn(col.id, { visible: !col.visible })}
                                  backgroundColor={board.viewPrefs.columnBackgrounds?.[col.id] ?? null}
                                  onUpdateBackgroundColor={(color) => {
                                    const next = { ...(board.viewPrefs.columnBackgrounds ?? {}) };
                                    if (color) next[col.id] = color; else delete next[col.id];
                                    board.saveViewPrefs({ columnBackgrounds: next });
                                  }}
                                  focused={!!focusedColumn}
                                  onToggleFocus={() => setFocusedColumnId(focusedColumn ? null : col.id)}

                                  onCardClick={handleCardClick}
                                  selectedCardIds={selectedCardIds}
                                  onCardSelectToggle={toggleCardSelection}
                                  onBulkDelete={() => setBulkDeleteConfirm(true)}
                                  onBulkSetColor={board.bulkSetColor}
                                  onBulkSetStatus={board.bulkSetStatus}
                                  onBulkToggleLabel={board.bulkToggleLabel}
                                  projectId={kanban.projectId}
                                />
                              );
                            })()}
                            {!collapsedIds.has(col.id) && (
                              newCardColumnId === col.id ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, backgroundColor: '#fff', padding: 6, borderRadius: 4 }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#666', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={planMode} onChange={(e) => setPlanMode(e.target.checked)} />
                                    🗓 Criar como plano (gera cards diários no calendário)
                                  </label>
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <textarea
                                      ref={newCardInputRef}
                                      autoFocus
                                      value={newCardTitle}
                                      onChange={(e) => setNewCardTitle(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey && !planMode) {
                                          e.preventDefault();
                                          handleCreateCard();
                                        }
                                      }}
                                      onBlur={() => !newCardTitle.trim() && !planMode && setNewCardColumnId(null)}
                                      placeholder={planMode ? 'Título do plano...' : 'Título do card... (Shift+Enter = várias linhas viram vários cards)'}
                                      rows={planMode ? 1 : 2}
                                      style={{ flex: 1, padding: 6, fontSize: 12, resize: 'vertical', fontFamily: 'inherit' }}
                                    />
                                    {!planMode && (
                                      <button
                                        onClick={handleCreateCard}
                                        disabled={!newCardTitle.trim()}
                                        title="Adicionar card"
                                        style={{
                                          padding: '6px 10px', fontSize: 12, border: 'none', borderRadius: 4,
                                          backgroundColor: newCardTitle.trim() ? '#1a73e8' : '#ccc',
                                          color: '#fff', cursor: newCardTitle.trim() ? 'pointer' : 'default',
                                        }}
                                      >
                                        +
                                      </button>
                                    )}
                                  </div>

                                  {planMode && (
                                    <>
                                      <div style={{ display: 'flex', gap: 6 }}>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: 10, color: '#999', display: 'block', marginBottom: 2 }}>Início</label>
                                          <input type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)} style={{ width: '100%', padding: 5, fontSize: 11, boxSizing: 'border-box' }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: 10, color: '#999', display: 'block', marginBottom: 2 }}>Fim</label>
                                          <input type="date" value={planEndDate} onChange={(e) => setPlanEndDate(e.target.value)} style={{ width: '100%', padding: 5, fontSize: 11, boxSizing: 'border-box' }} />
                                        </div>
                                        <div style={{ width: 70 }}>
                                          <label style={{ fontSize: 10, color: '#999', display: 'block', marginBottom: 2 }}>×/dia</label>
                                          <input
                                            type="number"
                                            min={1}
                                            max={20}
                                            value={planTimesPerDay}
                                            onChange={(e) => setPlanTimesPerDay(Math.max(1, Number(e.target.value) || 1))}
                                            style={{ width: '100%', padding: 5, fontSize: 11, boxSizing: 'border-box' }}
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <label style={{ fontSize: 10, color: '#999', display: 'block', marginBottom: 2 }}>Dias da semana ativos</label>
                                        <div style={{ display: 'flex', gap: 3 }}>
                                          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((label, day) => (
                                            <button
                                              key={day}
                                              onClick={() => togglePlanWeekday(day)}
                                              title={['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][day]}
                                              style={{
                                                width: 22, height: 22, fontSize: 10, borderRadius: '50%', cursor: 'pointer',
                                                border: '1px solid #ccc',
                                                backgroundColor: planWeekdays.includes(day) ? '#1a73e8' : '#fff',
                                                color: planWeekdays.includes(day) ? '#fff' : '#666',
                                              }}
                                            >
                                              {label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      <div>
                                        <label style={{ fontSize: 10, color: '#999', display: 'block', marginBottom: 2 }}>
                                          Coluna onde o card nasce ao clicar no calendário
                                        </label>
                                        <select
                                          value={planTargetColumnId}
                                          onChange={(e) => { setPlanTargetColumnId(e.target.value); setPlanTargetGroupId(''); }}
                                          style={{ width: '100%', padding: 5, fontSize: 11, boxSizing: 'border-box' }}
                                        >
                                          <option value="">Nenhuma — fica só no calendário</option>
                                          {visibleColumns.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                          ))}
                                        </select>
                                      </div>
                                      {planTargetColumnId && flattenGroupsForColumn(planTargetColumnId).length > 0 && (
                                        <div>
                                          <label style={{ fontSize: 10, color: '#999', display: 'block', marginBottom: 2 }}>
                                            Grupo/subgrupo (opcional)
                                          </label>
                                          <select
                                            value={planTargetGroupId}
                                            onChange={(e) => setPlanTargetGroupId(e.target.value)}
                                            style={{ width: '100%', padding: 5, fontSize: 11, boxSizing: 'border-box' }}
                                          >
                                            <option value="">Nenhum — direto na coluna</option>
                                            {flattenGroupsForColumn(planTargetColumnId).map((g) => (
                                              <option key={g.id} value={g.id}>{g.label}</option>
                                            ))}
                                          </select>
                                        </div>
                                      )}
                                      <button
                                        onClick={handleCreateCard}
                                        disabled={!newCardTitle.trim() || !planStartDate || !planEndDate || planWeekdays.length === 0}
                                        style={{
                                          padding: '6px 10px', fontSize: 12, border: 'none', borderRadius: 4, marginTop: 2,
                                          backgroundColor: (newCardTitle.trim() && planStartDate && planEndDate && planWeekdays.length > 0) ? '#1a73e8' : '#ccc',
                                          color: '#fff', cursor: 'pointer',
                                        }}
                                      >
                                        + Criar plano
                                      </button>
                                    </>
                                  )}

                                  <button
                                    onClick={() => { setNewCardColumnId(null); setNewCardTitle(''); resetPlanForm(); }}
                                    style={{ fontSize: 11, color: '#666', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                                  >
                                    ✕ Cancelar
                                  </button>
                                </div>

                              ) : (
                                <button
                                  onClick={() => setNewCardColumnId(col.id)}
                                  style={{ marginTop: 4, padding: '6px', fontSize: 12, color: '#666', backgroundColor: '#fff', border: '1px dashed #ccc', borderRadius: 4, cursor: 'pointer' }}
                                >
                                  + Novo card
                                </button>

                              )
                            )}

                            {!collapsedIds.has(col.id) && !newCardColumnId && (
                              newGroupColumnId === col.id ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, backgroundColor: '#fff', padding: 6, borderRadius: 4 }}>
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <input
                                      ref={newGroupInputRef}
                                      autoFocus
                                      value={newGroupName}
                                      onChange={(e) => setNewGroupName(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                                      placeholder="Nome do grupo..."
                                      style={{ flex: 1, padding: 6, fontSize: 12 }}
                                    />
                                    <button
                                      onClick={handleCreateGroup}
                                      disabled={!newGroupName.trim()}
                                      title="Adicionar grupo"
                                      style={{
                                        padding: '6px 10px', fontSize: 12, border: 'none', borderRadius: 4,
                                        backgroundColor: newGroupName.trim() ? '#666' : '#ccc',
                                        color: '#fff', cursor: newGroupName.trim() ? 'pointer' : 'default',
                                      }}
                                    >
                                      +
                                    </button>
                                  </div>
                                  <button
                                    onClick={() => { setNewGroupColumnId(null); setNewGroupName(''); }}
                                    style={{ fontSize: 11, color: '#666', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                                  >
                                    ✕ Cancelar
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setNewGroupColumnId(col.id)}
                                  style={{ marginTop: 4, padding: '4px', fontSize: 11, color: '#999', backgroundColor: '#fff', border: 'none', cursor: 'pointer' }}
                                >
                                  + Novo grupo
                                </button>
                              )
                            )}
                          </div>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>

                  {selectionBox && (
                    <div
                      style={{
                        position: 'fixed', left: selectionBox.x, top: selectionBox.y,
                        width: selectionBox.width, height: selectionBox.height,
                        backgroundColor: 'rgba(26, 115, 232, 0.15)', border: '1px solid #1a73e8',
                        zIndex: 999, pointerEvents: 'none',
                      }}
                    />
                  )}

                  {visibleColumns.length === 0 && !board.loading && (
                    <p style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: 24 }}>
                      Nenhuma coluna visível. Abra "⚙ Colunas" pra criar ou mostrar alguma.
                    </p>
                  )}
                </>
              </div>

              {upcomingPanelOpen && (
                <UpcomingCardsPanel
                  cards={board.cards}
                  columns={visibleColumns}
                  groups={board.groups}
                  onCardClick={handleCardClick}
                  onVirtualOccurrenceClick={handleVirtualOccurrenceClick}
                  onClose={() => setUpcomingPanelOpen(false)}
                />
              )}
            </div>

            {!calendarCollapsed && (
              <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 16 }}>
                <KanbanCalendarView
                  cards={board.cards}
                  columns={board.columns}
                  groups={board.groups}
                  checklistProgress={board.checklistProgress}
                  onCardClick={handleCardClick}
                  onTogglePlanActive={(planId, active) => board.updateCard(planId, { planActive: active })}
                  onVirtualOccurrenceClick={handleVirtualOccurrenceClick}
                  onChangeCardDate={(cardId, updates) => board.updateCard(cardId, updates)}
                />
              </div>
            )}

            <KanbanGenerateCardsModal
              isOpen={generateModalOpen}
              onClose={() => setGenerateModalOpen(false)}
              columns={visibleColumns}
              onGenerate={board.createCardsBatch}
            />

            <KanbanColumnSettingsModal
              isOpen={columnSettingsOpen}
              onClose={() => setColumnSettingsOpen(false)}
              columns={board.columns}
              onCreate={board.createColumn}
              onUpdate={board.updateColumn}
              onDuplicate={board.duplicateColumn}
              onDelete={board.removeColumn}
              onReorder={board.reorderColumns}
            />

            <KanbanBackgroundModal
              isOpen={backgroundModalOpen}
              onClose={() => setBackgroundModalOpen(false)}
              kanban={kanban}
              backgroundColor={background.backgroundColor}
              backgroundImagePath={background.backgroundImagePath}
              onUpdate={handleUpdateBackground}
            />

            <LabelManagerModal
              isOpen={labelManagerOpen}
              onClose={() => setLabelManagerOpen(false)}
              labels={allParsedLabels}
              cardCounts={labelCardCounts}
              groupCounts={labelGroupCounts}
              labelIcons={board.viewPrefs.labelIcons ?? {}}
              onSetLabelIcon={board.setLabelIcon}
              onRename={board.renameLabel}
              onDelete={board.deleteLabel}
              onCreate={board.createLabel}
              onFixInconsistentGroupLabels={board.fixInconsistentGroupLabels}
            />

            <KanbanCardModal
              isOpen={selectedCardId !== null}
              onClose={() => setSelectedCardId(null)}
              card={selectedCard}
              kanban={kanban}
              columns={board.columns}
              groups={board.groups}
              cardFieldConfig={cardFieldConfig}
              onUpdateCardFieldConfig={handleUpdateCardFieldConfig}
              cardVisualConfig={cardVisualConfig}
              onUpdateCardVisualConfig={handleUpdateCardVisualConfig}
              onUpdate={board.updateCard}
              onDuplicate={board.duplicateCard}
              onArchive={board.archiveCard}
              onRequestDelete={(id, title) => setDeleteTarget({ id, title })}
            />

            <ConfirmDialog
              isOpen={bulkDeleteConfirm}
              title={`Excluir ${selectedCardIds.size} cards?`}
              message="Esta ação não pode ser desfeita."
              onConfirm={() => {
                board.bulkDeleteCards(Array.from(selectedCardIds));
                setSelectedCardIds(new Set());
                setBulkDeleteConfirm(false);
              }}
              onCancel={() => setBulkDeleteConfirm(false)}
            />

            <ConfirmDialog
              isOpen={deleteTarget !== null}
              title="Excluir card?"
              message={`Deseja realmente excluir "${deleteTarget?.title}"? Esta ação não pode ser desfeita.`}
              onConfirm={() => {
                if (deleteTarget) board.removeCard(deleteTarget.id);
                setSelectedCardId(null);
                setDeleteTarget(null);
              }}
              onCancel={() => setDeleteTarget(null)}
            />

            {deleteGroupTarget !== null && (
              <div
                onClick={() => setDeleteGroupTarget(null)}
                style={{
                  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: '#fff', borderRadius: 8, padding: 20, width: 380,
                    display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 15 }}>Remover grupo</h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                    {deleteGroupCardCount > 0
                      ? `Esse grupo tem ${deleteGroupCardCount} card${deleteGroupCardCount !== 1 ? 's' : ''} dentro. O que você quer fazer?`
                      : 'Esse grupo está vazio. O que você quer fazer?'}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      onClick={() => {
                        const group = board.groups.find((g) => g.id === deleteGroupTarget);
                        if (group) board.deleteGroup(group.id, group.columnId);
                        setDeleteGroupTarget(null);
                      }}
                      style={{
                        padding: '10px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff',
                        cursor: 'pointer', fontSize: 13, textAlign: 'left', color: '#333',
                      }}
                    >
                      <strong>Desagrupar</strong>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>O grupo some, os cards voltam soltos pra coluna. Nenhum card é apagado.</div>
                    </button>
                    <button
                      onClick={() => {
                        if (deleteGroupTarget) board.deleteGroupWithCards(deleteGroupTarget);
                        setDeleteGroupTarget(null);
                      }}
                      style={{
                        padding: '10px 12px', borderRadius: 6, border: '1px solid #f5c6cb', background: '#fdecea',
                        cursor: 'pointer', fontSize: 13, textAlign: 'left', color: '#c62828',
                      }}
                    >
                      <strong>Excluir grupo e cards</strong>
                      <div style={{ fontSize: 11, marginTop: 2 }}>Apaga o grupo e todos os cards de dentro. Não pode ser desfeito.</div>
                    </button>
                  </div>
                  <button
                    onClick={() => setDeleteGroupTarget(null)}
                    style={{ alignSelf: 'flex-end', padding: '6px 10px', border: 'none', background: 'none', color: '#666', cursor: 'pointer', fontSize: 12 }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </GroupLayoutContext.Provider>
      </LabelIconContext.Provider>
    </CardMoveContext.Provider>
  );
}

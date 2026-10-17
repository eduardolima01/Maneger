import PlanBadge from '@/Kanban/components/PlanBadge';
import PlanDistributionBar from '@/Kanban/components/PlanDistributionBar';
import { useArchive } from '@/Kanban/utils/archiveContext';
import ChecklistSection from '@/Kanban/ChecklistSection';
import { statusIds } from '@/Kanban/utils/customStatuses';
import { StatusSections, GroupByStatusButton } from '@/Kanban/components/StatusGrouping';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragMoveEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { KanbanCard, KanbanCardGroup, KanbanColumn, ChecklistProgress, UpdateKanbanCardGroupInput, TaskStatus, CardVisualFieldConfig } from '@/types/kanban.types';
import { PRIORITY_COLORS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS } from '@/types/kanban.types';
import CopyTitleButton from './CopyTitleButton';
import CardActionsMenu, { type CardActionsHandlers, type BulkCardActions } from './CardActionsMenu';
import CardColorMenu from '@/Kanban/components/CardColorMenu';
import { StatusPickerMenu, StatusHoverPicker } from '@/Kanban/components/StatusPicker';
import { formatUpdatedAt, formatUpdatedAtFull } from '@/Kanban/utils/formatUpdatedAt';
import { useIsCardCut, getCutCardIds, setCutCardIds, clearCutCards } from '@/Kanban/utils/cardClipboard';
import DueDateMenu from '@/Kanban/components/DueDateMenu';
import CardMoveMenu from '@/Kanban/components/CardMoveMenu';
import { useCardMove } from '@/lib/utils/CardMoveContext';
import ContextMenu from '@/components/ui/ContextMenu';
import { getRelativeDue } from '@/Kanban/utils/relativeDate';
import { readableTextColors } from '@/Kanban/utils/readableColors';
import { parseLabel, serializeLabel, type ParsedLabel } from '@/Kanban/utils/kanbanLabels';
import ImageUploadField from '@/components/ImageUploadField';
import EmojiPicker, { type EmojiClickData, EmojiStyle, Theme } from 'emoji-picker-react';
import BackgroundColorPicker from '@/Kanban/components/BackgroundColorPicker';
import BackgroundOpacitySlider from '@/Kanban/components/BackgroundOpacitySlider';
import { withAlpha, blendOverSurface, currentSurfaceHex } from '@/Kanban/utils/colorAlpha';
import CardLabelMenu from '@/Kanban/components/CardLabelMenu';
import LabelIconBadge from '@/Kanban/components/LabelIconBadge';
import { useLabelIcons } from '@/Kanban/hooks/Labeliconcontext';

/** Onde um card pode ser solto: dentro de um grupo/subgrupo, ou solto na coluna (sem grupo). */
export interface TreeMoveTarget {
  kind: 'group' | 'column';
  id: string;
}

/** Edições feitas direto na árvore — o quadro liga cada uma na mesma função que os cards/grupos do quadro já usam. */
export interface TreeActions {
  onAddCardToColumn: (columnId: string, title: string) => unknown;
  onAddCardToGroup: (groupId: string, title: string) => unknown;
  onCreateGroup: (columnId: string, name: string) => unknown;
  onCreateSubgroup: (parentGroupId: string, name: string) => unknown;
  onUpdateCardTitle: (cardId: string, title: string) => void;
  /** Move o card pra `target`, ficando ANTES de `beforeCardId` (null = no fim). */
  onMoveCard: (cardId: string, target: TreeMoveTarget, beforeCardId: string | null) => unknown;
  /** Painel 🎨 do grupo: capa, emoji, descrição, cor de fundo e etiquetas (mesma função do GroupBlock no quadro). */
  onUpdateGroupAppearance: (groupId: string, input: UpdateKanbanCardGroupInput) => unknown;
  /** Catálogo de etiquetas do quadro (o menu de etiquetas do grupo escolhe entre elas). */
  allLabels: ParsedLabel[];
  /** Renomear grupo/subgrupo (dois cliques no nome ou ✎). */
  onRenameGroup: (groupId: string, name: string) => unknown;
  /** Pede pra desagrupar/excluir o grupo/subgrupo: o quadro abre a mesma confirmação de sempre (manter os cards ou apagar junto). */
  onRequestDeleteGroup: (groupId: string) => void;
  /**
   * Arrastar grupo/subgrupo: vira filho de `newParentGroupId` (null = grupo de topo de `columnId`) e `orderedSiblingIds`
   * é a ordem final dos irmãos no destino, incluindo o próprio grupo.
   */
  onMoveGroup: (groupId: string, newParentGroupId: string | null, columnId: string, orderedSiblingIds: string[]) => unknown;
  /** Painel 🎨 da coluna: cor de fundo (null = padrão) e opacidade do fundo (0 a 1). Mesmas preferências do quadro. */
  onUpdateColumnBackground: (columnId: string, color: string | null) => unknown;
  onUpdateColumnOpacity: (columnId: string, opacity: number) => unknown;
  /** Renomear coluna (dois cliques no nome ou ✎). Sem isso, o nome da coluna não é editável na árvore. */
  onRenameColumn?: (columnId: string, name: string) => unknown;
  /** Sobe (-1) ou desce (+1) a coluna na ordem do kanban. */
  onMoveColumn?: (columnId: string, dir: -1 | 1) => unknown;
  /** Colunas arquivadas: mostrar/ocultar na árvore, quantas existem, e arquivar/desarquivar uma coluna. */
  showArchived?: boolean;
  archivedCount?: number;
  onToggleShowArchived?: () => void;
  onToggleColumnArchived?: (columnId: string) => unknown;
  /** Arquivados por coluna (cards + grupos) e o botão "ver arquivados" de cada coluna. */
  archivedCountByColumn?: Map<string, number>;
  showArchivedColumnIds?: Set<string>;
  onToggleColumnShowArchived?: (columnId: string) => void;
}

interface KanbanTreeViewProps {
  /** Colunas a mostrar, já na ordem de exibição (o quadro passa `displayedColumns`). */
  columns: KanbanColumn[];
  /** Todos os grupos E subgrupos do kanban (subgrupo se reconhece por `parentGroupId`). */
  groups: KanbanCardGroup[];
  cardsByGroup: Map<string, KanbanCard[]>;
  /** Cards de cada coluna que não estão em nenhum grupo. */
  ungroupedCardsByColumn: Map<string, KanbanCard[]>;
  checklistProgress: Record<string, ChecklistProgress>;
  /** Chamado quando as tarefas de um card mudaram (bloco flutuante da árvore): o quadro recalcula o resumo. */
  onChecklistChanged?: (cardId: string) => void;
  onCardClick: (cardId: string) => void;
  /** Id do card aberto no painel lateral (a linha dele fica destacada na árvore). */
  selectedCardId?: string | null;
  /** Cards selecionados (seleção múltipla compartilhada com o quadro) e como mexer nela. Sem isso, não há seleção na árvore. */
  selectedCardIds?: Set<string>;
  onToggleSelect?: (cardId: string) => void;
  /** Seleção por intervalo (Shift + clique): ADICIONA estes cards à seleção. */
  onSelectRange?: (cardIds: string[]) => void;
  onClearSelection?: () => void;
  /** Ações em lote sobre os selecionados (barra "N cards selecionados" e menu ⋮). */
  bulk?: BulkCardActions;
  /** Configuração de aparência do card (a ORDEM dela define a ordem de etiquetas, prioridade, checklist e prazo na linha). */
  visualConfig?: CardVisualFieldConfig[];
  /** Cor de fundo de cada coluna (viewPrefs.columnBackgrounds) e a opacidade dela (viewPrefs.columnBackgroundOpacity). */
  columnBackgrounds?: Record<string, string>;
  columnOpacities?: Record<string, number>;
  /** Ações do menu ⋮ de cada card (mesmo menu do quadro). Sem isso, o ⋮ não aparece. */
  cardMenu?: CardActionsHandlers;
  /** Criar, mover e renomear direto na árvore. Sem isso a árvore fica só de leitura/navegação. */
  treeActions?: TreeActions;
  /** Painel à direita da árvore (ex.: detalhes do card). Quando presente, a árvore divide a largura com ele. */
  sidePanel?: React.ReactNode;
  /** Isola o estado salvo (nós recolhidos) por kanban. */
  stateKey?: string;
}

const INDENT_PX = 18;
const DEFAULT_PANEL_WIDTH = 460;
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 900;
const PANEL_WIDTH_PREFIX = 'kanban-tree-panel-width:';

/** Limita a largura do painel: entre o mínimo/máximo e sem comer mais de 70% da janela (a árvore precisa de espaço). */
function clampPanelWidth(w: number): number {
  if (!Number.isFinite(w)) return DEFAULT_PANEL_WIDTH;
  const max = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, Math.floor(window.innerWidth * 0.7)));
  return Math.round(Math.min(max, Math.max(MIN_PANEL_WIDTH, w)));
}

function readPanelWidth(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    return raw ? clampPanelWidth(parseFloat(raw)) : DEFAULT_PANEL_WIDTH;
  } catch {
    return DEFAULT_PANEL_WIDTH;
  }
}
const PANEL_HEIGHT = 'calc(100vh - 160px)';
const STORAGE_PREFIX = 'kanban-tree-view:';
const ZOOM_PREFIX = 'kanban-tree-zoom:';
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_BUTTON_STEP = 0.1;

function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1;
  return Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)) * 100) / 100;
}

function readZoom(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    return raw ? clampZoom(parseFloat(raw)) : 1;
  } catch {
    return 1;
  }
}

function readCollapsed(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

/** Miniatura de capa (card, grupo ou subgrupo). Se a imagem não carregar, some em vez de mostrar ícone quebrado. */
function CoverThumb({ path, size }: { path: string; size: number }) {
  return (
    <img
      src={convertFileSrc(path)}
      alt=""
      loading="lazy"
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }}
    />
  );
}

const COVER_SIZE_PREFIX = 'kanban-tree-cover-size:';
const GROUP_HEIGHT_PREFIX = 'kanban-tree-group-heights:';

/** groupId -> altura (px) da área de conteúdo, ajustada arrastando a barra no fim do grupo. */
function readGroupHeights(key: string): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '{}');
    const out: Record<string, number> = {};
    if (raw && typeof raw === 'object') {
      for (const [id, v] of Object.entries(raw)) if (typeof v === 'number' && v > 0) out[id] = v;
    }
    return out;
  } catch {
    return {};
  }
}
/** Tamanhos da capa do card na árvore (px do lado). O primeiro é o padrão. */
const COVER_SIZES: { size: number; label: string }[] = [
  { size: 20, label: 'Pequena' },
  { size: 36, label: 'Média' },
  { size: 56, label: 'Grande' },
  { size: 88, label: 'Enorme' },
];
const DEFAULT_CARD_COVER_SIZE = COVER_SIZES[0].size;

function readCoverSize(key: string): number {
  try {
    const n = Number(localStorage.getItem(key));
    return COVER_SIZES.some((c) => c.size === n) ? n : DEFAULT_CARD_COVER_SIZE;
  } catch {
    return DEFAULT_CARD_COVER_SIZE;
  }
}

const MAX_LABEL_CHIPS = 3; // etiquetas mostradas na linha do card; o resto vira "+N" (o nome de todas fica no tooltip)
const GROUP_COVER_SIZE = 60; // mesmos tamanhos do GroupBlock no quadro (LOGO_SIZE / SUBGROUP_LOGO_SIZE)
const SUBGROUP_COVER_SIZE = 32;
// Uma cor por nível de aninhamento (cicla se passar de 4) — a faixa à esquerda do subgrupo mostra, de relance, se ele
// é filho, neto ou bisneto. Mesmas cores do quadro (DEPTH_ACCENT_COLORS no GroupBlock).
const DEPTH_ACCENT_COLORS = ['#1a73e8', '#8e24aa', '#00897b', '#e8710a'];

/** Cores de texto legíveis sobre o fundo CUSTOM de um grupo (calculadas por readableTextColors). null = fundo padrão, usa as classes do tema. */
type GroupTextColors = { text: string; secondary: string; muted: string; danger: string } | null;
const COLUMN_COVER_SIZE = 28;

/* ---------- campo de adicionar (card / grupo / subgrupo) ---------- */

/**
 * Campo que aparece embaixo de uma coluna/grupo pra criar um card, grupo ou subgrupo. Enter cria e continua aberto
 * (pra criar vários em sequência); Esc cancela; clicar FORA com texto digitado também cria (e fecha).
 */
function AddInlineInput({ depth, placeholder, onSubmit, onClose }: {
  depth: number; placeholder: string; onSubmit: (text: string) => void; onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const cancelledRef = useRef(false);
  const unmountingRef = useRef(false);
  // O `= false` no corpo do efeito é essencial: no StrictMode o efeito monta, desmonta e monta de novo, e sem ele a
  // flag ficaria `true` pra sempre e todo "clicar fora" seria ignorado.
  useLayoutEffect(() => {
    unmountingRef.current = false;
    return () => { unmountingRef.current = true; };
  }, []);

  function submit() {
    const text = value.trim();
    if (!text) return;
    setValue('');
    onSubmit(text);
  }

  return (
    <div style={{ padding: '2px 6px', paddingLeft: 6 + depth * INDENT_PX + 14 }}>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
          if (e.key === 'Escape') { e.stopPropagation(); cancelledRef.current = true; onClose(); }
        }}
        onBlur={() => {
          if (unmountingRef.current || cancelledRef.current) return;
          submit();
          onClose();
        }}
        placeholder={placeholder}
        className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600 dark:[color-scheme:dark]"
        style={{ width: '100%', boxSizing: 'border-box', padding: '3px 6px', fontSize: 12, borderRadius: 4 }}
      />
    </div>
  );
}

/* ---------- tarefas do card: ícone na linha + bloco flutuante pra gerenciar sem abrir o card ---------- */

/**
 * Ícone/contagem das tarefas do card. Passar o mouse (ou clicar, que "prende" o bloco) abre um bloco flutuante com a lista de
 * tarefas — dá pra marcar, criar e apagar tarefas ali, sem abrir o card no painel ao lado.
 */
function TaskPeek({ cardId, title, label, className, style, onChanged }: {
  cardId: string;
  title: string;
  label: string;
  className?: string;
  style?: React.CSSProperties;
  onChanged?: (cardId: string) => void;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [pinned, setPinned] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openRef = useRef(false);
  openRef.current = pos !== null;
  const changedRef = useRef(onChanged);
  changedRef.current = onChanged;

  function clear() {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }
  function openNow() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const W = 340;
    const H = 380;
    const x = Math.max(8, Math.min(r.left, window.innerWidth - W - 12));
    const below = r.bottom + 4 + H <= window.innerHeight;
    setPos({ x, y: below ? r.bottom + 4 : Math.max(8, r.top - H - 4) });
  }
  function close() {
    clear();
    setPinned(false);
    setPos(null);
  }
  function scheduleOpen() {
    clear();
    if (openRef.current) return;
    openTimer.current = setTimeout(openNow, 250);
  }
  function scheduleClose() {
    clear();
    if (pinned) return;
    closeTimer.current = setTimeout(() => {
      // digitando numa tarefa: não fecha por o mouse ter saído do bloco
      if (panelRef.current && panelRef.current.contains(document.activeElement) && document.activeElement?.tagName === 'INPUT') return;
      setPos(null);
    }, 300);
  }
  useEffect(() => clear, []);

  // ao fechar, atualiza o resumo (✓ feitas/total) da linha
  const wasOpen = useRef(false);
  useEffect(() => {
    if (pos !== null) { wasOpen.current = true; return; }
    if (wasOpen.current) { wasOpen.current = false; changedRef.current?.(cardId); }
  }, [pos, cardId]);

  // "preso" (clicou): fecha ao clicar fora ou com Esc
  useEffect(() => {
    if (!pinned) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      close();
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [pinned]);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <>
      <span
        ref={triggerRef}
        title={title}
        className={className}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onPointerDown={stop}
        onDoubleClick={stop}
        onClick={(e) => { e.stopPropagation(); if (pos) { if (pinned) close(); else setPinned(true); } else { openNow(); setPinned(true); } }}
        style={{ cursor: 'pointer', borderRadius: 3, padding: '0 3px', ...style }}
      >
        {label}
      </span>
      {pos && createPortal(
        <div
          ref={panelRef}
          onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current); }}
          onMouseLeave={scheduleClose}
          onClick={stop}
          onDoubleClick={stop}
          onPointerDown={stop}
          onContextMenu={stop}
          onKeyDown={stop}
          className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-600"
          style={{ position: 'fixed', left: pos.x, top: pos.y, width: 340, maxHeight: 380, overflowY: 'auto', overscrollBehavior: 'contain', zIndex: 100000, padding: 10, borderRadius: 8, boxShadow: '0 8px 28px rgba(0,0,0,0.3)' }}
        >
          <div className="text-neutral-500 dark:text-neutral-400" style={{ display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
            <span style={{ flex: 1 }}>☑ Tarefas{pinned ? ' (fixo — clique fora para fechar)' : ''}</span>
            <button type="button" onClick={close} aria-label="Fechar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', fontSize: 12 }}>✕</button>
          </div>
          <ChecklistSection cardId={cardId} />
        </div>,
        document.body,
      )}
    </>
  );
}

/* ---------- estado do card (texto pequeno + select pra trocar sem abrir o card) ---------- */


/**
 * Estado do card como TEXTO pequeno (na cor do estado) que já é um <select>: trocar o estado não exige abrir o card.
 * Sem `onChange` vira só o rótulo. Os eventos não sobem pra linha — senão o clique abriria o card e o arrasto começaria.
 */
function StatusSelect({ status, onChange, bulkCount }: {
  status: TaskStatus | null;
  onChange?: (status: TaskStatus | null) => void;
  /** Se este card está numa seleção de 2+, quantos são: trocar o estado aqui vale pra TODOS eles. */
  bulkCount?: number;
}) {
  const color = status ? STATUS_COLORS[status] : null;
  const label = status ? STATUS_LABELS[status] : 'Sem status';
  const pillStyle: React.CSSProperties = {
    fontSize: 9, fontWeight: 600, lineHeight: '13px', padding: '0 4px', borderRadius: 3, flexShrink: 0, whiteSpace: 'nowrap',
  };

  if (!onChange) {
    return status
      ? <span title="Status do card" className="text-white" style={{ ...pillStyle, backgroundColor: color ?? undefined }}>{STATUS_LABELS[status]}</span>
      : <span title="Sem status" className="text-neutral-400 dark:text-neutral-500 border border-neutral-300 dark:border-neutral-600" style={pillStyle}>Sem status</span>;
  }

  return (
    <StatusHoverPicker value={status} onSelect={onChange}>
    <select
      value={status ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : (e.target.value as TaskStatus))}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      title={bulkCount && bulkCount > 1 ? `Mudar o status dos ${bulkCount} cards selecionados` : 'Mudar o status do card'}
      className={color ? 'text-white' : 'text-neutral-400 dark:text-neutral-500 border border-neutral-300 dark:border-neutral-600 bg-transparent'}
      style={{
        ...pillStyle,
        // sem a setinha do select e com a largura do texto atual (e não a da opção mais comprida): fica do tamanho de uma etiqueta
        appearance: 'none', WebkitAppearance: 'none', width: `calc(${label.length}ch + 9px)`, textAlign: 'center', cursor: 'pointer',
        ...(color ? { backgroundColor: color, border: 'none' } : {}),
      }}
    >
      <option value="" style={{ fontSize: 12 }} className="bg-white text-black dark:bg-neutral-800 dark:text-neutral-100">Sem status</option>
      {statusIds().map((s) => (
        <option key={s} value={s} style={{ fontSize: 12 }} className="bg-white text-black dark:bg-neutral-800 dark:text-neutral-100">{STATUS_LABELS[s]}</option>
      ))}
    </select>
    </StatusHoverPicker>
  );
}

/* ---------- linha de card (arrastável, solta-alvo e com título editável) ---------- */

type DropHint = { overId: string; after: boolean } | null;

interface TreeCardRowProps {
  card: KanbanCard;
  depth: number;
  progress?: ChecklistProgress;
  /** Depois de mexer nas tarefas pelo bloco flutuante: recalcula o resumo do card. */
  onChecklistChanged?: (cardId: string) => void;
  selected: boolean;
  /** Mostra a barra azul antes/depois da linha enquanto outro card está sendo arrastado por cima dela. */
  hint: 'before' | 'after' | null;
  cardMenu?: CardActionsHandlers;
  canEdit: boolean;
  canDrag: boolean;
  onClick: (cardId: string, e: React.MouseEvent) => void;
  onRename: (cardId: string, title: string) => void;
  /** Grupo com cor de fundo própria: o texto usa estas cores (as classes de tema só servem pro fundo padrão). */
  groupColors?: GroupTextColors;
  /** Troca o status do card direto na linha. Sem isso, o estado aparece só como rótulo. */
  onUpdateStatus?: (cardId: string, status: TaskStatus | null) => void;
  /** Lado (px) da miniatura da capa do card. */
  coverSize: number;
  /** Card marcado na seleção múltipla. */
  checked: boolean;
  /** Há algum card selecionado: as caixinhas ficam sempre visíveis (senão só aparecem com o mouse sobre a linha). */
  selectionActive: boolean;
  /** Marca/desmarca este card. Sem isso, não há caixinha. */
  onToggleCheck?: (cardId: string) => void;
  /** Seleção atual + ações em lote: o ⋮ deste card age em todos os selecionados quando ele está entre eles. */
  bulkIds?: string[];
  bulkActions?: BulkCardActions;
  /** Ordem de exibição dos itens à direita do título (vem da ordem de visualConfig). */
  trailingOrder?: Array<'labels' | 'priority' | 'checklist' | 'due' | 'updated'>;
  /** Muda (número novo) quando o atalho E pede pra editar o título deste card. */
  editNonce?: number;
  /** Item marcado pela navegação por teclado (WASD). */
  kbFocused?: boolean;
}

function TreeCardRow({ card, depth, progress, onChecklistChanged, selected, hint, cardMenu, canEdit, canDrag, onClick, onRename, groupColors, onUpdateStatus, coverSize, checked, selectionActive, onToggleCheck, bulkIds, bulkActions, trailingOrder, editNonce, kbFocused }: TreeCardRowProps) {
  const { icons: labelIcons } = useLabelIcons(); // ícones das etiquetas (os mesmos do quadro)
  // linha selecionada tem fundo azul claro: aí as cores calculadas pro fundo do grupo não valem, usa as do tema
  const inBulkSelection = checked && !!bulkActions && !!bulkIds && bulkIds.length > 1;
  const colors = selected || checked ? null : groupColors ?? null; // fundo azul/índigo: as cores calculadas pro fundo do grupo não valem
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.title);
  const cancelledRef = useRef(false);

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `card:${card.id}`,
    data: { type: 'card', cardId: card.id },
    disabled: !canDrag || editing, // editando o título: arrastar dentro do campo seleciona texto, não move o card
  });
  const { setNodeRef: setDropRef } = useDroppable({ id: `drop-card:${card.id}`, data: { type: 'card', cardId: card.id } });

  const done = card.status === 'feito';
  const due = card.dueDate ? getRelativeDue(card.dueDate) : null;
  const overdue = !!due && !done && due.diffDays < 0;

  function startEditing() {
    if (!canEdit) return;
    cancelledRef.current = false;
    setDraft(card.title);
    setEditing(true);
  }

  useEffect(() => {
    if (editNonce) startEditing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editNonce]);

  function finishEditing(save: boolean) {
    setEditing(false);
    const title = draft.trim();
    if (save && title && title !== card.title) onRename(card.id, title);
    else setDraft(card.title); // vazio ou sem mudança: reverte
  }

  // barra azul de "vai cair aqui": em cima (antes) ou embaixo (depois) desta linha
  const hintShadow = hint === 'before' ? 'inset 0 2px 0 #1a73e8' : hint === 'after' ? 'inset 0 -2px 0 #1a73e8' : undefined;

  // itens à direita do título; a ordem vem de `trailingOrder` (ordem da lista de aparência do card)
  const isCut = useIsCardCut(card.id); // recortado (Ctrl+X): esmaecido até colar
  const trailingNodes: Record<'labels' | 'priority' | 'checklist' | 'due' | 'updated', React.ReactNode> = {
    labels: !editing && card.labels.length > 0 && (() => {
        const parsed = card.labels.map(parseLabel);
        const shown = parsed.slice(0, MAX_LABEL_CHIPS);
        const extra = parsed.slice(MAX_LABEL_CHIPS);
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            {shown.map((l) => (
              <span
                key={l.name}
                title={l.name}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 9, lineHeight: '13px', borderRadius: 3, padding: '0 4px',
                  backgroundColor: l.color, color: readableTextColors(l.color).text, maxWidth: 90, overflow: 'hidden', whiteSpace: 'nowrap',
                }}
              >
                <LabelIconBadge icon={labelIcons[l.name]} size={9} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</span>
              </span>
            ))}
            {extra.length > 0 && (
              <span
                title={extra.map((l) => l.name).join(', ')}
                className={colors ? undefined : 'text-neutral-500 dark:text-neutral-400'}
                style={{ fontSize: 9, color: colors?.secondary }}
              >
                +{extra.length}
              </span>
            )}
          </span>
        );
      })(),
    priority: card.priority && (
        <span title={`Prioridade: ${PRIORITY_LABELS[card.priority]}`} style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, backgroundColor: PRIORITY_COLORS[card.priority] }} />
      ),
    checklist: (
      <>
        {progress && progress.total > 0 && (
          <TaskPeek
            cardId={card.id}
            title="Tarefas (passe o mouse para gerenciar; clique para fixar)"
            label={`☑ ${progress.done}/${progress.total}`}
            className={colors ? 'hover:bg-black/10' : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600'}
            style={{ fontSize: 10, flexShrink: 0, color: colors?.secondary }}
            onChanged={onChecklistChanged}
          />
        )}
        {progress && progress.total === 0 && (progress.simpleCount ?? 0) > 0 && (
          <TaskPeek
            cardId={card.id}
            title="Itens em lista simples (passe o mouse para ver; clique para fixar)"
            label={`☰ ${progress.simpleCount}`}
            className={colors ? 'hover:bg-black/10' : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600'}
            style={{ fontSize: 10, flexShrink: 0, color: colors?.secondary }}
            onChanged={onChecklistChanged}
          />
        )}
      </>
    ),
    updated: card.updatedAt ? (
        <span
          className={colors ? undefined : 'text-neutral-400 dark:text-neutral-500'}
          title={`Modificado em ${formatUpdatedAtFull(card.updatedAt)}`}
          style={{ fontSize: 10, flexShrink: 0, whiteSpace: 'nowrap', color: colors?.muted }}
        >
          ✎ {formatUpdatedAt(card.updatedAt)}
        </span>
      ) : null,
    due: due && (
        <span
          className={colors ? undefined : overdue ? 'text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-neutral-400'}
          title={overdue ? `${due.title} (vencido)` : due.title}
          style={{ fontSize: 10, flexShrink: 0, whiteSpace: 'nowrap', color: colors ? (overdue ? colors.danger : colors.secondary) : undefined }}
        >
          {due.label}
        </span>
      ),
  };
  const trailing = trailingOrder ?? ['labels', 'priority', 'checklist', 'due'];
  const archiveActions = useArchive();

  return (
    <div
      ref={(node) => { setDragRef(node); setDropRef(node); }}
      data-tree-card-id={card.id}
      data-tree-node-id={`card:${card.id}`}
      {...attributes}
      {...(canDrag && !editing ? listeners : {})}
      onClick={(e) => onClick(card.id, e)}
      onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }} // Shift + clique seleciona um intervalo; sem isso o navegador selecionaria o TEXTO
      title={card.title}
      className={checked
        ? 'group/row bg-indigo-100 dark:bg-indigo-950'
        : selected
          ? 'group/row bg-blue-50 dark:bg-blue-950'
          : colors ? 'group/row hover:bg-black/10' : 'group/row hover:bg-neutral-100 dark:hover:bg-neutral-700'}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', paddingLeft: 6 + depth * INDENT_PX + 14,
        fontSize: 12, cursor: canDrag ? 'grab' : 'pointer', borderRadius: 4, opacity: isDragging ? 0.4 : isCut ? 0.45 : card.archived ? 0.55 : 1,
        borderLeft: card.color ? `3px solid ${card.color}` : undefined, boxShadow: hintShadow,
        outline: kbFocused ? '2px solid #1a73e8' : isCut ? '2px dashed #f59e0b' : undefined, outlineOffset: -2,
      }}
    >
      {onToggleCheck && (
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggleCheck(card.id)}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          title="Selecionar (Ctrl + clique também; Shift + clique seleciona um intervalo)"
          aria-label="Selecionar card"
          className={checked || selectionActive ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100'}
          style={{ flexShrink: 0, margin: 0, width: 12, height: 12, cursor: 'pointer' }}
        />
      )}
      <StatusSelect
        status={card.status}
        bulkCount={inBulkSelection ? bulkIds!.length : undefined}
        onChange={onUpdateStatus ? (s) => {
          // card dentro de uma seleção de 2+: o novo estado vale pra todos os selecionados (como no menu ⋮ em lote)
          if (inBulkSelection) bulkActions!.onSetStatus(bulkIds!, s);
          else onUpdateStatus(card.id, s);
        } : undefined}
      />
      {card.coverPath && <CoverThumb path={card.coverPath} size={coverSize} />}

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()} // clicar no campo não abre o card
          onDoubleClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); finishEditing(true); }
            if (e.key === 'Escape') { e.stopPropagation(); cancelledRef.current = true; finishEditing(false); }
          }}
          onBlur={() => { if (!cancelledRef.current) finishEditing(true); }}
          onFocus={(e) => e.currentTarget.select()}
          className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-blue-400 dark:border-blue-500 dark:[color-scheme:dark]"
          style={{ flex: 1, minWidth: 0, padding: '1px 4px', fontSize: 12, borderRadius: 3, outline: 'none' }}
        />
      ) : (
        <>
          {/* título + botões de copiar/editar: só aparecem com o mouse sobre este bloco (group/title) */}
          <span className="group/title" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: '0 1 auto', minWidth: 0 }}>
            <span
              onDoubleClick={(e) => { e.stopPropagation(); startEditing(); }}
              className={colors ? undefined : done ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-900 dark:text-neutral-100'}
              style={{
                minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: done ? 'line-through' : undefined,
                color: colors ? (done ? colors.muted : colors.text) : undefined,
              }}
            >
              {card.title}
            </span>
            {canEdit && (
              <button
                type="button"
                title="Editar título (ou dê dois cliques nele)"
                aria-label="Editar título"
                onClick={(e) => { e.stopPropagation(); startEditing(); }}
                onPointerDown={(e) => e.stopPropagation()}
                className="bg-transparent border-0 p-0 cursor-pointer shrink-0 leading-none text-neutral-400 dark:text-neutral-500 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover/title:opacity-100 focus-visible:opacity-100"
                style={{ fontSize: 11 }}
              >
                ✎
              </button>
            )}
            <CopyTitleButton text={card.title} />
          </span>
          <span style={{ flex: 1 }} />
        </>
      )}

      {card.isPlanTemplate && <PlanBadge card={card} size={9} />}
      {card.isPlanTemplate && card.planTrackOnly && <PlanDistributionBar card={card} inline />}
      {trailing.map((k) => <Fragment key={k}>{trailingNodes[k]}</Fragment>)}
      {archiveActions && (
        <button
          type="button"
          title={card.archived ? 'Desarquivar o card' : 'Arquivar o card (some da coluna; dá pra ver pelo botão "arquivados" da coluna)'}
          aria-label={card.archived ? 'Desarquivar' : 'Arquivar'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); archiveActions.archiveCard(card.id, !card.archived); }}
          className={`bg-transparent border-0 p-0 cursor-pointer shrink-0 leading-none ${card.archived ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100'} ${colors ? '' : 'text-neutral-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400'}`}
          style={{ fontSize: 11, color: colors?.secondary }}
        >
          {card.archived ? '📤' : '🗄'}
        </button>
      )}
      {cardMenu && <CardActionsMenu card={card} {...cardMenu} bulkIds={bulkIds} bulkActions={bulkActions} />}
    </div>
  );
}

/* ---------- painel 🎨 de aparência do grupo ---------- */

const stopBubbling = (e: React.SyntheticEvent) => e.stopPropagation();

const MIN_GROUP_HEIGHT = 80;
const MAX_GROUP_HEIGHT = 2000;

/**
 * Conteúdo de um grupo/subgrupo. Com muitos cards ele rola por dentro (altura máxima padrão) e ganha uma barra no fim: arraste pra
 * aumentar ou diminuir a área (a altura fica salva por grupo); duplo clique na barra volta ao padrão.
 */
function ScrollBody({ defaultMaxHeight, customHeight, zoom, onResize, children }: {
  defaultMaxHeight?: number;
  customHeight?: number;
  zoom: number;
  onResize: (height: number | null) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<number | null>(null); // altura durante o arrasto
  const maxHeight = live ?? customHeight ?? defaultMaxHeight;
  const resizable = defaultMaxHeight !== undefined || customHeight !== undefined || live !== null;

  function startResize(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const startH = el.clientHeight;
    let latest = startH;
    const move = (ev: PointerEvent) => {
      latest = Math.min(MAX_GROUP_HEIGHT, Math.max(MIN_GROUP_HEIGHT, startH + (ev.clientY - startY) / zoom)); // o CSS zoom da lista escala o movimento do mouse
      setLive(latest);
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      onResize(Math.round(latest));
      setLive(null);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  return (
    <>
      <div ref={ref} style={maxHeight ? { maxHeight, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin' } : undefined}>
        {children}
      </div>
      {resizable && (
        <div
          onPointerDown={startResize}
          onDoubleClick={(e) => { e.stopPropagation(); onResize(null); }}
          onClick={stopBubbling}
          title="Arraste para ajustar a altura da área (duplo clique volta ao padrão)"
          className="hover:bg-blue-500/20"
          style={{ height: 10, cursor: 'ns-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', borderRadius: 3 }}
        >
          <span className="bg-neutral-400 dark:bg-neutral-500" style={{ width: 36, height: 3, borderRadius: 2 }} />
        </div>
      )}
    </>
  );
}

/** Grupo/subgrupo com mais cards que isso ganha uma área de cards com rolagem própria (altura máxima abaixo). */
const GROUP_SCROLL_THRESHOLD = 8;
const GROUP_SCROLL_MAX_HEIGHT = 340;

/**
 * Mesmo painel do GroupBlock no quadro: capa (com "Remover capa"), descrição, cor de fundo e etiquetas do grupo.
 * O emoji continua pelo clique no ícone do cabeçalho, como no quadro.
 */
function GroupAppearancePanel({ group, coverSize, allLabels, onUpdate }: {
  group: KanbanCardGroup;
  coverSize: number;
  allLabels: ParsedLabel[];
  onUpdate: (groupId: string, input: UpdateKanbanCardGroupInput) => unknown;
}) {
  const [descriptionDraft, setDescriptionDraft] = useState(group.description ?? '');
  const [labelMenu, setLabelMenu] = useState<{ x: number; y: number } | null>(null);
  const groupLabels = group.labels ?? []; // grupos salvos antes das etiquetas existirem não têm o campo

  function submitDescription() {
    const trimmed = descriptionDraft.trim();
    if (trimmed !== (group.description ?? '')) onUpdate(group.id, { description: trimmed || null });
  }

  // Etiquetas do grupo: as MESMAS do quadro (mesmo catálogo, cores e ícones dos cards)
  function toggleGroupLabel(name: string, color: string, isGroup: boolean) {
    const has = groupLabels.some((l) => parseLabel(l).name === name);
    const next = has
      ? groupLabels.filter((l) => parseLabel(l).name !== name)
      : [...groupLabels, serializeLabel(name, color, isGroup)];
    onUpdate(group.id, { labels: next });
  }

  function createGroupLabel(name: string, color: string, isGroup: boolean) {
    if (groupLabels.some((l) => parseLabel(l).name === name)) return;
    onUpdate(group.id, { labels: [...groupLabels, serializeLabel(name, color, isGroup)] });
  }

  return (
    <div
      className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700"
      style={{ borderRadius: 6, padding: 8, margin: '0 0 6px', display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <ImageUploadField
        entityId={group.id}
        currentPath={group.coverPath}
        onUploaded={(path) => onUpdate(group.id, { coverPath: path })}
        height={coverSize}
      />
      {group.coverPath && (
        <button
          onClick={() => onUpdate(group.id, { coverPath: null })}
          className="text-red-600 dark:text-red-400"
          style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
        >
          Remover capa
        </button>
      )}
      <textarea
        value={descriptionDraft}
        onChange={(e) => setDescriptionDraft(e.target.value)}
        onBlur={submitDescription}
        placeholder="Descrição do grupo..."
        rows={2}
        className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]"
        style={{ fontSize: 11, padding: 4, resize: 'vertical', fontFamily: 'inherit' }}
      />
      <div className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 10 }}>Cor de fundo</div>
      <BackgroundColorPicker
        value={group.backgroundColor}
        fallbackColor="#f5f5f5"
        coverPath={group.coverPath}
        onChange={(color) => onUpdate(group.id, { backgroundColor: color })}
      />
      <button
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setLabelMenu({ x: r.left, y: r.bottom + 4 }); }}
        className="text-blue-600 dark:text-blue-400"
        style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
      >
        🏷 Etiquetas do grupo{groupLabels.length > 0 ? ` (${groupLabels.length})` : ''}
      </button>

      {labelMenu && createPortal(
        // portal no <body>: o menu não sofre o zoom da árvore nem é cortado; o div segura os cliques (que no React sobem pela árvore)
        <div onClick={stopBubbling} onDoubleClick={stopBubbling} onPointerDown={stopBubbling}>
          <CardLabelMenu
            x={labelMenu.x}
            y={labelMenu.y}
            cardLabels={groupLabels}
            allLabels={allLabels}
            onToggle={toggleGroupLabel}
            onCreate={createGroupLabel}
            onClose={() => setLabelMenu(null)}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

/** Painel 🎨 da coluna: cor de fundo (mesmo seletor do quadro) + opacidade do fundo. */
function ColumnAppearancePanel({ column, backgroundColor, opacity, onChangeColor, onChangeOpacity }: {
  column: KanbanColumn;
  backgroundColor: string | null;
  opacity: number;
  onChangeColor: (color: string | null) => unknown;
  onChangeOpacity: (opacity: number) => unknown;
}) {
  return (
    <div
      className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-dashed border-neutral-300 dark:border-neutral-600"
      style={{ borderRadius: 6, padding: 6, margin: '0 0 6px', display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <div className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 10 }}>Cor de fundo da coluna</div>
      <BackgroundColorPicker
        value={backgroundColor}
        fallbackColor="#ffffff"
        coverPath={column.coverPath}
        onChange={onChangeColor}
      />
      <BackgroundOpacitySlider value={opacity} enabled={backgroundColor !== null} onChange={onChangeOpacity} />
    </div>
  );
}

/** Seletor de emoji do grupo, flutuando junto ao ícone do cabeçalho. Fecha ao clicar fora. */
function EmojiPickerPopup({ x, y, hasEmoji, onPick, onRemove, onClose }: {
  x: number; y: number; hasEmoji: boolean; onPick: (emoji: string) => void; onRemove: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [onClose]);

  // não deixa o seletor (280×360) sair da janela
  const left = Math.max(8, Math.min(x, window.innerWidth - 296));
  const top = Math.max(8, Math.min(y, window.innerHeight - (hasEmoji ? 410 : 376)));

  return (
    <div
      ref={ref}
      onClick={stopBubbling}
      onPointerDown={stopBubbling}
      style={{ position: 'fixed', left, top, zIndex: 60, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', borderRadius: 8, overflow: 'hidden' }}
    >
      <EmojiPicker
        onEmojiClick={(data: EmojiClickData) => onPick(data.emoji)}
        emojiStyle={EmojiStyle.NATIVE}
        theme={document.documentElement.classList.contains('dark') ? Theme.DARK : Theme.LIGHT}
        width={280}
        height={360}
        previewConfig={{ showPreview: false }}
        lazyLoadEmojis
      />
      {hasEmoji && (
        <div className="bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700" style={{ padding: '4px 8px', textAlign: 'right' }}>
          <button
            onClick={onRemove}
            className="text-red-600 dark:text-red-400"
            style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
          >
            Remover emoji
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- barra de ações em lote (vários cards selecionados) ---------- */

function BulkBar({ ids, allLabels, bulk, onClear }: {
  ids: string[];
  allLabels: ParsedLabel[];
  bulk: BulkCardActions;
  onClear: () => void;
}) {
  const cardMove = useCardMove(); // null fora do quadro: "Mover para…" fica desabilitado
  const [popup, setPopup] = useState<{ kind: 'color' | 'labels' | 'move'; x: number; y: number } | null>(null);
  const count = ids.length;

  function openPopup(kind: 'color' | 'labels' | 'move', e: React.MouseEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setPopup({ kind, x: r.left, y: r.bottom + 4 });
  }

  const linkCls = 'bg-transparent border-0 p-0 cursor-pointer text-blue-600 dark:text-blue-400 hover:underline';

  return (
    <div
      className="bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-neutral-900 dark:text-neutral-100"
      style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '4px 8px', borderRadius: 6, marginBottom: 6, fontSize: 11 }}
    >
      <span style={{ fontWeight: 600 }}>{count} card{count !== 1 ? 's' : ''} selecionado{count !== 1 ? 's' : ''}</span>

      <select
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (v === '__none') bulk.onSetStatus(ids, null);
          else if (v) bulk.onSetStatus(ids, v as TaskStatus);
        }}
        title="Definir o status de todos os selecionados"
        className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600 dark:[color-scheme:dark]"
        style={{ fontSize: 11, padding: '1px 2px', borderRadius: 4 }}
      >
        <option value="">📊 Status…</option>
        {statusIds().map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        <option value="__none">Sem status</option>
      </select>
      <button className={linkCls} style={{ fontSize: 11 }} onClick={(e) => openPopup('color', e)}>🎨 Cor</button>
      <button className={linkCls} style={{ fontSize: 11 }} onClick={(e) => openPopup('labels', e)}>🏷 Etiquetas</button>
      <button
        className={linkCls}
        style={{ fontSize: 11, opacity: cardMove ? 1 : 0.5 }}
        disabled={!cardMove}
        onClick={(e) => openPopup('move', e)}
      >
        📦 Mover para…
      </button>
      <button className="bg-transparent border-0 p-0 cursor-pointer text-red-600 dark:text-red-400 hover:underline" style={{ fontSize: 11 }} onClick={bulk.onDelete}>
        🗑 Excluir
      </button>
      <span style={{ flex: 1 }} />
      <button className={linkCls} style={{ fontSize: 11 }} onClick={onClear} title="Esc também limpa a seleção">Limpar seleção</button>

      {popup && createPortal(
        <div onClick={stopBubbling} onDoubleClick={stopBubbling} onPointerDown={stopBubbling}>
          {popup.kind === 'color' && (
            <CardColorMenu
              x={popup.x}
              y={popup.y}
              value={null}
              onSave={(value) => bulk.onSetColor(ids, value)}
              onClose={() => setPopup(null)}
            />
          )}
          {popup.kind === 'labels' && (
            <CardLabelMenu
              x={popup.x}
              y={popup.y}
              cardLabels={[]}
              allLabels={allLabels}
              onToggle={(name, color, isGroup) => bulk.onToggleLabel(ids, name, color, isGroup)}
              onCreate={(name, color, isGroup) => bulk.onToggleLabel(ids, name, color, isGroup)}
              onClose={() => setPopup(null)}
            />
          )}
          {popup.kind === 'move' && cardMove && (
            <CardMoveMenu
              x={popup.x}
              y={popup.y}
              columns={cardMove.columns}
              groups={cardMove.groups}
              currentColumnId={null}
              currentGroupId={null}
              cardCount={count}
              onMove={(target) => { setPopup(null); void cardMove.moveCards(ids, target); }}
              onClose={() => setPopup(null)}
            />
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ---------- cabeçalho de coluna / grupo (solta-alvo + botão ＋) ---------- */

/** Ao arrastar um GRUPO por cima do cabeçalho de outro: em cima = vira irmão antes dele; no meio = vira subgrupo; embaixo = irmão depois. */
type GroupDropZone = 'before' | 'inside' | 'after';

interface TreeHeaderRowProps {
  nodeId: string;
  /** Só colunas e grupos recebem card solto em cima; o id do alvo vai nos dados do droppable. */
  dropTarget: TreeMoveTarget | null;
  depth: number;
  icon: string;
  name: string;
  count: number;
  bold: boolean;
  hasContent: boolean;
  collapsed: boolean;
  coverPath?: string | null;
  coverSize?: number;
  /** Alvo destacado enquanto um card é arrastado por cima. */
  isDropOver: boolean;
  onToggle: (nodeId: string) => void;
  /** Itens do menu do ＋ (ex.: "Adicionar card", "Adicionar grupo"). Sem itens, não mostra o botão. */
  addItems?: { label: string; onClick: () => void }[];
  /** Grupo com fundo próprio: texto nestas cores. null/ausente = classes do tema. */
  textColors?: GroupTextColors;
  /** Clicar no emoji abre o seletor (só grupos; igual ao quadro). Recebe o retângulo do ícone pra posicionar o seletor. */
  onEmojiClick?: (rect: DOMRect) => void;
  /** Botão 🎨 (e clique na capa) que abre/fecha o painel de aparência do grupo. */
  onAppearanceToggle?: () => void;
  appearanceOpen?: boolean;
  /** Renomear (só grupos/subgrupos): dois cliques no nome, ou o botão ✎. */
  onRename?: (name: string) => void;
  /** Desagrupar/excluir (só grupos/subgrupos): o quadro abre a confirmação com as opções (manter ou apagar os cards). */
  onDelete?: () => void;
  /** Id do grupo, se este cabeçalho puder ser ARRASTADO (grupos e subgrupos; colunas não). */
  draggableGroupId?: string;
  /** Marca de "vai cair aqui" enquanto um grupo é arrastado por cima deste cabeçalho. */
  dropZone?: GroupDropZone | null;
  /** Item marcado pela navegação por teclado (WASD). */
  kbFocused?: boolean;
  /** Mover para cima/baixo (só colunas). Sem onMove*, não mostra os botões; canMove* false = desabilitado (já está na ponta). */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  /** Coluna arquivada (aparece esmaecida) e o botão de arquivar/desarquivar. */
  archived?: boolean;
  onToggleArchived?: () => void;
  /** O que o botão de arquivar arquiva ('a coluna' | 'o grupo'), pro texto da dica. */
  archiveLabel?: string;
  /** Botão "ver arquivados" da coluna (mostra/oculta, na própria coluna, os cards e grupos arquivados dela). */
  archivedView?: { count: number; on: boolean; onClick: () => void };
}

function TreeHeaderRow({
  nodeId, dropTarget, depth, icon, name, count, bold, hasContent, collapsed, coverPath, coverSize, isDropOver, onToggle, addItems, textColors,
  onEmojiClick, onAppearanceToggle, appearanceOpen, onRename, onDelete, draggableGroupId, dropZone, kbFocused,
  onMoveUp, onMoveDown, canMoveUp = true, canMoveDown = true, archived, onToggleArchived, archiveLabel = 'a coluna', archivedView,
}: TreeHeaderRowProps) {
  const { setNodeRef } = useDroppable({
    id: `drop-header:${nodeId}`,
    data: { type: 'header', target: dropTarget },
    disabled: !dropTarget,
  });
  const [addMenu, setAddMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const cancelledRef = useRef(false);

  // Arrastar o grupo pelo cabeçalho (8px de movimento começam o arrasto; clicar continua recolhendo/expandindo)
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `group:${draggableGroupId ?? nodeId}`,
    data: { type: 'group', groupId: draggableGroupId },
    disabled: !draggableGroupId || editing, // editando o nome: arrastar dentro do campo seleciona texto, não move o grupo
  });
  const zoneShadow = dropZone === 'before' ? 'inset 0 2px 0 #1a73e8' : dropZone === 'after' ? 'inset 0 -2px 0 #1a73e8' : undefined;

  function startEditing() {
    if (!onRename) return;
    cancelledRef.current = false;
    setDraft(name);
    setEditing(true);
  }

  function finishEditing(save: boolean) {
    setEditing(false);
    const next = draft.trim();
    if (save && next && next !== name) onRename?.(next); // vazio ou igual: descarta
  }

  // botões de ação do cabeçalho: só aparecem com o mouse sobre a linha
  const actionBtnCls = (extra: string) => `bg-transparent border-0 p-0 cursor-pointer shrink-0 leading-none opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 ${extra}`;
  const neutralBtnColor = textColors ? '' : 'text-neutral-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400';

  return (
    <div
      ref={(node) => { setNodeRef(node); setDragRef(node); }}
      data-tree-node-id={nodeId}
      {...(draggableGroupId ? attributes : {})}
      {...(draggableGroupId && !editing ? listeners : {})}
      onClick={() => onToggle(nodeId)}
      title={name}
      className={`group/row ${isDropOver ? 'bg-blue-100 dark:bg-blue-950' : textColors ? 'hover:bg-black/10' : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', paddingLeft: 6 + depth * INDENT_PX,
        fontSize: 12, cursor: 'pointer', borderRadius: 4, boxShadow: isDropOver ? 'inset 0 0 0 2px #1a73e8' : zoneShadow,
        opacity: isDragging ? 0.4 : archived ? 0.6 : 1, outline: kbFocused ? '2px solid #1a73e8' : 'none', outlineOffset: -2,
      }}
    >
      <span className={textColors ? undefined : TOGGLE_CLS} style={{ width: 14, fontSize: 10, textAlign: 'center', flexShrink: 0, visibility: hasContent ? 'visible' : 'hidden', color: textColors?.secondary }}>
        {collapsed ? '▶' : '▼'}
      </span>
      {coverPath ? (
        <span
          onClick={onAppearanceToggle ? (e) => { e.stopPropagation(); onAppearanceToggle(); } : undefined}
          title={onAppearanceToggle ? 'Capa do grupo (clique pra editar)' : undefined}
          style={{ display: 'inline-flex', flexShrink: 0, cursor: onAppearanceToggle ? 'pointer' : undefined }}
        >
          <CoverThumb path={coverPath} size={coverSize ?? GROUP_COVER_SIZE} />
        </span>
      ) : (
        <span
          onClick={onEmojiClick ? (e) => { e.stopPropagation(); onEmojiClick(e.currentTarget.getBoundingClientRect()); } : undefined}
          title={onEmojiClick ? 'Emoji do grupo' : undefined}
          style={{ flexShrink: 0, fontSize: 12, cursor: onEmojiClick ? 'pointer' : undefined }}
        >
          {icon}
        </span>
      )}
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()} // clicar no campo não recolhe o grupo
          onDoubleClick={(e) => e.stopPropagation()}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); finishEditing(true); }
            if (e.key === 'Escape') { e.stopPropagation(); cancelledRef.current = true; finishEditing(false); }
          }}
          onBlur={() => { if (!cancelledRef.current) finishEditing(true); }}
          className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-blue-400 dark:border-blue-500 dark:[color-scheme:dark]"
          style={{ flex: 1, minWidth: 0, padding: '1px 4px', fontSize: 12, fontWeight: bold ? 600 : 500, borderRadius: 3, outline: 'none' }}
        />
      ) : (
        <span
          onDoubleClick={onRename ? (e) => { e.stopPropagation(); startEditing(); } : undefined}
          className={textColors ? undefined : 'text-neutral-900 dark:text-neutral-100'}
          style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: bold ? 600 : 500, color: textColors?.text }}
        >
          {name}
        </span>
      )}
      {archivedView && (archivedView.count > 0 || archivedView.on) && !editing && (
        <button
          type="button"
          title={archivedView.on ? 'Ocultar os cards e grupos arquivados desta coluna' : 'Mostrar os cards e grupos arquivados desta coluna'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); archivedView.onClick(); }}
          className={`bg-transparent border-0 p-0 cursor-pointer shrink-0 leading-none ${archivedView.on ? 'text-blue-600 dark:text-blue-400' : (textColors ? '' : 'text-neutral-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400')}`}
          style={{ fontSize: 10, color: archivedView.on ? undefined : textColors?.secondary }}
        >
          {archivedView.on ? '🗄 ocultar' : `🗄 ${archivedView.count}`}
        </button>
      )}
      {onToggleArchived && !editing && (
        <button
          type="button"
          title={archived ? `Desarquivar ${archiveLabel}` : `Arquivar ${archiveLabel}`}
          aria-label={archived ? 'Desarquivar' : 'Arquivar'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onToggleArchived(); }}
          className={actionBtnCls(neutralBtnColor)}
          style={{ fontSize: 11, color: textColors?.secondary }}
        >
          {archived ? '📤' : '🗄'}
        </button>
      )}
      {(onMoveUp || onMoveDown) && !editing && (
        <span style={{ display: 'inline-flex', flexShrink: 0 }}>
          <button
            type="button"
            title="Mover a coluna para cima"
            aria-label="Mover para cima"
            disabled={!canMoveUp}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
            className={actionBtnCls(neutralBtnColor) + ' disabled:cursor-default disabled:opacity-0 group-hover/row:disabled:opacity-30'}
            style={{ fontSize: 11, padding: '0 2px', color: textColors?.secondary }}
          >
            ▲
          </button>
          <button
            type="button"
            title="Mover a coluna para baixo"
            aria-label="Mover para baixo"
            disabled={!canMoveDown}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
            className={actionBtnCls(neutralBtnColor) + ' disabled:cursor-default disabled:opacity-0 group-hover/row:disabled:opacity-30'}
            style={{ fontSize: 11, padding: '0 2px', color: textColors?.secondary }}
          >
            ▼
          </button>
        </span>
      )}
      {onRename && !editing && (
        <button
          type="button"
          title="Renomear (ou dois cliques no nome)"
          aria-label="Renomear"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); startEditing(); }}
          className={actionBtnCls(neutralBtnColor)}
          style={{ fontSize: 11, color: textColors?.secondary }}
        >
          ✎
        </button>
      )}
      {onAppearanceToggle && (
        <button
          type="button"
          title="Aparência do grupo (capa, descrição, cor de fundo e etiquetas)"
          aria-label="Aparência do grupo"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onAppearanceToggle(); }}
          className={`bg-transparent border-0 p-0 cursor-pointer shrink-0 leading-none ${appearanceOpen ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100'
            }`}
          style={{ fontSize: 12 }}
        >
          🎨
        </button>
      )}
      {addItems && addItems.length > 0 && (
        <button
          type="button"
          title="Adicionar (atalhos com o mouse sobre o item: C = card, G = grupo)"
          aria-label="Adicionar"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation(); // não recolhe/expande
            const r = e.currentTarget.getBoundingClientRect();
            setAddMenu({ x: r.left, y: r.bottom + 4 });
          }}
          className={`bg-transparent border-0 p-0 cursor-pointer shrink-0 leading-none ${textColors ? '' : 'text-neutral-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400'
            } ${addMenu ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100'}`}
          style={{ fontSize: 14, color: textColors?.secondary }}
        >
          ＋
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          title="Desagrupar ou excluir (pergunta o que fazer com os cards)"
          aria-label="Desagrupar ou excluir"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className={actionBtnCls(textColors ? '' : 'text-red-600 dark:text-red-400')}
          style={{ fontSize: 11, color: textColors?.danger }}
        >
          ✕
        </button>
      )}
      <span className={textColors ? undefined : 'text-neutral-400 dark:text-neutral-500'} style={{ fontSize: 10, flexShrink: 0, color: textColors?.muted }}>{count}</span>
      {addMenu && addItems && createPortal(
        // No React o clique no item do menu (que está num portal) SOBE até a linha do cabeçalho e recolhia o grupo
        // logo depois de "Adicionar card/grupo". Este div segura o clique antes de chegar lá.
        <div onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <ContextMenu
            x={addMenu.x}
            y={addMenu.y}
            onClose={() => setAddMenu(null)}
            items={addItems.map((item) => ({ label: item.label, onClick: () => { setAddMenu(null); item.onClick(); } }))}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

const TOGGLE_CLS = 'text-neutral-500 dark:text-neutral-400 bg-transparent border-0 p-0 cursor-pointer';
const LINK_CLS = 'text-blue-600 dark:text-blue-400 bg-transparent border-0 p-0 cursor-pointer';

/**
 * Visualização do quadro como árvore recolhível: Coluna > Grupo > Subgrupo (qualquer profundidade) > Card.
 * Clicar no card abre os detalhes; clicar numa coluna/grupo recolhe/expande. Com `treeActions` também dá pra criar
 * cards/grupos/subgrupos (botão ＋ do cabeçalho), renomear o card (dois cliques no título) e arrastar cards entre
 * colunas, grupos e subgrupos (pra cima de um card = vira vizinho dele; pra cima de um cabeçalho = vai pro fim). Grupos e
 * subgrupos também se arrastam pelo cabeçalho: em cima do cabeçalho de outro grupo (parte de cima = antes, meio = vira
 * subgrupo, parte de baixo = depois) ou de uma coluna (vira grupo de topo).
 * Usa os mesmos cards/grupos já filtrados que o quadro recebe do hook.
 * Capas: coluna, grupo/subgrupo e card mostram miniatura (a da coluna e a do grupo substituem o ícone/emoji, como no quadro).
 */
export default function KanbanTreeView({
  columns, groups, cardsByGroup, ungroupedCardsByColumn, checklistProgress, onChecklistChanged, onCardClick, selectedCardId, cardMenu, treeActions, selectedCardIds, onToggleSelect, onSelectRange, onClearSelection, bulk, visualConfig, columnBackgrounds, columnOpacities, sidePanel, stateKey = 'default',
}: KanbanTreeViewProps) {
  const archive = useArchive();
  const { icons: labelIcons } = useLabelIcons(); // ícones das etiquetas, os mesmos dos chips dos grupos no quadro
  // ordem dos itens à direita do título = ordem deles em visualConfig (a lista da aba ⚙ do card)
  const trailingOrder = useMemo(() => {
    const idx = (key: string) => { const i = (visualConfig ?? []).findIndex((c) => c.key === key); return i === -1 ? 999 : i; };
    const map = { labels: 'labels', priority: 'priority', checklist: 'checklist', due: 'dueDate', updated: 'updatedAt' } as const;
    const showUpdated = (visualConfig ?? []).find((c) => c.key === 'updatedAt')?.visible !== false; // some quando o usuário oculta o campo
    const keys: Array<'labels' | 'priority' | 'checklist' | 'due' | 'updated'> = ['labels', 'priority', 'checklist', 'due'];
    if (showUpdated) keys.push('updated');
    return keys.sort((a, b) => idx(map[a]) - idx(map[b]));
  }, [visualConfig]);
  const storageKey = `${STORAGE_PREFIX}${stateKey}`;
  const statusKanbanId = columns[0]?.kanbanId ?? stateKey; // chave do "agrupar por estado" (a mesma do quadro)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => readCollapsed(storageKey));

  // Zoom: Ctrl + roda do mouse (ou pinça do trackpad) com o mouse sobre a árvore. Só a lista dá zoom — a barra do topo fica fixa.
  const zoomKey = `${ZOOM_PREFIX}${stateKey}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(() => readZoom(zoomKey));
  const zoomRef = useRef(zoom);

  function applyZoom(next: number) {
    const z = clampZoom(next);
    zoomRef.current = z;
    setZoom(z);
    try { localStorage.setItem(zoomKey, String(z)); } catch { /* sem storage: só não persiste */ }
  }
  const applyZoomRef = useRef(applyZoom);
  applyZoomRef.current = applyZoom;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return; // roda sem Ctrl continua rolando a página normalmente
      e.preventDefault(); // impede o zoom da página inteira do webview
      applyZoomRef.current(zoomRef.current * Math.exp(-e.deltaY * 0.0015));
    }
    // listener nativo com passive:false — o onWheel do React é passivo e não deixaria dar preventDefault
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Largura do painel lateral: arrasta a borda esquerda dele; o valor final fica salvo por kanban.
  const panelWidthKey = `${PANEL_WIDTH_PREFIX}${stateKey}`;
  const [panelWidth, setPanelWidth] = useState<number>(() => readPanelWidth(panelWidthKey));

  function savePanelWidth(w: number) {
    try { localStorage.setItem(panelWidthKey, String(w)); } catch { /* sem storage: só não persiste */ }
  }

  function handlePanelResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = panelWidth;
    let finalWidth = startWidth;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // não selecionar texto da árvore enquanto arrasta

    function onMove(ev: MouseEvent) {
      // o painel fica à direita: arrastar pra ESQUERDA aumenta a largura
      finalWidth = clampPanelWidth(startWidth + (startX - ev.clientX));
      setPanelWidth(finalWidth);
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      savePanelWidth(finalWidth);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function resetPanelWidth() {
    setPanelWidth(DEFAULT_PANEL_WIDTH);
    savePanelWidth(DEFAULT_PANEL_WIDTH);
  }

  /* ----- criar card / grupo / subgrupo direto na árvore ----- */

  type AddingState = { kind: 'card' | 'group'; scope: 'column' | 'group'; id: string } | null;
  const [adding, setAdding] = useState<AddingState>(null);

  function startAdding(next: NonNullable<AddingState>) {
    // o campo mora dentro do nó: se ele estiver recolhido, abre
    const nodeId = next.scope === 'column' ? `col:${next.id}` : `grp:${next.id}`;
    if (collapsed.has(nodeId)) {
      const copy = new Set(collapsed);
      copy.delete(nodeId);
      commit(copy);
    }
    setAdding(next);
  }

  function submitAdding(text: string) {
    if (!adding || !treeActions) return;
    if (adding.kind === 'card') {
      if (adding.scope === 'column') void treeActions.onAddCardToColumn(adding.id, text);
      else void treeActions.onAddCardToGroup(adding.id, text);
    } else if (adding.scope === 'column') {
      void treeActions.onCreateGroup(adding.id, text);
    } else {
      void treeActions.onCreateSubgroup(adding.id, text);
    }
  }

  /* ----- seleção múltipla de cards ----- */

  const cardMove = useCardMove(); // arrastar vários cards: todos vão pro fim do destino (mesma função do "Mover para…")
  const lastSelectedRef = useRef<string | null>(null); // âncora do Shift + clique

  /** Cards visíveis na ordem em que aparecem na tela (grupos recolhidos escondem os deles) — pra selecionar um intervalo. */
  function visibleCardOrder(): string[] {
    const out: string[] = [];
    const walkGroup = (g: KanbanCardGroup) => {
      if (collapsed.has(`grp:${g.id}`)) return;
      for (const c of cardsByGroup.get(g.id) ?? []) out.push(c.id);
      for (const kid of childrenByParent.get(g.id) ?? []) walkGroup(kid);
    };
    for (const col of columns) {
      if (collapsed.has(`col:${col.id}`)) continue;
      for (const g of topGroupsByColumn.get(col.id) ?? []) walkGroup(g);
      for (const c of ungroupedCardsByColumn.get(col.id) ?? []) out.push(c.id);
    }
    return out;
  }

  function handleToggleCheck(cardId: string) {
    onToggleSelect?.(cardId);
    lastSelectedRef.current = cardId;
  }

  function handleRowClick(cardId: string, e: React.MouseEvent) {
    // Ctrl/Cmd + clique: marca/desmarca o card (não abre)
    if (onToggleSelect && (e.ctrlKey || e.metaKey)) {
      handleToggleCheck(cardId);
      return;
    }
    // Shift + clique: seleciona do último card marcado até este
    if (onSelectRange && e.shiftKey) {
      const order = visibleCardOrder();
      const to = order.indexOf(cardId);
      const from = lastSelectedRef.current ? order.indexOf(lastSelectedRef.current) : -1;
      if (to >= 0 && from >= 0) {
        const [start, end] = from < to ? [from, to] : [to, from];
        onSelectRange(order.slice(start, end + 1));
      } else {
        handleToggleCheck(cardId); // sem âncora: começa a seleção por este
      }
      return;
    }
    lastSelectedRef.current = cardId;
    onCardClick(cardId); // clique normal: abre o card (o quadro também limpa a seleção)
  }

  /* ----- painel 🎨 de aparência e seletor de emoji dos grupos ----- */

  const coverSizeKey = `${COVER_SIZE_PREFIX}${stateKey}`;
  const [coverSize, setCoverSize] = useState<number>(() => readCoverSize(coverSizeKey));
  const groupHeightsKey = `${GROUP_HEIGHT_PREFIX}${stateKey}`;
  const [groupHeights, setGroupHeights] = useState<Record<string, number>>(() => readGroupHeights(groupHeightsKey));
  function changeGroupHeight(groupId: string, height: number | null) {
    setGroupHeights((prev) => {
      const next = { ...prev };
      if (height === null) delete next[groupId]; else next[groupId] = height;
      try { localStorage.setItem(groupHeightsKey, JSON.stringify(next)); } catch { /* sem espaço/privado: só não lembra */ }
      return next;
    });
  }

  function changeCoverSize(size: number) {
    setCoverSize(size);
    try { localStorage.setItem(coverSizeKey, String(size)); } catch { /* sem storage: só não persiste */ }
  }

  const [appearanceOpen, setAppearanceOpen] = useState<Set<string>>(() => new Set());
  const [emojiFor, setEmojiFor] = useState<{ groupId: string; x: number; y: number } | null>(null);

  function toggleAppearance(groupId: string) {
    setAppearanceOpen((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  }

  /* ----- arrastar e soltar de cards ----- */

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<DropHint>(null); // sobre qual linha de card está e se é na metade de baixo
  const [overHeaderId, setOverHeaderId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null); // grupo/subgrupo sendo arrastado
  const [groupHint, setGroupHint] = useState<{ groupId: string; zone: GroupDropZone } | null>(null);

  // onde cada card mora hoje (grupo ou coluna) e quem são os vizinhos — pra resolver "antes de quem" ao soltar
  const cardLocation = useMemo(() => {
    const map = new Map<string, { target: TreeMoveTarget; list: KanbanCard[] }>();
    for (const [groupId, list] of cardsByGroup) {
      for (const c of list) map.set(c.id, { target: { kind: 'group', id: groupId }, list });
    }
    for (const [columnId, list] of ungroupedCardsByColumn) {
      for (const c of list) map.set(c.id, { target: { kind: 'column', id: columnId }, list });
    }
    return map;
  }, [cardsByGroup, ungroupedCardsByColumn]);

  const activeCard = activeCardId ? cardLocation.get(activeCardId)?.list.find((c) => c.id === activeCardId) ?? null : null;
  const activeGroup = activeGroupId ? groups.find((g) => g.id === activeGroupId) ?? null : null;
  const overlayLabel = activeCard
    ? (selectedCardIds && selectedCardIds.size > 1 && selectedCardIds.has(activeCard.id) ? `${selectedCardIds.size} cards` : activeCard.title)
    : activeGroup ? `${activeGroup.emoji ?? '🏷️'} ${activeGroup.name}` : null;

  function resetDrag() {
    setActiveCardId(null);
    setActiveGroupId(null);
    setDropHint(null);
    setGroupHint(null);
    setOverHeaderId(null);
  }

  /** Todos os subgrupos (qualquer profundidade) de um grupo — um grupo não pode ser solto dentro de si mesmo nem de um deles. */
  function descendantIdsOf(rootId: string): Set<string> {
    const out = new Set<string>();
    const stack = [rootId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      for (const child of childrenByParent.get(id) ?? []) {
        out.add(child.id);
        stack.push(child.id);
      }
    }
    return out;
  }

  /** O card arrastado está na metade de baixo da linha em que está por cima? (decide antes/depois dela) */
  function isBelowCenter(event: DragMoveEvent | DragEndEvent): boolean {
    const translated = event.active.rect.current.translated;
    const overRect = event.over?.rect;
    if (!translated || !overRect) return false;
    return translated.top + translated.height / 2 > overRect.top + overRect.height / 2;
  }

  /** Onde o PONTEIRO está dentro do cabeçalho de grupo: 30% de cima = antes, 30% de baixo = depois, o meio = dentro (subgrupo). */
  function groupZoneOf(event: DragMoveEvent | DragEndEvent): GroupDropZone {
    const overRect = event.over?.rect;
    if (!overRect) return 'inside';
    const origin = event.activatorEvent as MouseEvent | PointerEvent | undefined;
    const translated = event.active.rect.current.translated;
    const y = origin && typeof origin.clientY === 'number'
      ? origin.clientY + event.delta.y
      : translated ? translated.top + translated.height / 2 : overRect.top + overRect.height / 2;
    const rel = (y - overRect.top) / Math.max(overRect.height, 1);
    return rel < 0.3 ? 'before' : rel > 0.7 ? 'after' : 'inside';
  }

  function handleDragStart({ active }: DragStartEvent) {
    const data = active.data.current as { type?: string; cardId?: string; groupId?: string } | undefined;
    if (data?.type === 'group') {
      setActiveGroupId(data.groupId ?? null);
      setActiveCardId(null);
    } else {
      setActiveCardId(data?.cardId ?? null);
      setActiveGroupId(null);
    }
  }

  function handleDragMove(event: DragMoveEvent) {
    const { over } = event;
    const overData = over?.data.current as { type?: string; cardId?: string; target?: TreeMoveTarget | null } | undefined;

    // --- arrastando um GRUPO/SUBGRUPO: só cabeçalhos de coluna/grupo são destino ---
    if (activeGroupId) {
      const target = overData?.type === 'header' ? overData.target : null;
      if (!over || !target) { setGroupHint(null); setOverHeaderId(null); return; }
      if (target.kind === 'column') { setGroupHint(null); setOverHeaderId(`col:${target.id}`); return; }
      if (target.id === activeGroupId || descendantIdsOf(activeGroupId).has(target.id)) {
        setGroupHint(null);
        setOverHeaderId(null);
        return; // dentro de si mesmo ou de um subgrupo dele: não deixa
      }
      const zone = groupZoneOf(event);
      setGroupHint({ groupId: target.id, zone });
      setOverHeaderId(zone === 'inside' ? `grp:${target.id}` : null);
      return;
    }

    // --- arrastando um CARD ---
    if (!over || !overData) { setDropHint(null); setOverHeaderId(null); return; }
    if (overData.type === 'card' && overData.cardId && overData.cardId !== activeCardId) {
      setDropHint({ overId: overData.cardId, after: isBelowCenter(event) });
      setOverHeaderId(null);
    } else if (overData.type === 'header') {
      setDropHint(null);
      setOverHeaderId(String(over.id).replace('drop-header:', ''));
    } else {
      setDropHint(null);
      setOverHeaderId(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { over } = event;
    const movedGroupId = activeGroupId;
    const movedId = activeCardId;
    resetDrag();
    if (!over || !treeActions) return;
    const overData = over.data.current as { type?: string; cardId?: string; target?: TreeMoveTarget | null } | undefined;
    if (!overData) return;

    // --- soltou um GRUPO/SUBGRUPO ---
    if (movedGroupId) {
      const target = overData.type === 'header' ? overData.target : null;
      if (!target) return;
      const byPosition = (a: KanbanCardGroup, b: KanbanCardGroup) => a.position - b.position;

      let newParentId: string | null;
      let columnId: string;
      let siblings: KanbanCardGroup[];
      let insertAt: number;

      if (target.kind === 'column') {
        // cabeçalho de coluna: vira grupo de topo, no fim da coluna
        newParentId = null;
        columnId = target.id;
        siblings = groups.filter((g) => !g.parentGroupId && g.columnId === columnId && g.id !== movedGroupId).sort(byPosition);
        insertAt = siblings.length;
      } else {
        const overGroup = groups.find((g) => g.id === target.id);
        if (!overGroup) return;
        if (overGroup.id === movedGroupId || descendantIdsOf(movedGroupId).has(overGroup.id)) return;
        const zone = groupZoneOf(event);
        if (zone === 'inside') {
          newParentId = overGroup.id; // vira o ÚLTIMO subgrupo dele
          columnId = overGroup.columnId;
          siblings = groups.filter((g) => g.parentGroupId === overGroup.id && g.id !== movedGroupId).sort(byPosition);
          insertAt = siblings.length;
        } else {
          newParentId = overGroup.parentGroupId ?? null; // irmão dele (antes ou depois), no mesmo pai
          columnId = overGroup.columnId;
          siblings = groups
            .filter((g) => (g.parentGroupId ?? null) === newParentId && g.columnId === columnId && g.id !== movedGroupId)
            .sort(byPosition);
          const idx = siblings.findIndex((g) => g.id === overGroup.id);
          insertAt = zone === 'before' ? idx : idx + 1;
        }
      }

      const ordered = [...siblings.slice(0, insertAt).map((g) => g.id), movedGroupId, ...siblings.slice(insertAt).map((g) => g.id)];

      // soltou no mesmo lugar: nada a gravar
      const current = groups.find((g) => g.id === movedGroupId);
      if (current && (current.parentGroupId ?? null) === newParentId && current.columnId === columnId) {
        const currentOrder = groups
          .filter((g) => (g.parentGroupId ?? null) === newParentId && g.columnId === columnId)
          .sort(byPosition)
          .map((g) => g.id);
        if (currentOrder.join('|') === ordered.join('|')) return;
      }

      if (newParentId && collapsed.has(`grp:${newParentId}`)) {
        const copy = new Set(collapsed);
        copy.delete(`grp:${newParentId}`); // o grupo solto dentro de um pai recolhido não pode "sumir"
        commit(copy);
      }
      void treeActions.onMoveGroup(movedGroupId, newParentId, columnId, ordered);
      return;
    }

    // --- soltou um CARD ---
    if (!movedId) return;

    // O card arrastado faz parte de uma seleção de 2+: todos os selecionados vão juntos, pro FIM do destino
    if (selectedCardIds && selectedCardIds.size > 1 && selectedCardIds.has(movedId) && cardMove) {
      const dest = overData.type === 'header' ? overData.target
        : overData.type === 'card' && overData.cardId ? cardLocation.get(overData.cardId)?.target ?? null
          : null;
      if (dest) {
        void cardMove.moveCards(Array.from(selectedCardIds), dest.kind === 'group' ? { kind: 'group', groupId: dest.id } : { kind: 'column', columnId: dest.id });
      }
      return;
    }
    if (overData.type === 'header' && overData.target) {
      // soltou no cabeçalho de uma coluna/grupo: vai pro FIM dele
      void treeActions.onMoveCard(movedId, overData.target, null);
      return;
    }

    if (overData.type === 'card' && overData.cardId && overData.cardId !== movedId) {
      const loc = cardLocation.get(overData.cardId);
      if (!loc) return;
      const after = isBelowCenter(event);
      let beforeCardId: string | null = overData.cardId;
      if (after) {
        // "depois" da linha = antes do próximo card do mesmo lugar (ignorando o que está sendo arrastado); sem próximo, vai pro fim
        const siblings = loc.list.filter((c) => c.id !== movedId);
        const idx = siblings.findIndex((c) => c.id === overData.cardId);
        beforeCardId = idx >= 0 && idx + 1 < siblings.length ? siblings[idx + 1].id : null;
      }
      void treeActions.onMoveCard(movedId, loc.target, beforeCardId);
    }
  }

  /* ----- atalhos de teclado (os mesmos do quadro; valem pro item que está embaixo do mouse) ----- */

  const hoverRef = useRef<{ cardId: string | null; groupId: string | null; columnId: string | null }>({ cardId: null, groupId: null, columnId: null });
  const mouseRef = useRef({ x: 0, y: 0 }); // última posição do mouse: os atalhos de campo abrem o menu ali
  const cardShortcutNonce = useRef(0);
  // Cursor da navegação por teclado (WASD): id do nó (`card:ID` / `grp:ID` / `col:ID`). Mexer o mouse tira o cursor e volta a valer o hover.
  const [kbCursor, setKbCursorState] = useState<string | null>(null);
  const kbCursorRef = useRef<string | null>(null);
  function setKbCursor(value: string | null) { kbCursorRef.current = value; setKbCursorState(value); }
  const [shortcutPopup, setShortcutPopup] = useState<{ kind: 'status' | 'due' | 'color' | 'labels' | 'move'; cardId: string; x: number; y: number } | null>(null);
  const [editRequest, setEditRequest] = useState<{ cardId: string; nonce: number } | null>(null);

  // Guarda qual card/grupo/coluna está embaixo do mouse. Ouvintes NATIVOS no container (e não onMouseLeave do React):
  // o React trata os menus em portal (que ficam no <body>) como "dentro" da árvore, e com um menu aberto os atalhos
  // NÃO devem disparar — com o ouvinte nativo, ir pro menu conta como sair da árvore.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onOver(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      hoverRef.current = {
        cardId: t?.closest<HTMLElement>('[data-tree-card-id]')?.dataset.treeCardId ?? null,
        groupId: t?.closest<HTMLElement>('[data-tree-group-id]')?.dataset.treeGroupId ?? null, // o grupo/subgrupo mais interno
        columnId: t?.closest<HTMLElement>('[data-tree-col-id]')?.dataset.treeColId ?? null,
      };
    }
    function onLeave() {
      hoverRef.current = { cardId: null, groupId: null, columnId: null };
    }
    function onMove(e: MouseEvent) {
      const prev = mouseRef.current;
      mouseRef.current = { x: e.clientX, y: e.clientY };
      // só mexida de verdade conta (rolar a tela por baixo do mouse pode disparar mousemove com a mesma posição)
      if (kbCursorRef.current && Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y) > 4) { kbCursorRef.current = null; setKbCursorState(null); }
    }
    el.addEventListener('mouseover', onOver);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('mousemove', onMove);
    return () => {
      el.removeEventListener('mouseover', onOver);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('mousemove', onMove);
    };
  }, []);

  // O tratador é recriado a cada render (enxerga o estado de agora) e o ouvinte do documento só chama a versão atual.
  const shortcutRef = useRef<(e: KeyboardEvent) => void>(() => { });
  shortcutRef.current = (e: KeyboardEvent) => {
    if (!treeActions) return;
    const lowerKey = e.key.toLowerCase();
    const isCut = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && lowerKey === 'x';
    const isPaste = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && lowerKey === 'v';
    const isAltSelect = e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyS'; // Alt+S (pelo código da tecla: no Mac Alt+S vira "ß")
    if ((e.ctrlKey || e.metaKey || e.altKey) && !isCut && !isPaste && !isAltSelect) return; // nunca intercepta Ctrl+C etc.
    if (e.repeat && e.key.toLowerCase() !== 'w' && e.key.toLowerCase() !== 's') return; // segurar W/S continua descendo/subindo; o resto não repete
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return; // digitando
    if (shortcutPopup) return; // já tem um menu de campo aberto
    const key = e.key.toLowerCase();

    // --- navegação por teclado (WASD) e Espaço: agem no item marcado pelo teclado ou, sem ele, no que está sob o mouse
    const nodeIdOfHover = (h: { cardId: string | null; groupId: string | null; columnId: string | null }): string | null =>
      h.cardId ? `card:${h.cardId}` : h.groupId ? `grp:${h.groupId}` : h.columnId ? `col:${h.columnId}` : null;
    const nodeExists = (id: string) => !!containerRef.current?.querySelector(`[data-tree-node-id="${id}"]`);
    const curNode = kbCursor && nodeExists(kbCursor) ? kbCursor : null;
    const hoverNode = nodeIdOfHover(hoverRef.current);
    const allNodes = (): string[] => {
      const list: HTMLElement[] = containerRef.current ? Array.from(containerRef.current.querySelectorAll<HTMLElement>('[data-tree-node-id]')) : [];
      return list.map((n) => n.dataset.treeNodeId as string);
    };
    const parentNodeOf = (nodeId: string): string | null => {
      if (nodeId.startsWith('card:')) {
        const loc = cardLocation.get(nodeId.slice(5));
        return loc ? (loc.target.kind === 'group' ? `grp:${loc.target.id}` : `col:${loc.target.id}`) : null;
      }
      if (nodeId.startsWith('grp:')) {
        const g = groups.find((x) => x.id === nodeId.slice(4));
        return g ? (g.parentGroupId ? `grp:${g.parentGroupId}` : `col:${g.columnId}`) : null;
      }
      return null;
    };
    const hasChildren = (nodeId: string): boolean => {
      const id = nodeId.slice(4);
      if (nodeId.startsWith('grp:')) return (childrenByParent.get(id)?.length ?? 0) > 0 || (cardsByGroup.get(id)?.length ?? 0) > 0;
      if (nodeId.startsWith('col:')) return (topGroupsByColumn.get(id)?.length ?? 0) > 0 || (ungroupedCardsByColumn.get(id)?.length ?? 0) > 0;
      return false;
    };
    const focusNode = (nodeId: string) => {
      setKbCursor(nodeId);
      requestAnimationFrame(() => containerRef.current?.querySelector(`[data-tree-node-id="${nodeId}"]`)?.scrollIntoView({ block: 'nearest' }));
    };

    // Ctrl+X recorta, Ctrl+V cola (no grupo/coluna do item), Alt+S marca/desmarca o card
    if (isCut || isPaste || isAltSelect) {
      const nodeNow = curNode ?? hoverNode;
      const cardNodeId = nodeNow && nodeNow.startsWith('card:') ? nodeNow.slice(5) : null;
      if (isAltSelect) {
        if (!cardNodeId) return;
        e.preventDefault();
        handleToggleCheck(cardNodeId);
        return;
      }
      if (isCut) {
        const sel = selectedCardIds ? Array.from(selectedCardIds) : [];
        const ids = cardNodeId ? (sel.includes(cardNodeId) ? sel : [cardNodeId]) : sel; // card numa seleção: recorta a seleção toda
        if (ids.length === 0) return;
        e.preventDefault();
        setCutCardIds(ids);
        onClearSelection?.();
        return;
      }
      // colar
      const cutIds = getCutCardIds().filter((id) => cardLocation.has(id));
      if (cutIds.length === 0 || !cardMove || !nodeNow) return;
      const destNode = nodeNow.startsWith('card:') ? parentNodeOf(nodeNow) : nodeNow;
      if (!destNode) return;
      e.preventDefault();
      const dest = destNode.startsWith('grp:')
        ? { kind: 'group' as const, groupId: destNode.slice(4) }
        : { kind: 'column' as const, columnId: destNode.slice(4) };
      void cardMove.moveCards(cutIds, dest);
      clearCutCards();
      return;
    }

    if (key === 'w' || key === 's') {
      const nodes = allNodes();
      if (nodes.length === 0) return;
      const from = curNode ?? hoverNode;
      const idx = from ? nodes.indexOf(from) : -1;
      const next = key === 'w' ? Math.max(idx - 1, 0) : Math.min(idx + 1, nodes.length - 1);
      e.preventDefault();
      focusNode(nodes[next]);
      return;
    }
    if (key === 'd') {
      const from = curNode ?? hoverNode;
      if (!from) return;
      e.preventDefault();
      focusNode(from);
      if (from.startsWith('card:')) { // D num card: abre no painel lateral
        const id = from.slice(5);
        lastSelectedRef.current = id;
        onCardClick(id);
      } else if (collapsed.has(from)) {
        toggle(from); // recolhido: expande
      } else if (hasChildren(from)) { // expandido: entra (vai pro primeiro filho)
        const nodes = allNodes();
        const i = nodes.indexOf(from);
        if (i >= 0 && i + 1 < nodes.length) focusNode(nodes[i + 1]);
      }
      return;
    }
    if (key === 'a') {
      const from = curNode ?? hoverNode;
      if (!from) return;
      e.preventDefault();
      if (!from.startsWith('card:') && !collapsed.has(from) && hasChildren(from)) { focusNode(from); toggle(from); return; } // expandido: recolhe
      focusNode(parentNodeOf(from) ?? from); // senão: sobe pro grupo/coluna de cima
      return;
    }
    if (e.key === ' ') {
      if (t && (t.tagName === 'BUTTON' || t.tagName === 'A')) return; // deixa o Espaço ativar o botão focado
      let node = curNode ?? hoverNode;
      if (node && node.startsWith('card:')) node = parentNodeOf(node); // sobre um card: age no grupo/coluna dele
      if (!node) return;
      e.preventDefault();
      toggle(node);
      return;
    }

    // alvo dos demais atalhos: o item do teclado (se houver) ou o que está sob o mouse
    const targetOfNode = (nodeId: string): { cardId: string | null; groupId: string | null; columnId: string | null } => {
      if (nodeId.startsWith('card:')) {
        const loc = cardLocation.get(nodeId.slice(5));
        return { cardId: nodeId.slice(5), groupId: loc?.target.kind === 'group' ? loc.target.id : null, columnId: loc?.target.kind === 'column' ? loc.target.id : null };
      }
      if (nodeId.startsWith('grp:')) return { cardId: null, groupId: nodeId.slice(4), columnId: null };
      return { cardId: null, groupId: null, columnId: nodeId.slice(4) };
    };
    const hover = curNode ? targetOfNode(curNode) : hoverRef.current;
    const popupPos = (): { x: number; y: number } => {
      if (!curNode) return mouseRef.current;
      const r = containerRef.current?.querySelector(`[data-tree-node-id="${curNode}"]`)?.getBoundingClientRect();
      return r ? { x: r.left + 40, y: r.bottom + 2 } : mouseRef.current;
    };

    // Atalhos de campo do card (sob o mouse ou marcado pelo teclado): T status, P prazo, K cor, L etiquetas, M mover, E editar título
    const fieldKinds: Record<string, 'status' | 'due' | 'color' | 'labels' | 'move'> = { t: 'status', p: 'due', k: 'color', l: 'labels', m: 'move' };
    if (hover.cardId && (key in fieldKinds || key === 'e')) {
      if (!cardLocation.has(hover.cardId)) return;
      if (key === 'e') {
        e.preventDefault();
        cardShortcutNonce.current += 1;
        setEditRequest({ cardId: hover.cardId, nonce: cardShortcutNonce.current });
        return;
      }
      const kind = fieldKinds[key];
      if (kind === 'move' && !cardMove) return;
      if (kind !== 'due' && kind !== 'move' && !cardMenu && !bulk) return;
      e.preventDefault();
      const pos = popupPos();
      setShortcutPopup({ kind, cardId: hover.cardId, x: pos.x, y: pos.y });
      return;
    }

    if (key === 'q') {
      // Q = excluir o card sob o mouse (pede confirmação, como no quadro); se ele está numa seleção de 2+, exclui todos os selecionados
      if (!hover.cardId) return;
      if (bulk && selectedCardIds && selectedCardIds.size > 1 && selectedCardIds.has(hover.cardId)) {
        e.preventDefault();
        bulk.onDelete();
        return;
      }
      if (!cardMenu) return;
      const card = cardLocation.get(hover.cardId)?.list.find((c) => c.id === hover.cardId);
      if (!card) return;
      e.preventDefault();
      cardMenu.onRequestDelete(card.id, card.title);
    } else if (key === 'c') {
      // C = novo card no grupo/subgrupo sob o mouse (ou, fora de grupo, na coluna)
      if (hover.groupId) { e.preventDefault(); startAdding({ kind: 'card', scope: 'group', id: hover.groupId }); }
      else if (hover.columnId) { e.preventDefault(); startAdding({ kind: 'card', scope: 'column', id: hover.columnId }); }
    } else if (key === 'g') {
      // G = novo subgrupo dentro do grupo sob o mouse (ou, fora de grupo, novo grupo na coluna)
      if (hover.groupId) { e.preventDefault(); startAdding({ kind: 'group', scope: 'group', id: hover.groupId }); }
      else if (hover.columnId) { e.preventDefault(); startAdding({ kind: 'group', scope: 'column', id: hover.columnId }); }
    }
  };
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => shortcutRef.current(e);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  function commit(next: Set<string>) {
    setCollapsed(next);
    try { localStorage.setItem(storageKey, JSON.stringify(Array.from(next))); } catch { /* sem storage: só não persiste */ }
  }

  function toggle(nodeId: string) {
    const next = new Set(collapsed);
    if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
    commit(next);
  }

  const { topGroupsByColumn, childrenByParent } = useMemo(() => {
    const top = new Map<string, KanbanCardGroup[]>();
    const children = new Map<string, KanbanCardGroup[]>();
    for (const g of groups) {
      if (g.parentGroupId) {
        const list = children.get(g.parentGroupId) ?? [];
        list.push(g);
        children.set(g.parentGroupId, list);
      } else {
        const list = top.get(g.columnId) ?? [];
        list.push(g);
        top.set(g.columnId, list);
      }
    }
    for (const list of top.values()) list.sort((a, b) => a.position - b.position);
    for (const list of children.values()) list.sort((a, b) => a.position - b.position);
    return { topGroupsByColumn: top, childrenByParent: children };
  }, [groups]);

  /** Cards do grupo + de todos os subgrupos dele. */
  function countGroupCards(groupId: string): number {
    let total = cardsByGroup.get(groupId)?.length ?? 0;
    for (const child of childrenByParent.get(groupId) ?? []) total += countGroupCards(child.id);
    return total;
  }

  function countColumnCards(columnId: string): number {
    let total = ungroupedCardsByColumn.get(columnId)?.length ?? 0;
    for (const g of topGroupsByColumn.get(columnId) ?? []) total += countGroupCards(g.id);
    return total;
  }

  const totalCards = columns.reduce((sum, c) => sum + countColumnCards(c.id), 0);

  function expandAll() { commit(new Set()); }

  function collapseAll() {
    const ids = new Set<string>();
    for (const c of columns) ids.add(`col:${c.id}`);
    for (const g of groups) ids.add(`grp:${g.id}`);
    commit(ids);
  }

  function renderCard(card: KanbanCard, depth: number, groupColors: GroupTextColors = null): React.ReactNode {
    const hint = dropHint && dropHint.overId === card.id ? (dropHint.after ? 'after' : 'before') : null;
    return (
      <TreeCardRow
        key={card.id}
        card={card}
        depth={depth}
        progress={checklistProgress[card.id]}
        onChecklistChanged={onChecklistChanged}
        selected={card.id === selectedCardId}
        hint={hint}
        cardMenu={cardMenu}
        canEdit={!!treeActions}
        canDrag={!!treeActions}
        onClick={handleRowClick}
        checked={!!selectedCardIds?.has(card.id)}
        selectionActive={!!selectedCardIds && selectedCardIds.size > 0}
        onToggleCheck={onToggleSelect ? handleToggleCheck : undefined}
        bulkIds={selectedCardIds ? Array.from(selectedCardIds) : undefined}
        bulkActions={bulk}
        trailingOrder={trailingOrder}
        kbFocused={kbCursor === `card:${card.id}`}
        editNonce={editRequest?.cardId === card.id ? editRequest.nonce : undefined}
        onRename={(id, title) => treeActions?.onUpdateCardTitle(id, title)}
        groupColors={groupColors}
        onUpdateStatus={cardMenu?.onUpdateStatus}
        coverSize={coverSize}
      />
    );
  }

  /**
   * Bloco de grupo/subgrupo com o MESMO visual do quadro (GroupBlock): fundo (padrão ou a cor escolhida), borda tracejada
   * no grupo de topo, borda fina + faixa colorida por nível no subgrupo, emoji/capa, etiquetas, descrição e, embaixo dos
   * cards, a seção "Subgrupos" com os blocos filhos. `nest` = 0 no grupo de topo, +1 a cada nível de subgrupo.
   */
  function renderGroup(g: KanbanCardGroup, nest: number): React.ReactNode {
    const nodeId = `grp:${g.id}`;
    const kids = childrenByParent.get(g.id) ?? [];
    const groupCards = cardsByGroup.get(g.id) ?? [];
    const hasContent = kids.length > 0 || groupCards.length > 0;
    const isSub = nest > 0;
    const isOver = overHeaderId === nodeId;
    const hasCustomBg = g.backgroundColor != null;
    // com cor de fundo própria o contraste vem do cálculo (readableTextColors); sem ela (ou com o azul de "soltar aqui"), do tema
    const colors: GroupTextColors = hasCustomBg && !isOver ? readableTextColors(g.backgroundColor as string) : null;
    const accent = isSub ? DEPTH_ACCENT_COLORS[(nest - 1) % DEPTH_ACCENT_COLORS.length] : null;
    const labels = g.labels ?? []; // grupos salvos antes das etiquetas existirem não têm o campo
    const isCollapsed = collapsed.has(nodeId);
    const addingHere = !!adding && adding.scope === 'group' && adding.id === g.id;
    const panelOpen = !!treeActions && appearanceOpen.has(g.id);
    // o conteúdo (cards + subgrupos) rola quando o TOTAL de cards do grupo (o número do cabeçalho, com subgrupos) passa do limite
    const scrollBody = countGroupCards(g.id) > GROUP_SCROLL_THRESHOLD;

    return (
      <div
        key={g.id}
        data-tree-group-id={g.id}
        className={[
          isOver
            ? 'bg-blue-50 dark:bg-blue-950'
            : (hasCustomBg ? '' : (isSub ? 'bg-neutral-50 dark:bg-neutral-950' : 'bg-neutral-100 dark:bg-neutral-900')),
          isSub
            ? 'border border-neutral-200 dark:border-neutral-700'
            : 'border-2 border-dashed border-neutral-300 dark:border-neutral-600',
        ].join(' ')}
        style={{
          borderRadius: 6, padding: isSub ? 4 : 5, marginBottom: isSub ? 0 : 6, marginLeft: isSub ? 0 : INDENT_PX,
          ...(!isOver && hasCustomBg ? { backgroundColor: g.backgroundColor as string } : {}),
          borderLeft: isSub ? `3px solid ${accent}` : undefined,
          boxShadow: isSub ? '0 1px 2px rgba(0,0,0,0.04)' : undefined,
        }}
      >
        <TreeHeaderRow
          nodeId={nodeId}
          kbFocused={kbCursor === nodeId}
          dropTarget={treeActions ? { kind: 'group', id: g.id } : null}
          depth={0}
          icon={g.emoji ?? '🏷️'}
          name={g.name}
          count={countGroupCards(g.id)}
          bold
          hasContent={hasContent}
          collapsed={isCollapsed}
          coverPath={g.coverPath}
          coverSize={isSub ? SUBGROUP_COVER_SIZE : GROUP_COVER_SIZE}
          isDropOver={isOver}
          onToggle={toggle}
          textColors={colors}
          onEmojiClick={treeActions ? (rect) => setEmojiFor({ groupId: g.id, x: rect.left, y: rect.bottom + 4 }) : undefined}
          onAppearanceToggle={treeActions ? () => toggleAppearance(g.id) : undefined}
          appearanceOpen={panelOpen}
          onRename={treeActions ? (newName) => treeActions.onRenameGroup(g.id, newName) : undefined}
          onDelete={treeActions ? () => treeActions.onRequestDeleteGroup(g.id) : undefined}
          archived={archive?.isGroupArchived(g.id)}
          archiveLabel="o grupo"
          onToggleArchived={archive ? () => archive.archiveGroup(g.id, !archive.isGroupArchived(g.id)) : undefined}
          draggableGroupId={treeActions ? g.id : undefined}
          dropZone={groupHint && groupHint.groupId === g.id ? groupHint.zone : null}
          addItems={treeActions ? [
            { label: '＋ Adicionar card', onClick: () => startAdding({ kind: 'card', scope: 'group', id: g.id }) },
            { label: '📁 Adicionar subgrupo', onClick: () => startAdding({ kind: 'group', scope: 'group', id: g.id }) },
          ] : undefined}
        />

        {labels.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 6px 4px' }}>
            {labels.map((raw) => {
              const { name, color } = parseLabel(raw);
              return (
                <span
                  key={raw}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, borderRadius: 3, padding: '1px 5px',
                    backgroundColor: color, color: readableTextColors(color).text,
                  }}
                >
                  <LabelIconBadge icon={labelIcons[name]} size={11} />
                  {name}
                </span>
              );
            })}
          </div>
        )}

        {panelOpen && treeActions && (
          <GroupAppearancePanel
            group={g}
            coverSize={isSub ? SUBGROUP_COVER_SIZE : GROUP_COVER_SIZE}
            allLabels={treeActions.allLabels}
            onUpdate={treeActions.onUpdateGroupAppearance}
          />
        )}

        {g.description && !panelOpen && (
          <div
            className={colors ? undefined : 'text-neutral-500 dark:text-neutral-400'}
            style={{ fontSize: 11, padding: '0 6px 4px', color: colors?.secondary, whiteSpace: 'pre-wrap' }}
          >
            {g.description}
          </div>
        )}

        {!isCollapsed && (
          <ScrollBody
            defaultMaxHeight={scrollBody ? GROUP_SCROLL_MAX_HEIGHT : undefined}
            customHeight={groupHeights[g.id]}
            zoom={zoom}
            onResize={(h) => changeGroupHeight(g.id, h)}
          >
            <StatusSections kanbanId={statusKanbanId} scopeId={`tree-grp:${g.id}`} cards={groupCards} indent={16} renderCard={(c) => renderCard(c, 1, colors)} />
            {addingHere && adding && (
              <AddInlineInput
                depth={1}
                placeholder={adding.kind === 'card' ? 'Título do card...' : 'Nome do subgrupo...'}
                onSubmit={submitAdding}
                onClose={() => setAdding(null)}
              />
            )}
            {kids.length > 0 && (
              <div className="bg-black/[0.025] dark:bg-white/[0.04]" style={{ marginTop: 6, padding: 6, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  Subgrupo{kids.length !== 1 ? 's' : ''} ({kids.length})
                </div>
                {kids.map((k) => renderGroup(k, nest + 1))}
              </div>
            )}
          </ScrollBody>
        )}
      </div>
    );
  }

  /**
   * Coluna: cabeçalho + conteúdo. Com cor de fundo escolhida (viewPrefs.columnBackgrounds) vira um bloco com essa cor e
   * a opacidade escolhida, e o texto do cabeçalho e dos cards soltos usa cores legíveis sobre ela — igual ao quadro.
   */
  function renderColumn(col: KanbanColumn): React.ReactNode {
    const nodeId = `col:${col.id}`;
    const topGroups = topGroupsByColumn.get(col.id) ?? [];
    const looseCards = ungroupedCardsByColumn.get(col.id) ?? [];
    const hasContent = topGroups.length > 0 || looseCards.length > 0;
    const addingHere = !!adding && adding.scope === 'column' && adding.id === col.id;

    const bgColor = columnBackgrounds?.[col.id] ?? null;
    const opacity = columnOpacities?.[col.id] ?? 1;
    const isOver = overHeaderId === nodeId;
    // fundo translúcido: o contraste depende do que está embaixo, então o texto é escolhido sobre a cor já MISTURADA com a superfície do tema
    const colors: GroupTextColors = bgColor && !isOver
      ? readableTextColors(opacity < 1 ? blendOverSurface(bgColor, opacity, currentSurfaceHex()) : bgColor)
      : null;
    const panelOpen = !!treeActions && appearanceOpen.has(nodeId);

    return (
      <div
        key={col.id}
        data-tree-col-id={col.id}
        style={{
          marginBottom: 4,
          ...(bgColor ? { backgroundColor: opacity < 1 ? withAlpha(bgColor, opacity) : bgColor, borderRadius: 8, padding: 4 } : {}),
        }}
      >
        <TreeHeaderRow
          nodeId={nodeId}
          kbFocused={kbCursor === nodeId}
          dropTarget={treeActions ? { kind: 'column', id: col.id } : null}
          depth={0}
          icon={col.icon ?? '🗂'}
          name={col.visible === false ? `${col.name} (arquivada)` : col.name}
          archived={col.visible === false}
          onToggleArchived={treeActions?.onToggleColumnArchived ? () => treeActions.onToggleColumnArchived!(col.id) : undefined}
          archivedView={treeActions?.onToggleColumnShowArchived && col.visible !== false ? {
            count: treeActions.archivedCountByColumn?.get(col.id) ?? 0,
            on: !!treeActions.showArchivedColumnIds?.has(col.id),
            onClick: () => treeActions.onToggleColumnShowArchived!(col.id),
          } : undefined}
          count={countColumnCards(col.id)}
          bold
          hasContent={hasContent}
          collapsed={collapsed.has(nodeId)}
          coverPath={col.coverPath}
          coverSize={COLUMN_COVER_SIZE}
          isDropOver={isOver}
          onToggle={toggle}
          textColors={colors}
          onAppearanceToggle={treeActions ? () => toggleAppearance(nodeId) : undefined}
          appearanceOpen={panelOpen}
          onRename={treeActions?.onRenameColumn ? (newName) => treeActions.onRenameColumn!(col.id, newName.replace(/ \(arquivada\)$/, '')) : undefined}
          {...(treeActions?.onMoveColumn && col.visible !== false ? (() => {
            const movable = columns.filter((x) => x.visible !== false);
            const i = movable.findIndex((x) => x.id === col.id);
            return {
              onMoveUp: () => treeActions.onMoveColumn!(col.id, -1),
              onMoveDown: () => treeActions.onMoveColumn!(col.id, 1),
              canMoveUp: i > 0,
              canMoveDown: i >= 0 && i < movable.length - 1,
            };
          })() : {})}
          addItems={treeActions ? [
            { label: '＋ Adicionar card', onClick: () => startAdding({ kind: 'card', scope: 'column', id: col.id }) },
            { label: '📁 Adicionar grupo', onClick: () => startAdding({ kind: 'group', scope: 'column', id: col.id }) },
          ] : undefined}
        />
        {panelOpen && treeActions && (
          <ColumnAppearancePanel
            column={col}
            backgroundColor={bgColor}
            opacity={opacity}
            onChangeColor={(color) => treeActions.onUpdateColumnBackground(col.id, color)}
            onChangeOpacity={(value) => treeActions.onUpdateColumnOpacity(col.id, value)}
          />
        )}
        {!collapsed.has(nodeId) && (
          <>
            {topGroups.map((g) => renderGroup(g, 0))}
            <StatusSections kanbanId={statusKanbanId} scopeId={`tree-col:${col.id}`} cards={looseCards} indent={16} renderCard={(c) => renderCard(c, 1, colors)} />
            {addingHere && adding && (
              <AddInlineInput
                depth={1}
                placeholder={adding.kind === 'card' ? 'Título do card...' : 'Nome do grupo...'}
                onSubmit={submitAdding}
                onClose={() => setAdding(null)}
              />
            )}
            {!hasContent && !addingHere && (
              <div
                className={colors ? undefined : 'text-neutral-400 dark:text-neutral-500'}
                style={{ fontSize: 11, padding: '2px 6px', paddingLeft: 6 + INDENT_PX + 14, color: colors?.muted }}
              >
                Coluna vazia
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div
        ref={containerRef}
        className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700"
        style={{ flex: 1, minWidth: 0, borderRadius: 8, padding: 8, minHeight: 400 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 6px 6px' }}>
          <span
            className="text-neutral-500 dark:text-neutral-400"
            title={treeActions ? 'Atalhos (com o mouse sobre o item): C = novo card · G = novo grupo/subgrupo · Q = excluir o card. Ctrl + clique seleciona vários cards; Shift + clique seleciona um intervalo.' : undefined}
            style={{ fontSize: 11, flex: 1 }}
          >
            {columns.length} coluna{columns.length !== 1 ? 's' : ''} · {totalCards} card{totalCards !== 1 ? 's' : ''}
          </span>
          <button onClick={expandAll} className={LINK_CLS} style={{ fontSize: 11 }}>Expandir tudo</button>
          <button onClick={collapseAll} className={LINK_CLS} style={{ fontSize: 11 }}>Recolher tudo</button>
          {treeActions?.onToggleShowArchived && (treeActions.showArchived || (treeActions.archivedCount ?? 0) > 0) && (
            <button onClick={treeActions.onToggleShowArchived} className={LINK_CLS} style={{ fontSize: 11 }} title="Mostrar ou ocultar as colunas arquivadas na árvore">
              {treeActions.showArchived ? '🗄 Ocultar arquivadas' : `🗄 Arquivadas (${treeActions.archivedCount ?? 0})`}
            </button>
          )}
          <GroupByStatusButton kanbanId={statusKanbanId} className={LINK_CLS} style={{ fontSize: 11 }} />
          <label className="text-neutral-500 dark:text-neutral-400" title="Tamanho da capa dos cards" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            Capa
            <select
              value={coverSize}
              onChange={(e) => changeCoverSize(Number(e.target.value))}
              className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600 dark:[color-scheme:dark]"
              style={{ fontSize: 11, padding: '1px 2px', borderRadius: 4 }}
            >
              {COVER_SIZES.map((c) => <option key={c.size} value={c.size}>{c.label}</option>)}
            </select>
          </label>
          <span title="Zoom: Ctrl + roda do mouse" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => applyZoom(zoom - ZOOM_BUTTON_STEP)} className={LINK_CLS} style={{ fontSize: 14, lineHeight: 1 }} aria-label="Diminuir zoom">−</button>
            <button onClick={() => applyZoom(1)} className={LINK_CLS} style={{ fontSize: 11, minWidth: 34 }} title="Voltar a 100%">{Math.round(zoom * 100)}%</button>
            <button onClick={() => applyZoom(zoom + ZOOM_BUTTON_STEP)} className={LINK_CLS} style={{ fontSize: 14, lineHeight: 1 }} aria-label="Aumentar zoom">+</button>
          </span>
        </div>
        {bulk && selectedCardIds && selectedCardIds.size > 0 && (
          <BulkBar
            ids={Array.from(selectedCardIds)}
            allLabels={treeActions?.allLabels ?? cardMenu?.allLabels ?? []}
            bulk={bulk}
            onClear={() => onClearSelection?.()}
          />
        )}
        <div className="border-t border-neutral-200 dark:border-neutral-700" style={{ paddingTop: 6, zoom: zoom === 1 ? undefined : zoom }}>
          {columns.length === 0 && (
            <div className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 12, padding: 8 }}>
              Nenhuma coluna visível.
            </div>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onDragCancel={resetDrag}
          >
            {columns.map((col) => renderColumn(col))}
            {/* O "fantasma" que segue o mouse fica num portal no body: fora do CSS zoom da lista, então acompanha o ponteiro em qualquer zoom */}
            {createPortal(
              <DragOverlay dropAnimation={null}>
                {overlayLabel ? (
                  <div
                    className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-blue-500 dark:border-blue-400"
                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.25)', maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {overlayLabel}
                  </div>
                ) : null}
              </DragOverlay>,
              document.body
            )}
          </DndContext>
        </div>
      </div>
      {shortcutPopup && (() => {
        const loc = cardLocation.get(shortcutPopup.cardId);
        const card = loc?.list.find((c) => c.id === shortcutPopup.cardId);
        if (!loc || !card) return null;
        const inBulk = !!bulk && !!selectedCardIds && selectedCardIds.size > 1 && selectedCardIds.has(card.id);
        const ids = inBulk ? Array.from(selectedCardIds!) : [card.id];
        const close = () => setShortcutPopup(null);
        return createPortal(
          <div onClick={stopBubbling} onDoubleClick={stopBubbling} onPointerDown={stopBubbling} onContextMenu={stopBubbling}>
            {shortcutPopup.kind === 'status' && (
              <StatusPickerMenu
                x={shortcutPopup.x}
                y={shortcutPopup.y}
                value={card.status}
                onSelect={(value) => { if (inBulk) bulk!.onSetStatus(ids, value); else cardMenu?.onUpdateStatus(card.id, value); }}
                onClose={close}
              />
            )}
            {shortcutPopup.kind === 'due' && (
              <DueDateMenu
                x={shortcutPopup.x}
                y={shortcutPopup.y}
                value={card.dueDate}
                onSave={(value) => cardMenu?.onUpdateDueDate(card.id, value)}
                onClose={close}
              />
            )}
            {shortcutPopup.kind === 'color' && (
              <CardColorMenu
                x={shortcutPopup.x}
                y={shortcutPopup.y}
                value={inBulk ? null : card.color}
                onSave={(value) => { if (inBulk) bulk!.onSetColor(ids, value); else cardMenu?.onUpdateColor(card.id, value); }}
                onClose={close}
              />
            )}
            {shortcutPopup.kind === 'labels' && (
              <CardLabelMenu
                x={shortcutPopup.x}
                y={shortcutPopup.y}
                cardLabels={inBulk ? [] : card.labels}
                allLabels={treeActions?.allLabels ?? []}
                onToggle={(name, color, isGroup) => {
                  if (inBulk) { bulk!.onToggleLabel(ids, name, color, isGroup); return; }
                  const hasIt = card.labels.some((l) => parseLabel(l).name === name);
                  cardMenu?.onUpdateLabels(card.id, hasIt ? card.labels.filter((l) => parseLabel(l).name !== name) : [...card.labels, serializeLabel(name, color, isGroup)]);
                }}
                onCreate={(name, color, isGroup) => {
                  if (inBulk) { bulk!.onToggleLabel(ids, name, color, isGroup); return; }
                  if (card.labels.some((l) => parseLabel(l).name === name)) return;
                  cardMenu?.onUpdateLabels(card.id, [...card.labels, serializeLabel(name, color, isGroup)]);
                }}
                onClose={close}
              />
            )}
            {shortcutPopup.kind === 'move' && cardMove && (
              <CardMoveMenu
                x={shortcutPopup.x}
                y={shortcutPopup.y}
                columns={cardMove.columns}
                groups={cardMove.groups}
                currentColumnId={!inBulk && loc.target.kind === 'column' ? loc.target.id : null}
                currentGroupId={!inBulk && loc.target.kind === 'group' ? loc.target.id : null}
                cardCount={ids.length}
                onMove={(target) => { close(); void cardMove.moveCards(ids, target); }}
                onClose={close}
              />
            )}
          </div>,
          document.body
        );
      })()}
      {emojiFor && treeActions && createPortal(
        <EmojiPickerPopup
          x={emojiFor.x}
          y={emojiFor.y}
          hasEmoji={!!groups.find((g) => g.id === emojiFor.groupId)?.emoji}
          onPick={(emoji) => { treeActions.onUpdateGroupAppearance(emojiFor.groupId, { emoji }); setEmojiFor(null); }}
          onRemove={() => { treeActions.onUpdateGroupAppearance(emojiFor.groupId, { emoji: null }); setEmojiFor(null); }}
          onClose={() => setEmojiFor(null)}
        />,
        document.body
      )}
      {sidePanel && (
        <div
          className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700"
          style={{
            width: panelWidth, flexShrink: 0, position: 'sticky', top: 8, alignSelf: 'flex-start',
            height: PANEL_HEIGHT, minHeight: 420, borderRadius: 8, overflow: 'hidden',
          }}
        >
          <div
            onMouseDown={handlePanelResizeMouseDown}
            onDoubleClick={resetPanelWidth}
            title="Arrastar pra redimensionar (duplo clique volta ao tamanho padrão)"
            className="hover:bg-blue-500/30"
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 2 }}
          />
          {sidePanel}
        </div>
      )}
    </div>
  );
}

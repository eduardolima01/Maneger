import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragMoveEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { KanbanCard, KanbanCardGroup, KanbanColumn, ChecklistProgress, UpdateKanbanCardGroupInput, TaskStatus } from '@/types/kanban.types';
import { PRIORITY_COLORS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS } from '@/types/kanban.types';
import CopyTitleButton from './CopyTitleButton';
import CardActionsMenu, { type CardActionsHandlers } from './CardActionsMenu';
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
  /** Painel 🎨 da coluna: cor de fundo (null = padrão) e opacidade do fundo (0 a 1). Mesmas preferências do quadro. */
  onUpdateColumnBackground: (columnId: string, color: string | null) => unknown;
  onUpdateColumnOpacity: (columnId: string, opacity: number) => unknown;
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
  onCardClick: (cardId: string) => void;
  /** Id do card aberto no painel lateral (a linha dele fica destacada na árvore). */
  selectedCardId?: string | null;
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

/* ---------- estado do card (texto pequeno + select pra trocar sem abrir o card) ---------- */

const STATUS_ORDER: TaskStatus[] = ['pendente', 'fazer', 'fazendo', 'revisao', 'feito'];

/**
 * Estado do card como TEXTO pequeno (na cor do estado) que já é um <select>: trocar o estado não exige abrir o card.
 * Sem `onChange` vira só o rótulo. Os eventos não sobem pra linha — senão o clique abriria o card e o arrasto começaria.
 */
function StatusSelect({ status, onChange }: { status: TaskStatus | null; onChange?: (status: TaskStatus | null) => void }) {
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
    <select
      value={status ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : (e.target.value as TaskStatus))}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      title="Mudar o status do card"
      className={color ? 'text-white' : 'text-neutral-400 dark:text-neutral-500 border border-neutral-300 dark:border-neutral-600 bg-transparent'}
      style={{
        ...pillStyle,
        // sem a setinha do select e com a largura do texto atual (e não a da opção mais comprida): fica do tamanho de uma etiqueta
        appearance: 'none', WebkitAppearance: 'none', width: `calc(${label.length}ch + 9px)`, textAlign: 'center', cursor: 'pointer',
        ...(color ? { backgroundColor: color, border: 'none' } : {}),
      }}
    >
      <option value="" style={{ fontSize: 12 }} className="bg-white text-black dark:bg-neutral-800 dark:text-neutral-100">Sem status</option>
      {STATUS_ORDER.map((s) => (
        <option key={s} value={s} style={{ fontSize: 12 }} className="bg-white text-black dark:bg-neutral-800 dark:text-neutral-100">{STATUS_LABELS[s]}</option>
      ))}
    </select>
  );
}

/* ---------- linha de card (arrastável, solta-alvo e com título editável) ---------- */

type DropHint = { overId: string; after: boolean } | null;

interface TreeCardRowProps {
  card: KanbanCard;
  depth: number;
  progress?: ChecklistProgress;
  selected: boolean;
  /** Mostra a barra azul antes/depois da linha enquanto outro card está sendo arrastado por cima dela. */
  hint: 'before' | 'after' | null;
  cardMenu?: CardActionsHandlers;
  canEdit: boolean;
  canDrag: boolean;
  onClick: (cardId: string) => void;
  onRename: (cardId: string, title: string) => void;
  /** Grupo com cor de fundo própria: o texto usa estas cores (as classes de tema só servem pro fundo padrão). */
  groupColors?: GroupTextColors;
  /** Troca o status do card direto na linha. Sem isso, o estado aparece só como rótulo. */
  onUpdateStatus?: (cardId: string, status: TaskStatus | null) => void;
  /** Lado (px) da miniatura da capa do card. */
  coverSize: number;
}

function TreeCardRow({ card, depth, progress, selected, hint, cardMenu, canEdit, canDrag, onClick, onRename, groupColors, onUpdateStatus, coverSize }: TreeCardRowProps) {
  const { icons: labelIcons } = useLabelIcons(); // ícones das etiquetas (os mesmos do quadro)
  // linha selecionada tem fundo azul claro: aí as cores calculadas pro fundo do grupo não valem, usa as do tema
  const colors = selected ? null : groupColors ?? null;
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

  function finishEditing(save: boolean) {
    setEditing(false);
    const title = draft.trim();
    if (save && title && title !== card.title) onRename(card.id, title);
    else setDraft(card.title); // vazio ou sem mudança: reverte
  }

  // barra azul de "vai cair aqui": em cima (antes) ou embaixo (depois) desta linha
  const hintShadow = hint === 'before' ? 'inset 0 2px 0 #1a73e8' : hint === 'after' ? 'inset 0 -2px 0 #1a73e8' : undefined;

  return (
    <div
      ref={(node) => { setDragRef(node); setDropRef(node); }}
      data-tree-card-id={card.id}
      {...attributes}
      {...(canDrag && !editing ? listeners : {})}
      onClick={() => onClick(card.id)}
      title={card.title}
      className={selected
        ? 'group/row bg-blue-50 dark:bg-blue-950'
        : colors ? 'group/row hover:bg-black/10' : 'group/row hover:bg-neutral-100 dark:hover:bg-neutral-700'}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', paddingLeft: 6 + depth * INDENT_PX + 14,
        fontSize: 12, cursor: canDrag ? 'grab' : 'pointer', borderRadius: 4, opacity: isDragging ? 0.4 : 1,
        borderLeft: card.color ? `3px solid ${card.color}` : undefined, boxShadow: hintShadow,
      }}
    >
      <StatusSelect status={card.status} onChange={onUpdateStatus ? (s) => onUpdateStatus(card.id, s) : undefined} />
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

      {!editing && card.labels.length > 0 && (() => {
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
      })()}
      {card.priority && (
        <span title={`Prioridade: ${PRIORITY_LABELS[card.priority]}`} style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, backgroundColor: PRIORITY_COLORS[card.priority] }} />
      )}
      {progress && progress.total > 0 && (
        <span className={colors ? undefined : 'text-neutral-500 dark:text-neutral-400'} title="Checklist" style={{ fontSize: 10, flexShrink: 0, color: colors?.secondary }}>
          ✓ {progress.done}/{progress.total}
        </span>
      )}
      {progress && progress.total === 0 && (progress.simpleCount ?? 0) > 0 && (
        <span className={colors ? undefined : 'text-neutral-500 dark:text-neutral-400'} title="Itens em lista simples (não entram na contagem de tarefas)" style={{ fontSize: 10, flexShrink: 0, color: colors?.secondary }}>
          ☰ {progress.simpleCount}
        </span>
      )}
      {due && (
        <span
          className={colors ? undefined : overdue ? 'text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-neutral-400'}
          title={overdue ? `${due.title} (vencido)` : due.title}
          style={{ fontSize: 10, flexShrink: 0, whiteSpace: 'nowrap', color: colors ? (overdue ? colors.danger : colors.secondary) : undefined }}
        >
          {due.label}
        </span>
      )}
      {cardMenu && <CardActionsMenu card={card} {...cardMenu} />}
    </div>
  );
}

/* ---------- painel 🎨 de aparência do grupo ---------- */

const stopBubbling = (e: React.SyntheticEvent) => e.stopPropagation();

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

/* ---------- cabeçalho de coluna / grupo (solta-alvo + botão ＋) ---------- */

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
}

function TreeHeaderRow({
  nodeId, dropTarget, depth, icon, name, count, bold, hasContent, collapsed, coverPath, coverSize, isDropOver, onToggle, addItems, textColors,
  onEmojiClick, onAppearanceToggle, appearanceOpen, onRename, onDelete,
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
      ref={setNodeRef}
      onClick={() => onToggle(nodeId)}
      title={name}
      className={`group/row ${isDropOver ? 'bg-blue-100 dark:bg-blue-950' : textColors ? 'hover:bg-black/10' : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', paddingLeft: 6 + depth * INDENT_PX,
        fontSize: 12, cursor: 'pointer', borderRadius: 4, boxShadow: isDropOver ? 'inset 0 0 0 2px #1a73e8' : undefined,
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
      {onRename && !editing && (
        <button
          type="button"
          title="Renomear (ou dois cliques no nome)"
          aria-label="Renomear"
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
 * colunas, grupos e subgrupos (pra cima de um card = vira vizinho dele; pra cima de um cabeçalho = vai pro fim).
 * Usa os mesmos cards/grupos já filtrados que o quadro recebe do hook.
 * Capas: coluna, grupo/subgrupo e card mostram miniatura (a da coluna e a do grupo substituem o ícone/emoji, como no quadro).
 */
export default function KanbanTreeView({
  columns, groups, cardsByGroup, ungroupedCardsByColumn, checklistProgress, onCardClick, selectedCardId, cardMenu, treeActions, columnBackgrounds, columnOpacities, sidePanel, stateKey = 'default',
}: KanbanTreeViewProps) {
  const { icons: labelIcons } = useLabelIcons(); // ícones das etiquetas, os mesmos dos chips dos grupos no quadro
  const storageKey = `${STORAGE_PREFIX}${stateKey}`;
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

  /* ----- painel 🎨 de aparência e seletor de emoji dos grupos ----- */

  const coverSizeKey = `${COVER_SIZE_PREFIX}${stateKey}`;
  const [coverSize, setCoverSize] = useState<number>(() => readCoverSize(coverSizeKey));
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

  function resetDrag() {
    setActiveCardId(null);
    setDropHint(null);
    setOverHeaderId(null);
  }

  /** O card arrastado está na metade de baixo da linha em que está por cima? (decide antes/depois dela) */
  function isBelowCenter(event: DragMoveEvent | DragEndEvent): boolean {
    const translated = event.active.rect.current.translated;
    const overRect = event.over?.rect;
    if (!translated || !overRect) return false;
    return translated.top + translated.height / 2 > overRect.top + overRect.height / 2;
  }

  function handleDragStart({ active }: DragStartEvent) {
    const cardId = active.data.current?.cardId as string | undefined;
    setActiveCardId(cardId ?? null);
  }

  function handleDragMove(event: DragMoveEvent) {
    const { over } = event;
    const overData = over?.data.current as { type?: string; cardId?: string } | undefined;
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
    const movedId = activeCardId;
    resetDrag();
    if (!over || !movedId || !treeActions) return;
    const overData = over.data.current as { type?: string; cardId?: string; target?: TreeMoveTarget | null } | undefined;
    if (!overData) return;

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
    el.addEventListener('mouseover', onOver);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mouseover', onOver);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  // O tratador é recriado a cada render (enxerga o estado de agora) e o ouvinte do documento só chama a versão atual.
  const shortcutRef = useRef<(e: KeyboardEvent) => void>(() => { });
  shortcutRef.current = (e: KeyboardEvent) => {
    if (!treeActions || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return; // nunca intercepta Ctrl+C etc.
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return; // digitando
    const hover = hoverRef.current;
    const key = e.key.toLowerCase();

    if (key === 'q') {
      // Q = excluir o card sob o mouse (pede confirmação, como no quadro)
      if (!hover.cardId || !cardMenu) return;
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
        selected={card.id === selectedCardId}
        hint={hint}
        cardMenu={cardMenu}
        canEdit={!!treeActions}
        canDrag={!!treeActions}
        onClick={onCardClick}
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
          <>
            {groupCards.map((c) => renderCard(c, 1, colors))}
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
          </>
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
          dropTarget={treeActions ? { kind: 'column', id: col.id } : null}
          depth={0}
          icon={col.icon ?? '🗂'}
          name={col.name}
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
            {looseCards.map((c) => renderCard(c, 1, colors))}
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
            title={treeActions ? 'Atalhos (com o mouse sobre o item): C = novo card · G = novo grupo/subgrupo · Q = excluir o card' : undefined}
            style={{ fontSize: 11, flex: 1 }}
          >
            {columns.length} coluna{columns.length !== 1 ? 's' : ''} · {totalCards} card{totalCards !== 1 ? 's' : ''}
          </span>
          <button onClick={expandAll} className={LINK_CLS} style={{ fontSize: 11 }}>Expandir tudo</button>
          <button onClick={collapseAll} className={LINK_CLS} style={{ fontSize: 11 }}>Recolher tudo</button>
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
                {activeCard ? (
                  <div
                    className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-blue-500 dark:border-blue-400"
                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.25)', maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {activeCard.title}
                  </div>
                ) : null}
              </DragOverlay>,
              document.body
            )}
          </DndContext>
        </div>
      </div>
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

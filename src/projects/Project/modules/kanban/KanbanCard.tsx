import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { convertFileSrc } from '@tauri-apps/api/core';
import { PRIORITY_LABELS, PRIORITY_COLORS, STATUS_LABELS, STATUS_COLORS } from '@/types/kanban.types';
import type { KanbanCard as CardType, ChecklistProgress, KanbanDensity, TaskStatus, CardVisualFieldConfig, CardVisualFieldKey } from '@/types/kanban.types';
import ContextMenu from '@/components/ui/ContextMenu';
import CardLabelMenu from './CardLabelMenu';
import { useEffect, useRef, useState } from 'react';
import { ParsedLabel, parseLabel, serializeLabel } from '@/Kanban/utils/kanbanLabels';
import DueDateMenu from '@/Kanban/components/DueDateMenu';
import CardColorMenu from '@/Kanban/components/CardColorMenu';
import CardStatusMenu from '@/Kanban/components/CardStatusMenu';
import CardMoveMenu from '@/Kanban/components/CardMoveMenu';
import DuplicateMenu, { DuplicateMultipleMode } from '@/Kanban/components/DuplicateMenu';
import { extensionFromMime } from '@/Canvas/hooks/useCanvasClipboard';
import ImagePasteConfirmModal from '@/components/ui/ImagePasteConfirmModal';
import Toast from '@/components/ui/Toast';
import { saveCardImageBytes } from '@/Kanban/api/kanbanCardAssets';
import CoverZoomModal from '@/components/layout/CoverZoomModal';
import CardTimerPopup from '@/Kanban/Timer/CardTimerPopup';
import { useGlobalCardTimer } from '@/Kanban/Timer/store/cardTimerStore';
import { getCardTimerSessions } from '@/Kanban/Timer/cardTimer';
import InlineChecklist from '@/Kanban/components/Inlinechecklist';
import { getCardFilesDir } from '@/Kanban/api/kanbanCardAssets';
import { openPath } from '@tauri-apps/plugin-opener';
import CardFilesSection from '@/Kanban/components/Cardfilessection';
import { useCardMove } from '@/lib/utils/CardMoveContext';
import { useLabelIcons } from '@/Kanban/hooks/Labeliconcontext';
import LabelIconBadge from '@/Kanban/components/LabelIconBadge';
import CopyTitleButton from '@/Kanban/components/CopyTitleButton';
import { getRelativeDue } from '@/Kanban/utils/relativeDate';

interface KanbanCardProps {
  card: CardType;
  density: KanbanDensity;
  visualConfig: CardVisualFieldConfig[];
  hasSubKanban: boolean;
  hasFiles: boolean;
  checklistProgress?: ChecklistProgress;
  allLabels: ParsedLabel[];
  onClick: () => void;
  onDuplicate: () => void;
  onRequestDelete: () => void;
  onUpdateLabels: (cardId: string, labels: string[]) => void;
  onUpdateCardDueDate: (cardId: string, dueDate: string | null) => void;
  onUpdateStartDate: (cardId: string, startDate: string | null) => void;
  onUpdateDescription: (cardId: string, description: string | null) => void;
  onUpdateTitle: (cardId: string, title: string) => void;
  onUpdateColor: (cardId: string, color: string | null) => void;
  onUpdateStatus: (cardId: string, status: TaskStatus | null) => void;
  onDuplicateMultiple: (cardId: string, mode: DuplicateMultipleMode) => void;
  onUpdateCoverPath: (cardId: string, path: string) => void;
  projectId: string;

  selectedCardIds: Set<string>;
  onCardSelectToggle: (cardId: string) => void;
  onBulkDelete: (cardIds: string[]) => void;
  onBulkSetColor: (cardIds: string[], color: string | null) => void;
  onBulkSetStatus: (cardIds: string[], status: TaskStatus | null) => void;
  onBulkToggleLabel: (cardIds: string[], name: string, color: string, isGroup: boolean) => void;
}

function getDueDateInfo(dueDate: string): { label: string; color: string; title: string } {
  // Texto ("hoje", "falta 1 dia", "faltam 3 dias", "há 2 dias") vem do utilitário compartilhado (também usado na árvore e no modal).
  const { label, diffDays, title } = getRelativeDue(dueDate);
  // vencido, hoje ou nos próximos 3 dias = laranja de urgência; o resto = neutro
  return { label, title, color: diffDays <= 3 ? '#e65100' : '#666' };
}

export default function KanbanCard({
  card, density, visualConfig, hasSubKanban, hasFiles, onClick, onDuplicate, onRequestDelete, checklistProgress,
  allLabels,
  onUpdateLabels,
  onUpdateCardDueDate,
  onUpdateStartDate,
  onUpdateDescription,
  onUpdateTitle,
  onUpdateColor,
  onUpdateStatus,
  selectedCardIds,
  onCardSelectToggle,
  onBulkDelete,
  onBulkSetColor,
  onBulkSetStatus,
  onBulkToggleLabel,
  onDuplicateMultiple,
  onUpdateCoverPath,
  projectId
}: KanbanCardProps) {

  const globalTimer = useGlobalCardTimer();
  const hasOpenTimer = globalTimer.activeCardId === card.id;
  const [savedTimerSeconds, setSavedTimerSeconds] = useState(0);

  useEffect(() => {
    getCardTimerSessions(projectId, card.id).then((sessions) => {
      setSavedTimerSeconds(sessions.reduce((sum, s) => sum + s.durationSeconds, 0));
    });
  }, [projectId, card.id, globalTimer.running]); // recarrega quando este (ou qualquer) timer pausa/finaliza — sessão nova pode ter sido salva

  const displayedTimerSeconds = savedTimerSeconds + (hasOpenTimer ? globalTimer.elapsedSeconds : 0);

  function formatCardTimerTotal(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
  }

  const selected = selectedCardIds.has(card.id);
  const isBulkTarget = selected && selectedCardIds.size > 1;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card:${card.id}`,
    data: { type: 'card' },
  });

  const compact = density === 'compact';

  function isVisualVisible(key: CardVisualFieldKey): boolean {
    return visualConfig.find((c) => c.key === key)?.visible ?? true;
  }

  async function handleOpenFilesFolder(e: React.MouseEvent) {
    e.stopPropagation();
    const dir = await getCardFilesDir(card.id);
    await openPath(dir);
  }

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [labelMenu, setLabelMenu] = useState<{ x: number; y: number } | null>(null);
  const [hovering, setHovering] = useState(false);
  const [dueDateMenu, setDueDateMenu] = useState<{ x: number; y: number } | null>(null);
  const [colorMenu, setColorMenu] = useState<{ x: number; y: number } | null>(null);
  const [statusMenu, setStatusMenu] = useState<{ x: number; y: number } | null>(null);
  const [moveMenu, setMoveMenu] = useState<{ x: number; y: number } | null>(null);
  const cardMove = useCardMove(); // null fora do KanbanBoard — o item de menu fica desabilitado
  const { icons: labelIcons } = useLabelIcons();

  const [duplicateMenu, setDuplicateMenu] = useState<{ x: number; y: number } | null>(null);
  const [pasteConfirm, setPasteConfirm] = useState<{ blob: Blob; ext: string; previewUrl: string } | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [coverZoomOpen, setCoverZoomOpen] = useState(false);
  const [timerMenu, setTimerMenu] = useState<{ x: number; y: number } | null>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(card.title);
  const [titleHover, setTitleHover] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [liveChecklistProgress, setLiveChecklistProgress] = useState<ChecklistProgress | null>(null);
  const displayedChecklistProgress = liveChecklistProgress ?? checklistProgress;

  const cornerHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const CORNER_HOVER_DELAY = 300; // levemente maior que o dos itens — é fácil passar o mouse ali sem querer

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const CLOSE_DELAY = 500;
  const ctrlOnlyRef = useRef(true); // reseta a cada novo "hold" de Control
  const ctrlUsedForClickRef = useRef(false); // marca se o Ctrl já foi "gasto" num clique (seleção múltipla ou descrição) antes de soltar

  function saveTitle() {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== card.title) onUpdateTitle(card.id, trimmed);
    else setTitleDraft(card.title); // reverte se veio vazio ou sem mudança
  }

  function scheduleClose() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setMoveMenu(null);
      setContextMenu(null);
      setLabelMenu(null);
      setDueDateMenu(null);
      setColorMenu(null);
      setStatusMenu(null);
      setTimerMenu(null);
      setDuplicateMenu(null);
    }, CLOSE_DELAY);
  }

  function openTimerMenu(pos: { x: number; y: number }) {
    setMoveMenu(null);
    setLabelMenu(null);
    setDueDateMenu(null);
    setColorMenu(null);
    setStatusMenu(null);
    setDuplicateMenu(null);
    setTimerMenu(null);
    setTimerMenu(pos);
  }
  function cancelClose() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }

  function daysAgoLabel(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - dateOnly.getTime()) / 86400000);
    if (diffDays <= 0) return 'hoje';
    return `${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
  }

  useEffect(() => {
    if (!hovering) return;
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typingInField = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.key === 'q' || e.key === 'Q') && !typingInField && !contextMenu && !labelMenu) {
        e.preventDefault();
        onRequestDelete();
        return;
      }

      if (e.key === 'Control') { ctrlOnlyRef.current = true; ctrlUsedForClickRef.current = false; return; }
      if (e.ctrlKey) ctrlOnlyRef.current = false; // combo (Ctrl+C, Ctrl+V...) cancela o toque puro
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key !== 'Control' || !ctrlOnlyRef.current || ctrlUsedForClickRef.current) return;
      // não abre por cima de nenhum popup já aberto, nem enquanto o título está sendo editado
      if (contextMenu || labelMenu || dueDateMenu || colorMenu || statusMenu || moveMenu || duplicateMenu || timerMenu || pasteConfirm || editingTitle) return;
      onClick();
    }
    function handlePaste(e: ClipboardEvent) {
      if (contextMenu || labelMenu || dueDateMenu || colorMenu || statusMenu || moveMenu || duplicateMenu || pasteConfirm) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return; // colando dentro de um campo de texto (título, descrição, datas) — deixa o paste nativo acontecer, não é "colar capa"
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageItem = Array.from(items).find((i) => i.type.startsWith('image/'));
      if (imageItem) {
        e.preventDefault();
        const blob = imageItem.getAsFile();
        if (!blob) return;
        const previewUrl = URL.createObjectURL(blob);
        setPasteConfirm({ blob, ext: extensionFromMime(imageItem.type), previewUrl });
        return;
      }
      // colou algo, mas não é imagem (texto, arquivo não-imagem, etc.) — e não foi num campo de texto, então é paste "solto" em cima do card
      if (items.length > 0) {
        e.preventDefault();
        setPasteError('Isso não é uma imagem.');
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('paste', handlePaste);
      if (cornerHoverTimer.current) clearTimeout(cornerHoverTimer.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [hovering, contextMenu, labelMenu, dueDateMenu, colorMenu, statusMenu, moveMenu, duplicateMenu, timerMenu, pasteConfirm, editingTitle, onRequestDelete, onClick]);

  async function confirmPasteImage() {
    if (!pasteConfirm) return;
    const { blob, ext, previewUrl } = pasteConfirm;
    setPasteConfirm(null);
    URL.revokeObjectURL(previewUrl);
    const buf = await blob.arrayBuffer();
    const path = await saveCardImageBytes(new Uint8Array(buf), ext);
    onUpdateCoverPath(card.id, path);
  }

  function cancelPasteImage() {
    if (pasteConfirm) URL.revokeObjectURL(pasteConfirm.previewUrl);
    setPasteConfirm(null);
  }
  function openLabelMenu(pos: { x: number; y: number }) {
    setMoveMenu(null);
    setDueDateMenu(null);
    setColorMenu(null);
    setStatusMenu(null);
    setLabelMenu(pos);

  }

  function openDueDateMenu(pos: { x: number; y: number }) {
    setMoveMenu(null);
    setLabelMenu(null);
    setColorMenu(null);
    setStatusMenu(null);
    setDueDateMenu(pos);
  }
  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  function openColorMenu(pos: { x: number; y: number }) {
    setMoveMenu(null);
    setLabelMenu(null);
    setDueDateMenu(null);
    setStatusMenu(null);
    setColorMenu(pos);
  }

  function openStatusMenu(pos: { x: number; y: number }) {
    setMoveMenu(null);
    setLabelMenu(null);
    setDueDateMenu(null);
    setColorMenu(null);
    setStatusMenu(pos);
  }


  function openMoveMenu(pos: { x: number; y: number }) {
    if (!cardMove) return;
    setLabelMenu(null);
    setDueDateMenu(null);
    setColorMenu(null);
    setStatusMenu(null);
    setDuplicateMenu(null);
    setTimerMenu(null);
    setMoveMenu(pos);
  }

  function openDuplicateMenu(pos: { x: number; y: number }) {
    setMoveMenu(null);
    setLabelMenu(null);
    setDueDateMenu(null);
    setColorMenu(null);
    setStatusMenu(null);
    setDuplicateMenu(pos);
  }
  function handleToggleLabel(name: string, color: string, isGroup: boolean) {
    const hasIt = card.labels.some((l) => parseLabel(l).name === name);
    const nextLabels = hasIt
      ? card.labels.filter((l) => parseLabel(l).name !== name)
      : [...card.labels, serializeLabel(name, color, isGroup)];
    applyLabelsChange(nextLabels);
  }

  function handleCreateLabel(name: string, color: string, isGroup: boolean) {
    if (card.labels.some((l) => parseLabel(l).name === name)) return;
    applyLabelsChange([...card.labels, serializeLabel(name, color, isGroup)]);
  }

  function applyLabelsChange(nextLabels: string[]) {
    onUpdateLabels(card.id, nextLabels);
    // cor automática só preenche se o card ainda não tem cor manual escolhida — nunca substitui uma já definida
    if (!card.color && nextLabels.length > 0) {
      onUpdateColor(card.id, parseLabel(nextLabels[0]).color);
    }
  }

  function handleReorderLabels(nextLabels: string[]) {
    onUpdateLabels(card.id, nextLabels);
    // reordenar é ação explícita de "essa etiqueta vai pra frente" — sempre atualiza a cor, mesmo que já houvesse uma definida
    if (nextLabels.length > 0) {
      onUpdateColor(card.id, parseLabel(nextLabels[0]).color);
    }
  }

  return (
    <>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        data-kanban-card={card.id}
        className={`bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 ${card.color ? '' : 'border-neutral-200 dark:border-neutral-700'}`}
        onClickCapture={(e) => { if (e.ctrlKey || e.metaKey) ctrlUsedForClickRef.current = true; }}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey) { e.stopPropagation(); onCardSelectToggle(card.id); return; }
          onClick();
        }}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => { setHovering(true); cancelClose(); }}
        onMouseLeave={() => { setHovering(false); scheduleClose(); }}
        style={{
          position: 'relative',
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.4 : 1,
          borderWidth: 1, borderStyle: 'solid', borderColor: card.color ?? undefined,
          borderLeft: card.labels.length > 0 ? `4px solid ${parseLabel(card.labels[0]).color}` : (card.color ? `4px solid ${card.color}` : undefined),
          outline: selected ? '2px solid #1a73e8' : 'none',
          outlineOffset: selected ? -2 : 0,
          borderRadius: 6,
          padding: compact ? 6 : 10,
          marginBottom: 8,
          cursor: 'grab',
        }}
      >
        {isVisualVisible('notes') && card.notes && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: 2, right: 22, maxWidth: 'calc(100% - 30px)', width: 'fit-content',
              backgroundColor: card.notesColor ?? '#fff9c4', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 3,
              padding: '2px 5px', fontSize: 10, color: '#4a3f00', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              zIndex: 1,
            }}
          >
            {card.notes}
          </div>
        )}

        <div
          onMouseEnter={(e) => {
            cancelClose();
            const rect = e.currentTarget.getBoundingClientRect();
            cornerHoverTimer.current = setTimeout(() => {
              setContextMenu({ x: rect.right, y: rect.top });
            }, CORNER_HOVER_DELAY);
          }}
          onMouseLeave={() => {
            if (cornerHoverTimer.current) clearTimeout(cornerHoverTimer.current);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: 0, right: 0, width: 20, height: 20,
            cursor: 'pointer', zIndex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {hovering && <span className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 11 }}>⋮</span>}
        </div>

        {!compact && isVisualVisible('cover') && card.coverPath
          // && (card.labels.length > 0 || card.dueDate || displayedTimerSeconds > 0) 
          && (
            <div
              onClick={(e) => { e.stopPropagation(); setCoverZoomOpen(true); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="bg-neutral-100 dark:bg-neutral-700"
              style={{
                width: '100%', height: 80, borderRadius: 4, marginBottom: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', cursor: 'zoom-in',
              }}
            >
              <img
                src={convertFileSrc(card.coverPath)}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            </div>
          )}

        <div
          className="w-fit"
          style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: compact ? 0 : 4 }}
        >
          {editingTitle ? (
            <textarea
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') { setTitleDraft(card.title); setEditingTitle(false); }
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              style={{
                fontSize: compact ? 12 : 13, fontWeight: 500, flex: 1,
                border: 'none', outline: '1px solid #1a73e8', borderRadius: 3, padding: '0 2px',
                fontFamily: 'inherit',
              }}
            />
          ) : (
            // título + botão de copiar: o botão só aparece com o mouse sobre este bloco (group/title)
            <span className="group/title" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: 1 }}>
              <span
                onClick={(e) => { e.stopPropagation(); setTitleDraft(card.title); setEditingTitle(true); }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseEnter={() => setTitleHover(true)}
                onMouseLeave={() => setTitleHover(false)}
                className="w-fit text-neutral-900 dark:text-neutral-100"
                style={{
                  fontSize: compact ? 12 : 13, fontWeight: 500, flex: 1,
                  textDecoration: titleHover ? 'underline' : 'none',
                  cursor: 'text',
                }}
              >
                {card.title}
              </span>
              <CopyTitleButton text={card.title} size={compact ? 11 : 12} />
            </span>
          )}
          {isVisualVisible('subKanbanBadge') && hasSubKanban && (
            <span title="Tem sub-kanban" style={{ fontSize: 11 }}>📋</span>
          )}
          {isVisualVisible('filesButton') && hasFiles && (
            <span
              onClick={handleOpenFilesFolder}
              onPointerDown={(e) => e.stopPropagation()}
              title="Abrir pasta de arquivos"
              style={{ fontSize: 11, cursor: 'pointer' }}
            >
              📂
            </span>
          )}
          {isVisualVisible('planBadge') && card.isPlanTemplate && (
            <span
              title={card.planActive ? 'Plano ativo' : 'Plano inativo'}
              className={card.planActive
                ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400'}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '1px 5px',
                borderRadius: 3,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                flexShrink: 0,
              }}
            >
              🔁 {card.planActive ? 'Ativo' : 'Inativo'}
            </span>
          )}
          {isVisualVisible('timer') && hasOpenTimer && (
            <span
              title={globalTimer.running ? 'Cronômetro rodando' : 'Cronômetro pausado, sessão em aberto'}
              className={globalTimer.running ? 'text-green-700 dark:text-green-400' : 'text-orange-700 dark:text-orange-400'}
              style={{ fontSize: 11 }}
            >
              {globalTimer.running ? '⏱' : '⏸'}
            </span>
          )}
          {isVisualVisible('priority') && card.priority && (
            <span
              title={PRIORITY_LABELS[card.priority]}
              style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: PRIORITY_COLORS[card.priority], flexShrink: 0 }}
            />
          )}
        </div>

        {!compact && isVisualVisible('description') && card.description && (
          <p className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {card.description}
          </p>
        )}

        {!compact && (
          (isVisualVisible('labels') && card.labels.length > 0) ||
          (isVisualVisible('dueDate') && card.dueDate) ||
          (isVisualVisible('status') && card.status) ||
          (isVisualVisible('schedules') && (card.schedules ?? []).length > 0) ||
          (isVisualVisible('timer') && displayedTimerSeconds > 0)
        ) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, fontSize: 10, alignItems: 'center' }}>
              {isVisualVisible('status') && card.status && (
                <span className="text-neutral-500 dark:text-neutral-400" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 500 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: STATUS_COLORS[card.status], flexShrink: 0 }} />
                  {STATUS_LABELS[card.status]}
                </span>
              )}
              {isVisualVisible('labels') && card.labels.map((raw) => {
                const { name, color } = parseLabel(raw);
                return (
                  <span key={raw} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, backgroundColor: color, color: '#fff', borderRadius: 3, padding: '1px 5px' }}>
                    <LabelIconBadge icon={labelIcons[name]} size={11} />
                    {name}
                  </span>
                );
              })}

              {isVisualVisible('dueDate') && card.dueDate && (() => {
                const info = getDueDateInfo(card.dueDate);
                const neutral = info.color === '#666'; // "sem urgência" — cor neutra do tema; as urgentes (laranja) ficam fixas
                return (
                  <span
                    title={info.title}
                    className={neutral ? 'text-neutral-500 dark:text-neutral-400' : 'dark:brightness-125'}
                    style={{ color: neutral ? undefined : info.color, fontWeight: neutral ? 400 : 600 }}
                  >
                    📅 {info.label}
                  </span>
                );
              })()}

              {isVisualVisible('schedules') && (card.schedules ?? []).length > 0 && (
                <span
                  title={card.schedules.map((s) => (s.title ? `${s.time} ${s.title}` : s.time)).join('\n')}
                  className="text-neutral-500 dark:text-neutral-400"
                >
                  🕐 {card.schedules.map((s) => s.time).join(', ')}
                </span>
              )}

              {isVisualVisible('timer') && displayedTimerSeconds > 0 && (
                <span className={hasOpenTimer && globalTimer.running ? 'text-green-700 dark:text-green-400' : 'text-neutral-500 dark:text-neutral-400'}>
                  ⏱ {formatCardTimerTotal(displayedTimerSeconds)}
                </span>
              )}
            </div>
          )}

        {!compact && isVisualVisible('checklist') && (checklistOpen || (displayedChecklistProgress && (displayedChecklistProgress.total > 0 || (displayedChecklistProgress.simpleCount ?? 0) > 0))) && (
          <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <button
              onClick={() => setChecklistOpen((v) => {
                const next = !v;
                if (!next) setLiveChecklistProgress(null); // ao fechar, volta a confiar no prop (mais fresco na próxima recarga do board)
                return next;
              })}
              className={displayedChecklistProgress && displayedChecklistProgress.total > 0
                ? (displayedChecklistProgress.done === displayedChecklistProgress.total
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-neutral-500 dark:text-neutral-400')
                : 'text-neutral-400 dark:text-neutral-500'}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, marginTop: 4,
                background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
              }}
            >
              <span>{checklistOpen ? '▾' : '▸'}</span>
              <span>
                {displayedChecklistProgress && displayedChecklistProgress.total > 0
                  ? `☑ ${displayedChecklistProgress.done}/${displayedChecklistProgress.total}`
                  : (displayedChecklistProgress?.simpleCount ?? 0) > 0
                    // só tem itens de lista simples: não há "feito/total" (eles não contam), mostra quantos itens existem
                    ? `☰ ${displayedChecklistProgress!.simpleCount} item${displayedChecklistProgress!.simpleCount !== 1 ? 's' : ''}`
                    : '☑ Checklist'}
              </span>
            </button>
            {checklistOpen && <InlineChecklist cardId={card.id} onProgressChange={setLiveChecklistProgress} />}
          </div>
        )}

        {!compact && isVisualVisible('expandToggle') && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-neutral-400 dark:text-neutral-500"
            style={{
              width: '100%', textAlign: 'center', fontSize: 10,
              border: 'none', background: 'none', cursor: 'pointer', padding: '4px 0 0', marginTop: 4,
            }}
          >
            {expanded ? '▴ Menos detalhes' : '▾ Mais detalhes'}
          </button>
        )}

        {expanded && (
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="border-t border-dashed border-neutral-300 dark:border-neutral-600"
            style={{ marginTop: 8, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div>
              <label className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 10, fontWeight: 600, display: 'block', marginBottom: 2 }}>Descrição</label>
              <textarea
                defaultValue={card.description ?? ''}
                onBlur={(e) => {
                  const trimmed = e.target.value.trim();
                  if (trimmed !== (card.description ?? '')) onUpdateDescription(card.id, trimmed || null);
                }}
                rows={3}
                placeholder="Sem descrição..."
                className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600"
                style={{ width: '100%', fontSize: 11, padding: 4, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 10, fontWeight: 600, display: 'block', marginBottom: 2 }}>Início</label>
                <input
                  type="date"
                  value={card.startDate ?? ''}
                  onChange={(e) => onUpdateStartDate(card.id, e.target.value || null)}
                  className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600 dark:[color-scheme:dark]"
                  style={{ width: '100%', fontSize: 11, padding: 4, boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 10, fontWeight: 600, display: 'block', marginBottom: 2 }}>Prazo</label>
                <input
                  type="date"
                  value={card.dueDate ?? ''}
                  onChange={(e) => onUpdateCardDueDate(card.id, e.target.value || null)}
                  className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600 dark:[color-scheme:dark]"
                  style={{ width: '100%', fontSize: 11, padding: 4, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 10, fontWeight: 600, display: 'block', marginBottom: 2 }}>Checklist</label>
              <InlineChecklist cardId={card.id} onProgressChange={setLiveChecklistProgress} />
            </div>

            <CardFilesSection cardId={card.id} onSetCover={(path) => onUpdateCoverPath(card.id, path)} />
          </div>
        )}

        {isVisualVisible('timer') && displayedTimerSeconds > 0 && (
          <span
            title={hasOpenTimer && globalTimer.running ? 'Cronômetro rodando' : 'Tempo total registrado'}
            className={`bg-white/85 dark:bg-neutral-900/85 ${hasOpenTimer && globalTimer.running ? 'text-green-700 dark:text-green-400' : 'text-neutral-400 dark:text-neutral-500'}`}
            style={{
              position: 'absolute', bottom: 4, right: 4, fontSize: 10,
              padding: '1px 4px', borderRadius: 3,
            }}
          >
            ⏱ {formatCardTimerTotal(displayedTimerSeconds)}
          </span>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onMouseEnter={cancelClose} onMouseLeave={scheduleClose}
          items={
            isBulkTarget
              ? [
                { label: `${selectedCardIds.size} cards selecionados`, onClick: () => { }, disabled: true },
                {
                  label: '🎨 Cor (todos)',
                  onClick: () => openColorMenu({ x: contextMenu.x, y: contextMenu.y }),
                  onHoverStart: (rect) => openColorMenu({ x: rect.right + 4, y: rect.top }),
                },
                {
                  label: '📊 Status (todos)',
                  onClick: () => openStatusMenu({ x: contextMenu.x, y: contextMenu.y }),
                  onHoverStart: (rect) => openStatusMenu({ x: rect.right + 4, y: rect.top }),
                },
                {
                  label: '📦 Mover (todos)',
                  disabled: !cardMove,
                  onClick: () => openMoveMenu({ x: contextMenu.x, y: contextMenu.y }),
                  onHoverStart: (rect) => openMoveMenu({ x: rect.right + 4, y: rect.top }),
                },
                {
                  label: '🏷 Etiquetas (todos)',
                  onClick: () => openLabelMenu({ x: contextMenu.x, y: contextMenu.y }),
                  onHoverStart: (rect) => openLabelMenu({ x: rect.right + 4, y: rect.top }),
                },
                { label: '🗑 Excluir todos', onClick: () => onBulkDelete(Array.from(selectedCardIds)), danger: true },
              ]
              : [
                { label: `🕒 Criado há ${daysAgoLabel(card.createdAt)}`, onClick: () => { }, disabled: true },
                { label: `✏️ Atualizado há ${daysAgoLabel(card.updatedAt)}`, onClick: () => { }, disabled: true },
                {
                  label: card.dueDate ? `📅 ${getDueDateInfo(card.dueDate).label}` : '📅 Definir data do card',
                  onClick: () => openDueDateMenu({ x: contextMenu.x, y: contextMenu.y }),
                  onHoverStart: (rect) => openDueDateMenu({ x: rect.right + 4, y: rect.top }),
                },
                {
                  label: '🏷 Etiquetas',
                  onClick: () => openLabelMenu({ x: contextMenu.x, y: contextMenu.y }),
                  onHoverStart: (rect) => openLabelMenu({ x: rect.right + 4, y: rect.top }),
                },
                {
                  label: '🎨 Cor',
                  onClick: () => openColorMenu({ x: contextMenu.x, y: contextMenu.y }),
                  onHoverStart: (rect) => openColorMenu({ x: rect.right + 4, y: rect.top }),
                },
                {
                  label: card.status ? `📊 ${STATUS_LABELS[card.status]}` : '📊 Definir status',
                  onClick: () => openStatusMenu({ x: contextMenu.x, y: contextMenu.y }),
                  onHoverStart: (rect) => openStatusMenu({ x: rect.right + 4, y: rect.top }),
                },
                {
                  label: '📦 Mover para…',
                  disabled: !cardMove,
                  onClick: () => openMoveMenu({ x: contextMenu.x, y: contextMenu.y }),
                  onHoverStart: (rect) => openMoveMenu({ x: rect.right + 4, y: rect.top }),
                },
                {
                  label: '⧉ Duplicar',
                  onClick: onDuplicate,
                  onHoverStart: (rect) => openDuplicateMenu({ x: rect.right + 4, y: rect.top }),
                },
                { label: '⏱ Cronômetro', onClick: () => openTimerMenu({ x: contextMenu.x, y: contextMenu.y }) },
                { label: '🗑 Excluir', onClick: onRequestDelete, danger: true },
              ]
          }
        />
      )}

      {labelMenu && (
        <CardLabelMenu
          x={labelMenu.x}
          y={labelMenu.y}
          cardLabels={card.labels}
          allLabels={allLabels}
          onToggle={(name, color, isGroup) => isBulkTarget ? onBulkToggleLabel(Array.from(selectedCardIds), name, color, isGroup) : handleToggleLabel(name, color, isGroup)}
          onCreate={(name, color, isGroup) => isBulkTarget ? onBulkToggleLabel(Array.from(selectedCardIds), name, color, isGroup) : handleCreateLabel(name, color, isGroup)}
          onClose={() => setLabelMenu(null)}
          onMouseEnter={cancelClose} onMouseLeave={scheduleClose}
          onReorder={isBulkTarget ? undefined : handleReorderLabels}
        />
      )}

      {dueDateMenu && (
        <DueDateMenu
          x={dueDateMenu.x}
          y={dueDateMenu.y}
          value={card.dueDate}
          onSave={(value) => {
            if (isBulkTarget) Array.from(selectedCardIds).forEach((id) => onUpdateCardDueDate(id, value));
            else onUpdateCardDueDate(card.id, value);
          }}
          onClose={() => setDueDateMenu(null)}
          onMouseEnter={cancelClose} onMouseLeave={scheduleClose}
        />
      )}

      {colorMenu && (
        <CardColorMenu
          x={colorMenu.x}
          y={colorMenu.y}
          value={card.color}
          onSave={(value) => onUpdateColor(card.id, value)}
          onClose={() => setColorMenu(null)}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}

      {statusMenu && (
        <CardStatusMenu
          x={statusMenu.x}
          y={statusMenu.y}
          value={card.status}
          onSave={(value) => isBulkTarget
            ? onBulkSetStatus(Array.from(selectedCardIds), value)
            : onUpdateStatus(card.id, value)}
          onClose={() => setStatusMenu(null)}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}

      {moveMenu && cardMove && (
        <CardMoveMenu
          x={moveMenu.x}
          y={moveMenu.y}
          columns={cardMove.columns}
          groups={cardMove.groups}
          currentColumnId={isBulkTarget || card.cardGroupId ? null : card.columnId}
          currentGroupId={isBulkTarget ? null : card.cardGroupId}
          cardCount={isBulkTarget ? selectedCardIds.size : 1}
          onMove={(target) => {
            const ids = isBulkTarget ? Array.from(selectedCardIds) : [card.id];
            setMoveMenu(null);
            setContextMenu(null);
            void cardMove.moveCards(ids, target);
          }}
          onClose={() => setMoveMenu(null)}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}

      {duplicateMenu && (
        <DuplicateMenu
          x={duplicateMenu.x}
          y={duplicateMenu.y}
          onDuplicateOnce={onDuplicate}
          onDuplicateMultiple={(mode) => onDuplicateMultiple(card.id, mode)}
          onClose={() => setDuplicateMenu(null)}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}

      {timerMenu && (
        <CardTimerPopup
          x={timerMenu.x}
          y={timerMenu.y}
          projectId={projectId}
          cardId={card.id}
          cardTitle={card.title}
          onClose={() => setTimerMenu(null)}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}

      {pasteConfirm && (
        <ImagePasteConfirmModal
          previewUrl={pasteConfirm.previewUrl}
          onConfirm={confirmPasteImage}
          onCancel={cancelPasteImage}
        />
      )}

      {pasteError && (
        <Toast message={pasteError} variant="error" onDismiss={() => setPasteError(null)} />
      )}

      {coverZoomOpen && card.coverPath && (
        <CoverZoomModal src={convertFileSrc(card.coverPath)} onClose={() => setCoverZoomOpen(false)} />
      )}
    </>
  );
}

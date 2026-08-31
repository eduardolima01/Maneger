import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { convertFileSrc } from '@tauri-apps/api/core';
import { PRIORITY_LABELS, PRIORITY_COLORS } from '@/types/kanban.types';
import type { KanbanCard as CardType, ChecklistProgress, KanbanDensity } from '@/types/kanban.types';
import ContextMenu from '@/components/ui/ContextMenu';
import CardLabelMenu from './CardLabelMenu';
import { useEffect, useRef, useState } from 'react';
import { ParsedLabel, parseLabel, serializeLabel } from '@/Kanban/utils/kanbanLabels';
import DueDateMenu from '@/Kanban/components/DueDateMenu';
import CardColorMenu from '@/Kanban/components/CardColorMenu';
import DuplicateMenu, { DuplicateMultipleMode } from '@/Kanban/components/DuplicateMenu';
import { extensionFromMime } from '@/Canvas/hooks/useCanvasClipboard';
import ImagePasteConfirmModal from '@/components/ui/ImagePasteConfirmModal';
import Toast from '@/components/ui/Toast';
import { saveCardImageBytes } from '@/Kanban/api/kanbanCardAssets';
import CoverZoomModal from '@/components/layout/CoverZoomModal';
import CardTimerPopup from '@/Kanban/Timer/CardTimerPopup';
import { useGlobalCardTimer } from '@/Kanban/Timer/store/cardTimerStore';
import { getCardTimerSessions } from '@/Kanban/Timer/cardTimer';

interface KanbanCardProps {
  card: CardType;
  density: KanbanDensity;
  hasSubKanban: boolean;
  checklistProgress?: ChecklistProgress;
  allLabels: ParsedLabel[];
  onClick: () => void;
  onDuplicate: () => void;
  onRequestDelete: () => void;
  onUpdateLabels: (cardId: string, labels: string[]) => void;
  onUpdateCardDueDate: (cardId: string, title: string) => void;
  onUpdateTitle: (cardId: string, title: string) => void;
  onUpdateColor: (cardId: string, color: string | null) => void;
  onDuplicateMultiple: (cardId: string, mode: DuplicateMultipleMode) => void;
  onUpdateCoverPath: (cardId: string, path: string) => void;
  projectId: string;

  selectedCardIds: Set<string>;
  onCardSelectToggle: (cardId: string) => void;
  onBulkDelete: (cardIds: string[]) => void;
  onBulkSetColor: (cardIds: string[], color: string | null) => void;
  onBulkToggleLabel: (cardIds: string[], name: string, color: string, isGroup: boolean) => void;
}

function getDueDateInfo(dueDate: string): { label: string; color: string } {
  // dueDate vem de <input type="date"> como "YYYY-MM-DD". Parsear com T00:00:00
  // força horário local — sem isso, new Date('2026-08-25') é interpretado como
  // UTC meia-noite e pode virar o dia anterior/seguinte dependendo do fuso.
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return { label: `${days} dia${days !== 1 ? 's' : ''} atrás`, color: '#e65100' };
  }
  if (diffDays === 0) return { label: 'hoje', color: '#e65100' };
  if (diffDays <= 3) return { label: `${diffDays} dia${diffDays !== 1 ? 's' : ''}`, color: '#e65100' };
  return { label: `${diffDays} dias`, color: '#666' };
}

export default function KanbanCard({
  card, density, hasSubKanban, onClick, onDuplicate, onRequestDelete, checklistProgress,
  allLabels,
  onUpdateLabels,
  onUpdateTitle,
  onUpdateColor,
  selectedCardIds,
  onCardSelectToggle,
  onBulkDelete,
  onBulkSetColor,
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

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [labelMenu, setLabelMenu] = useState<{ x: number; y: number } | null>(null);
  const [hovering, setHovering] = useState(false);
  const [dueDateMenu, setDueDateMenu] = useState<{ x: number; y: number } | null>(null);
  const [colorMenu, setColorMenu] = useState<{ x: number; y: number } | null>(null);

  const [duplicateMenu, setDuplicateMenu] = useState<{ x: number; y: number } | null>(null);
  const [pasteConfirm, setPasteConfirm] = useState<{ blob: Blob; ext: string; previewUrl: string } | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [coverZoomOpen, setCoverZoomOpen] = useState(false);
  const [timerMenu, setTimerMenu] = useState<{ x: number; y: number } | null>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(card.title);
  const [titleHover, setTitleHover] = useState(false);

  const cornerHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const CORNER_HOVER_DELAY = 300; // levemente maior que o dos itens — é fácil passar o mouse ali sem querer

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const CLOSE_DELAY = 500;

  function saveTitle() {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== card.title) onUpdateTitle(card.id, trimmed);
    else setTitleDraft(card.title); // reverte se veio vazio ou sem mudança
  }

  function scheduleClose() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setContextMenu(null);
      setLabelMenu(null);
      setDueDateMenu(null);
      setColorMenu(null);
      setTimerMenu(null);
      setDuplicateMenu(null);
    }, CLOSE_DELAY);
  }

  function openTimerMenu(pos: { x: number; y: number }) {
    setLabelMenu(null);
    setDueDateMenu(null);
    setColorMenu(null);
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
      if ((e.key === 'q' || e.key === 'Q') && !contextMenu && !labelMenu) {
        e.preventDefault();
        onRequestDelete();
      }
    }
    function handlePaste(e: ClipboardEvent) {
      if (contextMenu || labelMenu || dueDateMenu || colorMenu || duplicateMenu || pasteConfirm) return;
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
      // colou algo, mas não é imagem (texto, arquivo não-imagem, etc.)
      if (items.length > 0) {
        e.preventDefault();
        setPasteError('Isso não é uma imagem.');
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('paste', handlePaste);
      if (cornerHoverTimer.current) clearTimeout(cornerHoverTimer.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [hovering, contextMenu, labelMenu, dueDateMenu, colorMenu, duplicateMenu, pasteConfirm, onRequestDelete]);

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
    setDueDateMenu(null);
    setColorMenu(null);
    setLabelMenu(pos);

  }

  function openDueDateMenu(pos: { x: number; y: number }) {
    setLabelMenu(null);
    setColorMenu(null);
    setDueDateMenu(pos);
  }
  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  function openColorMenu(pos: { x: number; y: number }) {
    setLabelMenu(null);
    setDueDateMenu(null);
    setColorMenu(pos);
  }


  function openDuplicateMenu(pos: { x: number; y: number }) {
    setLabelMenu(null);
    setDueDateMenu(null);
    setColorMenu(null);
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
          border: card.color ? `1px solid ${card.color}` : '1px solid #e5e7eb',
          borderLeft: card.labels.length > 0 ? `4px solid ${parseLabel(card.labels[0]).color}` : (card.color ? `4px solid ${card.color}` : undefined),
          outline: selected ? '2px solid #1a73e8' : 'none',
          outlineOffset: selected ? -2 : 0,
          borderRadius: 6,
          padding: compact ? 6 : 10,
          marginBottom: 8,
          backgroundColor: '#fff',
          cursor: 'grab',
        }}
      >
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
          {hovering && <span style={{ fontSize: 11, color: '#bbb' }}>⋮</span>}
        </div>

        {!compact && (card.labels.length > 0 || card.dueDate || displayedTimerSeconds > 0) && card.coverPath && (
          <div
            onClick={(e) => { e.stopPropagation(); setCoverZoomOpen(true); }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              width: '100%', height: 80, borderRadius: 4, marginBottom: 6,
              backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
            <input
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
              style={{
                fontSize: compact ? 12 : 13, fontWeight: 500, flex: 1,
                border: 'none', outline: '1px solid #1a73e8', borderRadius: 3, padding: '0 2px',
                background: '#fff', fontFamily: 'inherit',
              }}
            />
          ) : (
            <span
              onClick={(e) => { e.stopPropagation(); setTitleDraft(card.title); setEditingTitle(true); }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseEnter={() => setTitleHover(true)}
              onMouseLeave={() => setTitleHover(false)}
              className="w-fit"
              style={{
                fontSize: compact ? 12 : 13, fontWeight: 500, flex: 1,
                textDecoration: titleHover ? 'underline' : 'none',
                cursor: 'text',
              }}
            >
              {card.title}
            </span>
          )}
          {hasSubKanban && (
            <span title="Tem sub-kanban" style={{ fontSize: 11 }}>📋</span>
          )}
          {hasOpenTimer && (
            <span
              title={globalTimer.running ? 'Cronômetro rodando' : 'Cronômetro pausado, sessão em aberto'}
              style={{ fontSize: 11, color: globalTimer.running ? '#2e7d32' : '#e65100' }}
            >
              {globalTimer.running ? '⏱' : '⏸'}
            </span>
          )}
          {card.priority && (
            <span
              title={PRIORITY_LABELS[card.priority]}
              style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: PRIORITY_COLORS[card.priority], flexShrink: 0 }}
            />
          )}
        </div>

        {!compact && card.description && (
          <p style={{ fontSize: 11, color: '#666', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {card.description}
          </p>
        )}

        {!compact && (card.labels.length > 0 || card.dueDate) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, fontSize: 10 }}>
            {card.labels.map((raw) => {
              const { name, color } = parseLabel(raw);
              return (
                <span key={raw} style={{ backgroundColor: color, color: '#fff', borderRadius: 3, padding: '1px 5px' }}>
                  {name}
                </span>
              );
            })}

            {checklistProgress && checklistProgress.total > 0 && (
              <span style={{ color: checklistProgress.done === checklistProgress.total ? '#33b679' : '#666' }}>
                ☑ {checklistProgress.done}/{checklistProgress.total} ({Math.round((checklistProgress.done / checklistProgress.total) * 100)}%)
              </span>
            )}

            {card.dueDate && (() => {
              const info = getDueDateInfo(card.dueDate);
              return <span style={{ color: info.color, fontWeight: info.color === '#666' ? 400 : 600 }}>📅 {info.label}</span>;
            })()}

            {displayedTimerSeconds > 0 && (
              <span style={{ color: hasOpenTimer && globalTimer.running ? '#2e7d32' : '#666' }}>
                ⏱ {formatCardTimerTotal(displayedTimerSeconds)}
              </span>
            )}
          </div>
        )}

        {displayedTimerSeconds > 0 && (
          <span
            title={hasOpenTimer && globalTimer.running ? 'Cronômetro rodando' : 'Tempo total registrado'}
            style={{
              position: 'absolute', bottom: 4, right: 4, fontSize: 10,
              color: hasOpenTimer && globalTimer.running ? '#2e7d32' : '#999',
              backgroundColor: 'rgba(255,255,255,0.85)', padding: '1px 4px', borderRadius: 3,
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
          onSave={(value) => isBulkTarget
            ? onBulkSetColor(Array.from(selectedCardIds), value)
            : onUpdateColor(card.id, value)}
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


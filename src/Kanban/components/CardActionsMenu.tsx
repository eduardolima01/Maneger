import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { STATUS_LABELS } from '@/types/kanban.types';
import type { KanbanCard, TaskStatus } from '@/types/kanban.types';
import ContextMenu from '@/components/ui/ContextMenu';
import CardLabelMenu from '@/Kanban/components/CardLabelMenu';
import DueDateMenu from '@/Kanban/components/DueDateMenu';
import CardColorMenu from '@/Kanban/components/CardColorMenu';
import CardStatusMenu from '@/Kanban/components/CardStatusMenu';
import CardMoveMenu from '@/Kanban/components/CardMoveMenu';
import DuplicateMenu, { DuplicateMultipleMode } from '@/Kanban/components/DuplicateMenu';
import CardTimerPopup from '@/Kanban/Timer/CardTimerPopup';
import { ParsedLabel, parseLabel, serializeLabel } from '@/Kanban/utils/kanbanLabels';
import { useCardMove } from '@/lib/utils/CardMoveContext';
import { getRelativeDue } from '@/Kanban/utils/relativeDate';

/** Ações que o menu dispara — o quadro e a árvore passam as mesmas funções que já usam nos cards. */
export interface CardActionsHandlers {
  allLabels: ParsedLabel[];
  projectId: string;
  onUpdateLabels: (cardId: string, labels: string[]) => void;
  onUpdateDueDate: (cardId: string, dueDate: string | null) => void;
  onUpdateColor: (cardId: string, color: string | null) => void;
  onUpdateStatus: (cardId: string, status: TaskStatus | null) => void;
  onDuplicate: (cardId: string) => void;
  onDuplicateMultiple: (cardId: string, mode: DuplicateMultipleMode) => void;
  onRequestDelete: (cardId: string, title: string) => void;
}

interface CardActionsMenuProps extends CardActionsHandlers {
  card: KanbanCard;
}

type SubMenuKind = 'label' | 'due' | 'color' | 'status' | 'move' | 'duplicate' | 'timer';
interface Pos { x: number; y: number }

const HOVER_OPEN_DELAY = 300; // igual ao canto ⋮ do card no quadro: é fácil passar o mouse ali sem querer
const CLOSE_DELAY = 500;

const stopBubbling = (e: React.SyntheticEvent) => e.stopPropagation();

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

/**
 * Botão ⋮ do card + o menu que ele abre (data, etiquetas, cor, status, mover, duplicar, cronômetro, excluir), com os
 * mesmos itens e submenus do menu do card no quadro. Abre ao passar o mouse no ⋮ (depois de um instante) ou ao clicar.
 * O ⋮ fica invisível e só aparece com o mouse sobre o item — o PAI precisa ter `className="group/row"`.
 * Os menus saem num portal no <body>: assim não são deslocados por zoom (CSS `zoom`) nem cortados por overflow do pai.
 */
export default function CardActionsMenu({
  card, allLabels, projectId, onUpdateLabels, onUpdateDueDate, onUpdateColor, onUpdateStatus,
  onDuplicate, onDuplicateMultiple, onRequestDelete,
}: CardActionsMenuProps) {
  const cardMove = useCardMove(); // null fora do KanbanBoard — "Mover para…" fica desabilitado
  const [menu, setMenu] = useState<Pos | null>(null);
  const [sub, setSub] = useState<{ kind: SubMenuKind } & Pos | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  function cancelClose() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }

  function closeAll() {
    setMenu(null);
    setSub(null);
  }

  /** Sair do menu fecha tudo depois de um instante (entrar de novo cancela) — mesmo comportamento do quadro. */
  function scheduleClose() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(closeAll, CLOSE_DELAY);
  }

  function openSub(kind: SubMenuKind, pos: Pos) {
    setSub({ kind, ...pos });
  }

  /* ----- etiquetas (mesma regra do card: a cor da 1ª etiqueta vira a cor do card se ele ainda não tem uma) ----- */

  function applyLabelsChange(nextLabels: string[]) {
    onUpdateLabels(card.id, nextLabels);
    if (!card.color && nextLabels.length > 0) onUpdateColor(card.id, parseLabel(nextLabels[0]).color);
  }

  function handleToggleLabel(name: string, color: string, isGroup: boolean) {
    const hasIt = card.labels.some((l) => parseLabel(l).name === name);
    applyLabelsChange(hasIt
      ? card.labels.filter((l) => parseLabel(l).name !== name)
      : [...card.labels, serializeLabel(name, color, isGroup)]);
  }

  function handleCreateLabel(name: string, color: string, isGroup: boolean) {
    if (card.labels.some((l) => parseLabel(l).name === name)) return;
    applyLabelsChange([...card.labels, serializeLabel(name, color, isGroup)]);
  }

  function handleReorderLabels(nextLabels: string[]) {
    onUpdateLabels(card.id, nextLabels);
    // reordenar é "essa etiqueta vai pra frente": sempre atualiza a cor, mesmo que já houvesse uma definida
    if (nextLabels.length > 0) onUpdateColor(card.id, parseLabel(nextLabels[0]).color);
  }

  const hoverHandlers = { onMouseEnter: cancelClose, onMouseLeave: scheduleClose };

  return (
    <>
      <button
        type="button"
        title="Menu do card"
        aria-label="Menu do card"
        onMouseEnter={(e) => {
          cancelClose();
          const rect = e.currentTarget.getBoundingClientRect();
          if (openTimerRef.current) clearTimeout(openTimerRef.current);
          openTimerRef.current = setTimeout(() => setMenu({ x: rect.right, y: rect.top }), HOVER_OPEN_DELAY);
        }}
        onMouseLeave={() => { if (openTimerRef.current) clearTimeout(openTimerRef.current); }}
        onClick={(e) => {
          e.stopPropagation(); // não abre o card no painel
          if (openTimerRef.current) clearTimeout(openTimerRef.current);
          const rect = e.currentTarget.getBoundingClientRect();
          setMenu({ x: rect.right, y: rect.top });
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={`bg-transparent border-0 p-0 cursor-pointer shrink-0 leading-none text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 ${menu || sub ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100'
          }`}
        style={{ fontSize: 14, width: 14, textAlign: 'center' }}
      >
        ⋮
      </button>

      {createPortal(
        // O portal manda o menu pro <body>, mas no React os eventos ainda SOBEM pela árvore de componentes até a linha do
        // card: um clique num item do menu abria o card no painel e podia iniciar um arrasto. Este div segura isso.
        <div
          onClick={stopBubbling}
          onDoubleClick={stopBubbling}
          onPointerDown={stopBubbling}
          onContextMenu={stopBubbling}
        >
          {menu && (
            <ContextMenu
              x={menu.x}
              y={menu.y}
              // Fecha só o menu principal (como no KanbanCard do quadro): clicar DENTRO de um submenu (status, etiquetas,
              // cor...) é "fora" do menu principal, e fechar tudo aqui desmontava o submenu antes do clique chegar nele.
              onClose={() => setMenu(null)}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
              items={[
                { label: `🕒 Criado há ${daysAgoLabel(card.createdAt)}`, onClick: () => { }, disabled: true },
                { label: `✏️ Atualizado há ${daysAgoLabel(card.updatedAt)}`, onClick: () => { }, disabled: true },
                {
                  label: card.dueDate ? `📅 ${getRelativeDue(card.dueDate).label}` : '📅 Definir data do card',
                  onClick: () => openSub('due', menu),
                  onHoverStart: (rect) => openSub('due', { x: rect.right + 4, y: rect.top }),
                },
                {
                  label: '🏷 Etiquetas',
                  onClick: () => openSub('label', menu),
                  onHoverStart: (rect) => openSub('label', { x: rect.right + 4, y: rect.top }),
                },
                {
                  label: '🎨 Cor',
                  onClick: () => openSub('color', menu),
                  onHoverStart: (rect) => openSub('color', { x: rect.right + 4, y: rect.top }),
                },
                {
                  label: card.status ? `📊 ${STATUS_LABELS[card.status]}` : '📊 Definir status',
                  onClick: () => openSub('status', menu),
                  onHoverStart: (rect) => openSub('status', { x: rect.right + 4, y: rect.top }),
                },
                {
                  label: '📦 Mover para…',
                  disabled: !cardMove,
                  onClick: () => openSub('move', menu),
                  onHoverStart: (rect) => openSub('move', { x: rect.right + 4, y: rect.top }),
                },
                {
                  label: '⧉ Duplicar',
                  onClick: () => { closeAll(); onDuplicate(card.id); },
                  onHoverStart: (rect) => openSub('duplicate', { x: rect.right + 4, y: rect.top }),
                },
                { label: '⏱ Cronômetro', onClick: () => openSub('timer', menu) },
                { label: '🗑 Excluir', onClick: () => { closeAll(); onRequestDelete(card.id, card.title); }, danger: true },
              ]}
            />
          )}

          {sub?.kind === 'label' && (
            <CardLabelMenu
              x={sub.x}
              y={sub.y}
              cardLabels={card.labels}
              allLabels={allLabels}
              onToggle={handleToggleLabel}
              onCreate={handleCreateLabel}
              onClose={() => setSub(null)}
              onReorder={handleReorderLabels}
              {...hoverHandlers}
            />
          )}

          {sub?.kind === 'due' && (
            <DueDateMenu
              x={sub.x}
              y={sub.y}
              value={card.dueDate}
              onSave={(value) => onUpdateDueDate(card.id, value)}
              onClose={() => setSub(null)}
              {...hoverHandlers}
            />
          )}

          {sub?.kind === 'color' && (
            <CardColorMenu
              x={sub.x}
              y={sub.y}
              value={card.color}
              onSave={(value) => onUpdateColor(card.id, value)}
              onClose={() => setSub(null)}
              {...hoverHandlers}
            />
          )}

          {sub?.kind === 'status' && (
            <CardStatusMenu
              x={sub.x}
              y={sub.y}
              value={card.status}
              onSave={(value) => onUpdateStatus(card.id, value)}
              onClose={() => setSub(null)}
              {...hoverHandlers}
            />
          )}

          {sub?.kind === 'move' && cardMove && (
            <CardMoveMenu
              x={sub.x}
              y={sub.y}
              columns={cardMove.columns}
              groups={cardMove.groups}
              currentColumnId={card.cardGroupId ? null : card.columnId}
              currentGroupId={card.cardGroupId}
              cardCount={1}
              onMove={(target) => {
                closeAll();
                void cardMove.moveCards([card.id], target);
              }}
              onClose={() => setSub(null)}
              {...hoverHandlers}
            />
          )}

          {sub?.kind === 'duplicate' && (
            <DuplicateMenu
              x={sub.x}
              y={sub.y}
              onDuplicateOnce={() => onDuplicate(card.id)}
              onDuplicateMultiple={(mode) => onDuplicateMultiple(card.id, mode)}
              onClose={() => setSub(null)}
              {...hoverHandlers}
            />
          )}

          {sub?.kind === 'timer' && (
            <CardTimerPopup
              x={sub.x}
              y={sub.y}
              projectId={projectId}
              cardId={card.id}
              cardTitle={card.title}
              onClose={() => setSub(null)}
              {...hoverHandlers}
            />
          )}
        </div>,
        document.body
      )}
    </>
  );
}

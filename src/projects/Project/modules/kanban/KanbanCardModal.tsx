import { Fragment, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import { createKanban, getKanbanById } from '@/lib/api/kanban/kanbans';
import { generateId } from '@/lib/utils/uuid';
import { PRIORITY_LABELS, STATUS_LABELS, STATUS_COLORS, CARD_FIELD_LABELS, mergeCardFieldConfig, CARD_VISUAL_FIELD_LABELS, mergeCardVisualConfig } from '@/types/kanban.types';
import type { KanbanCard, TaskPriority, TaskStatus, Kanban, KanbanColumn, KanbanCardGroup, CardFieldConfig, CardFieldKey, CardFieldTab, CardVisualFieldConfig, CardVisualFieldKey, CardScheduleEntry } from '@/types/kanban.types';
import KanbanBoard from './KanbanBoard';
import MarkdownField from '@/components/ui/MarkdownField';
import ChecklistSection from '@/Kanban/ChecklistSection';
import ImageUploadField from '@/components/ImageUploadField';
import CardFilesSection from '@/Kanban/components/Cardfilessection';
import { getRelativeDue } from '@/Kanban/utils/relativeDate';

type Tab = 'details' | 'meta' | 'config';

// Classes de tema reutilizadas (cores fixas saíram do `style` pra `dark:` funcionar — inline sempre vence classe).
const INPUT_CLS = 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 dark:[color-scheme:dark]';
const LABEL_CLS = 'text-neutral-500 dark:text-neutral-400';
const FAINT_CLS = 'text-neutral-400 dark:text-neutral-500';
const COVER_SQUARE_SIZE = 200; // lado (px) da pré-visualização quadrada da capa na edição do card
const BORDER_INPUT_CLS = 'border border-neutral-300 dark:border-neutral-600';
const INDIGO_TEXT_CLS = 'text-indigo-700 dark:text-indigo-300';

/** Uma linha de horário editável — mesmo padrão de rascunho local + salvar no blur que o título do card usa (o time picker, por ser seleção atômica, salva direto no onChange, sem rascunho). */
function ScheduleEntryRow({
  entry, onUpdateTime, onUpdateTitle, onRemove,
}: {
  entry: CardScheduleEntry;
  onUpdateTime: (time: string) => void;
  onUpdateTitle: (title: string) => void;
  onRemove: () => void;
}) {
  const [titleDraft, setTitleDraft] = useState(entry.title);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        type="time"
        value={entry.time}
        onChange={(e) => onUpdateTime(e.target.value)}
        className={INPUT_CLS}
        style={{ padding: 5, fontSize: 12, width: 100 }}
      />
      <input
        value={titleDraft}
        onChange={(e) => setTitleDraft(e.target.value)}
        onBlur={() => titleDraft.trim() !== entry.title && onUpdateTitle(titleDraft.trim())}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        placeholder="Título (opcional)..."
        className={INPUT_CLS}
        style={{ flex: 1, padding: 5, fontSize: 12 }}
      />
      <button onClick={onRemove} title="Remover horário" className="text-red-600 dark:text-red-400" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13 }}>✕</button>
    </div>
  );
}

interface KanbanCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: KanbanCard | null;
  kanban: Kanban;
  columns: KanbanColumn[];
  groups: KanbanCardGroup[];
  cardFieldConfig: CardFieldConfig[];
  onUpdateCardFieldConfig: (config: CardFieldConfig[]) => void;
  cardVisualConfig: CardVisualFieldConfig[];
  onUpdateCardVisualConfig: (config: CardVisualFieldConfig[]) => void;
  onUpdate: (id: string, input: Parameters<typeof import('@/lib/api/kanban/kanbanCards').updateCard>[1]) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string, archived: boolean) => void;
  onRequestDelete: (id: string, title: string) => void;
  /** 'modal' (padrão) abre dentro do Modal; 'panel' renderiza só o conteúdo, pra ficar embutido numa coluna lateral. */
  variant?: 'modal' | 'panel';
}

/** Par de botões ▲ ▼ pra reordenar um campo na lista de configuração. */
function MoveButtons({ onUp, onDown }: { onUp?: () => void; onDown?: () => void }) {
  const cls = 'border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 disabled:opacity-30 disabled:cursor-default';
  const style: React.CSSProperties = { fontSize: 9, lineHeight: 1, padding: '2px 5px', borderRadius: 3, cursor: 'pointer' };
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <button type="button" onClick={onUp} disabled={!onUp} title="Subir" aria-label="Subir" className={cls} style={style}>▲</button>
      <button type="button" onClick={onDown} disabled={!onDown} title="Descer" aria-label="Descer" className={cls} style={style}>▼</button>
    </span>
  );
}

export default function KanbanCardModal({
  isOpen, onClose, card, columns, groups, cardFieldConfig, onUpdateCardFieldConfig, cardVisualConfig, onUpdateCardVisualConfig, onUpdate, onDuplicate, onArchive, onRequestDelete,
  variant = 'modal',
}: KanbanCardModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [newScheduleTime, setNewScheduleTime] = useState('');
  const [newScheduleTitle, setNewScheduleTitle] = useState('');

  const [subKanban, setSubKanban] = useState<Kanban | null>(null);
  const [loadingSubKanban, setLoadingSubKanban] = useState(false);

  const fields = mergeCardFieldConfig(cardFieldConfig);
  const visualFields = mergeCardVisualConfig(cardVisualConfig);
  // Onde CADA campo mora agora (não onde ele "nasceu" no código) — é isso que faltava:
  // antes cada campo só tinha JSX escrito dentro de uma aba fixa, então mover a config
  // pra outra aba não tinha pra onde ir. Agora toda aba sabe renderizar qualquer campo.
  function isVisible(tab: CardFieldTab, key: CardFieldKey): boolean {
    const f = fields.find((c) => c.key === key);
    return !!f && f.tab === tab && f.visible;
  }

  function updateField(key: CardFieldKey, patch: Partial<Pick<CardFieldConfig, 'tab' | 'visible'>>) {
    const next = fields.map((f) => (f.key === key ? { ...f, ...patch } : f));
    if (patch.tab) {
      // mudou de aba: vai pro FIM da lista da aba nova (a ordem do array é a ordem de exibição)
      const moved = next.find((f) => f.key === key)!;
      onUpdateCardFieldConfig([...next.filter((f) => f.key !== key), moved]);
      return;
    }
    onUpdateCardFieldConfig(next);
  }

  /** Sobe/desce um campo DENTRO da própria aba (troca de lugar com o vizinho da mesma aba). */
  function moveField(key: CardFieldKey, dir: -1 | 1) {
    const f = fields.find((x) => x.key === key);
    if (!f) return;
    const sameTab = fields.filter((x) => x.tab === f.tab);
    const i = sameTab.findIndex((x) => x.key === key);
    const other = sameTab[i + dir];
    if (!other) return;
    const next = [...fields];
    const a = next.findIndex((x) => x.key === key);
    const b = next.findIndex((x) => x.key === other.key);
    [next[a], next[b]] = [next[b], next[a]];
    onUpdateCardFieldConfig(next);
  }

  function updateVisualField(key: CardVisualFieldKey, visible: boolean) {
    onUpdateCardVisualConfig(visualFields.map((f) => (f.key === key ? { ...f, visible } : f)));
  }

  function moveVisualField(key: CardVisualFieldKey, dir: -1 | 1) {
    const i = visualFields.findIndex((x) => x.key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= visualFields.length) return;
    const next = [...visualFields];
    [next[i], next[j]] = [next[j], next[i]];
    onUpdateCardVisualConfig(next);
  }

  /** Posição do campo na lista configurada — usada como `order` CSS dentro das linhas lado a lado (datas; prioridade/status/cor). */
  function orderOf(key: CardFieldKey): number {
    return fields.findIndex((f) => f.key === key);
  }

  useEffect(() => {
    if (isOpen && card) {
      setTitle(card.title);
      setDescription(card.description ?? '');
      setNotes(card.notes ?? '');
    }
  }, [isOpen, card]);

  // volta pra aba "Detalhes" só ao abrir OU trocar de card — não a cada edição (senão mexer em Propriedades jogava de volta pra Detalhes)
  useEffect(() => {
    if (isOpen) setActiveTab('details');
  }, [isOpen, card?.id]);

  useEffect(() => {
    if (isOpen && card) {
      setLoadingSubKanban(true);
      // getSubKanbanByCardId(card.id).then((k) => {
      //   setSubKanban(k);
      //   setLoadingSubKanban(false);
      // });
    } else {
      setSubKanban(null);
    }
  }, [isOpen, card?.id]);

  const [toggleEditSignal, setToggleEditSignal] = useState(0);
  const ctrlOnlyRef = useRef(true); // reseta a cada novo "hold" de Control

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Control') { ctrlOnlyRef.current = true; return; }
      if (e.ctrlKey) ctrlOnlyRef.current = false;
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'Control' && ctrlOnlyRef.current) {
        setToggleEditSignal((t) => t + 1);
      }
    }

    // Ctrl + roda do mouse (zoom) não é um "toque só no Control": sem isso, soltar o Ctrl depois do zoom alternaria a edição
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey) ctrlOnlyRef.current = false;
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('wheel', onWheel, { passive: true });
    // Ctrl + CLIQUE (selecionar cards na árvore) também não é um "toque só no Control"
    function onPointerDown(e: PointerEvent) {
      if (e.ctrlKey) ctrlOnlyRef.current = false;
    }
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [isOpen]);

  if (!card) return null;

  // cards salvos antes deste campo existir não têm a chave no JSON (undefined, não [])
  const schedules = card.schedules ?? [];

  function saveTitle() {
    if (title.trim() && title !== card!.title) onUpdate(card!.id, { title: title.trim() });
  }

  function saveDescription() {
    if (description !== (card!.description ?? '')) onUpdate(card!.id, { description });
  }

  function saveNotes() {
    if (notes !== (card!.notes ?? '')) onUpdate(card!.id, { notes: notes || null });
  }

  function addLabel() {
    const value = labelInput.trim();
    if (!value || card!.labels.includes(value)) return;
    onUpdate(card!.id, { labels: [...card!.labels, value] });
    setLabelInput('');
  }

  function removeLabel(label: string) {
    onUpdate(card!.id, { labels: card!.labels.filter((l) => l !== label) });
  }

  function addSchedule() {
    const time = newScheduleTime.trim();
    if (!time) return;
    const entry: CardScheduleEntry = { id: generateId(), time, title: newScheduleTitle.trim() };
    onUpdate(card!.id, { schedules: [...schedules, entry].sort((a, b) => a.time.localeCompare(b.time)) });
    setNewScheduleTime('');
    setNewScheduleTitle('');
  }

  function updateScheduleTime(id: string, time: string) {
    const next = schedules.map((s) => (s.id === id ? { ...s, time } : s)).sort((a, b) => a.time.localeCompare(b.time));
    onUpdate(card!.id, { schedules: next });
  }

  function updateScheduleTitle(id: string, title: string) {
    onUpdate(card!.id, { schedules: schedules.map((s) => (s.id === id ? { ...s, title } : s)) });
  }

  function removeSchedule(id: string) {
    onUpdate(card!.id, { schedules: schedules.filter((s) => s.id !== id) });
  }

  async function handlePickCover() {
    const selected = await open({ multiple: false, filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }] });
    if (!selected || Array.isArray(selected)) return;
    if (card) {
      const newPath = await invoke<string>('save_project_cover', { projectId: card.id, sourcePath: selected });
      onUpdate(card.id, { coverPath: newPath });
    }
  }

  async function handleCreateSubKanban() {
    if (!card) return;
    if (!card.kanbanId) return; // card sem kanban direto (ex: dentro de um grupo) não tem "kanban pai" nesse sentido
    const parentKanban = await getKanbanById(card.kanbanId);

    if (!parentKanban) return;
    const id = await createKanban({
      projectId: parentKanban.projectId,
      parentCardId: card.id,
      name: `${card.title} — subtarefas`,
    });
    const created = await getKanbanById(id);
    setSubKanban(created);
  }

  // --- Cada campo tem uma função de render própria, chamada de dentro de QUALQUER aba ---

  const WEEKDAY_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const WEEKDAY_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  /** Grupos/subgrupos de uma coluna, em ordem hierárquica, com o nome recuado por profundidade. */
  function flattenGroupsForColumn(columnId: string): { id: string; label: string }[] {
    const result: { id: string; label: string }[] = [];
    function walk(parentId: string | null, depth: number) {
      const siblings = groups
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

  function togglePlanWeekday(day: number) {
    const current = card!.planWeekdays;
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort();
    if (next.length === 0) return; // sempre pelo menos um dia ativo
    onUpdate(card!.id, { planWeekdays: next });
  }

  function renderPlanBanner() {
    if (!card!.isPlanTemplate) return null;
    const groupOptions = card!.planTargetColumnId ? flattenGroupsForColumn(card!.planTargetColumnId) : [];
    return (
      <div
        key="plan-banner"
        className="bg-indigo-50 dark:bg-indigo-950 text-neutral-900 dark:text-neutral-100"
        style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 10px', borderRadius: 6 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={INDIGO_TEXT_CLS} style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>
            📋 Card de plano — gera ocorrência no calendário de {card!.startDate ?? '?'} até {card!.dueDate ?? '?'}
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={card!.planActive}
              onChange={(e) => onUpdate(card!.id, { planActive: e.target.checked })}
            />
            Ativo
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {WEEKDAY_SHORT.map((label, day) => (
              <button
                key={day}
                onClick={() => togglePlanWeekday(day)}
                title={WEEKDAY_FULL[day]}
                className={
                  card!.planWeekdays.includes(day)
                    ? 'border border-indigo-200 dark:border-indigo-800 bg-indigo-700 text-white'
                    : 'border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-neutral-800 text-indigo-700 dark:text-indigo-300'
                }
                style={{ width: 22, height: 22, fontSize: 10, borderRadius: '50%', cursor: 'pointer' }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className={INDIGO_TEXT_CLS} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            Vezes por dia:
            <input
              type="number"
              min={1}
              max={20}
              value={card!.planTimesPerDay}
              onChange={(e) => onUpdate(card!.id, { planTimesPerDay: Math.max(1, Number(e.target.value) || 1) })}
              className={INPUT_CLS}
              style={{ width: 48, padding: 4, fontSize: 11 }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label className={INDIGO_TEXT_CLS} style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>
              Coluna onde o card materializado nasce
            </label>
            <select
              value={card!.planTargetColumnId ?? ''}
              onChange={(e) => onUpdate(card!.id, { planTargetColumnId: e.target.value || null, planTargetGroupId: null })}
              className={INPUT_CLS}
              style={{ width: '100%', padding: 6, fontSize: 12 }}
            >
              <option value="">Nenhuma — fica só no calendário</option>
              {columns.map((col) => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
          </div>
          {card!.planTargetColumnId && groupOptions.length > 0 && (
            <div style={{ flex: 1 }}>
              <label className={INDIGO_TEXT_CLS} style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>
                Grupo/subgrupo (opcional)
              </label>
              <select
                value={card!.planTargetGroupId ?? ''}
                onChange={(e) => onUpdate(card!.id, { planTargetGroupId: e.target.value || null })}
                className={INPUT_CLS}
                style={{ width: '100%', padding: 6, fontSize: 12 }}
              >
                <option value="">Nenhum — direto na coluna</option>
                {groupOptions.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderConvertToPlanButton() {
    return (
      <button
        key="convert-to-plan"
        onClick={() => onUpdate(card!.id, { isPlanTemplate: true, planActive: true })}
        className="border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
        style={{ alignSelf: 'flex-start', fontSize: 11, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
      >
        🔁 Transformar em card de plano
      </button>
    );
  }

  function renderNotes() {
    return (
      <div key="notes">
        <label className={LABEL_CLS} style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
          Notas (ícone 📝 no canto superior direito do card)
        </label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <input
            type="color"
            value={card!.notesColor ?? '#fff9c4'}
            onChange={(e) => onUpdate(card!.id, { notesColor: e.target.value })}
            title="Cor da nota"
            className={BORDER_INPUT_CLS}
            style={{ width: 30, height: 30, padding: 0, borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={2}
            placeholder="Nota rápida..."
            className={`${INPUT_CLS} ${BORDER_INPUT_CLS}`}
            style={{ flex: 1, boxSizing: 'border-box', padding: 8, fontSize: 13, resize: 'vertical', borderRadius: 4, fontFamily: 'inherit' }}
          />
        </div>
      </div>
    );
  }

  function renderDescription() {
    return (
      <div key="description">
        <label className={LABEL_CLS} style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Descrição (Markdown)</label>
        <MarkdownField
          value={description}
          onChange={setDescription}
          onBlur={saveDescription}
          rows={6}
          toggleEditSignal={toggleEditSignal}
        />
      </div>
    );
  }

  function renderSubKanban() {
    return (
      <div key="subKanban" className="border-t border-neutral-200 dark:border-neutral-700" style={{ paddingTop: 12 }}>
        <label className={LABEL_CLS} style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Sub-kanban</label>
        {loadingSubKanban && <p className={FAINT_CLS} style={{ fontSize: 12 }}>Verificando...</p>}

        {!loadingSubKanban && subKanban && (
          <div className="border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950" style={{ borderRadius: 6, padding: 8 }}>
            <KanbanBoard kanban={subKanban} />
          </div>
        )}

        {!loadingSubKanban && !subKanban && (
          <Button variant="secondary" onClick={handleCreateSubKanban}>
            + Criar sub-kanban pra dividir esse card
          </Button>
        )}
      </div>
    );
  }

  function renderChecklist() {
    return (
      <div key="checklist" className="border-t border-neutral-200 dark:border-neutral-700" style={{ paddingTop: 12 }}>
        <label className={LABEL_CLS} style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
          Lista de tarefas{card!.isPlanTemplate ? ' (copiada pra cada ocorrência materializada)' : ''}
        </label>
        <ChecklistSection cardId={card!.id} />
      </div>
    );
  }

  function renderFiles() {
    return <CardFilesSection key="files" cardId={card!.id} onSetCover={(path) => onUpdate(card!.id, { coverPath: path })} />;
  }

  function renderDates(tab: CardFieldTab) {
    const showStart = isVisible(tab, 'startDate');
    const showDue = isVisible(tab, 'dueDate');
    if (!showStart && !showDue) return null;
    return (
      <div key="dates" style={{ display: 'flex', gap: 12 }}>
        {showStart && (
          <div style={{ flex: 1, order: orderOf('startDate') }}>
            <label className={LABEL_CLS} style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              {card!.isPlanTemplate ? 'Início do plano' : 'Data inicial'}
            </label>
            <input
              type="date"
              value={card!.startDate ?? ''}
              onChange={(e) => onUpdate(card!.id, { startDate: e.target.value || null })}
              className={INPUT_CLS}
              style={{ width: '100%', padding: 6, fontSize: 13 }}
            />
            {card!.startDate && <div className={FAINT_CLS} style={{ fontSize: 11, marginTop: 3 }}>{getRelativeDue(card!.startDate).label}</div>}
          </div>
        )}
        {showDue && (
          <div style={{ flex: 1, order: orderOf('dueDate') }}>
            <label className={LABEL_CLS} style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              {card!.isPlanTemplate ? 'Fim do plano' : 'Definir data do card'}
            </label>
            <input
              type="date"
              value={card!.dueDate ?? ''}
              onChange={(e) => onUpdate(card!.id, { dueDate: e.target.value || null })}
              className={INPUT_CLS}
              style={{ width: '100%', padding: 6, fontSize: 13 }}
            />
            {card!.dueDate && <div className={FAINT_CLS} style={{ fontSize: 11, marginTop: 3 }}>{getRelativeDue(card!.dueDate).label}</div>}
          </div>
        )}
      </div>
    );
  }

  function renderCover() {
    return (
      <div key="cover" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ImageUploadField
          entityId={card!.id}
          currentPath={card!.coverPath}
          onUploaded={(path) => onUpdate(card!.id, { coverPath: path })}
          height={120}
          squareSize={COVER_SQUARE_SIZE}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={handlePickCover}>{card!.coverPath ? 'Trocar capa' : 'Adicionar capa'}</Button>
          {card!.coverPath && (
            <Button variant="secondary" onClick={() => onUpdate(card!.id, { coverPath: null })}>Remover capa</Button>
          )}
        </div>
      </div>
    );
  }

  function renderPriorityStatusColor(tab: CardFieldTab) {
    const showPriority = isVisible(tab, 'priority');
    const showStatus = isVisible(tab, 'status');
    const showColor = isVisible(tab, 'color');
    if (!showPriority && !showStatus && !showColor) return null;
    return (
      <div key="priority-status-color" style={{ display: 'flex', gap: 12 }}>
        {showPriority && (
          <div style={{ flex: 1, order: orderOf('priority') }}>
            <label className={LABEL_CLS} style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Prioridade</label>
            <select
              value={card!.priority ?? ''}
              onChange={(e) => onUpdate(card!.id, { priority: (e.target.value || null) as TaskPriority | null })}
              className={INPUT_CLS}
              style={{ width: '100%', padding: 6, fontSize: 13 }}
            >
              <option value="">Nenhuma</option>
              {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
          </div>
        )}
        {showStatus && (
          <div style={{ flex: 1, order: orderOf('status') }}>
            <label className={LABEL_CLS} style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Status</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                title={card!.status ? STATUS_LABELS[card!.status] : 'Sem status'}
                className={card!.status ? '' : 'bg-neutral-200 dark:bg-neutral-600'}
                style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: card!.status ? STATUS_COLORS[card!.status] : undefined,
                }}
              />
              <select
                value={card!.status ?? ''}
                onChange={(e) => onUpdate(card!.id, { status: (e.target.value || null) as TaskStatus | null })}
                className={INPUT_CLS}
                style={{ flex: 1, padding: 6, fontSize: 13 }}
              >
                <option value="">Nenhum</option>
                {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        {showColor && (
          <div style={{ flex: 1, order: orderOf('color') }}>
            <label className={LABEL_CLS} style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Cor</label>
            <input
              type="color"
              value={card!.color ?? '#cccccc'}
              onChange={(e) => onUpdate(card!.id, { color: e.target.value })}
              className={BORDER_INPUT_CLS}
              style={{ width: '100%', height: 30, padding: 0, borderRadius: 4, cursor: 'pointer' }}
            />
          </div>
        )}
      </div>
    );
  }

  function renderLabels() {
    return (
      <div key="labels">
        <label className={LABEL_CLS} style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Etiquetas</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {card!.labels.map((l) => (
            <span key={l} className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300" style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 3, padding: '2px 6px', fontSize: 11 }}>
              {l}
              <button onClick={() => removeLabel(l)} className="text-indigo-700 dark:text-indigo-300" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, padding: 0 }}>✕</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLabel()}
            placeholder="Nova etiqueta..."
            className={INPUT_CLS}
            style={{ flex: 1, padding: 6, fontSize: 12 }}
          />
          <Button variant="secondary" onClick={addLabel}>+ Adicionar</Button>
        </div>
      </div>
    );
  }

  function renderSchedules() {
    return (
      <div key="schedules">
        <label className={LABEL_CLS} style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Horários</label>
        {schedules.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
            {schedules.map((s) => (
              <ScheduleEntryRow
                key={s.id}
                entry={s}
                onUpdateTime={(time) => updateScheduleTime(s.id, time)}
                onUpdateTitle={(title) => updateScheduleTitle(s.id, title)}
                onRemove={() => removeSchedule(s.id)}
              />
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="time"
            value={newScheduleTime}
            onChange={(e) => setNewScheduleTime(e.target.value)}
            className={INPUT_CLS}
            style={{ padding: 6, fontSize: 12, width: 100 }}
          />
          <input
            value={newScheduleTitle}
            onChange={(e) => setNewScheduleTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSchedule()}
            placeholder="Título (opcional)..."
            className={INPUT_CLS}
            style={{ flex: 1, padding: 6, fontSize: 12 }}
          />
          <Button variant="secondary" onClick={addSchedule}>+ Adicionar</Button>
        </div>
      </div>
    );
  }

  /**
   * Renderiza, pra uma aba, todo campo configurado (visível) pra morar nela, NA ORDEM da lista de configuração.
   * Datas (início/prazo) e prioridade/status/cor são linhas lado a lado: a linha fica na posição do primeiro membro dela
   * e, dentro da linha, os campos seguem a mesma ordem (CSS `order`).
   */
  function renderTabFields(tab: CardFieldTab) {
    const rendered = new Set<string>();
    const rows: React.ReactNode[] = [];
    for (const f of fields) {
      if (f.tab !== tab || !f.visible) continue;
      let row: string = f.key;
      if (f.key === 'startDate' || f.key === 'dueDate') row = 'dates';
      else if (f.key === 'priority' || f.key === 'status' || f.key === 'color') row = 'priority-status-color';
      if (rendered.has(row)) continue;
      rendered.add(row);

      let node: React.ReactNode = null;
      switch (row) {
        case 'convertToPlan': node = !card!.isPlanTemplate && renderConvertToPlanButton(); break;
        case 'description': node = renderDescription(); break;
        case 'notes': node = renderNotes(); break;
        case 'subKanban': node = !card!.isPlanTemplate && renderSubKanban(); break;
        case 'checklist': node = renderChecklist(); break;
        case 'files': node = renderFiles(); break;
        case 'dates': node = renderDates(tab); break;
        case 'cover': node = renderCover(); break;
        case 'priority-status-color': node = renderPriorityStatusColor(tab); break;
        case 'labels': node = renderLabels(); break;
        case 'schedules': node = renderSchedules(); break;
      }
      rows.push(<Fragment key={row}>{node}</Fragment>);
    }
    return <>{rows}</>;
  }

  const isPanel = variant === 'panel';

  const content = (
    <div
      className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
      tabIndex={isPanel ? -1 : undefined}
      onKeyDown={isPanel ? (e) => {
        // Esc fecha o painel, mas não enquanto o foco está num campo de texto (Esc ali é de quem está editando)
        const t = e.target as HTMLElement;
        const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
        if (e.key === 'Escape' && !typing && !e.defaultPrevented) onClose();
      } : undefined}
      style={isPanel
        ? { padding: 12, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', outline: 'none' }
        : { padding: 16, maxWidth: '92vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
    >
      <div className="border-b border-neutral-200 dark:border-neutral-700" style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {(['details', 'meta', 'config'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            title={tab === 'config' ? 'Configurar campos do card' : undefined}
            className={
              activeTab === tab
                ? 'border-0 border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                : 'border-0 border-b-2 border-transparent text-neutral-500 dark:text-neutral-400'
            }
            style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, background: 'none', cursor: 'pointer' }}
          >
            {tab === 'details' ? 'Detalhes' : tab === 'meta' ? 'Propriedades' : '⚙'}
          </button>
        ))}
        {isPanel && (
          <button
            onClick={onClose}
            title="Fechar painel"
            aria-label="Fechar painel"
            className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 bg-transparent border-0 cursor-pointer"
            style={{ marginLeft: 'auto', fontSize: 14, padding: '0 8px' }}
          >
            ✕
          </button>
        )}
      </div>

      <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activeTab === 'details' && (
          <>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              className="bg-transparent text-neutral-900 dark:text-neutral-100"
              style={{ fontSize: 18, fontWeight: 600, border: 'none', outline: 'none', padding: '4px 0' }}
            />
            {renderPlanBanner()}
            {renderTabFields('details')}
          </>
        )}

        {activeTab === 'meta' && (
          <>
            {renderTabFields('properties')}

            <div>
              <label className={FAINT_CLS} style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Responsável, comentários e anexos</label>
              <p className={FAINT_CLS} style={{ fontSize: 12, margin: 0, fontStyle: 'italic' }}>Em breve.</p>
            </div>
          </>
        )}

        {activeTab === 'config' && (
          <>
            <p className={FAINT_CLS} style={{ fontSize: 12, margin: 0 }}>
              Vale pra todos os cards deste kanban — escolha em qual aba cada campo aparece, a ordem dentro da aba (▲ ▼), ou oculte o que não usa.
            </p>
            {(['details', 'properties'] as CardFieldTab[]).map((tabKey) => {
              const inTab = fields.filter((f) => f.tab === tabKey);
              return (
                <div key={tabKey} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className={FAINT_CLS} style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {tabKey === 'details' ? 'Aba Detalhes' : 'Aba Propriedades'}
                  </div>
                  {inTab.length === 0 && <div className={FAINT_CLS} style={{ fontSize: 12, fontStyle: 'italic' }}>Nenhum campo nesta aba.</div>}
                  {inTab.map((f, idx) => (
                    <div
                      key={f.key}
                      className="border border-neutral-200 dark:border-neutral-700"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                        borderRadius: 6, opacity: f.visible ? 1 : 0.5,
                      }}
                    >
                      <MoveButtons
                        onUp={idx > 0 ? () => moveField(f.key, -1) : undefined}
                        onDown={idx < inTab.length - 1 ? () => moveField(f.key, 1) : undefined}
                      />
                      <span className="text-neutral-900 dark:text-neutral-100" style={{ flex: 1, fontSize: 13 }}>{CARD_FIELD_LABELS[f.key]}</span>
                      <button
                        onClick={() => updateField(f.key, { tab: f.tab === 'details' ? 'properties' : 'details' })}
                        title="Mover pra outra aba (vai pro fim da lista dela)"
                        className="border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400"
                        style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {f.tab === 'details' ? 'Detalhes →' : '← Propriedades'}
                      </button>
                      <button
                        onClick={() => updateField(f.key, { visible: !f.visible })}
                        title={f.visible ? 'Ocultar campo' : 'Mostrar campo'}
                        className={f.visible ? 'bg-blue-600 text-white' : 'bg-neutral-300 dark:bg-neutral-600 text-white'}
                        style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {f.visible ? 'Visível' : 'Oculto'}
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}

            <p className={FAINT_CLS} style={{ fontSize: 12, margin: '12px 0 0' }}>
              Aparência do card dentro do quadro — o que mostra ali sem precisar abrir o card, na ordem desta lista (▲ ▼). Os selos do título e os itens
              de status/etiquetas/prazo seguem a ordem entre si; a linha de status/etiquetas/prazo fica onde estiver o primeiro deles. Notas e o total do
              cronômetro ficam sempre nos cantos.
            </p>
            {visualFields.map((f, idx) => (
              <div
                key={f.key}
                className="border border-neutral-200 dark:border-neutral-700"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  borderRadius: 6, opacity: f.visible ? 1 : 0.5,
                }}
              >
                <MoveButtons
                  onUp={idx > 0 ? () => moveVisualField(f.key, -1) : undefined}
                  onDown={idx < visualFields.length - 1 ? () => moveVisualField(f.key, 1) : undefined}
                />
                <span className="text-neutral-900 dark:text-neutral-100" style={{ flex: 1, fontSize: 13 }}>{CARD_VISUAL_FIELD_LABELS[f.key]}</span>
                <button
                  onClick={() => updateVisualField(f.key, !f.visible)}
                  title={f.visible ? 'Ocultar no card' : 'Mostrar no card'}
                  className={f.visible ? 'bg-blue-600 text-white' : 'bg-neutral-300 dark:bg-neutral-600 text-white'}
                  style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {f.visible ? 'Visível' : 'Oculto'}
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="border-t border-neutral-200 dark:border-neutral-700" style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="danger" onClick={() => onRequestDelete(card.id, card.title)}>Excluir</Button>
          <Button variant="secondary" onClick={() => onDuplicate(card.id)}>Duplicar</Button>
          <Button variant="secondary" onClick={() => onArchive(card.id, !card.archived)}>
            {card.archived ? 'Desarquivar' : 'Arquivar'}
          </Button>
        </div>
        <Button variant="secondary" onClick={onClose}>Fechar</Button>
      </div>
    </div>
  );

  if (isPanel) return content;

  return (
    <Modal open={isOpen} onClose={onClose} title="Detalhes do card">
      {content}
    </Modal>
  );
}

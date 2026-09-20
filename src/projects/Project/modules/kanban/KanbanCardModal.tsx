import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import { createKanban, getKanbanById } from '@/lib/api/kanban/kanbans';
import { PRIORITY_LABELS, STATUS_LABELS, STATUS_COLORS, CARD_FIELD_LABELS, mergeCardFieldConfig, CARD_VISUAL_FIELD_LABELS, mergeCardVisualConfig } from '@/types/kanban.types';
import type { KanbanCard, TaskPriority, TaskStatus, Kanban, KanbanColumn, KanbanCardGroup, CardFieldConfig, CardFieldKey, CardFieldTab, CardVisualFieldConfig, CardVisualFieldKey } from '@/types/kanban.types';
import KanbanBoard from './KanbanBoard';
import MarkdownField from '@/components/ui/MarkdownField';
import ChecklistSection from '@/Kanban/ChecklistSection';
import ImageUploadField from '@/components/ImageUploadField';
import CardFilesSection from '@/Kanban/components/Cardfilessection';

type Tab = 'details' | 'meta' | 'config';

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
}

export default function KanbanCardModal({
  isOpen, onClose, card, columns, groups, cardFieldConfig, onUpdateCardFieldConfig, cardVisualConfig, onUpdateCardVisualConfig, onUpdate, onDuplicate, onArchive, onRequestDelete,
}: KanbanCardModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [labelInput, setLabelInput] = useState('');

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
    onUpdateCardFieldConfig(fields.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function updateVisualField(key: CardVisualFieldKey, visible: boolean) {
    onUpdateCardVisualConfig(visualFields.map((f) => (f.key === key ? { ...f, visible } : f)));
  }

  useEffect(() => {
    if (isOpen && card) {
      setTitle(card.title);
      setDescription(card.description ?? '');
      setActiveTab('details');
    }
  }, [isOpen, card]);

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

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isOpen]);

  if (!card) return null;

  function saveTitle() {
    if (title.trim() && title !== card!.title) onUpdate(card!.id, { title: title.trim() });
  }

  function saveDescription() {
    if (description !== (card!.description ?? '')) onUpdate(card!.id, { description });
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
        style={{
          display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 10px',
          backgroundColor: '#eef2ff', borderRadius: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#4338ca', flex: 1 }}>
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
                style={{
                  width: 22, height: 22, fontSize: 10, borderRadius: '50%', cursor: 'pointer',
                  border: '1px solid #c7d2fe',
                  backgroundColor: card!.planWeekdays.includes(day) ? '#4338ca' : '#fff',
                  color: card!.planWeekdays.includes(day) ? '#fff' : '#4338ca',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#4338ca' }}>
            Vezes por dia:
            <input
              type="number"
              min={1}
              max={20}
              value={card!.planTimesPerDay}
              onChange={(e) => onUpdate(card!.id, { planTimesPerDay: Math.max(1, Number(e.target.value) || 1) })}
              style={{ width: 48, padding: 4, fontSize: 11 }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: '#4338ca', display: 'block', marginBottom: 3 }}>
              Coluna onde o card materializado nasce
            </label>
            <select
              value={card!.planTargetColumnId ?? ''}
              onChange={(e) => onUpdate(card!.id, { planTargetColumnId: e.target.value || null, planTargetGroupId: null })}
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
              <label style={{ fontSize: 11, color: '#4338ca', display: 'block', marginBottom: 3 }}>
                Grupo/subgrupo (opcional)
              </label>
              <select
                value={card!.planTargetGroupId ?? ''}
                onChange={(e) => onUpdate(card!.id, { planTargetGroupId: e.target.value || null })}
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
        style={{
          alignSelf: 'flex-start', fontSize: 11, padding: '6px 10px', borderRadius: 6,
          border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca',
          cursor: 'pointer', fontWeight: 600,
        }}
      >
        🔁 Transformar em card de plano
      </button>
    );
  }

  function renderDescription() {
    return (
      <div key="description">
        <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Descrição (Markdown)</label>
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
      <div key="subKanban" style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>Sub-kanban</label>
        {loadingSubKanban && <p style={{ fontSize: 12, color: '#999' }}>Verificando...</p>}

        {!loadingSubKanban && subKanban && (
          <div style={{ border: '1px solid #eee', borderRadius: 6, padding: 8, backgroundColor: '#fafafa' }}>
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
      <div key="checklist" style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>
          Lista de tarefas{card!.isPlanTemplate ? ' (copiada pra cada ocorrência materializada)' : ''}
        </label>
        <ChecklistSection cardId={card!.id} />
      </div>
    );
  }

  function renderFiles() {
    return <CardFilesSection key="files" cardId={card!.id} />;
  }

  function renderDates(tab: CardFieldTab) {
    const showStart = isVisible(tab, 'startDate');
    const showDue = isVisible(tab, 'dueDate');
    if (!showStart && !showDue) return null;
    return (
      <div key="dates" style={{ display: 'flex', gap: 12 }}>
        {showStart && (
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>
              {card!.isPlanTemplate ? 'Início do plano' : 'Data inicial'}
            </label>
            <input
              type="date"
              value={card!.startDate ?? ''}
              onChange={(e) => onUpdate(card!.id, { startDate: e.target.value || null })}
              style={{ width: '100%', padding: 6, fontSize: 13 }}
            />
          </div>
        )}
        {showDue && (
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>
              {card!.isPlanTemplate ? 'Fim do plano' : 'Definir data do card'}
            </label>
            <input
              type="date"
              value={card!.dueDate ?? ''}
              onChange={(e) => onUpdate(card!.id, { dueDate: e.target.value || null })}
              style={{ width: '100%', padding: 6, fontSize: 13 }}
            />
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
        />
        <Button variant="secondary" onClick={handlePickCover}>{card!.coverPath ? 'Trocar capa' : 'Adicionar capa'}</Button>
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
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Prioridade</label>
            <select
              value={card!.priority ?? ''}
              onChange={(e) => onUpdate(card!.id, { priority: (e.target.value || null) as TaskPriority | null })}
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
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Status</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                title={card!.status ? STATUS_LABELS[card!.status] : 'Sem status'}
                style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: card!.status ? STATUS_COLORS[card!.status] : '#e0e0e0',
                }}
              />
              <select
                value={card!.status ?? ''}
                onChange={(e) => onUpdate(card!.id, { status: (e.target.value || null) as TaskStatus | null })}
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
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Cor</label>
            <input
              type="color"
              value={card!.color ?? '#cccccc'}
              onChange={(e) => onUpdate(card!.id, { color: e.target.value })}
              style={{ width: '100%', height: 30, padding: 0, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}
            />
          </div>
        )}
      </div>
    );
  }

  function renderLabels() {
    return (
      <div key="labels">
        <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Etiquetas</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {card!.labels.map((l) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: '#eef2ff', color: '#4338ca', borderRadius: 3, padding: '2px 6px', fontSize: 11 }}>
              {l}
              <button onClick={() => removeLabel(l)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#4338ca', fontSize: 10, padding: 0 }}>✕</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLabel()}
            placeholder="Nova etiqueta..."
            style={{ flex: 1, padding: 6, fontSize: 12 }}
          />
          <Button variant="secondary" onClick={addLabel}>+ Adicionar</Button>
        </div>
      </div>
    );
  }

  /** Renderiza, pra uma aba, todo campo configurado (visível) pra morar nela — nessa ordem fixa. */
  function renderTabFields(tab: CardFieldTab) {
    return (
      <>
        {isVisible(tab, 'convertToPlan') && !card!.isPlanTemplate && renderConvertToPlanButton()}
        {isVisible(tab, 'description') && renderDescription()}
        {isVisible(tab, 'subKanban') && !card!.isPlanTemplate && renderSubKanban()}
        {isVisible(tab, 'checklist') && renderChecklist()}
        {isVisible(tab, 'files') && renderFiles()}
        {renderDates(tab)}
        {isVisible(tab, 'cover') && renderCover()}
        {renderPriorityStatusColor(tab)}
        {isVisible(tab, 'labels') && renderLabels()}
      </>
    );
  }

  return (
    <Modal open={isOpen} onClose={onClose} title="Detalhes do card">
      <div style={{ padding: 16, maxWidth: '92vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e0e0e0', marginBottom: 12 }}>
          {(['details', 'meta', 'config'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              title={tab === 'config' ? 'Configurar campos do card' : undefined}
              style={{
                padding: '8px 14px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none',
                borderBottom: activeTab === tab ? '2px solid #1a73e8' : '2px solid transparent',
                color: activeTab === tab ? '#1a73e8' : '#666', cursor: 'pointer',
              }}
            >
              {tab === 'details' ? 'Detalhes' : tab === 'meta' ? 'Propriedades' : '⚙'}
            </button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeTab === 'details' && (
            <>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
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
                <label style={{ fontSize: 12, fontWeight: 600, color: '#999', display: 'block', marginBottom: 4 }}>Responsável, comentários e anexos</label>
                <p style={{ fontSize: 12, color: '#bbb', margin: 0, fontStyle: 'italic' }}>Em breve.</p>
              </div>
            </>
          )}

          {activeTab === 'config' && (
            <>
              <p style={{ fontSize: 12, color: '#999', margin: 0 }}>
                Vale pra todos os cards deste kanban — escolha em qual aba cada campo aparece, ou oculte o que não usa.
              </p>
              {fields.map((f) => (
                <div
                  key={f.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    border: '1px solid #eee', borderRadius: 6, opacity: f.visible ? 1 : 0.5,
                  }}
                >
                  <span style={{ flex: 1, fontSize: 13 }}>{CARD_FIELD_LABELS[f.key]}</span>
                  <button
                    onClick={() => updateField(f.key, { tab: f.tab === 'details' ? 'properties' : 'details' })}
                    title="Mover pra outra aba"
                    style={{
                      fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid #ddd',
                      background: '#fafafa', cursor: 'pointer', color: '#666', whiteSpace: 'nowrap',
                    }}
                  >
                    {f.tab === 'details' ? 'Detalhes →' : '← Propriedades'}
                  </button>
                  <button
                    onClick={() => updateField(f.key, { visible: !f.visible })}
                    title={f.visible ? 'Ocultar campo' : 'Mostrar campo'}
                    style={{
                      fontSize: 11, padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                      backgroundColor: f.visible ? '#1a73e8' : '#ccc', color: '#fff', whiteSpace: 'nowrap',
                    }}
                  >
                    {f.visible ? 'Visível' : 'Oculto'}
                  </button>
                </div>
              ))}

              <p style={{ fontSize: 12, color: '#999', margin: '12px 0 0' }}>
                Aparência do card dentro do quadro — o que mostra ali sem precisar abrir o card.
              </p>
              {visualFields.map((f) => (
                <div
                  key={f.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    border: '1px solid #eee', borderRadius: 6, opacity: f.visible ? 1 : 0.5,
                  }}
                >
                  <span style={{ flex: 1, fontSize: 13 }}>{CARD_VISUAL_FIELD_LABELS[f.key]}</span>
                  <button
                    onClick={() => updateVisualField(f.key, !f.visible)}
                    title={f.visible ? 'Ocultar no card' : 'Mostrar no card'}
                    style={{
                      fontSize: 11, padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                      backgroundColor: f.visible ? '#1a73e8' : '#ccc', color: '#fff', whiteSpace: 'nowrap',
                    }}
                  >
                    {f.visible ? 'Visível' : 'Oculto'}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12 }}>
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
    </Modal>
  );
}

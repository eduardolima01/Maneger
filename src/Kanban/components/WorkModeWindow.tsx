import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import * as kanbansApi from '@/lib/api/kanban/kanbans';
import { useKanbanBoard } from '@/lib/hooks/useKanbanBoard';
import ChecklistSection from '@/Kanban/ChecklistSection';
import { listenKanbanChanges } from '@/Kanban/utils/kanbanSync';
import { saveWorkModeBox, emitWorkModeState, getWorkModeDark } from '@/Kanban/utils/workMode';
import {
  STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS,
  mergeCardFieldConfig, CARD_FIELD_LABELS,
  type Kanban, type KanbanCard, type TaskStatus, type TaskPriority, type CardFieldKey,
} from '@/types/kanban.types';
import CardFilesSection from '@/Kanban/components/Cardfilessection';
import CardAudio from '@/Kanban/components/CardAudio';

const PREFS_PREFIX = 'kanban-work-mode-prefs:';
interface Prefs { columnId: string; onlyPending: boolean; cardId: string | null }

function readPrefs(kanbanId: string): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_PREFIX + kanbanId) ?? '{}') as Partial<Prefs>;
    return { columnId: typeof p.columnId === 'string' ? p.columnId : '', onlyPending: !!p.onlyPending, cardId: typeof p.cardId === 'string' ? p.cardId : null };
  } catch { return { columnId: '', onlyPending: false, cardId: null }; }
}
function writePrefs(kanbanId: string, prefs: Prefs) {
  try { localStorage.setItem(PREFS_PREFIX + kanbanId, JSON.stringify(prefs)); } catch { /* ignora */ }
}

const FIELD_CLS = 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600 dark:[color-scheme:dark]';
const BTN_CLS = 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700';

function dueText(due: string | null): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(due);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  const text = diff === 0 ? 'hoje' : diff === 1 ? 'amanhã' : diff === -1 ? 'ontem' : `${m[3]}/${m[2]}`;
  return { text, overdue: diff < 0 };
}

/* ------------------------------------------------------------------------------------------------ */
/* Casca: carrega o kanban, aplica o tema e cuida da janela (arrastar, fixar, minimizar, fechar).    */
/* ------------------------------------------------------------------------------------------------ */
export default function WorkModeWindow({ initialKanbanId }: { initialKanbanId: string }) {
  const kanbanId = initialKanbanId; // esta janela é só deste kanban — nunca troca
  const [kanban, setKanban] = useState<Kanban | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinned, setPinned] = useState(true);
  const win = useMemo(() => getCurrentWindow(), []);

  // tema vindo da janela principal (gravado no localStorage ao abrir); sem ele, segue o sistema
  useEffect(() => {
    document.documentElement.classList.toggle('dark', getWorkModeDark());
    document.title = 'Modo trabalho';
  }, []);

  useEffect(() => {
    let alive = true;
    setError(null);
    kanbansApi.getKanbanById(kanbanId)
      .then((k) => { if (!alive) return; if (k) setKanban(k); else setError('Kanban não encontrado.'); })
      .catch((e) => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, [kanbanId]);

  // avisa o quadro que esta janela abriu/fechou (botão do quadro vira "Fechar modo trabalho"), inclusive em Alt+F4
  useEffect(() => {
    emitWorkModeState(kanbanId, true);
    let un: (() => void) | null = null;
    let off = false;
    void win.onCloseRequested(() => { emitWorkModeState(kanbanId, false); }).then((fn) => { if (off) fn(); else un = fn; });
    return () => { off = true; un?.(); };
  }, [win, kanbanId]);

  async function closeSelf() {
    emitWorkModeState(kanbanId, false);
    try { await win.close(); } catch { await win.destroy(); }
  }

  // lembra tamanho/posição (px lógicos)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const unlisten: Array<() => void> = [];
    let off = false;
    const save = () => {
      if (t) clearTimeout(t);
      t = setTimeout(async () => {
        try {
          const [pos, size] = [await win.outerPosition(), await win.outerSize()];
          const dpr = window.devicePixelRatio || 1;
          saveWorkModeBox(kanbanId, { x: Math.round(pos.x / dpr), y: Math.round(pos.y / dpr), w: Math.round(size.width / dpr), h: Math.round(size.height / dpr) });
        } catch { /* ignora */ }
      }, 400);
    };
    void win.onMoved(save).then((fn) => { if (off) fn(); else unlisten.push(fn); });
    void win.onResized(save).then((fn) => { if (off) fn(); else unlisten.push(fn); });
    return () => { off = true; if (t) clearTimeout(t); unlisten.forEach((fn) => fn()); };
  }, [win, kanbanId]);

  async function togglePin() {
    const next = !pinned;
    try { await win.setAlwaysOnTop(next); setPinned(next); } catch (e) { console.error(e); }
  }

  const headerBtn = 'w-7 h-7 flex items-center justify-center rounded text-sm cursor-pointer border-none bg-transparent ' + BTN_CLS;

  return (
    <div className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div
        data-tauri-drag-region
        className="bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700"
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px 4px 10px', flexShrink: 0, userSelect: 'none' }}
      >
        <span data-tauri-drag-region style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          🖥 {kanban?.name ?? 'Modo trabalho'}
        </span>
        <button type="button" className={headerBtn} onClick={togglePin} title={pinned ? 'Sempre por cima: ligado (clique para soltar)' : 'Sempre por cima: desligado (clique para fixar)'} style={{ opacity: pinned ? 1 : 0.45 }}>📌</button>
        <button type="button" className={headerBtn} onClick={() => void win.minimize()} title="Minimizar">–</button>
        <button type="button" className={headerBtn} onClick={() => void closeSelf()} title="Fechar o modo trabalho">✕</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {error && <p className="text-red-600 dark:text-red-400" style={{ fontSize: 13, padding: 12, margin: 0 }}>{error}</p>}
        {!error && !kanban && <p className="text-neutral-500" style={{ fontSize: 13, padding: 12, margin: 0 }}>Carregando…</p>}
        {kanban && <WorkModeBody key={kanban.id} kanban={kanban} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Corpo: lista compacta por coluna/grupo → detalhe do card com abas Checklist / Detalhes / Notas.   */
/* ------------------------------------------------------------------------------------------------ */
function WorkModeBody({ kanban }: { kanban: Kanban }) {
  const board = useKanbanBoard(kanban);
  const { reload } = board;
  const [prefs, setPrefs] = useState<Prefs>(() => readPrefs(kanban.id));
  const [search, setSearch] = useState('');
  const [syncNonce, setSyncNonce] = useState(0); // muda quando a janela principal altera dados: remonta a checklist aberta

  function updatePrefs(patch: Partial<Prefs>) {
    setPrefs((prev) => { const next = { ...prev, ...patch }; writePrefs(kanban.id, next); return next; });
  }

  // outra janela gravou: recarrega (sem piscar "carregando")
  useEffect(() => listenKanbanChanges(() => { void reload(); setSyncNonce((n) => n + 1); }), [reload]);

  const columns = useMemo(() => [...board.columns].filter((c) => c.visible !== false).sort((a, b) => a.position - b.position), [board.columns]);
  const groupById = useMemo(() => new Map(board.groups.map((g) => [g.id, g])), [board.groups]);

  /** "Grupo › Subgrupo" de um card e a coluna dele (que, num grupo, vem do grupo). */
  const locate = useCallback((card: KanbanCard): { columnId: string | null; path: string } => {
    if (!card.cardGroupId) return { columnId: card.columnId, path: '' };
    const names: string[] = [];
    let g = groupById.get(card.cardGroupId);
    const columnId = g?.columnId ?? null;
    let guard = 0;
    while (g && guard++ < 20) { names.unshift(g.name); g = g.parentGroupId ? groupById.get(g.parentGroupId) : undefined; }
    return { columnId, path: names.join(' › ') };
  }, [groupById]);

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = board.cards
      .filter((c) => !c.isPlanTemplate && !c.archived)
      .filter((c) => !prefs.onlyPending || c.status !== 'feito')
      .filter((c) => !q || c.title.toLowerCase().includes(q));
    return columns
      .filter((col) => !prefs.columnId || col.id === prefs.columnId)
      .map((col) => {
        const cards = list
          .map((c) => ({ card: c, loc: locate(c) }))
          .filter((x) => x.loc.columnId === col.id)
          .sort((a, b) => a.loc.path.localeCompare(b.loc.path) || a.card.position - b.card.position);
        return { col, cards };
      })
      .filter((s) => s.cards.length > 0);
  }, [board.cards, columns, locate, prefs.columnId, prefs.onlyPending, search]);

  /** Campos visíveis (na ordem configurada do kanban) viram as abas do card. Título é sempre o cabeçalho. */
  const fieldKeys = useMemo(
    () => mergeCardFieldConfig(kanban.cardFieldConfig).filter((f) => f.visible && f.key !== 'convertToPlan' && f.key !== 'subKanban' && f.key !== 'cover').map((f) => f.key),
    [kanban.cardFieldConfig],
  );

  const openCard = prefs.cardId ? board.cards.find((c) => c.id === prefs.cardId) ?? null : null;

  if (openCard) {
    return (
      <CardDetail
        key={openCard.id}
        card={openCard}
        fields={fieldKeys}
        syncNonce={syncNonce}
        onBack={() => updatePrefs({ cardId: null })}
        onUpdate={(input) => board.updateCard(openCard.id, input)}
      />
    );
  }

  return (
    <>
      <div className="border-b border-neutral-200 dark:border-neutral-700" style={{ display: 'flex', gap: 6, padding: 8, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <select value={prefs.columnId} onChange={(e) => updatePrefs({ columnId: e.target.value })} className={FIELD_CLS} style={{ fontSize: 12, padding: '3px 4px', borderRadius: 4, maxWidth: 130 }}>
          <option value="">Todas as colunas</option>
          {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className={FIELD_CLS} style={{ flex: 1, minWidth: 70, fontSize: 12, padding: '3px 6px', borderRadius: 4 }} />
        <label style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap', cursor: 'pointer' }}>
          <input type="checkbox" checked={prefs.onlyPending} onChange={(e) => updatePrefs({ onlyPending: e.target.checked })} /> só pendentes
        </label>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 6px 10px' }}>
        {board.loading && board.cards.length === 0 && <p className="text-neutral-500" style={{ fontSize: 12, padding: 8 }}>Carregando…</p>}
        {!board.loading && sections.length === 0 && <p className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 12, textAlign: 'center', padding: 20 }}>Nenhum card para mostrar.</p>}
        {sections.map(({ col, cards }) => (
          <section key={col.id} style={{ marginTop: 8 }}>
            <h3 className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', margin: '0 2px 3px' }}>{col.name} · {cards.length}</h3>
            {cards.map(({ card, loc }) => {
              const prog = board.checklistProgress[card.id];
              const due = dueText(card.dueDate);
              return (
                <div
                  key={card.id}
                  onClick={() => updatePrefs({ cardId: card.id })}
                  className="hover:bg-neutral-100 dark:hover:bg-neutral-700"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px', borderRadius: 5, cursor: 'pointer', borderLeft: card.color ? `3px solid ${card.color}` : '3px solid transparent' }}
                >
                  <span title={card.status ? STATUS_LABELS[card.status] : 'Sem status'} style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, backgroundColor: card.status ? STATUS_COLORS[card.status] : 'transparent', border: card.status ? 'none' : '1px solid #999' }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: card.status === 'feito' ? 'line-through' : undefined, opacity: card.status === 'feito' ? 0.6 : 1 }}>{card.title}</span>
                    {loc.path && <span className="text-neutral-400 dark:text-neutral-500" style={{ display: 'block', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.path}</span>}
                  </span>
                  {prog && prog.total > 0 && <span className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 10, flexShrink: 0 }}>✓ {prog.done}/{prog.total}</span>}
                  {prog && prog.total === 0 && (prog.simpleCount ?? 0) > 0 && <span className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 10, flexShrink: 0 }}>☰ {prog.simpleCount}</span>}
                  {due && <span className={due.overdue && card.status !== 'feito' ? 'text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-neutral-400'} style={{ fontSize: 10, flexShrink: 0 }}>{due.text}</span>}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Foco no card: some a lista (outros cards e colunas); fica só o card com UMA ABA POR CAMPO.        */
/* ------------------------------------------------------------------------------------------------ */
const TAB_KEY = 'kanban-work-mode-tab';
const TAB_ICONS: Partial<Record<CardFieldKey, string>> = {
  checklist: '✓', description: '📄', notes: '📝', files: '📎', startDate: '▶', dueDate: '📅', status: '●', priority: '⚑', color: '🎨', labels: '🏷', schedules: '🕐',
};

function CardDetail({ card, fields, syncNonce, onBack, onUpdate }: {
  card: KanbanCard;
  fields: CardFieldKey[];
  syncNonce: number;
  onBack: () => void;
  onUpdate: (input: Parameters<ReturnType<typeof useKanbanBoard>['updateCard']>[1]) => unknown;
}) {
  const [tab, setTab] = useState<CardFieldKey>(() => (localStorage.getItem(TAB_KEY) as CardFieldKey) || 'checklist');
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? '');
  const [notes, setNotes] = useState(card.notes ?? '');
  const [labelInput, setLabelInput] = useState('');
  const [schTime, setSchTime] = useState('09:00');
  const [schTitle, setSchTitle] = useState('');
  const editingRef = useRef<string | null>(null);
  const active: CardFieldKey = fields.includes(tab) ? tab : (fields[0] ?? 'checklist');

  useEffect(() => { if (editingRef.current !== 'title') setTitle(card.title); }, [card.title]);
  useEffect(() => { if (editingRef.current !== 'description') setDescription(card.description ?? ''); }, [card.description]);
  useEffect(() => { if (editingRef.current !== 'notes') setNotes(card.notes ?? ''); }, [card.notes]);

  function pickTab(t: CardFieldKey) { setTab(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* ignora */ } }

  function commit(field: 'title' | 'description' | 'notes', value: string) {
    editingRef.current = null;
    if (field === 'title') {
      const v = value.trim();
      if (!v) { setTitle(card.title); return; }
      if (v !== card.title) onUpdate({ title: v });
      return;
    }
    const v = value.trim() === '' ? null : value;
    if (v !== (field === 'description' ? card.description : card.notes)) onUpdate({ [field]: v });
  }

  function addLabel() {
    const v = labelInput.trim();
    if (!v || card.labels.includes(v)) return;
    onUpdate({ labels: [...card.labels, v] });
    setLabelInput('');
  }
  function addSchedule() {
    if (!/^\d{2}:\d{2}$/.test(schTime)) return;
    onUpdate({ schedules: [...(card.schedules ?? []), { id: crypto.randomUUID(), time: schTime, title: schTitle.trim() }].sort((a, b) => a.time.localeCompare(b.time)) });
    setSchTitle('');
  }

  const labelCls = 'text-neutral-500 dark:text-neutral-400';
  const sel = { width: '100%', padding: '4px 6px', borderRadius: 4, fontSize: 13 } as const;
  const dateField = (key: 'startDate' | 'dueDate', text: string) => (
    <label style={{ display: 'block', fontSize: 12 }}><span className={labelCls}>{text}</span>
      <input type="date" value={card[key]?.slice(0, 10) ?? ''} onChange={(e) => onUpdate({ [key]: e.target.value || null })} className={FIELD_CLS} style={{ ...sel, marginTop: 4 }} />
      {card[key] && <button type="button" onClick={() => onUpdate({ [key]: null })} className={BTN_CLS} style={{ marginTop: 6, fontSize: 11, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4, padding: '2px 6px' }}>limpar</button>}
    </label>
  );

  function renderTab() {
    switch (active) {
      case 'checklist': return <ChecklistSection key={`${card.id}:${syncNonce}`} cardId={card.id} />;
      case 'description': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%' }}>
        <CardAudio cardId={card.id} field="description" compact />
        <textarea value={description} onFocus={() => { editingRef.current = 'description'; }} onChange={(e) => setDescription(e.target.value)} onBlur={() => commit('description', description)}
          placeholder="Descrição do card…" className={FIELD_CLS} style={{ width: '100%', minHeight: 220, flex: 1, padding: 8, borderRadius: 4, fontSize: 13, resize: 'none', boxSizing: 'border-box' }} />
        </div>
      );
      case 'notes': return (
        <textarea value={notes} onFocus={() => { editingRef.current = 'notes'; }} onChange={(e) => setNotes(e.target.value)} onBlur={() => commit('notes', notes)}
          placeholder="Nota rápida deste card…" className={FIELD_CLS} style={{ width: '100%', minHeight: 220, height: '100%', padding: 8, borderRadius: 4, fontSize: 13, resize: 'none', boxSizing: 'border-box' }} />
      );
      case 'files': return <CardFilesSection key={`${card.id}:${syncNonce}`} cardId={card.id} onSetCover={(path) => onUpdate({ coverPath: path })} />;
      case 'startDate': return dateField('startDate', 'Data inicial');
      case 'dueDate': return dateField('dueDate', 'Prazo');
      case 'status': return (
        <select value={card.status ?? ''} onChange={(e) => onUpdate({ status: e.target.value === '' ? null : (e.target.value as TaskStatus) })} className={FIELD_CLS} style={sel}>
          <option value="">Sem status</option>
          {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      );
      case 'priority': return (
        <select value={card.priority ?? ''} onChange={(e) => onUpdate({ priority: e.target.value === '' ? null : (e.target.value as TaskPriority) })} className={FIELD_CLS} style={sel}>
          <option value="">Nenhuma</option>
          {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </select>
      );
      case 'color': return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="color" value={card.color ?? '#3b82f6'} onChange={(e) => onUpdate({ color: e.target.value })} style={{ width: 44, height: 30, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
          <span className={labelCls} style={{ fontSize: 12 }}>{card.color ?? 'sem cor'}</span>
          {card.color && <button type="button" onClick={() => onUpdate({ color: null })} className={BTN_CLS} style={{ fontSize: 11, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4, padding: '2px 6px' }}>remover</button>}
        </div>
      );
      case 'labels': return (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {card.labels.length === 0 && <span className={labelCls} style={{ fontSize: 12 }}>Sem etiquetas.</span>}
            {card.labels.map((l) => {
              const [name, color] = l.split('::');
              return (
                <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '1px 6px', borderRadius: 8, background: color || '#6366f1', color: '#fff' }}>
                  {name}
                  <button type="button" onClick={() => onUpdate({ labels: card.labels.filter((x) => x !== l) })} style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 10, padding: 0 }}>✕</button>
                </span>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={labelInput} onChange={(e) => setLabelInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLabel()} placeholder="Nova etiqueta…" className={FIELD_CLS} style={{ flex: 1, minWidth: 0, padding: '4px 6px', borderRadius: 4, fontSize: 12 }} />
            <button type="button" onClick={addLabel} className={BTN_CLS} style={{ border: '1px solid #8886', background: 'none', cursor: 'pointer', borderRadius: 4, fontSize: 12, padding: '0 8px' }}>+</button>
          </div>
        </div>
      );
      case 'schedules': return (
        <div>
          {(card.schedules ?? []).length === 0 && <p className={labelCls} style={{ fontSize: 12, margin: '0 0 8px' }}>Sem horários.</p>}
          {(card.schedules ?? []).map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 4 }}>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{s.time}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
              <button type="button" onClick={() => onUpdate({ schedules: (card.schedules ?? []).filter((x) => x.id !== s.id) })} className={BTN_CLS} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, borderRadius: 4 }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input type="time" value={schTime} onChange={(e) => setSchTime(e.target.value)} className={FIELD_CLS} style={{ padding: '3px 4px', borderRadius: 4, fontSize: 12 }} />
            <input value={schTitle} onChange={(e) => setSchTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSchedule()} placeholder="Título…" className={FIELD_CLS} style={{ flex: 1, minWidth: 0, padding: '3px 6px', borderRadius: 4, fontSize: 12 }} />
            <button type="button" onClick={addSchedule} className={BTN_CLS} style={{ border: '1px solid #8886', background: 'none', cursor: 'pointer', borderRadius: 4, fontSize: 12, padding: '0 8px' }}>+</button>
          </div>
        </div>
      );
      default: return null;
    }
  }

  return (
    <>
      <div className="border-b border-neutral-200 dark:border-neutral-700" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', flexShrink: 0 }}>
        <button type="button" onClick={onBack} title="Voltar para a lista" className={BTN_CLS} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, borderRadius: 4, padding: '2px 6px' }}>←</button>
        <input
          value={title}
          onFocus={() => { editingRef.current = 'title'; }}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => commit('title', title)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setTitle(card.title); editingRef.current = null; (e.target as HTMLInputElement).blur(); } }}
          className={FIELD_CLS}
          style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, padding: '3px 6px', borderRadius: 4 }}
        />
        <CardAudio cardId={card.id} field="title" compact />
      </div>
      <div className="border-b border-neutral-200 dark:border-neutral-700" style={{ display: 'flex', flexShrink: 0, overflowX: 'auto' }}>
        {fields.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => pickTab(k)}
            title={CARD_FIELD_LABELS[k]}
            className={active === k ? 'border-b-2 border-blue-600 dark:border-blue-400 text-neutral-900 dark:text-neutral-100' : 'border-b-2 border-transparent text-neutral-500 dark:text-neutral-400'}
            style={{ fontSize: 12, fontWeight: 600, padding: '6px 8px', whiteSpace: 'nowrap', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', flexShrink: 0 }}
          >{TAB_ICONS[k] ?? ''} {CARD_FIELD_LABELS[k]}</button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}>{renderTab()}</div>
    </>
  );
}

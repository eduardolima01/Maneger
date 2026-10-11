import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Está na visão de árvore? (a navegação por WASD só existe nela) */
  inTree: boolean;
}

interface ShortcutGroup {
  title: string;
  hint?: string;
  items: Array<{ keys: string[]; text: string }>;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Card',
    hint: 'Valem pro card sob o mouse (na árvore, também pro item marcado pelo teclado). Com vários cards selecionados, agem em todos.',
    items: [
      { keys: ['T'], text: 'Status (no menu: W/S navegam, D escolhe, A ou Esc fecham; ou a letra: P pendente · Z fazer · N fazendo · R revisão · F feito · X sem status)' },
      { keys: ['P'], text: 'Prazo' },
      { keys: ['K'], text: 'Cor' },
      { keys: ['L'], text: 'Etiquetas' },
      { keys: ['M'], text: 'Mover para…' },
      { keys: ['E'], text: 'Editar o título' },
      { keys: ['Q'], text: 'Excluir (pede confirmação)' },
      { keys: ['Alt', 'S'], text: 'Marcar / desmarcar o card' },
      { keys: ['Ctrl', 'X'], text: 'Recortar o card (ou os marcados); aparece esmaecido' },
      { keys: ['Ctrl', 'V'], text: 'Colar os recortados no grupo/coluna sob o mouse (Esc cancela)' },
    ],
  },
  {
    title: 'Grupos e colunas',
    hint: 'Valem pro grupo/subgrupo (ou coluna) sob o mouse.',
    items: [
      { keys: ['C'], text: 'Novo card' },
      { keys: ['G'], text: 'Novo subgrupo (ou novo grupo, na coluna)' },
      { keys: ['Espaço'], text: 'Expandir / recolher o grupo ou subgrupo' },
    ],
  },
  {
    title: 'Navegar pelo teclado (só na árvore)',
    hint: 'Mexer o mouse volta a valer o item sob o ponteiro.',
    items: [
      { keys: ['W'], text: 'Subir pro item de cima' },
      { keys: ['S'], text: 'Descer pro item de baixo' },
      { keys: ['D'], text: 'Abrir o card no painel lateral · expandir o grupo · entrar no grupo' },
      { keys: ['A'], text: 'Recolher o grupo · voltar pro grupo/coluna de cima' },
    ],
  },
  {
    title: 'Seleção e outros',
    items: [
      { keys: ['R'], text: 'Desfazer a última alteração do kanban' },
      { keys: ['Alt', 'R'], text: 'Refazer a alteração desfeita (também Ctrl+Z / Ctrl+Shift+Z)' },
      { keys: ['H'], text: 'Abrir o histórico de alterações' },
      { keys: ['Ctrl', 'clique'], text: 'Marcar / desmarcar card (na árvore e no quadro)' },
      { keys: ['Shift', 'clique'], text: 'Marcar um intervalo (árvore)' },
      { keys: ['Esc'], text: 'Limpar a seleção' },
      { keys: ['Ctrl', 'roda'], text: 'Zoom da lista (árvore)' },
      { keys: ['Arrastar ▬'], text: 'Barra no fim de um grupo da árvore: aumenta/diminui a área (duplo clique restaura)' },
      { keys: ['Ctrl'], text: 'Tocar e soltar sobre um card do quadro abre o card' },
      { keys: ['Ctrl', 'V'], text: 'Sem recorte pendente: colar imagem de capa sobre um card do quadro' },
      { keys: ['?'], text: 'Abrir / fechar esta ajuda' },
    ],
  },
];

const KEY_CLS = 'bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-500';

export default function ShortcutsHelpModal({ isOpen, onClose, inTree }: ShortcutsHelpModalProps) {
  return (
    <Modal open={isOpen} onClose={onClose} title="⌨ Atalhos de teclado">
      <div className="text-neutral-900 dark:text-neutral-100" style={{ padding: 16, width: 520, maxWidth: '92vw', maxHeight: '75vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {SHORTCUT_GROUPS.map((group) => {
          const treeOnly = group.title.includes('só na árvore');
          return (
            <section key={group.title} style={{ opacity: treeOnly && !inTree ? 0.55 : 1 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 2px' }}>{group.title}</h3>
              {group.hint && <p className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, margin: '0 0 6px' }}>{group.hint}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {group.items.map((item) => (
                  <div key={item.keys.join('+') + item.text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <span style={{ minWidth: 112, display: 'inline-flex', gap: 4, flexShrink: 0 }}>
                      {item.keys.map((k, i) => (
                        <kbd key={i} className={KEY_CLS} style={{ fontSize: 11, fontFamily: 'inherit', padding: '1px 7px', borderRadius: 4, whiteSpace: 'nowrap' }}>{k}</kbd>
                      ))}
                    </span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        <p className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, margin: 0 }}>
          Os atalhos de letra não funcionam enquanto você digita num campo, nem com Ctrl/Alt/Cmd apertados.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}
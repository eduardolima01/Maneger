import { useState } from 'react';
import Button from '@/components/layout/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import TemplateEditorModal from './TemplateEditorModal';
import { useTemplates } from '@/lib/hooks/useTemplates';
import { useLogGroups } from '@/lib/hooks/useLogGroups';
import LogGroupContainer from './LogGroupContainer';

interface LogsSectionProps {
  projectId: string;
}

// Cada grupo precisa do próprio hook de logs — não dá pra chamar useLogs dentro
// de um .map() (regra de hooks), então isolamos num subcomponente por grupo.

export default function LogsSection({ projectId }: LogsSectionProps) {
  const { templates, create: createTemplate, remove: removeTemplate, addField, updateField, removeField, reorderFields } = useTemplates(projectId);
  const { groups, create: createGroup, rename: renameGroup, remove: removeGroup } = useLogGroups(projectId);

  const [groupSearch, setGroupSearch] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupTemplateId, setNewGroupTemplateId] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<{ id: string; name: string } | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [templateDeleteError, setTemplateDeleteError] = useState<string | null>(null);

  const filteredGroups = groups.filter((g) => g.name.toLowerCase().includes(groupSearch.toLowerCase()));
  const editingTemplate = templates.find((t) => t.id === editingTemplateId) ?? null;

  async function handleCreateTemplate() {
    if (!newTemplateName.trim()) return;
    const id = await createTemplate(newTemplateName.trim());
    setNewTemplateName('');
    setEditingTemplateId(id); // abre direto o editor de campos do template recém-criado
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim() || !newGroupTemplateId) return;
    await createGroup(newGroupName.trim(), newGroupTemplateId);
    setNewGroupName('');
  }

  async function handleConfirmDeleteTemplate() {
    if (!templateToDelete) return;
    const result = await removeTemplate(templateToDelete.id);
    if (!result.ok) {
      setTemplateDeleteError(result.reason);
    }
    setTemplateToDelete(null);
  }

  return (
    <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3 style={{ margin: 0 }}>Logs</h3>

      <div style={{ border: '1px solid #eee', borderRadius: 6, padding: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>Templates</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {templates.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid #ddd', borderRadius: 4, padding: '4px 8px', fontSize: 12 }}>
              <span onClick={() => setEditingTemplateId(t.id)} style={{ cursor: 'pointer' }}>{t.name} ({t.fields.length})</span>
              <button onClick={() => setTemplateToDelete({ id: t.id, name: t.name })} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c62828' }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateTemplate()} placeholder="Nome do novo template (ex: Academia)" style={{ flex: 1, padding: 6, fontSize: 13 }} />
          <Button variant="secondary" onClick={handleCreateTemplate}>+ Template</Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} placeholder="Buscar grupo de logs..." style={{ flex: 1, padding: 8, fontSize: 14 }} />
        <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Nome do novo grupo..." style={{ flex: 1, padding: 8, fontSize: 14 }} />
        <select value={newGroupTemplateId} onChange={(e) => setNewGroupTemplateId(e.target.value)} style={{ padding: 8, fontSize: 13 }}>
          <option value="">Template...</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <Button variant="primary" onClick={handleCreateGroup}>+ Grupo</Button>
      </div>

      {filteredGroups.map((group) => {
        const template = templates.find((t) => t.id === group.templateId);
        if (!template) return null; // não deveria acontecer (RESTRICT no schema), guarda defensiva
        return (
          <LogGroupContainer
            key={group.id}
            group={group}
            template={template}
            onRenameGroup={(name) => renameGroup(group.id, name)}
            onRequestDeleteGroup={() => setGroupToDelete({ id: group.id, name: group.name })}
          />
        );
      })}

      {editingTemplate && (
        <TemplateEditorModal
          isOpen={!!editingTemplate}
          onClose={() => setEditingTemplateId(null)}
          template={editingTemplate}
          onAddField={(input) => addField({ templateId: editingTemplate.id, ...input })}
          onUpdateField={updateField}
          onRemoveField={removeField}
          onReorderFields={(orderedIds) => reorderFields(editingTemplate.id, orderedIds)}
        />
      )}

      <ConfirmDialog
        isOpen={groupToDelete !== null}
        title="Excluir grupo?"
        message={`Deseja realmente excluir o grupo "${groupToDelete?.name}"? Todos os logs dentro dele serão apagados junto. Esta ação é permanente e não poderá ser desfeita.`}
        onConfirm={() => { if (groupToDelete) removeGroup(groupToDelete.id); setGroupToDelete(null); }}
        onCancel={() => setGroupToDelete(null)}
      />

      <ConfirmDialog
        isOpen={templateToDelete !== null}
        title="Excluir template?"
        message={`Deseja realmente excluir o template "${templateToDelete?.name}"? Esta ação é permanente e não poderá ser desfeita.`}
        onConfirm={handleConfirmDeleteTemplate}
        onCancel={() => setTemplateToDelete(null)}
      />

      <ConfirmDialog
        isOpen={templateDeleteError !== null}
        title="Não foi possível excluir"
        message={templateDeleteError ?? ''}
        confirmLabel="Entendi"
        onConfirm={() => setTemplateDeleteError(null)}
        onCancel={() => setTemplateDeleteError(null)}
      />
    </div>
  );
}

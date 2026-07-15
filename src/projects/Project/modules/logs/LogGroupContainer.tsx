import { useState } from 'react';
import LogFormModal from './LogFormModal';
import LogGroupCard from './LogGroupCard';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useLogs } from '@/lib/hooks/useLogs';
import type { Template } from '@/types/template.types';
import type { Log, LogGroup, LogQueryOptions } from '@/types/log.types';

interface LogGroupContainerProps {
  group: LogGroup;
  template: Template;
  onRenameGroup: (name: string) => void;
  onRequestDeleteGroup: () => void;
}

export default function LogGroupContainer({ group, template, onRenameGroup, onRequestDeleteGroup }: LogGroupContainerProps) {
  const { logs, totalCount, query, setQuery, create, update, remove, duplicate } = useLogs(group.id, group.templateId);
  const [formOpen, setFormOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<Log | null>(null);
  const [logToDelete, setLogToDelete] = useState<string | null>(null);

  function handleNewLog() {
    setEditingLog(null);
    setFormOpen(true);
  }

  function handleEditLog(log: Log) {
    setEditingLog(log);
    setFormOpen(true);
  }

  async function handleSave(values: Log['values']) {
    if (editingLog) {
      await update(editingLog.id, values);
    } else {
      await create(values);
    }
    setFormOpen(false);
  }

  return (
    <>
      <LogGroupCard
        groupName={group.name}
        template={template}
        logs={logs}
        totalCount={totalCount}
        query={query}
        onQueryChange={setQuery as (q: LogQueryOptions) => void}
        onNewLog={handleNewLog}
        onEditLog={handleEditLog}
        onDuplicateLog={duplicate}
        onRequestDeleteLog={setLogToDelete}
        onRenameGroup={onRenameGroup}
        onRequestDeleteGroup={onRequestDeleteGroup}
      />

      <LogFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        template={template}
        editingLog={editingLog}
        onSave={handleSave}
      />

      <ConfirmDialog
        isOpen={logToDelete !== null}
        title="Excluir log?"
        message="Deseja realmente excluir este log? Esta ação é permanente e não poderá ser desfeita."
        onConfirm={() => { if (logToDelete) remove(logToDelete); setLogToDelete(null); }}
        onCancel={() => setLogToDelete(null)}
      />
    </>
  );
}

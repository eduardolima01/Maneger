import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import * as projectsApi from '@/lib/api/projects';
import { generateId } from '@/lib/utils/uuid';
import type { CreateProjectInput } from '@/types/project.types';
import ProjectColorPicker from '@/Projects/components/ProjectColorPicker';

interface CreateSubprojectModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentProjectId: string;
  parentName: string;
  onCreateProject: (input: CreateProjectInput) => Promise<string>; // treeApi.createProject (já cuida de reload + auto-expand do pai)
  onReload: () => Promise<void>; // segunda passada, só pra refletir a capa depois de anexada
}

export default function CreateSubprojectModal({
  isOpen, onClose, parentProjectId, parentName, onCreateProject, onReload,
}: CreateSubprojectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [pendingCoverSourcePath, setPendingCoverSourcePath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // id "provisório" só pra dar seed determinístico ao preview de cor automática antes de existir id real
  const previewSeedId = useState(() => generateId())[0];

  function resetForm() {
    setName('');
    setDescription('');
    setColor(null);
    setCoverPath(null);
    setPendingCoverSourcePath(null);
    setError(null);
  }

  async function handlePickCover() {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (!selected || Array.isArray(selected)) return;
    setPendingCoverSourcePath(selected);
    setCoverPath(selected); // só pra preview local do nome do arquivo, não é o path final salvo
  }

  async function handleSubmit() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const id = await onCreateProject({
        name: name.trim(),
        description: description.trim() || null,
        color,
        parentProjectId,
      });

      if (pendingCoverSourcePath) {
        const savedPath = await invoke<string>('save_project_cover', {
          projectId: id,
          sourcePath: pendingCoverSourcePath,
        });
        await projectsApi.updateProject(id, { cover_path: savedPath });
        await onReload();
      }

      resetForm();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={isOpen} onClose={onClose} title={`Novo subprojeto em "${parentName}"`}>
      <div style={{ padding: 16, width: 380, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Nome</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do subprojeto"
            style={{ width: '100%', padding: 8, fontSize: 14 }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Cor (opcional)</label>
          <ProjectColorPicker
            value={color}
            seedId={previewSeedId}
            onChange={setColor}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Capa (opcional)</label>
          <Button variant="secondary" onClick={handlePickCover}>
            {pendingCoverSourcePath ? 'Trocar imagem selecionada' : 'Escolher imagem'}
          </Button>
          {coverPath && <p style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Selecionado — será salvo ao criar.</p>}
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Descrição (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: 8, fontSize: 13, resize: 'vertical' }}
          />
        </div>

        {error && <p style={{ color: 'red', fontSize: 12 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #eee', paddingTop: 12 }}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Criando...' : 'Criar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

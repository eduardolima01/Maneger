import { useState, useEffect } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import Button from '@/components/layout/Button';
import * as projectsApi from '@/lib/api/projects';
import { setProjectArchived } from '@/lib/api/projects';
import { getProjectColor, PALETTE } from '@/lib/utils/projectColor';
import type { ProjectType } from '@/types/project.types';

interface ProjectInlineEditFormProps {
  project: ProjectType;
  onSaved: () => void;
  onDeleted: () => void;
  onCancel: () => void;
}

export default function ProjectInlineEditForm({ project, onSaved, onDeleted, onCancel }: ProjectInlineEditFormProps) {
  const [name, setName] = useState(project.name);
  const [color, setColor] = useState<string | null>(project.color);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setName(project.name);
    setColor(project.color);
    setConfirmingDelete(false);
  }, [project.id, project.name, project.color]);

  async function handleSaveName() {
    if (!name.trim() || name === project.name) return;
    await projectsApi.updateProject(project.id, { name: name.trim() });
    onSaved();
  }

  async function handleColorChange(hex: string) {
    setColor(hex);
    try {
      await projectsApi.updateProject(project.id, { color: hex });
      onSaved();
    } catch (err) {
      console.error('Falha ao salvar cor do projeto:', err);
      setColor(project.color);
    }
  }

  async function handleResetColor() {
    setColor(null);
    await projectsApi.updateProject(project.id, { color: null });
    onSaved();
  }

  async function handlePickCover() {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (!selected || Array.isArray(selected)) return;

    const newPath = await invoke<string>('save_project_cover', {
      projectId: project.id,
      sourcePath: selected,
    });
    await projectsApi.updateProject(project.id, { cover_path: newPath });
    onSaved();
  }

  async function handleToggleArchived() {
    await setProjectArchived(project.id, !project.archived);
    onSaved();
  }

  async function handleDelete() {
    if (project.cover_path) {
      await invoke('delete_project_cover', { projectId: project.id }).catch(() => { });
    }
    await projectsApi.deleteProject(project.id);
    onDeleted();
  }

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: 12, backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSaveName}
          style={{ width: '100%', padding: 8, fontSize: 14 }}
        />
      </div>

      <div>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Cor do projeto</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input
            type="color"
            value={color ?? getProjectColor(project.id)}
            onChange={(e) => handleColorChange(e.target.value)}
            style={{ width: 36, height: 28, padding: 0, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}
          />
          {color !== null && (
            <button
              onClick={handleResetColor}
              style={{ fontSize: 12, color: '#666', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              usar cor automática
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {PALETTE.map((hex) => (
            <button
              key={hex}
              onClick={() => handleColorChange(hex)}
              title={hex}
              style={{
                width: 20, height: 20, borderRadius: '50%', backgroundColor: hex,
                border: color === hex ? '2px solid #000' : '1px solid #ccc', cursor: 'pointer', padding: 0,
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Capa</label>
        {project.cover_path && (
          <img
            src={convertFileSrc(project.cover_path)}
            style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }}
          />
        )}
        <Button variant="secondary" onClick={handlePickCover}>
          {project.cover_path ? 'Trocar capa' : 'Escolher capa'}
        </Button>
      </div>

      <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
        <Button variant="secondary" onClick={handleToggleArchived}>
          {project.archived ? '📤 Desarquivar projeto' : '📥 Arquivar projeto'}
        </Button>
      </div>

      <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
        {!confirmingDelete ? (
          <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
            Excluir projeto
          </Button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 13, color: '#c62828', margin: 0 }}>
              Isso apaga o projeto, seus subprojetos e todas as tasks, eventos, notas, logs e kanban vinculados. Não pode ser desfeito.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>Cancelar</Button>
              <Button variant="danger" onClick={handleDelete}>Confirmar exclusão</Button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: 12 }}>
        <Button variant="secondary" onClick={onCancel}>Fechar edição</Button>
      </div>
    </div>
  );
}

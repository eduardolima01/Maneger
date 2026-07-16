import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import ModuleToggles from './modules/ModuleToggles';
import * as projectsApi from '../../lib/api/projects';
import type { ProjectType } from '../../types/project.types';
import type { ModuleStatus } from '../../lib/api/modules';
import type { ModuleKey } from '../../types/module.types';

import { setProjectArchived } from '../../lib/api/projects';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';

import { getProjectColor, PALETTE } from '@/lib/utils/projectColor';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectType;
  modules: ModuleStatus | null;
  onToggleModule: (moduleKey: ModuleKey, enabled: boolean) => void;
  onUpdated: () => void;
  onDeleted: () => void;
  onGoToProject?: () => void;
}

export default function ProjectSettingsModal({
  isOpen,
  onClose,
  project,
  modules,
  onToggleModule,
  onUpdated,
  onDeleted,
  onGoToProject
}: ProjectSettingsModalProps) {
  const [name, setName] = useState(project.name);
  const [color, setColor] = useState<string | null>(project.color);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(project.name);
      setColor(project.color);
      setConfirmingDelete(false);
    }
  }, [isOpen, project.name, project.color]);

  async function handleSaveName() {
    if (!name.trim() || name === project.name) return;
    await projectsApi.updateProject(project.id, { name: name.trim() });
    onUpdated();
  }

  async function handleColorChange(hex: string) {
    setColor(hex);
    try {
      await projectsApi.updateProject(project.id, { color: hex });
      onUpdated();
    } catch (err) {
      console.error('Falha ao salvar cor do projeto:', err);
      setColor(project.color); // reverte o estado local já que não persistiu
    }
  }

  async function handleResetColor() {
    setColor(null);
    await projectsApi.updateProject(project.id, { color: null });
    onUpdated();
  }

  async function handleDelete() {
    if (project.cover_path) {
      await invoke('delete_project_cover', { projectId: project.id })
        .catch(() => { });
    }
    await projectsApi.deleteProject(project.id);
    onDeleted();
    onClose();
  }

  async function handleToggleArchived() {
    await setProjectArchived(project.id, !project.archived);
    onUpdated();
    onClose();
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
    onUpdated();
  }

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div style={{ padding: 16, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 style={{ margin: 0 }}>Configurações do projeto</h3>

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
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  backgroundColor: hex,
                  border: color === hex ? '2px solid #000' : '1px solid #ccc',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <label
            style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Capa
          </label>
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

        {modules && <ModuleToggles modules={modules} onToggle={onToggleModule} />}

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
                Isso apaga o projeto e todas as tasks, eventos e notas vinculadas. Não pode ser desfeito.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>Cancelar</Button>
                <Button variant="danger" onClick={handleDelete}>Confirmar exclusão</Button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {onGoToProject && (
            <Button variant="secondary" onClick={onGoToProject}>
              Ir para o projeto
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}

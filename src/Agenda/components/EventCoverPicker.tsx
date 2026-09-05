import { useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import EventGalleryManagerModal from './EventGalleryManagerModal';
import { useEventGallery } from '../hooks/useEventGallery';
import ImageUploadField from '@/components/ImageUploadField';

interface EventCoverPickerProps {
  projectId: string | null;
  eventId: string | null;
  eventDate: string;
  isAmbiguous?: boolean;
  onChanged?: () => void;
}

export default function EventCoverPicker({ projectId, eventId, eventDate, isAmbiguous, onChanged }: EventCoverPickerProps) {
  const [managerOpen, setManagerOpen] = useState(false);
  const [pendingImageId, setPendingImageId] = useState<string | null>(null);
  const { images, coverByEvent, addImage, updateImage, removeImage, toggleEventImage, reload } = useEventGallery(projectId);

  if (!projectId) {
    return (
      <p style={{ fontSize: 11, color: '#999', fontStyle: 'italic' }}>
        Atribua um projeto pra poder usar imagens da galeria como capa deste evento.
      </p>
    );
  }

  const dayImages = images.filter((i) => i.date === eventDate && i.path);
  const selectedIds = eventId ? (coverByEvent[eventId] ?? []) : [];

  async function handleToggle(imageId: string) {
    if (!eventId) return;
    await toggleEventImage(eventId, imageId);
    onChanged?.();
  }

  async function handleAddClick() {
    const id = await addImage(eventDate);
    setPendingImageId(id);
  }

  async function handleUploaded(path: string) {
    if (!pendingImageId) return;
    await updateImage(pendingImageId, { path });
    if (eventId) await toggleEventImage(eventId, pendingImageId); // já nasce associada a este evento
    setPendingImageId(null);
    onChanged?.();
  }

  async function handleCancelPending() {
    if (pendingImageId) await removeImage(pendingImageId); // descarta a entrada vazia, sem path
    setPendingImageId(null);
  }

  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>
        Imagens do evento ({dayImages.length} dispon{dayImages.length !== 1 ? 'íveis' : 'ível'} em {eventDate})
      </label>

      {isAmbiguous && (
        <p style={{ fontSize: 11, color: '#e65100', margin: '0 0 6px' }}>
          ⚠ Há outros eventos deste projeto neste mesmo dia — a capa não é aplicada automaticamente aqui, escolha manualmente.
        </p>
      )}

      {dayImages.length === 0 ? (
        <p style={{ fontSize: 11, color: '#999', fontStyle: 'italic', margin: '0 0 6px' }}>
          Nenhuma imagem da galeria bate com essa data ainda.
        </p>
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {dayImages.map((img) => {
            const selected = selectedIds.includes(img.id);
            return (
              <button
                key={img.id}
                onClick={() => handleToggle(img.id)}
                disabled={!eventId}
                title={img.label || undefined}
                style={{
                  position: 'relative', width: 48, height: 48, borderRadius: 4, padding: 0, overflow: 'hidden',
                  border: selected ? '2px solid #1a73e8' : '1px solid #ddd',
                  cursor: eventId ? 'pointer' : 'not-allowed', opacity: eventId ? 1 : 0.5,
                }}
              >
                <img src={convertFileSrc(img.path)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {selected && (
                  <span style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: '50%', backgroundColor: '#1a73e8', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {pendingImageId ? (
        <div style={{ marginBottom: 6 }}>
          <ImageUploadField
            entityId={pendingImageId}
            currentPath={null}
            onUploaded={handleUploaded}
            height={90}
          />
          <button
            onClick={handleCancelPending}
            style={{ fontSize: 11, color: '#999', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, padding: 0 }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          onClick={handleAddClick}
          style={{ fontSize: 11, color: '#1a73e8', background: 'none', border: '1px dashed #1a73e8', borderRadius: 4, cursor: 'pointer', padding: '4px 10px', marginBottom: 6 }}
        >
          + Imagem ({eventDate})
        </button>
      )}


      <p style={{ fontSize: 10, color: '#999', margin: '0 0 6px' }}>Clique pra marcar/desmarcar. Pode escolher mais de uma.</p>

      {!eventId && (
        <p style={{ fontSize: 10, color: '#999', fontStyle: 'italic', margin: '0 0 6px' }}>
          Salve o evento primeiro pra poder escolher as imagens.
        </p>
      )}

      <button
        onClick={() => setManagerOpen(true)}
        style={{ border: 'none', background: 'none', color: '#1a73e8', fontSize: 11, cursor: 'pointer', padding: 0 }}
      >
        🖼 Gerenciar galeria de imagens do projeto
      </button>

      <EventGalleryManagerModal
        isOpen={managerOpen}
        onClose={() => { setManagerOpen(false); reload(); onChanged?.(); }}
        projectId={projectId}
        defaultDate={eventDate}
        onChanged={onChanged}
      />
    </div>
  );
}

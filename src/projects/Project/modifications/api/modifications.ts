import { invoke } from '@tauri-apps/api/core';
import { generateId } from '@/lib/utils/uuid';
import { DEFAULT_MODIFICATION_TEMPLATE, defaultManifest, ModificationManifest } from '../types/modification.types';

export async function listModifications(projectId: string): Promise<string[]> {
  return invoke<string[]>('list_modifications', { projectId });
}

export async function loadManifest(projectId: string, modKey: string): Promise<ModificationManifest | null> {
  const raw = await invoke<string>('load_modification_file', { projectId, modKey, fileName: 'manifest.json' });
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function saveManifest(projectId: string, modKey: string, manifest: ModificationManifest): Promise<void> {
  await invoke('save_modification_file', { projectId, modKey, fileName: 'manifest.json', data: JSON.stringify(manifest, null, 2) });
}

export async function loadEntry(projectId: string, modKey: string): Promise<string> {
  return invoke<string>('load_modification_file', { projectId, modKey, fileName: 'entry.tsx' });
}

export async function saveEntry(projectId: string, modKey: string, source: string): Promise<void> {
  await invoke('save_modification_file', { projectId, modKey, fileName: 'entry.tsx', data: source });
}

export async function loadData(projectId: string, modKey: string): Promise<Record<string, unknown>> {
  const raw = await invoke<string>('load_modification_file', { projectId, modKey, fileName: 'data.json' });
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export async function saveData(projectId: string, modKey: string, data: Record<string, unknown>): Promise<void> {
  await invoke('save_modification_file', { projectId, modKey, fileName: 'data.json', data: JSON.stringify(data, null, 2) });
}

export async function createModification(projectId: string, name: string): Promise<string> {
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'mod';
  const key = `${slug}-${generateId().slice(0, 6)}`;
  await saveManifest(projectId, key, defaultManifest(key, name));
  await saveEntry(projectId, key, DEFAULT_MODIFICATION_TEMPLATE);
  return key;
}

export async function deleteModification(projectId: string, modKey: string): Promise<void> {
  await invoke('delete_modification', { projectId, modKey });
}

export async function setModificationEnabled(projectId: string, modKey: string, enabled: boolean): Promise<void> {
  const manifest = await loadManifest(projectId, modKey);
  if (!manifest) return;
  await saveManifest(projectId, modKey, { ...manifest, enabled, updatedAt: new Date().toISOString() });
}

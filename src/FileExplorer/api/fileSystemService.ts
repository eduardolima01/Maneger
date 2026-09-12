import { invoke } from '@tauri-apps/api/core';
import type { FsEntry, QuickAccessLocation, TrashEntry } from '../types/fileExplorer.types';

interface FsEntryRow {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified_at: string | null;
  extension: string | null;
}

function mapEntry(row: FsEntryRow): FsEntry {
  return {
    name: row.name,
    path: row.path,
    isDir: row.is_dir,
    size: row.size,
    modifiedAt: row.modified_at,
    extension: row.extension,
  };
}

interface TrashEntryRow {
  id: string;
  name: string;
  original_parent: string;
  time_deleted: number;
}

function mapTrashEntry(row: TrashEntryRow): TrashEntry {
  return { id: row.id, name: row.name, originalParent: row.original_parent, timeDeleted: row.time_deleted };
}

export async function listTrash(): Promise<TrashEntry[]> {
  const rows = await invoke<TrashEntryRow[]>('list_trash');
  return rows.map(mapTrashEntry);
}

export async function restoreTrashItem(item: TrashEntry): Promise<void> {
  await invoke('restore_trash_item', {
    id: item.id, name: item.name, originalParent: item.originalParent, timeDeleted: item.timeDeleted,
  });
}
export async function listDirectory(path: string): Promise<FsEntry[]> {
  const rows = await invoke<FsEntryRow[]>('list_directory', { path });
  return rows.map(mapEntry);
}

export async function getHomePath(): Promise<string> {
  return invoke<string>('get_home_path');
}

export async function getQuickAccessLocations(): Promise<QuickAccessLocation[]> {
  return invoke<QuickAccessLocation[]>('get_quick_access_locations');
}

export async function createFolder(parentPath: string, name: string): Promise<FsEntry> {
  const row = await invoke<FsEntryRow>('create_folder', { parentPath, name });
  return mapEntry(row);
}

export async function renamePath(path: string, newName: string): Promise<FsEntry> {
  const row = await invoke<FsEntryRow>('rename_path', { path, newName });
  return mapEntry(row);
}

/** Envia pra lixeira/reciclagem do SO — não é exclusão permanente (ver PATCHES.md). */
export async function deleteToTrash(path: string): Promise<void> {
  await invoke('delete_to_trash', { path });
}

export async function copyPath(sourcePath: string, destDirPath: string): Promise<FsEntry> {
  const row = await invoke<FsEntryRow>('copy_path', { sourcePath, destDirPath });
  return mapEntry(row);
}

export async function movePath(sourcePath: string, destDirPath: string): Promise<FsEntry> {
  const row = await invoke<FsEntryRow>('move_path', { sourcePath, destDirPath });
  return mapEntry(row);
}

export async function readTextFile(path: string): Promise<string> {
  return invoke<string>('read_text_file', { path });
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  await invoke('write_text_file', { path, content });
}


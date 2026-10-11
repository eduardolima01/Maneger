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

/** Manifesto inteiro (path da pasta -> path absoluto do arquivo de ícone), carregado uma vez na inicialização. */
export async function getFolderIcons(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>('get_folder_icons');
}

/** `sourceImagePath` vem do diálogo de arquivo do front (@tauri-apps/plugin-dialog). */
export async function setFolderIconFromPath(folderPath: string, sourceImagePath: string): Promise<string> {
  return invoke<string>('set_folder_icon_from_path', { folderPath, sourceImagePath });
}

export async function setFolderIconFromClipboard(folderPath: string): Promise<string> {
  return invoke<string>('set_folder_icon_from_clipboard', { folderPath });
}

export async function removeFolderIcon(folderPath: string): Promise<void> {
  await invoke('remove_folder_icon', { folderPath });
}
/** Exclusão PERMANENTE (não passa pela lixeira). A confirmação é feita na UI (Alt+Q). */
export function deletePermanently(path: string): Promise<void> {
  return invoke('delete_permanently', { path });
}
/** PNG pequeno (embutido no binário) usado como ícone do arraste pra fora do app. */
export async function getDragIconPath(): Promise<string> {
  return invoke<string>('get_drag_icon_path');
}
/** Grupos de pastas da sidebar (JSON salvo como texto em explorer-groups.json). */
export async function loadFolderGroups(): Promise<string> {
  return invoke<string>('load_folder_groups');
}
export async function saveFolderGroups(data: string): Promise<void> {
  await invoke('save_folder_groups', { data });
}
/** Preferências de interface do Explorador (JSON como texto em explorer-ui-prefs.json). */
export async function loadExplorerUiPrefs(): Promise<string> {
  return invoke<string>('load_explorer_ui_prefs');
}

export async function saveExplorerUiPrefs(data: string): Promise<void> {
  await invoke('save_explorer_ui_prefs', { data });
}
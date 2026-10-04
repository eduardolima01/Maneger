import { invoke } from '@tauri-apps/api/core';

export interface FavoritePageEntry {
  path: string;
  title: string;
  icon?: string;
  iconUrl?: string;
  addedAt: string;
}

export interface FavoritePagesState {
  favorites: FavoritePageEntry[];
}

const EMPTY_STATE: FavoritePagesState = { favorites: [] };

export async function loadFavoritePages(): Promise<FavoritePagesState> {
  try {
    const raw = await invoke<string>('load_favorite_pages');
    const parsed = JSON.parse(raw);
    return { favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [] };
  } catch {
    return EMPTY_STATE;
  }
}

export async function saveFavoritePages(state: FavoritePagesState): Promise<void> {
  await invoke('save_favorite_pages', { data: JSON.stringify(state) });
}

import { invoke } from '@tauri-apps/api/core';
import { type FeedData, defaultFeedData } from '../types/feed.types';

export async function loadFeedData(): Promise<FeedData> {
  const raw = await invoke<string>('load_feed_data');
  try {
    const parsed = JSON.parse(raw);
    return { ...defaultFeedData(), ...parsed };
  } catch {
    return defaultFeedData();
  }
}

export async function saveFeedData(data: FeedData): Promise<void> {
  await invoke('save_feed_data', { data: JSON.stringify(data, null, 2) });
}

/** Salva bytes crus (colar/soltar imagem) como um novo asset. Retorna o path ABSOLUTO. */
export async function saveMomentAssetBytes(bytes: Uint8Array, extension: string): Promise<string> {
  return invoke<string>('save_moment_asset_bytes', { bytes: Array.from(bytes), extension });
}

export async function deleteMomentAsset(absolutePath: string): Promise<void> {
  await invoke('delete_moment_asset', { path: absolutePath });
}

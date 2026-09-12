import type { FsEntry } from '../types/fileExplorer.types';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'mkv', 'avi', 'webm'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'ogg', 'm4a'];

export type MediaKind = 'image' | 'video' | 'audio' | null;

export function getMediaKind(entry: Pick<FsEntry, 'isDir' | 'extension'>): MediaKind {
  if (entry.isDir || !entry.extension) return null;
  if (IMAGE_EXTENSIONS.includes(entry.extension)) return 'image';
  if (VIDEO_EXTENSIONS.includes(entry.extension)) return 'video';
  if (AUDIO_EXTENSIONS.includes(entry.extension)) return 'audio';
  return null;
}

const TEXT_FILE_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'ts', 'tsx', 'js', 'jsx', 'rs', 'toml',
  'yaml', 'yml', 'css', 'html', 'xml', 'csv', 'log', 'sh', 'py', 'rb',
  'go', 'java', 'c', 'h', 'cpp', 'hpp', 'sql', 'env', 'ini', 'cfg',
]);

export function isTextFile(entry: FsEntry): boolean {
  if (entry.isDir) return false;
  const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
  return TEXT_FILE_EXTENSIONS.has(ext);
}

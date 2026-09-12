const ICON_BY_EXTENSION: Record<string, string> = {
  pdf: '📕',
  doc: '📄', docx: '📄',
  xls: '📊', xlsx: '📊', csv: '📊',
  ppt: '📙', pptx: '📙',
  txt: '📄', md: '📝',
  png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️', bmp: '🖼️',
  mp3: '🎵', wav: '🎵', flac: '🎵', ogg: '🎵',
  mp4: '🎬', mov: '🎬', mkv: '🎬', avi: '🎬', webm: '🎬',
  zip: '🗜️', rar: '🗜️', '7z': '🗜️', tar: '🗜️', gz: '🗜️',
  js: '💻', ts: '💻', tsx: '💻', jsx: '💻', json: '💻', rs: '💻', py: '💻', html: '💻', css: '💻',
  exe: '⚙️', msi: '⚙️', dmg: '⚙️', app: '⚙️',
};

export function getFileIcon(entry: { isDir: boolean; extension: string | null }): string {
  if (entry.isDir) return '📁';
  if (!entry.extension) return '📄';
  return ICON_BY_EXTENSION[entry.extension] ?? '📄';
}

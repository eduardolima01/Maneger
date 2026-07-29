import { invoke } from '@tauri-apps/api/core';

const MAX_DIMENSION = 1200; // px, no maior lado
const JPEG_QUALITY = 0.75; // 0–1, quanto menor mais comprime (e mais perde qualidade)

async function compressImage(file: File): Promise<{ blob: Blob; extension: string }> {
  const bitmap = await createImageBitmap(file);

  let { width, height } = bitmap;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível processar a imagem');

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve({ blob, extension: 'jpg' }) : reject(new Error('Falha ao comprimir imagem'))),
      'image/jpeg',
      JPEG_QUALITY
    );
  });
}


export async function saveCoverFromFile(entityId: string, file: File, compress: boolean = true): Promise<string> {
  const { blob, extension } = compress
    ? await compressImage(file)
    : { blob: file, extension: file.type.split('/')[1] ?? 'png' };
  const buffer = await blob.arrayBuffer();
  const bytes = Array.from(new Uint8Array(buffer));
  return invoke<string>('save_cover_from_bytes', { entityId, bytes, extension });
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

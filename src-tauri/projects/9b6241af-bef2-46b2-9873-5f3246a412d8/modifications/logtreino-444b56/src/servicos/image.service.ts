
// servicos/image.service.ts
// Lógica pura ligada a imagens — sem tocar em canvas, Image() ou DOM,
// então é testável fora do navegador.

function findImageInClipboard(items: any): Blob | null {
  if (!items || typeof items.length !== 'number') return null;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item && item.type && item.type.indexOf('image/') === 0 && typeof item.getAsFile === 'function') {
      const blob = item.getAsFile();
      if (blob) return blob;
    }
  }
  return null;
}

function fitWithinSquare(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

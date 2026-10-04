/**
* Extrai uma paleta de cores dominantes de uma imagem, amostrando os
* pixels num canvas fora da tela. Pensado pra sugerir cores de projeto a
* partir da própria capa.
*
* Ressalva de confiança: nunca testado contra o protocolo asset:// do
* Tauri neste ambiente. Em teoria funciona (é um arquivo local do próprio
* app, não uma origem cruzada de verdade), mas se o navegador marcar o
* canvas como "tainted" por política de CORS, getImageData lança um
* SecurityError — nesse caso a função retorna array vazio (catch abaixo)
* e a paleta manual continua funcionando normalmente.
*/
export async function extractCoverColors(imageSrc: string, maxColors = 6): Promise<string[]> {
  try {
    const img = await loadImage(imageSrc);

    const sampleSize = 48; // amostragem pequena: suficiente e rápida
    const canvas = document.createElement('canvas');
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
    const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);

    // Quantiza cada canal (buckets de 32) pra agrupar cores parecidas
    const bucketSize = 32;
    const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = data[i + 3];
      if (alpha < 200) continue; // ignora pixels muito transparentes

      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luminance > 245 || luminance < 12) continue; // ignora quase-branco/quase-preto (fundo, sombra)

      const key = [
        Math.round(r / bucketSize),
        Math.round(g / bucketSize),
        Math.round(b / bucketSize),
      ].join(',');

      const existing = buckets.get(key);
      if (existing) {
        existing.r += r;
        existing.g += g;
        existing.b += b;
        existing.count += 1;
      } else {
        buckets.set(key, { r, g, b, count: 1 });
      }
    }

    const sorted = Array.from(buckets.values()).sort((a, b) => b.count - a.count);

    return sorted
      .slice(0, maxColors)
      .map(({ r, g, b, count }) => rgbToHex(r / count, g / count, b / count));
  } catch (err) {
    console.error('Falha ao extrair cores da capa:', err);
    return [];
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return '#' + [r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('');
}

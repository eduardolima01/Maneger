const SAMPLE_MAX_SIDE = 64;   // reduz a imagem antes de contar pixels — rápido e suficiente pra achar as cores principais
const MIN_COLOR_DISTANCE = 48; // distância mínima (RGB) entre duas cores escolhidas, senão viram "a mesma cor" (tons quase iguais)

const cache = new Map<string, string[]>();

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // sem isso o canvas fica "tainted" (contaminado) e getImageData lança SecurityError.
    // O protocolo asset do Tauri responde com CORS liberado pra origem da janela, então funciona.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem'));
    img.src = src;
  });
}

/**
 * Cores mais frequentes da imagem, da mais para a menos comum, em hex minúsculo de 7 caracteres.
 * Agrupa pixels parecidos (5 bits por canal), tira a média de cada grupo e descarta cores quase iguais
 * às já escolhidas — pode devolver MENOS que `count` se a imagem tiver poucas cores distintas.
 * Lança erro se a imagem não carregar ou o canvas não puder ser lido (o chamador trata).
 */
export async function extractDominantColors(src: string, count = 6): Promise<string[]> {
  const cacheKey = `${src}|${count}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const img = await loadImage(src);
  const scale = Math.min(1, SAMPLE_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas indisponível');
  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // ignora transparência
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bucket = buckets.get(key);
    if (bucket) { bucket.r += r; bucket.g += g; bucket.b += b; bucket.n += 1; }
    else buckets.set(key, { r, g, b, n: 1 });
  }

  const ranked = Array.from(buckets.values())
    .sort((a, b) => b.n - a.n)
    .map((bk) => ({ r: bk.r / bk.n, g: bk.g / bk.n, b: bk.b / bk.n }));

  const picked: { r: number; g: number; b: number }[] = [];
  for (const c of ranked) {
    if (picked.length >= count) break;
    const tooClose = picked.some((p) => Math.hypot(p.r - c.r, p.g - c.g, p.b - c.b) < MIN_COLOR_DISTANCE);
    if (!tooClose) picked.push(c);
  }

  const result = picked.map((c) => toHex(c.r, c.g, c.b));
  cache.set(cacheKey, result);
  return result;
}

/** Mistura a cor com branco. amount 0 = a própria cor, 1 = branco. Serve pra fundos legíveis com texto escuro. */
export function tintTowardWhite(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/**
* Captura UM frame de um vídeo como imagem (JPEG) — usado pra virar capa de card.
* Funciona com um <video> fora da tela: carrega o arquivo, pula pro instante pedido, desenha o frame num canvas e
* devolve o Blob. Reduz pra no máximo 1280px no lado maior (capa não precisa de 4K).
*/

const MAX_SIDE = 1280;
const LOAD_TIMEOUT_MS = 20000;
/** Acima disso não carrega o vídeo inteiro na memória no plano B (ver captureVideoFrame). */
const MAX_BLOB_FALLBACK_BYTES = 300 * 1024 * 1024;

function grabFrame(url: string, atSeconds: number | undefined, crossOrigin: boolean): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    if (crossOrigin) video.crossOrigin = 'anonymous'; // sem isso o canvas fica "contaminado" e não deixa exportar a imagem
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    let settled = false;
    const timer = window.setTimeout(() => finish(new Error('O vídeo demorou demais pra carregar.')), LOAD_TIMEOUT_MS);

    function finish(result: Blob | Error) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeAttribute('src');
      video.load(); // solta o arquivo
      if (result instanceof Error) reject(result); else resolve(result);
    }

    video.onerror = () => finish(new Error('Não foi possível ler este vídeo (formato não suportado?).'));

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      // sem instante pedido: 1s (ou o meio, se o vídeo for curto) — evita o frame preto do início
      const wanted = atSeconds !== undefined ? atSeconds : Math.min(1, duration / 2);
      const target = Math.max(0.01, Math.min(wanted, Math.max(duration - 0.05, 0.01)));
      video.currentTime = target; // dispara 'seeked' quando o frame estiver pronto
    };

    video.onseeked = () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) throw new Error('O vídeo não tem imagem.');
        const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Não foi possível desenhar o frame.');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => finish(blob ?? new Error('Não foi possível gerar a imagem do frame.')),
          'image/jpeg',
          0.9
        );
      } catch (err) {
        finish(err instanceof Error ? err : new Error(String(err)));
      }
    };

    video.src = url;
  });
}

/**
 * `videoUrl`: normalmente `convertFileSrc(caminho)`. `atSeconds`: instante do frame (omitido = automático).
 * Plano A: lê o vídeo direto (com CORS), sem carregar o arquivo inteiro. Se o canvas ficar "contaminado" ou a leitura
 * falhar, plano B: baixa o vídeo pra memória e usa uma URL local (só pra arquivos de até 300 MB).
 */
export async function captureVideoFrame(videoUrl: string, atSeconds?: number, fileSizeBytes?: number): Promise<Blob> {
  try {
    return await grabFrame(videoUrl, atSeconds, true);
  } catch (firstError) {
    if (fileSizeBytes !== undefined && fileSizeBytes > MAX_BLOB_FALLBACK_BYTES) throw firstError;
    const response = await fetch(videoUrl);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await grabFrame(objectUrl, atSeconds, false);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

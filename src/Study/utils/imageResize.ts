/**
 * Redimensiona e comprime uma imagem no navegador (Canvas nativo, sem lib nova)
 * antes de guardar como data URL (base64) dentro do blob JSON do módulo.
 *
 * Isso existe porque o módulo não tem armazenamento de arquivo binário separado
 * (o `study-data.json` é um blob único de texto) — guardar a imagem crua
 * inflaria bastante esse arquivo. Redimensionar pra no máximo `maxDim` px e
 * comprimir como JPEG mantém o custo razoável pro volume esperado (imagens de
 * referência pontuais, não uma galeria).
 */
export function resizeImageToDataUrl(file: File, maxDim = 900, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas não suportado neste ambiente.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

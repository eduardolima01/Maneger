Agora rebuild + validação completa (sintaxe, render e a lógica pura de clipboard/redimensionamento):Tudo passou. Segue o que muda:

## 1. Novo arquivo `src/servicos/image.service.ts`
```ts
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
```

## 2. `src/componentes/ExercisePhotoField.tsx` — arquivo inteiro
```tsx
// componentes/ExercisePhotoField.tsx
// Upload/colagem de foto sem "document": <input type="file"> normal para
// escolher do disco, onPaste (Ctrl+V) na própria miniatura para colar uma
// imagem copiada, e um <canvas> montado pelo React (via ref) para
// redimensionar e comprimir antes de salvar — o data.json é só texto.
function ExercisePhotoField({ React, s, exercise, onSetPhoto, size }: any) {
  const canvasRef = React.useRef(null);
  const [busy, setBusy] = React.useState(false);
  const dim = size || 48;

  function processBlob(blob: Blob) {
    setBusy(true);
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const { width: w, height: h } = fitWithinSquare(img.width, img.height, 480);
      const canvas = canvasRef.current;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
      onSetPhoto(exercise.id, dataUrl);
      URL.revokeObjectURL(objectUrl);
      setBusy(false);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setBusy(false);
    };
    img.src = objectUrl;
  }

  function handleFile(e: any) {
    const file = e.target.files && e.target.files[0];
    if (file) processBlob(file);
  }

  function handlePaste(e: any) {
    const blob = findImageInClipboard(e.clipboardData && e.clipboardData.items);
    if (blob) {
      e.preventDefault();
      processBlob(blob);
    }
  }

  return (
    <div style={{ marginTop: 6 }}>
      <div style={s.row}>
        <div
          tabIndex={0}
          onPaste={handlePaste}
          title="Clique aqui e cole (Ctrl+V) uma imagem copiada"
          style={{ width: dim, height: dim, borderRadius: 8, overflow: 'hidden', outline: 'none', cursor: 'text' }}
        >
          {exercise.photo ? (
            <img src={exercise.photo} alt={exercise.name} style={{ width: dim, height: dim, objectFit: 'cover', display: 'block' }} />
          ) : (
            <div
              style={{
                width: dim, height: dim, background: s.colors.cardAlt, border: '1px dashed ' + s.colors.border,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9,
                color: s.colors.textDim, textAlign: 'center', padding: 2,
              }}
            >
              clique + Ctrl+V
            </div>
          )}
        </div>
        <label style={{ ...s.btnSmall, cursor: 'pointer' }}>
          {busy ? 'Processando...' : exercise.photo ? 'Trocar foto' : '+ Foto'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </label>
        {exercise.photo && <button style={s.btnDanger} onClick={() => onSetPhoto(exercise.id, null)}>remover foto</button>}
      </div>
      <div style={{ ...s.small, marginTop: 4 }}>Clique na miniatura e aperte Ctrl+V para colar uma imagem copiada.</div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
```

## 3. `build.js`
No array `ORDER`, adicionar `'src/servicos/image.service.ts'` **logo antes** de `'src/servicos/data.service.ts'` (e depois de `week.service.ts`) — precisa vir antes de `ExercisePhotoField.tsx`, que usa `findImageInClipboard` e `fitWithinSquare`.

Depois, `node build.js`.

**Como usar:** clique na miniatura (quadradinho "clique + Ctrl+V") pra focar nela, copie uma imagem em qualquer lugar do sistema, aperte Ctrl+V — a foto entra redimensionada e comprimida automaticamente. O botão "+ Foto"/"Trocar foto" continua funcionando do jeito de sempre, pra quem preferir escolher um arquivo do disco.

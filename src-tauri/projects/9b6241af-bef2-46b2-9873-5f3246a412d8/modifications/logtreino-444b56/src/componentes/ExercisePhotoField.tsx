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

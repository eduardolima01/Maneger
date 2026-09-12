import { useEffect, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import Button from '@/components/layout/Button';
import { loadExplorerPrefs, saveExplorerPrefs } from '@/FileExplorer/api/explorerPrefs';
import { getHomePath } from '@/FileExplorer/api/fileSystemService';

export function SettingsExplorerSection() {
  const [path, setPath] = useState<string | null>(null);
  const [homePath, setHomePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [prefs, home] = await Promise.all([loadExplorerPrefs(), getHomePath()]);
      setPath(prefs.defaultPath);
      setHomePath(home);
      setLoading(false);
    })();
  }, []);

  const handleChoose = async () => {
    const selected = await openDialog({ directory: true, defaultPath: path ?? homePath ?? undefined });
    if (typeof selected === 'string') {
      setPath(selected);
      await saveExplorerPrefs({ defaultPath: selected });
    }
  };

  const handleReset = async () => {
    setPath(null);
    await saveExplorerPrefs({ defaultPath: null });
  };

  return (
    <div style={{ marginTop: 28 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Explorador de Arquivos</h3>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
        Pasta que o Explorador abre por padrão. Se não definida, abre na pasta do usuário.
      </p>

      {loading ? (
        <p style={{ fontSize: 13, color: '#999' }}>Carregando...</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6,
            fontSize: 13, color: path ? '#000' : '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {path ?? `${homePath} (padrão)`}
          </div>
          <Button variant="secondary" onClick={handleChoose}>Escolher pasta</Button>
          {path && <Button variant="secondary" onClick={handleReset}>Redefinir</Button>}
        </div>
      )}
    </div>
  );
}


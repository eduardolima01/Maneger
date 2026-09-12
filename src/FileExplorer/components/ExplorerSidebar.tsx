import { MdHome, MdFolder, MdDownload, MdDesktopWindows, MdDelete } from 'react-icons/md';
import type { QuickAccessLocation } from '../types/fileExplorer.types';

const ICON_BY_LABEL: Record<string, typeof MdHome> = {
  'Início': MdHome,
  'Documentos': MdFolder,
  'Downloads': MdDownload,
  'Área de trabalho': MdDesktopWindows,
};

interface ExplorerSidebarProps {
  locations: QuickAccessLocation[];
  currentPath: string | null;
  onNavigate: (path: string) => void;
  onOpenTrash: () => void;
  viewingTrash: boolean;
}

/**
 * Hoje só mostra "Locais" (atalhos fixos vindos do backend: Início/Documentos/
 * Downloads/Área de trabalho). Estrutura preparada pra uma seção "Favoritos"
 * separada e editável pelo usuário no futuro — só precisaria de uma segunda
 * lista (favoritos custom, persistida em prefs) renderizada acima desta.
 */
export default function ExplorerSidebar({ locations, currentPath, onNavigate, onOpenTrash, viewingTrash }: ExplorerSidebarProps) {
  return (
    <div style={{ width: 180, borderRight: '1px solid #e0e0e0', padding: '12px 8px', overflowY: 'auto' }}>
      <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', margin: '4px 8px 6px' }}>Locais</p>
      {locations.map((loc) => {
        const Icon = ICON_BY_LABEL[loc.label] ?? MdFolder;
        const active = loc.path === currentPath;
        return (
          <button
            key={loc.path}
            onClick={() => onNavigate(loc.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              textAlign: 'left',
              padding: '6px 8px',
              border: 'none',
              borderRadius: 6,
              background: active ? '#e8f0fe' : 'transparent',
              color: active ? '#1a73e8' : '#333',
              cursor: 'pointer',
              fontSize: 13,
              marginBottom: 2,
            }}
          >
            <Icon size={16} />
            {loc.label}
          </button>
        );
      })}

      <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', margin: '16px 8px 6px' }}>Lixeira</p>
      <button
        onClick={onOpenTrash}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
          padding: '6px 8px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
          background: viewingTrash ? '#e8f0fe' : 'transparent', color: viewingTrash ? '#1a73e8' : '#333',
        }}
      >
        <MdDelete size={16} />
        Lixeira
      </button>
    </div>
  );
}

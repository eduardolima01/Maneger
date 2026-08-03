import { useTabs, tabBreadcrumb } from './tabStore';

export default function TabBreadcrumbBar() {
  const { tabs, activeTabId } = useTabs();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  if (!activeTab) return null; // "Início" não tem breadcrumb de aba

  return (
    <div style={{
      padding: '4px 16px', fontSize: 12, color: '#888',
      borderBottom: '1px solid #f0f0f0', background: '#fcfcfc',
    }}>
      {tabBreadcrumb(activeTab).join(' / ')}
    </div>
  );
}

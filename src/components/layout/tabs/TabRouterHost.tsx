import { RouterProvider } from '@tanstack/react-router';
import { useTabs } from './tabStore';

export default function TabRouterHost() {
  const { tabs, activeTabId } = useTabs();

  return (
    <>
      {tabs.map((tab) => (
        <div key={tab.id} style={{ display: tab.id === activeTabId ? 'block' : 'none', height: '100%' }}>
          <RouterProvider router={tab.router} />
        </div>
      ))}
    </>
  );
}

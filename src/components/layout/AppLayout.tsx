import { Outlet } from '@tanstack/react-router'
import { Aside } from './Aside/Aside'

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Aside />

      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

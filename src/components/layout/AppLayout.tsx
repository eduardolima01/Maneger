import { Outlet } from '@tanstack/react-router'
import { Aside } from './Aside'

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Aside />

      <main className="flex-1 overflow-y-auto bg-zinc-950 p-6">
        <Outlet />
      </main>
    </div>
  )
}

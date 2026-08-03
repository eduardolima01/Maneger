import { Outlet } from '@tanstack/react-router'

// root "nu" usado só pelas árvores de rota das abas — sem Aside/TabBar/widgets (isso já existe uma vez só, no AppLayout)
export function TabRootLayout() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <Outlet />
    </div>
  )
}


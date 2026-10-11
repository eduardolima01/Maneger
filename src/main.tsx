import "./App.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router/'
import { ThemeProvider } from './providers/ThemeProvider'
import { getWorkModeKanbanId } from '@/Kanban/utils/workMode'

import ReactModal from 'react-modal';
import WorkModeWindow from "./Kanban/components/WorkModeWindow";
import ExplorerWindowPage from '@/FileExplorer/ExplorerWindowPage';
import { isExplorerWindow } from '@/FileExplorer/utils/explorerWindowUrl';
ReactModal.setAppElement('#root');

// Janela do modo trabalho: renderiza SÓ o kanban (sem router, sem sidebar, sem abas do app).
const workKanbanId = getWorkModeKanbanId();

// Janela separada do Explorador: também SÓ o explorador (sem router, sem sidebar, sem abas do app),
// mas dentro do ThemeProvider pra o modo escuro (classe `dark`) funcionar nela.
const explorerWindow = !workKanbanId && isExplorerWindow(window.location.search);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {workKanbanId ? (
      <WorkModeWindow initialKanbanId={workKanbanId} />
    ) : explorerWindow ? (
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <ExplorerWindowPage />
      </ThemeProvider>
    ) : (
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <RouterProvider router={router} />
      </ThemeProvider >
    )}
  </React.StrictMode>,
);

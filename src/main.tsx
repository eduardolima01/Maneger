import "./App.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router/'
import { ThemeProvider } from './providers/ThemeProvider'

import ReactModal from 'react-modal';
ReactModal.setAppElement('#root');

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <RouterProvider router={router} />
    </ThemeProvider >
  </React.StrictMode>,
);

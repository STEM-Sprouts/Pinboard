import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthCallbackPage, NewProjectRedirect, ProjectsPage, SettingsPage } from './app/routes.tsx'
import EditorRoute from './app/EditorRoute.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/editor/new" element={<NewProjectRedirect />} />
        <Route path="/editor/:localId" element={<EditorRoute />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)

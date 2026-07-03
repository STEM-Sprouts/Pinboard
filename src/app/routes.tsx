/**
 * Client routes (ARCHITECTURE §6). All routes are client-side; the host
 * rewrites every non-API path to index.html (vercel.json). The editor stays
 * fully local-first (ADR-0006): /projects lists LocalStorage projects and,
 * when signed in, the account's cloud projects; /auth/callback is the
 * Supabase OAuth landing spot (ADR-0007 — optional, never the critical path).
 */
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LocalProjectStore } from '../persistence/localProjectStore';
import type { PinboardProjectDocument } from '../persistence/projectDocument';
import { getSupabase } from '../supabase/client';
import { loadCloudProjects, supabaseProjectPort, type CloudProject } from '../supabase/projectRepository';

/** /editor/new → a fresh local project id; the editor creates the starter. */
export function NewProjectRedirect() {
  return <Navigate to={`/editor/${crypto.randomUUID()}`} replace />;
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const [store] = useState(() => new LocalProjectStore(window.localStorage));
  const [projects] = useState<PinboardProjectDocument[]>(() =>
    store
      .recentIds()
      .map((id) => store.load(id))
      .filter((doc): doc is PinboardProjectDocument => doc !== null),
  );
  const [cloudProjects, setCloudProjects] = useState<CloudProject[]>([]);
  const [cloudNote, setCloudNote] = useState('');

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    let cancelled = false;
    void client.auth.getSession().then(async ({ data }) => {
      if (!data.session || cancelled) return;
      const result = await loadCloudProjects(supabaseProjectPort(client));
      if (cancelled) return;
      if (result.ok) setCloudProjects(result.projects);
      else setCloudNote('Could not load cloud projects — local projects are unaffected.');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const localIds = new Set(projects.map((doc) => doc.metadata.id));
  // Cloud-only rows: not already on this device.
  const cloudOnly = cloudProjects.filter(
    (p) => !localIds.has(p.document.metadata.id) && !localIds.has(p.document.metadata.cloudProjectId ?? ''),
  );

  const openCloudProject = (project: CloudProject) => {
    // Materialize locally, then open — local save stays authoritative.
    store.save(project.document);
    navigate(`/editor/${project.document.metadata.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-ink mb-1">Your projects</h1>
      <p className="text-sm text-gray-500 mb-6">
        Stored in this browser{cloudProjects.length > 0 ? ' and your account' : ''}. Export a{' '}
        <code>.pinboard.json</code> from the editor for a durable backup.
      </p>
      <Link
        to="/editor/new"
        className="ss-btn ss-btn-primary inline-flex mb-6 px-4 py-2"
      >
        Start building
      </Link>
      {cloudNote && <p className="text-xs text-amber-600 mb-3">{cloudNote}</p>}
      <ul className="space-y-2" data-testid="project-list">
        {projects.map((doc) => (
          <li key={doc.metadata.id}>
            <Link
              to={`/editor/${doc.metadata.id}`}
              className="ss-card block px-4 py-3 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_#111] transition-all"
            >
              <span className="font-medium text-gray-800">{doc.metadata.title}</span>
              {doc.metadata.cloudProjectId && <span className="ml-2 text-xs text-blue-600">☁ synced</span>}
              <span className="ml-2 text-xs text-gray-500">
                updated {new Date(doc.metadata.updatedAt).toLocaleString()}
              </span>
            </Link>
          </li>
        ))}
        {cloudOnly.map((project) => (
          <li key={`cloud-${project.document.metadata.id}`}>
            <button
              onClick={() => openCloudProject(project)}
              className="ss-card w-full text-left px-4 py-3 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_#111] transition-all"
            >
              <span className="font-medium text-gray-800">{project.document.metadata.title}</span>
              <span className="ml-2 text-xs text-blue-600">☁ cloud</span>
              <span className="ml-2 text-xs text-gray-500">
                updated {new Date(project.updatedAt).toLocaleString()}
              </span>
            </button>
          </li>
        ))}
        {projects.length === 0 && cloudOnly.length === 0 && (
          <li className="text-sm text-gray-500">No projects yet.</li>
        )}
      </ul>
    </div>
  );
}

/** Supabase OAuth redirect target. supabase-js consumes the tokens from the
 * URL on client creation; we wait for the session, then return to the
 * editor. Unconfigured or failed sign-in returns to the editor too — auth
 * is never required to keep working (ADR-0007). */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  useEffect(() => {
    const client = getSupabase();
    if (!client) {
      navigate('/', { replace: true });
      return;
    }
    void client.auth.getSession().finally(() => navigate('/', { replace: true }));
  }, [navigate]);
  return <p className="p-8 text-sm text-gray-500">Finishing sign-in…</p>;
}

export function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-ink mb-2">Settings</h1>
      <p className="text-sm text-gray-500">
        Account settings arrive with cloud save. Everything else lives in the editor —{' '}
        <Link to="/" className="text-accent underline">
          back to building
        </Link>
        .
      </p>
    </div>
  );
}

/**
 * Client routes (ARCHITECTURE §6). All routes are client-side; the host
 * rewrites every non-API path to index.html (vercel.json). The editor stays
 * fully local-first (ADR-0006): /projects lists LocalStorage projects today
 * and gains cloud projects in Phase 2; /auth/callback is the Supabase OAuth
 * landing spot (ADR-0007 — optional, never the critical path).
 */
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LocalProjectStore } from '../persistence/localProjectStore';
import type { PinboardProjectDocument } from '../persistence/projectDocument';
import { getSupabase } from '../supabase/client';

/** /editor/new → a fresh local project id; the editor creates the starter. */
export function NewProjectRedirect() {
  return <Navigate to={`/editor/${crypto.randomUUID()}`} replace />;
}

export function ProjectsPage() {
  const [projects] = useState<PinboardProjectDocument[]>(() => {
    const store = new LocalProjectStore(window.localStorage);
    return store
      .recentIds()
      .map((id) => store.load(id))
      .filter((doc): doc is PinboardProjectDocument => doc !== null);
  });

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Your projects</h1>
      <p className="text-sm text-gray-500 mb-6">
        Stored in this browser. Export a <code>.pinboard.json</code> from the editor for a durable backup.
      </p>
      <Link
        to="/editor/new"
        className="inline-block mb-6 px-4 py-2 bg-accent text-white rounded-md font-semibold hover:bg-[#008f6b]"
      >
        Start building
      </Link>
      <ul className="space-y-2" data-testid="project-list">
        {projects.map((doc) => (
          <li key={doc.metadata.id}>
            <Link
              to={`/editor/${doc.metadata.id}`}
              className="block px-4 py-3 bg-surface border border-gray-200 rounded-md hover:border-gray-400"
            >
              <span className="font-medium text-gray-800">{doc.metadata.title}</span>
              <span className="ml-2 text-xs text-gray-400">
                updated {new Date(doc.metadata.updatedAt).toLocaleString()}
              </span>
            </Link>
          </li>
        ))}
        {projects.length === 0 && <li className="text-sm text-gray-500">No projects yet.</li>}
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
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Settings</h1>
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

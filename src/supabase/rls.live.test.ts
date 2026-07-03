/**
 * Live RLS tests (supabase.md §3, testing.md §5) — the Phase-2 security
 * exit test: user A cannot read, update, or delete user B's project.
 *
 * Runs against the real Supabase project using two ANONYMOUS sessions
 * (anonymous auth must be enabled). Skipped automatically when the env
 * keys are absent (CI without secrets, fresh clones).
 */
import { afterAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const configured = Boolean(url && anonKey);

function client(): SupabaseClient {
  return createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
}

const cleanups: Array<() => Promise<void>> = [];

afterAll(async () => {
  for (const cleanup of cleanups) await cleanup();
});

describe.skipIf(!configured)('RLS: projects are private to their owner', () => {
  it('user A saves a project; user B cannot see, update, or delete it', async () => {
    const a = client();
    const b = client();
    const { data: aAuth, error: aErr } = await a.auth.signInAnonymously();
    const { error: bErr } = await b.auth.signInAnonymously();
    expect(aErr).toBeNull();
    expect(bErr).toBeNull();

    const projectId = crypto.randomUUID();
    cleanups.push(async () => {
      await a.from('projects').delete().eq('id', projectId);
      await a.auth.signOut();
      await b.auth.signOut();
    });

    // A inserts and reads back their own project.
    const { error: insertErr } = await a.from('projects').insert({
      id: projectId,
      owner_id: aAuth.user!.id,
      title: 'rls-test',
      project_doc: { rls: 'test' },
      project_hash: 'rls-test-hash',
    });
    expect(insertErr).toBeNull();
    const { data: aRows } = await a.from('projects').select('id').eq('id', projectId);
    expect(aRows).toHaveLength(1);

    // B sees nothing: not in a list, not by id.
    const { data: bList } = await b.from('projects').select('id');
    expect(bList).toEqual([]);
    const { data: bById } = await b.from('projects').select('id').eq('id', projectId);
    expect(bById).toEqual([]);

    // B cannot update or delete A's row (RLS silently affects 0 rows).
    await b.from('projects').update({ title: 'hijacked' }).eq('id', projectId);
    await b.from('projects').delete().eq('id', projectId);
    const { data: intact } = await a.from('projects').select('title').eq('id', projectId);
    expect(intact).toEqual([{ title: 'rls-test' }]);
  }, 30_000);

  it('user B cannot insert a project owned by user A (forged owner_id)', async () => {
    const a = client();
    const b = client();
    const { data: aAuth } = await a.auth.signInAnonymously();
    await b.auth.signInAnonymously();
    cleanups.push(async () => {
      await a.auth.signOut();
      await b.auth.signOut();
    });

    const { error } = await b.from('projects').insert({
      id: crypto.randomUUID(),
      owner_id: aAuth.user!.id, // forged
      title: 'forged',
      project_doc: {},
      project_hash: 'x',
    });
    expect(error).not.toBeNull();
  }, 30_000);
});

describe.skipIf(!configured)('cloud save round-trip (Phase-2 exit)', () => {
  it('save → dedup-skip → load returns the document', async () => {
    const { createLocalProject } = await import('../persistence/projectDocument');
    const { starterComponents, starterWorkspaceJson } = await import('../editor/starterProject');
    const { loadCloudProjects, saveProjectToCloud, supabaseProjectPort } = await import('./projectRepository');

    const c = client();
    const { data: auth } = await c.auth.signInAnonymously();
    const port = supabaseProjectPort(c);
    const doc = createLocalProject(
      crypto.randomUUID(),
      starterWorkspaceJson,
      new Date().toISOString(),
      'roundtrip-test',
      starterComponents,
    );
    cleanups.push(async () => {
      await c.from('projects').delete().eq('id', doc.metadata.id);
      await c.auth.signOut();
    });

    const saved = await saveProjectToCloud(port, doc, auth.user!.id);
    expect(saved.status).toBe('saved');
    if (saved.status !== 'saved') return;

    // Same content → hash dedup skips the write.
    const again = await saveProjectToCloud(port, doc, auth.user!.id, saved.hash);
    expect(again.status).toBe('skipped');

    const list = await loadCloudProjects(port);
    if (!list.ok) throw new Error(list.error);
    const found = list.projects.find((p) => p.document.metadata.id === doc.metadata.id);
    expect(found?.document.metadata.title).toBe('roundtrip-test');
  }, 30_000);
});

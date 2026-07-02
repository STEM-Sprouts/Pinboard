/**
 * Repository logic against a fake port (testing.md §1 "Supabase adapter
 * mocks"): hash dedup, failure reporting (never throwing — local work is
 * authoritative), and row validation that drops bad rows without hiding
 * good ones.
 */
import { describe, expect, it } from 'vitest';
import { starterComponents, starterWorkspaceJson } from '../editor/starterProject';
import { createLocalProject } from '../persistence/projectDocument';
import { hashProject } from '../persistence/projectHash';
import {
  loadCloudProjects,
  saveProjectToCloud,
  type ProjectCloudPort,
  type ProjectUpsert,
} from './projectRepository';

const NOW = '2026-07-02T00:00:00.000Z';
const doc = () => createLocalProject('p1', starterWorkspaceJson, NOW, 'Cloud Test', starterComponents);

function fakePort(overrides: Partial<ProjectCloudPort> = {}) {
  const upserts: ProjectUpsert[] = [];
  const port: ProjectCloudPort = {
    async upsertProject(row) {
      upserts.push(row);
      return { error: null };
    },
    async listProjects() {
      return { data: [], error: null };
    },
    ...overrides,
  };
  return { port, upserts };
}

describe('saveProjectToCloud', () => {
  it('saves and returns the normalized hash', async () => {
    const { port, upserts } = fakePort();
    const result = await saveProjectToCloud(port, doc(), 'user-a');
    expect(result.status).toBe('saved');
    expect(upserts).toHaveLength(1);
    expect(upserts[0].owner_id).toBe('user-a');
    expect(upserts[0].project_hash).toBe(await hashProject(doc()));
  });

  it('skips the write when the hash is unchanged (dedup)', async () => {
    const { port, upserts } = fakePort();
    const hash = await hashProject(doc());
    const result = await saveProjectToCloud(port, doc(), 'user-a', hash);
    expect(result).toEqual({ status: 'skipped', hash });
    expect(upserts).toHaveLength(0);
  });

  it('reports a cloud failure without throwing', async () => {
    const { port } = fakePort({
      async upsertProject() {
        return { error: 'network down' };
      },
    });
    const result = await saveProjectToCloud(port, doc(), 'user-a');
    expect(result).toEqual({ status: 'error', error: 'network down' });
  });
});

describe('loadCloudProjects', () => {
  it('validates rows and drops malformed ones without hiding the rest', async () => {
    const good = {
      id: 'p1',
      title: 'Cloud Test',
      project_doc: doc(),
      project_hash: 'h1',
      updated_at: NOW,
    };
    const { port } = fakePort({
      async listProjects() {
        return { data: [{ nonsense: true }, good, { id: 'p2', title: 'bad doc', project_doc: 42, project_hash: 'h', updated_at: NOW }], error: null };
      },
    });
    const result = await loadCloudProjects(port);
    if (!result.ok) throw new Error('expected ok');
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].document.metadata.title).toBe('Cloud Test');
  });

  it('reports a list failure', async () => {
    const { port } = fakePort({
      async listProjects() {
        return { data: [], error: 'RLS says no' };
      },
    });
    expect(await loadCloudProjects(port)).toEqual({ ok: false, error: 'RLS says no' });
  });
});

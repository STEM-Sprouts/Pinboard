/**
 * Persistence tests (implemenation_plam/persistence.md, testing.md §1):
 * round-trip import/export, malformed imports fail safely, storage failures
 * never throw, migration rejects unknown versions.
 */
import { describe, expect, it } from 'vitest';
import { starterWorkspaceJson } from '../editor/starterProject';
import { exportFileName, exportProjectJson, importProjectJson } from './importExport';
import { LocalProjectStore, type StorageLike } from './localProjectStore';
import { migrateProject } from './migrations';
import { createLocalProject } from './projectDocument';

const NOW = '2026-07-02T00:00:00.000Z';

function makeDoc(id = 'p1') {
  return createLocalProject(id, starterWorkspaceJson, NOW, 'Blink Demo');
}

function fakeStorage(overrides?: Partial<StorageLike>): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    ...overrides,
  };
}

describe('import/export', () => {
  it('round-trips a project document exactly', () => {
    const doc = makeDoc();
    const result = importProjectJson(exportProjectJson(doc));
    expect(result).toEqual({ ok: true, document: doc });
  });

  it('rejects non-JSON safely', () => {
    const result = importProjectJson('not json at all {');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not valid JSON');
  });

  it('rejects JSON that is not a project', () => {
    const result = importProjectJson(JSON.stringify({ hello: 'world' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Unsupported project version');
  });

  it('rejects a structurally broken v1 project with a located error', () => {
    const broken = { ...makeDoc(), settings: { editorMode: 'wizard' } };
    const result = importProjectJson(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('settings');
  });

  it('derives a safe export filename from the title', () => {
    expect(exportFileName(makeDoc())).toBe('blink-demo.pinboard.json');
    const untitled = { ...makeDoc(), metadata: { ...makeDoc().metadata, title: '???' } };
    expect(exportFileName(untitled)).toBe('pinboard-project.pinboard.json');
  });
});

describe('migrateProject', () => {
  it('rejects non-objects', () => {
    expect(() => migrateProject('a string')).toThrow('not a Pinboard project');
    expect(() => migrateProject(null)).toThrow('not a Pinboard project');
    expect(() => migrateProject([1, 2])).toThrow('not a Pinboard project');
  });

  it('rejects unknown schema versions', () => {
    expect(() => migrateProject({ schemaVersion: 99 })).toThrow('Unsupported project version: 99');
  });
});

describe('LocalProjectStore', () => {
  it('saves, loads, and tracks last-opened + recents', () => {
    const store = new LocalProjectStore(fakeStorage());
    const a = makeDoc('a');
    const b = makeDoc('b');
    expect(store.save(a)).toEqual({ ok: true });
    expect(store.save(b)).toEqual({ ok: true });
    expect(store.load('a')).toEqual(a);
    expect(store.loadLastOpened()).toEqual(b);
    expect(store.recentIds()).toEqual(['b', 'a']);

    expect(store.save(a)).toEqual({ ok: true }); // re-save moves to front
    expect(store.recentIds()).toEqual(['a', 'b']);
  });

  it('a storage write failure returns an error instead of throwing', () => {
    const store = new LocalProjectStore(
      fakeStorage({
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      }),
    );
    const result = store.save(makeDoc());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('QuotaExceededError');
  });

  it('corrupt stored data loads as null, never throws', () => {
    const storage = fakeStorage();
    storage.setItem('pinboard:project:evil', '{broken json');
    storage.setItem('pinboard:last-opened-project-id', 'evil');
    const store = new LocalProjectStore(storage);
    expect(store.load('evil')).toBeNull();
    expect(store.loadLastOpened()).toBeNull();
  });
});

/**
 * Project-hash normalization (persistence.md §4): hash only the semantic
 * fields (board, workspace data, components, wiring, settings, title) and
 * exclude volatile/derived ones (timestamps, generated C, IR, source maps).
 * If every autosave changed the hash, cloud dedup would do nothing.
 */
import { describe, expect, it } from 'vitest';
import { starterComponents, starterWorkspaceJson } from '../editor/starterProject';
import { hashProject } from './projectHash';
import { createLocalProject, type PinboardProjectDocument } from './projectDocument';

const NOW = '2026-07-02T00:00:00.000Z';
const LATER = '2026-07-02T12:34:56.000Z';

function doc(): PinboardProjectDocument {
  return createLocalProject('p1', starterWorkspaceJson, NOW, 'My Project', starterComponents);
}

describe('hashProject', () => {
  it('is stable across identical documents', async () => {
    expect(await hashProject(doc())).toBe(await hashProject(doc()));
  });

  it('ignores volatile fields: updatedAt/createdAt changes keep the hash', async () => {
    const a = doc();
    const b = doc();
    b.metadata.updatedAt = LATER;
    b.metadata.createdAt = LATER;
    expect(await hashProject(b)).toBe(await hashProject(a));
  });

  it('changes when semantic fields change', async () => {
    const base = await hashProject(doc());

    const retitled = doc();
    retitled.metadata.title = 'Renamed';
    expect(await hashProject(retitled)).not.toBe(base);

    const rewired = doc();
    rewired.hardware.components = rewired.hardware.components.map((c) =>
      c.type === 'led' ? { ...c, pins: { ...c.pins, signal: 'D9' as const } } : c,
    );
    expect(await hashProject(rewired)).not.toBe(base);

    const remoded = doc();
    remoded.settings = { ...remoded.settings, editorMode: 'advanced' };
    expect(await hashProject(remoded)).not.toBe(base);
  });

  it('is insensitive to object key order in the workspace data', async () => {
    const a = doc();
    const b = doc();
    b.workspace = { data: (b.workspace as { data: unknown }).data, format: 'blockly-json' };
    expect(await hashProject(b)).toBe(await hashProject(a));
  });
});

/**
 * Normalized project hash (persistence.md §4). Hashes only the semantic
 * fields — board, workspace data, hardware, settings, title — with object
 * keys sorted, so volatile fields (timestamps) and key order can never
 * change the hash. Used to skip no-op cloud writes.
 */
import type { PinboardProjectDocument } from './projectDocument';

/** JSON.stringify with object keys sorted at every depth. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function hashProject(doc: PinboardProjectDocument): Promise<string> {
  const semantic = {
    schemaVersion: doc.schemaVersion,
    title: doc.metadata.title,
    description: doc.metadata.description,
    board: doc.board,
    workspace: doc.workspace,
    hardware: doc.hardware,
    settings: doc.settings,
    lessons: doc.lessons,
  };
  const bytes = new TextEncoder().encode(canonicalJson(semantic));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

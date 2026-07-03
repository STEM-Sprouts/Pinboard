/**
 * `.pinboard.json` import/export (implemenation_plam/persistence.md §5).
 * The export file is the durable, portable backup — treat it as important
 * as cloud save. Import never throws: it returns a result the UI can show.
 */
import { migrateProject } from './migrations';
import type { PinboardProjectDocument } from './projectDocument';

export type ImportResult =
  | { ok: true; document: PinboardProjectDocument }
  | { ok: false; error: string };

export function importProjectJson(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  try {
    return { ok: true, document: migrateProject(parsed) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function exportProjectJson(document: PinboardProjectDocument): string {
  return JSON.stringify(document, null, 2);
}

export function exportFileName(document: PinboardProjectDocument): string {
  const slug = document.metadata.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'pinboard-project'}.pinboard.json`;
}

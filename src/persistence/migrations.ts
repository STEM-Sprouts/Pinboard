/**
 * Schema-versioned migration (implemenation_plam/persistence.md §5).
 * Every load path — LocalStorage, import, future cloud rows — goes through
 * here. A malformed document throws a user-presentable Error and must never
 * corrupt the editor.
 */
import type { PinboardProjectDocument } from './projectDocument';
import { PinboardProjectSchema } from './schemas';

export function migrateProject(raw: unknown): PinboardProjectDocument {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('This file is not a Pinboard project.');
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  switch (version) {
    case 1: {
      const parsed = PinboardProjectSchema.safeParse(raw);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        const where = first && first.path.length > 0 ? ` (at ${first.path.join('.')})` : '';
        throw new Error(`Invalid project file: ${first?.message ?? 'unknown error'}${where}`);
      }
      // Shape is validated; PinId narrowing inside components/wiring is a
      // diagnostics concern (see schemas.ts header note).
      return parsed.data as PinboardProjectDocument;
    }
    default:
      throw new Error(`Unsupported project version: ${String(version)}`);
  }
}

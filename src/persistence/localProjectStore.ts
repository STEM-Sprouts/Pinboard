/**
 * LocalStorage project store (implemenation_plam/persistence.md §3).
 * Local save is authoritative and workshop-safe: a failure warns and offers
 * export — it never crashes and never silently discards work.
 *
 * Storage is injected so the store tests headless with a fake.
 */
import { migrateProject } from './migrations';
import type { PinboardProjectDocument } from './projectDocument';

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type SaveResult = { ok: true } | { ok: false; error: string };

const KEY_RECENT_IDS = 'pinboard:recent-project-ids';
const KEY_LAST_OPENED = 'pinboard:last-opened-project-id';
const MAX_RECENT = 20;
const projectKey = (id: string) => `pinboard:project:${id}`;

export class LocalProjectStore {
  private storage: StorageLike;

  constructor(storage: StorageLike) {
    this.storage = storage;
  }

  save(document: PinboardProjectDocument): SaveResult {
    try {
      this.storage.setItem(projectKey(document.metadata.id), JSON.stringify(document));
      const recent = [document.metadata.id, ...this.recentIds().filter((id) => id !== document.metadata.id)];
      this.storage.setItem(KEY_RECENT_IDS, JSON.stringify(recent.slice(0, MAX_RECENT)));
      this.storage.setItem(KEY_LAST_OPENED, document.metadata.id);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /** Missing or invalid stored data returns null; it never throws. */
  load(id: string): PinboardProjectDocument | null {
    try {
      const raw = this.storage.getItem(projectKey(id));
      if (raw === null) return null;
      return migrateProject(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  loadLastOpened(): PinboardProjectDocument | null {
    try {
      const id = this.storage.getItem(KEY_LAST_OPENED);
      return id ? this.load(id) : null;
    } catch {
      return null;
    }
  }

  recentIds(): string[] {
    try {
      const raw = this.storage.getItem(KEY_RECENT_IDS);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }
}

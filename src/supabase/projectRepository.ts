/**
 * Cloud project repository (persistence.md §4, supabase.md §2).
 *
 * The save/load logic runs against a narrow `ProjectCloudPort`, so it unit
 * tests with a fake and never couples to supabase-js call chains. Rules:
 * hash dedup skips no-op writes; every row is Zod-validated on the way in
 * (never trust the network); a cloud failure is reported, never thrown —
 * local work is authoritative and untouched (ADR-0006).
 */
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hashProject } from '../persistence/projectHash';
import { migrateProject } from '../persistence/migrations';
import type { PinboardProjectDocument } from '../persistence/projectDocument';

export type ProjectUpsert = {
  id: string;
  owner_id: string;
  title: string;
  board_id: string;
  schema_version: number;
  project_doc: unknown;
  project_hash: string;
  updated_at: string;
};

export type ProjectCloudPort = {
  upsertProject(row: ProjectUpsert): Promise<{ error: string | null }>;
  listProjects(): Promise<{ data: unknown[]; error: string | null }>;
};

const ProjectRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  project_doc: z.unknown(),
  project_hash: z.string(),
  updated_at: z.string(),
});

export type CloudSaveResult =
  | { status: 'saved'; hash: string }
  | { status: 'skipped'; hash: string }
  | { status: 'error'; error: string };

export async function saveProjectToCloud(
  port: ProjectCloudPort,
  doc: PinboardProjectDocument,
  ownerId: string,
  lastSyncedHash?: string,
): Promise<CloudSaveResult> {
  const hash = await hashProject(doc);
  if (hash === lastSyncedHash) return { status: 'skipped', hash };
  const { error } = await port.upsertProject({
    id: doc.metadata.id,
    owner_id: ownerId,
    title: doc.metadata.title,
    board_id: doc.board.id,
    schema_version: doc.schemaVersion,
    project_doc: doc,
    project_hash: hash,
    updated_at: new Date().toISOString(),
  });
  if (error !== null) return { status: 'error', error };
  return { status: 'saved', hash };
}

export type CloudProject = { document: PinboardProjectDocument; hash: string; updatedAt: string };

/** Invalid rows are dropped, not fatal — one bad row must not hide the rest. */
export async function loadCloudProjects(port: ProjectCloudPort): Promise<
  { ok: true; projects: CloudProject[] } | { ok: false; error: string }
> {
  const { data, error } = await port.listProjects();
  if (error !== null) return { ok: false, error };
  const projects: CloudProject[] = [];
  for (const raw of data) {
    const row = ProjectRowSchema.safeParse(raw);
    if (!row.success) continue;
    try {
      projects.push({
        document: migrateProject(row.data.project_doc),
        hash: row.data.project_hash,
        updatedAt: row.data.updated_at,
      });
    } catch {
      continue;
    }
  }
  return { ok: true, projects };
}

export function supabaseProjectPort(client: SupabaseClient): ProjectCloudPort {
  return {
    async upsertProject(row) {
      const { error } = await client.from('projects').upsert(row);
      return { error: error ? error.message : null };
    },
    async listProjects() {
      const { data, error } = await client
        .from('projects')
        .select('id, title, project_doc, project_hash, updated_at')
        .order('updated_at', { ascending: false });
      return { data: data ?? [], error: error ? error.message : null };
    },
  };
}

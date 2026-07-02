/**
 * Env-gated Supabase client (ADR-0006/0007). With no VITE_SUPABASE_URL /
 * VITE_SUPABASE_ANON_KEY the client is null, every cloud affordance stays
 * hidden, and the editor is exactly the local-first app — cloud is an
 * enhancement, never a dependency. Only the anon key ever reaches the
 * browser; service-role keys stay server-side (supabase.md §6).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  cached = url && anonKey ? createClient(url, anonKey) : null;
  return cached;
}

export function isCloudConfigured(): boolean {
  return getSupabase() !== null;
}

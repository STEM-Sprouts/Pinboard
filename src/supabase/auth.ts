/**
 * Auth wrappers (supabase.md §1, ADR-0007). Google OAuth, email magic link,
 * and email/password auth all degrade to "not configured" without env
 * keys. Sign-in exists for cloud save only — it is never the workshop
 * critical path, and a failure here must leave the local editor untouched.
 */
import { getSupabase } from './client';

export type AuthUser = { id: string; email: string | null; displayName: string | null };

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const client = getSupabase();
  if (!client) return { error: 'Cloud save is not configured.' };
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  return { error: error?.message ?? null };
}

export async function signInWithMagicLink(email: string): Promise<{ error: string | null }> {
  const client = getSupabase();
  if (!client) return { error: 'Cloud save is not configured.' };
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  return { error: error?.message ?? null };
}

export async function signUpWithPassword(email: string, password: string): Promise<{ error: string | null }> {
  const client = getSupabase();
  if (!client) return { error: 'Cloud save is not configured.' };
  const { error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  return { error: error?.message ?? null };
}

export async function signInWithPassword(email: string, password: string): Promise<{ error: string | null }> {
  const client = getSupabase();
  if (!client) return { error: 'Cloud save is not configured.' };
  const { error } = await client.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
}

/** Current user, or null when signed out or cloud is unconfigured. */
export async function getUser(): Promise<AuthUser | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  const user = data.session?.user;
  return user
    ? {
        id: user.id,
        email: user.email ?? null,
        displayName:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          user.email ??
          'Signed in',
      }
    : null;
}

/** Subscribes to auth changes; returns an unsubscribe. No-op unconfigured. */
export function onAuthChange(listener: (user: AuthUser | null) => void): () => void {
  const client = getSupabase();
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    const user = session?.user;
    listener(
      user
        ? {
            id: user.id,
            email: user.email ?? null,
            displayName:
              (user.user_metadata?.full_name as string | undefined) ??
              (user.user_metadata?.name as string | undefined) ??
              user.email ??
              'Signed in',
          }
        : null,
    );
  });
  return () => data.subscription.unsubscribe();
}

/**
 * Sign-in affordance (ADR-0007): rendered only when cloud save is
 * configured, so the default local-first build shows nothing. Sign-in is a
 * bonus for cloud sync — the primary CTA everywhere else stays
 * "start building".
 */
import { useEffect, useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { isCloudConfigured } from '../supabase/client';
import { getUser, onAuthChange, signInWithGoogle, signOut, type AuthUser } from '../supabase/auth';

export default function AccountControl() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!isCloudConfigured()) return;
    void getUser().then(setUser);
    return onAuthChange(setUser);
  }, []);

  if (!isCloudConfigured()) return null;

  if (user) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500" data-testid="account-email">{user.email ?? 'Signed in'}</span>
        <button
          onClick={() => void signOut()}
          className="ss-btn ss-btn-ghost px-3 py-1.5 text-sm"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        data-testid="sign-in"
        onClick={() => {
          void signInWithGoogle().then(({ error }) => {
            // A blocked/failed OAuth never blocks local use (ADR-0007).
            if (error) setNote('Sign-in unavailable — your work stays saved locally.');
          });
        }}
        className="ss-btn ss-btn-ghost px-3 py-1.5 text-sm"
      >
        <LogIn size={14} /> Sign in
      </button>
      {note && <span className="text-xs text-amber-600">{note}</span>}
    </div>
  );
}

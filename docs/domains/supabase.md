# Domain: Supabase (auth, schema, RLS, sharing)

Owns Supabase auth, the cloud schema, RLS policies, the share-token RPC, and cloud-side security/privacy. Governs ADR-0007. Optional path — never on the workshop critical path. Local-first rules live in `persistence.md`.

## 1. Auth design

OAuth supports students/teachers who want cloud save; it is **not** required to use the editor. The primary CTA is "Start building", not "Sign in."

| Method | MVP+ status | Notes |
|---|---|---|
| Google OAuth | Required | Likely for school accounts, but may need admin approval |
| Email magic link | Recommended | Backup if OAuth is blocked |
| Anonymous auth | Optional | Low-friction cloud save, but has recovery problems (§5) |
| Password accounts | Not needed | Friction + reset burden |

OAuth flow in Vite React (no Next.js server route needed):

```txt
Click "Sign in with Google"
→ supabase.auth.signInWithOAuth({ provider: 'google', redirectTo })
→ Google → /auth/callback (React route processes session)
→ return to editor or projects
```

**Critical:** OAuth must never be a hard dependency for a live workshop — Google Workspace admins can block unapproved third-party OAuth apps. Fallback: use local mode → export `.pinboard.json` → import later.

**Account linking:** when a local user signs in — keep the local project unchanged, ask "Save this project to your account?", create a cloud copy, store `cloudProjectId` in local metadata, keep the `.pinboard.json` export as backup. Do **not** silently upload all local projects on sign-in.

## 2. Schema

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'student'
    check (role in ('student', 'teacher', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  board_id text not null default 'arduino-uno',
  schema_version int not null default 1,
  project_doc jsonb not null,          -- PinboardProjectDocument (persistence.md)
  project_hash text not null,          -- normalized, volatile fields excluded
  visibility text not null default 'private'
    check (visibility in ('private', 'unlisted')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- optional
create table public.project_share_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- optional
create table public.compile_cache (
  id uuid primary key default gen_random_uuid(),
  source_hash text not null,
  board_fqbn text not null,
  status text not null check (status in ('success', 'error')),
  stdout text,
  stderr text,
  artifact_metadata jsonb,
  created_at timestamptz not null default now(),
  unique (source_hash, board_fqbn)
);
```

## 3. RLS policies (RLS is the security model — write and test these first)

```sql
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_share_tokens enable row level security;

create policy "Users can read own non-deleted projects"
on public.projects for select
using ( auth.uid() = owner_id and deleted_at is null );

create policy "Users can create own projects"
on public.projects for insert
with check ( auth.uid() = owner_id );

create policy "Users can update own projects"
on public.projects for update
using ( auth.uid() = owner_id )
with check ( auth.uid() = owner_id );

create policy "Users can delete own projects"
on public.projects for delete
using ( auth.uid() = owner_id );
```

Soft delete is just an update setting `deleted_at`; no duplicate soft-delete policy.

## 4. Share-token access (RPC, hashed tokens)

Do not expose raw tokens in table reads. Look up via a `SECURITY DEFINER` RPC with a pinned `search_path`:

```sql
create or replace function public.get_shared_project(share_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  token_hash text;
  result_doc jsonb;
begin
  token_hash := encode(digest(share_token, 'sha256'), 'hex');
  select p.project_doc into result_doc
  from public.project_share_tokens st
  join public.projects p on p.id = st.project_id
  where st.token_hash = token_hash
    and st.revoked_at is null
    and st.expires_at > now()
    and p.deleted_at is null
    and p.visibility = 'unlisted';
  if result_doc is null then return null; end if;
  return result_doc;
end;
$$;
```

Rules: hashed tokens · `SECURITY DEFINER` · pinned `search_path` · same generic failure for missing/expired/revoked (no existence/timing leak) · default expiry · read-only by default · remix requires auth or anonymous sign-in first.

## 5. Anonymous-auth caution (matters on shared Chromebooks)

If the browser is cleared, an anonymous user loses the auth ID and cloud projects become orphaned (no one can satisfy `auth.uid() = owner_id`). Mitigations: promote `.pinboard.json` export in the UI · steer durable users to Google/magic-link · set retention rules · run a server-side cleanup for stale anonymous projects · never tell anonymous users their cloud save is permanent.

## 6. Security & privacy (minors)

Data minimization — collect only anonymous/auth id, optional nickname, project content, session membership. Avoid by default: full name, email (student), school id, location, third-party trackers, public profiles. Private by default; unlisted shares only, no public gallery. Deletion and export must be obvious. Environment: expose only `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` to the browser; service-role keys stay server-side. Debounce cloud writes (2–5s), never per keystroke.

---

**Cross-refs:** project document → `persistence.md`. Compile cache is written by the compiler flow → `compiler.md`. RLS tests → `testing.md`.

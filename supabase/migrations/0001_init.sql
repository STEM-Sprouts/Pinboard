-- Pinboard cloud schema (docs/domains/supabase.md §2–4).
-- RLS is the security model: policies first, tested before features ship.
-- Apply with: supabase db push  (or run in the Supabase SQL editor)

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

create table public.project_share_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS -----------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_share_tokens enable row level security;

create policy "Users can read own profile"
on public.profiles for select
using ( auth.uid() = id );

create policy "Users can create own profile"
on public.profiles for insert
with check ( auth.uid() = id );

create policy "Users can update own profile"
on public.profiles for update
using ( auth.uid() = id )
with check ( auth.uid() = id );

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

create policy "Owners manage own share tokens"
on public.project_share_tokens for all
using ( auth.uid() = owner_id )
with check ( auth.uid() = owner_id );

-- Share-token lookup (supabase.md §4): hashed tokens, SECURITY DEFINER,
-- pinned search_path, one generic null for missing/expired/revoked.

create extension if not exists pgcrypto;

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

-- Portal access controls: disable/enable client logins, report invitation
-- status to staff, and keep an audit trail of portal access changes.

alter table public.users
  add column access_disabled_at timestamptz,
  add column access_disabled_by uuid references auth.users (id) on delete set null;

-- A disabled profile resolves to no role and no client, so every RLS policy
-- built on these helpers denies access immediately, even while the user's
-- current access token is still valid.
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select u.role
  from public.users as u
  where u.auth_id = (select auth.uid())
    and u.access_disabled_at is null
  limit 1
$$;

create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.client_id
  from public.users as u
  where u.auth_id = (select auth.uid())
    and u.role = 'client'
    and u.access_disabled_at is null
  limit 1
$$;

create type public.portal_event_type as enum (
  'invite_sent',
  'invite_resent',
  'access_disabled',
  'access_enabled'
);

create table public.client_portal_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  event public.portal_event_type not null,
  actor_auth_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index client_portal_events_client_created_idx
  on public.client_portal_events (client_id, created_at desc);

alter table public.client_portal_events enable row level security;
revoke all on public.client_portal_events from public, anon, authenticated;
grant select on public.client_portal_events to authenticated;
grant all on public.client_portal_events to service_role;

-- Events are written only by the server (service role); staff can read them.
create policy "Admins and team can view portal events"
  on public.client_portal_events for select to authenticated
  using (public.current_app_role() in ('admin', 'team_member'));

-- Portal login state for client profiles. auth.users is not exposed to the
-- API, so staff read the fields they need through this function.
create function public.client_portal_access(p_client_id uuid default null)
returns table (
  client_id uuid,
  auth_id uuid,
  invited_at timestamptz,
  last_sign_in_at timestamptz,
  password_set boolean,
  disabled_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.client_id,
    profile.auth_id,
    auth_user.invited_at,
    auth_user.last_sign_in_at,
    coalesce(auth_user.encrypted_password, '') <> '',
    profile.access_disabled_at
  from public.users as profile
  join auth.users as auth_user on auth_user.id = profile.auth_id
  where profile.role = 'client'
    and public.current_app_role() in ('admin', 'team_member')
    and (p_client_id is null or profile.client_id = p_client_id)
$$;

revoke all on function public.client_portal_access(uuid) from public, anon;
grant execute on function public.client_portal_access(uuid) to authenticated;

-- Signs a user out everywhere by deleting their sessions (refresh tokens are
-- removed with them). Server-side only.
create function public.revoke_user_sessions(p_auth_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.sessions where user_id = p_auth_id
$$;

revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

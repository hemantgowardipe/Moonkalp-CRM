-- Settings and audit trail.
--   organization_settings: single-row agency configuration (admin-managed).
--   user_preferences:      per-user appearance preferences (self-managed).
--   audit_log:             append-only change records written by triggers
--                          (ITIL change enablement / configuration records).

-- Shared trigger: keep updated_at accurate without relying on callers.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organization settings (exactly one row, enforced by the boolean key)
-- ---------------------------------------------------------------------------
create table public.organization_settings (
  id boolean primary key default true check (id),
  agency_name text not null default 'Moonkalp Studio'
    check (char_length(btrim(agency_name)) between 1 and 80),
  support_email text
    check (support_email is null or support_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  support_phone text
    check (support_phone is null or char_length(support_phone) <= 30),
  website_url text
    check (website_url is null or (website_url ~* '^https?://' and char_length(website_url) <= 200)),
  -- Default days between creating an invoice and its due date.
  payment_terms_days integer not null default 15 check (payment_terms_days between 0 and 120),
  -- Service level target: business days to respond to a client revision request.
  revision_turnaround_days integer not null default 2 check (revision_turnaround_days between 1 and 30),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.organization_settings (id) values (true);

create trigger organization_settings_updated_at
  before update on public.organization_settings
  for each row execute function public.set_updated_at();

alter table public.organization_settings enable row level security;
revoke all on public.organization_settings from public, anon, authenticated;
-- Clients read it too: the portal shows the agency name and support contact.
grant select, update on public.organization_settings to authenticated;
grant all on public.organization_settings to service_role;

create policy "Signed-in users can read organization settings"
  on public.organization_settings for select to authenticated
  using (public.current_app_role() is not null);

create policy "Admins can update organization settings"
  on public.organization_settings for update to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin' and updated_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- User preferences (each user manages only their own row)
-- ---------------------------------------------------------------------------
create table public.user_preferences (
  auth_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  density text not null default 'comfortable' check (density in ('comfortable', 'compact')),
  updated_at timestamptz not null default now()
);

create trigger user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from public, anon, authenticated;
grant select, insert, update on public.user_preferences to authenticated;
grant all on public.user_preferences to service_role;

create policy "Users can read their own preferences"
  on public.user_preferences for select to authenticated
  using (auth_id = (select auth.uid()));

create policy "Users can create their own preferences"
  on public.user_preferences for insert to authenticated
  with check (auth_id = (select auth.uid()));

create policy "Users can update their own preferences"
  on public.user_preferences for update to authenticated
  using (auth_id = (select auth.uid()))
  with check (auth_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Self-service profile edits. A table UPDATE policy on public.users would let
-- users change their own role, so name changes go through this function,
-- which can only touch full_name.
-- ---------------------------------------------------------------------------
create function public.update_my_profile(p_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned text := btrim(coalesce(p_full_name, ''));
begin
  if char_length(cleaned) not between 1 and 80 then
    raise exception 'Name must be between 1 and 80 characters' using errcode = '22023';
  end if;

  update public.users
  set full_name = cleaned
  where auth_id = (select auth.uid())
    and access_disabled_at is null;

  if not found then
    raise exception 'No active profile for the current user' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.update_my_profile(text) from public, anon;
grant execute on function public.update_my_profile(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Audit log: append-only change records
-- ---------------------------------------------------------------------------
create type public.audit_action as enum ('insert', 'update', 'delete');

create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  -- No foreign key: records must outlive the users and rows they describe.
  actor_auth_id uuid,
  actor_role text not null,
  entity text not null,
  entity_id text,
  action public.audit_action not null,
  changes jsonb not null default '{}'::jsonb
);

create index audit_log_occurred_idx on public.audit_log (occurred_at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id, occurred_at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from public, anon, authenticated, service_role;
grant select on public.audit_log to authenticated, service_role;

create policy "Admins can read the audit log"
  on public.audit_log for select to authenticated
  using (public.current_app_role() = 'admin');

-- Belt and braces: even the table owner cannot rewrite history through
-- normal statements.
create function public.prevent_audit_log_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only' using errcode = '42501';
end;
$$;

create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function public.prevent_audit_log_changes();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.prevent_audit_log_changes();

-- Records one row per change. For updates only the changed fields are kept
-- ({"field": {"from": ..., "to": ...}}); bookkeeping columns are ignored.
create function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  ignored text[] := array['updated_at', 'created_at'];
  diff jsonb := '{}'::jsonb;
  field text;
  actor uuid := auth.uid();
begin
  if tg_op = 'UPDATE' then
    for field in select jsonb_object_keys(new_row) loop
      if not (field = any (ignored)) and (old_row -> field) is distinct from (new_row -> field) then
        diff := diff || jsonb_build_object(field, jsonb_build_object('from', old_row -> field, 'to', new_row -> field));
      end if;
    end loop;
    if diff = '{}'::jsonb then
      return new;
    end if;
  elsif tg_op = 'INSERT' then
    diff := new_row - ignored;
  else
    diff := old_row - ignored;
  end if;

  insert into public.audit_log (actor_auth_id, actor_role, entity, entity_id, action, changes)
  values (
    actor,
    coalesce(public.current_app_role()::text, case when actor is null then 'system' else 'unknown' end),
    tg_table_name,
    coalesce(new_row, old_row) ->> 'id',
    lower(tg_op)::public.audit_action,
    diff
  );

  return coalesce(new, old);
end;
$$;

revoke all on function public.audit_row_change() from public, anon, authenticated;

create trigger audit_clients
  after insert or update or delete on public.clients
  for each row execute function public.audit_row_change();
create trigger audit_client_services
  after insert or update or delete on public.client_services
  for each row execute function public.audit_row_change();
create trigger audit_deliverables
  after insert or update or delete on public.deliverables
  for each row execute function public.audit_row_change();
create trigger audit_payments
  after insert or update or delete on public.payments
  for each row execute function public.audit_row_change();
create trigger audit_users
  after insert or update or delete on public.users
  for each row execute function public.audit_row_change();
create trigger audit_organization_settings
  after update on public.organization_settings
  for each row execute function public.audit_row_change();

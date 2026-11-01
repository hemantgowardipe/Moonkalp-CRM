create table public.client_portal_invitations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create unique index client_portal_invitations_pending_email_idx
  on public.client_portal_invitations (lower(email))
  where consumed_at is null;

alter table public.client_portal_invitations enable row level security;
revoke all on public.client_portal_invitations from public, anon, authenticated;
grant all on public.client_portal_invitations to service_role;

create or replace function public.handle_client_self_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  full_name text;
  company_name text;
  phone_number text;
  client_record_id uuid;
  invitation_id uuid;
begin
  if new.invited_at is null or new.email is null then
    return new;
  end if;

  select invitation.id, invitation.client_id, client.name, client.company_name
  into invitation_id, client_record_id, full_name, company_name
  from public.client_portal_invitations as invitation
  join public.clients as client on client.id = invitation.client_id
  where pg_catalog.lower(invitation.email) = pg_catalog.lower(new.email)
    and invitation.consumed_at is null
    and pg_catalog.lower(client.email) = pg_catalog.lower(new.email)
  for update of invitation;

  if invitation_id is null then
    return new;
  end if;

  insert into public.users (auth_id, email, full_name, role, client_id)
  values (new.id, new.email, full_name, 'client', client_record_id);

  if invitation_id is not null then
    update public.client_portal_invitations
    set consumed_at = now()
    where id = invitation_id;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_client_self_signup() from public, anon, authenticated;

drop trigger if exists on_auth_user_client_signup on auth.users;
create trigger on_auth_user_client_signup
  after insert on auth.users
  for each row
  execute function public.handle_client_self_signup();

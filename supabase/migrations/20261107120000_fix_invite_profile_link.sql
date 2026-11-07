-- Supabase Auth inserts an invited user first and sets invited_at in a later
-- UPDATE, so an insert-only trigger never sees invited_at and never links the
-- client profile. Run the link on that update as well.
create or replace function public.handle_client_self_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  full_name text;
  client_record_id uuid;
  invitation_id uuid;
begin
  if new.invited_at is null or new.email is null then
    return new;
  end if;

  if exists (select 1 from public.users as profile where profile.auth_id = new.id) then
    return new;
  end if;

  select invitation.id, invitation.client_id, client.name
  into invitation_id, client_record_id, full_name
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

  update public.client_portal_invitations
  set consumed_at = now()
  where id = invitation_id;

  return new;
end;
$$;

revoke all on function public.handle_client_self_signup() from public, anon, authenticated;

drop trigger if exists on_auth_user_client_signup on auth.users;
create trigger on_auth_user_client_signup
  after insert or update of invited_at on auth.users
  for each row
  execute function public.handle_client_self_signup();

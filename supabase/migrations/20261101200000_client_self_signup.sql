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
begin
  if new.raw_user_meta_data ->> 'account_type' is distinct from 'client_signup' then
    return new;
  end if;

  full_name := nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), '');
  company_name := nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'company_name'), '');
  phone_number := nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'phone'), '');

  if full_name is null or company_name is null or new.email is null then
    raise exception 'Client signup requires a name, company name, and email address';
  end if;

  insert into public.clients (name, company_name, email, phone)
  values (full_name, company_name, new.email, phone_number)
  returning id into client_record_id;

  insert into public.users (auth_id, email, full_name, role, client_id)
  values (new.id, new.email, full_name, 'client', client_record_id);

  return new;
end;
$$;

revoke all on function public.handle_client_self_signup() from public, anon, authenticated;

drop trigger if exists on_auth_user_client_signup on auth.users;
create trigger on_auth_user_client_signup
  after insert on auth.users
  for each row
  execute function public.handle_client_self_signup();

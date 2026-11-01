create extension if not exists pgcrypto;

create type public.client_status as enum ('Active', 'Paused', 'Churned');
create type public.app_role as enum ('admin', 'team_member', 'client');
create type public.service_type as enum ('Website Management', 'Social Media');
create type public.service_status as enum ('Active', 'Paused', 'Ended');
create type public.deliverable_category as enum ('Reel', 'Post', 'Website Fix');
create type public.pipeline_status as enum ('Drafting', 'Pending Approval', 'Scheduled', 'Published');
create type public.payment_status as enum ('Paid', 'Pending', 'Overdue');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text not null,
  email text not null,
  phone text,
  status public.client_status not null default 'Active',
  created_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role public.app_role not null,
  client_id uuid references public.clients (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint users_client_role_check check (
    (role = 'client' and client_id is not null)
    or (role <> 'client' and client_id is null)
  )
);

create table public.client_services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  service_type public.service_type not null,
  monthly_retainer numeric(12, 2) not null default 0 check (monthly_retainer >= 0),
  start_date date not null,
  renewal_date date,
  status public.service_status not null default 'Active',
  created_at timestamptz not null default now(),
  constraint client_services_dates_check check (renewal_date is null or renewal_date >= start_date)
);

create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.client_services (id) on delete cascade,
  title text not null,
  category public.deliverable_category not null,
  pipeline_status public.pipeline_status not null default 'Drafting',
  due_date date,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  payment_status public.payment_status not null default 'Pending',
  due_date date not null,
  paid_date date,
  transaction_ref text,
  created_at timestamptz not null default now(),
  constraint payments_paid_date_check check (
    (payment_status = 'Paid' and paid_date is not null)
    or (payment_status <> 'Paid' and paid_date is null)
  )
);

create index users_client_id_idx on public.users (client_id);
create index client_services_client_status_idx on public.client_services (client_id, status);
create index deliverables_service_status_idx on public.deliverables (service_id, pipeline_status);
create index payments_client_due_date_idx on public.payments (client_id, due_date desc);

create function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select u.role
  from public.users as u
  where u.auth_id = (select auth.uid())
  limit 1
$$;

create function public.current_client_id()
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
  limit 1
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.current_client_id() from public;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_client_id() to authenticated;

alter table public.clients enable row level security;
alter table public.users enable row level security;
alter table public.client_services enable row level security;
alter table public.deliverables enable row level security;
alter table public.payments enable row level security;

revoke all on public.clients, public.users, public.client_services, public.deliverables, public.payments
  from anon, public;
grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.clients, public.users, public.client_services, public.deliverables, public.payments
  to authenticated;

create policy "Admins and team can manage clients"
  on public.clients for all to authenticated
  using (public.current_app_role() in ('admin', 'team_member'))
  with check (public.current_app_role() in ('admin', 'team_member'));
create policy "Clients can view their own client record"
  on public.clients for select to authenticated
  using (id = public.current_client_id());

create policy "Users can view their own profile"
  on public.users for select to authenticated
  using (auth_id = (select auth.uid()));
create policy "Admins and team can view all profiles"
  on public.users for select to authenticated
  using (public.current_app_role() in ('admin', 'team_member'));
create policy "Admins can manage profiles"
  on public.users for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy "Admins and team can manage client services"
  on public.client_services for all to authenticated
  using (public.current_app_role() in ('admin', 'team_member'))
  with check (public.current_app_role() in ('admin', 'team_member'));
create policy "Clients can view their own services"
  on public.client_services for select to authenticated
  using (client_id = public.current_client_id());

create policy "Admins and team can manage deliverables"
  on public.deliverables for all to authenticated
  using (public.current_app_role() in ('admin', 'team_member'))
  with check (public.current_app_role() in ('admin', 'team_member'));
create policy "Clients can view their own deliverables"
  on public.deliverables for select to authenticated
  using (
    exists (
      select 1
      from public.client_services as service
      where service.id = deliverables.service_id
        and service.client_id = public.current_client_id()
    )
  );

create policy "Admins and team can manage payments"
  on public.payments for all to authenticated
  using (public.current_app_role() in ('admin', 'team_member'))
  with check (public.current_app_role() in ('admin', 'team_member'));
create policy "Clients can view their own payments"
  on public.payments for select to authenticated
  using (client_id = public.current_client_id());

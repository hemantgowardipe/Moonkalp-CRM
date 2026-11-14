-- Invoices, deliverable files, deliverable comments, and notifications.
--   invoices / invoice_items: client billing documents with sequential numbers.
--   payments.invoice_id:      links a recorded payment to the invoice it settles.
--   deliverable_files:        files attached to deliverables (private bucket).
--   deliverable_comments:     per-deliverable thread between staff and client.
--   notifications:            in-app inbox; rows are written by the server only.

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------
create type public.invoice_status as enum ('Draft', 'Sent', 'Paid', 'Void');

create sequence public.invoice_number_seq;

-- Sequential, human-readable numbers (INV-2026-0001). Gaps can appear when an
-- insert rolls back, which is normal for sequence-backed numbering.
create function public.next_invoice_number()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0')
$$;

revoke all on function public.next_invoice_number() from public, anon;
grant execute on function public.next_invoice_number() to authenticated, service_role;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default public.next_invoice_number(),
  client_id uuid not null references public.clients (id) on delete restrict,
  status public.invoice_status not null default 'Draft',
  issue_date date not null default current_date,
  due_date date not null,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid references auth.users (id) on delete set null,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_dates_check check (due_date >= issue_date),
  constraint invoices_paid_state_check check ((status = 'Paid') = (paid_at is not null))
);

create index invoices_client_idx on public.invoices (client_id, created_at desc);
create index invoices_status_due_idx on public.invoices (status, due_date);

create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  position integer not null default 0 check (position between 0 and 99),
  description text not null check (char_length(btrim(description)) between 1 and 200),
  quantity numeric(10, 2) not null default 1 check (quantity > 0 and quantity <= 9999),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create index invoice_items_invoice_idx on public.invoice_items (invoice_id, position);

alter table public.payments
  add column invoice_id uuid references public.invoices (id) on delete set null;
create index payments_invoice_idx on public.payments (invoice_id);

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
revoke all on public.invoices, public.invoice_items from public, anon, authenticated;
grant select, insert, update, delete on public.invoices, public.invoice_items to authenticated;
grant all on public.invoices, public.invoice_items to service_role;

create policy "Admins and team can manage invoices"
  on public.invoices for all to authenticated
  using (public.current_app_role() in ('admin', 'team_member'))
  with check (public.current_app_role() in ('admin', 'team_member'));
-- Drafts and voided invoices stay internal to the agency.
create policy "Clients can view their own issued invoices"
  on public.invoices for select to authenticated
  using (client_id = public.current_client_id() and status in ('Sent', 'Paid'));

create policy "Admins and team can manage invoice items"
  on public.invoice_items for all to authenticated
  using (public.current_app_role() in ('admin', 'team_member'))
  with check (public.current_app_role() in ('admin', 'team_member'));
create policy "Clients can view items on their issued invoices"
  on public.invoice_items for select to authenticated
  using (
    exists (
      select 1
      from public.invoices as invoice
      where invoice.id = invoice_id
        and invoice.client_id = public.current_client_id()
        and invoice.status in ('Sent', 'Paid')
    )
  );

-- ---------------------------------------------------------------------------
-- Deliverable files (metadata; bytes live in a private storage bucket that
-- only the server's service role reads and writes, via short-lived links)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('deliverable-files', 'deliverable-files', false, 26214400)
on conflict (id) do nothing;

create table public.deliverable_files (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.deliverables (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 300),
  file_name text not null check (char_length(btrim(file_name)) between 1 and 160),
  content_type text not null check (char_length(content_type) <= 100),
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index deliverable_files_deliverable_idx on public.deliverable_files (deliverable_id, created_at desc);

alter table public.deliverable_files enable row level security;
revoke all on public.deliverable_files from public, anon, authenticated;
grant select, insert, delete on public.deliverable_files to authenticated;
grant all on public.deliverable_files to service_role;

create policy "Admins and team can manage deliverable files"
  on public.deliverable_files for all to authenticated
  using (public.current_app_role() in ('admin', 'team_member'))
  with check (public.current_app_role() in ('admin', 'team_member'));
create policy "Clients can view files on their deliverables"
  on public.deliverable_files for select to authenticated
  using (
    exists (
      select 1
      from public.deliverables as deliverable
      join public.client_services as service on service.id = deliverable.service_id
      where deliverable.id = deliverable_id
        and service.client_id = public.current_client_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Deliverable comments (append-only thread; staff can remove a comment)
-- ---------------------------------------------------------------------------
create table public.deliverable_comments (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.deliverables (id) on delete cascade,
  -- Name and role are snapshots so the thread stays readable if the author leaves.
  author_auth_id uuid references auth.users (id) on delete set null,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 80),
  author_role text not null check (author_role in ('staff', 'client')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index deliverable_comments_deliverable_idx on public.deliverable_comments (deliverable_id, created_at);

alter table public.deliverable_comments enable row level security;
revoke all on public.deliverable_comments from public, anon, authenticated;
grant select, insert, delete on public.deliverable_comments to authenticated;
grant all on public.deliverable_comments to service_role;

create policy "Admins and team can read all comments"
  on public.deliverable_comments for select to authenticated
  using (public.current_app_role() in ('admin', 'team_member'));
create policy "Admins and team can comment as themselves"
  on public.deliverable_comments for insert to authenticated
  with check (
    public.current_app_role() in ('admin', 'team_member')
    and author_auth_id = (select auth.uid())
    and author_role = 'staff'
  );
create policy "Admins can remove comments"
  on public.deliverable_comments for delete to authenticated
  using (public.current_app_role() = 'admin');
create policy "Clients can read comments on their deliverables"
  on public.deliverable_comments for select to authenticated
  using (
    exists (
      select 1
      from public.deliverables as deliverable
      join public.client_services as service on service.id = deliverable.service_id
      where deliverable.id = deliverable_id
        and service.client_id = public.current_client_id()
    )
  );
create policy "Clients can comment on their deliverables as themselves"
  on public.deliverable_comments for insert to authenticated
  with check (
    author_auth_id = (select auth.uid())
    and author_role = 'client'
    and exists (
      select 1
      from public.deliverables as deliverable
      join public.client_services as service on service.id = deliverable.service_id
      where deliverable.id = deliverable_id
        and service.client_id = public.current_client_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Notifications (server-written inbox; users read and mark their own as read)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id bigint generated always as identity primary key,
  recipient_auth_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (char_length(type) <= 40),
  title text not null check (char_length(title) <= 160),
  body text check (body is null or char_length(body) <= 400),
  -- Only in-app destinations, so a notification can never become an open redirect.
  href text check (href is null or (href like '/%' and char_length(href) <= 200)),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_recipient_idx on public.notifications (recipient_auth_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
-- No insert/delete for users: rows are written by the server (service role).
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

create policy "Users can read their own notifications"
  on public.notifications for select to authenticated
  using (recipient_auth_id = (select auth.uid()));
create policy "Users can mark their own notifications read"
  on public.notifications for update to authenticated
  using (recipient_auth_id = (select auth.uid()))
  with check (recipient_auth_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Audit trail for the new billing and file records
-- ---------------------------------------------------------------------------
create trigger audit_invoices
  after insert or update or delete on public.invoices
  for each row execute function public.audit_row_change();
create trigger audit_invoice_items
  after insert or update or delete on public.invoice_items
  for each row execute function public.audit_row_change();
create trigger audit_deliverable_files
  after insert or delete on public.deliverable_files
  for each row execute function public.audit_row_change();

notify pgrst, 'reload schema';

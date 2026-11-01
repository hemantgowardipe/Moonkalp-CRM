create type public.deliverable_review_action as enum ('Approved', 'Revision Requested');

create table public.deliverable_reviews (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.deliverables (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  reviewed_by uuid not null references auth.users (id) on delete cascade,
  action public.deliverable_review_action not null,
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

create index deliverable_reviews_deliverable_created_idx
  on public.deliverable_reviews (deliverable_id, created_at desc);

alter table public.deliverable_reviews enable row level security;
revoke all on public.deliverable_reviews from anon, public;
grant select, insert on public.deliverable_reviews to authenticated;

create policy "Admins and team can manage deliverable reviews"
  on public.deliverable_reviews for all to authenticated
  using (public.current_app_role() in ('admin', 'team_member'))
  with check (public.current_app_role() in ('admin', 'team_member'));

create policy "Clients can view reviews for their deliverables"
  on public.deliverable_reviews for select to authenticated
  using (client_id = public.current_client_id());

create policy "Clients can submit reviews for their deliverables"
  on public.deliverable_reviews for insert to authenticated
  with check (
    client_id = public.current_client_id()
    and reviewed_by = (select auth.uid())
    and exists (
      select 1
      from public.client_services as service
      join public.deliverables as deliverable on deliverable.service_id = service.id
      where deliverable.id = deliverable_reviews.deliverable_id
        and service.client_id = public.current_client_id()
        and deliverable.pipeline_status = 'Pending Approval'
    )
  );

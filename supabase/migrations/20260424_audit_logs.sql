create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_name_snapshot text,
  actor_email_snapshot text,
  entity_type text not null,
  entity_id text,
  action text not null,
  description text not null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

create index if not exists audit_logs_actor_user_id_idx
  on public.audit_logs (actor_user_id);

create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select_admin_only on public.audit_logs;
create policy audit_logs_select_admin_only
  on public.audit_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
        and profiles.ativo = true
    )
  );

drop policy if exists audit_logs_insert_authenticated on public.audit_logs;
create policy audit_logs_insert_authenticated
  on public.audit_logs
  for insert
  to authenticated
  with check (auth.uid() is not null);

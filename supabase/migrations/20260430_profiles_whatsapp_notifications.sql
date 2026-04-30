alter table if exists public.profiles
  add column if not exists whatsapp_number text,
  add column if not exists notify_new_leads boolean not null default true;

create table if not exists public.lead_assignment_notifications (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  seller_phone text,
  event_type text not null default 'assignment',
  message text not null,
  status text not null,
  provider text not null default 'uazapi',
  provider_response jsonb,
  error_message text,
  attempts integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  sent_at timestamptz
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lead_assignment_notifications_status_check'
      and conrelid = 'public.lead_assignment_notifications'::regclass
  ) then
    alter table public.lead_assignment_notifications
      add constraint lead_assignment_notifications_status_check
      check (status in ('sent', 'failed', 'skipped'));
  end if;
end $$;

create index if not exists lead_assignment_notifications_lead_seller_event_created_idx
  on public.lead_assignment_notifications (lead_id, seller_id, event_type, created_at desc);

create index if not exists lead_assignment_notifications_status_created_idx
  on public.lead_assignment_notifications (status, created_at desc);

create index if not exists lead_assignment_notifications_seller_created_idx
  on public.lead_assignment_notifications (seller_id, created_at desc);

alter table public.lead_assignment_notifications enable row level security;

drop policy if exists lead_assignment_notifications_select_admin_owner on public.lead_assignment_notifications;
create policy lead_assignment_notifications_select_admin_owner
  on public.lead_assignment_notifications
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.ativo = true
        and profiles.role in ('dono', 'admin')
    )
  );

drop policy if exists lead_assignment_notifications_select_seller_self on public.lead_assignment_notifications;
create policy lead_assignment_notifications_select_seller_self
  on public.lead_assignment_notifications
  for select
  to authenticated
  using (
    seller_id = auth.uid()
  );

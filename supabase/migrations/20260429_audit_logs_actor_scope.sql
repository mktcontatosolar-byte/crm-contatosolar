alter table if exists public.audit_logs enable row level security;

drop policy if exists audit_logs_insert_authenticated on public.audit_logs;

create policy audit_logs_insert_authenticated
  on public.audit_logs
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and actor_user_id = auth.uid()
  );

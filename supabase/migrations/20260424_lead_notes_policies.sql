alter table if exists public.lead_notes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_notes'
      and policyname = 'lead_notes_select_authenticated'
  ) then
    create policy lead_notes_select_authenticated
      on public.lead_notes
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_notes'
      and policyname = 'lead_notes_insert_authenticated'
  ) then
    create policy lead_notes_insert_authenticated
      on public.lead_notes
      for insert
      to authenticated
      with check (auth.uid() = author_id);
  end if;
end $$;

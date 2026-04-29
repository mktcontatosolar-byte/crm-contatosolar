alter table if exists public.lead_notes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_notes'
      and policyname = 'lead_notes_update_author_or_admin'
  ) then
    create policy lead_notes_update_author_or_admin
      on public.lead_notes
      for update
      to authenticated
      using (
        auth.uid() = author_id
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
      with check (
        auth.uid() = author_id
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_notes'
      and policyname = 'lead_notes_delete_author_or_admin'
  ) then
    create policy lead_notes_delete_author_or_admin
      on public.lead_notes
      for delete
      to authenticated
      using (
        auth.uid() = author_id
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      );
  end if;
end $$;

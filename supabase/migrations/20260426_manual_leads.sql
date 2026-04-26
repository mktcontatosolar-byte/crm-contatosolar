alter table if exists public."Agente_Base_EnergiaSolar"
  add column if not exists horario_preferido text,
  add column if not exists lead_entry_type text not null default 'meta_ads',
  add column if not exists manual_created_by uuid references public.profiles(id) on delete set null;

update public."Agente_Base_EnergiaSolar"
set lead_entry_type = 'meta_ads'
where lead_entry_type is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agente_base_energia_solar_lead_entry_type_check'
  ) then
    alter table public."Agente_Base_EnergiaSolar"
      add constraint agente_base_energia_solar_lead_entry_type_check
      check (lead_entry_type in ('meta_ads', 'manual'));
  end if;
end $$;

create index if not exists idx_agente_base_energia_solar_lead_entry_type
  on public."Agente_Base_EnergiaSolar" (lead_entry_type);

create index if not exists idx_agente_base_energia_solar_manual_created_by
  on public."Agente_Base_EnergiaSolar" (manual_created_by);

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'Agente_Base_EnergiaSolar'
  ) and exists (
    select 1
    from pg_class
    where relname = 'Agente_Base_EnergiaSolar'
      and relrowsecurity = true
  ) then
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'Agente_Base_EnergiaSolar'
        and policyname = 'lead_source_insert_admin_or_broker'
    ) then
      create policy lead_source_insert_admin_or_broker
        on public."Agente_Base_EnergiaSolar"
        for insert
        to authenticated
        with check (
          exists (
            select 1
            from public.profiles
            where profiles.id = auth.uid()
              and profiles.ativo = true
              and profiles.role in ('admin', 'corretor')
          )
        );
    end if;
  end if;
end $$;

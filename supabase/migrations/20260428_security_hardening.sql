create or replace function public.can_access_crm_lead(target_lead_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  active_role text;
begin
  active_role := public.current_active_role();

  if active_role in ('dono', 'admin') then
    return true;
  end if;

  if active_role <> 'corretor' or auth.uid() is null or nullif(btrim(target_lead_id), '') is null then
    return false;
  end if;

  return exists (
    select 1
    from public.crm_lead_state state
    where state.lead_id::text = target_lead_id
      and state.corretor_id = auth.uid()
  );
end;
$$;

create or replace function public.can_access_crm_chat_session(target_session_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  active_role text;
  normalized_session_id text;
begin
  active_role := public.current_active_role();
  normalized_session_id := nullif(btrim(target_session_id), '');

  if active_role in ('dono', 'admin') then
    return true;
  end if;

  if active_role <> 'corretor' or auth.uid() is null or normalized_session_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public."Agente_Base_EnergiaSolar" lead
    join public.crm_lead_state state
      on state.lead_id::text = lead.id::text
    where state.corretor_id = auth.uid()
      and nullif(btrim(lead.remotejid), '') = normalized_session_id
  );
end;
$$;

grant execute on function public.can_access_crm_lead(text) to authenticated;
grant execute on function public.can_access_crm_chat_session(text) to authenticated;

create or replace function public.prevent_admin_profile_escalation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.current_active_role() = 'admin' then
    if old.role <> 'corretor' or new.role <> 'corretor' then
      raise exception 'Admins can only manage broker profiles.'
        using errcode = '42501';
    end if;

    if new.id <> old.id
      or new.role is distinct from old.role
      or coalesce(new.nome, '') is distinct from coalesce(old.nome, '')
      or coalesce(new.email, '') is distinct from coalesce(old.email, '') then
      raise exception 'Admins can only toggle the active status of broker profiles.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

do $$
declare
  policy_record record;
  notes_table text;
begin
  if to_regclass('public.n8n_chat_histories_nova') is not null then
    alter table public.n8n_chat_histories_nova enable row level security;

    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'n8n_chat_histories_nova'
    loop
      execute format(
        'drop policy if exists %I on public.n8n_chat_histories_nova',
        policy_record.policyname
      );
    end loop;

    execute $sql$
      create policy n8n_chat_histories_nova_select_scoped
        on public.n8n_chat_histories_nova
        for select
        to authenticated
        using (public.can_access_crm_chat_session(session_id))
    $sql$;
  end if;

  foreach notes_table in array array['lead_notes', 'crm_lead_notes']
  loop
    if to_regclass(format('public.%I', notes_table)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', notes_table);

    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = notes_table
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        policy_record.policyname,
        notes_table
      );
    end loop;

    execute format($sql$
      create policy %I
        on public.%I
        for select
        to authenticated
        using (public.can_access_crm_lead(lead_id::text))
    $sql$, notes_table || '_select_scoped', notes_table);

    execute format($sql$
      create policy %I
        on public.%I
        for insert
        to authenticated
        with check (
          auth.uid() = author_id
          and public.can_access_crm_lead(lead_id::text)
        )
    $sql$, notes_table || '_insert_scoped', notes_table);

    execute format($sql$
      create policy %I
        on public.%I
        for update
        to authenticated
        using (
          public.current_active_role() in ('dono', 'admin')
          or (
            auth.uid() = author_id
            and public.can_access_crm_lead(lead_id::text)
          )
        )
        with check (
          (
            public.current_active_role() in ('dono', 'admin')
            and public.can_access_crm_lead(lead_id::text)
          )
          or (
            auth.uid() = author_id
            and public.can_access_crm_lead(lead_id::text)
          )
        )
    $sql$, notes_table || '_update_scoped', notes_table);

    execute format($sql$
      create policy %I
        on public.%I
        for delete
        to authenticated
        using (
          public.current_active_role() in ('dono', 'admin')
          or (
            auth.uid() = author_id
            and public.can_access_crm_lead(lead_id::text)
          )
        )
    $sql$, notes_table || '_delete_scoped', notes_table);
  end loop;

  if to_regclass('public.profiles') is not null then
    alter table public.profiles enable row level security;

    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'profiles'
    loop
      execute format(
        'drop policy if exists %I on public.profiles',
        policy_record.policyname
      );
    end loop;

    execute $sql$
      create policy profiles_select_self
        on public.profiles
        for select
        to authenticated
        using (auth.uid() = id)
    $sql$;

    execute $sql$
      create policy profiles_select_management_scope
        on public.profiles
        for select
        to authenticated
        using (public.current_active_role() in ('dono', 'admin'))
    $sql$;

    execute $sql$
      create policy profiles_update_owner_full
        on public.profiles
        for update
        to authenticated
        using (public.current_active_role() = 'dono')
        with check (role in ('dono', 'admin', 'corretor'))
    $sql$;

    execute $sql$
      create policy profiles_update_admin_broker_status_only
        on public.profiles
        for update
        to authenticated
        using (
          public.current_active_role() = 'admin'
          and role = 'corretor'
        )
        with check (
          public.current_active_role() = 'admin'
          and role = 'corretor'
        )
    $sql$;

    execute 'drop trigger if exists profiles_prevent_admin_profile_escalation on public.profiles';
    execute $sql$
      create trigger profiles_prevent_admin_profile_escalation
      before update on public.profiles
      for each row
      execute function public.prevent_admin_profile_escalation()
    $sql$;
  end if;
end $$;

create table if not exists public.lead_attachments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid null,
  session_id text null,
  phone text null,
  customer_name text null,
  storage_bucket text not null default 'lead-attachments',
  storage_path text not null,
  file_name text null,
  mime_type text null,
  file_size bigint null,
  attachment_type text not null default 'conta_energia',
  origem text not null default 'whatsapp_n8n',
  metadata jsonb null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null,
  deleted_at timestamptz null
);

create index if not exists lead_attachments_session_id_idx
  on public.lead_attachments (session_id);

create index if not exists lead_attachments_phone_idx
  on public.lead_attachments (phone);

create index if not exists lead_attachments_lead_id_idx
  on public.lead_attachments (lead_id);

create index if not exists lead_attachments_ativo_idx
  on public.lead_attachments (ativo);

create index if not exists lead_attachments_deleted_at_idx
  on public.lead_attachments (deleted_at);

create index if not exists lead_attachments_attachment_type_idx
  on public.lead_attachments (attachment_type);

create index if not exists lead_attachments_storage_path_idx
  on public.lead_attachments (storage_path);

create or replace function public.normalize_crm_phone(raw_phone text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  if raw_phone is null then
    return null;
  end if;

  digits := regexp_replace(raw_phone, '\D', '', 'g');

  if digits = '' then
    return null;
  end if;

  if digits like '55%' then
    return digits;
  end if;

  return '55' || digits;
end;
$$;

create or replace function public.build_crm_whatsapp_session_id(raw_phone text)
returns text
language sql
immutable
as $$
  select
    case
      when public.normalize_crm_phone(raw_phone) is null then null
      else public.normalize_crm_phone(raw_phone) || '@s.whatsapp.net'
    end
$$;

create or replace function public.can_access_crm_phone(target_phone text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  active_role text;
  normalized_phone text;
  normalized_session_id text;
begin
  active_role := public.current_active_role();
  normalized_phone := public.normalize_crm_phone(target_phone);
  normalized_session_id := public.build_crm_whatsapp_session_id(target_phone);

  if active_role in ('dono', 'admin') then
    return true;
  end if;

  if active_role <> 'corretor' or auth.uid() is null or normalized_phone is null then
    return false;
  end if;

  return exists (
    select 1
    from public."Agente_Base_EnergiaSolar" lead
    join public.crm_lead_state state
      on state.lead_id::text = lead.id::text
    where state.corretor_id = auth.uid()
      and (
        nullif(btrim(lead.remotejid), '') = normalized_session_id
        or public.normalize_crm_phone(lead.telefone_confirmado) = normalized_phone
        or public.normalize_crm_phone(lead.numero) = normalized_phone
      )
  );
end;
$$;

create or replace function public.can_access_lead_attachment(
  target_lead_id uuid,
  target_session_id text,
  target_phone text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  active_role text;
  normalized_session_id text;
  normalized_phone text;
begin
  active_role := public.current_active_role();
  normalized_session_id := nullif(btrim(target_session_id), '');
  normalized_phone := public.normalize_crm_phone(target_phone);

  if active_role in ('dono', 'admin') then
    return true;
  end if;

  if active_role <> 'corretor' or auth.uid() is null then
    return false;
  end if;

  if target_lead_id is not null and public.can_access_crm_lead(target_lead_id::text) then
    return true;
  end if;

  if normalized_session_id is not null and public.can_access_crm_chat_session(normalized_session_id) then
    return true;
  end if;

  if normalized_phone is not null and public.can_access_crm_phone(normalized_phone) then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.can_access_lead_attachment_storage_object(
  target_bucket text,
  target_storage_path text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.lead_attachments attachment
    where attachment.storage_bucket = target_bucket
      and attachment.storage_path = target_storage_path
      and attachment.ativo is true
      and attachment.deleted_at is null
      and public.can_access_lead_attachment(
        attachment.lead_id,
        attachment.session_id,
        attachment.phone
      )
  );
end;
$$;

grant execute on function public.normalize_crm_phone(text) to authenticated;
grant execute on function public.build_crm_whatsapp_session_id(text) to authenticated;
grant execute on function public.can_access_crm_phone(text) to authenticated;
grant execute on function public.can_access_lead_attachment(uuid, text, text) to authenticated;
grant execute on function public.can_access_lead_attachment_storage_object(text, text) to authenticated;

alter table public.lead_attachments enable row level security;

drop policy if exists lead_attachments_select_scoped on public.lead_attachments;

create policy lead_attachments_select_scoped
  on public.lead_attachments
  for select
  to authenticated
  using (
    ativo is true
    and deleted_at is null
    and public.can_access_lead_attachment(lead_id, session_id, phone)
  );

update storage.buckets
set public = false
where id = 'lead-attachments';

drop policy if exists lead_attachments_read_scoped on storage.objects;

create policy lead_attachments_read_scoped
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'lead-attachments'
    and public.can_access_lead_attachment_storage_object(bucket_id, name)
  );

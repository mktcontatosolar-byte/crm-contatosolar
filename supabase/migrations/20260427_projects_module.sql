create extension if not exists pgcrypto;

alter table if exists public.profiles
  drop constraint if exists profiles_role_check;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('dono', 'admin', 'corretor'));
  end if;
exception
  when duplicate_object then
    null;
end $$;

create or replace function public.current_active_role()
returns text
language sql
stable
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.ativo = true
  limit 1
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  data date,
  cliente text,
  marca text,
  valor_projeto numeric(14,2),
  forma_pagamento text,
  valor_equipamentos numeric(14,2),
  valor_servico numeric(14,2),
  custo_instalacao numeric(14,2),
  lucro numeric(14,2),
  percentual_margem numeric(7,2),
  fechado boolean not null default false,
  pago boolean not null default false,
  parecer_aprovado boolean not null default false,
  entregue boolean not null default false,
  instalado boolean not null default false,
  vendedor text,
  vendedor_id uuid references public.profiles(id) on delete set null,
  cpf_cnpj text,
  sexo text,
  cidade text,
  modulos integer,
  microinversores integer,
  w_de_cada_placa integer,
  observacoes text,
  origem_registro text not null default 'manual',
  status text not null default 'rascunho',
  ativo boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  constraint projects_origem_registro_check
    check (origem_registro in ('manual', 'importado', 'api'))
);

create index if not exists projects_data_idx on public.projects (data desc);
create index if not exists projects_vendedor_id_idx on public.projects (vendedor_id);
create index if not exists projects_ativo_deleted_idx on public.projects (ativo, deleted_at);
create index if not exists projects_pago_idx on public.projects (pago);
create index if not exists projects_fechado_idx on public.projects (fechado);
create index if not exists projects_cidade_idx on public.projects (cidade);
create index if not exists projects_marca_idx on public.projects (marca);
create index if not exists projects_status_idx on public.projects (status);

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

alter table public.projects enable row level security;

drop policy if exists projects_owner_select on public.projects;
create policy projects_owner_select
  on public.projects
  for select
  to authenticated
  using (public.current_active_role() = 'dono');

drop policy if exists projects_owner_insert on public.projects;
create policy projects_owner_insert
  on public.projects
  for insert
  to authenticated
  with check (public.current_active_role() = 'dono');

drop policy if exists projects_owner_update on public.projects;
create policy projects_owner_update
  on public.projects
  for update
  to authenticated
  using (public.current_active_role() = 'dono')
  with check (public.current_active_role() = 'dono');

drop policy if exists projects_owner_delete on public.projects;
create policy projects_owner_delete
  on public.projects
  for delete
  to authenticated
  using (public.current_active_role() = 'dono');

drop policy if exists projects_owner_full_access on public.projects;

do $$
begin
  if to_regclass('public.audit_logs') is not null then
    execute 'drop policy if exists audit_logs_select_admin_only on public.audit_logs';
    execute $sql$
      create policy audit_logs_select_admin_only
        on public.audit_logs
        for select
        to authenticated
        using (public.current_active_role() in ('dono', 'admin'))
    $sql$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.lead_notes') is not null then
    execute 'drop policy if exists lead_notes_update_author_or_admin on public.lead_notes';
    execute $sql$
      create policy lead_notes_update_author_or_admin
        on public.lead_notes
        for update
        to authenticated
        using (
          auth.uid() = author_id
          or public.current_active_role() in ('dono', 'admin')
        )
        with check (
          auth.uid() = author_id
          or public.current_active_role() in ('dono', 'admin')
        )
    $sql$;

    execute 'drop policy if exists lead_notes_delete_author_or_admin on public.lead_notes';
    execute $sql$
      create policy lead_notes_delete_author_or_admin
        on public.lead_notes
        for delete
        to authenticated
        using (
          auth.uid() = author_id
          or public.current_active_role() in ('dono', 'admin')
        )
    $sql$;
  end if;
end $$;

do $$
begin
  if to_regclass('public."Agente_Base_EnergiaSolar"') is not null then
    execute 'drop policy if exists lead_source_insert_admin_or_broker on public."Agente_Base_EnergiaSolar"';
    execute $sql$
      create policy lead_source_insert_admin_or_broker
        on public."Agente_Base_EnergiaSolar"
        for insert
        to authenticated
        with check (public.current_active_role() in ('dono', 'admin', 'corretor'))
    $sql$;
  end if;
end $$;

create or replace view public.competition_ranking
as
select
  coalesce(p.vendedor_id::text, pr.id::text, 'sem-vendedor') as vendedor_chave,
  p.vendedor_id,
  coalesce(pr.nome, pr.email, p.vendedor, 'Sem vendedor') as vendedor,
  count(*)::int as quantidade_projetos_pagos,
  coalesce(sum(p.valor_projeto), 0)::numeric(14,2) as valor_total
from public.projects p
left join public.profiles pr on pr.id = p.vendedor_id
where p.ativo = true
  and p.deleted_at is null
  and p.pago = true
  and public.current_active_role() in ('dono', 'admin', 'corretor')
  and p.data between date '2026-05-01' and date '2026-07-30'
group by 1, 2, 3
order by quantidade_projetos_pagos desc, valor_total desc, vendedor asc;

create or replace view public.dashboard_general_summary
with (security_invoker = true)
as
select
  count(*)::int as quantidade_projetos,
  coalesce(sum(valor_projeto), 0)::numeric(14,2) as faturamento_total,
  coalesce(avg(valor_projeto), 0)::numeric(14,2) as ticket_medio,
  coalesce(sum(valor_equipamentos), 0)::numeric(14,2) as valor_total_equipamentos,
  coalesce(sum(valor_servico), 0)::numeric(14,2) as valor_total_servico,
  coalesce(sum(custo_instalacao), 0)::numeric(14,2) as custo_total_instalacao,
  coalesce(sum(lucro), 0)::numeric(14,2) as lucro_total,
  coalesce(avg(percentual_margem), 0)::numeric(7,2) as margem_media,
  coalesce(sum(modulos), 0)::int as total_modulos,
  coalesce(sum(microinversores), 0)::int as total_microinversores,
  count(*) filter (where pago = true)::int as projetos_pagos,
  count(*) filter (where fechado = true)::int as projetos_fechados,
  count(*) filter (where parecer_aprovado = true)::int as projetos_parecer_aprovado,
  count(*) filter (where entregue = true)::int as projetos_entregues,
  count(*) filter (where instalado = true)::int as projetos_instalados
from public.projects
where ativo = true
  and deleted_at is null;

create or replace view public.seller_ranking
with (security_invoker = true)
as
select
  coalesce(p.vendedor_id::text, pr.id::text, 'sem-vendedor') as vendedor_chave,
  p.vendedor_id,
  coalesce(pr.nome, pr.email, p.vendedor, 'Sem vendedor') as vendedor,
  count(*)::int as quantidade_projetos,
  coalesce(sum(p.valor_projeto), 0)::numeric(14,2) as valor_total,
  coalesce(sum(p.lucro), 0)::numeric(14,2) as lucro_total,
  coalesce(avg(p.percentual_margem), 0)::numeric(7,2) as margem_media
from public.projects p
left join public.profiles pr on pr.id = p.vendedor_id
where p.ativo = true
  and p.deleted_at is null
group by 1, 2, 3
order by quantidade_projetos desc, valor_total desc, vendedor asc;

create or replace view public.projects_status_summary
as
select 'pagos'::text as status, count(*)::int as quantidade
from public.projects
where ativo = true
  and deleted_at is null
  and pago = true
  and (
    public.current_active_role() in ('dono', 'admin')
    or (public.current_active_role() = 'corretor' and vendedor_id = auth.uid())
  )
union all
select 'nao_pagos'::text, count(*)::int
from public.projects
where ativo = true
  and deleted_at is null
  and pago = false
  and (
    public.current_active_role() in ('dono', 'admin')
    or (public.current_active_role() = 'corretor' and vendedor_id = auth.uid())
  )
union all
select 'fechados'::text, count(*)::int
from public.projects
where ativo = true
  and deleted_at is null
  and fechado = true
  and (
    public.current_active_role() in ('dono', 'admin')
    or (public.current_active_role() = 'corretor' and vendedor_id = auth.uid())
  )
union all
select 'nao_fechados'::text, count(*)::int
from public.projects
where ativo = true
  and deleted_at is null
  and fechado = false
  and (
    public.current_active_role() in ('dono', 'admin')
    or (public.current_active_role() = 'corretor' and vendedor_id = auth.uid())
  )
union all
select 'instalados'::text, count(*)::int
from public.projects
where ativo = true
  and deleted_at is null
  and instalado = true
  and (
    public.current_active_role() in ('dono', 'admin')
    or (public.current_active_role() = 'corretor' and vendedor_id = auth.uid())
  )
union all
select 'nao_instalados'::text, count(*)::int
from public.projects
where ativo = true
  and deleted_at is null
  and instalado = false
  and (
    public.current_active_role() in ('dono', 'admin')
    or (public.current_active_role() = 'corretor' and vendedor_id = auth.uid())
  )
union all
select 'entregues'::text, count(*)::int
from public.projects
where ativo = true
  and deleted_at is null
  and entregue = true
  and (
    public.current_active_role() in ('dono', 'admin')
    or (public.current_active_role() = 'corretor' and vendedor_id = auth.uid())
  )
union all
select 'parecer_aprovado'::text, count(*)::int
from public.projects
where ativo = true
  and deleted_at is null
  and parecer_aprovado = true
  and (
    public.current_active_role() in ('dono', 'admin')
    or (public.current_active_role() = 'corretor' and vendedor_id = auth.uid())
  );

create or replace view public.dashboard_general_safe_view
as
select
  id,
  data,
  marca,
  forma_pagamento,
  vendedor,
  vendedor_id,
  cidade,
  modulos,
  microinversores,
  pago,
  fechado,
  parecer_aprovado,
  entregue,
  instalado,
  status,
  ativo,
  created_at,
  updated_at
from public.projects
where ativo = true
  and deleted_at is null
  and (
    public.current_active_role() in ('dono', 'admin')
    or (public.current_active_role() = 'corretor' and vendedor_id = auth.uid())
  );

create or replace view public.competition_projects_safe_view
as
select
  id,
  data,
  coalesce(pr.nome, pr.email, p.vendedor, 'Sem vendedor') as vendedor,
  p.vendedor_id,
  case
    when public.current_active_role() = 'admin' then
      concat('Cliente ', left(p.id::text, 8))
    when public.current_active_role() = 'corretor' then
      concat('Cliente ', left(p.id::text, 8))
    else
      coalesce(p.cliente, concat('Projeto ', left(p.id::text, 8)))
  end as cliente_mascarado,
  p.cidade,
  coalesce(p.valor_projeto, 0)::numeric(14,2) as valor_projeto,
  p.pago,
  p.fechado,
  p.instalado
from public.projects p
left join public.profiles pr on pr.id = p.vendedor_id
where p.ativo = true
  and p.deleted_at is null
  and p.pago = true
  and p.data between date '2026-05-01' and date '2026-07-30'
  and public.current_active_role() in ('dono', 'admin', 'corretor');

grant select on public.competition_ranking to authenticated;
grant select on public.dashboard_general_summary to authenticated;
grant select on public.seller_ranking to authenticated;
grant select on public.projects_status_summary to authenticated;
grant select on public.dashboard_general_safe_view to authenticated;
grant select on public.competition_projects_safe_view to authenticated;

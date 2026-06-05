-- =============================================
-- MÓDULO: CALCULADORA DE PROJETOS SOLARES
-- =============================================

-- =============================================
-- 1. CONFIGURAÇÃO DA CALCULADORA (singleton)
-- =============================================
create table if not exists public.calculadora_config (
  id                          uuid          primary key default gen_random_uuid(),
  margem_meta                 numeric(5,2)  not null default 16.50,
  custo_km_multiplicador      numeric(8,4)  not null default 1.1000,
  custo_instalacao_por_placa  numeric(8,2)  not null default 100,
  art_padrao                  numeric(10,2) not null default 350,
  ca_padrao                   numeric(10,2) not null default 800,
  imposto_nf_pct_padrao       numeric(5,4)  not null default 0,
  reserva_padrao              numeric(10,2) not null default 0,
  comissao_tabela             jsonb         not null default '[]'::jsonb,
  updated_at                  timestamptz   not null default now()
);

-- Seed da linha única
insert into public.calculadora_config (margem_meta, custo_km_multiplicador, comissao_tabela)
values (
  16.5,
  1.0000,
  '[{"qtd":1,"pct":0.07,"ajuda":500},{"qtd":2,"pct":0.08,"ajuda":750},{"qtd":3,"pct":0.09,"ajuda":1000},{"qtd":4,"pct":0.095,"ajuda":1250},{"qtd":5,"pct":0.10,"ajuda":1500}]'::jsonb
)
on conflict do nothing;

-- Trigger para manter updated_at (set_updated_at já existe em 20260427_projects_module.sql)
drop trigger if exists calculadora_config_updated_at on public.calculadora_config;
create trigger calculadora_config_updated_at
  before update on public.calculadora_config
  for each row
  execute function public.set_updated_at();

-- RLS
alter table public.calculadora_config enable row level security;

-- Qualquer autenticado lê
create policy "config_select_authenticated"
  on public.calculadora_config for select
  to authenticated
  using (true);

-- Só admin/dono atualiza
create policy "config_update_admin"
  on public.calculadora_config for update
  to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'dono')
  )
  with check (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'dono')
  );

-- INSERT e DELETE sem policy → bloqueados no client; service role ignora RLS


-- =============================================
-- 2. SIMULAÇÕES SALVAS
-- =============================================
create table if not exists public.calculadora_simulacoes (
  id                      uuid          primary key default gen_random_uuid(),
  nome_simulacao          text          not null,
  criado_por              uuid          not null references public.profiles(id),
  criado_em               timestamptz   not null default now(),

  -- inputs
  equipamentos            numeric(12,2),
  qtd_placas              integer,
  pot_placa               numeric(8,2),
  total_projeto           numeric(12,2),
  instalacao              numeric(12,2),
  art                     numeric(10,2),
  ca                      numeric(10,2),
  adequacao               numeric(10,2),
  taxa_cartao             numeric(5,4),
  indicacao               numeric(10,2),
  km                      numeric(8,2),
  imposto_nf_pct          numeric(5,4),
  reserva                 numeric(10,2),
  projetos_vendedor_mes   integer,
  comissao_pct_override   numeric(5,4),

  -- resultados calculados
  kwp                     numeric(10,4),
  watt_pico               numeric(10,2),
  servico                 numeric(12,2),
  comissao_val            numeric(12,2),
  ajuda_custo             numeric(10,2),
  desl_custo              numeric(10,2),
  total_inst              numeric(12,2),
  imposto_val             numeric(12,2),
  lucro_liquido           numeric(12,2),
  margem_pct              numeric(6,3),
  geracao_kwh_mes         numeric(10,2)
);

create index if not exists idx_calc_sim_criado_por on public.calculadora_simulacoes (criado_por);
create index if not exists idx_calc_sim_criado_em  on public.calculadora_simulacoes (criado_em desc);

-- RLS
alter table public.calculadora_simulacoes enable row level security;

-- Corretor lê só os próprios; admin/dono lê tudo
create policy "sim_select_own_or_admin"
  on public.calculadora_simulacoes for select
  to authenticated
  using (
    criado_por = auth.uid()
    or
    (select role from public.profiles where id = auth.uid()) in ('admin', 'dono')
  );

-- Qualquer autenticado insere desde que criado_por seja ele mesmo
create policy "sim_insert_own"
  on public.calculadora_simulacoes for insert
  to authenticated
  with check (criado_por = auth.uid());

-- Usuário atualiza o nome da própria simulação; admin atualiza qualquer
create policy "sim_update_own_or_admin"
  on public.calculadora_simulacoes for update
  to authenticated
  using (
    criado_por = auth.uid()
    or
    (select role from public.profiles where id = auth.uid()) in ('admin', 'dono')
  )
  with check (
    criado_por = auth.uid()
    or
    (select role from public.profiles where id = auth.uid()) in ('admin', 'dono')
  );

-- DELETE sem policy → bloqueado no client; service role only

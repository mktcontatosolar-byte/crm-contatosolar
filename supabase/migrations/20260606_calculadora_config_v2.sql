-- =============================================
-- CALCULADORA: novos campos de config + override de comissão
-- =============================================

-- Novos campos de configuração
alter table public.calculadora_config
  add column if not exists custo_instalacao_por_placa numeric(8,2) not null default 100,
  add column if not exists art_padrao                 numeric(10,2) not null default 350,
  add column if not exists ca_padrao                  numeric(10,2) not null default 800,
  add column if not exists imposto_nf_pct_padrao      numeric(5,4)  not null default 0,
  add column if not exists reserva_padrao              numeric(10,2) not null default 0;

-- Atualiza multiplicador de km para R$ 1,10/km (G14 da planilha: H12 × 1,1)
update public.calculadora_config
set custo_km_multiplicador = 1.1
where custo_km_multiplicador = 1.0;

-- Comissão personalizada por simulação (nullable — null = usa tabela)
alter table public.calculadora_simulacoes
  add column if not exists comissao_pct_override numeric(5,4);

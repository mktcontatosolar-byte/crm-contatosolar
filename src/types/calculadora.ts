export type ComissaoFaixa = {
  qtd: number
  pct: number
  ajuda: number
}

export type CalculadoraConfig = {
  id: string
  margem_meta: number
  custo_km_multiplicador: number
  custo_instalacao_por_placa: number
  art_padrao: number
  ca_padrao: number
  imposto_nf_pct_padrao: number   // decimal, ex: 0.07
  reserva_padrao: number
  comissao_tabela: ComissaoFaixa[]
  updated_at: string
}

export type CalculadoraInputs = {
  equipamentos: number
  qtd_placas: number
  pot_placa: number
  total_projeto: number
  instalacao: number              // auto-calculado: qtd_placas × custo_instalacao_por_placa
  art: number
  ca: number
  adequacao: number
  taxa_cartao: number
  indicacao: number
  km: number
  imposto_nf_pct: number          // decimal, ex: 0.07
  reserva: number
  projetos_vendedor_mes: number   // 0 = sem comissão/ajuda
  comissao_pct_override: number | null  // override para esta simulação
}

export type CalculadoraResultados = {
  kwp: number
  watt_pico: number
  servico: number
  comissao_val: number
  ajuda_custo: number
  desl_custo: number
  total_inst: number
  imposto_val: number
  lucro_liquido: number
  margem_pct: number
  geracao_kwh_mes: number
}

export type CalculadoraSimulacao = {
  id: string
  nome_simulacao: string
  criado_por: string
  criado_em: string
  criado_por_nome?: string
  comissao_pct_override: number | null

  // inputs
  equipamentos: number | null
  qtd_placas: number | null
  pot_placa: number | null
  total_projeto: number | null
  instalacao: number | null
  art: number | null
  ca: number | null
  adequacao: number | null
  taxa_cartao: number | null
  indicacao: number | null
  km: number | null
  imposto_nf_pct: number | null
  reserva: number | null
  projetos_vendedor_mes: number | null

  // resultados
  kwp: number | null
  watt_pico: number | null
  servico: number | null
  comissao_val: number | null
  ajuda_custo: number | null
  desl_custo: number | null
  total_inst: number | null
  imposto_val: number | null
  lucro_liquido: number | null
  margem_pct: number | null
  geracao_kwh_mes: number | null
}

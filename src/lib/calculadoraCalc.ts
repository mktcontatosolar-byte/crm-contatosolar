import type { CalculadoraConfig, CalculadoraInputs, CalculadoraResultados } from "@/types/calculadora"

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function calcularSimulacao(
  inputs: CalculadoraInputs,
  config: CalculadoraConfig,
): CalculadoraResultados {
  const {
    equipamentos,
    qtd_placas,
    pot_placa,
    total_projeto,
    instalacao,
    art,
    ca,
    adequacao,
    taxa_cartao,
    indicacao,
    km,
    imposto_nf_pct,
    reserva,
    projetos_vendedor_mes,
    comissao_pct_override,
  } = inputs

  // Sistema
  const kwp = round2((qtd_placas * pot_placa) / 1000)
  const servico = round2(total_projeto - equipamentos)
  const watt_pico = kwp === 0 ? 0 : round2(servico / kwp / 1000)
  const geracao_kwh_mes = round2((qtd_placas * pot_placa * 126) / 1000)

  // Instalação (já calculado externamente: qtd_placas × custo_instalacao_por_placa)
  const total_inst = round2(instalacao + art + ca)

  // Comissão — 0 projetos = sem comissão/ajuda
  const faixa = projetos_vendedor_mes === 0
    ? undefined
    : config.comissao_tabela.find((f) => f.qtd === projetos_vendedor_mes)

  const comissao_pct =
    comissao_pct_override !== null && comissao_pct_override !== undefined
      ? comissao_pct_override
      : (faixa?.pct ?? 0)

  const ajuda_custo = projetos_vendedor_mes === 0 ? 0 : round2(faixa?.ajuda ?? 0)
  const comissao_val = round2(total_projeto * comissao_pct)

  // Custo deslocamento: km × R$/km (planilha: G14 = H12 × 1,1)
  const desl_custo = round2(km * config.custo_km_multiplicador)

  // Tributação
  const imposto_val = round2(total_projeto * imposto_nf_pct)

  // Lucro líquido (L22 da planilha)
  const lucro_liquido = round2(
    servico
    - comissao_val
    - ajuda_custo
    - indicacao
    - taxa_cartao
    - total_inst
    - imposto_val
    - adequacao
    - desl_custo
    - reserva,
  )

  const margem_pct =
    total_projeto === 0 ? 0 : round2((lucro_liquido / total_projeto) * 100)

  return {
    kwp,
    watt_pico,
    servico,
    comissao_val,
    ajuda_custo,
    desl_custo,
    total_inst,
    imposto_val,
    lucro_liquido,
    margem_pct,
    geracao_kwh_mes,
  }
}

export function getMargemStatus(
  margem_pct: number,
  config: CalculadoraConfig,
): "ok" | "warning" | "danger" {
  if (margem_pct >= config.margem_meta) return "ok"
  if (margem_pct >= 10) return "warning"
  return "danger"
}

import type { Profile } from "@/types"

export type ProjectOrigin = "manual" | "importado" | "api"

export type ProjectRow = {
  id: string
  data: string | null
  cliente: string | null
  marca: string | null
  valor_projeto: number | null
  forma_pagamento: string | null
  valor_equipamentos: number | null
  valor_servico: number | null
  custo_instalacao: number | null
  lucro: number | null
  percentual_margem: number | null
  fechado: boolean
  pago: boolean
  parecer_aprovado: boolean
  entregue: boolean
  instalado: boolean
  vendedor: string | null
  vendedor_id: string | null
  cpf_cnpj: string | null
  sexo: string | null
  cidade: string | null
  modulos: number | null
  microinversores: number | null
  w_de_cada_placa: number | null
  observacoes: string | null
  origem_registro: ProjectOrigin | string | null
  status: string | null
  ativo: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
  vendedor_profile?: Pick<Profile, "id" | "nome" | "email" | "role"> | null
}

export type ProjectFilters = {
  search: string
  vendedorId: string
  cidade: string
  marca: string
  pago: "all" | "true" | "false"
  fechado: "all" | "true" | "false"
  instalado: "all" | "true" | "false"
  entregue: "all" | "true" | "false"
  parecerAprovado: "all" | "true" | "false"
  dataInicio: string
  dataFim: string
}

export type ProjectFormValues = {
  data: string
  cliente: string
  marca: string
  valor_projeto: string
  forma_pagamento: string
  valor_equipamentos: string
  valor_servico: string
  custo_instalacao: string
  lucro: string
  percentual_margem: string
  fechado: boolean
  pago: boolean
  parecer_aprovado: boolean
  entregue: boolean
  instalado: boolean
  vendedor: string
  vendedor_id: string
  cpf_cnpj: string
  sexo: string
  cidade: string
  modulos: string
  microinversores: string
  w_de_cada_placa: string
  observacoes: string
  origem_registro: string
  status: string
  ativo: boolean
}

export type CompetitionSellerSummary = {
  vendedorId: string | null
  vendedor: string
  quantidadeProjetos: number
  valorTotal: number
  percentualLider: number
}

export type CompetitionRankingRow = {
  vendedor_chave: string
  vendedor_id: string | null
  vendedor: string | null
  quantidade_projetos_pagos: number | null
  valor_total: number | null
}

export type CompetitionProjectSafeRow = {
  id: string
  data: string | null
  vendedor: string | null
  vendedor_id: string | null
  cliente_mascarado: string | null
  cidade: string | null
  valor_projeto: number | null
  pago: boolean
  fechado: boolean
  instalado: boolean
}

export type CompetitionSummary = {
  leader: CompetitionSellerSummary | null
  totalProjetosPagos: number
  valorTotalVendido: number
  participantes: number
  ranking: CompetitionSellerSummary[]
}

export type DashboardSummary = {
  faturamentoTotal: number
  quantidadeProjetos: number
  ticketMedio: number
  valorEquipamentos: number
  valorServico: number
  custoInstalacao: number
  lucroTotal: number
  margemMedia: number
  totalModulos: number
  totalMicroinversores: number
  projetosPagos: number
  projetosFechados: number
  projetosParecerAprovado: number
  projetosEntregues: number
  projetosInstalados: number
}

export type DashboardGeneralSummaryRow = {
  quantidade_projetos: number | null
  faturamento_total: number | null
  ticket_medio: number | null
  valor_total_equipamentos: number | null
  valor_total_servico: number | null
  custo_total_instalacao: number | null
  lucro_total: number | null
  margem_media: number | null
  total_modulos: number | null
  total_microinversores: number | null
  projetos_pagos: number | null
  projetos_fechados: number | null
  projetos_parecer_aprovado: number | null
  projetos_entregues: number | null
  projetos_instalados: number | null
}

export type ProjectSafeRow = {
  id: string
  data: string | null
  marca: string | null
  forma_pagamento: string | null
  vendedor: string | null
  vendedor_id: string | null
  cidade: string | null
  modulos: number | null
  microinversores: number | null
  pago: boolean
  fechado: boolean
  parecer_aprovado: boolean
  entregue: boolean
  instalado: boolean
  status: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export type ProjectStatusSummaryRow = {
  status: string
  quantidade: number | null
}

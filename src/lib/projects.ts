import { isOwnerRole } from "@/lib/permissions"
import { supabase } from "@/lib/supabase"
import type { UserRole } from "@/types"
import type {
  CompetitionProjectSafeRow,
  CompetitionRankingRow,
  CompetitionSellerSummary,
  CompetitionSummary,
  DashboardGeneralSummaryRow,
  DashboardSummary,
  ProjectFilters,
  ProjectFormValues,
  ProjectRow,
  ProjectSafeRow,
  ProjectStatusSummaryRow,
} from "@/types/projects"

export const PROJECTS_TABLE = "projects"
const COMPETITION_RANKING_VIEW = "competition_ranking"
const COMPETITION_PROJECTS_SAFE_VIEW = "competition_projects_safe_view"
const DASHBOARD_GENERAL_SUMMARY_VIEW = "dashboard_general_summary"
const DASHBOARD_GENERAL_SAFE_VIEW = "dashboard_general_safe_view"
const PROJECTS_STATUS_SUMMARY_VIEW = "projects_status_summary"
export const PROJECT_COMPETITION_START = "2026-05-01"
export const PROJECT_COMPETITION_END = "2026-07-30"

export const defaultProjectFilters: ProjectFilters = {
  search: "",
  vendedorId: "",
  cidade: "",
  marca: "",
  pago: "all",
  fechado: "all",
  instalado: "all",
  entregue: "all",
  parecerAprovado: "all",
  dataInicio: "",
  dataFim: "",
}

export const defaultProjectFormValues: ProjectFormValues = {
  data: "",
  cliente: "",
  marca: "",
  valor_projeto: "",
  forma_pagamento: "",
  valor_equipamentos: "",
  valor_servico: "",
  custo_instalacao: "",
  lucro: "",
  percentual_margem: "",
  fechado: false,
  pago: false,
  parecer_aprovado: false,
  entregue: false,
  instalado: false,
  vendedor: "",
  vendedor_id: "",
  cpf_cnpj: "",
  sexo: "",
  cidade: "",
  modulos: "",
  microinversores: "",
  w_de_cada_placa: "",
  observacoes: "",
  origem_registro: "manual",
  status: "rascunho",
  ativo: true,
}

const PROJECT_SELECT = `
  id,
  data,
  cliente,
  marca,
  valor_projeto,
  forma_pagamento,
  valor_equipamentos,
  valor_servico,
  custo_instalacao,
  lucro,
  percentual_margem,
  fechado,
  pago,
  parecer_aprovado,
  entregue,
  instalado,
  vendedor,
  vendedor_id,
  cpf_cnpj,
  sexo,
  cidade,
  modulos,
  microinversores,
  w_de_cada_placa,
  observacoes,
  origem_registro,
  status,
  ativo,
  created_at,
  updated_at,
  created_by,
  updated_by,
  deleted_at,
  vendedor_profile:profiles!projects_vendedor_id_fkey(id,nome,email,role)
`

const PROJECT_SAFE_SELECT = `
  id,
  data,
  marca,
  forma_pagamento,
  fechado,
  pago,
  parecer_aprovado,
  entregue,
  instalado,
  vendedor,
  vendedor_id,
  cidade,
  modulos,
  microinversores,
  status,
  ativo,
  created_at,
  updated_at,
  deleted_at,
  vendedor_profile:profiles!projects_vendedor_id_fkey(id,nome,email,role)
`

const COMPETITION_PROJECTS_OWNER_SELECT = `
  id,
  data,
  cliente,
  cidade,
  valor_projeto,
  pago,
  fechado,
  instalado,
  vendedor,
  vendedor_id,
  ativo,
  deleted_at,
  created_at,
  vendedor_profile:profiles!projects_vendedor_id_fkey(id,nome,email,role)
`

function nullIfEmpty(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function booleanFilter(value: "all" | "true" | "false") {
  if (value === "all") {
    return null
  }

  return value === "true"
}

function toNullableNumber(raw: string) {
  if (!raw.trim()) {
    return null
  }

  const normalized = Number(raw.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(normalized) ? normalized : null
}

export function toSafeNumber(value: number | null | undefined) {
  return Number.isFinite(value ?? NaN) ? Number(value) : 0
}

function normalizeProjectRow(row: unknown): ProjectRow {
  const candidate = row as ProjectRow & {
    vendedor_profile?: ProjectRow["vendedor_profile"] | ProjectRow["vendedor_profile"][]
  }

  const vendedorProfile = Array.isArray(candidate.vendedor_profile)
    ? candidate.vendedor_profile[0] ?? null
    : candidate.vendedor_profile ?? null

  return {
    ...candidate,
    vendedor_profile: vendedorProfile,
  }
}

function normalizeSafeProjectRow(row: ProjectSafeRow): ProjectSafeRow {
  return {
    ...row,
  }
}

function normalizeCompetitionProjectSafeRow(row: CompetitionProjectSafeRow): CompetitionProjectSafeRow {
  return {
    ...row,
  }
}

function buildProjectsBaseQuery(selectClause: string) {
  return supabase
    .from(PROJECTS_TABLE)
    .select(selectClause)
    .is("deleted_at", null)
    .eq("ativo", true)
}

export function getProjectSellerName(project: Pick<ProjectRow, "vendedor" | "vendedor_profile">) {
  return project.vendedor_profile?.nome || project.vendedor_profile?.email || project.vendedor || "Sem vendedor"
}

export function mapProjectToFormValues(project: ProjectRow): ProjectFormValues {
  return {
    data: project.data ?? "",
    cliente: project.cliente ?? "",
    marca: project.marca ?? "",
    valor_projeto: project.valor_projeto?.toString() ?? "",
    forma_pagamento: project.forma_pagamento ?? "",
    valor_equipamentos: project.valor_equipamentos?.toString() ?? "",
    valor_servico: project.valor_servico?.toString() ?? "",
    custo_instalacao: project.custo_instalacao?.toString() ?? "",
    lucro: project.lucro?.toString() ?? "",
    percentual_margem: project.percentual_margem?.toString() ?? "",
    fechado: project.fechado,
    pago: project.pago,
    parecer_aprovado: project.parecer_aprovado,
    entregue: project.entregue,
    instalado: project.instalado,
    vendedor: project.vendedor ?? "",
    vendedor_id: project.vendedor_id ?? "",
    cpf_cnpj: project.cpf_cnpj ?? "",
    sexo: project.sexo ?? "",
    cidade: project.cidade ?? "",
    modulos: project.modulos?.toString() ?? "",
    microinversores: project.microinversores?.toString() ?? "",
    w_de_cada_placa: project.w_de_cada_placa?.toString() ?? "",
    observacoes: project.observacoes ?? "",
    origem_registro: project.origem_registro ?? "manual",
    status: project.status ?? "rascunho",
    ativo: project.ativo,
  }
}

function buildProjectPayload(values: ProjectFormValues, userId: string, isUpdate = false) {
  const payload = {
    data: nullIfEmpty(values.data),
    cliente: nullIfEmpty(values.cliente),
    marca: nullIfEmpty(values.marca),
    valor_projeto: toNullableNumber(values.valor_projeto),
    forma_pagamento: nullIfEmpty(values.forma_pagamento),
    valor_equipamentos: toNullableNumber(values.valor_equipamentos),
    valor_servico: toNullableNumber(values.valor_servico),
    custo_instalacao: toNullableNumber(values.custo_instalacao),
    lucro: toNullableNumber(values.lucro),
    percentual_margem: toNullableNumber(values.percentual_margem),
    fechado: values.fechado,
    pago: values.pago,
    parecer_aprovado: values.parecer_aprovado,
    entregue: values.entregue,
    instalado: values.instalado,
    vendedor: nullIfEmpty(values.vendedor),
    vendedor_id: nullIfEmpty(values.vendedor_id),
    cpf_cnpj: nullIfEmpty(values.cpf_cnpj),
    sexo: nullIfEmpty(values.sexo),
    cidade: nullIfEmpty(values.cidade),
    modulos: toNullableNumber(values.modulos),
    microinversores: toNullableNumber(values.microinversores),
    w_de_cada_placa: toNullableNumber(values.w_de_cada_placa),
    observacoes: nullIfEmpty(values.observacoes),
    origem_registro: nullIfEmpty(values.origem_registro) ?? "manual",
    status: nullIfEmpty(values.status) ?? "rascunho",
    ativo: values.ativo,
    updated_by: userId,
  }

  if (isUpdate) {
    return payload
  }

  return {
    ...payload,
    created_by: userId,
  }
}

export async function fetchProjectSellers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,nome,email,role")
    .in("role", ["dono", "admin", "corretor"])
    .eq("ativo", true)
    .order("nome", { ascending: true })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function fetchProjects(filters: ProjectFilters) {
  let query = buildProjectsBaseQuery(PROJECT_SELECT)
    .order("data", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  const search = filters.search.trim()
  if (search) {
    query = query.or(
      [
        `cliente.ilike.%${search}%`,
        `cpf_cnpj.ilike.%${search}%`,
        `cidade.ilike.%${search}%`,
        `marca.ilike.%${search}%`,
        `vendedor.ilike.%${search}%`,
      ].join(",")
    )
  }

  if (filters.vendedorId) {
    query = query.eq("vendedor_id", filters.vendedorId)
  }

  if (filters.cidade) {
    query = query.ilike("cidade", `%${filters.cidade}%`)
  }

  if (filters.marca) {
    query = query.ilike("marca", `%${filters.marca}%`)
  }

  if (filters.dataInicio) {
    query = query.gte("data", filters.dataInicio)
  }

  if (filters.dataFim) {
    query = query.lte("data", filters.dataFim)
  }

  const pago = booleanFilter(filters.pago)
  const fechado = booleanFilter(filters.fechado)
  const instalado = booleanFilter(filters.instalado)
  const entregue = booleanFilter(filters.entregue)
  const parecerAprovado = booleanFilter(filters.parecerAprovado)

  if (pago !== null) {
    query = query.eq("pago", pago)
  }

  if (fechado !== null) {
    query = query.eq("fechado", fechado)
  }

  if (instalado !== null) {
    query = query.eq("instalado", instalado)
  }

  if (entregue !== null) {
    query = query.eq("entregue", entregue)
  }

  if (parecerAprovado !== null) {
    query = query.eq("parecer_aprovado", parecerAprovado)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return ((data ?? []) as unknown[]).map(normalizeProjectRow)
}

export async function fetchProjectAnalytics({
  role,
  userId,
}: {
  role: UserRole | null | undefined
  userId: string | null | undefined
}) {
  const selectClause = isOwnerRole(role) ? PROJECT_SELECT : PROJECT_SAFE_SELECT
  const { data, error } = await buildProjectsBaseQuery(selectClause)
    .order("data", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return filterProjectsForSellerScope(((data ?? []) as unknown[]).map(normalizeProjectRow), role, userId)
}

export async function fetchCompetitionRanking() {
  const { data, error } = await supabase
    .from(COMPETITION_RANKING_VIEW)
    .select("*")
    .order("quantidade_projetos_pagos", { ascending: false })
    .order("valor_total", { ascending: false })
    .order("vendedor", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as CompetitionRankingRow[]
}

export async function fetchCompetitionProjectsBySeller({
  role,
  sellerId,
  sellerName,
}: {
  role: UserRole | null | undefined
  sellerId: string | null
  sellerName: string
}) {
  if (!sellerName.trim()) {
    return []
  }

  if (isOwnerRole(role)) {
    let query = buildProjectsBaseQuery(COMPETITION_PROJECTS_OWNER_SELECT)
      .eq("pago", true)
      .gte("data", PROJECT_COMPETITION_START)
      .lte("data", PROJECT_COMPETITION_END)
      .order("data", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })

    query = sellerId ? query.eq("vendedor_id", sellerId) : query.eq("vendedor", sellerName)

    const { data, error } = await query

    if (error) {
      throw error
    }

    return ((data ?? []) as unknown[]).map(normalizeProjectRow)
  }

  let query = supabase
    .from(COMPETITION_PROJECTS_SAFE_VIEW)
    .select("*")
    .order("data", { ascending: false, nullsFirst: false })

  if (sellerId) {
    query = query.eq("vendedor_id", sellerId)
  } else {
    query = query.eq("vendedor", sellerName)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return ((data ?? []) as CompetitionProjectSafeRow[]).map(normalizeCompetitionProjectSafeRow)
}

export async function fetchDashboardGeneralSummary() {
  const { data, error } = await supabase.from(DASHBOARD_GENERAL_SUMMARY_VIEW).select("*").single()

  if (error) {
    throw error
  }

  return (data ?? null) as DashboardGeneralSummaryRow | null
}

export async function fetchDashboardSafeProjects() {
  const { data, error } = await supabase
    .from(DASHBOARD_GENERAL_SAFE_VIEW)
    .select("*")
    .order("data", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as ProjectSafeRow[]).map(normalizeSafeProjectRow)
}

export async function fetchProjectsStatusSummary() {
  const { data, error } = await supabase.from(PROJECTS_STATUS_SUMMARY_VIEW).select("*")

  if (error) {
    throw error
  }

  return (data ?? []) as ProjectStatusSummaryRow[]
}

export async function createProject(values: ProjectFormValues, userId: string) {
  const payload = buildProjectPayload(values, userId)
  const { data, error } = await supabase.from(PROJECTS_TABLE).insert(payload).select(PROJECT_SELECT).single()

  if (error) {
    throw error
  }

  return normalizeProjectRow(data)
}

export async function updateProject(id: string, values: ProjectFormValues, userId: string) {
  const payload = buildProjectPayload(values, userId, true)
  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .update(payload)
    .eq("id", id)
    .select(PROJECT_SELECT)
    .single()

  if (error) {
    throw error
  }

  return normalizeProjectRow(data)
}

export async function archiveProject(id: string, userId: string) {
  const { error } = await supabase
    .from(PROJECTS_TABLE)
    .update({
      ativo: false,
      deleted_at: new Date().toISOString(),
      status: "arquivado",
      updated_by: userId,
    })
    .eq("id", id)

  if (error) {
    throw error
  }
}

export function buildCompetitionSummary(projects: ProjectRow[]): CompetitionSummary {
  const eligibleProjects = projects.filter((project) => {
    if (!project.ativo || project.deleted_at || !project.pago || !project.data) {
      return false
    }

    return project.data >= PROJECT_COMPETITION_START && project.data <= PROJECT_COMPETITION_END
  })

  const grouped = eligibleProjects.reduce<Map<string, CompetitionSellerSummary>>((acc, project) => {
    const vendedor = getProjectSellerName(project)
    const key = project.vendedor_id ?? vendedor
    const current = acc.get(key) ?? {
      vendedorId: project.vendedor_id,
      vendedor,
      quantidadeProjetos: 0,
      valorTotal: 0,
      percentualLider: 0,
    }

    current.quantidadeProjetos += 1
    current.valorTotal += toSafeNumber(project.valor_projeto)
    acc.set(key, current)
    return acc
  }, new Map())

  const ranking = Array.from(grouped.values()).sort((left, right) => {
    if (right.quantidadeProjetos !== left.quantidadeProjetos) {
      return right.quantidadeProjetos - left.quantidadeProjetos
    }

    if (right.valorTotal !== left.valorTotal) {
      return right.valorTotal - left.valorTotal
    }

    return left.vendedor.localeCompare(right.vendedor, "pt-BR")
  })

  const leader = ranking[0] ?? null
  const leaderCount = Math.max(1, leader?.quantidadeProjetos ?? 0)

  ranking.forEach((item) => {
    item.percentualLider = leaderCount > 0 ? (item.quantidadeProjetos / leaderCount) * 100 : 0
  })

  return {
    leader,
    totalProjetosPagos: eligibleProjects.length,
    valorTotalVendido: eligibleProjects.reduce((sum, project) => sum + toSafeNumber(project.valor_projeto), 0),
    participantes: ranking.length,
    ranking,
  }
}

export function buildCompetitionSummaryFromRanking(rows: CompetitionRankingRow[]): CompetitionSummary {
  const ranking = rows.map((row) => ({
    vendedorId: row.vendedor_id,
    vendedor: row.vendedor || "Sem vendedor",
    quantidadeProjetos: row.quantidade_projetos_pagos ?? 0,
    valorTotal: toSafeNumber(row.valor_total),
    percentualLider: 0,
  }))

  const sortedRanking = [...ranking].sort((left, right) => {
    if (right.quantidadeProjetos !== left.quantidadeProjetos) {
      return right.quantidadeProjetos - left.quantidadeProjetos
    }

    if (right.valorTotal !== left.valorTotal) {
      return right.valorTotal - left.valorTotal
    }

    return left.vendedor.localeCompare(right.vendedor, "pt-BR")
  })

  const leader = sortedRanking[0] ?? null
  const leaderCount = Math.max(1, leader?.quantidadeProjetos ?? 0)

  sortedRanking.forEach((item) => {
    item.percentualLider = leaderCount > 0 ? (item.quantidadeProjetos / leaderCount) * 100 : 0
  })

  return {
    leader,
    totalProjetosPagos: sortedRanking.reduce((sum, item) => sum + item.quantidadeProjetos, 0),
    valorTotalVendido: sortedRanking.reduce((sum, item) => sum + item.valorTotal, 0),
    participantes: sortedRanking.length,
    ranking: sortedRanking,
  }
}

export function buildDashboardSummary(projects: ProjectRow[]): DashboardSummary {
  const quantidadeProjetos = projects.length
  const faturamentoTotal = projects.reduce((sum, project) => sum + toSafeNumber(project.valor_projeto), 0)
  const valorEquipamentos = projects.reduce((sum, project) => sum + toSafeNumber(project.valor_equipamentos), 0)
  const valorServico = projects.reduce((sum, project) => sum + toSafeNumber(project.valor_servico), 0)
  const custoInstalacao = projects.reduce((sum, project) => sum + toSafeNumber(project.custo_instalacao), 0)
  const lucroTotal = projects.reduce((sum, project) => sum + toSafeNumber(project.lucro), 0)
  const margemValores = projects
    .map((project) => project.percentual_margem)
    .filter((value): value is number => Number.isFinite(value))
  const totalModulos = projects.reduce((sum, project) => sum + toSafeNumber(project.modulos), 0)
  const totalMicroinversores = projects.reduce((sum, project) => sum + toSafeNumber(project.microinversores), 0)

  return {
    faturamentoTotal,
    quantidadeProjetos,
    ticketMedio: quantidadeProjetos > 0 ? faturamentoTotal / quantidadeProjetos : 0,
    valorEquipamentos,
    valorServico,
    custoInstalacao,
    lucroTotal,
    margemMedia:
      margemValores.length > 0
        ? margemValores.reduce((sum, value) => sum + value, 0) / margemValores.length
        : 0,
    totalModulos,
    totalMicroinversores,
    projetosPagos: projects.filter((project) => project.pago).length,
    projetosFechados: projects.filter((project) => project.fechado).length,
    projetosParecerAprovado: projects.filter((project) => project.parecer_aprovado).length,
    projetosEntregues: projects.filter((project) => project.entregue).length,
    projetosInstalados: projects.filter((project) => project.instalado).length,
  }
}

export function buildDashboardSummaryFromView(row: DashboardGeneralSummaryRow | null): DashboardSummary {
  return {
    faturamentoTotal: toSafeNumber(row?.faturamento_total),
    quantidadeProjetos: row?.quantidade_projetos ?? 0,
    ticketMedio: toSafeNumber(row?.ticket_medio),
    valorEquipamentos: toSafeNumber(row?.valor_total_equipamentos),
    valorServico: toSafeNumber(row?.valor_total_servico),
    custoInstalacao: toSafeNumber(row?.custo_total_instalacao),
    lucroTotal: toSafeNumber(row?.lucro_total),
    margemMedia: toSafeNumber(row?.margem_media),
    totalModulos: row?.total_modulos ?? 0,
    totalMicroinversores: row?.total_microinversores ?? 0,
    projetosPagos: row?.projetos_pagos ?? 0,
    projetosFechados: row?.projetos_fechados ?? 0,
    projetosParecerAprovado: row?.projetos_parecer_aprovado ?? 0,
    projetosEntregues: row?.projetos_entregues ?? 0,
    projetosInstalados: row?.projetos_instalados ?? 0,
  }
}

export function buildSafeDashboardSummary(projects: ProjectSafeRow[]): DashboardSummary {
  return {
    faturamentoTotal: 0,
    quantidadeProjetos: projects.length,
    ticketMedio: 0,
    valorEquipamentos: 0,
    valorServico: 0,
    custoInstalacao: 0,
    lucroTotal: 0,
    margemMedia: 0,
    totalModulos: projects.reduce((sum, project) => sum + toSafeNumber(project.modulos), 0),
    totalMicroinversores: projects.reduce((sum, project) => sum + toSafeNumber(project.microinversores), 0),
    projetosPagos: projects.filter((project) => project.pago).length,
    projetosFechados: projects.filter((project) => project.fechado).length,
    projetosParecerAprovado: projects.filter((project) => project.parecer_aprovado).length,
    projetosEntregues: projects.filter((project) => project.entregue).length,
    projetosInstalados: projects.filter((project) => project.instalado).length,
  }
}

export function buildProjectRanking(projects: ProjectRow[]) {
  const grouped = projects.reduce<
    Map<string, { vendedor: string; quantidade: number; valorTotal: number; lucroTotal: number; margens: number[] }>
  >((acc, project) => {
    const vendedor = getProjectSellerName(project)
    const key = project.vendedor_id ?? vendedor
    const current = acc.get(key) ?? {
      vendedor,
      quantidade: 0,
      valorTotal: 0,
      lucroTotal: 0,
      margens: [],
    }

    current.quantidade += 1
    current.valorTotal += toSafeNumber(project.valor_projeto)
    current.lucroTotal += toSafeNumber(project.lucro)
    if (typeof project.percentual_margem === "number") {
      current.margens.push(project.percentual_margem)
    }

    acc.set(key, current)
    return acc
  }, new Map())

  return Array.from(grouped.values())
    .map((item) => ({
      vendedor: item.vendedor,
      quantidade: item.quantidade,
      valorTotal: item.valorTotal,
      lucroTotal: item.lucroTotal,
      margemMedia:
        item.margens.length > 0
          ? item.margens.reduce((sum, value) => sum + value, 0) / item.margens.length
          : 0,
    }))
    .sort((left, right) => {
      if (right.quantidade !== left.quantidade) {
        return right.quantidade - left.quantidade
      }

      if (right.valorTotal !== left.valorTotal) {
        return right.valorTotal - left.valorTotal
      }

      return left.vendedor.localeCompare(right.vendedor, "pt-BR")
    })
}

export function buildCategoryTotals(
  projects: ProjectRow[],
  field: "marca" | "forma_pagamento" | "cidade"
) {
  const grouped = projects.reduce<Map<string, { label: string; total: number; quantidade: number }>>((acc, project) => {
    const label = (project[field] || "Não informado").trim() || "Não informado"
    const current = acc.get(label) ?? {
      label,
      total: 0,
      quantidade: 0,
    }

    current.total += toSafeNumber(project.valor_projeto)
    current.quantidade += 1
    acc.set(label, current)
    return acc
  }, new Map())

  return Array.from(grouped.values()).sort((left, right) => {
    if (right.total !== left.total) {
      return right.total - left.total
    }

    if (right.quantidade !== left.quantidade) {
      return right.quantidade - left.quantidade
    }

    return left.label.localeCompare(right.label, "pt-BR")
  })
}

export function buildSafeCategoryTotals(
  projects: ProjectSafeRow[],
  field: "marca" | "forma_pagamento" | "cidade"
) {
  const grouped = projects.reduce<Map<string, { label: string; total: number; quantidade: number }>>((acc, project) => {
    const label = (project[field] || "Não informado").trim() || "Não informado"
    const current = acc.get(label) ?? {
      label,
      total: 0,
      quantidade: 0,
    }

    current.quantidade += 1
    acc.set(label, current)
    return acc
  }, new Map())

  return Array.from(grouped.values()).sort((left, right) => {
    if (right.quantidade !== left.quantidade) {
      return right.quantidade - left.quantidade
    }

    return left.label.localeCompare(right.label, "pt-BR")
  })
}

export function buildStatusBreakdown(projects: ProjectRow[]) {
  return [
    { label: "Pagos", valor: projects.filter((project) => project.pago).length },
    { label: "Não pagos", valor: projects.filter((project) => !project.pago).length },
    { label: "Fechados", valor: projects.filter((project) => project.fechado).length },
    { label: "Não fechados", valor: projects.filter((project) => !project.fechado).length },
    { label: "Instalados", valor: projects.filter((project) => project.instalado).length },
    { label: "Não instalados", valor: projects.filter((project) => !project.instalado).length },
    { label: "Entregues", valor: projects.filter((project) => project.entregue).length },
    {
      label: "Parecer aprovado",
      valor: projects.filter((project) => project.parecer_aprovado).length,
    },
  ]
}

export function mapProjectStatusSummary(rows: ProjectStatusSummaryRow[]) {
  const totals = new Map(rows.map((row) => [row.status, row.quantidade ?? 0]))

  return [
    { label: "Pagos", valor: totals.get("pagos") ?? 0 },
    { label: "Não pagos", valor: totals.get("nao_pagos") ?? 0 },
    { label: "Fechados", valor: totals.get("fechados") ?? 0 },
    { label: "Não fechados", valor: totals.get("nao_fechados") ?? 0 },
    { label: "Instalados", valor: totals.get("instalados") ?? 0 },
    { label: "Não instalados", valor: totals.get("nao_instalados") ?? 0 },
    { label: "Entregues", valor: totals.get("entregues") ?? 0 },
    { label: "Parecer aprovado", valor: totals.get("parecer_aprovado") ?? 0 },
  ]
}

export function buildSafeProjectRanking(projects: ProjectSafeRow[]) {
  const grouped = projects.reduce<Map<string, { vendedor: string; quantidade: number }>>((acc, project) => {
    const vendedor = project.vendedor?.trim() || "Sem vendedor"
    const key = project.vendedor_id ?? vendedor
    const current = acc.get(key) ?? {
      vendedor,
      quantidade: 0,
    }

    current.quantidade += 1
    acc.set(key, current)
    return acc
  }, new Map())

  return Array.from(grouped.values()).sort((left, right) => {
    if (right.quantidade !== left.quantidade) {
      return right.quantidade - left.quantidade
    }

    return left.vendedor.localeCompare(right.vendedor, "pt-BR")
  })
}

export function filterProjectsForSellerScope(
  projects: ProjectRow[],
  role: UserRole | null | undefined,
  userId: string | null | undefined
) {
  if (role !== "corretor" || !userId) {
    return projects
  }

  return projects.filter((project) => project.vendedor_id === userId)
}


import { supabase } from "@/lib/supabase"
import { isOwnerRole } from "@/lib/permissions"
import type { UserRole } from "@/types"

const LEAD_SOURCE_TABLE = "Agente_Base_EnergiaSolar"
const LEAD_STATE_TABLE = "crm_lead_state"
const LEAD_ATTACHMENTS_TABLE = "lead_attachments"
const PROFILES_TABLE = "profiles"
const KANBAN_STAGES_TABLE = "kanban_stages"
const PAGE_SIZE = 1000
const ENERGY_ATTACHMENT_TYPE = "conta_energia"

type LeadSourceExportRow = {
  id: string
  nome: string | null
  numero: string | null
  telefone_confirmado: string | null
  email: string | null
  cidade: string | null
  tipoimovel: string | null
  valorcontaenergia: string | null
  origem: string | null
  campanha: string | null
  status_conversa: string | null
  conta: boolean | null
  outra_info: string | null
  created_at: string | null
  data: string | null
  last_interaction_at: string | null
}

type LeadStateExportRow = {
  lead_id: string
  corretor_id: string | null
  assumed_at: string | null
  stage_id: string | null
  arquivado: boolean
  first_response_at: string | null
}

type SellerExportRow = {
  id: string
  nome: string | null
  email: string | null
}

type AttachmentExportRow = {
  lead_id: string | null
  attachment_type: string
  ativo: boolean
  deleted_at: string | null
}

type StageExportRow = {
  id: string
  nome: string
}

export type ExportLeadRow = {
  leadId: string
  nome: string | null
  telefone: string | null
  email: string | null
  cidade: string | null
  tipoImovel: string | null
  valorConta: string | null
  origem: string | null
  campanha: string | null
  statusConversa: string | null
  statusCrm: string
  arquivado: boolean
  atribuido: boolean
  contaRecebida: boolean
  quantidadeAnexos: number
  vendedorNome: string | null
  vendedorEmail: string | null
  dataCriacao: string | null
  dataAtribuicao: string | null
  primeiraResposta: string | null
  ultimaInteracao: string | null
  observacoes: string | null
}

export type ExportLeadSummaryItem = {
  label: string
  value: number
}

export type ExportLeadsDataResult = {
  rows: ExportLeadRow[]
  summary: {
    totalLeads: number
    leadsAtribuidos: number
    leadsSemVendedor: number
    leadsComContaRecebida: number
    leadsArquivados: number
    leadsPorVendedor: ExportLeadSummaryItem[]
    leadsPorOrigem: ExportLeadSummaryItem[]
  }
}

function normalizeNullableString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizePhone(rawPhone: string | null | undefined) {
  const normalized = normalizeNullableString(rawPhone)

  if (!normalized) {
    return null
  }

  const digits = normalized.replace(/\D/g, "")

  if (!digits) {
    return null
  }

  if (digits.length === 13 && digits.startsWith("55")) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }

  if (digits.length === 12 && digits.startsWith("55")) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  return digits
}

async function fetchAllRows<T>({
  table,
  select,
  orderBy,
}: {
  table: string
  select: string
  orderBy: string
}) {
  const collected: T[] = []
  let from = 0

  while (true) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderBy, { ascending: true })
      .range(from, to)

    if (error) {
      throw error
    }

    const rows = (data ?? []) as T[]
    collected.push(...rows)

    if (rows.length < PAGE_SIZE) {
      break
    }

    from += PAGE_SIZE
  }

  return collected
}

function buildStatusCrm({
  arquivado,
  stageId,
  stageNamesById,
  corretorId,
}: {
  arquivado: boolean
  stageId: string | null
  stageNamesById: Map<string, string>
  corretorId: string | null
}) {
  if (arquivado) {
    return "Arquivado"
  }

  if (stageId && stageNamesById.has(stageId)) {
    return stageNamesById.get(stageId) ?? "Sem etapa"
  }

  if (!corretorId) {
    return "Pool"
  }

  return "Sem etapa"
}

function incrementCounter(counter: Map<string, number>, key: string) {
  counter.set(key, (counter.get(key) ?? 0) + 1)
}

export async function fetchExportLeadsData(role: UserRole | null | undefined): Promise<ExportLeadsDataResult> {
  if (!isOwnerRole(role)) {
    throw new Error("Somente o perfil dono pode exportar os leads.")
  }

  const [leadSources, leadStates, sellers, attachments, stages] = await Promise.all([
    fetchAllRows<LeadSourceExportRow>({
      table: LEAD_SOURCE_TABLE,
      select:
        "id,nome,numero,telefone_confirmado,email,cidade,tipoimovel,valorcontaenergia,origem,campanha,status_conversa,conta,outra_info,created_at,data,last_interaction_at",
      orderBy: "created_at",
    }),
    fetchAllRows<LeadStateExportRow>({
      table: LEAD_STATE_TABLE,
      select: "lead_id,corretor_id,assumed_at,stage_id,arquivado,first_response_at",
      orderBy: "lead_id",
    }),
    fetchAllRows<SellerExportRow>({
      table: PROFILES_TABLE,
      select: "id,nome,email",
      orderBy: "created_at",
    }),
    fetchAllRows<AttachmentExportRow>({
      table: LEAD_ATTACHMENTS_TABLE,
      select: "lead_id,attachment_type,ativo,deleted_at",
      orderBy: "created_at",
    }),
    fetchAllRows<StageExportRow>({
      table: KANBAN_STAGES_TABLE,
      select: "id,nome",
      orderBy: "ordem",
    }),
  ])

  const leadStatesById = new Map(leadStates.map((row) => [row.lead_id, row]))
  const sellersById = new Map(sellers.map((row) => [row.id, row]))
  const stageNamesById = new Map(stages.map((row) => [row.id, row.nome]))
  const attachmentStatsByLeadId = new Map<string, { total: number; hasEnergyBill: boolean }>()

  attachments.forEach((attachment) => {
    if (!attachment.lead_id || !attachment.ativo || attachment.deleted_at !== null) {
      return
    }

    const current = attachmentStatsByLeadId.get(attachment.lead_id) ?? {
      total: 0,
      hasEnergyBill: false,
    }

    current.total += 1
    current.hasEnergyBill ||= attachment.attachment_type === ENERGY_ATTACHMENT_TYPE
    attachmentStatsByLeadId.set(attachment.lead_id, current)
  })

  const leadsBySeller = new Map<string, number>()
  const leadsByOrigin = new Map<string, number>()

  const rows = leadSources
    .map<ExportLeadRow>((lead) => {
      const state = leadStatesById.get(lead.id)
      const seller = state?.corretor_id ? sellersById.get(state.corretor_id) ?? null : null
      const attachmentStats = attachmentStatsByLeadId.get(lead.id) ?? {
        total: 0,
        hasEnergyBill: false,
      }
      const atribuido = Boolean(state?.corretor_id)
      const contaRecebida = attachmentStats.hasEnergyBill || lead.conta === true
      const vendedorNome = seller?.nome ?? seller?.email ?? null
      const origem = normalizeNullableString(lead.origem) ?? "Não informado"

      incrementCounter(leadsBySeller, vendedorNome ?? "Sem vendedor")
      incrementCounter(leadsByOrigin, origem)

      return {
        leadId: lead.id,
        nome: normalizeNullableString(lead.nome),
        telefone: normalizePhone(lead.telefone_confirmado) ?? normalizePhone(lead.numero),
        email: normalizeNullableString(lead.email)?.toLowerCase() ?? null,
        cidade: normalizeNullableString(lead.cidade),
        tipoImovel: normalizeNullableString(lead.tipoimovel),
        valorConta: normalizeNullableString(lead.valorcontaenergia),
        origem: normalizeNullableString(lead.origem),
        campanha: normalizeNullableString(lead.campanha),
        statusConversa: normalizeNullableString(lead.status_conversa),
        statusCrm: buildStatusCrm({
          arquivado: state?.arquivado ?? false,
          stageId: state?.stage_id ?? null,
          stageNamesById,
          corretorId: state?.corretor_id ?? null,
        }),
        arquivado: state?.arquivado ?? false,
        atribuido,
        contaRecebida,
        quantidadeAnexos: attachmentStats.total,
        vendedorNome,
        vendedorEmail: seller?.email ?? null,
        dataCriacao: normalizeNullableString(lead.created_at) ?? normalizeNullableString(lead.data),
        dataAtribuicao: normalizeNullableString(state?.assumed_at),
        primeiraResposta: normalizeNullableString(state?.first_response_at),
        ultimaInteracao: normalizeNullableString(lead.last_interaction_at),
        observacoes: normalizeNullableString(lead.outra_info),
      }
    })
    .sort((left, right) => (right.dataCriacao ?? "").localeCompare(left.dataCriacao ?? ""))

  return {
    rows,
    summary: {
      totalLeads: rows.length,
      leadsAtribuidos: rows.filter((row) => row.atribuido).length,
      leadsSemVendedor: rows.filter((row) => !row.atribuido).length,
      leadsComContaRecebida: rows.filter((row) => row.contaRecebida).length,
      leadsArquivados: rows.filter((row) => row.arquivado).length,
      leadsPorVendedor: Array.from(leadsBySeller.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((left, right) => right.value - left.value),
      leadsPorOrigem: Array.from(leadsByOrigin.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((left, right) => right.value - left.value),
    },
  }
}

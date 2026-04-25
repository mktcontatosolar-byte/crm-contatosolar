import { supabase } from "@/lib/supabase"
import type { KanbanStage, Lead, Profile } from "@/types"

type LeadSourceRow = {
  id: string
  data: string | null
  nome: string | null
  numero: string | null
  tipoimovel: string | null
  valorcontaenergia: string | null
  outra_info: string | null
  conta: boolean | null
  urgencia: string | null
  telefone_confirmado: string | null
  cidade: string | null
  remotejid: string | null
  created_at: string | null
  followup_count: number | null
  status_conversa: string | null
  last_interaction_at: string | null
  origem: string | null
  email: string | null
  campanha: string | null
}

type LeadStateRow = {
  lead_id: string
  corretor_id: string | null
  assumed_at: string | null
  stage_id: string | null
  arquivado: boolean
  ia_paused: boolean
  first_response_at: string | null
  created_at: string
  updated_at: string
}

type LeadMessageRow = {
  id: number
  session_id: string
  message: unknown
  created_at: string | null
}

const LEAD_SOURCE_TABLE = "Agente_Base_EnergiaSolar"
const LEAD_STATE_TABLE = "crm_lead_state"
const LEAD_NOTES_TABLE = "crm_lead_notes"
const LEAD_ACTIVITY_TABLE = "crm_lead_activity"
const LEAD_TAGS_TABLE = "crm_lead_tags"
const LEAD_MESSAGES_TABLE = "n8n_chat_histories_nova"

const leadSourceSelect =
  "id,data,nome,numero,tipoimovel,valorcontaenergia,outra_info,conta,urgencia,telefone_confirmado,cidade,remotejid,created_at,followup_count,status_conversa,last_interaction_at,origem,email,campanha"

const leadStateSelect =
  "lead_id,corretor_id,assumed_at,stage_id,arquivado,ia_paused,first_response_at,created_at,updated_at"

export type LeadStatePatch = Partial<
  Pick<LeadStateRow, "corretor_id" | "assumed_at" | "stage_id" | "arquivado" | "ia_paused" | "first_response_at">
>

function toIsoOrNull(value: string | null | undefined) {
  return value ?? null
}

function ensureDate(value: string | null | undefined, fallback?: string | null) {
  return value ?? fallback ?? new Date().toISOString()
}

function extractPhoneFromRemoteJid(remoteJid: string | null | undefined) {
  if (!remoteJid) {
    return null
  }

  const [rawValue] = remoteJid.split("@")
  const digits = rawValue.replace(/\D/g, "")

  return digits.length > 0 ? digits : null
}

function formatBrazilPhone(rawPhone: string | null | undefined) {
  if (!rawPhone) {
    return null
  }

  const digits = rawPhone.replace(/\D/g, "")

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

function mapLead(base: LeadSourceRow, state?: LeadStateRow | null): Lead {
  const createdAt = ensureDate(base.created_at, base.data)
  const phoneDigits = base.numero?.trim() || extractPhoneFromRemoteJid(base.remotejid)
  const formattedPhone = formatBrazilPhone(phoneDigits)

  return {
    id: base.id,
    remotejid: base.remotejid ?? "",
    numero: formattedPhone,
    nome_completo: base.nome,
    tipoimovel: base.tipoimovel,
    valorcontaenergia: base.valorcontaenergia,
    conta: base.conta,
    urgencia: base.urgencia,
    telefone_confirmado: base.telefone_confirmado,
    cidade: base.cidade,
    email: base.email,
    telefone_contato: formattedPhone,
    horario_preferido: null,
    tem_nome: Boolean(base.nome),
    tem_email: Boolean(base.email),
    tem_telefone: Boolean(phoneDigits),
    tem_horario: false,
    status_conversa: base.status_conversa ?? "novo",
    campanha: base.campanha,
    origem: base.origem,
    outra_info: base.outra_info,
    corretor_id: state?.corretor_id ?? null,
    assumed_at: state?.assumed_at ?? null,
    stage_id: state?.stage_id ?? null,
    arquivado: state?.arquivado ?? false,
    ia_paused: state?.ia_paused ?? false,
    followup_count: base.followup_count ?? 0,
    first_response_at: state?.first_response_at ?? null,
    last_interaction_at: ensureDate(base.last_interaction_at, createdAt),
    created_at: createdAt,
  }
}

async function fetchLeadStatesByIds(ids: string[]) {
  if (ids.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from(LEAD_STATE_TABLE)
    .select(leadStateSelect)
    .in("lead_id", ids)

  if (error) {
    throw error
  }

  return (data ?? []) as LeadStateRow[]
}

async function fetchLeadSourcesByIds(ids: string[]) {
  if (ids.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from(LEAD_SOURCE_TABLE)
    .select(leadSourceSelect)
    .in("id", ids)

  if (error) {
    throw error
  }

  return (data ?? []) as LeadSourceRow[]
}

function mergeLeads(baseRows: LeadSourceRow[], stateRows: LeadStateRow[]) {
  const statesById = new Map(stateRows.map((state) => [state.lead_id, state]))

  return baseRows.map((base) => mapLead(base, statesById.get(base.id) ?? null))
}

function compareNullableDatesDesc(left: string | null, right: string | null) {
  return (right ?? "").localeCompare(left ?? "")
}

export async function fetchLeadById(id: string) {
  const [baseResult, stateResult] = await Promise.all([
    supabase.from(LEAD_SOURCE_TABLE).select(leadSourceSelect).eq("id", id).maybeSingle(),
    supabase.from(LEAD_STATE_TABLE).select(leadStateSelect).eq("lead_id", id).maybeSingle(),
  ])

  if (baseResult.error) {
    throw baseResult.error
  }

  if (stateResult.error) {
    throw stateResult.error
  }

  if (!baseResult.data) {
    return null
  }

  return mapLead(baseResult.data as LeadSourceRow, (stateResult.data as LeadStateRow | null) ?? null)
}

export async function fetchPoolLeads() {
  const { data: baseData, error: baseError } = await supabase
    .from(LEAD_SOURCE_TABLE)
    .select(leadSourceSelect)
    .order("created_at", { ascending: false })

  if (baseError) {
    throw baseError
  }

  const bases = (baseData ?? []) as LeadSourceRow[]
  const states = await fetchLeadStatesByIds(bases.map((row) => row.id))

  return mergeLeads(bases, states).filter((lead) => !lead.corretor_id && !lead.arquivado)
}

export async function fetchKanbanLeads({
  userId,
  isAdmin,
  brokerId,
  creationDateFilter,
  iaStatusFilter,
  originFilter,
}: {
  userId: string
  isAdmin: boolean
  brokerId: string
  creationDateFilter: "all" | "today" | "7d" | "30d"
  iaStatusFilter: "all" | "active" | "paused"
  originFilter: string
}) {
  let stateQuery = supabase
    .from(LEAD_STATE_TABLE)
    .select(leadStateSelect)
    .not("corretor_id", "is", null)
    .eq("arquivado", false)

  if (!isAdmin) {
    stateQuery = stateQuery.eq("corretor_id", userId)
  } else if (brokerId) {
    stateQuery = stateQuery.eq("corretor_id", brokerId)
  }

  if (iaStatusFilter === "active") {
    stateQuery = stateQuery.eq("ia_paused", false)
  } else if (iaStatusFilter === "paused") {
    stateQuery = stateQuery.eq("ia_paused", true)
  }

  const { data: stateData, error: stateError } = await stateQuery

  if (stateError) {
    throw stateError
  }

  const states = (stateData ?? []) as LeadStateRow[]
  const bases = await fetchLeadSourcesByIds(states.map((row) => row.lead_id))

  const now = new Date()
  const createdAfter =
    creationDateFilter === "today"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      : creationDateFilter === "7d"
        ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        : creationDateFilter === "30d"
          ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
          : null

  return mergeLeads(bases, states)
    .filter((lead) => !createdAfter || lead.created_at >= createdAfter)
    .filter((lead) => originFilter === "all" || (lead.origem ?? "") === originFilter)
    .sort((left, right) => compareNullableDatesDesc(left.last_interaction_at, right.last_interaction_at))
}

export async function fetchKanbanOrigins({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  let stateQuery = supabase
    .from(LEAD_STATE_TABLE)
    .select("lead_id,corretor_id,arquivado")
    .not("corretor_id", "is", null)
    .eq("arquivado", false)

  if (!isAdmin) {
    stateQuery = stateQuery.eq("corretor_id", userId)
  }

  const { data: stateData, error: stateError } = await stateQuery

  if (stateError) {
    throw stateError
  }

  const leadIds = (stateData ?? []).map((row) => row.lead_id)
  const bases = await fetchLeadSourcesByIds(leadIds)

  return [...new Set(bases.map((row) => row.origem).filter(Boolean))] as string[]
}

export async function fetchArchivedLeads() {
  const { data: stateData, error: stateError } = await supabase
    .from(LEAD_STATE_TABLE)
    .select(leadStateSelect)
    .eq("arquivado", true)

  if (stateError) {
    throw stateError
  }

  const states = (stateData ?? []) as LeadStateRow[]
  const bases = await fetchLeadSourcesByIds(states.map((row) => row.lead_id))

  return mergeLeads(bases, states).sort((left, right) => compareNullableDatesDesc(left.last_interaction_at, right.last_interaction_at))
}

export async function fetchMetricLeads() {
  const [baseResult, stateResult] = await Promise.all([
    supabase.from(LEAD_SOURCE_TABLE).select(leadSourceSelect),
    supabase.from(LEAD_STATE_TABLE).select(leadStateSelect),
  ])

  if (baseResult.error) {
    throw baseResult.error
  }

  if (stateResult.error) {
    throw stateResult.error
  }

  return mergeLeads(
    (baseResult.data ?? []) as LeadSourceRow[],
    (stateResult.data ?? []) as LeadStateRow[]
  ).sort((left, right) => right.created_at.localeCompare(left.created_at))
}

export async function fetchAssignedLeads() {
  const { data: stateData, error: stateError } = await supabase
    .from(LEAD_STATE_TABLE)
    .select(leadStateSelect)
    .not("corretor_id", "is", null)

  if (stateError) {
    throw stateError
  }

  const states = (stateData ?? []) as LeadStateRow[]
  const bases = await fetchLeadSourcesByIds(states.map((row) => row.lead_id))

  return mergeLeads(bases, states)
}

export async function searchCrmLeads(query: string) {
  const normalized = query.trim()
  if (normalized.length < 2) {
    return []
  }

  const { data: baseData, error: baseError } = await supabase
    .from(LEAD_SOURCE_TABLE)
    .select(leadSourceSelect)
    .or(`nome.ilike.%${normalized}%,numero.ilike.%${normalized}%,email.ilike.%${normalized}%`)
    .limit(20)

  if (baseError) {
    throw baseError
  }

  const bases = (baseData ?? []) as LeadSourceRow[]
  const states = await fetchLeadStatesByIds(bases.map((row) => row.id))

  return mergeLeads(bases, states)
}

export async function fetchLeadMessages(sessionId: string) {
  const { data, error } = await supabase
    .from(LEAD_MESSAGES_TABLE)
    .select("id,session_id,message,created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as LeadMessageRow[]
}

export async function updateLeadState(leadId: string, patch: LeadStatePatch) {
  const payload = {
    lead_id: leadId,
    corretor_id: patch.corretor_id ?? null,
    assumed_at: toIsoOrNull(patch.assumed_at),
    stage_id: patch.stage_id ?? null,
    arquivado: patch.arquivado ?? false,
    ia_paused: patch.ia_paused ?? false,
    first_response_at: toIsoOrNull(patch.first_response_at),
  }

  const { error } = await supabase.from(LEAD_STATE_TABLE).upsert(payload, {
    onConflict: "lead_id",
  })

  if (error) {
    throw error
  }
}

export async function fetchLeadBrokerMap(leads: Array<Pick<Lead, "corretor_id">>) {
  const brokerIds = [...new Set(leads.map((lead) => lead.corretor_id).filter(Boolean))]
  if (brokerIds.length === 0) {
    return new Map<string, string>()
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,nome,email")
    .in("id", brokerIds)

  if (error) {
    throw error
  }

  return new Map(
    ((data ?? []) as Array<Pick<Profile, "id" | "nome" | "email">>).map((broker) => [
      broker.id,
      broker.nome || broker.email || "Vendedor sem nome",
    ])
  )
}

export async function fetchLeadStages() {
  const { data, error } = await supabase
    .from("kanban_stages")
    .select("id,nome,ordem,cor,is_final")
    .order("ordem", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as KanbanStage[]
}

export { LEAD_ACTIVITY_TABLE, LEAD_MESSAGES_TABLE, LEAD_NOTES_TABLE, LEAD_SOURCE_TABLE, LEAD_STATE_TABLE, LEAD_TAGS_TABLE }

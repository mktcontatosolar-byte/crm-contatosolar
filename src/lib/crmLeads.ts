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
  horario_preferido: string | null
  lead_entry_type: string | null
  manual_created_by: string | null
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
  "id,data,nome,numero,tipoimovel,valorcontaenergia,outra_info,conta,urgencia,telefone_confirmado,cidade,remotejid,created_at,followup_count,status_conversa,last_interaction_at,origem,email,campanha,horario_preferido,lead_entry_type,manual_created_by"

const leadStateSelect =
  "lead_id,corretor_id,assumed_at,stage_id,arquivado,ia_paused,first_response_at,created_at,updated_at"

export type LeadStatePatch = Partial<
  Pick<LeadStateRow, "corretor_id" | "assumed_at" | "stage_id" | "arquivado" | "ia_paused" | "first_response_at">
>

export type ManualLeadInput = {
  nome: string | null
  telefone: string | null
  email: string | null
  horario_preferido: string | null
  cidade: string | null
  tipoimovel: string | null
  valorcontaenergia: string | null
  outra_info: string | null
  conta: boolean | null
  urgencia: string | null
  telefone_confirmado: string | null
  origem: string | null
  campanha: string | null
}

const BRAZIL_TIMEZONE_OFFSET = "-03:00"

function normalizeNullableString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeLeadEntryType(value: string | null | undefined) {
  return normalizeNullableString(value)?.toLowerCase() === "manual" ? "manual" : "meta_ads"
}

function normalizeLeadTimestamp(value: string | null | undefined) {
  const normalized = normalizeNullableString(value)

  if (!normalized) {
    return null
  }

  const withIsoSeparator = normalized.replace(" ", "T")
  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(withIsoSeparator)

  if (hasExplicitTimezone) {
    return withIsoSeparator
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(withIsoSeparator)) {
    return `${withIsoSeparator}T00:00:00${BRAZIL_TIMEZONE_OFFSET}`
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(withIsoSeparator)) {
    return `${withIsoSeparator}${BRAZIL_TIMEZONE_OFFSET}`
  }

  return withIsoSeparator
}

function toIsoOrNull(value: string | null | undefined) {
  return value ?? null
}

function ensureDate(value: string | null | undefined, fallback?: string | null) {
  return value ?? fallback ?? new Date().toISOString()
}

function isDateBefore(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) {
    return false
  }

  const leftTime = new Date(left).getTime()
  const rightTime = new Date(right).getTime()

  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
    return false
  }

  return leftTime < rightTime
}

function extractPhoneFromRemoteJid(remoteJid: string | null | undefined) {
  if (!remoteJid) {
    return null
  }

  const [rawValue] = remoteJid.split("@")
  const digits = rawValue.replace(/\D/g, "")

  return digits.length > 0 ? digits : null
}

function buildSessionIdCandidates(sessionId: string) {
  const normalized = sessionId.trim()
  const candidates = new Set<string>()

  if (!normalized) {
    return []
  }

  candidates.add(normalized)

  const withoutSuffix = normalized.split("@")[0]?.trim() ?? ""
  const digitsOnly = normalized.replace(/\D/g, "")

  if (withoutSuffix) {
    candidates.add(withoutSuffix)
  }

  function addPhoneVariants(rawDigits: string) {
    if (!rawDigits) {
      return
    }

    candidates.add(rawDigits)
    candidates.add(`${rawDigits}@s.whatsapp.net`)
    candidates.add(`${rawDigits}@c.us`)

    if (rawDigits.startsWith("55") && (rawDigits.length === 12 || rawDigits.length === 13)) {
      const localDigits = rawDigits.slice(2)
      candidates.add(localDigits)
      candidates.add(`${localDigits}@s.whatsapp.net`)
      candidates.add(`${localDigits}@c.us`)
      return
    }

    if (rawDigits.length === 10 || rawDigits.length === 11) {
      const brazilDigits = `55${rawDigits}`
      candidates.add(brazilDigits)
      candidates.add(`${brazilDigits}@s.whatsapp.net`)
      candidates.add(`${brazilDigits}@c.us`)
    }
  }

  if (digitsOnly) {
    addPhoneVariants(digitsOnly)
  }

  if (withoutSuffix && /\d/.test(withoutSuffix)) {
    candidates.add(`${withoutSuffix}@s.whatsapp.net`)
    candidates.add(`${withoutSuffix}@c.us`)
  }

  return [...candidates]
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
  const normalizedEntryType = normalizeLeadEntryType(base.lead_entry_type)
  const isManualLead =
    normalizedEntryType === "manual" || Boolean(normalizeNullableString(base.manual_created_by))
  const leadEntryType = isManualLead ? "manual" : "meta_ads"
  const createdAt = ensureDate(normalizeLeadTimestamp(base.created_at), normalizeLeadTimestamp(base.data))
  const rawLastInteractionAt = ensureDate(normalizeLeadTimestamp(base.last_interaction_at), createdAt)
  const lastInteractionAt = isDateBefore(rawLastInteractionAt, createdAt) ? createdAt : rawLastInteractionAt
  const phoneDigits = normalizeNullableString(base.numero) || extractPhoneFromRemoteJid(base.remotejid)
  const formattedPhone = formatBrazilPhone(phoneDigits)
  const email = normalizeNullableString(base.email)?.toLowerCase() ?? null
  const horarioPreferido = isManualLead ? normalizeNullableString(base.horario_preferido) : null
  const origem =
    normalizeNullableString(base.origem) ?? (isManualLead ? null : "Meta ADS")

  return {
    id: base.id,
    remotejid: normalizeNullableString(base.remotejid) ?? "",
    numero: formattedPhone,
    nome_completo: normalizeNullableString(base.nome),
    tipoimovel: normalizeNullableString(base.tipoimovel),
    valorcontaenergia: normalizeNullableString(base.valorcontaenergia),
    conta: base.conta,
    urgencia: normalizeNullableString(base.urgencia),
    telefone_confirmado: normalizeNullableString(base.telefone_confirmado),
    cidade: normalizeNullableString(base.cidade),
    email,
    telefone_contato: formattedPhone,
    horario_preferido: horarioPreferido,
    tem_nome: Boolean(normalizeNullableString(base.nome)),
    tem_email: Boolean(email),
    tem_telefone: Boolean(phoneDigits),
    tem_horario: Boolean(horarioPreferido),
    status_conversa: normalizeNullableString(base.status_conversa) ?? "novo",
    campanha: normalizeNullableString(base.campanha),
    origem,
    lead_entry_type: leadEntryType,
    manual_created_by: base.manual_created_by ?? null,
    outra_info: normalizeNullableString(base.outra_info),
    corretor_id: state?.corretor_id ?? null,
    assumed_at: state?.assumed_at ?? null,
    stage_id: state?.stage_id ?? null,
    arquivado: state?.arquivado ?? false,
    ia_paused: state?.ia_paused ?? false,
    followup_count: base.followup_count ?? 0,
    first_response_at: state?.first_response_at ?? null,
    last_interaction_at: lastInteractionAt,
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

  return [
    ...new Set(
      bases
        .map((row) => mapLead(row, null).origem)
        .filter((origin): origin is string => Boolean(origin))
    ),
  ]
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
  const normalizedSessionId = normalizeNullableString(sessionId)

  if (!normalizedSessionId) {
    return []
  }

  const { data, error } = await supabase
    .from(LEAD_MESSAGES_TABLE)
    .select("id,session_id,message,created_at")
    .eq("session_id", normalizedSessionId)
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as LeadMessageRow[]
}

export async function fetchLeadMessagesByIdentifiers(identifiers: Array<string | null | undefined>) {
  const sessionCandidates = [...new Set(identifiers.flatMap((identifier) => (identifier ? buildSessionIdCandidates(identifier) : [])))]

  if (sessionCandidates.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from(LEAD_MESSAGES_TABLE)
    .select("id,session_id,message,created_at")
    .in("session_id", sessionCandidates)
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as LeadMessageRow[]
}

export { buildSessionIdCandidates }

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

export async function createManualLead(input: ManualLeadInput, userId: string) {
  const now = new Date().toISOString()
  const leadId = crypto.randomUUID()
  const phoneDigits = input.telefone?.replace(/\D/g, "") || null

  const { error: insertError } = await supabase.from(LEAD_SOURCE_TABLE).insert({
    id: leadId,
    data: now,
    nome: input.nome?.trim() || null,
    numero: phoneDigits,
    tipoimovel: input.tipoimovel?.trim() || null,
    valorcontaenergia: input.valorcontaenergia?.trim() || null,
    outra_info: input.outra_info?.trim() || null,
    conta: input.conta,
    urgencia: input.urgencia?.trim() || null,
    telefone_confirmado: input.telefone_confirmado?.trim() || null,
    cidade: input.cidade?.trim() || null,
    remotejid: null,
    created_at: now,
    followup_count: 0,
    status_conversa: "novo",
    last_interaction_at: now,
    origem: input.origem?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    campanha: null,
    horario_preferido: input.horario_preferido?.trim() || null,
    lead_entry_type: "manual",
    manual_created_by: userId,
  })

  if (insertError) {
    throw insertError
  }

  const stages = await fetchLeadStages()

  await updateLeadState(leadId, {
    corretor_id: userId,
    assumed_at: now,
    stage_id: stages[0]?.id ?? null,
    arquivado: false,
    ia_paused: false,
    first_response_at: null,
  })

  const createdLead = await fetchLeadById(leadId)

  if (!createdLead) {
    throw new Error("Não foi possível carregar o lead manual criado.")
  }

  return createdLead
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



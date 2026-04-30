import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Bot,
  MessageSquareText,
  RefreshCw,
  UserCheck,
} from "lucide-react"

import {
  formatCrmDateTime,
  formatCrmRelativeDateTime,
  formatCrmTime,
} from "@/lib/dateTime"
import { cleanLeadConversationMessage, shouldHideConversationMessage } from "@/lib/leadMessages"
import { formatSupabaseValue } from "@/lib/utils"
import type { ChatMessage, LeadActivity, LeadDetail, Profile } from "@/types"
import type { LeadViewModel } from "@/components/crm/lead-detail/LeadDetailSections"

type ExtractedLeadInfoKey =
  | "valorcontaenergia"
  | "cidade"
  | "urgencia"
  | "tipoimovel"
  | "nome"
  | "telefone"
  | "origem"
  | "campanha"
  | "email"
type ExtractedLeadInfo = Partial<Record<ExtractedLeadInfoKey, string>>

export type LeadHeaderBadge = {
  label: string
  tone?: "primary" | "accent" | "muted" | "outline"
  className: string
}

export const EMPTY_VALUE = "Não informado"

export function formatDateTime(dateString: string | null | undefined) {
  return formatCrmDateTime(dateString, EMPTY_VALUE)
}

export function formatTimeOnly(dateString: string | null | undefined) {
  return formatCrmTime(dateString, EMPTY_VALUE)
}

export function formatRelativeTime(dateString: string | null | undefined) {
  return formatCrmRelativeDateTime(dateString, EMPTY_VALUE)
}


export function getSupabaseErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") {
    return fallback
  }

  const candidate = error as {
    message?: string
    details?: string
    hint?: string
    code?: string
  }

  if (candidate.code === "42501") {
    return "Sem permissão para salvar a observação. Verifique a policy de INSERT da tabela lead_notes."
  }

  return candidate.details || candidate.hint || candidate.message || fallback
}

export function leadDisplayName(lead: LeadDetail | null) {
  if (!lead) {
    return "Lead sem identificação"
  }

  return lead.nome_completo || lead.email || lead.telefone_contato || "Lead sem identificação"
}

export function getWhatsAppUrl(phone: string | null | undefined) {
  if (!phone) {
    return null
  }

  const digits = phone.replace(/\D/g, "")
  if (digits.length === 0) {
    return null
  }

  return `https://wa.me/${digits}`
}

export function getLeadSessionId(lead: LeadDetail) {
  const preferredRemoteJid = normalizeValueText(lead.remotejid)

  if (preferredRemoteJid) {
    return preferredRemoteJid
  }

  const fallbackPhone = [
    normalizeValueText(lead.telefone_confirmado),
    normalizeValueText(lead.numero),
    normalizeValueText(lead.telefone_contato),
  ].find((value): value is string => Boolean(value))

  if (!fallbackPhone) {
    return null
  }

  const digits = fallbackPhone.replace(/\D/g, "")

  if (!digits) {
    return null
  }

  const normalizedDigits =
    digits.startsWith("55") || digits.length > 11 ? digits : `55${digits}`

  return `${normalizedDigits}@s.whatsapp.net`
}

export function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function mapN8nMessages(
  rows: Array<{
    id: string | number
    session_id: string
    message: unknown
    created_at: string | null
  }>,
  leadId: string
): ChatMessage[] {
  const seen = new Set<string>()

  return rows
    .map((row) => {
      const content =
        cleanLeadConversationMessage(extractMessageContent(row.message)).trim() ||
        "[mensagem sem conteúdo]"
      const role = extractMessageRole(row.message)

      return {
        id: String(row.id),
        lead_id: leadId,
        role,
        content,
        created_at: row.created_at ?? new Date().toISOString(),
      }
    })
    .filter((row) => {
      if (shouldHideConversationMessage(row.content)) {
        return false
      }

      const dedupeKey = `${row.role}::${row.created_at}::${row.content}`

      if (seen.has(dedupeKey)) {
        return false
      }

      seen.add(dedupeKey)
      return true
    })
}

export function buildLeadStatusBadges({
  lead,
  hasEnergyAttachment,
}: {
  lead: LeadDetail | null
  hasEnergyAttachment: boolean
}): LeadHeaderBadge[] {
  if (!lead) {
    return []
  }

  return [
    {
      label: formatSupabaseValue(lead.status_conversa),
      className: "border-primary/20 bg-primary/10 text-primary",
    },
    ...(hasEnergyAttachment
      ? [
          {
            label: "Conta recebida",
            tone: "accent" as const,
            className: "text-white",
          },
        ]
      : []),
    ...(isManualLeadRecord(lead)
      ? [
          {
            label: "Manual",
            className: "crm-badge-brand",
          },
        ]
      : []),
    {
      label: lead.arquivado ? "Arquivado" : "Em atendimento",
      className: lead.arquivado
        ? "border-border/60 bg-muted/65 text-foreground"
        : "crm-badge-brand",
    },
  ]
}

export function buildLeadView({
  lead,
  assignedBroker,
}: {
  lead: LeadDetail | null
  assignedBroker: Profile | null
}): LeadViewModel | null {
  if (!lead) {
    return null
  }

  const extractedLeadInfo = extractLeadInfo(lead.outra_info)

  return {
    telefone: pickFirstValue([lead.telefone_contato, extractedLeadInfo.telefone]),
    responsavel: pickFirstValue([assignedBroker?.nome, assignedBroker?.email]),
    contaDeLuz: pickFirstValue([lead.valorcontaenergia, extractedLeadInfo.valorcontaenergia]),
    cidade: pickFirstValue([lead.cidade, extractedLeadInfo.cidade]),
    tipoImovel: pickFirstValue([lead.tipoimovel, extractedLeadInfo.tipoimovel]),
    urgencia: pickFirstValue([lead.urgencia, extractedLeadInfo.urgencia]),
    origem: getLeadOriginLabel(lead),
    nome: pickFirstValue([lead.nome_completo, extractedLeadInfo.nome]),
    dataCriacao: formatDateTime(lead.created_at),
    ultimaInteracao: formatDateTime(lead.last_interaction_at),
    primeiroAtendimento: lead.first_response_at
      ? formatDateTime(lead.first_response_at)
      : null,
  }
}

export function activityIcon(activity: LeadActivity) {
  switch (activity.tipo) {
    case "atribuicao":
      return UserCheck
    case "pool":
      return RefreshCw
    case "etapa":
      return ArrowRight
    case "arquivamento":
      return Archive
    case "desarquivamento":
      return ArchiveRestore
    case "ia":
      return Bot
    default:
      return MessageSquareText
  }
}

export function activityUserName(activity: LeadActivity) {
  return activity.usuario?.nome || activity.usuario?.email || "Usuário da equipe"
}

function isManualLeadEntry(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase() === "manual"
}

function isManualLeadRecord(
  lead:
    | Pick<LeadDetail, "lead_entry_type" | "manual_created_by">
    | null
    | undefined
) {
  if (!lead) {
    return false
  }

  return isManualLeadEntry(lead.lead_entry_type) || Boolean(normalizeValueText(lead.manual_created_by))
}

function getLeadOriginLabel(
  lead:
    | Pick<LeadDetail, "lead_entry_type" | "manual_created_by">
    | null
    | undefined
) {
  return isManualLeadRecord(lead) ? "Lead manual" : "Meta Ads"
}

function normalizeValueText(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value === "boolean") {
    return value ? "Sim" : "Não"
  }

  return null
}

function pickFirstValue(values: unknown[], emptyLabel = EMPTY_VALUE) {
  for (const value of values) {
    const normalized = normalizeValueText(value)
    if (normalized) {
      return normalized
    }
  }

  return emptyLabel
}

function normalizeLookupKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildAliasPattern(aliases: string[]) {
  return aliases
    .map((alias) =>
      escapeRegExp(alias)
        .replace(/\\ /g, "[\\s_\\-]*")
        .replace(/_/g, "[\\s_\\-]*")
    )
    .join("|")
}

function findValueInObject(source: unknown, aliases: string[]) {
  if (!source || typeof source !== "object") {
    return null
  }

  const targetKeys = new Set(aliases.map(normalizeLookupKey))
  const visited = new Set<unknown>()

  function visit(node: unknown): string | null {
    if (!node || typeof node !== "object") {
      return null
    }

    if (visited.has(node)) {
      return null
    }

    visited.add(node)

    if (Array.isArray(node)) {
      for (const item of node) {
        const nested = visit(item)
        if (nested) {
          return nested
        }
      }

      return null
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (targetKeys.has(normalizeLookupKey(key))) {
        const directValue = normalizeValueText(value)
        if (directValue) {
          return directValue
        }
      }

      const nested = visit(value)
      if (nested) {
        return nested
      }
    }

    return null
  }

  return visit(source)
}

function extractLabeledValue(rawText: string, aliases: string[]) {
  const aliasPattern = buildAliasPattern(aliases)
  const match = rawText.match(
    new RegExp(`(?:^|[\\n;|,])\\s*(?:${aliasPattern})\\s*[:=-]\\s*([^\\n;|,]+)`, "i")
  )

  return match?.[1]?.trim() || null
}

function extractLeadInfo(rawValue: string | null | undefined): ExtractedLeadInfo {
  const rawText = rawValue?.trim()
  if (!rawText) {
    return {}
  }

  let parsedValue: unknown = null

  try {
    parsedValue = JSON.parse(rawText)
  } catch {
    parsedValue = null
  }

  const aliases: Record<ExtractedLeadInfoKey, string[]> = {
    valorcontaenergia: [
      "conta_luz",
      "conta de luz",
      "valor_conta",
      "valor conta",
      "valorcontaenergia",
      "energy_bill",
      "bill_value",
      "conta de energia",
    ],
    cidade: ["cidade", "city"],
    urgencia: ["urgencia", "urgência", "urgency", "prioridade"],
    tipoimovel: [
      "tipo_imovel",
      "tipo de imovel",
      "tipo de imóvel",
      "tipoimovel",
      "property_type",
      "property",
      "imovel",
      "imóvel",
    ],
    nome: ["nome", "name", "nome_completo"],
    telefone: ["telefone", "phone", "numero", "número", "celular", "whatsapp"],
    origem: ["origem", "source", "lead_source"],
    campanha: ["campanha", "campaign", "utm_campaign"],
    email: ["email", "e-mail", "mail"],
  }

  return (Object.keys(aliases) as ExtractedLeadInfoKey[]).reduce<ExtractedLeadInfo>((accumulator, key) => {
    const fromObject = parsedValue ? findValueInObject(parsedValue, aliases[key]) : null
    const fromText = extractLabeledValue(rawText, aliases[key])
    const extracted = fromObject || fromText

    if (extracted) {
      accumulator[key] = extracted
    }

    return accumulator
  }, {})
}

function extractMessageContent(message: unknown): string {
  if (typeof message === "string") {
    return message
  }

  if (!message || typeof message !== "object") {
    return ""
  }

  const candidate = message as {
    content?: unknown
    text?: unknown
    message?: unknown
    kwargs?: { content?: unknown }
    data?: { content?: unknown }
  }

  const directContent = candidate.content
  if (typeof directContent === "string") {
    return directContent
  }

  if (Array.isArray(directContent)) {
    return directContent
      .map((item) => {
        if (typeof item === "string") {
          return item
        }

        if (item && typeof item === "object" && "text" in item) {
          return typeof item.text === "string" ? item.text : ""
        }

        return ""
      })
      .filter(Boolean)
      .join("\n")
  }

  if (typeof candidate.text === "string") {
    return candidate.text
  }

  if (typeof candidate.message === "string") {
    return candidate.message
  }

  if (typeof candidate.kwargs?.content === "string") {
    return candidate.kwargs.content
  }

  if (typeof candidate.data?.content === "string") {
    return candidate.data.content
  }

  return "[mensagem sem conteúdo]"
}

function extractMessageRole(message: unknown): ChatMessage["role"] {
  if (!message || typeof message !== "object") {
    return "bot"
  }

  const candidate = message as {
    role?: unknown
    type?: unknown
    constructor?: unknown
    id?: unknown
  }

  const roleValue = typeof candidate.role === "string" ? candidate.role.toLowerCase() : ""
  const typeValue = typeof candidate.type === "string" ? candidate.type.toLowerCase() : ""
  const constructorValue =
    typeof candidate.constructor === "string" ? candidate.constructor.toLowerCase() : ""
  const idValue = Array.isArray(candidate.id)
    ? candidate.id.map((part) => String(part).toLowerCase()).join(" ")
    : ""

  const roleHint = [roleValue, typeValue, constructorValue, idValue].join(" ")

  if (roleHint.includes("human") || roleHint.includes("user")) {
    return "user"
  }

  if (roleHint.includes("ai") || roleHint.includes("assistant") || roleHint.includes("bot")) {
    return "bot"
  }

  return "bot"
}



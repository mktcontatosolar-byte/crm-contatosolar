import { useCallback, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useParams } from "react-router-dom"
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Bot,
  MessageSquareText,
  RefreshCw,
  UserCheck,
} from "lucide-react"
import { toast } from "sonner"

import StatePanel from "@/components/crm/StatePanel"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/useAuth"
import {
  fetchLeadById,
  fetchLeadMessagesByIdentifiers,
  LEAD_MESSAGES_TABLE,
  LEAD_NOTES_TABLE,
  LEAD_SOURCE_TABLE,
  LEAD_STATE_TABLE,
  updateLeadState,
} from "@/lib/crmLeads"
import { logAuditEvent } from "@/lib/auditLogs"
import {
  createLeadAttachmentSignedUrl,
  fetchLeadAttachments,
  getLeadAttachmentErrorMessage,
  getLeadAttachmentFriendlyTitle,
  hasActiveEnergyAttachment,
  isLeadAttachmentImage,
  isLeadAttachmentPdf,
  uploadLeadAttachmentFromFile,
} from "@/lib/leadAttachments"
import { cleanLeadConversationMessage, shouldHideConversationMessage } from "@/lib/leadMessages"
import { fetchLeadActivities, safeLogLeadActivity } from "@/lib/leadActivity"
import { supabase } from "@/lib/supabase"
import { formatSupabaseValue } from "@/lib/utils"
import type { ChatMessage, LeadActivity, LeadDetail, LeadNote, Profile } from "@/types"
import type { LeadAttachment } from "@/types/leadAttachments"
import {
  LeadActionConfirmDialog,
  LeadAttachmentPreviewDialog,
  LeadNoteDeleteDialog,
} from "@/components/crm/lead-detail/LeadDetailDialogs"
import { LeadDetailHeader } from "@/components/crm/lead-detail/LeadDetailHeader"
import { LeadDetailTabs } from "@/components/crm/lead-detail/LeadDetailTabs"
import { LeadDataTab } from "@/components/crm/lead-detail/LeadDataTab"
import { LeadActionsTab } from "@/components/crm/lead-detail/LeadActionsTab"
import { LeadNotesTab } from "@/components/crm/lead-detail/LeadNotesTab"
import { LeadConversationTab } from "@/components/crm/lead-detail/LeadConversationTab"
import { useLeadDetailDialogs } from "@/components/crm/lead-detail/useLeadDetailDialogs"
import { useLeadNoteEditing } from "@/components/crm/lead-detail/useLeadNoteEditing"

type LeadAction = "return-pool" | "archive"
type LeadNoteWithAuthor = LeadNote & { authorProfile: Profile | null }
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

const EMPTY_VALUE = "Não informado"
const BRAZIL_TIME_ZONE = "America/Sao_Paulo"
function formatDateTime(dateString: string | null | undefined) {
  if (!dateString) {
    return EMPTY_VALUE
  }

  const date = new Date(dateString)

  if (Number.isNaN(date.getTime())) {
    return EMPTY_VALUE
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(",", " às")
}

function formatTimeOnly(dateString: string | null | undefined) {
  if (!dateString) {
    return EMPTY_VALUE
  }

  const date = new Date(dateString)

  if (Number.isNaN(date.getTime())) {
    return EMPTY_VALUE
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatRelativeTime(dateString: string | null | undefined) {
  if (!dateString) {
    return EMPTY_VALUE
  }

  const date = new Date(dateString)

  if (Number.isNaN(date.getTime())) {
    return EMPTY_VALUE
  }

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMs < 60000) {
    return "agora"
  }

  if (diffMinutes < 60) {
    return `há ${diffMinutes} minuto${diffMinutes === 1 ? "" : "s"}`
  }

  if (diffHours < 24) {
    return `há ${diffHours} hora${diffHours === 1 ? "" : "s"}`
  }

  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
  const targetKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(yesterday)

  if (targetKey === todayKey) {
    return `hoje às ${formatTimeOnly(dateString)}`
  }

  if (targetKey === yesterdayKey) {
    return `ontem às ${formatTimeOnly(dateString)}`
  }

  return formatDateTime(dateString)
}

function getSupabaseErrorMessage(error: unknown, fallback: string) {
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

function leadDisplayName(lead: LeadDetail | null) {
  if (!lead) {
    return "Lead sem identificação"
  }

  return lead.nome_completo || lead.email || lead.telefone_contato || "Lead sem identificação"
}

function getWhatsAppUrl(phone: string | null | undefined) {
  if (!phone) {
    return null
  }

  const digits = phone.replace(/\D/g, "")
  if (digits.length === 0) {
    return null
  }

  return `https://wa.me/${digits}`
}

function getLeadSessionId(lead: LeadDetail) {
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

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
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

function mapN8nMessages(
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

function TabPanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card className="rounded-3xl border border-border/60 bg-card/92 shadow-sm">
      <CardContent className="space-y-4 p-5 lg:p-6">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-2xl" />
        ))}
      </CardContent>
    </Card>
  )
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin, user } = useAuth()
  const [activeTab, setActiveTab] = useState("dados")
  const [leadDetail, setLeadDetail] = useState<LeadDetail | null>(null)
  const [assignedBroker, setAssignedBroker] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [error, setError] = useState("")
  const [previewingAttachmentId, setPreviewingAttachmentId] = useState<string | null>(null)
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null)
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null)
  const [attachmentPreviewLoading, setAttachmentPreviewLoading] = useState(false)
  const [attachmentPreviewError, setAttachmentPreviewError] = useState<string | null>(null)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [attachmentUploadError, setAttachmentUploadError] = useState<string | null>(null)

  const {
    selectedAttachment,
    pendingAction,
    pendingDeleteNote,
    openAttachmentPreviewDialog,
    closeAttachmentPreviewDialog,
    openActionDialog,
    closeActionDialog,
    openNoteDeleteDialog,
    closeNoteDeleteDialog,
  } = useLeadDetailDialogs<LeadAction, LeadAttachment, LeadNoteWithAuthor>()

  const {
    editingNoteId,
    editingNoteContent,
    setEditingNoteContent,
    startEditingNote,
    cancelEditingNote,
    resetEditingNote,
  } = useLeadNoteEditing<LeadNoteWithAuthor>()

  const canAddNote = Boolean(
    user &&
      leadDetail &&
      (isAdmin || (leadDetail.corretor_id !== null && leadDetail.corretor_id === user.id))
  )
  const homePath = isAdmin ? "/" : "/kanban"
  const whatsappUrl = getWhatsAppUrl(leadDetail?.telefone_contato)
  const activityQuery = useQuery({
    queryKey: ["lead-activity", id],
    queryFn: () => fetchLeadActivities(id!),
    enabled: Boolean(id),
  })

  const notesQuery = useQuery({
    queryKey: ["lead-notes", id],
    queryFn: () => loadNotes(),
    enabled: Boolean(id),
  })

  const attachmentsQuery = useQuery({
    queryKey: [
      "lead-attachments",
      leadDetail?.id,
      leadDetail?.remotejid,
      leadDetail?.telefone_confirmado,
      leadDetail?.numero,
    ],
    queryFn: () => fetchLeadAttachments(leadDetail!),
    enabled: Boolean(leadDetail),
    retry: false,
  })

  const loadNotes = useCallback(async (): Promise<LeadNoteWithAuthor[]> => {
    if (!id) {
      return []
    }

    const { data: notesData, error: notesError } = await supabase
      .from(LEAD_NOTES_TABLE)
      .select("id,lead_id,author_id,content,created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })

    if (notesError) {
      throw notesError
    }

    const fetchedNotes = (notesData ?? []) as LeadNote[]
    const authorIds = [...new Set(fetchedNotes.map((note) => note.author_id))]

    if (authorIds.length === 0) {
      return fetchedNotes.map((note) => ({
        ...note,
        authorProfile: null,
      }))
    }

    const { data: authorsData, error: authorsError } = await supabase
      .from("profiles")
      .select("id,nome,email")
      .in("id", authorIds)

    if (authorsError) {
      throw authorsError
    }

    const authorsById = new Map(
      ((authorsData ?? []) as Profile[]).map((profile) => [profile.id, profile])
    )

    return fetchedNotes.map((note) => ({
      ...note,
      authorProfile: authorsById.get(note.author_id) ?? null,
    }))
  }, [id])

  const loadDetails = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!id) {
      setError("Lead não encontrado.")
      setLoading(false)
    }

    try {
      if (!silent) {
        setLoading(true)
      }

      const leadData = await fetchLeadById(id!)

      if (!leadData) {
        setError("Lead não encontrado.")
        setLeadDetail(null)
        setAssignedBroker(null)
        setMessages([])
        return
      }

      const detail = leadData as LeadDetail
      setLeadDetail(detail)

      const brokerPromise = detail.corretor_id
        ? supabase.from("profiles").select("id,nome,email").eq("id", detail.corretor_id).maybeSingle()
        : Promise.resolve({ data: null, error: null })

      const sessionId = getLeadSessionId(detail)
      const messagesPromise = fetchLeadMessagesByIdentifiers([
        sessionId,
        detail.remotejid,
        detail.numero,
        detail.telefone_confirmado,
        detail.telefone_contato,
      ])

      const [messagesResult, brokerResult] = await Promise.all([messagesPromise, brokerPromise])

      if (brokerResult.error) {
        throw brokerResult.error
      }

      setMessages(
        mapN8nMessages(
          (messagesResult ?? []) as Array<{
            id: number
            session_id: string
            message: unknown
            created_at: string | null
          }>,
          id!
        )
      )
      setAssignedBroker((brokerResult.data as Profile | null) ?? null)
      setError("")
    } catch (loadError) {
      console.error("Erro ao carregar detalhe do lead:", loadError)
      setError("Não conseguimos abrir esse lead agora.")
    } finally {
      setLoading(false)
    }
  }, [id])

  async function updateLead(
    values: Partial<Pick<LeadDetail, "ia_paused" | "arquivado" | "corretor_id" | "assumed_at" | "stage_id">>,
    action: "refresh" | "remove"
  ) {
    if (!id) {
      return
    }

    try {
      setUpdating(true)

      await updateLeadState(id, {
        corretor_id:
          Object.prototype.hasOwnProperty.call(values, "corretor_id")
            ? (values.corretor_id ?? null)
            : (leadDetail?.corretor_id ?? null),
        assumed_at:
          Object.prototype.hasOwnProperty.call(values, "assumed_at")
            ? (values.assumed_at ?? null)
            : (leadDetail?.assumed_at ?? null),
        stage_id:
          Object.prototype.hasOwnProperty.call(values, "stage_id")
            ? (values.stage_id ?? null)
            : (leadDetail?.stage_id ?? null),
        arquivado:
          Object.prototype.hasOwnProperty.call(values, "arquivado")
            ? (values.arquivado ?? false)
            : (leadDetail?.arquivado ?? false),
        ia_paused:
          Object.prototype.hasOwnProperty.call(values, "ia_paused")
            ? (values.ia_paused ?? false)
            : (leadDetail?.ia_paused ?? false),
        first_response_at: leadDetail?.first_response_at ?? null,
      })

      const nextActivity =
        values.ia_paused === true
          ? { tipo: "ia" as const, descricao: "IA pausada" }
          : values.ia_paused === false
            ? { tipo: "ia" as const, descricao: "IA reativada" }
            : values.arquivado === true
              ? { tipo: "arquivamento" as const, descricao: "Lead arquivado" }
              : values.corretor_id === null
                ? { tipo: "pool" as const, descricao: "Lead devolvido ao pool" }
                : null

      if (nextActivity) {
        await safeLogLeadActivity({
          leadId: id,
          usuarioId: user?.id ?? null,
          tipo: nextActivity.tipo,
          descricao: nextActivity.descricao,
        }, { context: `lead-detail-${nextActivity.tipo}` })

        try {
          await logAuditEvent({
            actorUserId: user?.id ?? null,
            actorEmail: user?.email ?? null,
            entityType: "lead",
            entityId: id,
            action: nextActivity.tipo,
            description: nextActivity.descricao,
            beforeData: {
              corretor_id: leadDetail?.corretor_id ?? null,
              stage_id: leadDetail?.stage_id ?? null,
              arquivado: leadDetail?.arquivado ?? false,
              ia_paused: leadDetail?.ia_paused ?? false,
            },
            afterData: {
              corretor_id:
                Object.prototype.hasOwnProperty.call(values, "corretor_id")
                  ? (values.corretor_id ?? null)
                  : (leadDetail?.corretor_id ?? null),
              stage_id:
                Object.prototype.hasOwnProperty.call(values, "stage_id")
                  ? (values.stage_id ?? null)
                  : (leadDetail?.stage_id ?? null),
              arquivado:
                Object.prototype.hasOwnProperty.call(values, "arquivado")
                  ? (values.arquivado ?? false)
                  : (leadDetail?.arquivado ?? false),
              ia_paused:
                Object.prototype.hasOwnProperty.call(values, "ia_paused")
                  ? (values.ia_paused ?? false)
                  : (leadDetail?.ia_paused ?? false),
            },
          })
        } catch (auditError) {
          console.error("Erro ao registrar log de auditoria:", auditError)
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lead-activity", id] }),
        queryClient.invalidateQueries({ queryKey: ["archived-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["pool-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["kanban-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["team-data"] }),
      ])

      toast.success("Lead atualizado com sucesso.")

      if (action === "remove") {
        if (window.history.length > 1) {
          navigate(-1)
        } else {
          navigate(homePath, { replace: true })
        }
        return
      }

      await loadDetails({ silent: true })
    } catch (updateError) {
      console.error("Erro ao atualizar lead:", updateError)
      setError("Não foi possível atualizar esse lead agora.")
      toast.error("Não foi possível atualizar esse lead agora.")
    } finally {
      setUpdating(false)
      closeActionDialog()
    }
  }

  async function saveNote() {
    if (!id || !user || !canAddNote) {
      setError("Você não pode adicionar observações neste lead.")
      return
    }

    const content = newNote.trim()
    if (!content) {
      return
    }

    try {
      setSavingNote(true)

      const { error: insertError } = await supabase.from(LEAD_NOTES_TABLE).insert({
        lead_id: id,
        author_id: user.id,
        content,
      })

      if (insertError) {
        throw insertError
      }

      setNewNote("")
      await queryClient.invalidateQueries({ queryKey: ["lead-notes", id] })
      setError("")
      try {
        await logAuditEvent({
          actorUserId: user.id,
          actorEmail: user.email ?? null,
          entityType: "lead_note",
          entityId: id,
          action: "note_created",
          description: "Nota interna criada",
          afterData: {
            content,
          },
        })
      } catch (auditError) {
        console.error("Erro ao registrar log de auditoria:", auditError)
      }
      toast.success("Nota interna salva com sucesso.")
    } catch (saveError) {
      console.error("Erro ao salvar nota interna:", saveError)
      const message = getSupabaseErrorMessage(
        saveError,
        "Não foi possível salvar a observação."
      )
      setError(message)
      toast.error(message)
      return
      setError("Não foi possível salvar a observação.")
      toast.error("Não foi possível salvar a observação.")
    } finally {
      setSavingNote(false)
    }
  }

  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      const { error: updateError } = await supabase
        .from(LEAD_NOTES_TABLE)
        .update({ content })
        .eq("id", noteId)

      if (updateError) {
        throw updateError
      }
    },
    onSuccess: async () => {
      try {
        await logAuditEvent({
          actorUserId: user?.id ?? null,
          actorEmail: user?.email ?? null,
          entityType: "lead_note",
          entityId: editingNoteId ?? id ?? null,
          action: "note_updated",
          description: "Nota interna atualizada",
          afterData: {
            content: editingNoteContent.trim(),
          },
        })
      } catch (auditError) {
        console.error("Erro ao registrar log de auditoria:", auditError)
      }
      resetEditingNote()
      await queryClient.invalidateQueries({ queryKey: ["lead-notes", id] })
      toast.success("Nota atualizada com sucesso.")
    },
    onError: (updateError) => {
      const message = getSupabaseErrorMessage(updateError, "Não foi possível atualizar a observação.")
      setError(message)
      toast.error(message)
    },
  })

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error: deleteError } = await supabase.from(LEAD_NOTES_TABLE).delete().eq("id", noteId)

      if (deleteError) {
        throw deleteError
      }
    },
    onSuccess: async () => {
      try {
        await logAuditEvent({
          actorUserId: user?.id ?? null,
          actorEmail: user?.email ?? null,
          entityType: "lead_note",
          entityId: pendingDeleteNote?.id ?? null,
          action: "note_deleted",
          description: "Nota interna excluída",
          beforeData: pendingDeleteNote
            ? {
                content: pendingDeleteNote.content,
                lead_id: pendingDeleteNote.lead_id,
              }
            : null,
        })
      } catch (auditError) {
        console.error("Erro ao registrar log de auditoria:", auditError)
      }
      closeNoteDeleteDialog()
      resetEditingNote()
      await queryClient.invalidateQueries({ queryKey: ["lead-notes", id] })
      toast.success("Nota excluída com sucesso.")
    },
    onError: (deleteError) => {
      const message = getSupabaseErrorMessage(deleteError, "Não foi possível excluir a observação.")
      setError(message)
      toast.error(message)
    },
  })

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDetails()
    }, 0)

    if (!id) {
      return () => {
        window.clearTimeout(timeoutId)
      }
    }

    const channel = supabase
      .channel(`lead-detail-page-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: LEAD_STATE_TABLE, filter: `lead_id=eq.${id}` },
        () => {
          void loadDetails({ silent: true })
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: LEAD_SOURCE_TABLE, filter: `id=eq.${id}` },
        () => {
          void loadDetails({ silent: true })
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: LEAD_MESSAGES_TABLE },
        () => {
          void loadDetails({ silent: true })
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: LEAD_NOTES_TABLE, filter: `lead_id=eq.${id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["lead-notes", id] })
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lead_attachments" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["lead-attachments"] })
        }
      )
      .subscribe()

    return () => {
      window.clearTimeout(timeoutId)
      void supabase.removeChannel(channel)
    }
  }, [id, loadDetails, queryClient])

  const pageTitle = leadDisplayName(leadDetail)
  const activities = activityQuery.data ?? []
  const notes = notesQuery.data ?? []
  const attachments = attachmentsQuery.data ?? []
  const hasEnergyAttachment = hasActiveEnergyAttachment(attachments)
  const attachmentsErrorMessage = attachmentsQuery.error
    ? getLeadAttachmentErrorMessage(
        attachmentsQuery.error,
        "Não foi possível carregar os anexos deste lead."
      )
    : null
  const selectedAttachmentTitle = selectedAttachment
    ? getLeadAttachmentFriendlyTitle(selectedAttachment)
    : "Conta de energia"
  const selectedAttachmentDateLabel = selectedAttachment
    ? `Enviada em ${formatDateTime(selectedAttachment.created_at)}`
    : null
  const selectedAttachmentIsPdf = selectedAttachment ? isLeadAttachmentPdf(selectedAttachment) : false
  const selectedAttachmentIsImage = selectedAttachment ? isLeadAttachmentImage(selectedAttachment) : false

  function canManageNote(note: LeadNoteWithAuthor) {
    return Boolean(user && (isAdmin || note.author_id === user.id))
  }

  async function downloadAttachment(attachment: LeadAttachment) {
    try {
      setDownloadingAttachmentId(attachment.id)
      const signedUrl = await createLeadAttachmentSignedUrl(attachment, { download: true })
      window.open(signedUrl, "_blank", "noopener,noreferrer")
    } catch (attachmentError) {
      const message = getLeadAttachmentErrorMessage(
        attachmentError,
        "Não foi possível preparar o download do anexo."
      )
      toast.error(message)
    } finally {
      setDownloadingAttachmentId(null)
    }
  }

  async function uploadAttachmentForLead(file: File) {
    if (!leadDetail) {
      return
    }

    try {
      setUploadingAttachment(true)
      setAttachmentUploadError(null)

      await uploadLeadAttachmentFromFile({
        file,
        lead: leadDetail,
        createdBy: user?.id ?? null,
      })

      await attachmentsQuery.refetch()
      toast.success("Conta de energia anexada com sucesso.")
    } catch (attachmentError) {
      const message = getLeadAttachmentErrorMessage(
        attachmentError,
        "Não foi possível anexar a conta. Tente novamente."
      )
      setAttachmentUploadError(message)
      toast.error(message)
    } finally {
      setUploadingAttachment(false)
    }
  }

  function handleUploadAttachmentClick() {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "application/pdf,image/jpeg,image/png,image/webp"

    input.onchange = () => {
      const file = input.files?.[0] ?? null

      if (file) {
        void uploadAttachmentForLead(file)
      }
    }

    input.click()
  }

  async function openAttachmentInNewTab(attachment: LeadAttachment) {
    try {
      const signedUrl = await createLeadAttachmentSignedUrl(attachment)
      window.open(signedUrl, "_blank", "noopener,noreferrer")
    } catch (attachmentError) {
      const message = getLeadAttachmentErrorMessage(
        attachmentError,
        "Não foi possível abrir o anexo em nova aba."
      )
      toast.error(message)
    }
  }

  async function openAttachmentPreview(attachment: LeadAttachment) {
    openAttachmentPreviewDialog(attachment)
    setAttachmentPreviewUrl(null)
    setAttachmentPreviewError(null)
    setAttachmentPreviewLoading(true)

    try {
      setPreviewingAttachmentId(attachment.id)
      const signedUrl = await createLeadAttachmentSignedUrl(attachment)
      setAttachmentPreviewUrl(signedUrl)
    } catch (attachmentError) {
      const message = getLeadAttachmentErrorMessage(
        attachmentError,
        "Não foi possível carregar a visualização deste anexo."
      )
      setAttachmentPreviewError(message)
    } finally {
      setAttachmentPreviewLoading(false)
      setPreviewingAttachmentId(null)
    }
  }

  function closeAttachmentPreview() {
    closeAttachmentPreviewDialog()
    setAttachmentPreviewUrl(null)
    setAttachmentPreviewError(null)
    setAttachmentPreviewLoading(false)
  }

  const statusBadges = useMemo(() => {
    if (!leadDetail) {
      return []
    }

    return [
      {
        label: formatSupabaseValue(leadDetail.status_conversa),
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
      ...(isManualLeadRecord(leadDetail)
        ? [
            {
              label: "Manual",
                className: "crm-badge-brand",
            },
          ]
        : []),
      {
        label: leadDetail.arquivado ? "Arquivado" : "Em atendimento",
          className: leadDetail.arquivado
            ? "border-border/60 bg-muted/65 text-foreground"
            : "crm-badge-brand",
      },
    ]
  }, [hasEnergyAttachment, leadDetail])

  const extractedLeadInfo = useMemo(() => extractLeadInfo(leadDetail?.outra_info), [leadDetail?.outra_info])

  const leadView = useMemo(() => {
    if (!leadDetail) {
      return null
    }

    return {
      telefone: pickFirstValue([leadDetail.telefone_contato, extractedLeadInfo.telefone]),
      responsavel: pickFirstValue([assignedBroker?.nome, assignedBroker?.email]),
      contaDeLuz: pickFirstValue([leadDetail.valorcontaenergia, extractedLeadInfo.valorcontaenergia]),
      cidade: pickFirstValue([leadDetail.cidade, extractedLeadInfo.cidade]),
      tipoImovel: pickFirstValue([leadDetail.tipoimovel, extractedLeadInfo.tipoimovel]),
      urgencia: pickFirstValue([leadDetail.urgencia, extractedLeadInfo.urgencia]),
      origem: getLeadOriginLabel(leadDetail),
      nome: pickFirstValue([leadDetail.nome_completo, extractedLeadInfo.nome]),
      dataCriacao: formatDateTime(leadDetail.created_at),
      ultimaInteracao: formatDateTime(leadDetail.last_interaction_at),
      primeiroAtendimento: leadDetail.first_response_at
        ? formatDateTime(leadDetail.first_response_at)
        : null,
    }
  }, [assignedBroker?.email, assignedBroker?.nome, extractedLeadInfo, leadDetail])

  const actionCopy = {
    "return-pool": {
      title: "Voltar para a fila",
      description: "Esse lead vai sair da carteira atual e ficar disponível para nova distribuição.",
      confirmLabel: "Devolver",
      run: () =>
        updateLead(
          {
            corretor_id: null,
            assumed_at: null,
            stage_id: null,
          },
          "refresh"
        ),
    },
    archive: {
      title: "Arquivar lead",
      description: "O lead será retirado das listas ativas.",
      confirmLabel: "Arquivar",
      run: () => updateLead({ arquivado: true }, "remove"),
    },
  } as const

  function activityIcon(activity: LeadActivity) {
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

  function activityUserName(activity: LeadActivity) {
    return activity.usuario?.nome || activity.usuario?.email || "Usuário da equipe"
  }

  return (
    <div className="space-y-5">
      <LeadDetailHeader
        loading={loading}
        pageTitle={pageTitle}
        createdAtLabel={`Lead criado ${formatRelativeTime(leadDetail?.created_at)}`}
        initials={getInitials(pageTitle)}
        statusBadges={statusBadges}
        onBack={() => {
          if (window.history.length > 1) {
            navigate(-1)
          } else {
            navigate(homePath, { replace: true })
          }
        }}
      />

      {error ? (
        <StatePanel tone="error" centered={false}>
          {error}
        </StatePanel>
      ) : null}

      {!loading && !leadDetail ? <StatePanel centered={false}>Lead não encontrado.</StatePanel> : null}

      <LeadDetailTabs activeTab={activeTab} onChange={setActiveTab}>
        <LeadDataTab
          loading={loading}
          hasLead={Boolean(leadDetail)}
          leadView={leadView}
          emptyValue={EMPTY_VALUE}
          whatsappUrl={whatsappUrl}
          attachments={attachments}
          attachmentsLoading={attachmentsQuery.isLoading}
          attachmentsErrorMessage={attachmentsErrorMessage}
          attachmentUploadError={attachmentUploadError}
          uploadingAttachment={uploadingAttachment}
          previewingAttachmentId={previewingAttachmentId}
          downloadingAttachmentId={downloadingAttachmentId}
          onOpenWhatsApp={() => {
            if (whatsappUrl) {
              window.open(whatsappUrl, "_blank", "noopener,noreferrer")
            }
          }}
          onUploadAttachment={handleUploadAttachmentClick}
          onViewAttachment={(attachment) => void openAttachmentPreview(attachment)}
          onDownloadAttachment={(attachment) => void downloadAttachment(attachment)}
          formatDateTime={formatDateTime}
          skeleton={<TabPanelSkeleton rows={6} />}
        />

        <LeadActionsTab
          loading={loading}
          hasLead={Boolean(leadDetail)}
          updating={updating}
          pendingAction={pendingAction}
          onSelectAction={openActionDialog}
          skeleton={<TabPanelSkeleton rows={3} />}
        />

        <LeadNotesTab
          loading={loading}
          notesLoading={notesQuery.isLoading}
          hasLead={Boolean(leadDetail)}
          notes={notes}
          canAddNote={canAddNote}
          canManageNote={canManageNote}
          editingNoteId={editingNoteId}
          editingNoteContent={editingNoteContent}
          newNote={newNote}
          savingNote={savingNote}
          updateNotePending={updateNoteMutation.isPending}
          deleteNotePending={deleteNoteMutation.isPending}
          setEditingNoteContent={setEditingNoteContent}
          setNewNote={setNewNote}
          startEditingNote={startEditingNote}
          cancelEditingNote={cancelEditingNote}
          requestDeleteNote={(note) => {
            if (note) {
              openNoteDeleteDialog(note)
            }
          }}
          saveEditedNote={(payload) => void updateNoteMutation.mutateAsync(payload)}
          saveNote={() => void saveNote()}
          formatDateTime={formatDateTime}
          skeleton={<TabPanelSkeleton rows={4} />}
        />

        <LeadConversationTab
          loading={loading}
          hasLead={Boolean(leadDetail)}
          activities={activities}
          activityLoading={activityQuery.isLoading}
          activityIcon={activityIcon}
          activityUserName={activityUserName}
          formatRelativeTime={formatRelativeTime}
          formatTimeOnly={formatTimeOnly}
          messages={messages}
          skeleton={<TabPanelSkeleton rows={4} />}
        />
      </LeadDetailTabs>

      <LeadAttachmentPreviewDialog
        selectedAttachment={selectedAttachment}
        selectedAttachmentTitle={selectedAttachmentTitle}
        selectedAttachmentDateLabel={selectedAttachmentDateLabel}
        attachmentPreviewLoading={attachmentPreviewLoading}
        attachmentPreviewError={attachmentPreviewError}
        attachmentPreviewUrl={attachmentPreviewUrl}
        selectedAttachmentIsImage={selectedAttachmentIsImage}
        selectedAttachmentIsPdf={selectedAttachmentIsPdf}
        downloadingAttachmentId={downloadingAttachmentId}
        onClose={closeAttachmentPreview}
        onOpenInNewTab={(attachment) => void openAttachmentInNewTab(attachment)}
        onDownload={(attachment) => void downloadAttachment(attachment)}
      />

      <LeadActionConfirmDialog
        pendingAction={Boolean(pendingAction)}
        title={pendingAction ? actionCopy[pendingAction].title : "Confirmar ação"}
        description={pendingAction ? actionCopy[pendingAction].description : "Confirme a ação neste lead."}
        confirmLabel={
          pendingAction
            ? actionCopy[pendingAction].confirmLabel
            : "Confirmar"
        }
        updating={updating}
        onCancel={closeActionDialog}
        onConfirm={() => {
          if (pendingAction) {
            void actionCopy[pendingAction].run()
          }
        }}
      />

      <LeadNoteDeleteDialog
        pendingDeleteNote={pendingDeleteNote}
        deleting={deleteNoteMutation.isPending}
        onCancel={closeNoteDeleteDialog}
        onConfirm={(noteId) => void deleteNoteMutation.mutateAsync(noteId)}
      />
    </div>
  )
}


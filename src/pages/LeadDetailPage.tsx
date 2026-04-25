import { useCallback, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format, formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useNavigate, useParams } from "react-router-dom"
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  ArrowLeft,
  Bot,
  CalendarClock,
  Clock3,
  Mail,
  MessageSquareText,
  Phone,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserCheck,
  UserRound,
} from "lucide-react"
import { toast } from "sonner"

import StatePanel from "@/components/crm/StatePanel"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/useAuth"
import {
  fetchLeadById,
  fetchLeadMessages,
  LEAD_MESSAGES_TABLE,
  LEAD_NOTES_TABLE,
  LEAD_SOURCE_TABLE,
  LEAD_STATE_TABLE,
  updateLeadState,
} from "@/lib/crmLeads"
import { logAuditEvent } from "@/lib/auditLogs"
import { fetchLeadActivities, logLeadActivity } from "@/lib/leadActivity"
import { supabase } from "@/lib/supabase"
import { cn, formatSupabaseValue } from "@/lib/utils"
import type { ChatMessage, LeadActivity, LeadDetail, LeadNote, Profile } from "@/types"

type LeadAction = "toggle-ia" | "return-pool" | "archive"
type LeadNoteWithAuthor = LeadNote & { authorProfile: Profile | null }

function formatDateTime(dateString: string | null | undefined) {
  if (!dateString) {
    return "Vazio"
  }

  return format(new Date(dateString), "dd/MM/yyyy 'as' HH:mm", {
    locale: ptBR,
  })
}

function formatRelativeTime(dateString: string | null | undefined) {
  if (!dateString) {
    return "Vazio"
  }

  return formatDistanceToNow(new Date(dateString), {
    addSuffix: true,
    locale: ptBR,
  })
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
    return "Sem permissÃ£o para salvar a observaÃ§Ã£o. Verifique a policy de INSERT da tabela lead_notes."
  }

  return candidate.details || candidate.hint || candidate.message || fallback
}

function leadDisplayName(lead: LeadDetail | null) {
  if (!lead) {
    return "Lead sem identificaÃ§Ã£o"
  }

  return lead.nome_completo || lead.email || lead.telefone_contato || "Lead sem identificaÃ§Ã£o"
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

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
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

  if (typeof candidate.kwargs?.content === "string") {
    return candidate.kwargs.content
  }

  if (typeof candidate.data?.content === "string") {
    return candidate.data.content
  }

  return ""
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

  return roleHint.includes("human") || roleHint.includes("user") ? "user" : "bot"
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
      const content = extractMessageContent(row.message).trim()
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
      if (row.content.length === 0) {
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

function DetailField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-border/60 bg-card/90 p-2">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="mt-1 break-words text-sm text-muted-foreground">{value}</p>
        </div>
      </div>
    </div>
  )
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
  const [pendingAction, setPendingAction] = useState<LeadAction | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteContent, setEditingNoteContent] = useState("")
  const [pendingDeleteNote, setPendingDeleteNote] = useState<LeadNoteWithAuthor | null>(null)

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

      const messagesPromise = detail.remotejid ? fetchLeadMessages(detail.remotejid) : Promise.resolve([])

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
      setError("NÃ£o conseguimos abrir esse lead agora.")
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
        await logLeadActivity({
          leadId: id,
          usuarioId: user?.id ?? null,
          tipo: nextActivity.tipo,
          descricao: nextActivity.descricao,
        })

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
      setError("NÃ£o foi possÃ­vel atualizar esse lead agora.")
      toast.error("NÃ£o foi possÃ­vel atualizar esse lead agora.")
    } finally {
      setUpdating(false)
      setPendingAction(null)
    }
  }

  async function saveNote() {
    if (!id || !user || !canAddNote) {
      setError("VocÃª nÃ£o pode adicionar observaÃ§Ãµes neste lead.")
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
        "NÃ£o foi possÃ­vel salvar a observaÃ§Ã£o."
      )
      setError(message)
      toast.error(message)
      return
      setError("NÃ£o foi possÃ­vel salvar a observaÃ§Ã£o.")
      toast.error("NÃ£o foi possÃ­vel salvar a observaÃ§Ã£o.")
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
      setEditingNoteId(null)
      setEditingNoteContent("")
      await queryClient.invalidateQueries({ queryKey: ["lead-notes", id] })
      toast.success("Nota atualizada com sucesso.")
    },
    onError: (updateError) => {
      const message = getSupabaseErrorMessage(updateError, "NÃ£o foi possÃ­vel atualizar a observaÃ§Ã£o.")
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
      setPendingDeleteNote(null)
      setEditingNoteId(null)
      setEditingNoteContent("")
      await queryClient.invalidateQueries({ queryKey: ["lead-notes", id] })
      toast.success("Nota excluída com sucesso.")
    },
    onError: (deleteError) => {
      const message = getSupabaseErrorMessage(deleteError, "NÃ£o foi possÃ­vel excluir a observaÃ§Ã£o.")
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
      .subscribe()

    return () => {
      window.clearTimeout(timeoutId)
      void supabase.removeChannel(channel)
    }
  }, [id, loadDetails, queryClient])

  const pageTitle = leadDisplayName(leadDetail)
  const activities = activityQuery.data ?? []
  const notes = notesQuery.data ?? []

  function canManageNote(note: LeadNoteWithAuthor) {
    return Boolean(user && (isAdmin || note.author_id === user.id))
  }

  function startEditingNote(note: LeadNoteWithAuthor) {
    setEditingNoteId(note.id)
    setEditingNoteContent(note.content)
  }

  function cancelEditingNote() {
    setEditingNoteId(null)
    setEditingNoteContent("")
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
      {
        label: leadDetail.ia_paused ? "IA pausada" : "IA ativa",
        className: leadDetail.ia_paused
          ? "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300"
          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      },
      {
        label: leadDetail.arquivado ? "Arquivado" : "Em atendimento",
        className: leadDetail.arquivado
          ? "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300"
          : "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      },
    ]
  }, [leadDetail])

  const actionCopy = {
    "toggle-ia": {
      title: leadDetail?.ia_paused ? "Reativar IA" : "Pausar IA",
      description: leadDetail?.ia_paused
        ? "A IA voltara a atuar neste atendimento."
        : "A IA ser?f?'?,? pausada neste lead, mantendo todo o histórico.",
      confirmLabel: leadDetail?.ia_paused ? "Reativar" : "Pausar",
      run: () => updateLead({ ia_paused: !leadDetail?.ia_paused }, "refresh"),
    },
    "return-pool": {
      title: "Voltar para a fila",
      description: "Esse lead vai sair da carteira atual e ficar disponÃ­vel para nova distribuiÃ§Ã£o.",
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
      <Card className="sticky top-4 z-10 rounded-[2rem] border border-border/60 bg-card/95 shadow-sm backdrop-blur">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-full px-4"
                onClick={() => {
                  if (window.history.length > 1) {
                    navigate(-1)
                  } else {
                    navigate(homePath, { replace: true })
                  }
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>

              <Avatar size="lg" className="h-14 w-14">
                <AvatarFallback>{getInitials(pageTitle)}</AvatarFallback>
              </Avatar>

              <div className="min-w-0 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Lead criado {formatRelativeTime(leadDetail?.created_at)}
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {pageTitle}
                </h1>
                <div className="flex flex-wrap gap-2">
                  {loading
                    ? Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-7 w-28 rounded-full" />
                      ))
                    : statusBadges.map((badge) => (
                        <Badge
                          key={badge.label}
                          className={cn("min-h-7 rounded-full px-3 text-sm", badge.className)}
                        >
                          {badge.label}
                        </Badge>
                      ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <StatePanel tone="error" centered={false}>
          {error}
        </StatePanel>
      ) : null}

      {!loading && !leadDetail ? <StatePanel centered={false}>Lead não encontrado.</StatePanel> : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="no-scrollbar">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="acoes">AÃ§Ãµes</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="historico">Conversa</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          {loading ? (
            <TabPanelSkeleton rows={5} />
          ) : leadDetail ? (
            <Card className="rounded-3xl border border-border/60 bg-card/92 shadow-sm">
              <CardHeader>
                <CardTitle>Dados principais</CardTitle>
                <CardDescription>Contato, origem e informaÃ§Ãµes principais deste lead.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-full"
                    disabled={!whatsappUrl}
                    onClick={() => {
                      if (whatsappUrl) {
                        window.open(whatsappUrl, "_blank", "noopener,noreferrer")
                      }
                    }}
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    Ir para WhatsApp
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <DetailField icon={UserRound} label="Nome" value={formatSupabaseValue(leadDetail.nome_completo)} />
                  <DetailField icon={Mail} label="E-mail" value={formatSupabaseValue(leadDetail.email)} />
                  <DetailField icon={Phone} label="Telefone" value={formatSupabaseValue(leadDetail.telefone_contato)} />
                  <DetailField
                    icon={Clock3}
                    label="Horario preferido"
                    value={formatSupabaseValue(leadDetail.horario_preferido)}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <DetailField icon={MessageSquareText} label="Origem" value={formatSupabaseValue(leadDetail.origem)} />
                  <DetailField icon={MessageSquareText} label="Campanha" value={formatSupabaseValue(leadDetail.campanha)} />
                  <DetailField icon={MessageSquareText} label="Outra info" value={formatSupabaseValue(leadDetail.outra_info)} />
                  <DetailField
                    icon={CalendarClock}
                    label="Data de criaÃ§Ã£o"
                    value={formatDateTime(leadDetail.created_at)}
                  />
                  <DetailField
                    icon={CalendarClock}
                    label="Ãšltima interaÃ§Ã£o"
                    value={formatDateTime(leadDetail.last_interaction_at)}
                  />
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <p className="text-sm font-medium text-foreground">ResponsÃ¡vel pelo lead</p>
                    <div className="mt-3">
                      <Badge className="min-h-7 rounded-full px-3 text-sm">
                        {assignedBroker?.nome || assignedBroker?.email || "Vazio"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="acoes">
          {loading ? (
            <TabPanelSkeleton rows={3} />
          ) : leadDetail ? (
            <div className="grid gap-4 xl:grid-cols-3">
              {[
                {
                  key: "toggle-ia" as const,
                  title: "Atendimento automÃ¡tico",
                  description: "Pause ou reative a automaÃ§Ã£o deste atendimento sem perder o histÃ³rico.",
                  icon: Bot,
                  buttonLabel: leadDetail.ia_paused ? "Reativar IA" : "Pausar IA",
                },
                {
                  key: "return-pool" as const,
                  title: "Voltar para a fila",
                  description: "Esse lead sai da carteira atual e volta para a fila de distribuiÃ§Ã£o.",
                  icon: RotateCcw,
                  buttonLabel: "Voltar para a fila",
                },
                {
                  key: "archive" as const,
                  title: "Encerramento",
                  description: "Arquiva o lead e remove este atendimento das filas operacionais ativas.",
                  icon: Archive,
                  buttonLabel: "Arquivar",
                },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <Card key={item.key} className="rounded-3xl border border-border/60 bg-card/92 shadow-sm">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-border/60 bg-background/70 p-2.5">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle>{item.title}</CardTitle>
                          <CardDescription>{item.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardFooter>
                      <Button
                        type="button"
                        className="h-12 w-full rounded-full"
                        variant={item.key === "toggle-ia" ? "default" : "outline"}
                        disabled={updating}
                        onClick={() => setPendingAction(item.key)}
                      >
                        {updating && pendingAction === item.key ? "Processando..." : item.buttonLabel}
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="notas">
          {loading || notesQuery.isLoading ? (
            <TabPanelSkeleton rows={4} />
          ) : leadDetail ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="rounded-3xl border border-border/60 bg-card/92 shadow-sm">
                <CardHeader>
                  <CardTitle>ObservaÃ§Ãµes internas</CardTitle>
                  <CardDescription>Essas anotaÃ§Ãµes sÃ£o vistas apenas pela equipe.</CardDescription>
                </CardHeader>
                <CardContent>
                  {notes.length === 0 ? (
                    <StatePanel centered={false}>Nenhuma nota interna ainda.</StatePanel>
                  ) : (
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <div
                          key={note.id}
                          className="rounded-2xl border border-border/60 bg-background/70 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground">
                                {note.authorProfile?.nome || note.authorProfile?.email || "Autor desconhecido"}
                              </p>
                              <p className="text-sm text-muted-foreground">{formatDateTime(note.created_at)}</p>
                            </div>

                            {canManageNote(note) ? (
                              <div className="flex items-center gap-2 self-end sm:self-start">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="h-10 w-10 rounded-full"
                                  disabled={updateNoteMutation.isPending || deleteNoteMutation.isPending}
                                  onClick={() => startEditingNote(note)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  <span className="sr-only">Editar nota</span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="h-10 w-10 rounded-full text-destructive hover:text-destructive"
                                  disabled={updateNoteMutation.isPending || deleteNoteMutation.isPending}
                                  onClick={() => setPendingDeleteNote(note)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Excluir nota</span>
                                </Button>
                              </div>
                            ) : null}
                          </div>

                          {editingNoteId === note.id ? (
                            <div className="mt-3 space-y-3">
                              <Textarea
                                value={editingNoteContent}
                                onChange={(event) => setEditingNoteContent(event.target.value)}
                                className="min-h-32 rounded-2xl text-sm"
                                disabled={updateNoteMutation.isPending}
                              />
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                  type="button"
                                  className="h-12 rounded-full sm:w-auto"
                                  disabled={updateNoteMutation.isPending || editingNoteContent.trim().length === 0}
                                  onClick={() =>
                                    void updateNoteMutation.mutateAsync({
                                      noteId: note.id,
                                      content: editingNoteContent.trim(),
                                    })
                                  }
                                >
                                  {updateNoteMutation.isPending ? "Salvando..." : "Salvar"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-12 rounded-full sm:w-auto"
                                  disabled={updateNoteMutation.isPending}
                                  onClick={cancelEditingNote}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                              {note.content}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border border-border/60 bg-card/92 shadow-sm">
                <CardHeader>
                  <CardTitle>Nova nota</CardTitle>
                  <CardDescription>
                    {canAddNote
                      ? "Registre um contexto interno para o time."
                      : "Somente admin ou o vendedor responsÃ¡vel podem adicionar notas."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={newNote}
                    disabled={!canAddNote || savingNote}
                    placeholder={
                      canAddNote
                        ? "Escreva uma observação sobre este lead"
                        : "VocÃª nÃ£o pode registrar observaÃ§Ãµes neste lead"
                    }
                    onChange={(event) => setNewNote(event.target.value)}
                    className="min-h-40 rounded-2xl text-sm"
                  />
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>As notas ficam visÃ­veis apenas para a equipe.</span>
                    <span>{newNote.trim().length} caractere(s)</span>
                  </div>
                  <Button
                    type="button"
                    className="h-12 w-full rounded-full"
                    disabled={!canAddNote || savingNote || newNote.trim().length === 0}
                    onClick={() => void saveNote()}
                  >
                    {savingNote ? "Salvando..." : "Salvar nota"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="historico">
          {loading ? (
            <TabPanelSkeleton rows={4} />
          ) : leadDetail ? (
            <Card className="rounded-3xl border border-border/60 bg-card/92 shadow-sm">
              <CardHeader>
                <CardTitle>Conversa</CardTitle>
                  <CardDescription>Atividades operacionais e histÃ³rico de mensagens deste lead.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">AÃ§Ãµes realizadas</h3>
                    <p className="text-sm text-muted-foreground">
                      Tudo o que foi alterado neste lead pela operaÃ§Ã£o.
                    </p>
                  </div>

                  {activityQuery.isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-20 w-full rounded-2xl" />
                      ))}
                    </div>
                  ) : activities.length === 0 ? (
                    <StatePanel centered={false}>Ainda nÃ£o houve movimentaÃ§Ãµes nesse lead.</StatePanel>
                  ) : (
                    <div className="space-y-3">
                      {activities.map((activity) => {
                        const Icon = activityIcon(activity)
                        return (
                          <div
                            key={activity.id}
                            className="rounded-2xl border border-border/60 bg-background/70 p-4"
                          >
                            <div className="flex items-start gap-3">
                              <div className="rounded-2xl border border-border/60 bg-card/90 p-2">
                                <Icon className="h-4 w-4 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground">{activity.descricao}</p>
                                <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                                  <span>{activityUserName(activity)}</span>
                                  <span className="hidden sm:inline">?</span>
                                  <span>{formatRelativeTime(activity.created_at)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Mensagens trocadas</h3>
                </div>

                {messages.length === 0 ? (
                  <StatePanel centered={false}>Ainda nÃ£o hÃ¡ mensagens registradas para esse lead.</StatePanel>
                ) : (
                  <div className="max-h-[500px] space-y-4 overflow-y-auto rounded-[2rem] border border-border/60 bg-muted/35 p-4 sm:p-5">
                    {messages.map((message) => {
                      const isUserMessage = message.role === "user"

                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "flex w-full",
                            isUserMessage ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "flex max-w-[88%] items-end gap-3 sm:max-w-[75%]",
                              isUserMessage ? "flex-row-reverse" : "flex-row"
                            )}
                          >
                            {!isUserMessage ? (
                              <Avatar size="sm" className="mt-1 h-8 w-8 border border-border/60 bg-card/90">
                                <AvatarFallback className="bg-card text-[11px] font-semibold text-foreground">
                                  Bot
                                </AvatarFallback>
                              </Avatar>
                            ) : null}

                            <div
                              className={cn(
                                "rounded-[1.5rem] px-4 py-3 shadow-sm",
                                isUserMessage
                                  ? "rounded-br-md bg-emerald-900 text-emerald-50"
                                  : "rounded-bl-md border border-border/60 bg-slate-800 text-slate-100"
                              )}
                            >
                              <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                {message.content}
                              </p>
                              <p
                                className={cn(
                                  "mt-2 text-[11px]",
                                  isUserMessage ? "text-emerald-100/70" : "text-slate-300/70"
                                )}
                              >
                                {format(new Date(message.created_at), "HH:mm", {
                                  locale: ptBR,
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {pendingAction ? actionCopy[pendingAction].title : "Confirmar ação"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction ? actionCopy[pendingAction].description : "Confirme a ação neste lead."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-full"
              onClick={() => setPendingAction(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-12 rounded-full"
              disabled={!pendingAction || updating}
              onClick={() => {
                if (pendingAction) {
                  void actionCopy[pendingAction].run()
                }
              }}
            >
              {updating && pendingAction
                ? "Processando..."
                : pendingAction
                  ? actionCopy[pendingAction].confirmLabel
                  : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingDeleteNote)} onOpenChange={(open) => !open && setPendingDeleteNote(null)}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Excluir nota?</DialogTitle>
            <DialogDescription>
              {pendingDeleteNote
                ? `A nota de ${pendingDeleteNote.authorProfile?.nome || pendingDeleteNote.authorProfile?.email || "autor desconhecido"} será removida permanentemente.`
                : "Confirme a exclusÃ£o desta nota interna."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-full"
              onClick={() => setPendingDeleteNote(null)}
              disabled={deleteNoteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-12 rounded-full"
              disabled={!pendingDeleteNote || deleteNoteMutation.isPending}
              onClick={() =>
                pendingDeleteNote ? void deleteNoteMutation.mutateAsync(pendingDeleteNote.id) : undefined
              }
            >
              {deleteNoteMutation.isPending ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

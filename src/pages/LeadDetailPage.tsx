import { useCallback, useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
  RefreshCw,
  RotateCcw,
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
import { fetchLeadActivities, logLeadActivity } from "@/lib/leadActivity"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import type { ChatMessage, LeadActivity, LeadDetail, LeadNote, Profile } from "@/types"

type LeadAction = "toggle-ia" | "return-pool" | "archive"

function formatDateTime(dateString: string | null | undefined) {
  if (!dateString) {
    return "Não disponível"
  }

  return format(new Date(dateString), "dd/MM/yyyy 'as' HH:mm", {
    locale: ptBR,
  })
}

function formatRelativeTime(dateString: string | null | undefined) {
  if (!dateString) {
    return "Sem registro recente"
  }

  return formatDistanceToNow(new Date(dateString), {
    addSuffix: true,
    locale: ptBR,
  })
}

function leadDisplayName(lead: LeadDetail | null) {
  if (!lead) {
    return "Lead sem identificação"
  }

  return lead.nome_completo || lead.email || lead.telefone_contato || "Lead sem identificação"
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
    id: string
    session_id: string
    message: unknown
    created_at: string
  }>,
  leadId: string
): ChatMessage[] {
  return rows
    .map((row) => {
      const content = extractMessageContent(row.message).trim()

      return {
        id: row.id,
        lead_id: leadId,
        role: extractMessageRole(row.message),
        content,
        created_at: row.created_at,
      }
    })
    .filter((row) => row.content.length > 0)
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
  const [notes, setNotes] = useState<Array<LeadNote & { authorProfile: Profile | null }>>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [error, setError] = useState("")
  const [pendingAction, setPendingAction] = useState<LeadAction | null>(null)

  const canAddNote = Boolean(
    user &&
      leadDetail &&
      (isAdmin || (leadDetail.corretor_id !== null && leadDetail.corretor_id === user.id))
  )
  const leadSessionId = leadDetail?.remotejid ?? null

  const homePath = isAdmin ? "/" : "/kanban"
  const detailSelect =
    "id,remotejid,nome_completo,email,telefone_contato,horario_preferido,status_conversa,corretor_id,assumed_at,stage_id,arquivado,ia_paused,campanha,origem,outra_info,created_at,first_response_at,last_interaction_at"

  const activityQuery = useQuery({
    queryKey: ["lead-activity", id],
    queryFn: () => fetchLeadActivities(id!),
    enabled: Boolean(id),
  })

  const loadNotes = useCallback(async () => {
    if (!id) {
      return
    }

    const { data: notesData, error: notesError } = await supabase
      .from("lead_notes")
      .select("id,lead_id,author_id,content,created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })

    if (notesError) {
      throw notesError
    }

    const fetchedNotes = (notesData ?? []) as LeadNote[]
    const authorIds = [...new Set(fetchedNotes.map((note) => note.author_id))]

    if (authorIds.length === 0) {
      setNotes(
        fetchedNotes.map((note) => ({
          ...note,
          authorProfile: null,
        }))
      )
      return
    }

    const { data: authorsData, error: authorsError } = await supabase
      .from("profiles")
      .select("id,nome,email,role,ativo,created_at,updated_at")
      .in("id", authorIds)

    if (authorsError) {
      throw authorsError
    }

    const authorsById = new Map(
      ((authorsData ?? []) as Profile[]).map((profile) => [profile.id, profile])
    )

    setNotes(
      fetchedNotes.map((note) => ({
        ...note,
        authorProfile: authorsById.get(note.author_id) ?? null,
      }))
    )
  }, [id])

  const loadDetails = useCallback(async () => {
    if (!id) {
      setError("Lead não encontrado.")
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      const { data: leadData, error: leadError } = await supabase
        .from("leads_lancamento")
        .select(detailSelect)
        .eq("id", id)
        .maybeSingle()

      if (leadError) {
        throw leadError
      }

      if (!leadData) {
        setError("Lead não encontrado.")
        setLeadDetail(null)
        setAssignedBroker(null)
        setMessages([])
        setNotes([])
        return
      }

      const detail = leadData as LeadDetail
      setLeadDetail(detail)

      const brokerPromise = detail.corretor_id
        ? supabase
            .from("profiles")
            .select("id,nome,email,role,ativo,created_at,updated_at")
            .eq("id", detail.corretor_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null })

      const messagesPromise = detail.remotejid
        ? supabase
            .from("n8n_chat_histories_sdr")
            .select("id,session_id,message,created_at")
            .eq("session_id", detail.remotejid)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null })

      const [messagesResult, brokerResult] = await Promise.all([messagesPromise, brokerPromise])

      if (messagesResult.error) {
        throw messagesResult.error
      }

      if (brokerResult.error) {
        throw brokerResult.error
      }

      setMessages(
        mapN8nMessages(
          (messagesResult.data ?? []) as Array<{
            id: string
            session_id: string
            message: unknown
            created_at: string
          }>,
          id
        )
      )
      setAssignedBroker((brokerResult.data as Profile | null) ?? null)
      await loadNotes()
      setError("")
    } catch (loadError) {
      console.error("Erro ao carregar detalhe do lead:", loadError)
      setError("Não foi possível carregar os detalhes do lead.")
    } finally {
      setLoading(false)
    }
  }, [detailSelect, id, loadNotes])

  async function updateLead(
    values: Partial<Pick<LeadDetail, "ia_paused" | "arquivado" | "corretor_id" | "assumed_at" | "stage_id">>,
    action: "refresh" | "remove"
  ) {
    if (!id) {
      return
    }

    try {
      setUpdating(true)

      const { error: updateError } = await supabase
        .from("leads_lancamento")
        .update(values)
        .eq("id", id)

      if (updateError) {
        throw updateError
      }

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
      }

      await queryClient.invalidateQueries({ queryKey: ["lead-activity", id] })

      toast.success("Lead atualizado com sucesso.")

      if (action === "remove") {
        if (window.history.length > 1) {
          navigate(-1)
        } else {
          navigate(homePath, { replace: true })
        }
        return
      }

      await loadDetails()
    } catch (updateError) {
      console.error("Erro ao atualizar lead:", updateError)
      setError("Não foi possível atualizar o lead.")
      toast.error("Não foi possível atualizar o lead.")
    } finally {
      setUpdating(false)
      setPendingAction(null)
    }
  }

  async function saveNote() {
    if (!id || !user || !canAddNote) {
      setError("Você não tem permissão para adicionar nota neste lead.")
      return
    }

    const content = newNote.trim()
    if (!content) {
      return
    }

    try {
      setSavingNote(true)

      const { error: insertError } = await supabase.from("lead_notes").insert({
        lead_id: id,
        author_id: user.id,
        content,
      })

      if (insertError) {
        throw insertError
      }

      setNewNote("")
      await loadNotes()
      setError("")
      toast.success("Nota interna salva com sucesso.")
    } catch (saveError) {
      console.error("Erro ao salvar nota interna:", saveError)
      setError("Não foi possível salvar a nota interna.")
      toast.error("Não foi possível salvar a nota interna.")
    } finally {
      setSavingNote(false)
    }
  }

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
        { event: "*", schema: "public", table: "leads_lancamento", filter: `id=eq.${id}` },
        () => {
          void loadDetails()
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "n8n_chat_histories_sdr",
          ...(leadSessionId ? { filter: `session_id=eq.${leadSessionId}` } : {}),
        },
        () => {
          void loadDetails()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lead_notes", filter: `lead_id=eq.${id}` },
        () => {
          void loadDetails()
        }
      )
      .subscribe()

    return () => {
      window.clearTimeout(timeoutId)
      void supabase.removeChannel(channel)
    }
  }, [id, leadSessionId, loadDetails])

  const pageTitle = leadDisplayName(leadDetail)
  const activities = activityQuery.data ?? []

  const statusBadges = useMemo(() => {
    if (!leadDetail) {
      return []
    }

    return [
      {
        label: leadDetail.status_conversa || "Sem status",
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
        : "A IA será pausada neste lead, mantendo todo o histórico.",
      confirmLabel: leadDetail?.ia_paused ? "Reativar" : "Pausar",
      run: () => updateLead({ ia_paused: !leadDetail?.ia_paused }, "refresh"),
    },
    "return-pool": {
      title: "Devolver para Pool",
      description: "A atribuição atual será removida e o lead voltará para a fila inicial.",
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
      description: "O lead será retirado das filas operacionais ativas.",
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
          <TabsTrigger value="acoes">Ações</TabsTrigger>
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
                <CardDescription>Contato, origem e contexto operacional deste lead.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <DetailField icon={UserRound} label="Nome" value={leadDetail.nome_completo || "Não informado"} />
                  <DetailField icon={Mail} label="E-mail" value={leadDetail.email || "Não informado"} />
                  <DetailField icon={Phone} label="Telefone" value={leadDetail.telefone_contato || "Não informado"} />
                  <DetailField
                    icon={Clock3}
                    label="Horario preferido"
                    value={leadDetail.horario_preferido || "Não informado"}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <DetailField icon={MessageSquareText} label="Origem" value={leadDetail.origem || "Não informada"} />
                  <DetailField icon={MessageSquareText} label="Campanha" value={leadDetail.campanha || "Não informada"} />
                  <DetailField icon={MessageSquareText} label="Outra info" value={leadDetail.outra_info || "Não informada"} />
                  <DetailField
                    icon={CalendarClock}
                    label="Data de criação"
                    value={formatDateTime(leadDetail.created_at)}
                  />
                  <DetailField
                    icon={CalendarClock}
                    label="Última interação"
                    value={formatDateTime(leadDetail.last_interaction_at)}
                  />
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <p className="text-sm font-medium text-foreground">Corretor atribuído</p>
                    <div className="mt-3">
                      <Badge className="min-h-7 rounded-full px-3 text-sm">
                        {assignedBroker?.nome || assignedBroker?.email || "Sem corretor"}
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
                  title: "IA do lead",
                  description: "Pause ou reative a automação deste atendimento sem perder o histórico.",
                  icon: Bot,
                  buttonLabel: leadDetail.ia_paused ? "Reativar IA" : "Pausar IA",
                },
                {
                  key: "return-pool" as const,
                  title: "Redistribuição",
                  description: "Remove a atribuição atual e devolve o lead para a fila inicial.",
                  icon: RotateCcw,
                  buttonLabel: "Devolver para Pool",
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
          {loading ? (
            <TabPanelSkeleton rows={4} />
          ) : leadDetail ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="rounded-3xl border border-border/60 bg-card/92 shadow-sm">
                <CardHeader>
                  <CardTitle>Notas internas</CardTitle>
                  <CardDescription>Registros visíveis apenas para a equipe.</CardDescription>
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
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-medium text-foreground">
                              {note.authorProfile?.nome || note.authorProfile?.email || "Autor desconhecido"}
                            </p>
                            <p className="text-sm text-muted-foreground">{formatDateTime(note.created_at)}</p>
                          </div>
                          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                            {note.content}
                          </p>
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
                      : "Somente admin ou o corretor responsável podem adicionar notas."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={newNote}
                    disabled={!canAddNote || savingNote}
                    placeholder={
                      canAddNote
                        ? "Escreva uma observação interna sobre este lead"
                        : "Você não pode registrar nota neste lead"
                    }
                    onChange={(event) => setNewNote(event.target.value)}
                    className="min-h-40 rounded-2xl text-sm"
                  />
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>As notas ficam visíveis apenas para a equipe.</span>
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
                  <CardDescription>Atividades operacionais e histórico de mensagens deste lead.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Linha do tempo de atividades</h3>
                    <p className="text-sm text-muted-foreground">
                      Tudo o que foi alterado neste lead pela operação.
                    </p>
                  </div>

                  {activityQuery.isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-20 w-full rounded-2xl" />
                      ))}
                    </div>
                  ) : activities.length === 0 ? (
                    <StatePanel centered={false}>Nenhuma atividade registrada ainda.</StatePanel>
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
                                  <span className="hidden sm:inline">•</span>
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
                    <h3 className="text-sm font-semibold text-foreground">Histórico da conversa</h3>
                  <p className="text-sm text-muted-foreground">
                    Registros cronológicos da tabela n8n_chat_histories_sdr para este lead.
                  </p>
                  </div>

                {messages.length === 0 ? (
                  <StatePanel centered={false}>Nenhuma conversa registrada ainda.</StatePanel>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className="rounded-2xl border border-border/60 bg-background/70 p-4"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="min-h-7 rounded-full px-3 text-sm capitalize">
                              {message.role}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {formatDateTime(message.created_at)}
                            </span>
                          </div>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                          {message.content}
                        </p>
                      </div>
                    ))}
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
    </div>
  )
}

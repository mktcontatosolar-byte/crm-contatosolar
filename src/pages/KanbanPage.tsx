import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Filter, GripVertical, MoreVertical, Plus, RotateCcw, X } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import StatePanel from "@/components/crm/StatePanel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/useAuth"
import {
  fetchKanbanLeads,
  fetchKanbanOrigins,
  fetchLeadStages,
  LEAD_SOURCE_TABLE,
  LEAD_STATE_TABLE,
  LEAD_TAGS_TABLE,
  updateLeadState,
} from "@/lib/crmLeads"
import { logAuditEvent } from "@/lib/auditLogs"
import { logLeadActivity } from "@/lib/leadActivity"
import { supabase } from "@/lib/supabase"
import { formatSupabaseValue } from "@/lib/utils"
import type { KanbanStage, Lead, LeadTag, Profile, Tag } from "@/types"

type KanbanLead = Pick<
  Lead,
  | "id"
  | "nome_completo"
  | "email"
  | "telefone_contato"
  | "horario_preferido"
  | "status_conversa"
  | "corretor_id"
  | "created_at"
  | "assumed_at"
  | "outra_info"
  | "origem"
  | "campanha"
  | "lead_entry_type"
  | "stage_id"
  | "arquivado"
  | "ia_paused"
  | "first_response_at"
  | "last_interaction_at"
>

type CorretorFilter = Pick<Profile, "id" | "nome" | "email">
type CreationDateFilter = "all" | "today" | "7d" | "30d"
type IAStatusFilter = "all" | "active" | "paused"

type StageMovePayload = {
  lead: KanbanLead
  stageId: string
}

function leadDisplayName(lead: KanbanLead) {
  return lead.nome_completo || lead.email || lead.telefone_contato || "Lead sem identificação"
}

function normalizeOrigin(origin: string | null | undefined) {
  return (origin || "").trim().toLowerCase()
}

function originBadgeClasses(origin: string | null | undefined) {
  switch (normalizeOrigin(origin)) {
    case "instagram":
      return "border-pink-500/20 bg-pink-500/10 text-pink-700 dark:text-pink-300"
    case "facebook":
      return "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300"
    case "google":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    case "direto":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    default:
      return "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300"
  }
}

function originBadgeLabel(origin: string | null | undefined) {
  const normalized = normalizeOrigin(origin)
  return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : "Sem origem"
}

function stageForLead(lead: KanbanLead, stages: KanbanStage[]) {
  if (lead.stage_id) {
    const matchedStage = stages.find((stage) => stage.id === lead.stage_id)
    if (matchedStage) {
      return matchedStage.id
    }
  }

  return stages[0]?.id ?? null
}

function isManualLead(lead: Pick<KanbanLead, "lead_entry_type">) {
  return (lead.lead_entry_type ?? "").trim().toLowerCase() === "manual"
}

function LeadCardBody({
  lead,
  tags,
  stages,
  movingLeadId,
  onMoveStage,
  onOpenDetails,
  onRequestRedistribution,
}: {
  lead: KanbanLead
  tags: Tag[]
  stages: KanbanStage[]
  movingLeadId: string | null
  onMoveStage: (lead: KanbanLead, stageId: string) => void
  onOpenDetails: (leadId: string) => void
  onRequestRedistribution: (lead: KanbanLead) => void
}) {
  const stageOptions = useMemo(
    () => stages.map((option) => ({ ...option, label: option.nome })),
    [stages]
  )

  return (
    <>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <CardTitle className="truncate text-[15px] font-semibold text-foreground">
              {leadDisplayName(lead)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{formatSupabaseValue(lead.telefone_contato)}</p>
            <div className="flex flex-wrap gap-2">
              {isManualLead(lead) ? (
                <Badge
                  variant="outline"
                  className="h-6 rounded-full border-cyan-500/20 bg-cyan-500/10 px-2.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-300"
                >
                  Manual
                </Badge>
              ) : null}
              {lead.origem ? (
                <Badge
                  variant="outline"
                  className={`h-6 rounded-full px-2.5 text-[11px] font-medium ${originBadgeClasses(lead.origem)}`}
                >
                  {originBadgeLabel(lead.origem)}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <div className="hidden cursor-grab rounded-xl border border-border/60 bg-background/80 p-2 text-muted-foreground md:flex">
              <GripVertical className="h-4 w-4" />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" className="rounded-xl">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Abrir ações do lead</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onOpenDetails(lead.id)}>Abrir lead</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => onRequestRedistribution(lead)}>
                  <RotateCcw className="h-4 w-4" />
                  Voltar para a fila
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex min-h-6 flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full px-2 py-1 text-xs font-medium"
              style={{
                backgroundColor: `${tag.cor}22`,
                color: tag.cor || "#334155",
              }}
            >
              {tag.nome}
            </span>
          ))}
        </div>

        <div className="space-y-2 overflow-visible md:hidden">
          <Label htmlFor={`move-stage-${lead.id}`}>Mover para etapa</Label>
          <SelectRoot value={stageForLead(lead, stages) ?? ""} onValueChange={(value) => onMoveStage(lead, value)}>
            <SelectTrigger
              id={`move-stage-${lead.id}`}
              className="min-h-12"
              disabled={movingLeadId === lead.id}
            >
              <SelectValue placeholder="Selecione uma etapa" />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" align="start" sideOffset={8}>
              {stageOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>
          <p className="text-xs text-muted-foreground">
            {movingLeadId === lead.id ? "Atualizando etapa..." : "Selecione em qual etapa esse lead está agora."}
          </p>
        </div>

        <div className="mt-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full rounded-full"
            onClick={() => onOpenDetails(lead.id)}
          >
            Abrir lead
          </Button>
        </div>
      </CardContent>
    </>
  )
}

function DraggableLeadCard({
  lead,
  tags,
  stages,
  movingLeadId,
  isDesktop,
  onMoveStage,
  onOpenDetails,
  onRequestRedistribution,
}: {
  lead: KanbanLead
  tags: Tag[]
  stages: KanbanStage[]
  movingLeadId: string | null
  isDesktop: boolean
  onMoveStage: (lead: KanbanLead, stageId: string) => void
  onOpenDetails: (leadId: string) => void
  onRequestRedistribution: (lead: KanbanLead) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: {
      type: "lead",
      leadId: lead.id,
    },
    disabled: !isDesktop || movingLeadId === lead.id,
  })

  return (
    <Card
      ref={setNodeRef}
      style={{
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="flex min-h-[176px] rounded-[1.5rem] border border-border/60 bg-card shadow-sm transition-shadow data-[dragging=true]:shadow-lg"
      data-dragging={isDragging}
      {...attributes}
      {...listeners}
    >
      <LeadCardBody
        lead={lead}
        tags={tags}
        stages={stages}
        movingLeadId={movingLeadId}
        onMoveStage={onMoveStage}
        onOpenDetails={onOpenDetails}
        onRequestRedistribution={onRequestRedistribution}
      />
    </Card>
  )
}

function DroppableStageColumn({
  stage,
  leadCount,
  isOver,
  children,
}: {
  stage: KanbanStage
  leadCount: number
  isOver: boolean
  children: React.ReactNode
}) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
    data: {
      type: "stage",
      stageId: stage.id,
    },
  })

  return (
    <div
      ref={setNodeRef}
      className={[
        "grid h-full min-h-[28rem] min-w-[300px] shrink-0 self-stretch grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[1.75rem] border bg-card/80 shadow-sm backdrop-blur transition-colors md:min-h-0 md:w-[300px] xl:w-[320px]",
        isOver ? "border-primary bg-primary/5 ring-2 ring-primary/25" : "border-border/60",
      ].join(" ")}
    >
      <div className="sticky top-0 z-10 border-b border-border/60 bg-card/95 px-4 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.cor || "#64748b" }} />
            <h2 className="font-semibold text-foreground">{stage.nome}</h2>
          </div>
          <span className="rounded-full border border-border/60 bg-background/80 px-2 py-1 text-xs text-muted-foreground">
            {leadCount}
          </span>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto overscroll-y-contain p-3">
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  )
}

export default function KanbanPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin, user } = useAuth()
  const [stages, setStages] = useState<KanbanStage[]>([])
  const [leads, setLeads] = useState<KanbanLead[]>([])
  const [brokers, setBrokers] = useState<CorretorFilter[]>([])
  const [tagsByLeadId, setTagsByLeadId] = useState<Record<string, Tag[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null)
  const [adminBrokerFilter, setAdminBrokerFilter] = useState("")
  const [creationDateFilter, setCreationDateFilter] = useState<CreationDateFilter>("all")
  const [iaStatusFilter, setIaStatusFilter] = useState<IAStatusFilter>("all")
  const [originFilter, setOriginFilter] = useState("all")
  const [originOptions, setOriginOptions] = useState<string[]>([])
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [pendingRedistribution, setPendingRedistribution] = useState<KanbanLead | null>(null)
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null)
  const [hoveredStageId, setHoveredStageId] = useState<string | null>(null)
  const [rollbackLeads, setRollbackLeads] = useState<KanbanLead[] | null>(null)
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 768px)").matches
  )
  const [kanbanViewportHeight, setKanbanViewportHeight] = useState<number | null>(null)
  const [columnsViewportHeight, setColumnsViewportHeight] = useState<number | null>(null)
  const kanbanSectionRef = useRef<HTMLElement | null>(null)
  const kanbanHeaderRef = useRef<HTMLDivElement | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const loadKanban = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!user) {
      return
    }

    try {
      if (!silent) {
        setLoading(true)
      }

      const [stagesResult, leadsResult, originsResult] = await Promise.all([
        fetchLeadStages(),
        fetchKanbanLeads({
          userId: user.id,
          isAdmin,
          brokerId: adminBrokerFilter,
          creationDateFilter,
          iaStatusFilter,
          originFilter,
        }),
        fetchKanbanOrigins({ userId: user.id, isAdmin }),
      ])

      const brokersResult = isAdmin
        ? await supabase
            .from("profiles")
            .select("id,nome,email")
            .eq("role", "corretor")
            .eq("ativo", true)
            .order("nome", { ascending: true })
        : null

      const nextStages = stagesResult as KanbanStage[]
      const nextLeads = leadsResult as KanbanLead[]
      const nextOrigins = originsResult as string[]

      setStages(nextStages)
      setLeads(nextLeads)
      setBrokers(isAdmin ? ((brokersResult?.data ?? []) as CorretorFilter[]) : [])
      setOriginOptions(nextOrigins.sort((left, right) => left.localeCompare(right, "pt-BR")))

      const leadIds = nextLeads.map((lead) => lead.id)
      if (leadIds.length === 0) {
        setTagsByLeadId({})
        setError("")
        return
      }

      const { data: leadTagsData, error: leadTagsError } = await supabase
        .from(LEAD_TAGS_TABLE)
        .select("lead_id,tag_id")
        .in("lead_id", leadIds)

      if (leadTagsError) {
        throw leadTagsError
      }

      const leadTags = (leadTagsData ?? []) as LeadTag[]
      const tagIds = [...new Set(leadTags.map((item) => item.tag_id))]

      if (tagIds.length === 0) {
        setTagsByLeadId({})
        setError("")
        return
      }

      const { data: tagsData, error: tagsError } = await supabase
        .from("tags")
        .select("id,nome,cor,created_by")
        .in("id", tagIds)

      if (tagsError) {
        throw tagsError
      }

      const tags = (tagsData ?? []) as Tag[]
      const tagsMap = new Map(tags.map((tag) => [tag.id, tag]))
      const nextTagsByLeadId: Record<string, Tag[]> = {}

      leadTags.forEach((leadTag) => {
        const tag = tagsMap.get(leadTag.tag_id)
        if (!tag) {
          return
        }

        nextTagsByLeadId[leadTag.lead_id] ??= []
        nextTagsByLeadId[leadTag.lead_id].push(tag)
      })

      setTagsByLeadId(nextTagsByLeadId)
      setError("")
    } catch (loadError) {
      console.error("Erro ao carregar kanban:", loadError)
      setError("Não conseguimos carregar os leads agora.")
    } finally {
      setLoading(false)
    }
  }, [adminBrokerFilter, creationDateFilter, iaStatusFilter, isAdmin, originFilter, user])

  const invalidateOperationalQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["kanban-leads"] }),
      queryClient.invalidateQueries({ queryKey: ["pool-leads"] }),
      queryClient.invalidateQueries({ queryKey: ["team-data"] }),
      queryClient.invalidateQueries({ queryKey: ["lead-activity"] }),
    ])
  }

  const redistributeLeadMutation = useMutation({
    mutationFn: async (lead: KanbanLead) => {
      await updateLeadState(lead.id, {
        corretor_id: null,
        assumed_at: null,
        stage_id: null,
      })

      await logLeadActivity({
        leadId: lead.id,
        usuarioId: user?.id ?? null,
        tipo: "pool",
        descricao: "Lead devolvido ao pool",
      })

      try {
        await logAuditEvent({
          actorUserId: user?.id ?? null,
          actorEmail: user?.email ?? null,
          entityType: "lead",
          entityId: lead.id,
          action: "pool",
          description: "Lead devolvido ao pool",
          beforeData: {
            corretor_id: lead.corretor_id,
            stage_id: lead.stage_id,
          },
          afterData: {
            corretor_id: null,
            stage_id: null,
          },
        })
      } catch (auditError) {
        console.error("Erro ao registrar log de auditoria:", auditError)
      }

      return lead
    },
    onSuccess: async (lead) => {
      toast.success(`${leadDisplayName(lead)} voltou para a fila.`)
      setPendingRedistribution(null)
      await invalidateOperationalQueries()
      await loadKanban({ silent: true })
    },
    onError: () => {
      toast.error("Não foi possível devolver esse lead para a fila.")
    },
  })

  const moveStageMutation = useMutation({
    mutationFn: async ({ lead, stageId }: StageMovePayload) => {
      const stage = stages.find((item) => item.id === stageId)
      if (!stage) {
        throw new Error("Etapa inválida.")
      }

      await updateLeadState(lead.id, {
        corretor_id: lead.corretor_id,
        assumed_at: lead.assumed_at ?? null,
        stage_id: stage.id,
        arquivado: lead.arquivado,
        ia_paused: lead.ia_paused,
        first_response_at: lead.first_response_at ?? null,
      })

      await logLeadActivity({
        leadId: lead.id,
        usuarioId: user?.id ?? null,
        tipo: "etapa",
        descricao: `Etapa alterada para ${stage.nome}`,
        metadata: {
          stage_id: stage.id,
          stage_name: stage.nome,
        },
      })
      try {
        await logAuditEvent({
          actorUserId: user?.id ?? null,
          actorEmail: user?.email ?? null,
          entityType: "lead",
          entityId: lead.id,
          action: "stage_changed",
          description: `Etapa alterada para ${stage.nome}`,
          beforeData: {
            stage_id: lead.stage_id ?? null,
          },
          afterData: {
            stage_id: stage.id,
            stage_name: stage.nome,
          },
        })
      } catch (auditError) {
        console.error("Erro ao registrar log de auditoria:", auditError)
      }
      return { lead, stage }
    },
    onMutate: async ({ lead, stageId }) => {
      setMovingLeadId(lead.id)
      setError("")
      setRollbackLeads(leads)

      const stage = stages.find((item) => item.id === stageId)
      if (!stage) {
        return { previousLeads: leads }
      }

      setLeads((currentLeads) =>
        currentLeads.map((item) => (item.id === lead.id ? { ...item, stage_id: stage.id } : item))
      )

      return { previousLeads: leads }
    },
    onSuccess: async ({ stage }) => {
      toast.success(`Lead movido para ${stage.nome}.`)
      await invalidateOperationalQueries()
    },
    onError: (moveError, _variables, context) => {
      console.error("Erro ao mover lead:", moveError)
      setLeads(context?.previousLeads ?? rollbackLeads ?? leads)
      setError("Não foi possível mover o lead para a etapa escolhida.")
      toast.error("Não foi possível mover esse lead.")
    },
    onSettled: async () => {
      setMovingLeadId(null)
      setActiveLeadId(null)
      setHoveredStageId(null)
      setRollbackLeads(null)
      await loadKanban({ silent: true })
    },
  })

  const moveLeadToStage = useCallback(
    (lead: KanbanLead, stageId: string) => {
      if (!stageId) {
        return
      }

      const currentStageId = stageForLead(lead, stages)
      if (currentStageId === stageId || movingLeadId === lead.id) {
        return
      }

      moveStageMutation.mutate({ lead, stageId })
    },
    [moveStageMutation, movingLeadId, stages]
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)")
    const handleChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches)

    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadKanban()
    }, 0)

    const channel = supabase
      .channel("kanban-leads")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: LEAD_STATE_TABLE,
        },
        () => {
          void loadKanban({ silent: true })
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: LEAD_SOURCE_TABLE,
        },
        () => {
          void loadKanban({ silent: true })
        }
      )
      .subscribe()

    return () => {
      window.clearTimeout(timeoutId)
      void supabase.removeChannel(channel)
    }
  }, [user?.id, isAdmin, adminBrokerFilter, creationDateFilter, iaStatusFilter, originFilter, loadKanban])

  useEffect(() => {
    const updateKanbanViewportHeight = () => {
      if (!kanbanSectionRef.current) {
        return
      }

      const { top } = kanbanSectionRef.current.getBoundingClientRect()
      const nextHeight = Math.max(320, Math.floor(window.innerHeight - top))
      setKanbanViewportHeight(nextHeight)

      const nextColumnsHeight = Math.max(260, nextHeight)
      setColumnsViewportHeight(nextColumnsHeight)
    }

    updateKanbanViewportHeight()
    const timeoutId = window.setTimeout(updateKanbanViewportHeight, 0)
    window.addEventListener("resize", updateKanbanViewportHeight)

    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener("resize", updateKanbanViewportHeight)
    }
  }, [isDesktop, loading, stages.length, adminBrokerFilter, creationDateFilter, iaStatusFilter, originFilter])

  const hasActiveFilters = adminBrokerFilter !== "" || creationDateFilter !== "all" || iaStatusFilter !== "all" || originFilter !== "all"
  const activeLead = activeLeadId ? leads.find((lead) => lead.id === activeLeadId) ?? null : null

  const clearFilters = () => {
    setAdminBrokerFilter("")
    setCreationDateFilter("all")
    setIaStatusFilter("all")
    setOriginFilter("all")
    setMobileFiltersOpen(false)
  }

  const filterFields = (
    <div className={`grid gap-4 ${isAdmin ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
      {isAdmin ? (
        <div className="space-y-2">
          <Label htmlFor="kanban-corretor-filter">Vendedor</Label>
          <SelectRoot value={adminBrokerFilter || "all"} onValueChange={(value) => setAdminBrokerFilter(value === "all" ? "" : value)}>
            <SelectTrigger id="kanban-corretor-filter" className="min-h-11 rounded-2xl bg-background/80">
              <SelectValue placeholder="Todos os vendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {brokers.map((broker) => (
                <SelectItem key={broker.id} value={broker.id}>
                  {broker.nome || broker.email || "Vendedor sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="kanban-created-filter">Data de criação</Label>
        <SelectRoot value={creationDateFilter} onValueChange={(value) => setCreationDateFilter(value as CreationDateFilter)}>
          <SelectTrigger id="kanban-created-filter" className="min-h-11 rounded-2xl bg-background/80">
            <SelectValue placeholder="Todas as datas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </SelectRoot>
      </div>

      <div className="space-y-2">
        <Label htmlFor="kanban-ia-filter">Status da IA</Label>
        <SelectRoot value={iaStatusFilter} onValueChange={(value) => setIaStatusFilter(value as IAStatusFilter)}>
          <SelectTrigger id="kanban-ia-filter" className="min-h-11 rounded-2xl bg-background/80">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativa</SelectItem>
            <SelectItem value="paused">Pausada</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </SelectRoot>
      </div>

      <div className="space-y-2">
        <Label htmlFor="kanban-origin-filter">Origem</Label>
        <SelectRoot value={originFilter} onValueChange={setOriginFilter}>
          <SelectTrigger id="kanban-origin-filter" className="min-h-11 rounded-2xl bg-background/80">
            <SelectValue placeholder="Todas as origens" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {originOptions.map((origin) => (
              <SelectItem key={origin} value={origin}>
                {origin}
              </SelectItem>
            ))}
          </SelectContent>
        </SelectRoot>
      </div>
    </div>
  )

  const handleDragStart = (event: DragStartEvent) => {
    if (!isDesktop) {
      return
    }

    setActiveLeadId(String(event.active.id))
  }

  const handleDragOver = (event: DragOverEvent) => {
    if (!isDesktop) {
      return
    }

    const nextStageId = event.over ? String(event.over.id) : null
    setHoveredStageId(nextStageId)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    if (!isDesktop) {
      return
    }

    const leadId = String(event.active.id)
    const nextStageId = event.over ? String(event.over.id) : null
    const lead = leads.find((item) => item.id === leadId)

    setActiveLeadId(null)
    setHoveredStageId(null)

    if (!lead || !nextStageId) {
      return
    }

    void moveLeadToStage(lead, nextStageId)
  }

  const handleDragCancel = () => {
    setActiveLeadId(null)
    setHoveredStageId(null)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">Meus leads</h1>
            <Badge
              variant="outline"
              className="h-7 rounded-full border-emerald-500/20 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-700 dark:text-emerald-300"
            >
              Acompanhamento dos leads
            </Badge>
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-sm text-muted-foreground">
              <span className="whitespace-nowrap text-xs font-medium uppercase tracking-[0.16em]">Leads em atendimento</span>
              <span className="text-sm font-semibold text-foreground">{leads.length}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="h-10 rounded-full px-4"
              onClick={() => navigate("/leads/novo")}
            >
              <Plus className="h-4 w-4" />
              Adicionar lead manual
            </Button>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-full px-3 text-muted-foreground"
                onClick={clearFilters}
              >
                <X className="h-4 w-4" />
                Limpar filtros
              </Button>
            ) : null}
          </div>
        </div>

        <div className="hidden md:block">{filterFields}</div>
      </div>

      <div className="md:hidden">
        <Button type="button" variant="outline" className="h-12 w-full rounded-full" onClick={() => setMobileFiltersOpen(true)}>
          <Filter className="h-4 w-4" />
          Filtros
          {hasActiveFilters ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">ativos</span> : null}
        </Button>
      </div>

      {error ? <StatePanel tone="error" centered={false}>{error}</StatePanel> : null}

      {loading ? <StatePanel>Carregando seus leads...</StatePanel> : null}

      {!loading && stages.length === 0 ? (
        <StatePanel tone="warning" centered={false}>
          Nenhuma etapa cadastrada em `kanban_stages`.
        </StatePanel>
      ) : null}

      {!loading && stages.length > 0 ? (
        <section
          ref={kanbanSectionRef}
          className="grid h-full min-h-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden"
          style={kanbanViewportHeight ? { height: `${kanbanViewportHeight}px` } : undefined}
        >
          <div
            ref={kanbanHeaderRef}
            className="min-h-0 overflow-hidden"
            style={columnsViewportHeight ? { height: `${columnsViewportHeight}px` } : undefined}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <div className="h-full min-h-0 overflow-x-auto overflow-y-hidden">
                <div className="flex h-full min-h-0 min-w-max items-stretch gap-4 px-1">
                  {stages.map((stage) => {
                    const stageLeads = leads.filter((lead) => stageForLead(lead, stages) === stage.id)

                    return (
                      <DroppableStageColumn
                        key={stage.id}
                        stage={stage}
                        leadCount={stageLeads.length}
                        isOver={hoveredStageId === stage.id}
                      >
                        <SortableContext
                          items={stageLeads.map((lead) => lead.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {stageLeads.length === 0 ? <StatePanel dashed>Nenhum lead nesta etapa.</StatePanel> : null}

                          {stageLeads.map((lead) => (
                            <DraggableLeadCard
                              key={lead.id}
                              lead={lead}
                              tags={tagsByLeadId[lead.id] ?? []}
                              stages={stages}
                              movingLeadId={movingLeadId}
                              isDesktop={isDesktop}
                              onMoveStage={moveLeadToStage}
                              onOpenDetails={(leadId) => navigate(`/leads/${leadId}`)}
                              onRequestRedistribution={setPendingRedistribution}
                            />
                          ))}
                        </SortableContext>
                      </DroppableStageColumn>
                    )
                  })}
                </div>
              </div>

              <DragOverlay>
                {activeLead ? (
                  <div className="w-[320px] rotate-[1.5deg] opacity-95 xl:w-[340px]">
                    <Card className="border border-primary/40 bg-card shadow-2xl">
                      <LeadCardBody
                        lead={activeLead}
                        tags={tagsByLeadId[activeLead.id] ?? []}
                        stages={stages}
                        movingLeadId={movingLeadId}
                        onMoveStage={moveLeadToStage}
                        onOpenDetails={(leadId) => navigate(`/leads/${leadId}`)}
                        onRequestRedistribution={setPendingRedistribution}
                      />
                    </Card>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </section>
      ) : null}

      <Dialog open={Boolean(pendingRedistribution)} onOpenChange={(open) => !open && setPendingRedistribution(null)}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Remover esse lead da carteira?</DialogTitle>
            <DialogDescription>
              {pendingRedistribution
                ? `${leadDisplayName(pendingRedistribution)} vai sair da carteira atual e voltar para a fila.`
                : "Confirme se esse lead deve voltar para a fila."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-full"
              onClick={() => setPendingRedistribution(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-12 rounded-full"
              disabled={!pendingRedistribution || redistributeLeadMutation.isPending}
              onClick={() =>
                pendingRedistribution ? void redistributeLeadMutation.mutateAsync(pendingRedistribution) : undefined
              }
            >
              {redistributeLeadMutation.isPending ? "Voltando para a fila..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-[2rem] md:hidden">
          <SheetHeader className="pr-10">
            <SheetTitle>Filtrar meus leads</SheetTitle>
            <SheetDescription>Use os filtros para encontrar os leads mais rápido.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 pt-4">
            {filterFields}
            {hasActiveFilters ? (
              <Button type="button" variant="outline" className="h-12 w-full rounded-full" onClick={clearFilters}>
                Limpar filtros
              </Button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

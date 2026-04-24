import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { startOfDay, subDays } from "date-fns"
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
import { Filter, GripVertical, MoreVertical, RotateCcw, X } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import PageIntro from "@/components/crm/PageIntro"
import StatePanel from "@/components/crm/StatePanel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { logLeadActivity } from "@/lib/leadActivity"
import { supabase } from "@/lib/supabase"
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
  | "stage_id"
  | "arquivado"
  | "ia_paused"
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

function formatDateTime(dateString: string | null) {
  if (!dateString) {
    return "Sem interação"
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateString))
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
          <div className="min-w-0">
            <CardTitle className="text-base text-foreground">{leadDisplayName(lead)}</CardTitle>
            <CardDescription>{lead.telefone_contato || "Telefone não informado"}</CardDescription>
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
                <DropdownMenuItem onSelect={() => onOpenDetails(lead.id)}>Ver detalhes</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => onRequestRedistribution(lead)}>
                  <RotateCcw className="h-4 w-4" />
                  Devolver para Pool
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="break-words">{lead.email || "E-mail não informado"}</p>
          <p>Última interação: {formatDateTime(lead.last_interaction_at)}</p>
        </div>

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
            {movingLeadId === lead.id ? "Atualizando etapa..." : "Escolha a próxima etapa deste lead."}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-full"
          onClick={() => onOpenDetails(lead.id)}
        >
          Ver detalhes
        </Button>
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
      className="rounded-3xl border border-border/60 bg-card shadow-sm transition-shadow data-[dragging=true]:shadow-lg"
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
        "flex h-full min-h-[28rem] w-[320px] shrink-0 flex-col overflow-hidden rounded-[2rem] border bg-card/70 shadow-sm backdrop-blur transition-colors md:min-h-0 xl:w-[340px]",
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

      <div className="flex-1 space-y-3 overflow-y-auto p-3">{children}</div>
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
  const [topScrollbarWidth, setTopScrollbarWidth] = useState(0)
  const topScrollbarRef = useRef<HTMLDivElement | null>(null)
  const kanbanScrollerRef = useRef<HTMLDivElement | null>(null)
  const syncSourceRef = useRef<"top" | "main" | null>(null)

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

      const leadsQuery = supabase
        .from("leads_lancamento")
        .select(
          "id,nome_completo,email,telefone_contato,horario_preferido,status_conversa,corretor_id,created_at,assumed_at,outra_info,origem,campanha,stage_id,arquivado,ia_paused,last_interaction_at"
        )
        .not("corretor_id", "is", null)
        .eq("arquivado", false)
        .order("last_interaction_at", { ascending: false, nullsFirst: false })

      if (!isAdmin) {
        leadsQuery.eq("corretor_id", user.id)
      } else if (adminBrokerFilter) {
        leadsQuery.eq("corretor_id", adminBrokerFilter)
      }

      if (creationDateFilter === "today") {
        leadsQuery.gte("created_at", startOfDay(new Date()).toISOString())
      } else if (creationDateFilter === "7d") {
        leadsQuery.gte("created_at", startOfDay(subDays(new Date(), 7)).toISOString())
      } else if (creationDateFilter === "30d") {
        leadsQuery.gte("created_at", startOfDay(subDays(new Date(), 30)).toISOString())
      }

      if (iaStatusFilter === "active") {
        leadsQuery.eq("ia_paused", false)
      } else if (iaStatusFilter === "paused") {
        leadsQuery.eq("ia_paused", true)
      }

      if (originFilter !== "all") {
        leadsQuery.eq("origem", originFilter)
      }

      const originQuery = supabase
        .from("leads_lancamento")
        .select("origem")
        .not("corretor_id", "is", null)
        .eq("arquivado", false)
        .not("origem", "is", null)

      if (!isAdmin) {
        originQuery.eq("corretor_id", user.id)
      }

      const [stagesResult, leadsResult, originsResult] = await Promise.all([
        supabase.from("kanban_stages").select("id,nome,ordem,cor,is_final").order("ordem", { ascending: true }),
        leadsQuery,
        originQuery,
      ])

      const brokersResult = isAdmin
        ? await supabase
            .from("profiles")
            .select("id,nome,email")
            .eq("role", "corretor")
            .eq("ativo", true)
            .order("nome", { ascending: true })
        : null

      if (stagesResult.error) {
        throw stagesResult.error
      }

      if (leadsResult.error) {
        throw leadsResult.error
      }

      if (originsResult.error) {
        throw originsResult.error
      }

      const nextStages = (stagesResult.data ?? []) as KanbanStage[]
      const nextLeads = (leadsResult.data ?? []) as KanbanLead[]
      const nextOrigins = [...new Set((originsResult.data ?? []).map((item) => item.origem).filter(Boolean))] as string[]

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
        .from("lead_tags")
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
      setError("Não foi possível carregar o kanban.")
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
      const { error: updateError } = await supabase
        .from("leads_lancamento")
        .update({
          corretor_id: null,
          assumed_at: null,
          stage_id: null,
        })
        .eq("id", lead.id)

      if (updateError) {
        throw updateError
      }

      await logLeadActivity({
        leadId: lead.id,
        usuarioId: user?.id ?? null,
        tipo: "pool",
        descricao: "Lead devolvido ao pool",
      })

      return lead
    },
    onSuccess: async (lead) => {
      toast.success(`${leadDisplayName(lead)} devolvido para o Pool.`)
      setPendingRedistribution(null)
      await invalidateOperationalQueries()
      await loadKanban({ silent: true })
    },
    onError: () => {
      toast.error("Não foi possível devolver o lead para o Pool.")
    },
  })

  const moveStageMutation = useMutation({
    mutationFn: async ({ lead, stageId }: StageMovePayload) => {
      const stage = stages.find((item) => item.id === stageId)
      if (!stage) {
        throw new Error("Etapa inválida.")
      }

      const { error: updateError } = await supabase
        .from("leads_lancamento")
        .update({
          stage_id: stage.id,
        })
        .eq("id", lead.id)

      if (updateError) {
        throw updateError
      }

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
      setError("Não foi possível mover o lead para a etapa selecionada.")
      toast.error("Não foi possível mover o lead.")
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
          table: "leads_lancamento",
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
    const updateScrollbarWidth = () => {
      setTopScrollbarWidth(kanbanScrollerRef.current?.scrollWidth ?? 0)
    }

    updateScrollbarWidth()
    const timeoutId = window.setTimeout(updateScrollbarWidth, 0)
    window.addEventListener("resize", updateScrollbarWidth)

    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener("resize", updateScrollbarWidth)
    }
  }, [stages.length, leads.length, isDesktop])

  const handleTopScrollbarScroll = () => {
    if (!topScrollbarRef.current || !kanbanScrollerRef.current) {
      return
    }

    if (syncSourceRef.current === "main") {
      syncSourceRef.current = null
      return
    }

    syncSourceRef.current = "top"
    kanbanScrollerRef.current.scrollLeft = topScrollbarRef.current.scrollLeft
  }

  const handleKanbanScroll = () => {
    if (!topScrollbarRef.current || !kanbanScrollerRef.current) {
      return
    }

    if (syncSourceRef.current === "top") {
      syncSourceRef.current = null
      return
    }

    syncSourceRef.current = "main"
    topScrollbarRef.current.scrollLeft = kanbanScrollerRef.current.scrollLeft
  }

  const activeLead = activeLeadId ? leads.find((lead) => lead.id === activeLeadId) ?? null : null
  const hasActiveFilters = adminBrokerFilter !== "" || creationDateFilter !== "all" || iaStatusFilter !== "all" || originFilter !== "all"

  const clearFilters = () => {
    setAdminBrokerFilter("")
    setCreationDateFilter("all")
    setIaStatusFilter("all")
    setOriginFilter("all")
    setMobileFiltersOpen(false)
  }

  const filterFields = (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {isAdmin ? (
        <div className="space-y-2">
          <Label htmlFor="kanban-corretor-filter">Corretor</Label>
          <SelectRoot value={adminBrokerFilter || "all"} onValueChange={(value) => setAdminBrokerFilter(value === "all" ? "" : value)}>
            <SelectTrigger id="kanban-corretor-filter" className="min-h-12">
              <SelectValue placeholder="Todos os corretores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os corretores</SelectItem>
              {brokers.map((broker) => (
                <SelectItem key={broker.id} value={broker.id}>
                  {broker.nome || broker.email || "Corretor sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="kanban-created-filter">Data de criação</Label>
        <SelectRoot value={creationDateFilter} onValueChange={(value) => setCreationDateFilter(value as CreationDateFilter)}>
          <SelectTrigger id="kanban-created-filter" className="min-h-12">
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
          <SelectTrigger id="kanban-ia-filter" className="min-h-12">
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
          <SelectTrigger id="kanban-origin-filter" className="min-h-12">
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
    <div className="flex min-h-0 flex-col gap-6 lg:h-[calc(100vh-6.5rem)] lg:overflow-hidden">
      <PageIntro
        badge="Funil operacional"
        badgeTone="emerald"
        title="Meu Kanban"
        description={
          isAdmin ? "Todos os leads atribuídos, organizados por etapa." : "Leads atribuídos a você, organizados por etapa."
        }
        aside={
          <div className="rounded-3xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
            <p className="text-xs uppercase tracking-[0.18em]">Leads ativos</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{leads.length}</p>
          </div>
        }
      />

      <div className="hidden rounded-3xl border border-border/60 bg-card/90 p-4 shadow-sm md:block">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Filtros do quadro</p>
            <p className="text-sm text-muted-foreground">Refine corretor, criação, IA e origem sem sair do Kanban.</p>
          </div>
          {hasActiveFilters ? (
            <Button type="button" variant="outline" className="h-11 rounded-full" onClick={clearFilters}>
              <X className="h-4 w-4" />
              Limpar filtros
            </Button>
          ) : null}
        </div>
        <div className="mt-4">{filterFields}</div>
      </div>

      <div className="md:hidden">
        <Button type="button" variant="outline" className="h-12 w-full rounded-full" onClick={() => setMobileFiltersOpen(true)}>
          <Filter className="h-4 w-4" />
          Filtros
          {hasActiveFilters ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">ativos</span> : null}
        </Button>
      </div>

      {error ? <StatePanel tone="error" centered={false}>{error}</StatePanel> : null}

      {loading ? <StatePanel>Carregando etapas, leads atribuídos e tags do kanban...</StatePanel> : null}

      {!loading && stages.length === 0 ? (
        <StatePanel tone="warning" centered={false}>
          Nenhuma etapa cadastrada em `kanban_stages`.
        </StatePanel>
      ) : null}

      {!loading && stages.length > 0 ? (
        <section className="flex h-full min-h-0 flex-1 flex-col space-y-3 overflow-hidden">
          <div className="shrink-0 flex items-center justify-between gap-4 rounded-3xl border border-border/60 bg-card/80 px-4 py-3 text-sm text-muted-foreground shadow-sm">
            <p className="font-medium text-foreground">Etapas em linha única com rolagem horizontal.</p>
            <p className="hidden sm:block">
              {isDesktop ? "Arraste os cards entre colunas ou deslize para ver todo o funil." : "Deslize para o lado para ver todo o funil."}
            </p>
          </div>

          <div
            ref={topScrollbarRef}
            className="shrink-0 overflow-x-auto rounded-full border border-border/60 bg-card/70 px-1 py-1"
            onScroll={handleTopScrollbarScroll}
          >
            <div className="h-2" style={{ width: `${topScrollbarWidth}px` }} />
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <div
                ref={kanbanScrollerRef}
                className="h-full overflow-x-auto overflow-y-hidden pb-2"
                onScroll={handleKanbanScroll}
              >
                <div className="flex h-full min-h-0 min-w-max items-stretch gap-4">
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
            <DialogTitle>Devolver lead para o Pool?</DialogTitle>
            <DialogDescription>
              {pendingRedistribution
                ? `${leadDisplayName(pendingRedistribution)} será removido da carteira atual e voltará para o Pool.`
                : "Confirme a redistribuição do lead."}
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
              {redistributeLeadMutation.isPending ? "Devolvendo..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-[2rem] md:hidden">
          <SheetHeader className="pr-10">
            <SheetTitle>Filtros do Kanban</SheetTitle>
            <SheetDescription>Ajuste corretor, criação, IA e origem para encontrar os leads certos.</SheetDescription>
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

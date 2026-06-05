
import { useCallback, useEffect, useRef, useState } from "react"
import { closestCorners, DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Filter, MoreVertical, Plus, RotateCcw } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"

import StatePanel from "@/components/crm/StatePanel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/useAuth"
import { fetchKanbanLeads, fetchKanbanOrigins, fetchLeadStages, LEAD_SOURCE_TABLE, LEAD_STATE_TABLE, updateLeadState } from "@/lib/crmLeads"
import { logAuditEvent } from "@/lib/auditLogs"
import { safeLogLeadActivity } from "@/lib/leadActivity"
import { supabase } from "@/lib/supabase"
import { cn, formatSupabaseValue } from "@/lib/utils"
import type { KanbanStage, Lead, Profile } from "@/types"

type KanbanLead = Pick<Lead, | "id" | "nome_completo" | "email" | "telefone_contato" | "status_conversa" | "corretor_id" | "created_at" | "assumed_at" | "stage_id" | "arquivado" | "last_interaction_at" | "ia_paused" | "first_response_at" | "origem">

type CorretorFilter = Pick<Profile, "id" | "nome" | "email">
type CreationDateFilter = "all" | "today" | "7d" | "30d"
type IAStatusFilter = "all" | "active" | "paused"

type StageMovePayload = {
  lead: KanbanLead
  stageId: string
}

function leadDisplayName(lead: KanbanLead) {
  return lead.nome_completo || "Sem nome"
}

function getStageTitleColor(stageName: string) {
    const normalized = stageName.toLowerCase();
    if (normalized.includes("novo")) return "text-[#2563eb] dark:text-[#818cf8]";
    if (normalized.includes("contato")) return "text-[#0891b2] dark:text-[#38bdf8]";
    if (normalized.includes("qualificado")) return "text-[#7c3aed] dark:text-[#c4b5fd]";
    if (normalized.includes("proposta")) return "text-[#d97706] dark:text-[#fbbf24]";
    if (normalized.includes("fechado")) return "text-[#059669] dark:text-[#34d399]";
    return "text-text-sec";
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
  onRequestRedistribution,
}: {
  lead: KanbanLead
  onRequestRedistribution: (lead: KanbanLead) => void
}) {
  const time = lead.last_interaction_at || lead.created_at;
  return (
    <>
      <CardHeader className="flex-row items-start justify-between p-4">
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="truncate text-sm font-semibold text-text-main">
              {leadDisplayName(lead)}
            </CardTitle>
            <p className="text-xs text-text-sec">{formatSupabaseValue(lead.telefone_contato)}</p>
            {lead.origem ? (
              <p className="truncate text-xs text-text-tert">{lead.origem}</p>
            ) : null}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-md">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Abrir ações do lead</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onRequestRedistribution(lead)}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Voltar para a fila
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </CardHeader>

      <CardContent className="flex flex-1 items-end p-4 pt-0">
        <div className="mt-auto text-xs text-text-tert">
            {time ? formatDistanceToNow(new Date(time), { addSuffix: true, locale: ptBR }) : ""}
        </div>
      </CardContent>
    </>
  )
}

function DraggableLeadCard({
  lead,
  isDesktop,
  onOpenDetails,
  onRequestRedistribution,
}: {
  lead: KanbanLead
  isDesktop: boolean
  onOpenDetails: (leadId: string) => void
  onRequestRedistribution: (lead: KanbanLead) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: {
      type: "lead",
      leadId: lead.id,
    },
    disabled: !isDesktop,
  })

  return (
    <Card
      ref={setNodeRef}
      style={{
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="group/card cursor-pointer rounded-lg border bg-card shadow-sm transition-all hover:shadow-md data-[dragging=true]:shadow-lg dark:border-border"
      data-dragging={isDragging}
      onClick={() => onOpenDetails(lead.id)}
      {...attributes}
      {...listeners}
    >
      <LeadCardBody
        lead={lead}
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
      className={cn(
        "grid h-full min-h-[28rem] w-[280px] shrink-0 grid-rows-[auto_minmax(0,1fr)] self-stretch overflow-hidden rounded-xl border bg-card transition-colors md:min-h-0 xl:w-[300px]",
        isOver && "border-primary",
      )}
    >
      <div className="border-b border-border px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className={cn("text-xs font-semibold uppercase tracking-wider", getStageTitleColor(stage.nome))}>{stage.nome}</h2>
          </div>
          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">
            {leadCount}
          </span>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto overscroll-y-contain bg-muted p-2">
        <div className="space-y-2">{children}</div>
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

      setError("")
    } catch {
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

      await safeLogLeadActivity({
        leadId: lead.id,
        usuarioId: user?.id ?? null,
        tipo: "pool",
        descricao: "Lead devolvido ao pool",
      }, { context: "kanban-return-pool" })

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

      await safeLogLeadActivity({
        leadId: lead.id,
        usuarioId: user?.id ?? null,
        tipo: "etapa",
        descricao: `Etapa alterada para ${stage.nome}`,
        metadata: {
          stage_id: stage.id,
          stage_name: stage.nome,
        },
      }, { context: "kanban-move-stage" })
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
    <>
      {isAdmin ? (
        <SelectRoot
          value={adminBrokerFilter || "all"}
          onValueChange={(value) => setAdminBrokerFilter(value === "all" ? "" : value)}
        >
          <SelectTrigger id="kanban-corretor-filter" className="h-9 w-[180px] rounded-lg">
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
      ) : null}

      <SelectRoot
        value={creationDateFilter}
        onValueChange={(value) => setCreationDateFilter(value as CreationDateFilter)}
      >
        <SelectTrigger id="kanban-created-filter" className="h-9 w-[150px] rounded-lg">
          <SelectValue placeholder="Todas as datas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Hoje</SelectItem>
          <SelectItem value="7d">Últimos 7 dias</SelectItem>
          <SelectItem value="30d">Últimos 30 dias</SelectItem>
          <SelectItem value="all">Todos</SelectItem>
        </SelectContent>
      </SelectRoot>

      <SelectRoot
        value={iaStatusFilter}
        onValueChange={(value) => setIaStatusFilter(value as IAStatusFilter)}
      >
        <SelectTrigger id="kanban-ia-filter" className="h-9 w-[140px] rounded-lg">
          <SelectValue placeholder="Status IA" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="active">IA ativa</SelectItem>
          <SelectItem value="paused">IA pausada</SelectItem>
        </SelectContent>
      </SelectRoot>

      <SelectRoot value={originFilter} onValueChange={setOriginFilter}>
        <SelectTrigger id="kanban-origin-filter" className="h-9 w-[150px] rounded-lg">
          <SelectValue placeholder="Todas as origens" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as origens</SelectItem>
          {originOptions.map((origin) => (
            <SelectItem key={origin} value={origin}>
              {origin}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    </>
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
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 lg:p-6">
      {/* Linha 1: título + botão */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
          Meu Kanban
        </h1>
        <Button type="button" onClick={() => navigate("/leads/novo")}>
          <Plus className="-ml-1 mr-2 h-4 w-4" />
          Novo Lead
        </Button>
      </div>

      {/* Linha 2: filtros inline (desktop) */}
      <div className="hidden items-center gap-2 md:flex">
        {filterFields}
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 rounded-lg px-3 text-muted-foreground hover:text-foreground"
            onClick={clearFilters}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Limpar
          </Button>
        ) : null}
      </div>

      {/* Filtros mobile */}
      <div className="md:hidden">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setMobileFiltersOpen(true)}
        >
          <Filter className="-ml-1 mr-2 h-4 w-4" />
          Filtros
          {hasActiveFilters ? (
            <span className="ml-2 h-2 w-2 rounded-full bg-primary" />
          ) : null}
        </Button>
      </div>

      {error ? <StatePanel tone="error" centered={false}>{error}</StatePanel> : null}

      {loading ? <StatePanel>Carregando seus leads...</StatePanel> : null}

      {!loading && stages.length === 0 ? (
        <StatePanel tone="warning" centered={false}>
          Nenhuma etapa configurada. Contate o administrador do sistema.
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
                <div className="flex h-full min-h-0 min-w-max items-stretch gap-4 px-1 pb-4">
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
                              isDesktop={isDesktop}
                              onOpenDetails={(leadId) => navigate(`/leads/${leadId}`)}
                              onRequestRedistribution={() => setPendingRedistribution(lead)}
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
                  <div className="w-[min(300px,85vw)] rotate-[1.5deg] opacity-95 xl:w-[320px]">
                    <Card className="border border-primary/40 bg-card shadow-2xl">
                      <LeadCardBody
                        lead={activeLead}
                        onRequestRedistribution={() => setPendingRedistribution(activeLead)}
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
              onClick={() => setPendingRedistribution(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
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
        <SheetContent side="bottom" className="rounded-t-lg md:hidden">
          <SheetHeader className="pr-10">
            <SheetTitle>Filtrar meus leads</SheetTitle>
            <SheetDescription>Use os filtros para encontrar os leads mais rápido.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 pt-4">
            {filterFields}
            {hasActiveFilters ? (
              <Button type="button" variant="outline" onClick={clearFilters}>
                Limpar filtros
              </Button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

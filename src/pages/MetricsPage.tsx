import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, Archive, BriefcaseBusiness, Layers3, TrendingUp, Users } from "lucide-react"

import PageIntro from "@/components/crm/PageIntro"
import StatePanel from "@/components/crm/StatePanel"
import StatCard from "@/components/crm/StatCard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/useAuth"
import { supabase } from "@/lib/supabase"
import type { KanbanStage, Lead, Profile } from "@/types"

type MetricsLead = Pick<
  Lead,
  | "id"
  | "nome_completo"
  | "email"
  | "telefone_contato"
  | "status_conversa"
  | "corretor_id"
  | "stage_id"
  | "arquivado"
  | "created_at"
>

type BrokerSummary = Pick<Profile, "id" | "nome" | "email">

function formatDateTime(dateString: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateString))
}

function leadDisplayName(lead: MetricsLead) {
  return lead.nome_completo || lead.email || lead.telefone_contato || "Lead sem identificação"
}

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1
    return acc
  }, {})
}

function ChartPanel({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card className="overflow-hidden rounded-3xl border border-border/60 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function DonutChart({
  value,
  total,
  label,
  tone = "var(--color-chart-1)",
}: {
  value: number
  total: number
  label: string
  tone?: string
}) {
  const safeTotal = Math.max(total, 1)
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(1, value / safeTotal)
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-background/70 p-4">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="color-mix(in oklab, var(--muted) 85%, transparent)" strokeWidth="10" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={tone}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-foreground">{value}</span>
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">de {safeTotal}</span>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">
          {Math.round(progress * 100)}% da base monitorada neste recorte.
        </p>
      </div>
    </div>
  )
}

function MiniAreaChart({
  values,
  stroke = "var(--color-chart-2)",
  fill = "color-mix(in oklab, var(--color-chart-2) 18%, transparent)",
}: {
  values: number[]
  stroke?: string
  fill?: string
}) {
  const width = 320
  const height = 120
  const maxValue = Math.max(...values, 1)
  const step = values.length > 1 ? width / (values.length - 1) : width

  const points = values
    .map((value, index) => {
      const x = step * index
      const y = height - (value / maxValue) * (height - 18) - 10
      return `${x},${y}`
    })
    .join(" ")

  const areaPoints = `0,${height} ${points} ${width},${height}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full">
      <defs>
        <linearGradient id="metrics-area-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={fill} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#metrics-area-gradient)" />
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

function MetricSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-36 animate-pulse rounded-3xl border border-border/60 bg-card/80 shadow-sm"
        />
      ))}
    </div>
  )
}

export default function MetricsPage() {
  const { isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [leads, setLeads] = useState<MetricsLead[]>([])
  const [stages, setStages] = useState<KanbanStage[]>([])
  const [brokers, setBrokers] = useState<BrokerSummary[]>([])

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true)

      const [leadsResult, stagesResult, brokersResult] = await Promise.all([
        supabase
          .from("leads_lancamento")
          .select("id,nome_completo,email,telefone_contato,status_conversa,corretor_id,stage_id,arquivado,created_at")
          .order("created_at", { ascending: false }),
        supabase.from("kanban_stages").select("id,nome,ordem,cor,is_final").order("ordem", { ascending: true }),
        supabase
          .from("profiles")
          .select("id,nome,email")
          .eq("role", "corretor")
          .eq("ativo", true)
          .order("nome", { ascending: true }),
      ])

      if (leadsResult.error) {
        throw leadsResult.error
      }

      if (stagesResult.error) {
        throw stagesResult.error
      }

      if (brokersResult.error) {
        throw brokersResult.error
      }

      setLeads((leadsResult.data ?? []) as MetricsLead[])
      setStages((stagesResult.data ?? []) as KanbanStage[])
      setBrokers((brokersResult.data ?? []) as BrokerSummary[])
      setError("")
    } catch (loadError) {
      console.error("Erro ao carregar metricas:", loadError)
      setError("Não foi possível carregar as métricas do CRM.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => {
      void loadMetrics()
    }, 0)

    const channel = supabase
      .channel("metrics-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads_lancamento" },
        () => {
          void loadMetrics()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kanban_stages" },
        () => {
          void loadMetrics()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          void loadMetrics()
        }
      )
      .subscribe()

    return () => {
      window.clearTimeout(initialLoadId)
      void supabase.removeChannel(channel)
    }
  }, [loadMetrics])

  const metrics = useMemo(() => {
    const qualifiedLeads = leads.filter((lead) => lead.status_conversa === "qualificado")
    const poolLeads = qualifiedLeads.filter((lead) => !lead.corretor_id && !lead.arquivado)
    const assignedLeads = leads.filter((lead) => lead.corretor_id && !lead.arquivado)
    const archivedLeads = leads.filter((lead) => lead.arquivado)
    const firstStageId = stages[0]?.id ?? null

    const leadsByStage = stages.map((stage) => ({
      id: stage.id,
      nome: stage.nome,
      total: assignedLeads.filter((lead) => (lead.stage_id ?? firstStageId) === stage.id).length,
      cor: stage.cor,
    }))

    const assignedByBroker = countBy(assignedLeads.map((lead) => lead.corretor_id!).filter(Boolean))
    const leadsByBroker = brokers.map((broker) => ({
      id: broker.id,
      nome: broker.nome || broker.email || "Corretor sem nome",
      total: assignedByBroker[broker.id] ?? 0,
    }))
    const maxStageCount = Math.max(...stages.map((stage) => assignedLeads.filter((lead) => (lead.stage_id ?? firstStageId) === stage.id).length), 1)

    return {
      totalQualified: qualifiedLeads.length,
      pool: poolLeads.length,
      assigned: assignedLeads.length,
      archived: archivedLeads.length,
      leadsByStage,
      leadsByBroker,
      recentLeads: leads.slice(0, 6),
      stageFallbackUsed: !stages.length,
      conversionRate: qualifiedLeads.length ? Math.round((assignedLeads.length / qualifiedLeads.length) * 100) : 0,
      archiveRate: leads.length ? Math.round((archivedLeads.length / leads.length) * 100) : 0,
      stageWave: leadsByStage.map((stage) => stage.total || Math.max(1, Math.round(maxStageCount * 0.18))),
    }
  }, [brokers, leads, stages])

  if (!isAdmin) {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Métricas</h1>
        <p className="text-sm text-muted-foreground">
          Somente administradores podem acessar este dashboard.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageIntro
        badge="Visao executiva"
        title="Métricas do CRM"
        description="Panorama em tempo real do funil comercial, distribuição de leads e produtividade do time."
        aside={
          <div className="grid grid-cols-2 gap-3 rounded-3xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
            <div>
              <p className="text-xs uppercase tracking-[0.18em]">Leads mapeados</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{leads.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em]">Corretores ativos</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{brokers.length}</p>
            </div>
          </div>
        }
      />

      {error ? <StatePanel tone="error" centered={false}>{error}</StatePanel> : null}

      {loading ? <MetricSkeleton /> : null}

      {!loading ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Leads qualificados",
                value: metrics.totalQualified,
                icon: Activity,
                accent: "text-sky-600 dark:text-sky-300",
              },
              {
                label: "Leads no pool",
                value: metrics.pool,
                icon: Users,
                accent: "text-amber-600 dark:text-amber-300",
              },
              {
                label: "Leads atribuídos",
                value: metrics.assigned,
                icon: BriefcaseBusiness,
                accent: "text-emerald-600 dark:text-emerald-300",
              },
              {
                label: "Leads arquivados",
                value: metrics.archived,
                icon: Archive,
                accent: "text-violet-600 dark:text-violet-300",
              },
            ].map((item) => (
              <StatCard
                key={item.label}
                label={item.label}
                value={item.value}
                icon={item.icon}
                accentClassName={item.accent}
                helperText="Atualizado automaticamente conforme novas movimentações entram no Supabase."
              />
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <ChartPanel
              title="Pulso do funil"
              description="Leitura visual da distribuição atual por etapa, em uma curva compacta para bater o olho."
            >
              <div className="rounded-3xl border border-border/60 bg-background/70 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                  Etapas ativas do kanban
                </div>
                <MiniAreaChart values={metrics.stageWave} />
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {metrics.leadsByStage.map((stage) => (
                    <div
                      key={stage.id}
                      className="rounded-2xl border border-border/60 bg-card/90 px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: stage.cor || "var(--color-chart-1)" }}
                        />
                        <p className="truncate text-sm font-medium text-foreground">{stage.nome}</p>
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{stage.total}</p>
                    </div>
                  ))}
                </div>
              </div>
            </ChartPanel>

            <ChartPanel
              title="Saúde operacional"
              description="Dois indicadores visuais para entender velocidade de atribuição e peso de arquivamento."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <DonutChart
                  value={metrics.assigned}
                  total={Math.max(metrics.totalQualified, metrics.assigned)}
                  label="Leads atribuídos sobre os qualificados"
                  tone="var(--color-chart-3)"
                />
                <DonutChart
                  value={metrics.archived}
                  total={Math.max(leads.length, metrics.archived)}
                  label="Leads arquivados sobre a base total"
                  tone="var(--color-chart-5)"
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Conversao para carteira</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{metrics.conversionRate}%</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Percentual de leads qualificados que já estão com corretor.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Taxa de arquivo</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{metrics.archiveRate}%</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Fatia da base que ja saiu do quadro ativo.
                  </p>
                </div>
              </div>
            </ChartPanel>
          </section>

          <section className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <ChartPanel
                title="Leads por etapa"
                description="Leads atribuídos e não arquivados agrupados pelas etapas atuais do kanban."
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Layers3 className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                    Distribuição atual do quadro
                  </div>
                  {metrics.leadsByStage.length === 0 ? (
                    <StatePanel dashed>
                      Nenhuma etapa cadastrada em <code>kanban_stages</code>.
                    </StatePanel>
                  ) : (
                    metrics.leadsByStage.map((stage) => {
                      const maxCount = Math.max(1, ...metrics.leadsByStage.map((item) => item.total))
                      const width = `${Math.max(8, (stage.total / maxCount) * 100)}%`

                      return (
                        <div key={stage.id} className="space-y-2">
                          <div className="flex items-center justify-between gap-4 text-sm">
                            <div className="flex items-center gap-2 text-foreground">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: stage.cor || "#38bdf8" }}
                              />
                              <span>{stage.nome}</span>
                            </div>
                            <span className="text-muted-foreground">{stage.total}</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-muted/60">
                            <div
                              className="h-2.5 rounded-full"
                              style={{ width, backgroundColor: stage.cor || "#38bdf8" }}
                            />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </ChartPanel>
            </div>

            <div className="xl:col-span-5">
              <ChartPanel
                title="Leads por corretor"
                description="Distribuição atual de leads ativos já atribuídos."
              >
                <div className="space-y-3">
                  {metrics.leadsByBroker.length === 0 ? (
                    <StatePanel dashed>Nenhum corretor ativo encontrado.</StatePanel>
                  ) : (
                    metrics.leadsByBroker.map((broker) => {
                      const maxBrokerCount = Math.max(1, ...metrics.leadsByBroker.map((item) => item.total))
                      const width = `${Math.max(10, (broker.total / maxBrokerCount) * 100)}%`

                      return (
                        <div
                          key={broker.id}
                          className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-medium text-foreground">{broker.nome}</span>
                            <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-sm text-muted-foreground">
                              {broker.total}
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-muted/60">
                            <div
                              className="h-2.5 rounded-full bg-[linear-gradient(90deg,var(--color-chart-2),var(--color-chart-1))]"
                              style={{ width }}
                            />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </ChartPanel>
            </div>
          </section>

          <section>
            <Card className="rounded-3xl border border-border/60 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">Ultimos leads recebidos</CardTitle>
                <CardDescription>
                  Entradas mais recentes da tabela <code>leads_lancamento</code>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {metrics.recentLeads.length === 0 ? (
                  <StatePanel dashed>Nenhum lead encontrado ainda.</StatePanel>
                ) : (
                  metrics.recentLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="rounded-2xl border border-border/60 bg-background/60 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{leadDisplayName(lead)}</p>
                          <p className="text-sm text-muted-foreground">
                            {lead.email || lead.telefone_contato || "Sem contato principal"}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(lead.created_at)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground">
                          {lead.status_conversa}
                        </span>
                        <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground">
                          {lead.corretor_id ? "Atribuído" : "No pool"}
                        </span>
                        {lead.arquivado ? (
                          <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs text-violet-700 dark:text-violet-300">
                            Arquivado
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  )
}

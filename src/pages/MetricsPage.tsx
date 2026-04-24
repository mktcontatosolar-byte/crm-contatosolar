import { useCallback, useEffect, useMemo, useState } from "react"
import { Archive, CheckCircle2, Clock3, Funnel, Users } from "lucide-react"

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
  | "first_response_at"
  | "origem"
>

type BrokerSummary = Pick<Profile, "id" | "nome" | "email">

function leadDisplayName(lead: MetricsLead) {
  return lead.nome_completo || lead.email || lead.telefone_contato || "Lead sem identificação"
}

void leadDisplayName

function minutesBetween(start: string, end: string) {
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60))
}

function formatAverageResponse(minutes: number | null) {
  if (minutes === null) {
    return "Sem dados"
  }

  if (minutes < 60) {
    return `${Math.round(minutes)} min`
  }

  const hours = minutes / 60
  if (hours < 24) {
    return `${hours.toFixed(1)} h`
  }

  return `${(hours / 24).toFixed(1)} d`
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
    <Card className="rounded-3xl border border-border/60 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
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
          .select(
            "id,nome_completo,email,telefone_contato,status_conversa,corretor_id,stage_id,arquivado,created_at,first_response_at,origem"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("kanban_stages")
          .select("id,nome,ordem,cor,is_final")
          .order("ordem", { ascending: true }),
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
      console.error("Erro ao carregar métricas:", loadError)
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
    const activeLeads = leads.filter((lead) => !lead.arquivado)
    const poolLeads = activeLeads.filter((lead) => !lead.corretor_id)
    const archivedLeads = leads.filter((lead) => lead.arquivado)
    const firstStageId = stages[0]?.id ?? null
    const closedStage = stages.find((stage) => stage.nome.toLowerCase() === "fechado") ?? null
    const closedLeadIds = new Set(
      leads
        .filter((lead) => !lead.arquivado && closedStage && (lead.stage_id ?? firstStageId) === closedStage.id)
        .map((lead) => lead.id)
    )

    const leadsByStage = stages.map((stage) => {
      const total = activeLeads.filter((lead) => (lead.stage_id ?? firstStageId) === stage.id).length
      return {
        id: stage.id,
        nome: stage.nome,
        total,
        cor: stage.cor,
      }
    })

    const maxStageCount = Math.max(1, ...leadsByStage.map((stage) => stage.total))

    const topBrokers = brokers
      .map((broker) => {
        const brokerLeads = activeLeads.filter((lead) => lead.corretor_id === broker.id)
        const brokerClosed = brokerLeads.filter((lead) => closedLeadIds.has(lead.id)).length

        return {
          id: broker.id,
          nome: broker.nome || broker.email || "Corretor sem nome",
          activeCount: brokerLeads.length,
          closedCount: brokerClosed,
        }
      })
      .sort((left, right) => {
        if (right.activeCount !== left.activeCount) {
          return right.activeCount - left.activeCount
        }

        return right.closedCount - left.closedCount
      })
      .slice(0, 5)

    const originLabels = ["instagram", "facebook", "google", "direto"] as const
    const originMap = new Map<string, number>(
      originLabels.map((label) => [label, 0])
    )
    let otherOrigins = 0

    leads.forEach((lead) => {
      const normalizedOrigin = (lead.origem || "").trim().toLowerCase()
      if (!normalizedOrigin) {
        return
      }

      if (originMap.has(normalizedOrigin)) {
        originMap.set(normalizedOrigin, (originMap.get(normalizedOrigin) ?? 0) + 1)
      } else {
        otherOrigins += 1
      }
    })

    const leadsByOrigin = [
      ...originLabels.map((label) => ({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        total: originMap.get(label) ?? 0,
      })),
      { label: "Outros", total: otherOrigins },
    ]

    const maxOriginCount = Math.max(1, ...leadsByOrigin.map((origin) => origin.total))

    const responseSamples = leads
      .filter((lead) => lead.created_at && lead.first_response_at)
      .map((lead) => minutesBetween(lead.created_at, lead.first_response_at))
      .filter((value) => Number.isFinite(value))

    const averageResponseTime =
      responseSamples.length > 0
        ? responseSamples.reduce((sum, value) => sum + value, 0) / responseSamples.length
        : null

    return {
      totals: {
        active: activeLeads.length,
        pool: poolLeads.length,
        archived: archivedLeads.length,
        closed: closedLeadIds.size,
      },
      conversionRate: leads.length > 0 ? Math.round((closedLeadIds.size / leads.length) * 100) : 0,
      averageResponseTime,
      leadsByStage,
      maxStageCount,
      topBrokers,
      leadsByOrigin,
      maxOriginCount,
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
        badge="Visão executiva"
        title="Métricas do CRM"
        description="Os números mais úteis para decisão comercial, sem excesso de informação."
        aside={
          <div className="grid grid-cols-2 gap-3 rounded-3xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
            <div>
              <p className="text-xs uppercase tracking-[0.18em]">Leads totais</p>
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
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Leads ativos no funil"
              value={metrics.totals.active}
              icon={Funnel}
              accentClassName="text-sky-600 dark:text-sky-300"
            />
            <StatCard
              label="Leads no pool"
              value={metrics.totals.pool}
              icon={Users}
              accentClassName="text-amber-600 dark:text-amber-300"
            />
            <StatCard
              label="Leads arquivados"
              value={metrics.totals.archived}
              icon={Archive}
              accentClassName="text-violet-600 dark:text-violet-300"
            />
            <StatCard
              label="Taxa de conversão"
              value={`${metrics.conversionRate}%`}
              icon={CheckCircle2}
              accentClassName="text-emerald-600 dark:text-emerald-300"
            />
            <StatCard
              label="Tempo médio de resposta"
              value={formatAverageResponse(metrics.averageResponseTime)}
              icon={Clock3}
              accentClassName="text-orange-600 dark:text-orange-300"
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <ChartPanel
              title="Leads por etapa do Kanban"
              description="Distribuição atual do funil com barras proporcionais para leitura rápida."
            >
              <div className="space-y-4">
                {metrics.leadsByStage.length === 0 ? (
                  <StatePanel dashed>Nenhuma etapa cadastrada em <code>kanban_stages</code>.</StatePanel>
                ) : (
                  metrics.leadsByStage.map((stage) => (
                    <div key={stage.id} className="space-y-2">
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-2 text-foreground">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: stage.cor || "#f97316" }}
                          />
                          <span>{stage.nome}</span>
                        </div>
                        <span className="font-medium text-muted-foreground">{stage.total}</span>
                      </div>
                      <div className="h-3 rounded-full bg-muted/60">
                        <div
                          className="h-3 rounded-full"
                          style={{
                            width: `${Math.max(8, (stage.total / metrics.maxStageCount) * 100)}%`,
                            backgroundColor: stage.cor || "#f97316",
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ChartPanel>

            <ChartPanel
              title="Leads por origem"
              description="Comparativo simples dos canais que mais trazem oportunidades."
            >
              <div className="space-y-4">
                {metrics.leadsByOrigin.map((origin) => (
                  <div key={origin.label} className="space-y-2">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-foreground">{origin.label}</span>
                      <span className="font-medium text-muted-foreground">{origin.total}</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted/60">
                      <div
                        className="h-3 rounded-full bg-[linear-gradient(90deg,var(--color-chart-2),var(--color-chart-1))]"
                        style={{
                          width: `${Math.max(8, (origin.total / metrics.maxOriginCount) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ChartPanel>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <ChartPanel
              title="Top corretores"
              description="Quem está concentrando mais leads ativos e quem mais leva leads até Fechado."
            >
              <div className="space-y-3">
                {metrics.topBrokers.length === 0 ? (
                  <StatePanel dashed>Nenhum corretor ativo encontrado.</StatePanel>
                ) : (
                  metrics.topBrokers.map((broker) => (
                    <div
                      key={broker.id}
                      className="rounded-2xl border border-border/60 bg-background/60 px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="truncate font-medium text-foreground">{broker.nome}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full border border-border/60 bg-card px-3 py-1">
                            Ativos: {broker.activeCount}
                          </span>
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-700 dark:text-emerald-300">
                            Fechados: {broker.closedCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ChartPanel>

            <ChartPanel
              title="Resumo comercial"
              description="Os números essenciais para decidir alocação de esforço do time."
            >
              <div className="grid gap-3">
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Leads fechados</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{metrics.totals.closed}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Quantidade atual de leads que chegaram à etapa <strong>Fechado</strong>.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Fila sem corretor</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{metrics.totals.pool}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Leads aguardando distribuição imediata no Pool.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tempo médio de resposta</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">
                    {formatAverageResponse(metrics.averageResponseTime)}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Calculado entre criação do lead e primeiro registro em <code>first_response_at</code>.
                  </p>
                </div>
              </div>
            </ChartPanel>
          </section>
        </>
      ) : null}
    </div>
  )
}

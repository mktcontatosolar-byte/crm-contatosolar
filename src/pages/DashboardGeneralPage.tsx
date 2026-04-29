import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  BriefcaseBusiness,
  CircleDollarSign,
  Eye,
  EyeOff,
  HandCoins,
  ShieldCheck,
  TrendingUp,
} from "lucide-react"

import MetricGrid from "@/components/crm/MetricGrid"
import PageIntro from "@/components/crm/PageIntro"
import SectionCard from "@/components/crm/SectionCard"
import StatePanel from "@/components/crm/StatePanel"
import StatCard from "@/components/crm/StatCard"
import StatusBadge from "@/components/crm/StatusBadge"
import BarList from "@/components/projects/BarList"
import MaskedValue from "@/components/projects/MaskedValue"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/useAuth"
import {
  buildCategoryTotals,
  buildDashboardSummary,
  buildSafeCategoryTotals,
  buildSafeDashboardSummary,
  buildSafeProjectRanking,
  buildProjectRanking,
  fetchDashboardSafeProjects,
  fetchProjectAnalytics,
  fetchProjectsStatusSummary,
  getProjectSellerName,
  mapProjectStatusSummary,
  toSafeNumber,
} from "@/lib/projects"
import { canViewSensitiveProjectData } from "@/lib/permissions"
import type { ProjectRow, ProjectSafeRow } from "@/types/projects"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Sem data"
  }

  const [year, month, day] = value.split("-")
  if (!year || !month || !day) {
    return value
  }

  return `${day}/${month}/${year}`
}

function safeProjectLabel(cliente: string | null, id: string, canViewSensitive: boolean) {
  if (!canViewSensitive) {
    return `Projeto ${id.slice(0, 8)}`
  }

  return cliente || `Projeto ${id.slice(0, 8)}`
}

function statusPills(project: Pick<ProjectRow, "pago" | "fechado" | "instalado">) {
  return [
    { label: "Pago", active: project.pago },
    { label: "Fechado", active: project.fechado },
    { label: "Instalado", active: project.instalado },
  ]
}

function safeStatusPills(project: Pick<ProjectSafeRow, "pago" | "fechado" | "instalado">) {
  return [
    { label: "Pago", active: project.pago },
    { label: "Fechado", active: project.fechado },
    { label: "Instalado", active: project.instalado },
  ]
}

type SellerInsight = {
  vendedor: string
  quantidade: number
  valorTotal?: number
  lucroTotal?: number
  margemMedia?: number
}

type SellerProjectRow =
  | {
      id: string
      cliente: string | null
      data: string | null
      cidade: string | null
      valor: number | null
      pago: boolean
      fechado: boolean
      instalado: boolean
      restricted: false
    }
  | {
      id: string
      cliente: null
      data: string | null
      cidade: string | null
      valor: null
      pago: boolean
      fechado: boolean
      instalado: boolean
      restricted: true
    }

function SellerPerformanceCard({
  description,
  sellers,
  canSeeSensitive,
  privacyMode,
  onSelectSeller,
  selectedSeller,
}: {
  description: string
  sellers: SellerInsight[]
  canSeeSensitive: boolean
  privacyMode: boolean
  onSelectSeller: (seller: string) => void
  selectedSeller: string | null
}) {
  const topCount = Math.max(1, sellers[0]?.quantidade ?? 0)

  return (
    <SectionCard
      title="Performance por vendedor"
      description={description}
      actions={<StatusBadge tone="accent">Ranking principal</StatusBadge>}
      className="overflow-hidden bg-card/96"
      contentClassName="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_320px]"
      tone="highlight"
    >
        <div className="space-y-3">
          {sellers.length === 0 ? (
            <StatePanel dashed>Nenhum vendedor com projetos para exibir.</StatePanel>
          ) : (
            sellers.map((seller, index) => {
              const progress = (seller.quantidade / topCount) * 100
              const isActive = selectedSeller === seller.vendedor

              return (
                <button
                  key={seller.vendedor}
                  type="button"
                  onClick={() => onSelectSeller(seller.vendedor)}
                  className={`w-full rounded-[1.75rem] border p-4 text-left transition hover:border-primary/30 hover:bg-background/80 ${
                    isActive
                      ? "border-primary/35 bg-primary/[0.07] shadow-sm"
                      : "border-border/60 bg-background/60"
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {index === 0 ? "Melhor desempenho" : `Posição ${index + 1}`}
                      </p>
                      <p className="mt-1 truncate text-lg font-semibold text-foreground">{seller.vendedor}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 text-sm">
                      <StatusBadge tone={index === 0 ? "accent" : "muted"}>
                        {seller.quantidade} projeto(s)
                      </StatusBadge>
                      {typeof seller.valorTotal === "number" ? (
                        <StatusBadge tone="muted">
                          <MaskedValue
                            value={formatCurrency(seller.valorTotal)}
                            masked={!canSeeSensitive || privacyMode}
                            blurOnly={canSeeSensitive && privacyMode}
                            placeholder="Privado"
                          />
                        </StatusBadge>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 h-3 rounded-full bg-muted/60">
                    <div
                      className="h-3 rounded-full bg-[linear-gradient(90deg,var(--color-chart-2),var(--color-chart-1))]"
                      style={{ width: `${Math.max(8, Math.min(progress, 100))}%` }}
                    />
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="rounded-[1.75rem] border border-border/60 bg-background/60 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Leitura executiva</p>
          <div className="mt-4 space-y-4 text-sm text-muted-foreground">
            <p>O topo resume volume, ritmo comercial e prioridades da carteira.</p>
            <p>Clique em qualquer vendedor para abrir a lista de projetos no escopo permitido.</p>
          </div>
        </div>
    </SectionCard>
  )
}

function VisualListCard({
  title,
  description,
  items,
  emptyText,
}: {
  title: string
  description: string
  items: Array<{ label: string; valueLabel: string; progress: number }>
  emptyText: string
}) {
  return (
    <SectionCard title={title} description={description}>
        <BarList items={items} emptyText={emptyText} />
    </SectionCard>
  )
}

function CompactListCard({
  title,
  description,
  items,
  emptyText,
}: {
  title: string
  description: string
  items: Array<{ label: string; value: string; tone?: string }>
  emptyText: string
}) {
  return (
    <SectionCard title={title} description={description}>
        {items.length === 0 ? (
          <StatePanel dashed>{emptyText}</StatePanel>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={`${item.label}-${item.value}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-3"
              >
                <span className="truncate text-sm text-foreground">{item.label}</span>
                <span className={`shrink-0 text-sm font-medium ${item.tone ?? "text-muted-foreground"}`}>{item.value}</span>
              </div>
            ))}
          </div>
        )}
    </SectionCard>
  )
}

function ProjectDrawer({
  open,
  onOpenChange,
  seller,
  projects,
  canSeeSensitive,
  privacyMode,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  seller: string | null
  projects: SellerProjectRow[]
  canSeeSensitive: boolean
  privacyMode: boolean
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[96vw] max-w-[720px] gap-0 overflow-y-auto border-border/70 bg-background p-0"
      >
        <SheetHeader className="border-b border-border/60 px-6 py-6 pr-14">
          <SheetTitle className="text-xl">{seller ? `Projetos de ${seller}` : "Projetos do vendedor"}</SheetTitle>
          <SheetDescription>
            Lista detalhada dos projetos exibidos no dashboard, mantendo as permissões já aplicadas ao perfil.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-6">
          {projects.length === 0 ? (
            <StatePanel dashed>Nenhum projeto encontrado para este vendedor.</StatePanel>
          ) : (
            projects.map((project) => {
              const pills = project.restricted ? safeStatusPills(project) : statusPills(project)

              return (
                <div key={project.id} className="rounded-[1.75rem] border border-border/60 bg-card/90 p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-foreground">
                        {project.restricted ? (
                          "Cliente protegido"
                        ) : (
                          <MaskedValue
                            value={safeProjectLabel(project.cliente, project.id, canSeeSensitive)}
                            masked={!canSeeSensitive || privacyMode}
                            blurOnly={canSeeSensitive && privacyMode}
                            placeholder={`Projeto ${project.id.slice(0, 8)}`}
                          />
                        )}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-3 py-1">
                          {formatDate(project.data)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-3 py-1">
                          {project.cidade || "Sem cidade"}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-right">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Valor do projeto</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {project.restricted ? (
                          "Protegido"
                        ) : (
                          <MaskedValue
                            value={formatCurrency(project.valor ?? 0)}
                            masked={!canSeeSensitive || privacyMode}
                            blurOnly={canSeeSensitive && privacyMode}
                            placeholder="Privado"
                          />
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {pills.map((pill) => (
                      <span
                        key={pill.label}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          pill.active
                            ? "crm-status-active"
                            : "border-border/60 bg-background/70 text-muted-foreground"
                        }`}
                      >
                        {pill.label}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function buildVisualItems(
  items: Array<{ label: string; valueLabel: string; metric: number }>,
  minimum = 8
) {
  const maxMetric = Math.max(1, ...items.map((item) => item.metric))

  return items.map((item) => ({
    label: item.label,
    valueLabel: item.valueLabel,
    progress: Math.max(minimum, (item.metric / maxMetric) * 100),
  }))
}

export default function DashboardGeneralPage() {
  const { profile, user } = useAuth()
  const canSeeSensitive = canViewSensitiveProjectData(profile?.role)
  const [privacyMode, setPrivacyMode] = useState(() => window.localStorage.getItem("dashboard-general-privacy") === "true")
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!canSeeSensitive) {
      return
    }

    window.localStorage.setItem("dashboard-general-privacy", String(privacyMode))
  }, [canSeeSensitive, privacyMode])

  const analyticsQuery = useQuery({
    queryKey: ["project-dashboard-general", profile?.role, user?.id],
    queryFn: () => fetchProjectAnalytics({ role: profile?.role, userId: user?.id }),
    enabled: Boolean(profile?.role && user?.id && canSeeSensitive),
  })

  const safeProjectsQuery = useQuery({
    queryKey: ["project-dashboard-general-safe", profile?.role, user?.id],
    queryFn: fetchDashboardSafeProjects,
    enabled: Boolean(profile?.role && user?.id && !canSeeSensitive),
  })

  const statusSummaryQuery = useQuery({
    queryKey: ["project-dashboard-general-status", profile?.role, user?.id],
    queryFn: fetchProjectsStatusSummary,
    enabled: Boolean(profile?.role && user?.id && !canSeeSensitive),
  })

  const projects = useMemo(() => analyticsQuery.data ?? [], [analyticsQuery.data])
  const safeProjects = useMemo(() => safeProjectsQuery.data ?? [], [safeProjectsQuery.data])
  const summary = useMemo(
    () => (canSeeSensitive ? buildDashboardSummary(projects) : buildSafeDashboardSummary(safeProjects)),
    [canSeeSensitive, projects, safeProjects]
  )
  const detailedSellerTotals = useMemo(() => buildProjectRanking(projects), [projects])
  const sellerTotals = useMemo(
    () => (canSeeSensitive ? detailedSellerTotals : buildSafeProjectRanking(safeProjects)),
    [canSeeSensitive, detailedSellerTotals, safeProjects]
  )
  const brandTotals = useMemo(
    () => (canSeeSensitive ? buildCategoryTotals(projects, "marca") : buildSafeCategoryTotals(safeProjects, "marca")),
    [canSeeSensitive, projects, safeProjects]
  )
  const paymentTotals = useMemo(
    () =>
      canSeeSensitive
        ? buildCategoryTotals(projects, "forma_pagamento")
        : buildSafeCategoryTotals(safeProjects, "forma_pagamento"),
    [canSeeSensitive, projects, safeProjects]
  )
  const cityTotals = useMemo(
    () => (canSeeSensitive ? buildCategoryTotals(projects, "cidade") : buildSafeCategoryTotals(safeProjects, "cidade")),
    [canSeeSensitive, projects, safeProjects]
  )
  const statusTotals = useMemo(
    () =>
      canSeeSensitive
        ? mapProjectStatusSummary([
            { status: "pagos", quantidade: summary.projetosPagos },
            { status: "nao_pagos", quantidade: summary.quantidadeProjetos - summary.projetosPagos },
            { status: "fechados", quantidade: summary.projetosFechados },
            { status: "nao_fechados", quantidade: summary.quantidadeProjetos - summary.projetosFechados },
            { status: "instalados", quantidade: summary.projetosInstalados },
            { status: "nao_instalados", quantidade: summary.quantidadeProjetos - summary.projetosInstalados },
            { status: "entregues", quantidade: summary.projetosEntregues },
            { status: "parecer_aprovado", quantidade: summary.projetosParecerAprovado },
          ])
        : mapProjectStatusSummary(statusSummaryQuery.data ?? []),
    [canSeeSensitive, statusSummaryQuery.data, summary]
  )
  const paidSellerTotals = useMemo(() => {
    if (canSeeSensitive) {
      const grouped = new Map<string, { vendedor: string; quantidade: number }>()

      projects
        .filter((project) => project.pago)
        .forEach((project) => {
          const vendedor = getProjectSellerName(project)
          const key = project.vendedor_id ?? vendedor
          const current = grouped.get(key) ?? { vendedor, quantidade: 0 }
          current.quantidade += 1
          grouped.set(key, current)
        })

      return Array.from(grouped.values()).sort((left, right) => right.quantidade - left.quantidade)
    }

    const grouped = new Map<string, { vendedor: string; quantidade: number }>()

    safeProjects
      .filter((project) => project.pago)
      .forEach((project) => {
        const vendedor = project.vendedor?.trim() || "Sem vendedor"
        const key = project.vendedor_id ?? vendedor
        const current = grouped.get(key) ?? { vendedor, quantidade: 0 }
        current.quantidade += 1
        grouped.set(key, current)
      })

    return Array.from(grouped.values()).sort((left, right) => right.quantidade - left.quantidade)
  }, [canSeeSensitive, projects, safeProjects])

  const recentProjects = useMemo(
    () => [...projects].sort((left, right) => (right.created_at || "").localeCompare(left.created_at || "")).slice(0, 5),
    [projects]
  )
  const safeRecentProjects = useMemo(
    () => [...safeProjects].sort((left, right) => (right.created_at || "").localeCompare(left.created_at || "")).slice(0, 5),
    [safeProjects]
  )
  const riskProjects = useMemo(
    () => projects.filter((project) => (project.pago && !project.instalado) || (project.fechado && !project.pago)).slice(0, 6),
    [projects]
  )
  const safeRiskProjects = useMemo(() => safeProjects.filter((project) => project.pago && !project.instalado).slice(0, 6), [safeProjects])

  const effectivePrivacyMode = canSeeSensitive && privacyMode
  const activeQuery = canSeeSensitive ? analyticsQuery : safeProjectsQuery
  const hasError = activeQuery.isError || statusSummaryQuery.isError
  const errorMessage =
    activeQuery.error instanceof Error
      ? activeQuery.error.message
      : statusSummaryQuery.error instanceof Error
        ? statusSummaryQuery.error.message
        : "Não foi possível carregar o dashboard geral."
  const isLoading = activeQuery.isLoading || (!canSeeSensitive && statusSummaryQuery.isLoading)

  const selectedSellerProjects = useMemo<SellerProjectRow[]>(() => {
    if (!selectedSeller) {
      return []
    }

    if (canSeeSensitive) {
      return projects
        .filter((project) => getProjectSellerName(project) === selectedSeller)
        .sort((left, right) => (right.data || "").localeCompare(left.data || ""))
        .map((project) => ({
          id: project.id,
          cliente: project.cliente,
          data: project.data,
          cidade: project.cidade,
          valor: project.valor_projeto,
          pago: project.pago,
          fechado: project.fechado,
          instalado: project.instalado,
          restricted: false as const,
        }))
    }

    return safeProjects
      .filter((project) => (project.vendedor?.trim() || "Sem vendedor") === selectedSeller)
      .sort((left, right) => (right.data || "").localeCompare(left.data || ""))
      .map((project) => ({
        id: project.id,
        cliente: null,
        data: project.data,
        cidade: project.cidade,
        valor: null,
        pago: project.pago,
        fechado: project.fechado,
        instalado: project.instalado,
        restricted: true as const,
      }))
  }, [canSeeSensitive, projects, safeProjects, selectedSeller])

  function handleSellerClick(seller: string) {
    setSelectedSeller(seller)
    setDrawerOpen(true)
  }

  function handleDrawerOpenChange(open: boolean) {
    setDrawerOpen(open)

    if (!open) {
      setSelectedSeller(null)
    }
  }

  const activeSeller = sellerTotals.some((item) => item.vendedor === selectedSeller) ? selectedSeller : null

  const sellerRevenueItems = buildVisualItems(
    detailedSellerTotals.slice(0, 6).map((item) => ({
      label: item.vendedor,
      valueLabel: effectivePrivacyMode ? "Privado" : formatCurrency(item.valorTotal),
      metric: item.valorTotal,
    }))
  )

  const sellerPaidItems = buildVisualItems(
    paidSellerTotals.slice(0, 6).map((item) => ({
      label: item.vendedor,
      valueLabel: `${item.quantidade} projeto(s)`,
      metric: item.quantidade,
    }))
  )

  const brandItems = buildVisualItems(
    brandTotals.slice(0, 6).map((item) => ({
      label: item.label,
      valueLabel: canSeeSensitive && !effectivePrivacyMode
        ? `${item.quantidade} • ${formatCurrency(item.total)}`
        : `${item.quantidade} projeto(s)`,
      metric: canSeeSensitive ? Math.max(item.quantidade, item.total) : item.quantidade,
    }))
  )

  const cityItems = buildVisualItems(
    cityTotals.slice(0, 6).map((item) => ({
      label: item.label,
      valueLabel: `${item.quantidade} projeto(s)`,
      metric: item.quantidade,
    }))
  )

  const paymentItems = buildVisualItems(
    paymentTotals.slice(0, 6).map((item) => ({
      label: item.label,
      valueLabel: `${item.quantidade} projeto(s)`,
      metric: item.quantidade,
    }))
  )

  const operationItems = buildVisualItems(
    statusTotals.slice(0, 6).map((item) => ({
      label: item.label,
      valueLabel: `${item.valor}`,
      metric: item.valor,
    }))
  )

  const recentItems = (canSeeSensitive ? recentProjects : safeRecentProjects).map((project) => ({
    label: canSeeSensitive
      ? safeProjectLabel((project as ProjectRow).cliente ?? null, project.id, canSeeSensitive)
      : `Projeto ${project.id.slice(0, 8)}`,
    value: `${formatDate(project.data)} • ${project.cidade || "Sem cidade"}`,
  }))

  const watchlistItems = (canSeeSensitive ? riskProjects : safeRiskProjects).map((project) => ({
    label: canSeeSensitive
      ? safeProjectLabel((project as ProjectRow).cliente ?? null, project.id, canSeeSensitive)
      : `Projeto ${project.id.slice(0, 8)}`,
    value: canSeeSensitive
      ? project.pago && !project.instalado
        ? "Pago e não instalado"
        : "Fechado e não pago"
      : "Pago e não instalado",
  }))

  const financeItems = canSeeSensitive
    ? [
        { label: "Equipamentos", value: effectivePrivacyMode ? "Privado" : formatCurrency(summary.valorEquipamentos) },
        { label: "Serviços", value: effectivePrivacyMode ? "Privado" : formatCurrency(summary.valorServico) },
        { label: "Instalação", value: effectivePrivacyMode ? "Privado" : formatCurrency(summary.custoInstalacao) },
        { label: "Margem média", value: effectivePrivacyMode ? "Privado" : `${summary.margemMedia.toFixed(1)}%` },
      ]
    : [
        { label: "Projetos entregues", value: `${summary.projetosEntregues}` },
        { label: "Parecer aprovado", value: `${summary.projetosParecerAprovado}` },
        { label: "Total de módulos", value: `${summary.totalModulos}` },
        { label: "Microinversores", value: `${summary.totalMicroinversores}` },
      ]

  const averageProjectValue =
    summary.quantidadeProjetos > 0 ? Math.round(summary.faturamentoTotal / summary.quantidadeProjetos) : 0

  return (
    <div className="space-y-8">
      <PageIntro
        badge="Visão executiva"
        badgeTone="sky"
        title="Dashboard Geral"
        description="Leitura consolidada dos projetos com foco em ritmo comercial, distribuição e decisões rápidas."
        aside={
          <div className="flex min-w-[260px] flex-col gap-3 rounded-[1.75rem] border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
            <div>
              <p className="text-xs uppercase tracking-[0.18em]">Projetos analisados</p>
              <p className="mt-1 text-3xl font-semibold text-foreground">{canSeeSensitive ? projects.length : safeProjects.length}</p>
            </div>
            {canSeeSensitive ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setPrivacyMode((current) => !current)}
              >
                {effectivePrivacyMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {effectivePrivacyMode ? "Desativar privacidade" : "Ativar privacidade"}
              </Button>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-2 text-xs uppercase tracking-[0.16em] text-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Visão protegida
              </div>
            )}
          </div>
        }
      />

      {hasError ? (
        <StatePanel tone="error" centered={false}>
          {errorMessage}
        </StatePanel>
      ) : null}

      {isLoading ? <StatePanel>Carregando indicadores...</StatePanel> : null}

      {!isLoading ? (
        <>
          <MetricGrid>
            <StatCard
              label={canSeeSensitive ? "Faturamento total" : "Quantidade de projetos"}
              value={
                canSeeSensitive ? (
                  <MaskedValue
                    value={formatCurrency(summary.faturamentoTotal)}
                    masked={effectivePrivacyMode}
                    blurOnly={effectivePrivacyMode}
                  />
                ) : (
                  summary.quantidadeProjetos
                )
              }
              icon={CircleDollarSign}
              accentClassName="text-primary"
            />
            <StatCard
              label={canSeeSensitive ? "Projetos pagos" : "Projetos pagos"}
              value={summary.projetosPagos}
              icon={BriefcaseBusiness}
              accentClassName="text-primary"
            />
            <StatCard
              label={canSeeSensitive ? "Ticket médio" : "Projetos fechados"}
              value={
                canSeeSensitive ? (
                  <MaskedValue
                    value={formatCurrency(averageProjectValue)}
                    masked={effectivePrivacyMode}
                    blurOnly={effectivePrivacyMode}
                  />
                ) : (
                  summary.projetosFechados
                )
              }
              icon={TrendingUp}
              accentClassName="text-primary"
            />
            <StatCard
              label={canSeeSensitive ? "Lucro total" : "Projetos instalados"}
              value={
                canSeeSensitive ? (
                  <MaskedValue
                    value={formatCurrency(summary.lucroTotal)}
                    masked={effectivePrivacyMode}
                    blurOnly={effectivePrivacyMode}
                  />
                ) : (
                  summary.projetosInstalados
                )
              }
              icon={HandCoins}
              accentClassName="text-accent"
            />
          </MetricGrid>

          <SellerPerformanceCard
            description={
              canSeeSensitive
                ? "Ranking principal unificando volume e impacto comercial."
                : "Ranking principal por volume de projetos na visão protegida do seu perfil."
            }
            sellers={sellerTotals.slice(0, 8)}
            canSeeSensitive={canSeeSensitive}
            privacyMode={effectivePrivacyMode}
            onSelectSeller={handleSellerClick}
            selectedSeller={selectedSeller}
          />

          <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {canSeeSensitive ? (
              <VisualListCard
                title="Faturamento por vendedor"
                description="Volume financeiro entre os principais vendedores."
                items={sellerRevenueItems}
                emptyText="Sem faturamento por vendedor."
              />
            ) : null}
              <VisualListCard
                title="Projetos pagos por vendedor"
                description="Quem mais converteu em projetos pagos."
              items={sellerPaidItems}
              emptyText="Nenhum projeto pago encontrado."
            />
            <VisualListCard
              title="Vendas por marca"
                description="Onde a carteira está mais concentrada."
              items={brandItems}
              emptyText="Nenhuma marca informada."
            />
            <VisualListCard
                title="Distribuição por cidade"
                description="Praças com maior concentração de projetos."
              items={cityItems}
              emptyText="Nenhuma cidade informada."
            />
            <VisualListCard
              title="Forma de pagamento"
              description="Mix operacional do fechamento comercial."
              items={paymentItems}
              emptyText="Nenhuma forma de pagamento informada."
            />
            <VisualListCard
                title="Operação"
                description="Pulso do funil entre pagos, fechados e instalação."
              items={operationItems}
              emptyText="Sem status disponíveis."
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <CompactListCard
              title="Projetos recentes"
                description="Últimos registros que entraram na base."
              items={recentItems}
              emptyText="Nenhum projeto recente encontrado."
            />
            <Card className="rounded-[1.75rem] border border-border/60 bg-card/92 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Pontos de atenção</CardTitle>
                <CardDescription>Itens que merecem acompanhamento mais próximo.</CardDescription>
              </CardHeader>
              <CardContent>
                {watchlistItems.length === 0 ? (
                  <StatePanel dashed>Nenhum alerta operacional no momento.</StatePanel>
                ) : (
                  <div className="space-y-3">
                    {watchlistItems.map((item) => (
                      <div
                        key={`${item.label}-${item.value}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{item.value}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <CompactListCard
              title="Resumo financeiro"
              description={
                canSeeSensitive
                   ? "Indicadores complementares de margem e composição."
                   : "Resumo protegido com indicadores operacionais sem dados sensíveis."
              }
              items={financeItems}
              emptyText="Sem resumo disponível."
            />
            {canSeeSensitive ? (
              <CompactListCard
                title="Rentabilidade por vendedor"
                description="Lucro total e margem média dos principais nomes."
                items={detailedSellerTotals.slice(0, 5).map((item) => ({
                  label: item.vendedor,
                  value: effectivePrivacyMode
                    ? "Privado"
                    : `${formatCurrency(item.lucroTotal)} • ${item.margemMedia.toFixed(1)}%`,
                }))}
                emptyText="Sem dados de rentabilidade."
              />
            ) : (
              <CompactListCard
                title="Camada protegida"
                description="Clientes, valores, lucro e demais dados sensíveis continuam restritos ao perfil dono."
                items={[
                  { label: "Projetos entregues", value: `${summary.projetosEntregues}` },
                  { label: "Parecer aprovado", value: `${summary.projetosParecerAprovado}` },
                  { label: "Total de módulos", value: `${summary.totalModulos}` },
                  { label: "Microinversores", value: `${toSafeNumber(summary.totalMicroinversores)}` },
                ]}
                emptyText="Sem dados protegidos."
              />
            )}
          </section>
        </>
      ) : null}

      <ProjectDrawer
        open={drawerOpen && activeSeller !== null}
        onOpenChange={handleDrawerOpenChange}
        seller={activeSeller}
        projects={activeSeller ? selectedSellerProjects : []}
        canSeeSensitive={canSeeSensitive}
        privacyMode={effectivePrivacyMode}
      />
    </div>
  )
}





import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Crown, Medal, Trophy, Users } from "lucide-react"

import MetricGrid from "@/components/crm/MetricGrid"
import PageIntro from "@/components/crm/PageIntro"
import SectionCard from "@/components/crm/SectionCard"
import StatePanel from "@/components/crm/StatePanel"
import StatCard from "@/components/crm/StatCard"
import StatusBadge from "@/components/crm/StatusBadge"
import BarList from "@/components/projects/BarList"
import MaskedValue from "@/components/projects/MaskedValue"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/useAuth"
import {
  buildCompetitionSummaryFromRanking,
  fetchCompetitionProjectsBySeller,
  fetchCompetitionRanking,
  PROJECT_COMPETITION_END,
  PROJECT_COMPETITION_START,
  toSafeNumber,
} from "@/lib/projects"
import { canViewCompetitionValue, canViewSensitiveProjectData } from "@/lib/permissions"
import type { CompetitionProjectSafeRow, ProjectRow } from "@/types/projects"

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

type SelectedSeller = {
  sellerId: string | null
  sellerName: string
}

type CompetitionProjectDetail = {
  id: string
  cliente: string
  data: string | null
  cidade: string | null
  valorProjeto: number
  pago: boolean
  fechado: boolean
  instalado: boolean
}

function ProjectCompetitionDrawer({
  open,
  onOpenChange,
  seller,
  projects,
  canSeeValues,
  canSeeSensitive,
  isLoading,
  isError,
  errorMessage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  seller: string | null
  projects: CompetitionProjectDetail[]
  canSeeValues: boolean
  canSeeSensitive: boolean
  isLoading: boolean
  isError: boolean
  errorMessage: string
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[96vw] max-w-[760px] gap-0 overflow-y-auto border-border/70 bg-background p-0"
      >
        <SheetHeader className="border-b border-border/60 px-6 py-6 pr-14">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle className="text-xl">
                {seller ? `Projetos de ${seller}` : "Projetos da competição"}
              </SheetTitle>
              <SheetDescription className="mt-2">
                Projetos válidos na competição entre {PROJECT_COMPETITION_START} e {PROJECT_COMPETITION_END}.
              </SheetDescription>
            </div>
            <StatusBadge tone="accent" className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]">
              Pago + ativo
            </StatusBadge>
          </div>
        </SheetHeader>

        <div className="space-y-4 p-6">
          {isLoading ? (
            <StatePanel>Carregando projetos da competição...</StatePanel>
          ) : isError ? (
            <StatePanel tone="error" centered={false}>
              {errorMessage}
            </StatePanel>
          ) : projects.length === 0 ? (
            <StatePanel dashed>Nenhum projeto elegível encontrado para este vendedor.</StatePanel>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className="rounded-[1.75rem] border border-border/60 bg-card/90 p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-foreground">{project.cliente}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <StatusBadge tone="muted">{formatDate(project.data)}</StatusBadge>
                      <StatusBadge tone="muted">{project.cidade || "Sem cidade"}</StatusBadge>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-right">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Valor do projeto
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {canSeeValues ? (
                        <MaskedValue
                          value={formatCurrency(project.valorProjeto)}
                          masked={!canSeeSensitive && !canSeeValues}
                          placeholder="Privado"
                        />
                      ) : (
                        "Privado"
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    { label: "Pago", active: project.pago },
                    { label: "Fechado", active: project.fechado },
                    { label: "Instalado", active: project.instalado },
                  ].map((status) => (
                    <StatusBadge key={status.label} tone={status.active ? "accent" : "muted"}>
                      {status.label}
                    </StatusBadge>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function toCompetitionProjectDetail(
  row: ProjectRow | CompetitionProjectSafeRow,
  canSeeSensitive: boolean
): CompetitionProjectDetail {
  if (canSeeSensitive) {
    const project = row as ProjectRow

    return {
      id: project.id,
      cliente: project.cliente || `Projeto ${project.id.slice(0, 8)}`,
      data: project.data,
      cidade: project.cidade,
      valorProjeto: toSafeNumber(project.valor_projeto),
      pago: project.pago,
      fechado: project.fechado,
      instalado: project.instalado,
    }
  }

  const project = row as CompetitionProjectSafeRow

  return {
    id: project.id,
    cliente: project.cliente_mascarado || `Projeto ${project.id.slice(0, 8)}`,
    data: project.data,
    cidade: project.cidade,
    valorProjeto: toSafeNumber(project.valor_projeto),
    pago: project.pago,
    fechado: project.fechado,
    instalado: project.instalado,
  }
}

export default function CompetitionPage() {
  const { profile, user } = useAuth()
  const canSeeValues = canViewCompetitionValue(profile?.role)
  const canSeeSensitive = canViewSensitiveProjectData(profile?.role)
  const [selectedSeller, setSelectedSeller] = useState<SelectedSeller | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const analyticsQuery = useQuery({
    queryKey: ["project-competition", profile?.role, user?.id],
    queryFn: fetchCompetitionRanking,
    enabled: Boolean(profile?.role && user?.id),
  })

  const summary = useMemo(
    () => buildCompetitionSummaryFromRanking(analyticsQuery.data ?? []),
    [analyticsQuery.data]
  )

  const competitionProjectsQuery = useQuery({
    queryKey: [
      "project-competition-projects",
      profile?.role,
      user?.id,
      selectedSeller?.sellerId,
      selectedSeller?.sellerName,
    ],
    queryFn: () =>
      fetchCompetitionProjectsBySeller({
        role: profile?.role,
        sellerId: selectedSeller?.sellerId ?? null,
        sellerName: selectedSeller?.sellerName ?? "",
      }),
    enabled: Boolean(profile?.role && user?.id && drawerOpen && selectedSeller?.sellerName),
  })

  const rankingBars = useMemo(() => {
    const topCount = Math.max(1, summary.ranking[0]?.quantidadeProjetos ?? 0)

    return summary.ranking.map((seller, index) => ({
      label: seller.vendedor,
      valueLabel: `${seller.quantidadeProjetos} projeto(s)`,
      progress: (seller.quantidadeProjetos / topCount) * 100,
      accentClassName:
        index === 0 ? "bg-[linear-gradient(90deg,var(--color-chart-3),var(--color-chart-1))]" : undefined,
      onClick: () => {
        setSelectedSeller({ sellerId: seller.vendedorId, sellerName: seller.vendedor })
        setDrawerOpen(true)
      },
      active: selectedSeller?.sellerName === seller.vendedor && drawerOpen,
    }))
  }, [drawerOpen, selectedSeller?.sellerName, summary.ranking])

  const detailProjects = useMemo(
    () => (competitionProjectsQuery.data ?? []).map((project) => toCompetitionProjectDetail(project, canSeeSensitive)),
    [canSeeSensitive, competitionProjectsQuery.data]
  )

  function handleOpenSeller(sellerId: string | null, sellerName: string) {
    setSelectedSeller({ sellerId, sellerName })
    setDrawerOpen(true)
  }

  function handleDrawerOpenChange(open: boolean) {
    setDrawerOpen(open)

    if (!open) {
      setSelectedSeller(null)
    }
  }

  return (
    <div className="space-y-8">
      <PageIntro
        badge="Campanha comercial"
        badgeTone="amber"
        title="Competição"
        description={`Campanha por projetos pagos entre ${PROJECT_COMPETITION_START} e ${PROJECT_COMPETITION_END}, com o CRM como fonte oficial.`}
        aside={
          <div className="rounded-3xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
            <p className="text-xs uppercase tracking-[0.18em]">Regra</p>
            <p className="mt-2 text-foreground">
              Cada projeto pago conta como 1 venda. Em caso de empate, vence o maior valor total vendido.
            </p>
          </div>
        }
      />

      {analyticsQuery.isError ? (
        <StatePanel tone="error" centered={false}>
          {analyticsQuery.error instanceof Error
            ? analyticsQuery.error.message
            : "Não foi possível carregar a competição."}
        </StatePanel>
      ) : null}

      {analyticsQuery.isLoading ? <StatePanel>Carregando ranking...</StatePanel> : null}

      {!analyticsQuery.isLoading ? (
        <>
          <MetricGrid>
            <StatCard
              label="Líder atual"
              value={summary.leader?.vendedor || "Sem líder"}
              icon={Crown}
              accentClassName="text-accent"
            />
            <StatCard
              label="Projetos pagos"
              value={summary.totalProjetosPagos}
              icon={Trophy}
              accentClassName="text-primary"
            />
            <StatCard
              label="Valor total vendido"
              value={
                <MaskedValue
                  value={formatCurrency(summary.valorTotalVendido)}
                  masked={!canSeeValues}
                  placeholder="Privado"
                />
              }
              icon={Medal}
              accentClassName="text-accent"
            />
            <StatCard
              label="Participantes"
              value={summary.participantes}
              icon={Users}
              accentClassName="text-primary"
            />
          </MetricGrid>

          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionCard
              title="Ranking principal"
              description="Um único gráfico concentra a disputa. Clique no vendedor para abrir os projetos válidos da campanha."
              actions={<StatusBadge tone="accent">Ranking oficial</StatusBadge>}
              className="overflow-hidden"
              contentClassName="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_280px]"
              tone="highlight"
            >
              <div>
                <BarList items={rankingBars} emptyText="Nenhum projeto pago entrou na competição ainda." />
              </div>
              <div className="rounded-[1.75rem] border border-border/60 bg-background/60 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Critério</p>
                <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <p>Ganha quem tiver mais projetos pagos no período da campanha.</p>
                  <p>Em caso de empate, vence quem somar o maior valor total.</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Ranking detalhado"
              description="Lista de apoio para acompanhar a disputa sem perder velocidade de leitura."
              contentClassName="space-y-3"
            >
              {summary.ranking.length === 0 ? (
                <StatePanel dashed>Nenhum vendedor pontuou no período configurado.</StatePanel>
              ) : (
                summary.ranking.map((seller, index) => (
                  <button
                    key={`${seller.vendedor}-${index}`}
                    type="button"
                    onClick={() => handleOpenSeller(seller.vendedorId, seller.vendedor)}
                    className={`w-full rounded-3xl border p-4 text-left transition hover:border-primary/30 hover:bg-background/80 ${
                      selectedSeller?.sellerName === seller.vendedor && drawerOpen
                        ? "border-primary/35 bg-primary/[0.07] shadow-sm"
                        : index === 0
                          ? "border-[color:color-mix(in_oklab,var(--accent)_34%,transparent)] bg-[color:color-mix(in_oklab,var(--accent)_14%,transparent)] shadow-sm ring-1 ring-[color:color-mix(in_oklab,var(--accent)_16%,transparent)]"
                          : "border-border/60 bg-background/70"
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">#{index + 1} lugar</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{seller.vendedor}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        {index === 0 ? <StatusBadge tone="accent">1º lugar</StatusBadge> : null}
                        <StatusBadge tone={index === 0 ? "accent" : "muted"}>
                          {seller.quantidadeProjetos} projeto(s)
                        </StatusBadge>
                        <StatusBadge tone="muted">
                          <MaskedValue
                            value={formatCurrency(seller.valorTotal)}
                            masked={!canSeeValues}
                            placeholder="Privado"
                          />
                        </StatusBadge>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </SectionCard>
          </section>
        </>
      ) : null}

      <ProjectCompetitionDrawer
        open={drawerOpen && selectedSeller !== null}
        onOpenChange={handleDrawerOpenChange}
        seller={selectedSeller?.sellerName ?? null}
        projects={detailProjects}
        canSeeValues={canSeeValues}
        canSeeSensitive={canSeeSensitive}
        isLoading={competitionProjectsQuery.isLoading}
        isError={competitionProjectsQuery.isError}
        errorMessage={
          competitionProjectsQuery.error instanceof Error
            ? competitionProjectsQuery.error.message
            : "Não foi possível carregar os projetos da competição."
        }
      />
    </div>
  )
}



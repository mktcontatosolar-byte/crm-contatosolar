import { useDeferredValue, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { History, ShieldCheck, UserRound, X } from "lucide-react"

import FilterBar from "@/components/crm/FilterBar"
import PageIntro from "@/components/crm/PageIntro"
import SectionCard from "@/components/crm/SectionCard"
import StatePanel from "@/components/crm/StatePanel"
import StatusBadge from "@/components/crm/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { useAuth } from "@/contexts/useAuth"
import { fetchAuditLogs } from "@/lib/auditLogs"
import { formatCrmDateTime } from "@/lib/dateTime"
import { formatSupabaseValue } from "@/lib/utils"

function JsonBlock({ value }: { value: Record<string, unknown> | null }) {
  if (!value || Object.keys(value).length === 0) {
    return <p className="text-sm text-muted-foreground">Vazio</p>
  }

  return (
    <pre className="overflow-x-auto rounded-2xl border border-border/60 bg-background/70 p-4 text-xs leading-6 text-muted-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function stringifyFilterValue(value: Record<string, unknown> | null) {
  return value ? JSON.stringify(value).toLowerCase() : ""
}

export default function LogsPage() {
  const { isAdmin } = useAuth()
  const [userFilter, setUserFilter] = useState("")
  const [leadFilter, setLeadFilter] = useState("")
  const [actionFilter, setActionFilter] = useState("")

  const deferredUserFilter = useDeferredValue(userFilter)
  const deferredLeadFilter = useDeferredValue(leadFilter)

  const logsQuery = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => fetchAuditLogs(150),
    enabled: isAdmin,
  })

  const logs = useMemo(() => logsQuery.data ?? [], [logsQuery.data])
  const availableActions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.action))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [logs]
  )

  const filteredLogs = useMemo(() => {
    const normalizedUserFilter = deferredUserFilter.trim().toLowerCase()
    const normalizedLeadFilter = deferredLeadFilter.trim().toLowerCase()

    return logs.filter((log) => {
      const actorLabel = [log.actor_name_snapshot, log.actor_email_snapshot].filter(Boolean).join(" ").toLowerCase()
      const leadPayload = [
        log.entity_type === "lead" || log.entity_type === "lead_note" ? log.entity_id : null,
        log.description,
        stringifyFilterValue(log.before_data),
        stringifyFilterValue(log.after_data),
        stringifyFilterValue(log.metadata),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      const matchesUser = !normalizedUserFilter || actorLabel.includes(normalizedUserFilter)
      const matchesLead = !normalizedLeadFilter || leadPayload.includes(normalizedLeadFilter)
      const matchesAction = !actionFilter || log.action === actionFilter

      return matchesUser && matchesLead && matchesAction
    })
  }, [actionFilter, deferredLeadFilter, deferredUserFilter, logs])

  const hasActiveFilters = Boolean(userFilter.trim() || leadFilter.trim() || actionFilter)

  function clearFilters() {
    setUserFilter("")
    setLeadFilter("")
    setActionFilter("")
  }

  if (!isAdmin) {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Histórico de ações</h1>
        <p className="text-sm text-muted-foreground">Somente administradores podem acessar esta tela.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageIntro
        badge="Histórico do sistema"
        badgeTone="amber"
        title="Histórico de ações"
        description="Veja aqui as principais ações realizadas no sistema."
        aside={
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Registros encontrados", value: logs.length, icon: History },
              { label: "Registros na tela", value: filteredLogs.length, icon: ShieldCheck },
            ].map((item) => {
              const Icon = item.icon
              return (
                <Card key={item.label} className="rounded-3xl border border-border/60 bg-background/70 shadow-none">
                  <CardContent className="flex min-h-24 items-center gap-4 p-4">
                    <div className="rounded-2xl border border-border/60 bg-card/90 p-3">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-3xl font-semibold text-foreground">{item.value}</p>
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        }
      />

      {logsQuery.error ? (
        <StatePanel tone="error" centered={false}>
          {logsQuery.error instanceof Error ? logsQuery.error.message : "Não conseguimos carregar o histórico agora."}
        </StatePanel>
      ) : null}

      {logsQuery.isLoading ? <StatePanel>Carregando histórico de ações...</StatePanel> : null}

      {!logsQuery.isLoading && logs.length > 0 ? (
        <FilterBar
          title="Filtrar histórico"
          description="Use os filtros para encontrar ações por pessoa, lead ou tipo de alteração."
          actions={
            hasActiveFilters ? (
              <Button type="button" variant="ghost" className="rounded-2xl" onClick={clearFilters}>
                <X className="h-4 w-4" />
                Limpar filtros
              </Button>
            ) : null
          }
          className="bg-background/80 shadow-none"
        >
          <div className="grid gap-3 lg:grid-cols-[1.1fr_1.1fr_0.8fr]">
            <Input
              value={userFilter}
              onChange={(event) => setUserFilter(event.target.value)}
              placeholder="Buscar por pessoa"
              aria-label="Buscar histórico por pessoa"
              className="h-12 rounded-3xl border border-border bg-background px-4"
            />
            <Input
              value={leadFilter}
              onChange={(event) => setLeadFilter(event.target.value)}
              placeholder="Buscar por lead"
              aria-label="Buscar histórico por lead"
              className="h-12 rounded-3xl border border-border bg-background px-4"
            />
            <Select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              aria-label="Filtrar histórico por ação"
              className="h-12 rounded-3xl border border-border bg-background px-4"
            >
              <option value="">Todas as ações</option>
              {availableActions.map((action) => (
                <option key={action} value={action}>
                  {formatSupabaseValue(action)}
                </option>
              ))}
            </Select>
          </div>
        </FilterBar>
      ) : null}

      {!logsQuery.isLoading && logs.length === 0 ? <StatePanel>Ainda não há registros para mostrar.</StatePanel> : null}

      {!logsQuery.isLoading && logs.length > 0 && filteredLogs.length === 0 ? (
        <StatePanel centered={false}>Nenhum resultado encontrado com esses filtros.</StatePanel>
      ) : null}

      {!logsQuery.isLoading && filteredLogs.length > 0 ? (
        <div className="space-y-4">
          {filteredLogs.map((log) => (
            <SectionCard
              key={log.id}
              title={
                <div className="flex flex-wrap items-center gap-2">
                  <span>{log.description}</span>
                  <StatusBadge>{formatSupabaseValue(log.action)}</StatusBadge>
                  <StatusBadge tone="outline">{formatSupabaseValue(log.entity_type)}</StatusBadge>
                </div>
              }
              description={`${formatCrmDateTime(log.created_at)} · ${formatSupabaseValue(log.entity_id)}`}
              actions={
                <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm">
                  <div className="flex items-center gap-2 text-foreground">
                    <UserRound className="h-4 w-4 text-accent" />
                    <span>{formatSupabaseValue(log.actor_name_snapshot || log.actor_email_snapshot)}</span>
                  </div>
                </div>
              }
              contentClassName="grid gap-4 xl:grid-cols-2"
            >
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Como estava</p>
                <JsonBlock value={log.before_data} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Como ficou</p>
                <JsonBlock value={log.after_data} />
              </div>
            </SectionCard>
          ))}
        </div>
      ) : null}
    </div>
  )
}

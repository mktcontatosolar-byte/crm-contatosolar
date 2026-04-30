import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArchiveRestore, CalendarClock, Inbox, MessageSquareText, UserRound } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import InfoField from "@/components/crm/InfoField"
import PageIntro from "@/components/crm/PageIntro"
import SectionCard from "@/components/crm/SectionCard"
import StatePanel from "@/components/crm/StatePanel"
import StatusBadge from "@/components/crm/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/useAuth"
import { logAuditEvent } from "@/lib/auditLogs"
import { fetchArchivedLeads as fetchArchivedCrmLeads, updateLeadState } from "@/lib/crmLeads"
import { safeLogLeadActivity } from "@/lib/leadActivity"
import { formatSupabaseValue } from "@/lib/utils"
import type { Lead } from "@/types"

type ArchivedLead = Pick<
  Lead,
  | "id"
  | "nome_completo"
  | "email"
  | "telefone_contato"
  | "status_conversa"
  | "created_at"
  | "last_interaction_at"
  | "arquivado"
>

function leadDisplayName(lead: ArchivedLead) {
  return lead.nome_completo || lead.email || lead.telefone_contato || "Lead sem identificação"
}

function formatDate(dateString: string | null) {
  if (!dateString) {
    return "Vazio"
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateString))
}

async function fetchArchivedLeads(): Promise<ArchivedLead[]> {
  return (await fetchArchivedCrmLeads()) as ArchivedLead[]
}

function ArchivedLeadSkeleton() {
  return (
    <Card className="rounded-3xl border border-border/60 bg-card/92 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="space-y-2">
          <Skeleton className="h-6 w-44 rounded-2xl" />
          <Skeleton className="h-4 w-60 rounded-2xl" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-12 w-full rounded-full md:w-40" />
          <Skeleton className="h-12 w-full rounded-full md:w-40" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function ArchivedLeadsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin, user } = useAuth()
  const [pendingLead, setPendingLead] = useState<ArchivedLead | null>(null)

  const archivedLeadsQuery = useQuery({
    queryKey: ["archived-leads"],
    queryFn: fetchArchivedLeads,
    enabled: isAdmin,
  })

  const unarchiveLeadMutation = useMutation({
    mutationFn: async (lead: ArchivedLead) => {
      await updateLeadState(lead.id, {
        arquivado: false,
        corretor_id: null,
        assumed_at: null,
        stage_id: null,
      })

      await safeLogLeadActivity({
        leadId: lead.id,
        usuarioId: user?.id ?? null,
        tipo: "desarquivamento",
        descricao: "Lead desarquivado e devolvido ao pool",
      }, { context: "archived-restore-lead" })

      try {
        await logAuditEvent({
          actorUserId: user?.id ?? null,
          actorEmail: user?.email ?? null,
          entityType: "lead",
          entityId: lead.id,
          action: "desarquivamento",
          description: "Lead desarquivado e devolvido ao pool",
          beforeData: {
            arquivado: true,
          },
          afterData: {
            arquivado: false,
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
      setPendingLead(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["archived-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["pool-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["kanban-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["team-data"] }),
      ])
    },
    onError: () => {
      toast.error("Não foi possível colocar esse lead de volta na fila.")
    },
  })

  const archivedLeads = useMemo(() => archivedLeadsQuery.data ?? [], [archivedLeadsQuery.data])

  const headerStats = useMemo(
    () => [
      {
        label: "Arquivados",
        value: archivedLeads.length,
        icon: Inbox,
      },
      {
        label: "Com contato recente",
        value: archivedLeads.filter((lead) => Boolean(lead.last_interaction_at)).length,
        icon: MessageSquareText,
      },
    ],
    [archivedLeads]
  )

  if (!isAdmin) {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Leads arquivados</h1>
        <p className="text-sm text-muted-foreground">Somente administradores podem acessar esta tela.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageIntro
        badge="Recuperar leads"
        badgeTone="amber"
        title="Leads arquivados"
        description="Veja os leads que saíram da operação e, se precisar, coloque qualquer um de volta na fila."
        aside={
          <div className="grid gap-3 sm:grid-cols-2">
            {headerStats.map((item) => {
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

      {archivedLeadsQuery.error ? (
        <StatePanel tone="error" centered={false}>
          {archivedLeadsQuery.error instanceof Error
            ? archivedLeadsQuery.error.message
            : "Não conseguimos carregar os leads arquivados agora."}
        </StatePanel>
      ) : null}

      {archivedLeadsQuery.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <ArchivedLeadSkeleton key={index} />
          ))}
        </div>
      ) : null}

      {!archivedLeadsQuery.isLoading && archivedLeads.length === 0 ? (
        <StatePanel>
          Não há leads arquivados no momento. Quando um atendimento for finalizado, ele vai aparecer aqui.
        </StatePanel>
      ) : null}

      {!archivedLeadsQuery.isLoading && archivedLeads.length > 0 ? (
        <div className="grid gap-4">
          {archivedLeads.map((lead) => (
            <SectionCard
              key={lead.id}
              title={leadDisplayName(lead)}
              description={formatSupabaseValue(lead.email || lead.telefone_contato)}
              actions={<StatusBadge tone="accent">Arquivado</StatusBadge>}
              contentClassName="space-y-4"
              tone="highlight"
            >
              <div className="grid gap-3 md:grid-cols-3">
                <InfoField icon={CalendarClock} label="Último contato" value={formatDate(lead.last_interaction_at)} />
                <InfoField
                  icon={UserRound}
                  label="Status da conversa"
                  value={<StatusBadge tone="outline">{formatSupabaseValue(lead.status_conversa)}</StatusBadge>}
                />
                <InfoField icon={CalendarClock} label="Quando entrou" value={formatDate(lead.created_at)} />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  className="h-12 rounded-full sm:w-auto"
                  onClick={() => setPendingLead(lead)}
                >
                  <ArchiveRestore className="mr-2 h-4 w-4" />
                  Voltar para a fila
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-full sm:w-auto"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  Abrir detalhes
                </Button>
              </div>
            </SectionCard>
          ))}
        </div>
      ) : null}

      <Dialog open={Boolean(pendingLead)} onOpenChange={(open) => !open && setPendingLead(null)}>
        <DialogContent showCloseButton className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Colocar esse lead de volta na fila?</DialogTitle>
            <DialogDescription>
              {pendingLead
                ? `${leadDisplayName(pendingLead)} vai sair dos arquivados e voltar para a fila sem vendedor definido.`
                : "Confirme se esse lead deve voltar para a fila."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-full"
              onClick={() => setPendingLead(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-12 rounded-full"
              disabled={!pendingLead || unarchiveLeadMutation.isPending}
              onClick={() =>
                pendingLead
                  ? void unarchiveLeadMutation.mutateAsync(pendingLead)
                  : undefined
              }
            >
              {unarchiveLeadMutation.isPending ? "Voltando para a fila..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

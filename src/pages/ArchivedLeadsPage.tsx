import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArchiveRestore, CalendarClock, Inbox, MessageSquareText, UserRound } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import PageIntro from "@/components/crm/PageIntro"
import StatePanel from "@/components/crm/StatePanel"
import { Badge } from "@/components/ui/badge"
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
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/useAuth"
import { logLeadActivity } from "@/lib/leadActivity"
import { supabase } from "@/lib/supabase"
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
    return "Sem registro disponível"
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateString))
}

async function fetchArchivedLeads(): Promise<ArchivedLead[]> {
  const { data, error } = await supabase
    .from("leads_lancamento")
    .select(
      "id,nome_completo,email,telefone_contato,status_conversa,created_at,last_interaction_at,arquivado"
    )
    .eq("arquivado", true)
    .order("last_interaction_at", { ascending: false, nullsFirst: false })

  if (error) {
    throw error
  }

  return (data ?? []) as ArchivedLead[]
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
      const { error } = await supabase
        .from("leads_lancamento")
        .update({
          arquivado: false,
          corretor_id: null,
          assumed_at: null,
          stage_id: null,
        })
        .eq("id", lead.id)

      if (error) {
        throw error
      }

      await logLeadActivity({
        leadId: lead.id,
        usuarioId: user?.id ?? null,
        tipo: "desarquivamento",
        descricao: "Lead desarquivado e devolvido ao pool",
      })

      return lead
    },
    onSuccess: async (lead) => {
      toast.success(`${leadDisplayName(lead)} devolvido ao Pool.`)
      setPendingLead(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["archived-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["pool-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["kanban-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["team-data"] }),
      ])
    },
    onError: () => {
      toast.error("Não foi possível desarquivar o lead.")
    },
  })

  const archivedLeads = useMemo(() => archivedLeadsQuery.data ?? [], [archivedLeadsQuery.data])

  const headerStats = useMemo(
    () => [
      {
        label: "Arquivados agora",
        value: archivedLeads.length,
        icon: Inbox,
      },
      {
        label: "Com interação recente",
        value: archivedLeads.filter((lead) => Boolean(lead.last_interaction_at)).length,
        icon: MessageSquareText,
      },
    ],
    [archivedLeads]
  )

  if (!isAdmin) {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Arquivados</h1>
        <p className="text-sm text-muted-foreground">Somente administradores podem acessar esta tela.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageIntro
        badge="Recuperação de carteira"
        badgeTone="amber"
        title="Arquivados"
        description="Revise leads fora da operação ativa e devolva qualquer registro arquivado diretamente para o Pool."
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
            : "Não foi possível carregar os leads arquivados."}
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
          Nenhum lead arquivado no momento. Quando um atendimento for encerrado, ele aparecerá aqui.
        </StatePanel>
      ) : null}

      {!archivedLeadsQuery.isLoading && archivedLeads.length > 0 ? (
        <div className="grid gap-4">
          {archivedLeads.map((lead) => (
            <Card key={lead.id} className="rounded-3xl border border-border/60 bg-card/92 shadow-sm">
              <CardHeader className="gap-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-lg">{leadDisplayName(lead)}</CardTitle>
                    <CardDescription>{lead.email || lead.telefone_contato || "Sem contato principal"}</CardDescription>
                  </div>
                  <Badge className="min-h-7 w-fit rounded-full px-3 text-sm">Arquivado</Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl border border-border/60 bg-card/90 p-2">
                        <CalendarClock className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Última movimentação</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatDate(lead.last_interaction_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl border border-border/60 bg-card/90 p-2">
                        <UserRound className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Status da conversa</p>
                        <p className="mt-1 text-sm text-muted-foreground">{lead.status_conversa || "Sem status"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl border border-border/60 bg-card/90 p-2">
                        <CalendarClock className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Criado em</p>
                        <p className="mt-1 text-sm text-muted-foreground">{formatDate(lead.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    className="h-12 rounded-full sm:w-auto"
                    onClick={() => setPendingLead(lead)}
                  >
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    Desarquivar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 rounded-full sm:w-auto"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    Ver detalhes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Dialog open={Boolean(pendingLead)} onOpenChange={(open) => !open && setPendingLead(null)}>
        <DialogContent showCloseButton className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Desarquivar lead?</DialogTitle>
            <DialogDescription>
              {pendingLead
                ? `${leadDisplayName(pendingLead)} sairá da lista de arquivados e voltará para o Pool sem corretor atribuído.`
                : "Confirme o desarquivamento do lead."}
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
              {unarchiveLeadMutation.isPending ? "Desarquivando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { useEffect, useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useNavigate } from "react-router-dom"
import {
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  Clock3,
  Mail,
  Phone,
  UserRoundSearch,
} from "lucide-react"
import { toast } from "sonner"

import PageIntro from "@/components/crm/PageIntro"
import StatePanel from "@/components/crm/StatePanel"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { Label } from "@/components/ui/label"
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/contexts/useAuth"
import { fetchPoolLeads, LEAD_SOURCE_TABLE, LEAD_STATE_TABLE, updateLeadState } from "@/lib/crmLeads"
import { logLeadActivity } from "@/lib/leadActivity"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import type { Lead, Profile } from "@/types"

type PoolLead = Pick<
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
  | "arquivado"
>

type CorretorOption = Pick<Profile, "id" | "nome" | "email">

type PendingAssignment = {
  lead: PoolLead
  corretorId: string
}

function formatRelativeTime(dateString: string) {
  return formatDistanceToNow(new Date(dateString), {
    addSuffix: true,
    locale: ptBR,
  })
}

function leadDisplayName(lead: PoolLead) {
  return lead.nome_completo || lead.email || lead.telefone_contato || "Lead sem identificação"
}

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function getLeadStatus(hasBrokers: boolean) {
  return hasBrokers
    ? {
        label: "Pronto para atribuição",
        className:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      }
    : {
        label: "Pendente",
        className:
          "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300",
      }
}

function PoolLeadCardSkeleton() {
  return (
    <Card className="rounded-3xl border border-border/60 bg-card/90 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-11 w-full rounded-full" />
      </CardContent>
    </Card>
  )
}

function PoolDetailSkeleton() {
  return (
    <Card className="rounded-3xl border border-border/60 bg-card/90 shadow-sm">
      <CardContent className="space-y-5 p-5 lg:p-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-12 w-full rounded-full" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-12 w-full rounded-full" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function PoolLeadsPage() {
  const navigate = useNavigate()
  const { isAdmin, user } = useAuth()
  const [leads, setLeads] = useState<PoolLead[]>([])
  const [corretores, setCorretores] = useState<CorretorOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [assigningLeadId, setAssigningLeadId] = useState<string | null>(null)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [selectedBrokerByLead, setSelectedBrokerByLead] = useState<Record<string, string>>({})
  const [pendingAssignment, setPendingAssignment] = useState<PendingAssignment | null>(null)
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 1280px)").matches
  )

  async function loadPool({ silent = false }: { silent?: boolean } = {}) {
    try {
      if (!silent) {
        setLoading(true)
      }

      const [leadsResult, corretoresResult] = await Promise.all([
        fetchPoolLeads(),
        supabase
          .from("profiles")
          .select("id,nome,email")
          .eq("role", "corretor")
          .eq("ativo", true)
          .order("nome", { ascending: true }),
      ])

      if (corretoresResult.error) {
        throw corretoresResult.error
      }

      const nextLeads = leadsResult as PoolLead[]
      const nextCorretores = (corretoresResult.data ?? []) as CorretorOption[]

      setLeads(nextLeads)
      setCorretores(nextCorretores)
      setSelectedLeadId((current) => {
        if (!current) {
          return null
        }

        return nextLeads.some((lead) => lead.id === current) ? current : null
      })
      setError("")
    } catch (loadError) {
      console.error("Erro ao carregar pool de leads:", loadError)
      setError("Não foi possível carregar o pool de leads.")
    } finally {
      setLoading(false)
    }
  }

  async function assignLead(leadId: string, corretorId: string) {
    if (!corretorId) {
      return
    }

    setAssigningLeadId(leadId)

    try {
      await updateLeadState(leadId, {
        corretor_id: corretorId,
        assumed_at: new Date().toISOString(),
      })

      const selectedBroker = corretores.find((corretor) => corretor.id === corretorId)
      await logLeadActivity({
        leadId,
        usuarioId: user?.id ?? null,
        tipo: "atribuicao",
        descricao: `Lead atribuído para ${selectedBroker?.nome || selectedBroker?.email || "vendedor"}`,
        metadata: {
          corretor_id: corretorId,
        },
      })

      setLeads((currentLeads) => currentLeads.filter((lead) => lead.id !== leadId))
      setSelectedLeadId((current) => {
        if (current !== leadId) {
          return current
        }

        return null
      })
      setMobileSheetOpen(false)
      setSelectedBrokerByLead((current) => {
        const next = { ...current }
        delete next[leadId]
        return next
      })
      setPendingAssignment(null)
      setError("")
      toast.success("Lead atribuído com sucesso.")
    } catch (assignError) {
      console.error("Erro ao atribuir lead:", assignError)
      setError("Não foi possível atribuir o lead.")
      toast.error("Não foi possível atribuir o lead.")
    } finally {
      setAssigningLeadId(null)
    }
  }

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => {
      void loadPool()
    }, 0)

    const channel = supabase
      .channel("pool-leads")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: LEAD_STATE_TABLE,
        },
        () => {
          void loadPool({ silent: true })
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
          void loadPool({ silent: true })
        }
      )
      .subscribe()

    return () => {
      window.clearTimeout(initialLoadId)
      void supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1280px)")
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches)
      if (event.matches) {
        setMobileSheetOpen(false)
      }
    }

    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  const selectedLead = useMemo(() => {
    if (selectedLeadId) {
      return leads.find((lead) => lead.id === selectedLeadId) ?? null
    }

    return isDesktop ? leads[0] ?? null : null
  }, [isDesktop, leads, selectedLeadId])

  const selectedBrokerId = selectedLead ? selectedBrokerByLead[selectedLead.id] ?? "" : ""

  const pendingBroker = pendingAssignment
    ? corretores.find((corretor) => corretor.id === pendingAssignment.corretorId) ?? null
    : null

  const handleLeadSelection = (leadId: string) => {
    setSelectedLeadId(leadId)

    if (!isDesktop) {
      setMobileSheetOpen(true)
    }
  }

  if (!isAdmin) {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Pool de Leads</h1>
        <p className="text-sm text-muted-foreground">Somente administradores podem acessar esta tela.</p>
      </div>
    )
  }

  const detailContent = selectedLead ? (
    <Card className="rounded-3xl border border-border/60 bg-card/92 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-5">
        <div className="flex items-start gap-4">
          <Avatar size="lg" className="h-14 w-14">
            <AvatarFallback>{getInitials(leadDisplayName(selectedLead))}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg font-semibold text-foreground sm:text-xl">
                {leadDisplayName(selectedLead)}
              </CardTitle>
              <Badge
                className={cn(
                  "min-h-7 rounded-full px-3 text-sm font-medium",
                  getLeadStatus(corretores.length > 0).className
                )}
              >
                {getLeadStatus(corretores.length > 0).label}
              </Badge>
            </div>
            <CardDescription className="text-sm text-muted-foreground">
              Recebido {formatRelativeTime(selectedLead.created_at)}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5 lg:p-6">
        <div className="grid gap-3">
          {[
            {
              icon: Mail,
              label: "Email",
              value: selectedLead.email || "Não informado",
            },
            {
              icon: Phone,
              label: "Telefone",
              value: selectedLead.telefone_contato || "Não informado",
            },
            {
              icon: Clock3,
              label: "Horario preferido",
              value: selectedLead.horario_preferido || "Não informado",
            },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className="flex min-h-14 items-start gap-3 rounded-2xl border border-border/60 bg-background/70 px-4 py-3"
              >
                <div className="mt-0.5 rounded-2xl border border-border/60 bg-card/90 p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="break-words text-sm text-muted-foreground">{item.value}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`pool-broker-${selectedLead.id}`} className="text-sm">
            Escolher vendedor
          </Label>
          <SelectRoot
            value={selectedBrokerId}
            onValueChange={(value) =>
              setSelectedBrokerByLead((current) => ({
                ...current,
                [selectedLead.id]: value,
              }))
            }
          >
            <SelectTrigger id={`pool-broker-${selectedLead.id}`} className="text-sm">
              <SelectValue
                placeholder={
                  corretores.length === 0 ? "Nenhum vendedor ativo disponível" : "Selecione um vendedor"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {corretores.map((corretor) => (
                <SelectItem key={corretor.id} value={corretor.id}>
                  <div className="flex min-h-12 items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback>
                        {getInitials(corretor.nome || corretor.email || "C")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {corretor.nome || "Vendedor sem nome"}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{corretor.email || "Sem e-mail"}</p>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            className="h-12 w-full rounded-full"
            disabled={!selectedBrokerId || assigningLeadId === selectedLead.id || corretores.length === 0}
            onClick={() =>
              selectedBrokerId
                ? setPendingAssignment({ lead: selectedLead, corretorId: selectedBrokerId })
                : undefined
            }
          >
            {assigningLeadId === selectedLead.id ? "Atribuindo..." : "Atribuir"}
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full rounded-full"
                  onClick={() => navigate(`/leads/${selectedLead.id}`)}
                >
                  Ver detalhes
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={8}>
                Abre a página completa com histórico e operações do lead.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  ) : (
    <Card className="rounded-3xl border border-dashed border-border/60 bg-card/90 shadow-sm">
      <CardContent className="flex min-h-[28rem] flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="rounded-full border border-border/60 bg-background/70 p-4">
          <UserRoundSearch className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-semibold text-foreground">Selecione um lead do pool</p>
          <p className="text-sm text-muted-foreground">
            O painel lateral mostra os dados principais e a atribuição sem perder contexto da lista.
          </p>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <PageIntro
        badge="Distribuição inicial"
        badgeTone="amber"
        title="Pool de Leads"
        description="Leads qualificados ainda não atribuídos para um vendedor."
        aside={
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Vendedores ativos", value: corretores.length, icon: BadgeCheck },
              { label: "Leads no pool", value: leads.length, icon: CalendarClock },
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

      {error ? <StatePanel tone="error" centered={false}>{error}</StatePanel> : null}

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-[0.4fr_0.6fr]">
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <PoolLeadCardSkeleton key={index} />
            ))}
          </div>
          <PoolDetailSkeleton />
        </div>
      ) : null}

      {!loading && leads.length === 0 ? (
        <StatePanel>
          Nenhum lead qualificado no pool neste momento. Novos leads voltam a aparecer aqui assim que ficarem sem vendedor.
        </StatePanel>
      ) : null}

      {!loading && leads.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)]">
          <div className="space-y-4">
            {leads.map((lead) => {
              const isSelected = selectedLead?.id === lead.id
              const leadStatus = getLeadStatus(corretores.length > 0)

              return (
                <Card
                  key={lead.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleLeadSelection(lead.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      handleLeadSelection(lead.id)
                    }
                  }}
                  className={`cursor-pointer rounded-3xl border bg-card/92 shadow-sm transition-all ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border/60 hover:border-primary/40"
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <Avatar size="lg" className="h-12 w-12">
                        <AvatarFallback>{getInitials(leadDisplayName(lead))}</AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-foreground">
                              {leadDisplayName(lead)}
                            </p>
                            <Badge className={`min-h-7 rounded-full px-3 text-sm ${leadStatus.className}`}>
                              {leadStatus.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatRelativeTime(lead.created_at)}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm text-muted-foreground">
                            {lead.email || lead.telefone_contato || "Sem contato principal"}
                          </p>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </div>
                        <div className="xl:hidden">
                          <Button
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            className="h-12 w-full rounded-full"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleLeadSelection(lead.id)
                            }}
                          >
                            Abrir painel
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="hidden xl:block">{detailContent}</div>
        </div>
      ) : null}

      <Sheet
        open={!isDesktop && mobileSheetOpen && Boolean(selectedLead) && !loading}
        onOpenChange={(open) => {
          setMobileSheetOpen(open)
          if (!open && !isDesktop) {
            setSelectedLeadId(null)
          }
        }}
      >
        <SheetContent side="bottom" className="xl:hidden">
          <SheetHeader className="pr-10">
            <SheetTitle>{selectedLead ? leadDisplayName(selectedLead) : "Detalhes do lead"}</SheetTitle>
            <SheetDescription>
              Revise o contato e atribua rapidamente sem sair da lista.
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto pb-2">
            {loading ? <PoolDetailSkeleton /> : detailContent}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(pendingAssignment)} onOpenChange={(open) => !open && setPendingAssignment(null)}>
        <DialogContent showCloseButton className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Confirmar atribuição</DialogTitle>
            <DialogDescription>
              {pendingAssignment && pendingBroker
                ? `Atribuir ${leadDisplayName(pendingAssignment.lead)} para ${pendingBroker.nome || pendingBroker.email}?`
                : "Confirme a atribuição deste lead ao vendedor selecionado."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-12 rounded-full" onClick={() => setPendingAssignment(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-12 rounded-full"
              disabled={!pendingAssignment || assigningLeadId === pendingAssignment.lead.id}
              onClick={() =>
                pendingAssignment
                  ? void assignLead(pendingAssignment.lead.id, pendingAssignment.corretorId)
                  : undefined
              }
            >
              {pendingAssignment && assigningLeadId === pendingAssignment.lead.id
                ? "Atribuindo..."
                : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

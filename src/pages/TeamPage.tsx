import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Crown,
  Mail,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import PageIntro from "@/components/crm/PageIntro"
import StatePanel from "@/components/crm/StatePanel"
import StatCard from "@/components/crm/StatCard"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { useAuth } from "@/contexts/useAuth"
import { logLeadActivity } from "@/lib/leadActivity"
import { ManageUserRequestError, manageUser } from "@/lib/manageUser"
import { supabase } from "@/lib/supabase"
import type { Lead, Profile } from "@/types"

type TeamMember = Pick<Profile, "id" | "nome" | "email" | "role" | "ativo" | "created_at">
type BrokerLead = Pick<
  Lead,
  "id" | "nome_completo" | "email" | "telefone_contato" | "corretor_id" | "arquivado"
>

const newUserSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do usuário."),
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha inicial precisa ter ao menos 6 caracteres."),
  role: z.enum(["corretor", "admin"]),
  ativo: z.enum(["true", "false"]),
})

type NewUserFormValues = z.infer<typeof newUserSchema>

type TeamQueryResult = {
  members: TeamMember[]
  leads: BrokerLead[]
}

type PendingDeletion = {
  member: TeamMember
  assignedCount: number
}

type PendingRedistribution = {
  lead: BrokerLead
  broker: TeamMember
}

type PendingStatusChange = {
  member: TeamMember
  nextActiveState: boolean
}

const initialFormValues: NewUserFormValues = {
  nome: "",
  email: "",
  password: "",
  role: "corretor",
  ativo: "true",
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(dateString))
}

function displayName(member: TeamMember) {
  return member.nome || member.email || "Usuário sem nome"
}

function displayLeadName(lead: BrokerLead) {
  return lead.nome_completo || lead.email || lead.telefone_contato || "Lead sem identificação"
}

async function fetchTeamData(): Promise<TeamQueryResult> {
  const [membersResult, leadsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,nome,email,role,ativo,created_at")
      .in("role", ["admin", "corretor"])
      .order("role", { ascending: true })
      .order("nome", { ascending: true }),
    supabase
      .from("leads_lancamento")
      .select("id,nome_completo,email,telefone_contato,corretor_id,arquivado")
      .not("corretor_id", "is", null),
  ])

  if (membersResult.error) {
    throw membersResult.error
  }

  if (leadsResult.error) {
    throw leadsResult.error
  }

  return {
    members: (membersResult.data ?? []) as TeamMember[],
    leads: (leadsResult.data ?? []) as BrokerLead[],
  }
}

function isAssignedLeadsError(error: unknown) {
  return error instanceof ManageUserRequestError && error.code === "assigned_leads_block"
}

function isSelfDeleteError(error: unknown) {
  return error instanceof ManageUserRequestError && error.code === "self_delete_blocked"
}

export default function TeamPage() {
  const { isAdmin, user } = useAuth()
  const queryClient = useQueryClient()
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null)
  const [brokerForRedistribution, setBrokerForRedistribution] = useState<TeamMember | null>(null)
  const [pendingRedistribution, setPendingRedistribution] = useState<PendingRedistribution | null>(null)
  const [pendingStatusChange, setPendingStatusChange] = useState<PendingStatusChange | null>(null)

  const form = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: initialFormValues,
  })

  const teamQuery = useQuery({
    queryKey: ["team-data"],
    queryFn: fetchTeamData,
    enabled: isAdmin,
  })

  const invalidateOperationalQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["team-data"] }),
      queryClient.invalidateQueries({ queryKey: ["pool-leads"] }),
      queryClient.invalidateQueries({ queryKey: ["kanban-leads"] }),
    ])
  }

  const createUserMutation = useMutation({
    mutationFn: async (values: NewUserFormValues) =>
      manageUser({
        action: "createUser",
        email: values.email.trim(),
        password: values.password,
        nome: values.nome.trim(),
        role: values.role,
        ativo: values.ativo === "true",
      }),
    onSuccess: async (_, variables) => {
      form.reset(initialFormValues)
      toast.success(`${variables.role === "admin" ? "Admin" : "Corretor"} criado com sucesso.`)
      await invalidateOperationalQueries()
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Não foi possível criar o usuário."
      toast.error(message)
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: async (member: TeamMember) => {
      const { error } = await supabase
        .from("profiles")
        .update({ ativo: !member.ativo })
        .eq("id", member.id)

      if (error) {
        throw error
      }

      return member
    },
    onSuccess: async (member) => {
      toast.success(
        member.ativo
          ? `${member.role === "admin" ? "Admin" : "Corretor"} inativado com sucesso. O acesso foi removido e os dados foram preservados.`
          : `${member.role === "admin" ? "Admin" : "Corretor"} reativado com sucesso.`
      )
      setPendingStatusChange(null)
      await invalidateOperationalQueries()
    },
    onError: () => {
      toast.error("Não foi possível atualizar este usuário.")
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: async ({ member }: PendingDeletion) =>
      manageUser({
        action: "deleteUser",
        userId: member.id,
      }),
    onSuccess: async () => {
      toast.success("Usuário excluído com sucesso.")
      setPendingDeletion(null)
      await invalidateOperationalQueries()
    },
    onError: (error) => {
      if (isAssignedLeadsError(error)) {
        toast.error("Este corretor ainda possui leads ativos. Reatribua os leads antes de excluir.")
        return
      }

      if (isSelfDeleteError(error)) {
        toast.error("Você não pode excluir sua própria conta por este fluxo.")
        return
      }

      toast.error(error instanceof Error ? error.message : "Não foi possível excluir o usuário.")
    },
  })

  const redistributeLeadMutation = useMutation({
    mutationFn: async (lead: BrokerLead) => {
      const { error } = await supabase
        .from("leads_lancamento")
        .update({
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
        tipo: "pool",
        descricao: "Lead devolvido ao pool",
      })

      return lead
    },
    onSuccess: async (lead) => {
      toast.success(`${displayLeadName(lead)} devolvido para o Pool.`)
      setPendingRedistribution(null)
      await invalidateOperationalQueries()
    },
    onError: () => {
      toast.error("Não foi possível devolver o lead para o Pool.")
    },
  })

  const redistributeAllLeadsMutation = useMutation({
    mutationFn: async ({ broker, leads }: { broker: TeamMember; leads: BrokerLead[] }) => {
      if (leads.length === 0) {
        return { broker, total: 0 }
      }

      const leadIds = leads.map((lead) => lead.id)
      const { error } = await supabase
        .from("leads_lancamento")
        .update({
          corretor_id: null,
          assumed_at: null,
          stage_id: null,
        })
        .in("id", leadIds)

      if (error) {
        throw error
      }

      await Promise.all(
        leads.map((lead) =>
          logLeadActivity({
            leadId: lead.id,
            usuarioId: user?.id ?? null,
            tipo: "pool",
            descricao: "Lead devolvido ao pool",
          })
        )
      )

      return { broker, total: leads.length }
    },
    onSuccess: async ({ broker, total }) => {
      toast.success(
        total === 1
          ? `1 lead de ${displayName(broker)} foi devolvido ao Pool.`
          : `${total} leads de ${displayName(broker)} foram devolvidos ao Pool.`
      )
      await invalidateOperationalQueries()
    },
    onError: () => {
      toast.error("Não foi possível devolver todos os leads para o Pool.")
    },
  })

  useEffect(() => {
    if (!isAdmin) {
      return
    }

    const channel = supabase
      .channel("team-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["team-data"] })
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads_lancamento" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["team-data"] })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [isAdmin, queryClient])

  const summary = useMemo(() => {
    const members = teamQuery.data?.members ?? []
    const leads = teamQuery.data?.leads ?? []
    const brokers = members.filter((member) => member.role === "corretor")
    const admins = members.filter((member) => member.role === "admin")
    const activeBrokers = brokers.filter((member) => member.ativo).length
    const inactiveBrokers = brokers.length - activeBrokers
    const assignedByBroker = leads.reduce<Record<string, number>>((acc, lead) => {
      if (!lead.corretor_id || lead.arquivado) {
        return acc
      }

      acc[lead.corretor_id] = (acc[lead.corretor_id] ?? 0) + 1
      return acc
    }, {})

    const activeLeadsByBroker = leads.reduce<Record<string, BrokerLead[]>>((acc, lead) => {
      if (!lead.corretor_id || lead.arquivado) {
        return acc
      }

      acc[lead.corretor_id] ??= []
      acc[lead.corretor_id].push(lead)
      return acc
    }, {})

    return {
      brokers,
      admins,
      activeBrokers,
      inactiveBrokers,
      totalAssigned: Object.values(assignedByBroker).reduce((sum, value) => sum + value, 0),
      assignedByBroker,
      activeLeadsByBroker,
    }
  }, [teamQuery.data?.leads, teamQuery.data?.members])

  const leadsForSelectedBroker = brokerForRedistribution
    ? summary.activeLeadsByBroker[brokerForRedistribution.id] ?? []
    : []

  async function handleCreateUser(values: NewUserFormValues) {
    await createUserMutation.mutateAsync(values)
  }

  function requestStatusChange(member: TeamMember) {
    if (member.ativo) {
      setPendingStatusChange({
        member,
        nextActiveState: false,
      })
      return
    }

    toggleStatusMutation.mutate(member)
  }

  function requestDelete(member: TeamMember, assignedCount: number) {
    if (assignedCount > 0) {
      toast.error("Este corretor ainda possui leads ativos. Reatribua os leads antes de excluir.")
      return
    }

    setPendingDeletion({ member, assignedCount })
  }

  async function confirmDeletion() {
    if (!pendingDeletion) {
      return
    }

    await deleteUserMutation.mutateAsync(pendingDeletion)
  }

  async function confirmStatusChange() {
    if (!pendingStatusChange) {
      return
    }

    await toggleStatusMutation.mutateAsync(pendingStatusChange.member)
  }

  if (!isAdmin) {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Equipe</h1>
        <p className="text-sm text-muted-foreground">Somente administradores podem acessar esta tela.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageIntro
        badge="Pessoas e permissões"
        badgeTone="amber"
        title="Equipe"
        description="Gerencie acessos do time comercial, acompanhe carga por corretor e execute criação ou exclusão por backend seguro."
        aside={
          <div className="grid grid-cols-2 gap-3 rounded-3xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
            <div>
              <p className="text-xs uppercase tracking-[0.18em]">Admins</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{summary.admins.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em]">Corretores</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{summary.brokers.length}</p>
            </div>
          </div>
        }
      />

      {teamQuery.error ? (
        <StatePanel tone="error" centered={false}>
          {teamQuery.error instanceof Error
            ? teamQuery.error.message
            : "Não foi possível carregar a equipe."}
        </StatePanel>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        {[
          {
            label: "Corretores ativos",
            value: summary.activeBrokers,
            icon: UserCheck,
            accent: "text-emerald-600 dark:text-emerald-300",
          },
          {
            label: "Corretores inativos",
            value: summary.inactiveBrokers,
            icon: UserMinus,
            accent: "text-amber-600 dark:text-amber-300",
          },
          {
            label: "Admins ativos",
            value: summary.admins.filter((member) => member.ativo).length,
            icon: Crown,
            accent: "text-violet-600 dark:text-violet-300",
          },
          {
            label: "Leads atribuídos",
            value: summary.totalAssigned,
            icon: ShieldCheck,
            accent: "text-sky-600 dark:text-sky-300",
          },
        ].map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            icon={item.icon}
            accentClassName={item.accent}
          />
        ))}
      </section>

      <section>
        <Card className="rounded-3xl border border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <UserPlus className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
              Novo acesso
            </CardTitle>
            <CardDescription>
              Crie administradores e corretores pela Edge Function segura, sem expor chave privilegiada no navegador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-4" onSubmit={form.handleSubmit(handleCreateUser)}>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="team-name">Nome</Label>
                  <Input
                    id="team-name"
                    placeholder="Ex: Mariana Borges"
                    autoComplete="name"
                    disabled={createUserMutation.isPending}
                    aria-invalid={form.formState.errors.nome ? "true" : "false"}
                    {...form.register("nome")}
                  />
                  {form.formState.errors.nome ? (
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {form.formState.errors.nome.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-email">E-mail</Label>
                  <Input
                    id="team-email"
                    type="email"
                    placeholder="mariana@imobiliaria.com"
                    autoComplete="email"
                    disabled={createUserMutation.isPending}
                    aria-invalid={form.formState.errors.email ? "true" : "false"}
                    {...form.register("email")}
                  />
                  {form.formState.errors.email ? (
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {form.formState.errors.email.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="team-password">Senha inicial</Label>
                  <Input
                    id="team-password"
                    type="password"
                    placeholder="Mínimo de 6 caracteres"
                    autoComplete="new-password"
                    disabled={createUserMutation.isPending}
                    aria-invalid={form.formState.errors.password ? "true" : "false"}
                    {...form.register("password")}
                  />
                  {form.formState.errors.password ? (
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {form.formState.errors.password.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-role">Papel</Label>
                  <Select id="team-role" disabled={createUserMutation.isPending} {...form.register("role")}>
                    <option value="corretor">Corretor</option>
                    <option value="admin">Admin</option>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-status">Status inicial</Label>
                  <Select id="team-status" disabled={createUserMutation.isPending} {...form.register("ativo")}>
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </Select>
                </div>
              </div>

              {createUserMutation.isError ? (
                <p
                  role="alert"
                  className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300"
                >
                  {createUserMutation.error instanceof Error
                    ? createUserMutation.error.message
                    : "Não foi possível criar o usuário."}
                </p>
              ) : null}

              <Button
                type="submit"
                className="h-11 w-full rounded-full"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? "Criando acesso..." : "Criar acesso"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="rounded-3xl border border-border/60 bg-card/90 shadow-sm xl:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Crown className="h-5 w-5 text-violet-600 dark:text-violet-300" />
              Administradores
            </CardTitle>
            <CardDescription>Visão da camada de controle do sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamQuery.isLoading ? <StatePanel>Carregando administradores...</StatePanel> : null}

            {!teamQuery.isLoading && summary.admins.length === 0 ? (
              <StatePanel dashed>Nenhum admin encontrado.</StatePanel>
            ) : null}

            {!teamQuery.isLoading
              ? summary.admins.map((member) => (
                  <div
                    key={member.id}
                    className="min-h-[240px] rounded-3xl border border-border/60 bg-background/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">{displayName(member)}</p>
                        <p className="text-sm text-muted-foreground">{member.email || "Sem e-mail"}</p>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
                          member.ativo
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {member.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>Desde {formatDate(member.created_at)}</span>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          disabled={toggleStatusMutation.isPending}
                          onClick={() => requestStatusChange(member)}
                        >
                          {toggleStatusMutation.isPending && toggleStatusMutation.variables?.id === member.id
                            ? "Atualizando..."
                            : member.ativo
                              ? "Inativar"
                              : "Ativar"}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="rounded-full"
                          disabled={deleteUserMutation.isPending}
                          onClick={() => requestDelete(member, 0)}
                        >
                          {deleteUserMutation.isPending &&
                          deleteUserMutation.variables?.member.id === member.id
                            ? "Excluindo..."
                            : user?.id === member.id
                              ? "Excluir (bloqueado)"
                              : "Excluir"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              : null}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-border/60 bg-card/90 shadow-sm xl:col-span-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
              Corretores
            </CardTitle>
            <CardDescription>
              Disponibilidade, volume de leads e controle operacional do time comercial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {teamQuery.isLoading ? <StatePanel>Carregando corretores...</StatePanel> : null}

            {!teamQuery.isLoading && summary.brokers.length === 0 ? (
              <StatePanel dashed>Nenhum corretor encontrado.</StatePanel>
            ) : null}

            {!teamQuery.isLoading ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {summary.brokers.map((member) => {
                  const assignedCount = summary.assignedByBroker[member.id] ?? 0

                  return (
                    <div
                      key={member.id}
                      className="flex h-full min-h-[240px] flex-col overflow-hidden rounded-3xl border border-border/60 bg-background/60 p-6"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <p className="text-base font-semibold text-foreground">{displayName(member)}</p>
                          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-4 w-4 shrink-0" />
                            <span className="truncate break-all">{member.email || "Sem e-mail"}</span>
                          </div>
                        </div>

                        <span
                          className={`inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
                            member.ativo
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {member.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-3">
                        <div className="flex h-full min-w-0 flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/80 p-3 text-center">
                          <p className="whitespace-nowrap text-xs tracking-[0.16em] text-muted-foreground">Leads ativos</p>
                          <p className="mt-2 whitespace-nowrap text-sm font-medium text-foreground">{assignedCount}</p>
                        </div>
                        <div className="flex h-full min-w-0 flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/80 p-3 text-center">
                          <p className="whitespace-nowrap text-xs tracking-[0.16em] text-muted-foreground">Status</p>
                          <p className="mt-2 whitespace-nowrap text-sm font-medium text-foreground">
                            {member.ativo ? "Disponível" : "Fora da operação"}
                          </p>
                        </div>
                        <div className="flex h-full min-w-0 flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/80 p-3 text-center">
                          <p className="whitespace-nowrap text-xs tracking-[0.16em] text-muted-foreground">Desde</p>
                          <p className="mt-2 whitespace-nowrap text-sm font-medium text-foreground">
                            {formatDate(member.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 border-t border-border/60 pt-4">
                        <div className="flex flex-col gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-12 w-full rounded-full"
                            onClick={() => setBrokerForRedistribution(member)}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Redistribuir leads
                          </Button>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <Button
                              type="button"
                              variant={member.ativo ? "outline" : "default"}
                              className="h-12 w-full rounded-full"
                              disabled={toggleStatusMutation.isPending}
                              onClick={() => requestStatusChange(member)}
                            >
                              {toggleStatusMutation.isPending &&
                              toggleStatusMutation.variables?.id === member.id
                                ? "Atualizando..."
                                : member.ativo
                                  ? "Inativar"
                                  : "Reativar"}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              className="h-12 w-full rounded-full"
                              disabled={deleteUserMutation.isPending || assignedCount > 0}
                              onClick={() => requestDelete(member, assignedCount)}
                            >
                              {deleteUserMutation.isPending &&
                              deleteUserMutation.variables?.member.id === member.id
                                ? "Excluindo..."
                                : "Excluir"}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 min-w-0 text-xs text-muted-foreground">
                        A exclusão definitiva apaga o acesso de autenticação e o profile quando não há leads ativos vinculados.
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Dialog open={Boolean(brokerForRedistribution)} onOpenChange={(open) => !open && setBrokerForRedistribution(null)}>
        <DialogContent className="max-w-3xl rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>
              Redistribuir leads de {brokerForRedistribution ? displayName(brokerForRedistribution) : "corretor"}
            </DialogTitle>
            <DialogDescription>
              Selecione quais leads ativos devem voltar para o Pool sem precisar abrir o detalhe individual.
            </DialogDescription>
          </DialogHeader>

          {brokerForRedistribution ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                {leadsForSelectedBroker.length} lead(s) ativo(s) atribuídos a este corretor.
              </div>

              {leadsForSelectedBroker.length === 0 ? (
                <StatePanel centered={false}>Nenhum lead ativo para redistribuir.</StatePanel>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 rounded-full"
                      disabled={redistributeAllLeadsMutation.isPending}
                      onClick={() =>
                        void redistributeAllLeadsMutation.mutateAsync({
                          broker: brokerForRedistribution,
                          leads: leadsForSelectedBroker,
                        })
                      }
                    >
                      {redistributeAllLeadsMutation.isPending ? "Devolvendo todos..." : "Devolver todos"}
                    </Button>
                  </div>

                  <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                  {leadsForSelectedBroker.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{displayLeadName(lead)}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {lead.email || lead.telefone_contato || "Sem contato principal"}
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-full rounded-full md:w-auto"
                        onClick={() => setPendingRedistribution({ lead, broker: brokerForRedistribution })}
                      >
                        Devolver ao Pool
                      </Button>
                    </div>
                  ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-full"
              onClick={() => setBrokerForRedistribution(null)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingStatusChange)} onOpenChange={(open) => !open && setPendingStatusChange(null)}>
        <DialogContent showCloseButton className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>
              {pendingStatusChange?.nextActiveState ? "Reativar acesso?" : "Inativar acesso?"}
            </DialogTitle>
            <DialogDescription>
              {pendingStatusChange
                ? pendingStatusChange.nextActiveState
                  ? `${displayName(pendingStatusChange.member)} voltará a acessar o CRM normalmente.`
                  : `${displayName(pendingStatusChange.member)} perderá acesso ao CRM, mas todos os leads, notas e atividades serão preservados.`
                : "Confirme a alteração de acesso deste usuário."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-full"
              onClick={() => setPendingStatusChange(null)}
              disabled={toggleStatusMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-12 rounded-full"
              disabled={!pendingStatusChange || toggleStatusMutation.isPending}
              onClick={() => void confirmStatusChange()}
            >
              {toggleStatusMutation.isPending
                ? "Atualizando..."
                : pendingStatusChange?.nextActiveState
                  ? "Confirmar reativação"
                  : "Confirmar inativação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingDeletion)} onOpenChange={(open) => !open && setPendingDeletion(null)}>
        <DialogContent showCloseButton className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>
              Excluir {pendingDeletion ? displayName(pendingDeletion.member) : "usuário"}?
            </DialogTitle>
            <DialogDescription>
              Essa ação remove o acesso do Auth e o registro em <code>profiles</code>. Não há desfazer por esta tela.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-full"
              onClick={() => setPendingDeletion(null)}
              disabled={deleteUserMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-12 rounded-full"
              onClick={() => void confirmDeletion()}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingRedistribution)} onOpenChange={(open) => !open && setPendingRedistribution(null)}>
        <DialogContent showCloseButton className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Devolver lead para o Pool?</DialogTitle>
            <DialogDescription>
              {pendingRedistribution
                ? `${displayLeadName(pendingRedistribution.lead)} será removido da carteira de ${displayName(
                    pendingRedistribution.broker
                  )} e voltará para o Pool.`
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
                pendingRedistribution
                  ? void redistributeLeadMutation.mutateAsync(pendingRedistribution.lead)
                  : undefined
              }
            >
              {redistributeLeadMutation.isPending ? "Devolvendo..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

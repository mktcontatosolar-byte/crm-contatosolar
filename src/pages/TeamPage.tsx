import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Crown,
  Eye,
  EyeOff,
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
import MetricGrid from "@/components/crm/MetricGrid"
import SectionCard from "@/components/crm/SectionCard"
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
import { fetchAssignedLeads, LEAD_SOURCE_TABLE, LEAD_STATE_TABLE, updateLeadState } from "@/lib/crmLeads"
import { logAuditEvent } from "@/lib/auditLogs"
import { safeLogLeadActivity } from "@/lib/leadActivity"
import { ManageUserRequestError, manageUser } from "@/lib/manageUser"
import { ROLE_LABEL } from "@/lib/permissions"
import { supabase } from "@/lib/supabase"
import type { Lead, Profile, UserRole } from "@/types"

type TeamMember = Pick<Profile, "id" | "nome" | "email" | "role" | "ativo" | "created_at">
type BrokerLead = Pick<
  Lead,
  "id" | "nome_completo" | "email" | "telefone_contato" | "corretor_id" | "arquivado"
>

const newUserSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do usuário."),
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha inicial precisa ter ao menos 6 caracteres."),
  role: z.enum(["corretor", "admin", "dono"]),
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

function roleLabel(role: UserRole) {
  return ROLE_LABEL[role]
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
      .in("role", ["dono", "admin", "corretor"])
      .order("role", { ascending: true })
      .order("nome", { ascending: true }),
    fetchAssignedLeads(),
  ])

  if (membersResult.error) {
    throw membersResult.error
  }

  return {
    members: (membersResult.data ?? []) as TeamMember[],
    leads: leadsResult as BrokerLead[],
  }
}

function isAssignedLeadsError(error: unknown) {
  return error instanceof ManageUserRequestError && error.code === "assigned_leads_block"
}

function isSelfDeleteError(error: unknown) {
  return error instanceof ManageUserRequestError && error.code === "self_delete_blocked"
}

export default function TeamPage() {
  const { isAdmin, isOwner, user } = useAuth()
  const queryClient = useQueryClient()
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
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
      try {
        await logAuditEvent({
          actorUserId: user?.id ?? null,
          actorEmail: user?.email ?? null,
          entityType: "team_member",
          entityId: variables.email.trim().toLowerCase(),
          action: "user_created",
          description: `Usuário ${variables.nome.trim()} criado`,
          afterData: {
            nome: variables.nome.trim(),
            email: variables.email.trim().toLowerCase(),
            role: variables.role,
            ativo: variables.ativo === "true",
          },
        })
      } catch (auditError) {
        console.error("Erro ao registrar log de auditoria:", auditError)
      }
      form.reset(initialFormValues)
      toast.success(`${roleLabel(variables.role)} criado com sucesso.`)
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
      try {
        await logAuditEvent({
          actorUserId: user?.id ?? null,
          actorEmail: user?.email ?? null,
          entityType: "team_member",
          entityId: member.id,
          action: "user_status_changed",
          description: `Status de ${displayName(member)} alterado`,
          beforeData: {
            ativo: member.ativo,
          },
          afterData: {
            ativo: !member.ativo,
          },
        })
      } catch (auditError) {
        console.error("Erro ao registrar log de auditoria:", auditError)
      }
      toast.success(
        member.ativo
          ? `${roleLabel(member.role)} inativado com sucesso. O acesso foi removido e os dados foram preservados.`
          : `${roleLabel(member.role)} reativado com sucesso.`
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
      try {
        await logAuditEvent({
          actorUserId: user?.id ?? null,
          actorEmail: user?.email ?? null,
          entityType: "team_member",
          entityId: pendingDeletion?.member.id ?? null,
          action: "user_deleted",
          description: pendingDeletion
            ? `Usuário ${displayName(pendingDeletion.member)} excluído`
            : "Usuário excluído",
          beforeData: pendingDeletion
            ? {
                nome: pendingDeletion.member.nome,
                email: pendingDeletion.member.email,
                role: pendingDeletion.member.role,
                ativo: pendingDeletion.member.ativo,
              }
            : null,
        })
      } catch (auditError) {
        console.error("Erro ao registrar log de auditoria:", auditError)
      }
      toast.success("Usuário excluído com sucesso.")
      setPendingDeletion(null)
      await invalidateOperationalQueries()
    },
    onError: (error) => {
      if (isAssignedLeadsError(error)) {
        toast.error("Este vendedor ainda possui leads ativos. Reatribua os leads antes de excluir.")
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
      }, { context: "team-redistribute-single" })

      try {
        await logAuditEvent({
          actorUserId: user?.id ?? null,
          actorEmail: user?.email ?? null,
          entityType: "lead",
          entityId: lead.id,
          action: "lead_redistributed",
          description: "Lead devolvido ao pool pela equipe",
          beforeData: {
            corretor_id: lead.corretor_id,
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
      toast.success(`${displayLeadName(lead)} voltou para a fila.`)
      setPendingRedistribution(null)
      await invalidateOperationalQueries()
    },
    onError: () => {
      toast.error("Não foi possível devolver esse lead para a fila.")
    },
  })

  const redistributeAllLeadsMutation = useMutation({
    mutationFn: async ({ broker, leads }: { broker: TeamMember; leads: BrokerLead[] }) => {
      if (leads.length === 0) {
        return { broker, total: 0 }
      }

      const leadIds = leads.map((lead) => lead.id)
      await Promise.all(
        leadIds.map((leadId) =>
          updateLeadState(leadId, {
            corretor_id: null,
            assumed_at: null,
            stage_id: null,
          })
        )
      )

      await Promise.all(
        leads.map((lead) =>
          safeLogLeadActivity({
            leadId: lead.id,
            usuarioId: user?.id ?? null,
            tipo: "pool",
            descricao: "Lead devolvido ao pool",
          }, { context: "team-redistribute-bulk" })
        )
      )

      try {
        await logAuditEvent({
          actorUserId: user?.id ?? null,
          actorEmail: user?.email ?? null,
          entityType: "team_member",
          entityId: broker.id,
          action: "leads_redistributed_bulk",
          description: `${leads.length} lead(s) devolvidos ao pool`,
          metadata: {
            total: leads.length,
            lead_ids: leads.map((lead) => lead.id),
          },
        })
      } catch (auditError) {
        console.error("Erro ao registrar log de auditoria:", auditError)
      }

      return { broker, total: leads.length }
    },
    onSuccess: async ({ broker, total }) => {
      toast.success(
        total === 1
          ? `1 lead de ${displayName(broker)} voltou para a fila.`
          : `${total} leads de ${displayName(broker)} voltaram para a fila.`
      )
      await invalidateOperationalQueries()
    },
    onError: () => {
      toast.error("Não foi possível devolver todos os leads para a fila.")
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
        { event: "*", schema: "public", table: LEAD_STATE_TABLE },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["team-data"] })
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: LEAD_SOURCE_TABLE },
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
    const owners = members.filter((member) => member.role === "dono")
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
      owners,
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
    if (!isOwner && member.role !== "corretor") {
      toast.error("Somente um dono pode alterar perfis administrativos.")
      return
    }

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
    if (member.role === "dono" && !isOwner) {
      toast.error("Somente um dono pode excluir outro perfil dono.")
      return
    }

    if (assignedCount > 0) {
      toast.error("Este vendedor ainda possui leads ativos. Reatribua os leads antes de excluir.")
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
        description="Cadastre acessos, acompanhe a equipe e organize a distribuição dos leads."
        aside={
          <div className="grid grid-cols-2 gap-3 rounded-3xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
            <div>
              <p className="text-xs uppercase tracking-[0.18em]">Admins</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{summary.admins.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em]">Donos + vendedores</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {summary.owners.length + summary.brokers.length}
              </p>
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

      <MetricGrid>
        {[
          {
            label: "Vendedores ativos",
            value: summary.activeBrokers,
            icon: UserCheck,
            accent: "text-primary",
          },
          {
            label: "Vendedores inativos",
            value: summary.inactiveBrokers,
            icon: UserMinus,
            accent: "text-accent",
          },
          {
            label: "Admins ativos",
            value: summary.admins.filter((member) => member.ativo).length,
            icon: Crown,
            accent: "text-primary",
          },
          {
            label: "Leads em atendimento",
            value: summary.totalAssigned,
            icon: ShieldCheck,
            accent: "text-primary",
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
      </MetricGrid>

      <section>
          <SectionCard
            title={
              <span className="flex items-center gap-2 text-xl">
                <UserPlus className="h-5 w-5 text-accent" />
                Novo usuário
              </span>
            }
            description={
              isOwner
                ? "Crie donos, administradores e vendedores com segurança, sem expor chave privilegiada no navegador."
                : "Crie vendedores com segurança, sem expor chave privilegiada no navegador."
            }
            tone="highlight"
            contentClassName="space-y-4"
          >
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
                  <div className="relative">
                    <Input
                      id="team-password"
                      type={isPasswordVisible ? "text" : "password"}
                      placeholder="Mínimo de 6 caracteres"
                      autoComplete="new-password"
                      disabled={createUserMutation.isPending}
                      aria-invalid={form.formState.errors.password ? "true" : "false"}
                      className="pr-12"
                      {...form.register("password")}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute right-1 top-1 h-9 w-9 rounded-full"
                      disabled={createUserMutation.isPending}
                      aria-label={isPasswordVisible ? "Ocultar senha" : "Mostrar senha"}
                      onClick={() => setIsPasswordVisible((current) => !current)}
                    >
                      {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {form.formState.errors.password ? (
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {form.formState.errors.password.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-role">Papel</Label>
                  <Select id="team-role" disabled={createUserMutation.isPending} {...form.register("role")}>
                    <option value="corretor">Vendedor</option>
                    {isOwner ? <option value="admin">Admin</option> : null}
                    {isOwner ? <option value="dono">Dono</option> : null}
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
          </SectionCard>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="rounded-3xl border border-border/60 bg-card/92 shadow-sm xl:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Crown className="h-5 w-5 text-accent" />
              Donos e administradores
            </CardTitle>
            <CardDescription>Pessoas com acesso mais alto no sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamQuery.isLoading ? <StatePanel>Carregando administradores...</StatePanel> : null}

            {!teamQuery.isLoading && summary.admins.length === 0 && summary.owners.length === 0 ? (
              <StatePanel dashed>Nenhum perfil administrativo encontrado.</StatePanel>
            ) : null}

            {!teamQuery.isLoading
              ? [...summary.owners, ...summary.admins].map((member) => (
                  <div
                    key={member.id}
                    className="min-h-[220px] rounded-3xl border border-border/60 bg-background/60 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">{displayName(member)}</p>
                        <p className="text-sm text-muted-foreground">{member.email || "Sem e-mail"}</p>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
                          member.ativo ? "crm-badge-brand" : "crm-badge-highlight"
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
                          disabled={toggleStatusMutation.isPending || (!isOwner && member.role !== "corretor")}
                          onClick={() => requestStatusChange(member)}
                        >
                          {toggleStatusMutation.isPending && toggleStatusMutation.variables?.id === member.id
                            ? "Atualizando..."
                            : !isOwner && member.role !== "corretor"
                              ? "Somente dono"
                              : member.ativo
                               ? "Inativar"
                               : "Ativar"}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="rounded-full"
                          disabled={
                            deleteUserMutation.isPending || user?.id === member.id || (member.role === "dono" && !isOwner)
                          }
                          onClick={() => requestDelete(member, 0)}
                        >
                          {deleteUserMutation.isPending && deleteUserMutation.variables?.member.id === member.id
                            ? "Excluindo..."
                            : user?.id === member.id
                              ? "Excluir (bloqueado)"
                              : member.role === "dono" && !isOwner
                                ? "Somente dono"
                                : "Excluir"}
                        </Button>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">Papel atual: {roleLabel(member.role)}</p>
                  </div>
                ))
              : null}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-border/60 bg-card/92 shadow-sm xl:col-span-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5 text-primary" />
              Vendedores
            </CardTitle>
            <CardDescription>
              Veja quem está ativo, quantos leads cada pessoa tem e organize a operação com menos ruído.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {teamQuery.isLoading ? <StatePanel>Carregando vendedores...</StatePanel> : null}

            {!teamQuery.isLoading && summary.brokers.length === 0 ? (
              <StatePanel dashed>Nenhum vendedor encontrado.</StatePanel>
            ) : null}

            {!teamQuery.isLoading ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {summary.brokers.map((member) => {
                  const assignedCount = summary.assignedByBroker[member.id] ?? 0

                  return (
                    <div
                      key={member.id}
                      className="flex h-full min-h-[228px] flex-col overflow-hidden rounded-3xl border border-border/60 bg-background/60 p-5"
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
                            member.ativo ? "crm-badge-brand" : "crm-badge-highlight"
                          }`}
                        >
                          {member.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-3">
                        <div className="flex h-full min-w-0 flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/80 p-3 text-center">
                          <p className="whitespace-nowrap text-xs tracking-[0.16em] text-muted-foreground">Leads em atendimento</p>
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
                            className="h-11 w-full rounded-full border-border/70 bg-background/85"
                            onClick={() => setBrokerForRedistribution(member)}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Repassar leads
                          </Button>

                          <div className="grid gap-2.5 sm:grid-cols-2">
                            <Button
                              type="button"
                              variant={member.ativo ? "outline" : "default"}
                              className="h-11 w-full rounded-full"
                              disabled={toggleStatusMutation.isPending}
                              onClick={() => requestStatusChange(member)}
                            >
                              {toggleStatusMutation.isPending && toggleStatusMutation.variables?.id === member.id
                                ? "Atualizando..."
                                : member.ativo
                                  ? "Inativar"
                                  : "Reativar"}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              className="h-11 w-full rounded-full"
                              disabled={deleteUserMutation.isPending || assignedCount > 0}
                              onClick={() => requestDelete(member, assignedCount)}
                            >
                              {deleteUserMutation.isPending && deleteUserMutation.variables?.member.id === member.id
                                ? "Excluindo..."
                                : "Excluir"}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 min-w-0 text-xs text-muted-foreground">
                        A exclusão definitiva remove o acesso quando não há leads ativos vinculados.
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
      </section>

      <Dialog open={Boolean(brokerForRedistribution)} onOpenChange={(open) => !open && setBrokerForRedistribution(null)}>
        <DialogContent className="max-w-3xl rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>
              Repassar leads de {brokerForRedistribution ? displayName(brokerForRedistribution) : "vendedor"}
            </DialogTitle>
            <DialogDescription>
              Escolha quais leads devem sair da carteira e voltar para a fila.
            </DialogDescription>
          </DialogHeader>

          {brokerForRedistribution ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                {leadsForSelectedBroker.length} lead(s) ativo(s) em atendimento com este vendedor.
              </div>

              {leadsForSelectedBroker.length === 0 ? (
                <StatePanel centered={false}>Nenhum lead para repassar.</StatePanel>
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
                      {redistributeAllLeadsMutation.isPending ? "Voltando todos para a fila..." : "Voltar todos para a fila"}
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
                        Voltar para a fila
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
                  ? `${displayName(pendingStatusChange.member)} poderá acessar o CRM normalmente novamente.`
                  : `${displayName(pendingStatusChange.member)} ficará sem acesso ao CRM, mas os leads, notas e atividades serão mantidos.`
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
                  : "Confirmar pausa"}
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
              Essa ação remove o acesso dessa pessoa ao sistema. Não há desfazer por esta tela.
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
            <DialogTitle>Voltar esse lead para a fila?</DialogTitle>
            <DialogDescription>
              {pendingRedistribution
                ? `${displayLeadName(pendingRedistribution.lead)} vai sair da carteira de ${displayName(
                    pendingRedistribution.broker
                  )} e voltará para a fila.`
                : "Confirme se esse lead deve voltar para a fila."}
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
              {redistributeLeadMutation.isPending ? "Voltando para a fila..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}



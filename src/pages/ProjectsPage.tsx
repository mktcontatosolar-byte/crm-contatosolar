import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import FilterBar from "@/components/crm/FilterBar"
import PageIntro from "@/components/crm/PageIntro"
import { ResponsiveTableWrapper, TableCard } from "@/components/crm/ResponsiveTable"
import SectionCard from "@/components/crm/SectionCard"
import StatePanel from "@/components/crm/StatePanel"
import StatusBadge from "@/components/crm/StatusBadge"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/useAuth"
import { canExportProjects } from "@/lib/permissions"
import { exportProjectsWorkbook } from "@/lib/projectExport"
import {
  archiveProject,
  createProject,
  defaultProjectFilters,
  defaultProjectFormValues,
  fetchProjectSellers,
  fetchProjects,
  getProjectSellerName,
  mapProjectToFormValues,
  updateProject,
} from "@/lib/projects"
import { logAuditEvent } from "@/lib/auditLogs"
import type { ProjectFilters, ProjectFormValues, ProjectRow } from "@/types/projects"

function formatCurrency(value: number | null) {
  if (typeof value !== "number") {
    return "-"
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatBoolean(value: boolean) {
  return value ? "Sim" : "Não"
}

function fieldSections({
  values,
  sellers,
  onChange,
}: {
  values: ProjectFormValues
  sellers: Array<{ id: string; nome: string | null; email: string | null }>
  onChange: <K extends keyof ProjectFormValues>(field: K, value: ProjectFormValues[K]) => void
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Dados do cliente</h3>
          <p className="text-sm text-muted-foreground">Esses campos podem ficar vazios e serem preenchidos depois.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cliente">Cliente</Label>
            <Input id="cliente" value={values.cliente} onChange={(event) => onChange("cliente", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpf_cnpj">CPF/CNPJ</Label>
            <Input id="cpf_cnpj" value={values.cpf_cnpj} onChange={(event) => onChange("cpf_cnpj", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sexo">Sexo</Label>
            <Input id="sexo" value={values.sexo} onChange={(event) => onChange("sexo", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cidade">Cidade</Label>
            <Input id="cidade" value={values.cidade} onChange={(event) => onChange("cidade", event.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Dados comerciais</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="data">Data</Label>
            <Input id="data" type="date" value={values.data} onChange={(event) => onChange("data", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendedor_id">Vendedor</Label>
            <Select
              id="vendedor_id"
              value={values.vendedor_id}
              onChange={(event) => {
                const seller = sellers.find((item) => item.id === event.target.value)
                onChange("vendedor_id", event.target.value)
                onChange("vendedor", seller?.nome || seller?.email || "")
              }}
            >
              <option value="">Sem vendedor</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.nome || seller.email || "Usuário sem nome"}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="marca">Marca</Label>
            <Input id="marca" value={values.marca} onChange={(event) => onChange("marca", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="forma_pagamento">Forma de pagamento</Label>
            <Input
              id="forma_pagamento"
              value={values.forma_pagamento}
              onChange={(event) => onChange("forma_pagamento", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="valor_projeto">Valor do projeto</Label>
            <Input
              id="valor_projeto"
              inputMode="decimal"
              value={values.valor_projeto}
              onChange={(event) => onChange("valor_projeto", event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Valores</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["valor_equipamentos", "Valor dos equipamentos"],
            ["valor_servico", "Valor do serviço"],
            ["custo_instalacao", "Custo de instalação"],
            ["lucro", "Lucro"],
            ["percentual_margem", "Percentual de margem"],
          ].map(([field, label]) => (
            <div key={field} className="space-y-2">
              <Label htmlFor={field}>{label}</Label>
              <Input
                id={field}
                inputMode="decimal"
                value={values[field as keyof ProjectFormValues] as string}
                onChange={(event) =>
                  onChange(field as keyof ProjectFormValues, event.target.value as never)
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Status</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["fechado", "Fechado"],
            ["pago", "Pago"],
            ["parecer_aprovado", "Parecer aprovado"],
            ["entregue", "Entregue"],
            ["instalado", "Instalado"],
          ].map(([field, label]) => (
            <div key={field} className="space-y-2">
              <Label htmlFor={field}>{label}</Label>
              <Select
                id={field}
                value={String(values[field as keyof ProjectFormValues])}
                onChange={(event) =>
                  onChange(field as keyof ProjectFormValues, (event.target.value === "true") as never)
                }
              >
                <option value="false">Não</option>
                <option value="true">Sim</option>
              </Select>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Equipamentos</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["modulos", "Módulos"],
            ["microinversores", "Microinversores"],
            ["w_de_cada_placa", "W de cada placa"],
          ].map(([field, label]) => (
            <div key={field} className="space-y-2">
              <Label htmlFor={field}>{label}</Label>
              <Input
                id={field}
                inputMode="decimal"
                value={values[field as keyof ProjectFormValues] as string}
                onChange={(event) =>
                  onChange(field as keyof ProjectFormValues, event.target.value as never)
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Observações</h3>
        </div>
        <Textarea
          value={values.observacoes}
          onChange={(event) => onChange("observacoes", event.target.value)}
          rows={5}
        />
      </section>
    </div>
  )
}

export default function ProjectsPage() {
  const queryClient = useQueryClient()
  const { user, profile, canManageProjects: canManageProjectsAccess } = useAuth()
  const canExport = canExportProjects(profile?.role)
  const [filters, setFilters] = useState<ProjectFilters>(defaultProjectFilters)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectRow | null>(null)
  const [formValues, setFormValues] = useState<ProjectFormValues>(defaultProjectFormValues)
  const [projectToArchive, setProjectToArchive] = useState<ProjectRow | null>(null)

  const projectsQuery = useQuery({
    queryKey: ["projects", filters],
    queryFn: () => fetchProjects(filters),
  })

  const sellersQuery = useQuery({
    queryKey: ["project-sellers"],
    queryFn: fetchProjectSellers,
  })

  const options = useMemo(() => {
    const projects = projectsQuery.data ?? []
    return {
      cidades: Array.from(new Set(projects.map((project) => project.cidade).filter(Boolean) as string[])).sort(),
      marcas: Array.from(new Set(projects.map((project) => project.marca).filter(Boolean) as string[])).sort(),
    }
  }, [projectsQuery.data])

  const createMutation = useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      if (!user) {
        throw new Error("Sessão inválida.")
      }

      const project = await createProject(values, user.id)
      await logAuditEvent({
        actorUserId: user.id,
        actorEmail: user.email ?? null,
        entityType: "project",
        entityId: project.id,
        action: "project_created",
        description: "Projeto criado no CRM",
        afterData: {
          cliente: project.cliente,
          vendedor: project.vendedor,
          valor_projeto: project.valor_projeto,
          status: project.status,
        },
      })

      return project
    },
    onSuccess: async () => {
      toast.success("Projeto salvo com sucesso.")
      setIsDialogOpen(false)
      setEditingProject(null)
      setFormValues(defaultProjectFormValues)
      await queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o projeto.")
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      if (!user || !editingProject) {
        throw new Error("Sessão ou projeto inválido.")
      }

      const updated = await updateProject(editingProject.id, values, user.id)
      await logAuditEvent({
        actorUserId: user.id,
        actorEmail: user.email ?? null,
        entityType: "project",
        entityId: updated.id,
        action: "project_updated",
        description: "Projeto atualizado no CRM",
        beforeData: {
          cliente: editingProject.cliente,
          valor_projeto: editingProject.valor_projeto,
          status: editingProject.status,
        },
        afterData: {
          cliente: updated.cliente,
          valor_projeto: updated.valor_projeto,
          status: updated.status,
        },
      })

      return updated
    },
    onSuccess: async () => {
      toast.success("Projeto atualizado com sucesso.")
      setIsDialogOpen(false)
      setEditingProject(null)
      setFormValues(defaultProjectFormValues)
      await queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o projeto.")
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async (project: ProjectRow) => {
      if (!user) {
        throw new Error("Sessão inválida.")
      }

      await archiveProject(project.id, user.id)
      await logAuditEvent({
        actorUserId: user.id,
        actorEmail: user.email ?? null,
        entityType: "project",
        entityId: project.id,
        action: "project_archived",
        description: "Projeto arquivado por exclusao logica",
        beforeData: {
          cliente: project.cliente,
          status: project.status,
          ativo: project.ativo,
        },
        afterData: {
          status: "arquivado",
          ativo: false,
        },
      })
    },
    onSuccess: async () => {
      toast.success("Projeto arquivado com sucesso.")
      setProjectToArchive(null)
      await queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível arquivar o projeto.")
    },
  })

  const handleFieldChange = <K extends keyof ProjectFormValues>(
    field: K,
    value: ProjectFormValues[K]
  ) => {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const hasActiveFilters = Object.values(filters).some((value) => value && value !== "all")

  function clearFilters() {
    setFilters(defaultProjectFilters)
  }

  return (
    <div className="space-y-8">
      <PageIntro
        badge="Fonte oficial comercial"
        badgeTone="cyan"
        title="Projetos"
        description="Cadastre, mantenha, filtre e exporte os projetos comerciais direto no CRM, sem depender de planilha como fonte oficial."
        aside={
          <div className="grid grid-cols-2 gap-3 rounded-3xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
            <div>
              <p className="text-xs uppercase tracking-[0.18em]">Projetos ativos</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{projectsQuery.data?.length ?? 0}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em]">Filtro aplicado</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {Object.values(filters).some((value) => value && value !== "all") ? "Sim" : "Não"}
              </p>
            </div>
          </div>
        }
      />

      <SectionCard
        title="Operação de projetos"
        description="Filtre, revise e mantenha a base comercial sem sair do CRM."
        actions={
          <div className="flex flex-wrap gap-2">
            {canExport ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-border/70 bg-background/80"
                onClick={() => projectsQuery.data ? exportProjectsWorkbook(projectsQuery.data) : undefined}
                disabled={!projectsQuery.data || projectsQuery.data.length === 0}
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            ) : null}
            {canManageProjectsAccess ? (
              <Button
                type="button"
                className="rounded-full shadow-sm"
                onClick={() => {
                  setEditingProject(null)
                  setFormValues(defaultProjectFormValues)
                  setIsDialogOpen(true)
                }}
              >
                <Plus className="h-4 w-4" />
                Novo projeto
              </Button>
            ) : null}
          </div>
        }
        contentClassName="space-y-6"
      >
        <FilterBar
          title="Filtros"
          description="Ajuste a visualização da carteira e encontre projetos mais rápido."
          actions={
            hasActiveFilters ? (
              <Button type="button" variant="ghost" className="rounded-2xl" onClick={clearFilters}>
                <X className="h-4 w-4" />
                Limpar filtros
              </Button>
            ) : null
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-2 xl:col-span-2">
                <Label htmlFor="project-search">Busca</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="project-search"
                    className="h-11 pl-10"
                    placeholder="Cliente, CPF/CNPJ, cidade, marca ou vendedor"
                    value={filters.search}
                    onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendedor-filter">Vendedor</Label>
                <Select
                  id="vendedor-filter"
                  className="h-11"
                  value={filters.vendedorId}
                  onChange={(event) => setFilters((current) => ({ ...current, vendedorId: event.target.value }))}
                >
                  <option value="">Todos</option>
                  {(sellersQuery.data ?? []).map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.nome || seller.email || "Usuário sem nome"}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cidade-filter">Cidade</Label>
                <Select
                  id="cidade-filter"
                  className="h-11"
                  value={filters.cidade}
                  onChange={(event) => setFilters((current) => ({ ...current, cidade: event.target.value }))}
                >
                  <option value="">Todas</option>
                  {options.cidades.map((cidade) => (
                    <option key={cidade} value={cidade}>
                      {cidade}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="marca-filter">Marca</Label>
                <Select
                  id="marca-filter"
                  className="h-11"
                  value={filters.marca}
                  onChange={(event) => setFilters((current) => ({ ...current, marca: event.target.value }))}
                >
                  <option value="">Todas</option>
                  {options.marcas.map((marca) => (
                    <option key={marca} value={marca}>
                      {marca}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
              {[
                ["pago", "Pago"],
                ["fechado", "Fechado"],
                ["instalado", "Instalado"],
                ["entregue", "Entregue"],
                ["parecerAprovado", "Parecer aprovado"],
              ].map(([field, label]) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={field}>{label}</Label>
                  <Select
                    id={field}
                    className="h-11"
                    value={filters[field as keyof ProjectFilters] as string}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                  >
                    <option value="all">Todos</option>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </Select>
                </div>
              ))}

              <div className="space-y-2">
                <Label htmlFor="data-inicio">Data inicial</Label>
                <Input
                  id="data-inicio"
                  type="date"
                  className="h-11"
                  value={filters.dataInicio}
                  onChange={(event) => setFilters((current) => ({ ...current, dataInicio: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data-fim">Data final</Label>
                <Input
                  id="data-fim"
                  type="date"
                  className="h-11"
                  value={filters.dataFim}
                  onChange={(event) => setFilters((current) => ({ ...current, dataFim: event.target.value }))}
                />
              </div>
          </div>
        </FilterBar>

          {projectsQuery.isError ? (
            <StatePanel tone="error" centered={false}>
              {projectsQuery.error instanceof Error
                ? projectsQuery.error.message
                : "Não foi possível carregar os projetos."}
            </StatePanel>
          ) : null}

          {projectsQuery.isLoading ? <StatePanel>Carregando projetos...</StatePanel> : null}

          {!projectsQuery.isLoading && (projectsQuery.data?.length ?? 0) === 0 ? (
            <StatePanel dashed>
              Nenhum projeto ativo encontrado com os filtros atuais. Ajuste os filtros ou cadastre o primeiro projeto.
            </StatePanel>
          ) : null}

        {!projectsQuery.isLoading && (projectsQuery.data?.length ?? 0) > 0 ? (
          <TableCard>
            <ResponsiveTableWrapper>
                <table className="min-w-full bg-card/50 text-sm">
                  <thead className="bg-background/90 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <tr>
                      {[
                        "Data",
                        "Cliente",
                        "Vendedor",
                        "Cidade",
                        "Marca",
                        "Valor",
                        "Pago",
                        "Fechado",
                        "Instalado",
                        "Entregue",
                        canManageProjectsAccess ? "Ações" : "Detalhes",
                      ].map((head) => (
                        <th key={head} className="px-4 py-3.5 font-medium">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projectsQuery.data?.map((project) => (
                      <tr key={project.id} className="border-t border-border/60 align-top transition-colors hover:bg-background/45">
                        <td className="px-4 py-4 text-muted-foreground">{project.data || "-"}</td>
                        <td className="px-4 py-4 font-medium text-foreground">
                          <div className="flex min-w-[180px] items-center gap-2">
                            <span>{project.cliente || "Rascunho"}</span>
                            {!project.cliente ? <StatusBadge tone="accent">Rascunho</StatusBadge> : null}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">{getProjectSellerName(project)}</td>
                        <td className="px-4 py-4 text-muted-foreground">{project.cidade || "-"}</td>
                        <td className="px-4 py-4 text-muted-foreground">{project.marca || "-"}</td>
                        <td className="px-4 py-4 font-medium text-foreground">{formatCurrency(project.valor_projeto)}</td>
                        <td className="px-4 py-4">
                          <StatusBadge tone={project.pago ? "accent" : "muted"}>{formatBoolean(project.pago)}</StatusBadge>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge tone={project.fechado ? "primary" : "muted"}>{formatBoolean(project.fechado)}</StatusBadge>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge tone={project.instalado ? "accent" : "muted"}>{formatBoolean(project.instalado)}</StatusBadge>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge tone={project.entregue ? "primary" : "muted"}>{formatBoolean(project.entregue)}</StatusBadge>
                        </td>
                        <td className="px-4 py-4">
                          {canManageProjectsAccess ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-full border-border/70 bg-background/80"
                                onClick={() => {
                                  setEditingProject(project)
                                  setFormValues(mapProjectToFormValues(project))
                                  setIsDialogOpen(true)
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                Editar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="rounded-full"
                                onClick={() => setProjectToArchive(project)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Arquivar
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              Somente dono
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </ResponsiveTableWrapper>
          </TableCard>
        ) : null}
      </SectionCard>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>{editingProject ? "Editar projeto" : "Novo projeto"}</DialogTitle>
            <DialogDescription>
              O cadastro aceita registros incompletos. Salve como rascunho e complete depois.
            </DialogDescription>
          </DialogHeader>

          {fieldSections({
            values: formValues,
            sellers: sellersQuery.data ?? [],
            onChange: handleFieldChange,
          })}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setIsDialogOpen(false)
                setEditingProject(null)
                setFormValues(defaultProjectFormValues)
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="rounded-full"
              disabled={isSubmitting}
              onClick={() =>
                editingProject
                  ? void updateMutation.mutateAsync(formValues)
                  : void createMutation.mutateAsync(formValues)
              }
            >
              {isSubmitting ? "Salvando..." : editingProject ? "Salvar alterações" : "Criar projeto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(projectToArchive)} onOpenChange={(open) => !open && setProjectToArchive(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Arquivar projeto?</DialogTitle>
            <DialogDescription>
              {projectToArchive
                 ? `O projeto de ${projectToArchive.cliente || "cliente não identificado"} será removido apenas por exclusão lógica.`
                 : "Confirme o arquivamento do projeto."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setProjectToArchive(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-full"
              disabled={!projectToArchive || archiveMutation.isPending}
              onClick={() => (projectToArchive ? void archiveMutation.mutateAsync(projectToArchive) : undefined)}
            >
              {archiveMutation.isPending ? "Arquivando..." : "Confirmar arquivamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}




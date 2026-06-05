import { useEffect, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, History, Save, Sun } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import PageIntro from "@/components/crm/PageIntro"
import SectionCard from "@/components/crm/SectionCard"
import StatePanel from "@/components/crm/StatePanel"
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
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/useAuth"
import { fetchCalculadoraConfig, saveSimulacao } from "@/lib/calculadora"
import { calcularSimulacao, getMargemStatus } from "@/lib/calculadoraCalc"
import { exportSimulacaoToExcel } from "@/lib/calculadoraExport"
import { cn } from "@/lib/utils"
import type { CalculadoraConfig, CalculadoraInputs } from "@/types/calculadora"

// ─── tipos do formulário ────────────────────────────────────────────────────
type FormValues = {
  equipamentos: number
  qtd_placas: number
  pot_placa: number
  total_projeto: number
  art: number
  ca: number
  adequacao: number
  taxa_cartao: number
  indicacao: number
  km: number
  imposto_nf_pct: number        // como %, ex: 7 → 7%
  reserva: number
  projetos_vendedor_mes: number // 0 = sem comissão
  usar_comissao_custom: boolean
  comissao_pct_custom: number   // como %, ex: 8.5 → 8,5%
}

const DEFAULT_VALUES: FormValues = {
  equipamentos: 0,
  qtd_placas: 1,
  pot_placa: 0,
  total_projeto: 0,
  art: 0,
  ca: 0,
  adequacao: 0,
  taxa_cartao: 0,
  indicacao: 0,
  km: 0,
  imposto_nf_pct: 0,
  reserva: 0,
  projetos_vendedor_mes: 1,
  usar_comissao_custom: false,
  comissao_pct_custom: 7,
}

// ─── helpers ────────────────────────────────────────────────────────────────
function toNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function toInputs(v: FormValues, config: CalculadoraConfig): CalculadoraInputs {
  const qtd_placas = Math.max(1, toNum(v.qtd_placas))
  return {
    equipamentos: toNum(v.equipamentos),
    qtd_placas,
    pot_placa: toNum(v.pot_placa),
    total_projeto: toNum(v.total_projeto),
    instalacao: qtd_placas * config.custo_instalacao_por_placa, // auto
    art: toNum(v.art),
    ca: toNum(v.ca),
    adequacao: toNum(v.adequacao),
    taxa_cartao: toNum(v.taxa_cartao),
    indicacao: toNum(v.indicacao),
    km: toNum(v.km),
    imposto_nf_pct: toNum(v.imposto_nf_pct) / 100,
    reserva: toNum(v.reserva),
    projetos_vendedor_mes: toNum(v.projetos_vendedor_mes),
    comissao_pct_override: v.usar_comissao_custom
      ? toNum(v.comissao_pct_custom) / 100
      : null,
  }
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const margemStatusClasses = {
  ok: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-destructive",
}

// ─── componentes internos ───────────────────────────────────────────────────
function ResultRow({
  label,
  value,
  dim = false,
  bold = false,
}: {
  label: string
  value: string
  dim?: boolean
  bold?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className={cn("text-sm", dim ? "text-muted-foreground" : "text-foreground/80")}>
        {label}
      </span>
      <span className={cn("text-sm tabular-nums text-foreground", bold && "font-semibold")}>
        {value}
      </span>
    </div>
  )
}

function NumField({
  id,
  label,
  suffix,
  note,
  step = "any",
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  suffix?: string
  note?: string
  step?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min={0}
          step={step}
          className={cn("h-10", suffix && "pr-12", className)}
          {...props}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  )
}

// ─── página ─────────────────────────────────────────────────────────────────
export default function CalculadoraPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const configQuery = useQuery({
    queryKey: ["calculadora-config"],
    queryFn: fetchCalculadoraConfig,
  })

  const form = useForm<FormValues>({ defaultValues: DEFAULT_VALUES })
  const hasAppliedDefaults = useRef(false)

  // preenche defaults do config na primeira carga
  useEffect(() => {
    const config = configQuery.data
    if (config && !hasAppliedDefaults.current) {
      hasAppliedDefaults.current = true
      form.reset({
        ...DEFAULT_VALUES,
        art: config.art_padrao,
        ca: config.ca_padrao,
        imposto_nf_pct: config.imposto_nf_pct_padrao * 100,
        reserva: config.reserva_padrao,
      })
    }
  }, [configQuery.data, form])

  const watched = useWatch({ control: form.control, defaultValue: DEFAULT_VALUES })
  const values = watched as FormValues

  const config = configQuery.data as CalculadoraConfig | undefined
  const resultados = config ? calcularSimulacao(toInputs(values, config), config) : null
  const status = resultados && config ? getMargemStatus(resultados.margem_pct, config) : "ok"

  // campos derivados para exibição
  const qtd = toNum(values.qtd_placas)
  const autoInstalacao = config ? qtd * config.custo_instalacao_por_placa : 0

  // comissão usada
  const projMes = toNum(values.projetos_vendedor_mes)
  const faixaAtual = projMes > 0
    ? config?.comissao_tabela.find((f) => f.qtd === projMes)
    : undefined
  const comissaoPct = values.usar_comissao_custom
    ? toNum(values.comissao_pct_custom)
    : (faixaAtual ? faixaAtual.pct * 100 : 0)

  // save dialog
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState("")

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão inválida.")
      if (!resultados || !config) throw new Error("Resultados não disponíveis.")
      const inputs = toInputs(form.getValues(), config)
      if (inputs.total_projeto <= 0)
        throw new Error("Preencha o valor total do projeto.")
      if (!saveName.trim()) throw new Error("Informe um nome para a simulação.")
      return saveSimulacao(user.id, saveName.trim(), inputs, resultados)
    },
    onSuccess: async () => {
      toast.success("Simulação salva com sucesso.")
      setSaveOpen(false)
      setSaveName("")
      await queryClient.invalidateQueries({ queryKey: ["calculadora-simulacoes"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.")
    },
  })

  function handleExport() {
    if (!resultados || !config) return
    void exportSimulacaoToExcel({
      nome: "Simulação atual",
      inputs: toInputs(form.getValues(), config),
      resultados,
    })
  }

  function handleOpenSave() {
    if (!config) {
      toast.error("Configuração da calculadora não carregou. Recarregue a página.")
      return
    }
    const inputs = toInputs(form.getValues(), config)
    if (inputs.total_projeto <= 0) {
      toast.error("Preencha o valor total do projeto antes de salvar.")
      return
    }
    setSaveName(`Projeto R$ ${Math.round(inputs.total_projeto / 1000)}k`)
    setSaveOpen(true)
  }

  if (configQuery.isError) {
    return (
      <StatePanel tone="error">
        Erro ao carregar a configuração da calculadora. Contate o administrador.
      </StatePanel>
    )
  }

  const reg = form.register

  return (
    <div className="space-y-8">
      <PageIntro
        badge="Ferramenta comercial"
        badgeTone="cyan"
        title="Calculadora Solar"
        description="Simule o resultado financeiro de um projeto. Instalação calculada automaticamente com base na tabela de configuração."
      />

      {configQuery.isLoading ? (
        <StatePanel>Carregando calculadora...</StatePanel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">

          {/* ── FORMULÁRIO ── */}
          <div className="space-y-6 lg:col-span-7">

            {/* Sistema solar */}
            <SectionCard title="Sistema solar" contentClassName="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumField
                id="total_projeto"
                label="Total do projeto"
                suffix="R$"
                {...reg("total_projeto", { valueAsNumber: true })}
              />
              <NumField
                id="equipamentos"
                label="Equipamentos"
                suffix="R$"
                {...reg("equipamentos", { valueAsNumber: true })}
              />
              <NumField
                id="qtd_placas"
                label="Qtd. de placas"
                step="1"
                min={1}
                {...reg("qtd_placas", { valueAsNumber: true })}
              />
              <NumField
                id="pot_placa"
                label="Potência por placa"
                suffix="W"
                {...reg("pot_placa", { valueAsNumber: true })}
              />
              {config ? (
                <div className="col-span-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Instalação automática:{" "}
                  <span className="font-medium text-foreground">
                    {Math.max(1, qtd)} placas × {formatBRL(config.custo_instalacao_por_placa)}/placa
                    {" = "}
                    <span className="text-foreground font-semibold">{formatBRL(autoInstalacao)}</span>
                  </span>
                </div>
              ) : null}
            </SectionCard>

            {/* Instalação */}
            <SectionCard title="Instalação e serviço" contentClassName="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumField
                id="art"
                label="ART"
                suffix="R$"
                {...reg("art", { valueAsNumber: true })}
              />
              <NumField
                id="ca"
                label="CA"
                suffix="R$"
                {...reg("ca", { valueAsNumber: true })}
              />
              <NumField
                id="adequacao"
                label="Adequação de padrão"
                suffix="R$"
                className="col-span-2 sm:col-span-1"
                {...reg("adequacao", { valueAsNumber: true })}
              />
            </SectionCard>

            {/* Custos variáveis */}
            <SectionCard title="Custos variáveis" contentClassName="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumField
                id="indicacao"
                label="Indicação"
                suffix="R$"
                {...reg("indicacao", { valueAsNumber: true })}
              />
              <NumField
                id="km"
                label="Distância"
                suffix="km"
                note={config ? `Custo: km × R$ ${config.custo_km_multiplicador.toFixed(2)}` : undefined}
                {...reg("km", { valueAsNumber: true })}
              />
              <NumField
                id="taxa_cartao"
                label="Custo cartão / financ."
                suffix="R$"
                {...reg("taxa_cartao", { valueAsNumber: true })}
              />
              <NumField
                id="reserva"
                label="Reserva pós-venda"
                suffix="R$"
                {...reg("reserva", { valueAsNumber: true })}
              />
            </SectionCard>

            {/* Tributação e comissão */}
            <SectionCard title="Tributação e comissão" contentClassName="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NumField
                  id="imposto_nf_pct"
                  label="Imposto NF"
                  suffix="%"
                  step="0.01"
                  {...reg("imposto_nf_pct", { valueAsNumber: true })}
                />

                {/* Select com Radix — corrige visual no dark mode */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="projetos-mes"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Projetos / mês
                  </Label>
                  <SelectRoot
                    value={String(toNum(values.projetos_vendedor_mes))}
                    onValueChange={(v) =>
                      form.setValue("projetos_vendedor_mes", Number(v))
                    }
                  >
                    <SelectTrigger id="projetos-mes" className="h-10">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">
                        Sem comissão / Sem ajuda
                      </SelectItem>
                      {config?.comissao_tabela.map((f) => (
                        <SelectItem key={f.qtd} value={String(f.qtd)}>
                          {f.qtd} projeto{f.qtd > 1 ? "s" : ""} —{" "}
                          {(f.pct * 100).toFixed(1)}% + R$ {f.ajuda} ajuda
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectRoot>
                </div>
              </div>

              {/* Personalizar comissão desta simulação */}
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3">
                <label className="flex cursor-pointer items-center gap-2.5 select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer accent-primary"
                    {...reg("usar_comissao_custom")}
                  />
                  <span className="text-sm text-foreground">
                    Personalizar % da comissão só para esta simulação
                  </span>
                </label>

                {values.usar_comissao_custom ? (
                  <div className="grid grid-cols-2 gap-4">
                    <NumField
                      id="comissao_pct_custom"
                      label="Comissão personalizada"
                      suffix="%"
                      step="0.1"
                      note={`Padrão para ${projMes > 0 ? projMes + " proj." : "sem comissão"}: ${faixaAtual ? (faixaAtual.pct * 100).toFixed(1) + "%" : "0%"}`}
                      {...reg("comissao_pct_custom", { valueAsNumber: true })}
                    />
                  </div>
                ) : null}
              </div>
            </SectionCard>
          </div>

          {/* ── RESULTADO ── */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-6 space-y-4">
              <SectionCard
                title={
                  <span className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-amber-500" strokeWidth={1.8} />
                    Resultado
                  </span>
                }
                tone={status === "ok" ? "highlight" : "default"}
                contentClassName="space-y-4"
              >
                {/* Sistema */}
                <div className="space-y-0.5">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Sistema
                  </p>
                  <ResultRow
                    label="kWp instalado"
                    value={`${resultados?.kwp.toFixed(3) ?? "—"} kWp`}
                  />
                  <ResultRow
                    label="R$/Wp (serviço)"
                    value={resultados ? formatBRL(resultados.watt_pico) : "—"}
                  />
                  <ResultRow
                    label="Geração est."
                    value={`${resultados?.geracao_kwh_mes.toFixed(0) ?? "—"} kWh/mês`}
                  />
                  <ResultRow
                    label="Serviço"
                    value={resultados ? formatBRL(resultados.servico) : "—"}
                  />
                </div>

                <div className="border-t border-border/40" />

                {/* Custos */}
                <div className="space-y-0.5">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Custos deduzidos
                  </p>
                  <ResultRow
                    label={`Instalação (auto)`}
                    value={formatBRL(autoInstalacao)}
                    dim
                  />
                  <ResultRow
                    label="ART + CA"
                    value={resultados
                      ? formatBRL(toNum(values.art) + toNum(values.ca))
                      : "—"}
                    dim
                  />
                  <ResultRow
                    label="Total instalação"
                    value={resultados ? formatBRL(resultados.total_inst) : "—"}
                    bold
                  />
                  <ResultRow
                    label={`Comissão${values.usar_comissao_custom ? ` (${comissaoPct.toFixed(1)}% custom)` : projMes === 0 ? " (sem)" : ` (${comissaoPct.toFixed(1)}%)`}`}
                    value={resultados ? formatBRL(resultados.comissao_val) : "—"}
                    dim
                  />
                  {projMes > 0 ? (
                    <ResultRow
                      label="Ajuda de custo"
                      value={resultados ? formatBRL(resultados.ajuda_custo) : "—"}
                      dim
                    />
                  ) : null}
                  <ResultRow
                    label="Deslocamento"
                    value={resultados ? formatBRL(resultados.desl_custo) : "—"}
                    dim
                  />
                  <ResultRow
                    label="Imposto NF"
                    value={resultados ? formatBRL(resultados.imposto_val) : "—"}
                    dim
                  />
                </div>

                <div className="border-t border-border/40" />

                {/* Resultado */}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">Lucro líquido</span>
                    <span className="text-2xl font-semibold tabular-nums text-foreground">
                      {resultados ? formatBRL(resultados.lucro_liquido) : "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">Margem</span>
                    <span
                      className={cn(
                        "text-2xl font-semibold tabular-nums",
                        resultados ? margemStatusClasses[status] : "text-muted-foreground",
                      )}
                    >
                      {resultados ? `${resultados.margem_pct.toFixed(2)}%` : "—"}
                    </span>
                  </div>
                  {config && resultados ? (
                    <p className={cn("text-xs", margemStatusClasses[status])}>
                      {status === "ok"
                        ? `✓ Acima da meta de ${config.margem_meta}%`
                        : status === "warning"
                          ? `Abaixo da meta de ${config.margem_meta}% — revisar`
                          : "Margem crítica — projeto no prejuízo"}
                    </p>
                  ) : null}
                </div>

                <div className="border-t border-border/40" />

                {/* Ações */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="flex-1 rounded-full shadow-sm"
                    onClick={handleOpenSave}
                    disabled={!resultados}
                  >
                    <Save className="h-4 w-4" />
                    Salvar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-full border-border/70"
                    onClick={handleExport}
                    disabled={!resultados}
                  >
                    <Download className="h-4 w-4" />
                    Exportar
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full rounded-full text-muted-foreground"
                  onClick={() => navigate("/calculadora/historico")}
                >
                  <History className="h-4 w-4" />
                  Ver histórico de simulações
                </Button>
              </SectionCard>
            </div>
          </div>
        </div>
      )}

      {/* Dialog de salvar */}
      <Dialog
        open={saveOpen}
        onOpenChange={(v) => !saveMutation.isPending && setSaveOpen(v)}
      >
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Salvar simulação</DialogTitle>
            <DialogDescription>
              Escolha um nome para identificar esta simulação no histórico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="save-name">Nome da simulação</Label>
            <Input
              id="save-name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Ex: Cliente João — 7 kWp"
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveMutation.mutateAsync()
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setSaveOpen(false)}
              disabled={saveMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="rounded-full"
              disabled={saveMutation.isPending || !saveName.trim()}
              onClick={() => void saveMutation.mutateAsync()}
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

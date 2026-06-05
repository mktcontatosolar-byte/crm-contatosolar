import { useEffect } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Settings2 } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import PageIntro from "@/components/crm/PageIntro"
import SectionCard from "@/components/crm/SectionCard"
import StatePanel from "@/components/crm/StatePanel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fetchCalculadoraConfig, updateCalculadoraConfig } from "@/lib/calculadora"
import type { CalculadoraConfig } from "@/types/calculadora"

// ─── schema ─────────────────────────────────────────────────────────────────
const faixaSchema = z.object({
  qtd: z.number().int(),
  pct_display: z.number().min(0).max(100),
  ajuda: z.number().min(0),
})

const configSchema = z.object({
  margem_meta: z.number().min(0).max(100),
  custo_km_multiplicador: z.number().min(0),
  custo_instalacao_por_placa: z.number().min(0),
  art_padrao: z.number().min(0),
  ca_padrao: z.number().min(0),
  imposto_nf_pct_display: z.number().min(0).max(100), // como %
  reserva_padrao: z.number().min(0),
  comissao_tabela: z.array(faixaSchema),
})

type ConfigFormValues = z.infer<typeof configSchema>

function configToForm(config: CalculadoraConfig): ConfigFormValues {
  return {
    margem_meta: config.margem_meta,
    custo_km_multiplicador: config.custo_km_multiplicador,
    custo_instalacao_por_placa: config.custo_instalacao_por_placa,
    art_padrao: config.art_padrao,
    ca_padrao: config.ca_padrao,
    imposto_nf_pct_display: +(config.imposto_nf_pct_padrao * 100).toFixed(2),
    reserva_padrao: config.reserva_padrao,
    comissao_tabela: config.comissao_tabela.map((f) => ({
      qtd: f.qtd,
      pct_display: +(f.pct * 100).toFixed(2),
      ajuda: f.ajuda,
    })),
  }
}

// ─── sub-componentes ─────────────────────────────────────────────────────────
function FieldGroup({
  label,
  htmlFor,
  note,
  children,
}: {
  label: string
  htmlFor?: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="font-medium">
        {label}
      </Label>
      {children}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  )
}

function NumInput({
  id,
  suffix,
  step = "0.01",
  min = 0,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  suffix?: string
  step?: string
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        step={step}
        min={min}
        className={suffix ? "pr-12" : undefined}
        {...props}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </div>
  )
}

// ─── página ──────────────────────────────────────────────────────────────────
export default function CalculadoraConfigPage() {
  const queryClient = useQueryClient()

  const configQuery = useQuery({
    queryKey: ["calculadora-config"],
    queryFn: fetchCalculadoraConfig,
  })

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      margem_meta: 16.5,
      custo_km_multiplicador: 1.1,
      custo_instalacao_por_placa: 100,
      art_padrao: 350,
      ca_padrao: 800,
      imposto_nf_pct_display: 0,
      reserva_padrao: 0,
      comissao_tabela: [],
    },
  })

  const { fields } = useFieldArray({ control: form.control, name: "comissao_tabela" })

  useEffect(() => {
    if (configQuery.data) {
      form.reset(configToForm(configQuery.data))
    }
  }, [configQuery.data, form])

  const updateMutation = useMutation({
    mutationFn: async (values: ConfigFormValues) => {
      if (!configQuery.data) throw new Error("Config não carregada.")
      return updateCalculadoraConfig(configQuery.data.id, {
        margem_meta: values.margem_meta,
        custo_km_multiplicador: values.custo_km_multiplicador,
        custo_instalacao_por_placa: values.custo_instalacao_por_placa,
        art_padrao: values.art_padrao,
        ca_padrao: values.ca_padrao,
        imposto_nf_pct_padrao: values.imposto_nf_pct_display / 100,
        reserva_padrao: values.reserva_padrao,
        comissao_tabela: values.comissao_tabela.map((f) => ({
          qtd: f.qtd,
          pct: f.pct_display / 100,
          ajuda: f.ajuda,
        })),
      })
    },
    onSuccess: async () => {
      toast.success("Configuração salva com sucesso.")
      await queryClient.invalidateQueries({ queryKey: ["calculadora-config"] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar a configuração.",
      )
    },
  })

  if (configQuery.isError) {
    return (
      <StatePanel tone="error">
        Erro ao carregar a configuração. Verifique se o seed do banco foi executado.
      </StatePanel>
    )
  }

  const { formState: { errors } } = form

  return (
    <div className="space-y-8">
      <PageIntro
        badge="Configuração administrativa"
        badgeTone="amber"
        title="Config. Calculadora"
        description="Defina todos os parâmetros que controlam os cálculos da calculadora de projetos solares."
      />

      {configQuery.isLoading ? (
        <StatePanel>Carregando configuração...</StatePanel>
      ) : (
        <form
          onSubmit={form.handleSubmit((v) => void updateMutation.mutateAsync(v))}
          className="space-y-6"
        >
          {/* ── Resultado esperado ── */}
          <SectionCard
            title="Resultado esperado"
            description="Define os gatilhos de alerta na calculadora."
            contentClassName="grid gap-6 sm:grid-cols-2"
          >
            <FieldGroup
              label="Meta de margem (%)"
              htmlFor="margem_meta"
              note="Projetos abaixo desta margem entram em alerta amarelo."
            >
              <NumInput
                id="margem_meta"
                step="0.1"
                suffix="%"
                {...form.register("margem_meta", { valueAsNumber: true })}
              />
              {errors.margem_meta ? (
                <p className="text-xs text-destructive">{errors.margem_meta.message}</p>
              ) : null}
            </FieldGroup>
          </SectionCard>

          {/* ── Deslocamento ── */}
          <SectionCard
            title="Deslocamento"
            description="Custo por km calculado automaticamente na calculadora."
            contentClassName="grid gap-6 sm:grid-cols-2"
          >
            <FieldGroup
              label="Custo por km"
              htmlFor="custo_km"
              note="Custo deslocamento = distância × este valor. Planilha padrão: R$ 1,10/km."
            >
              <NumInput
                id="custo_km"
                step="0.01"
                suffix="R$/km"
                {...form.register("custo_km_multiplicador", { valueAsNumber: true })}
              />
              {errors.custo_km_multiplicador ? (
                <p className="text-xs text-destructive">{errors.custo_km_multiplicador.message}</p>
              ) : null}
            </FieldGroup>
          </SectionCard>

          {/* ── Instalação padrão ── */}
          <SectionCard
            title="Instalação padrão"
            description="Valores usados para pré-preencher a calculadora. Cada campo pode ser ajustado na simulação."
            contentClassName="grid gap-6 sm:grid-cols-3"
          >
            <FieldGroup
              label="Custo por placa"
              htmlFor="custo_placa"
              note="Instalação = qtd. placas × este valor."
            >
              <NumInput
                id="custo_placa"
                step="10"
                suffix="R$"
                {...form.register("custo_instalacao_por_placa", { valueAsNumber: true })}
              />
              {errors.custo_instalacao_por_placa ? (
                <p className="text-xs text-destructive">
                  {errors.custo_instalacao_por_placa.message}
                </p>
              ) : null}
            </FieldGroup>

            <FieldGroup label="ART padrão" htmlFor="art_padrao">
              <NumInput
                id="art_padrao"
                step="50"
                suffix="R$"
                {...form.register("art_padrao", { valueAsNumber: true })}
              />
            </FieldGroup>

            <FieldGroup label="CA padrão" htmlFor="ca_padrao">
              <NumInput
                id="ca_padrao"
                step="50"
                suffix="R$"
                {...form.register("ca_padrao", { valueAsNumber: true })}
              />
            </FieldGroup>
          </SectionCard>

          {/* ── Tributação e reserva ── */}
          <SectionCard
            title="Tributação e reserva"
            description="Valores padrão que pré-preenchem a calculadora."
            contentClassName="grid gap-6 sm:grid-cols-2"
          >
            <FieldGroup
              label="Imposto NF padrão"
              htmlFor="imposto_nf"
              note='Use "0" para não incluir imposto por padrão.'
            >
              <NumInput
                id="imposto_nf"
                step="0.01"
                suffix="%"
                {...form.register("imposto_nf_pct_display", { valueAsNumber: true })}
              />
              {errors.imposto_nf_pct_display ? (
                <p className="text-xs text-destructive">
                  {errors.imposto_nf_pct_display.message}
                </p>
              ) : null}
            </FieldGroup>

            <FieldGroup
              label="Reserva pós-venda padrão"
              htmlFor="reserva_padrao"
              note='Use "0" para não incluir reserva por padrão.'
            >
              <NumInput
                id="reserva_padrao"
                step="50"
                suffix="R$"
                {...form.register("reserva_padrao", { valueAsNumber: true })}
              />
            </FieldGroup>
          </SectionCard>

          {/* ── Tabela de comissão ── */}
          <SectionCard
            title="Tabela de comissão"
            description="Comissão e ajuda de custo por faixa de produtividade. Use 0% e R$ 0 para remover comissão de uma faixa."
            contentClassName="space-y-4"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    {["Projetos/mês", "Comissão (%)", "Ajuda de custo (R$)"].map((h) => (
                      <th
                        key={h}
                        className="py-2 pr-6 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {fields.map((field, index) => (
                    <tr key={field.id}>
                      <td className="py-3 pr-6">
                        <span className="flex h-10 w-14 items-center rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
                          {field.qtd}
                        </span>
                        <input
                          type="hidden"
                          {...form.register(`comissao_tabela.${index}.qtd`, {
                            valueAsNumber: true,
                          })}
                        />
                      </td>
                      <td className="py-3 pr-4 min-w-[100px]">
                        <NumInput
                          id={`pct-${index}`}
                          step="0.1"
                          suffix="%"
                          className="w-full"
                          {...form.register(`comissao_tabela.${index}.pct_display`, {
                            valueAsNumber: true,
                          })}
                        />
                      </td>
                      <td className="py-3 min-w-[110px]">
                        <NumInput
                          id={`ajuda-${index}`}
                          step="50"
                          suffix="R$"
                          className="w-full"
                          {...form.register(`comissao_tabela.${index}.ajuda`, {
                            valueAsNumber: true,
                          })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              A opção "Sem comissão / Sem ajuda" está sempre disponível na calculadora sem precisar de linha aqui.
            </p>
          </SectionCard>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() =>
                configQuery.data && form.reset(configToForm(configQuery.data))
              }
              disabled={updateMutation.isPending}
            >
              Descartar alterações
            </Button>
            <Button
              type="submit"
              className="rounded-full shadow-sm"
              disabled={updateMutation.isPending}
            >
              <Settings2 className="h-4 w-4" />
              {updateMutation.isPending ? "Salvando..." : "Salvar configuração"}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

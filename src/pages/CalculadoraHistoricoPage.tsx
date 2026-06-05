import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Download } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import FilterBar from "@/components/crm/FilterBar"
import PageIntro from "@/components/crm/PageIntro"
import { ResponsiveTableWrapper, TableCard } from "@/components/crm/ResponsiveTable"
import SectionCard from "@/components/crm/SectionCard"
import StatePanel from "@/components/crm/StatePanel"
import StatusBadge from "@/components/crm/StatusBadge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { useAuth } from "@/contexts/useAuth"
import { fetchSimulacoes } from "@/lib/calculadora"
import { exportSimulacaoToExcel, simToExportData } from "@/lib/calculadoraExport"
import { formatCrmDate } from "@/lib/dateTime"
import type { CalculadoraSimulacao } from "@/types/calculadora"

const formatBRL = (v: number | null | undefined) => {
  if (v == null) return "—"
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}

const margemStatusTone = (
  v: number | null | undefined,
): "accent" | "outline" | "muted" => {
  if (v == null) return "muted"
  if (v >= 10) return "accent"
  if (v >= 5) return "outline"
  return "muted"
}

function exportRow(sim: CalculadoraSimulacao) {
  void exportSimulacaoToExcel(simToExportData(sim)).catch(() => {
    toast.error("Erro ao exportar a simulação.")
  })
}

export default function CalculadoraHistoricoPage() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [vendedorFilter, setVendedorFilter] = useState("")

  const simsQuery = useQuery({
    queryKey: ["calculadora-simulacoes"],
    queryFn: fetchSimulacoes,
  })

  const sellers = useMemo(() => {
    const map = new Map<string, string>()
    for (const sim of simsQuery.data ?? []) {
      map.set(sim.criado_por, sim.criado_por_nome ?? sim.criado_por)
    }
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }))
  }, [simsQuery.data])

  const filtered = useMemo(() => {
    const rows = simsQuery.data ?? []
    if (!vendedorFilter) return rows
    return rows.filter((s) => s.criado_por === vendedorFilter)
  }, [simsQuery.data, vendedorFilter])

  return (
    <div className="space-y-8">
      <PageIntro
        badge="Histórico de simulações"
        badgeTone="cyan"
        title="Histórico"
        description={
          isAdmin
            ? "Todas as simulações salvas pela equipe. Filtre por vendedor ou exporte individualmente."
            : "Suas simulações salvas. Exporte qualquer uma para .xlsx."
        }
        aside={
          <div className="flex gap-3 rounded-3xl border border-border/60 bg-background/70 p-4 text-sm">
            <div className="pr-4 text-center">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Total
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {filtered.length}
              </p>
            </div>
          </div>
        }
      />

      <SectionCard
        title="Simulações"
        actions={
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-border/70"
            onClick={() => navigate("/calculadora")}
          >
            Nova simulação
          </Button>
        }
        contentClassName="space-y-6"
      >
        {isAdmin && sellers.length > 0 ? (
          <FilterBar title="Filtros">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="vendedor-filter">Vendedor</Label>
                <Select
                  id="vendedor-filter"
                  className="h-11"
                  value={vendedorFilter}
                  onChange={(e) => setVendedorFilter(e.target.value)}
                >
                  <option value="">Todos</option>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </FilterBar>
        ) : null}

        {simsQuery.isLoading ? <StatePanel>Carregando histórico...</StatePanel> : null}

        {simsQuery.isError ? (
          <StatePanel tone="error">
            {simsQuery.error instanceof Error
              ? simsQuery.error.message
              : "Não foi possível carregar o histórico."}
          </StatePanel>
        ) : null}

        {!simsQuery.isLoading && filtered.length === 0 ? (
          <StatePanel dashed>
            {vendedorFilter
              ? "Nenhuma simulação encontrada para este vendedor."
              : "Nenhuma simulação salva ainda. Use a calculadora para criar a primeira."}
          </StatePanel>
        ) : null}

        {!simsQuery.isLoading && filtered.length > 0 ? (
          <TableCard>
            <ResponsiveTableWrapper>
              <table className="min-w-full bg-card/50 text-sm">
                <thead className="bg-background/90 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3.5 font-medium">Simulação</th>
                    {isAdmin ? <th className="hidden md:table-cell px-4 py-3.5 font-medium">Vendedor</th> : null}
                    <th className="hidden sm:table-cell px-4 py-3.5 font-medium">Data</th>
                    <th className="hidden lg:table-cell px-4 py-3.5 font-medium">kWp</th>
                    <th className="hidden sm:table-cell px-4 py-3.5 font-medium">Total</th>
                    <th className="hidden sm:table-cell px-4 py-3.5 font-medium">Lucro</th>
                    <th className="px-4 py-3.5 font-medium">Margem</th>
                    <th className="px-4 py-3.5 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sim) => (
                    <tr
                      key={sim.id}
                      className="border-t border-border/60 align-middle transition-colors hover:bg-background/45"
                    >
                      <td className="px-4 py-3.5 font-medium text-foreground">
                        {sim.nome_simulacao}
                      </td>
                      {isAdmin ? (
                        <td className="hidden md:table-cell px-4 py-3.5 text-muted-foreground">
                          {sim.criado_por_nome ?? "—"}
                        </td>
                      ) : null}
                      <td className="hidden sm:table-cell px-4 py-3.5 text-muted-foreground">
                        {formatCrmDate(sim.criado_em)}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3.5 tabular-nums text-muted-foreground">
                        {sim.kwp != null ? `${sim.kwp.toFixed(2)} kWp` : "—"}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3.5 tabular-nums text-foreground">
                        {formatBRL(sim.total_projeto)}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3.5 tabular-nums text-foreground">
                        {formatBRL(sim.lucro_liquido)}
                      </td>
                      <td className="px-4 py-3.5">
                        {sim.margem_pct != null ? (
                          <StatusBadge tone={margemStatusTone(sim.margem_pct)}>
                            {sim.margem_pct.toFixed(2)}%
                          </StatusBadge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full border-border/70 bg-background/80"
                          onClick={() => exportRow(sim)}
                        >
                          <Download className="h-4 w-4" />
                          Exportar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTableWrapper>
          </TableCard>
        ) : null}
      </SectionCard>
    </div>
  )
}

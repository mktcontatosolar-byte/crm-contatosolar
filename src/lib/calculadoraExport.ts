import { formatCrmDateForFile, formatCrmDateTime } from "@/lib/dateTime"
import type { CalculadoraInputs, CalculadoraResultados, CalculadoraSimulacao } from "@/types/calculadora"

const EMPTY_VALUE = "—"
const HEADER_FILL = "FF0F766E"
const HEADER_TEXT = "FFFFFFFF"
const BORDER_COLOR = "FFD7DEE7"
const SECTION_FILL = "FFECFDF5"
const LABEL_FILL = "FFF8FAFC"

type ExportData = {
  nome: string
  vendedor?: string
  criado_em?: string
  inputs: CalculadoraInputs
  resultados: CalculadoraResultados
}

function applyThinBorder(cell: { border?: unknown }) {
  cell.border = {
    top: { style: "thin", color: { argb: BORDER_COLOR } },
    left: { style: "thin", color: { argb: BORDER_COLOR } },
    bottom: { style: "thin", color: { argb: BORDER_COLOR } },
    right: { style: "thin", color: { argb: BORDER_COLOR } },
  }
}

function downloadBuffer(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

const formatBRL = (v: number | null | undefined) => {
  if (v == null) return EMPTY_VALUE
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}

const formatPct = (v: number | null | undefined, decimals = 2) => {
  if (v == null) return EMPTY_VALUE
  return `${v.toFixed(decimals)}%`
}

export async function exportSimulacaoToExcel(data: ExportData): Promise<void> {
  const ExcelJS = await import("exceljs")
  const workbook = new ExcelJS.Workbook()
  const generatedAt = new Date()
  const fileName = `simulacao-solar-${formatCrmDateForFile(generatedAt)}.xlsx`

  workbook.creator = "CRM Contato Solar"
  workbook.created = generatedAt

  const sheet = workbook.addWorksheet("Simulação", { views: [{ zoomScale: 95 }] })
  sheet.columns = [{ width: 34 }, { width: 24 }]

  function addTitle(text: string) {
    const row = sheet.addRow([text])
    const cell = row.getCell(1)
    cell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FF0F172A" } }
    row.height = 30
  }

  function addSubtitle(text: string) {
    const row = sheet.addRow([text])
    row.getCell(1).font = { name: "Calibri", size: 11, color: { argb: "FF475569" } }
    row.height = 20
  }

  function addSection(title: string) {
    sheet.addRow([])
    const row = sheet.addRow([title])
    const c1 = row.getCell(1)
    const c2 = row.getCell(2)
    c1.value = title
    c1.font = { name: "Calibri", size: 11, bold: true, color: { argb: HEADER_TEXT } }
    c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } }
    c1.alignment = { vertical: "middle" }
    applyThinBorder(c1)
    c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } }
    applyThinBorder(c2)
    row.height = 24
  }

  function addRow(label: string, value: string, highlight = false) {
    const row = sheet.addRow([label, value])
    const labelCell = row.getCell(1)
    const valueCell = row.getCell(2)
    labelCell.font = { name: "Calibri", size: 11, color: { argb: "FF475569" } }
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LABEL_FILL } }
    valueCell.font = {
      name: "Calibri",
      size: highlight ? 13 : 11,
      bold: highlight,
      color: { argb: highlight ? "FF059669" : "FF0F172A" },
    }
    valueCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: highlight ? SECTION_FILL : "FFFFFFFF" },
    }
    valueCell.alignment = { vertical: "middle", horizontal: "left" }
    applyThinBorder(labelCell)
    applyThinBorder(valueCell)
    row.height = 22
  }

  const { inputs: i, resultados: r } = data
  const comissaoPct = i.comissao_pct_override !== null
    ? i.comissao_pct_override * 100
    : null

  addTitle("Simulação de Projeto Solar")
  addSubtitle(`Gerado em: ${formatCrmDateTime(generatedAt, EMPTY_VALUE)}`)

  addSection("Identificação")
  addRow("Simulação", data.nome)
  if (data.vendedor) addRow("Vendedor", data.vendedor)
  if (data.criado_em) addRow("Criado em", formatCrmDateTime(data.criado_em, EMPTY_VALUE))

  addSection("Sistema solar")
  addRow("Total do projeto", formatBRL(i.total_projeto))
  addRow("Equipamentos", formatBRL(i.equipamentos))
  addRow("Serviço calculado", formatBRL(r.servico))
  addRow("Qtd. placas", String(i.qtd_placas))
  addRow("Potência por placa", `${i.pot_placa} W`)
  addRow("kWp instalado", `${r.kwp.toFixed(3)} kWp`)
  addRow("R$/Wp (serviço)", formatBRL(r.watt_pico))
  addRow("Geração estimada", `${r.geracao_kwh_mes.toFixed(0)} kWh/mês`)

  addSection("Instalação")
  addRow("Instalação (auto)", formatBRL(i.instalacao))
  addRow("ART", formatBRL(i.art))
  addRow("CA", formatBRL(i.ca))
  addRow("Total instalação", formatBRL(r.total_inst))

  addSection("Custos variáveis")
  addRow("Adequação", formatBRL(i.adequacao))
  addRow("Indicação", formatBRL(i.indicacao))
  addRow("Distância", `${i.km} km`)
  addRow("Custo deslocamento", formatBRL(r.desl_custo))
  addRow("Custo cartão/financ.", formatBRL(i.taxa_cartao))
  addRow("Reserva pós-venda", formatBRL(i.reserva))

  addSection("Tributação e comissão")
  addRow("Imposto NF", formatPct((i.imposto_nf_pct ?? 0) * 100))
  addRow("Valor imposto NF", formatBRL(r.imposto_val))
  addRow("Projetos/mês", i.projetos_vendedor_mes === 0 ? "Sem comissão" : String(i.projetos_vendedor_mes))
  if (comissaoPct !== null) addRow("Comissão (personalizada)", formatPct(comissaoPct))
  addRow("Comissão (valor)", formatBRL(r.comissao_val))
  addRow("Ajuda de custo", formatBRL(r.ajuda_custo))

  addSection("Resultado")
  addRow("Lucro líquido", formatBRL(r.lucro_liquido), true)
  addRow("Margem", formatPct(r.margem_pct), r.margem_pct >= 10)

  const buffer = await workbook.xlsx.writeBuffer()
  downloadBuffer(buffer as ArrayBuffer, fileName)
}

export function simToExportData(sim: CalculadoraSimulacao): ExportData {
  return {
    nome: sim.nome_simulacao,
    vendedor: sim.criado_por_nome,
    criado_em: sim.criado_em,
    inputs: {
      equipamentos: sim.equipamentos ?? 0,
      qtd_placas: sim.qtd_placas ?? 0,
      pot_placa: sim.pot_placa ?? 0,
      total_projeto: sim.total_projeto ?? 0,
      instalacao: sim.instalacao ?? 0,
      art: sim.art ?? 0,
      ca: sim.ca ?? 0,
      adequacao: sim.adequacao ?? 0,
      taxa_cartao: sim.taxa_cartao ?? 0,
      indicacao: sim.indicacao ?? 0,
      km: sim.km ?? 0,
      imposto_nf_pct: sim.imposto_nf_pct ?? 0,
      reserva: sim.reserva ?? 0,
      projetos_vendedor_mes: sim.projetos_vendedor_mes ?? 1,
      comissao_pct_override: sim.comissao_pct_override ?? null,
    },
    resultados: {
      kwp: sim.kwp ?? 0,
      watt_pico: sim.watt_pico ?? 0,
      servico: sim.servico ?? 0,
      comissao_val: sim.comissao_val ?? 0,
      ajuda_custo: sim.ajuda_custo ?? 0,
      desl_custo: sim.desl_custo ?? 0,
      total_inst: sim.total_inst ?? 0,
      imposto_val: sim.imposto_val ?? 0,
      lucro_liquido: sim.lucro_liquido ?? 0,
      margem_pct: sim.margem_pct ?? 0,
      geracao_kwh_mes: sim.geracao_kwh_mes ?? 0,
    },
  }
}

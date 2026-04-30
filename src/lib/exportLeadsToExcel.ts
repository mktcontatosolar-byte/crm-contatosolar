import type { ExportLeadsDataResult } from "@/lib/exportLeadsData"
import { formatCrmDateForFile, formatCrmDateTime } from "@/lib/dateTime"

const EMPTY_VALUE = "\u2014"
const HEADER_FILL = "FF0F766E"
const HEADER_TEXT = "FFFFFFFF"
const BORDER_COLOR = "FFD7DEE7"
const ALT_ROW_FILL = "FFF8FAFC"
const SECTION_FILL = "FFE6FFFA"
const CARD_FILL = "FFF8FAFC"

function withEmptyValue(value: string | null | undefined) {
  return value ?? EMPTY_VALUE
}

function applyThinBorder(cell: {
  border?: unknown
}) {
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

export async function exportLeadsToExcel(data: ExportLeadsDataResult) {
  const ExcelJS = await import("exceljs")
  const workbook = new ExcelJS.Workbook()
  const generatedAt = new Date()
  const fileName = `leads-crm-${formatCrmDateForFile(generatedAt)}.xlsx`

  workbook.creator = "CRM Contato Solar"
  workbook.created = generatedAt
  workbook.modified = generatedAt
  workbook.calcProperties.fullCalcOnLoad = true

  const leadsSheet = workbook.addWorksheet("Leads", {
    views: [{ state: "frozen", ySplit: 1, zoomScale: 90 }],
  })
  const summarySheet = workbook.addWorksheet("Resumo", {
    views: [{ zoomScale: 95 }],
  })

  leadsSheet.properties.defaultRowHeight = 22
  summarySheet.properties.defaultRowHeight = 22

  const leadColumns = [
    { header: "Nome", key: "nome", width: 28 },
    { header: "Telefone", key: "telefone", width: 18 },
    { header: "Cidade", key: "cidade", width: 24 },
    { header: "Tipo de imóvel", key: "tipoImovel", width: 18 },
    { header: "Valor da conta", key: "valorConta", width: 16 },
    { header: "Status da conversa", key: "statusConversa", width: 18 },
    { header: "Atribuído", key: "atribuido", width: 12 },
    { header: "Conta recebida", key: "contaRecebida", width: 16 },
    { header: "Vendedor atribuído", key: "vendedorNome", width: 28 },
    { header: "Data de criação", key: "dataCriacao", width: 20 },
    { header: "Data de atribuição", key: "dataAtribuicao", width: 20 },
    { header: "Primeira resposta", key: "primeiraResposta", width: 20 },
    { header: "Última interação", key: "ultimaInteracao", width: 20 },
    { header: "Observações", key: "observacoes", width: 45 },
  ] as const

  leadsSheet.columns = leadColumns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }))

  data.rows.forEach((row) => {
    leadsSheet.addRow({
      nome: withEmptyValue(row.nome),
      telefone: withEmptyValue(row.telefone),
      cidade: withEmptyValue(row.cidade),
      tipoImovel: withEmptyValue(row.tipoImovel),
      valorConta: withEmptyValue(row.valorConta),
      statusConversa: withEmptyValue(row.statusConversa),
      atribuido: row.atribuido ? "Sim" : "Não",
      contaRecebida: row.contaRecebida ? "Sim" : "Não",
      vendedorNome: withEmptyValue(row.vendedorNome),
      dataCriacao: formatCrmDateTime(row.dataCriacao, EMPTY_VALUE),
      dataAtribuicao: formatCrmDateTime(row.dataAtribuicao, EMPTY_VALUE),
      primeiraResposta: formatCrmDateTime(row.primeiraResposta, EMPTY_VALUE),
      ultimaInteracao: formatCrmDateTime(row.ultimaInteracao, EMPTY_VALUE),
      observacoes: withEmptyValue(row.observacoes),
    })
  })

  leadsSheet.autoFilter = {
    from: "A1",
    to: "N1",
  }

  const leadsHeader = leadsSheet.getRow(1)
  leadsHeader.height = 30
  leadsHeader.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: HEADER_TEXT },
      name: "Calibri",
      size: 11,
    }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    }
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: false,
    }
    applyThinBorder(cell)
  })

  const wrapTextColumns = new Set(["cidade", "observacoes"])

  leadsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return
    }

    row.height = 22

    row.eachCell((cell, colNumber) => {
      const columnKey = String(leadsSheet.getColumn(colNumber).key ?? "")

      cell.font = {
        name: "Calibri",
        size: 11,
        color: { argb: "FF0F172A" },
      }
      cell.alignment = {
        vertical: "middle",
        horizontal:
          columnKey === "atribuido" ||
          columnKey === "contaRecebida"
            ? "center"
            : "left",
        wrapText: wrapTextColumns.has(columnKey),
      }
      applyThinBorder(cell)
    })

    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ALT_ROW_FILL },
        }
      })
    }
  })

  summarySheet.columns = [
    { width: 26 },
    { width: 16 },
    { width: 4 },
    { width: 1 },
    { width: 1 },
  ]

  summarySheet.mergeCells("A1:B1")
  const titleCell = summarySheet.getCell("A1")
  titleCell.value = "Exportação de Leads do CRM"
  titleCell.font = {
    name: "Calibri",
    size: 18,
    bold: true,
    color: { argb: "FF0F172A" },
  }
  titleCell.alignment = { vertical: "middle", horizontal: "left" }

  summarySheet.mergeCells("A2:B2")
  summarySheet.getCell("A2").value = `Gerado em: ${formatCrmDateTime(generatedAt, EMPTY_VALUE)}`
  summarySheet.getCell("A2").font = {
    name: "Calibri",
    size: 11,
    color: { argb: "FF475569" },
  }

  const summaryCards = [
    ["Total de leads", data.summary.totalLeads],
    ["Leads atribuídos", data.summary.leadsAtribuidos],
    ["Leads sem vendedor", data.summary.leadsSemVendedor],
    ["Leads com conta recebida", data.summary.leadsComContaRecebida],
    ["Leads arquivados", data.summary.leadsArquivados],
  ] as const

  summaryCards.forEach(([label, value], index) => {
    const rowIndex = 4 + index
    const labelCell = summarySheet.getCell(`A${rowIndex}`)
    const valueCell = summarySheet.getCell(`B${rowIndex}`)

    labelCell.value = label
    labelCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF0F172A" } }
    labelCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: CARD_FILL },
    }
    labelCell.alignment = { vertical: "middle", horizontal: "left" }
    applyThinBorder(labelCell)

    valueCell.value = value
    valueCell.font = { name: "Calibri", size: 11, color: { argb: "FF0F172A" } }
    valueCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: CARD_FILL },
    }
    valueCell.alignment = { vertical: "middle", horizontal: "center" }
    applyThinBorder(valueCell)
  })

  const sellerTitleRow = 11

  summarySheet.getCell(`A${sellerTitleRow}`).value = "Leads por vendedor"

  ;[`A${sellerTitleRow}`].forEach((cellAddress) => {
    const cell = summarySheet.getCell(cellAddress)
    cell.font = {
      name: "Calibri",
      size: 12,
      bold: true,
      color: { argb: "FF0F172A" },
    }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: SECTION_FILL },
    }
    cell.alignment = { vertical: "middle", horizontal: "left" }
    applyThinBorder(cell)
  })

  const maxDistributionRows = Math.max(
    data.summary.leadsPorVendedor.length,
    1
  )

  for (let index = 0; index < maxDistributionRows; index += 1) {
    const rowIndex = sellerTitleRow + 1 + index
    const sellerItem = data.summary.leadsPorVendedor[index]

    const sellerLabelCell = summarySheet.getCell(`A${rowIndex}`)
    const sellerValueCell = summarySheet.getCell(`B${rowIndex}`)

    sellerLabelCell.value = sellerItem?.label ?? EMPTY_VALUE
    sellerValueCell.value = sellerItem?.value ?? 0

    ;[sellerLabelCell, sellerValueCell].forEach((cell) => {
      cell.font = { name: "Calibri", size: 11, color: { argb: "FF0F172A" } }
      cell.alignment = {
        vertical: "middle",
        horizontal: cell.address.endsWith("B") ? "center" : "left",
        wrapText: false,
      }
      applyThinBorder(cell)
    })

    if (index % 2 === 0) {
      ;[sellerLabelCell, sellerValueCell].forEach((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ALT_ROW_FILL },
        }
      })
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  downloadBuffer(buffer as ArrayBuffer, fileName)
}

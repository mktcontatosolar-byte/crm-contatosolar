import {
  buildDashboardSummary,
  buildProjectRanking,
  buildStatusBreakdown,
  getProjectSellerName,
  toSafeNumber,
} from "@/lib/projects"
import type { ProjectRow } from "@/types/projects"

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function formatCell(value: string | number | boolean | null | undefined) {
  if (typeof value === "number") {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`
  }

  if (typeof value === "boolean") {
    return `<Cell><Data ss:Type="String">${value ? "Sim" : "Não"}</Data></Cell>`
  }

  return `<Cell><Data ss:Type="String">${escapeXml(value ? String(value) : "")}</Data></Cell>`
}

function worksheet(name: string, rows: Array<Array<string | number | boolean | null | undefined>>) {
  const serializedRows = rows
    .map((row) => `<Row>${row.map((cell) => formatCell(cell)).join("")}</Row>`)
    .join("")

  return `
    <Worksheet ss:Name="${escapeXml(name)}">
      <Table>${serializedRows}</Table>
    </Worksheet>
  `
}

function download(filename: string, content: string) {
  const blob = new Blob([content], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  })

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function exportProjectsWorkbook(projects: ProjectRow[]) {
  const summary = buildDashboardSummary(projects)
  const ranking = buildProjectRanking(projects)
  const statuses = buildStatusBreakdown(projects)

  const projectRows: Array<Array<string | number | boolean | null | undefined>> = [
    [
      "Data",
      "Cliente",
      "Marca",
      "Valor do projeto",
      "Forma de pagamento",
      "Valor equipamentos",
      "Valor servico",
      "Custo instalacao",
      "Lucro",
      "Percentual margem",
      "Fechado",
      "Pago",
      "Parecer aprovado",
      "Entregue",
      "Instalado",
      "Vendedor",
      "CPF/CNPJ",
      "Sexo",
      "Cidade",
      "Modulos",
      "Microinversores",
      "W de cada placa",
      "Observacoes",
      "Origem",
      "Status",
      "Criado em",
      "Atualizado em",
    ],
    ...projects.map((project) => [
      project.data,
      project.cliente,
      project.marca,
      toSafeNumber(project.valor_projeto),
      project.forma_pagamento,
      toSafeNumber(project.valor_equipamentos),
      toSafeNumber(project.valor_servico),
      toSafeNumber(project.custo_instalacao),
      toSafeNumber(project.lucro),
      toSafeNumber(project.percentual_margem),
      project.fechado,
      project.pago,
      project.parecer_aprovado,
      project.entregue,
      project.instalado,
      getProjectSellerName(project),
      project.cpf_cnpj,
      project.sexo,
      project.cidade,
      toSafeNumber(project.modulos),
      toSafeNumber(project.microinversores),
      toSafeNumber(project.w_de_cada_placa),
      project.observacoes,
      project.origem_registro,
      project.status,
      project.created_at,
      project.updated_at,
    ]),
  ]

  const summaryRows: Array<Array<string | number>> = [
    ["Indicador", "Valor"],
    ["Total de projetos", summary.quantidadeProjetos],
    ["Total de projetos pagos", summary.projetosPagos],
    ["Total de projetos fechados", summary.projetosFechados],
    ["Faturamento total", summary.faturamentoTotal],
    ["Lucro total", summary.lucroTotal],
    ["Ticket medio", summary.ticketMedio],
  ]

  const rankingRows: Array<Array<string | number>> = [
    ["Vendedor", "Quantidade de projetos", "Valor total", "Lucro total", "Margem media"],
    ...ranking.map((item) => [
      item.vendedor,
      item.quantidade,
      item.valorTotal,
      item.lucroTotal,
      item.margemMedia,
    ]),
  ]

  const statusRows: Array<Array<string | number>> = [
    ["Status", "Quantidade"],
    ...statuses.map((item) => [item.label, item.valor]),
  ]

  const workbook = `<?xml version="1.0"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  ${worksheet("Projetos", projectRows)}
  ${worksheet("Resumo", summaryRows)}
  ${worksheet("Ranking por vendedor", rankingRows)}
  ${worksheet("Status", statusRows)}
</Workbook>`

  const stamp = new Date().toISOString().slice(0, 10)
  download(`projetos-${stamp}.xls`, workbook)
}

